import { FastifyInstance, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import { db } from "../services/database";
import {
  authorizeSessionAccess,
  type SessionAccessFailure,
  type SessionAccessSuccess,
} from "../services/sessionAccess";
import { aiInteractions, aiProviderEnum, aiUsageRecords } from "@database/schema";
import {
  agentRequestSchema,
  applyOperationsRequestSchema,
  type AgentOperation,
  type AgentResponse,
  type ApplyOperationsResponse,
} from "@contracts/agent";
import { resolveCoachContext } from "../services/coachContext";
import { runAgent, type AgentRunResult } from "../services/agentService";
import {
  MemoryWorkspaceStore,
  createDbWorkspaceStore,
  deleteSessionFile,
  readSessionFile,
  validateWorkspacePath,
  writeSessionFile,
  type WorkspaceStore,
} from "../services/workspaceService";
import {
  CoachProviderError,
  isGroqConfigured,
  getGroqModel,
  GROQ_PROVIDER,
} from "../services/groqProvider";
import type { AgentStreamEvent } from "@contracts/execution";
import type { SessionAccessSuccess as SessionAccess } from "../services/sessionAccess";
import {
  createOpenHandsAdapter,
  isOpenHandsEnabled,
  loadOpenHandsConfig,
  OpenHandsConfigError,
  OpenHandsRuntimeError,
} from "../services/openhands";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPENHANDS_PROVIDER = "openhands";

type PersistRunParams = {
  access: SessionAccessSuccess;
  sessionId: string;
  provider: (typeof aiProviderEnum.enumValues)[number];
  model: string;
  prompt: string;
  content: string;
  operations: AgentOperation[];
  latencyMs: number;
  tokensUsed: number;
  metadata: Record<string, unknown>;
};

/**
 * Persist a completed (or partial) agent run: usage record plus the user and
 * assistant interaction rows. Shared by the Groq and OpenHands paths so both
 * obey the same evidence rules.
 */
async function persistAgentRun(params: PersistRunParams): Promise<string> {
  const { access, sessionId } = params;
  const [usage] = await db
    .insert(aiUsageRecords)
    .values({
      organizationId: access.assignment.organizationId,
      candidateId: access.assignment.candidateId,
      sessionId,
      provider: params.provider,
      model: params.model,
      interactionType: "code_generation",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: params.tokensUsed,
      metadata: params.metadata,
    })
    .returning();

  await db.insert(aiInteractions).values({
    sessionId,
    type: "code_generation",
    role: "user",
    content: params.prompt,
    model: params.model,
    provider: params.provider,
    tokensUsed: 0,
    metadata: { kind: "agent_prompt" },
  });

  const [assistant] = await db
    .insert(aiInteractions)
    .values({
      sessionId,
      usageRecordId: usage?.id ?? null,
      type: "code_generation",
      role: "assistant",
      content: params.content,
      model: params.model,
      provider: params.provider,
      tokensUsed: params.tokensUsed,
      latencyMs: params.latencyMs,
      metadata: {
        kind: "agent_response",
        applied: params.operations.filter((op) => op.status === "applied").map((op) => op.path),
        staged: params.operations.filter((op) => op.status === "pending").map((op) => op.path),
        ...params.metadata,
      },
    })
    .returning();
  return assistant.id;
}

function fail(reply: FastifyReply, access: SessionAccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

function errorReply(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return reply.status(status).send({ success: false, error: { code, message, details } });
}

export async function aiAgentRoutes(fastify: FastifyInstance) {
  // POST /:sessionId/ai-agent — run the bounded tool-calling coding agent.
  //
  // Persisted (UUID) sessions act on the database-backed workspace and are
  // authorized + persisted. Local demo sessions (no server row) act on an
  // in-memory snapshot the client supplies; changes are returned for the client
  // to apply to its own workspace and are honestly marked not persisted.
  fastify.post("/:sessionId/ai-agent", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = agentRequestSchema.parse(request.body ?? {});
    const startedAt = Date.now();
    const isPersisted = UUID_PATTERN.test(sessionId);

    let access: SessionAccessSuccess | null = null;
    let store: WorkspaceStore;
    let taskContext = {
      instructions: null as string | null,
      requirements: [] as string[],
      aiPolicy: null as string | null,
    };

    if (isPersisted) {
      const result = await authorizeSessionAccess(sessionId, user.id, "write");
      if (!result.ok) return fail(reply, result);
      access = result;

      const resolved = await resolveCoachContext(access, body.context ?? {});
      if (resolved.policyBlocked) {
        return errorReply(reply, 403, "AI_POLICY_BLOCKED", resolved.policyBlocked.message);
      }
      taskContext = {
        instructions: resolved.context.instructions ?? null,
        requirements: resolved.context.requirements ?? [],
        aiPolicy: resolved.aiPolicy,
      };
      store = createDbWorkspaceStore(sessionId);
    } else {
      // Local demo session: use the workspace files the client already holds.
      store = new MemoryWorkspaceStore(body.context?.files ?? []);
      taskContext = {
        instructions: body.context?.instructions ?? null,
        requirements: body.context?.requirements ?? [],
        aiPolicy: null,
      };
    }

    if (!isGroqConfigured()) {
      return errorReply(
        reply,
        503,
        "AI_PROVIDER_UNAVAILABLE",
        "The AI coding agent is not configured on this server.",
      );
    }

    let result: AgentRunResult;
    try {
      result = await runAgent({
        store,
        prompt: body.prompt,
        history: body.history,
        taskContext,
      });
    } catch (error) {
      if (error instanceof CoachProviderError) {
        return errorReply(reply, error.statusCode, error.code.toUpperCase(), error.message, {
          retryAfterSeconds: error.retryAfterSeconds ?? null,
          quotaType: error.quotaType ?? null,
        });
      }
      request.log.error(error);
      return errorReply(reply, 502, "PROVIDER_UPSTREAM", "The AI provider request failed.");
    }

    const latencyMs = Math.max(0, Date.now() - startedAt);
    const createdAt = new Date().toISOString();

    let responseId = `agent_${createdAt}`;

    if (isPersisted && access) {
      const [usage] = await db
        .insert(aiUsageRecords)
        .values({
          organizationId: access.assignment.organizationId,
          candidateId: access.assignment.candidateId,
          sessionId,
          provider: GROQ_PROVIDER,
          model: result.model,
          interactionType: "code_generation",
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: result.tokensUsed,
          metadata: { iterations: result.iterations, stopReason: result.stopReason },
        })
        .returning();

      await db.insert(aiInteractions).values({
        sessionId,
        type: "code_generation",
        role: "user",
        content: body.prompt,
        model: result.model,
        provider: GROQ_PROVIDER,
        tokensUsed: 0,
        metadata: { kind: "agent_prompt" },
      });

      const [assistant] = await db
        .insert(aiInteractions)
        .values({
          sessionId,
          usageRecordId: usage?.id ?? null,
          type: "code_generation",
          role: "assistant",
          content: result.content,
          model: result.model,
          provider: GROQ_PROVIDER,
          tokensUsed: result.tokensUsed,
          latencyMs,
          metadata: {
            kind: "agent_response",
            applied: result.operations.filter((op) => op.status === "applied").map((op) => op.path),
            staged: result.operations.filter((op) => op.status === "pending").map((op) => op.path),
          },
        })
        .returning();
      responseId = assistant.id;
    }

    const response: AgentResponse = {
      id: responseId,
      sessionId,
      content: result.content,
      provider: GROQ_PROVIDER,
      model: result.model,
      operations: result.operations,
      stopReason: result.stopReason,
      tokensUsed: result.tokensUsed,
      latencyMs,
      persisted: isPersisted,
      createdAt,
    };
    return reply.status(isPersisted ? 201 : 200).send({ success: true, data: response });
  });

  // POST /:sessionId/ai-agent/stream — same bounded agent loop, but streams the
  // real tool-call steps to the client as Server-Sent Events so the chat can show
  // progress live. Every step reflects a tool call the server actually executed.
  fastify.post("/:sessionId/ai-agent/stream", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = agentRequestSchema.parse(request.body ?? {});
    const startedAt = Date.now();
    const isPersisted = UUID_PATTERN.test(sessionId);

    let access: SessionAccessSuccess | null = null;
    let store: WorkspaceStore;
    let taskContext = {
      instructions: null as string | null,
      requirements: [] as string[],
      aiPolicy: null as string | null,
    };

    if (isPersisted) {
      const result = await authorizeSessionAccess(sessionId, user.id, "write");
      if (!result.ok) return fail(reply, result);
      access = result;
      const resolved = await resolveCoachContext(access, body.context ?? {});
      if (resolved.policyBlocked) {
        return errorReply(reply, 403, "AI_POLICY_BLOCKED", resolved.policyBlocked.message);
      }
      taskContext = {
        instructions: resolved.context.instructions ?? null,
        requirements: resolved.context.requirements ?? [],
        aiPolicy: resolved.aiPolicy,
      };
      store = createDbWorkspaceStore(sessionId);
    } else {
      store = new MemoryWorkspaceStore(body.context?.files ?? []);
      taskContext = {
        instructions: body.context?.instructions ?? null,
        requirements: body.context?.requirements ?? [],
        aiPolicy: null,
      };
    }

    if (!isGroqConfigured()) {
      return errorReply(
        reply,
        503,
        "AI_PROVIDER_UNAVAILABLE",
        "The AI coding agent is not configured on this server.",
      );
    }

    reply.hijack();
    const raw = reply.raw;
    // reply.hijack() bypasses onSend hooks, so @fastify/cors cannot add its
    // headers to this response. Reflect the (already-preflighted) origin so the
    // browser accepts the cross-origin stream.
    const origin = request.headers.origin;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(origin
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            Vary: "Origin",
          }
        : {}),
    });
    let closed = false;
    raw.on("close", () => {
      closed = true;
    });
    const send = (event: AgentStreamEvent) => {
      if (closed) return;
      raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const result = await runAgent({
        store,
        prompt: body.prompt,
        history: body.history,
        taskContext,
        onEvent: send,
      });

      const latencyMs = Math.max(0, Date.now() - startedAt);
      if (isPersisted && access) {
        await persistAgentRun({
          access,
          sessionId,
          provider: GROQ_PROVIDER,
          model: result.model,
          prompt: body.prompt,
          content: result.content,
          operations: result.operations,
          latencyMs,
          tokensUsed: result.tokensUsed,
          metadata: { iterations: result.iterations, stopReason: result.stopReason },
        });
      }

      send({
        type: "done",
        phase: "done",
        detail: "Task completed",
        content: result.content,
        stopReason: result.stopReason,
        tokensUsed: result.tokensUsed,
        model: result.model,
        persisted: isPersisted,
        operations: result.operations,
      });
    } catch (error) {
      const message =
        error instanceof CoachProviderError
          ? error.message
          : "The AI provider request failed.";
      send({
        type: "error",
        phase: "error",
        detail: message,
        stopReason: "provider_error",
        model: getGroqModel(),
        persisted: isPersisted,
      });
    } finally {
      raw.end();
    }
  });

  // POST /:sessionId/ai-agent/apply — apply the candidate-approved operations.
  // Every operation is re-validated and re-authorized here; nothing staged on
  // the client is trusted. Deletes are applied; creates/edits are idempotent.
  fastify.post("/:sessionId/ai-agent/apply", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = applyOperationsRequestSchema.parse(request.body ?? {});

    if (!UUID_PATTERN.test(sessionId)) {
      return errorReply(
        reply,
        400,
        "AI_AGENT_REQUIRES_SESSION",
        "The coding agent requires a persisted assessment session.",
      );
    }

    const access = await authorizeSessionAccess(sessionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const applied: AgentOperation[] = [];
    const failed: AgentOperation[] = [];

    for (const op of body.operations) {
      const validated = validateWorkspacePath(op.path);
      if (!validated.ok) {
        failed.push({ ...op, status: "failed", error: validated.error });
        continue;
      }

      if (op.kind === "delete_file") {
        const existing = await readSessionFile(sessionId, validated.path);
        if (!existing) {
          failed.push({ ...op, status: "failed", error: "File no longer exists." });
          continue;
        }
        if (existing.isReadOnly) {
          failed.push({ ...op, status: "failed", error: "File is read-only." });
          continue;
        }
        const deleted = await deleteSessionFile(sessionId, validated.path);
        if (deleted) {
          applied.push({
            ...op,
            status: "applied",
            appliedAt: new Date().toISOString(),
            error: null,
          });
        } else {
          failed.push({ ...op, status: "failed", error: "Delete failed." });
        }
        continue;
      }

      if (op.kind === "create_file" || op.kind === "edit_file") {
        if (typeof op.content !== "string") {
          failed.push({ ...op, status: "failed", error: "Missing file content." });
          continue;
        }
        const existing = await readSessionFile(sessionId, validated.path);
        if (op.kind === "create_file" && existing) {
          failed.push({ ...op, status: "failed", error: "File already exists." });
          continue;
        }
        if (op.kind === "edit_file" && existing?.isReadOnly) {
          failed.push({ ...op, status: "failed", error: "File is read-only." });
          continue;
        }
        await writeSessionFile(sessionId, validated.path, op.content);
        applied.push({
          ...op,
          status: "applied",
          appliedAt: new Date().toISOString(),
          error: null,
        });
        continue;
      }

      if (op.kind === "create_directory") {
        await writeSessionFile(sessionId, `${validated.path}/.gitkeep`, "");
        applied.push({
          ...op,
          status: "applied",
          appliedAt: new Date().toISOString(),
          error: null,
        });
        continue;
      }

      failed.push({ ...op, status: "failed", error: "Unsupported operation." });
    }

    const response: ApplyOperationsResponse = { applied, failed };
    return reply.send({ success: true, data: response });
  });
}
