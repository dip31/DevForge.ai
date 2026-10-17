import { FastifyInstance, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import { db } from "../services/database";
import { authorizeSessionAccess, type SessionAccessFailure } from "../services/sessionAccess";
import { aiInteractions, aiUsageRecords } from "@database/schema";
import { aiCoachRequestSchema, type AiCoachResponse } from "@contracts/ai";
import {
  COACH_MODEL,
  COACH_PROVIDER,
  generateCoachResponse,
  type CoachAction,
} from "../services/coachEngine";

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

export async function aiCoachRoutes(fastify: FastifyInstance) {
  // POST /:sessionId/ai-coach — request a coach response
  fastify.post("/:sessionId/ai-coach", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = aiCoachRequestSchema.parse(request.body ?? {});
    const action: CoachAction = body.action;
    const prompt = body.prompt ?? "";

    const startedAt = Date.now();
    const result = generateCoachResponse(action, prompt, body.context ?? {});
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const createdAt = new Date().toISOString();

    // A persisted backend session requires a real assessment-session UUID. Local
    // demo sessions keep their interactions client-side and are not persisted.
    const isPersistable = UUID_PATTERN.test(sessionId);
    if (!isPersistable) {
      const response: AiCoachResponse = {
        id: randomUUID(),
        sessionId: null,
        type: "coach_response",
        role: "assistant",
        content: result.content,
        explanation: result.explanation,
        suggestion: result.suggestion ?? null,
        provider: COACH_PROVIDER,
        model: COACH_MODEL,
        tokensUsed: 0,
        latencyMs,
        persisted: false,
        createdAt,
      };
      return reply.send({ success: true, data: response });
    }

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const [usage] = await db
      .insert(aiUsageRecords)
      .values({
        organizationId: access.assignment.organizationId,
        candidateId: access.assignment.candidateId,
        sessionId,
        provider: COACH_PROVIDER,
        model: COACH_MODEL,
        interactionType: "coach_response",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        metadata: { action, mode: "deterministic" },
      })
      .returning();

    const userContent = (action === "prompt" ? prompt.trim() : ACTION_LABEL[action]) || action;
    await db.insert(aiInteractions).values({
      sessionId,
      type: "coach_prompt",
      role: "user",
      content: userContent,
      model: COACH_MODEL,
      provider: COACH_PROVIDER,
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
        content: result.content,
        explanation: result.explanation,
        suggestion: result.suggestion ?? null,
        model: COACH_MODEL,
        provider: COACH_PROVIDER,
        tokensUsed: 0,
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
      provider: COACH_PROVIDER,
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
