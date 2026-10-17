import { FastifyInstance, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import { db } from "../services/database";
import {
  authorizeSessionAccess,
  type SessionAccessFailure,
  type SessionAccessSuccess,
} from "../services/sessionAccess";
import { aiInteractions, aiUsageRecords } from "@database/schema";
import { aiCoachRequestSchema, type AiCoachResponse } from "@contracts/ai";
import {
  COACH_MODEL,
  COACH_PROVIDER,
  buildCoachMessages,
  generateCoachResponse,
  type CoachAction,
} from "../services/coachEngine";
import { resolveCoachContext } from "../services/coachContext";
import {
  CoachProviderError,
  isGroqConfigured,
  requestCoachCompletion,
} from "../services/groqProvider";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTION_LABEL: Record<CoachAction, string> = {
  hint: "Give me a focused hint.",
  explain: "Explain the active code.",
  debug: "Help me debug the latest error.",
  prompt: "",
};

function fail(reply: FastifyReply, access: SessionAccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

function errorReply(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ success: false, error: { code, message } });
}

type CoachOutcome = {
  content: string;
  explanation: string | null;
  suggestion: AiCoachResponse["suggestion"];
  provider: AiCoachResponse["provider"];
  model: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
};

export async function aiCoachRoutes(fastify: FastifyInstance) {
  // POST /:sessionId/ai-coach — request a coach response
  fastify.post("/:sessionId/ai-coach", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = aiCoachRequestSchema.parse(request.body ?? {});
    const action: CoachAction = body.action;
    const prompt = body.prompt ?? "";

    const startedAt = Date.now();

    // A persisted backend session requires a real assessment-session UUID. Local
    // demo sessions keep their interactions client-side and are not persisted.
    const isPersistable = UUID_PATTERN.test(sessionId);
    let access: SessionAccessSuccess | null = null;

    if (isPersistable) {
      const result = await authorizeSessionAccess(sessionId, user.id, "read");
      if (!result.ok) return fail(reply, result);
      access = result;
    }

    // Server-side context (authoritative for persisted sessions) + AI policy.
    const resolved = await resolveCoachContext(access, body.context ?? {});

    if (access && resolved.policyBlocked) {
      return errorReply(reply, 403, "AI_POLICY_BLOCKED", resolved.policyBlocked.message);
    }

    const configured = isGroqConfigured();

    // Fail clearly in production when the provider is not configured, rather
    // than silently serving the deterministic preview.
    if (!configured && process.env.NODE_ENV === "production") {
      return errorReply(
        reply,
        503,
        "AI_PROVIDER_UNAVAILABLE",
        "The AI Coach is not configured on this server.",
      );
    }

    let outcome: CoachOutcome;

    if (configured) {
      let completion;
      try {
        const messages = buildCoachMessages({
          action,
          prompt,
          context: resolved.context,
          history: body.history,
          reportedDiagnostics: resolved.reportedDiagnostics,
          filesSource: resolved.filesSource,
          aiPolicy: resolved.aiPolicy,
        });
        completion = await requestCoachCompletion(messages);
      } catch (error) {
        if (error instanceof CoachProviderError) {
          return errorReply(reply, error.statusCode, error.code.toUpperCase(), error.message);
        }
        request.log.error(error);
        return errorReply(reply, 502, "PROVIDER_UPSTREAM", "The AI provider request failed.");
      }

      outcome = {
        content: completion.content,
        explanation: null,
        suggestion: null,
        provider: "groq",
        model: completion.model,
        tokensUsed: completion.totalTokens,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
      };
    } else {
      // Explicitly labelled deterministic preview. Never presented as a model.
      const result = generateCoachResponse(action, prompt, resolved.context);
      outcome = {
        content: result.content,
        explanation: result.explanation,
        suggestion: result.suggestion ?? null,
        provider: COACH_PROVIDER,
        model: COACH_MODEL,
        tokensUsed: 0,
        promptTokens: 0,
        completionTokens: 0,
      };
    }

    const latencyMs = Math.max(0, Date.now() - startedAt);
    const createdAt = new Date().toISOString();
    const mode = configured ? "groq" : "deterministic";

    if (!isPersistable || !access) {
      const response: AiCoachResponse = {
        id: randomUUID(),
        sessionId: null,
        type: "coach_response",
        role: "assistant",
        content: outcome.content,
        explanation: outcome.explanation,
        suggestion: outcome.suggestion,
        provider: outcome.provider,
        model: outcome.model,
        tokensUsed: outcome.tokensUsed,
        latencyMs,
        persisted: false,
        createdAt,
      };
      return reply.send({ success: true, data: response });
    }

    const [usage] = await db
      .insert(aiUsageRecords)
      .values({
        organizationId: access.assignment.organizationId,
        candidateId: access.assignment.candidateId,
        sessionId,
        provider: outcome.provider,
        model: outcome.model,
        interactionType: "coach_response",
        promptTokens: outcome.promptTokens,
        completionTokens: outcome.completionTokens,
        totalTokens: outcome.tokensUsed,
        metadata: { action, mode },
      })
      .returning();

    const userContent = (action === "prompt" ? prompt.trim() : ACTION_LABEL[action]) || action;
    await db.insert(aiInteractions).values({
      sessionId,
      type: "coach_prompt",
      role: "user",
      content: userContent,
      model: outcome.model,
      provider: outcome.provider,
      tokensUsed: 0,
      metadata: { action },
    });

    const [assistant] = await db
      .insert(aiInteractions)
      .values({
        sessionId,
        usageRecordId: usage?.id ?? null,
        type: "coach_response",
        role: "assistant",
        content: outcome.content,
        explanation: outcome.explanation,
        suggestion: outcome.suggestion,
        model: outcome.model,
        provider: outcome.provider,
        tokensUsed: outcome.tokensUsed,
        latencyMs,
        metadata: { action },
      })
      .returning();

    const response: AiCoachResponse = {
      id: assistant.id,
      sessionId,
      type: "coach_response",
      role: "assistant",
      content: assistant.content,
      explanation: assistant.explanation,
      suggestion: (assistant.suggestion as AiCoachResponse["suggestion"]) ?? null,
      provider: outcome.provider,
      model: assistant.model,
      tokensUsed: assistant.tokensUsed,
      latencyMs: assistant.latencyMs,
      persisted: true,
      createdAt: assistant.createdAt.toISOString(),
    };
    return reply.status(201).send({ success: true, data: response });
  });

  // GET /:sessionId/ai-coach/history — list persisted coach interactions
  fastify.get("/:sessionId/ai-coach/history", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    if (!UUID_PATTERN.test(sessionId)) {
      return reply.send({ success: true, data: [] });
    }

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const interactions = await db.query.aiInteractions.findMany({
      where: (i, { eq }) => eq(i.sessionId, sessionId),
      orderBy: (i, { asc }) => [asc(i.createdAt)],
    });
    return reply.send({ success: true, data: interactions });
  });
}
