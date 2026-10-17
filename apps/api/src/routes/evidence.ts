import { FastifyInstance, FastifyReply } from "fastify";
import { db } from "../services/database";
import { authorizeSessionAccess, type SessionAccessFailure } from "../services/sessionAccess";
import { evidenceRecords, activityEvents } from "@database/schema";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import {
  evidenceTypeSchema,
  evidenceProvenanceSchema,
  evidenceIntegritySchema,
} from "@contracts/evidence";

const submitEvidenceSchema = z.object({
  type: evidenceTypeSchema,
  timestamp: z.string().datetime(),
  title: z.string().min(1).max(255),
  summary: z.string().min(1).max(2000),
  file: z.string().max(500).optional(),
  revisionId: z.string().uuid().optional(),
  sourceEventId: z.string().max(255).optional(),
  resultId: z.string().max(255).optional(),
  contentRef: z.string().min(1).max(255),
  provenance: evidenceProvenanceSchema.default("candidate_action"),
  integrity: evidenceIntegritySchema.default("available"),
  testStatus: z.enum(["passed", "failed", "pending"]).optional(),
  metadata: z.record(z.unknown()).default({}),
});

const submitActivitySchema = z.object({
  type: z.string().min(1).max(50),
  timestamp: z.string().datetime(),
  file: z.string().max(500).optional(),
  revisionId: z.string().uuid().optional(),
  resultId: z.string().uuid().optional(),
  terminalId: z.string().max(255).optional(),
  detail: z.string().min(1).max(2000),
  provenance: evidenceProvenanceSchema.default("candidate_action"),
  metadata: z.record(z.unknown()).default({}),
});

const batchEvidenceSchema = z.object({
  evidence: z.array(submitEvidenceSchema).max(50),
});

const batchActivitySchema = z.object({
  activities: z.array(submitActivitySchema).max(100),
});

function fail(reply: FastifyReply, access: SessionAccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

// Session-scoped evidence and activity endpoints (mounted under /api/v1/sessions)
export async function sessionEvidenceRoutes(fastify: FastifyInstance) {
  // GET /:sessionId/evidence — paginated evidence records for a session
  fastify.get("/:sessionId/evidence", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const where = eq(evidenceRecords.sessionId, sessionId);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(evidenceRecords)
      .where(where);

    const items = await db
      .select()
      .from(evidenceRecords)
      .where(where)
      .orderBy(desc(evidenceRecords.timestamp))
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit));

    return reply.send({
      success: true,
      data: {
        items,
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
    });
  });

  // POST /:sessionId/evidence — submit a single evidence record
  fastify.post("/:sessionId/evidence", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = submitEvidenceSchema.parse(request.body);

    const access = await authorizeSessionAccess(sessionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    // Check for duplicate contentRef (idempotency)
    const existing = await db.query.evidenceRecords.findFirst({
      where: (e, { and, eq }) =>
        and(eq(e.sessionId, sessionId), eq(e.contentRef, body.contentRef)),
    });
    if (existing) {
      return reply.send({ success: true, data: existing });
    }

    const [evidence] = await db
      .insert(evidenceRecords)
      .values({
        candidateId: access.assignment.candidateId,
        organizationId: access.assignment.organizationId,
        assignmentId: access.assignment.id,
        assessmentId: access.assignment.assessmentId,
        sessionId,
        type: body.type,
        timestamp: new Date(body.timestamp),
        title: body.title,
        summary: body.summary,
        file: body.file ?? null,
        revisionId: body.revisionId ?? null,
        sourceEventId: body.sourceEventId ?? null,
        resultId: body.resultId ?? null,
        contentRef: body.contentRef,
        provenance: body.provenance,
        integrity: body.integrity,
        testStatus: body.testStatus ?? null,
        metadata: body.metadata,
      })
      .returning();

    return reply.status(201).send({ success: true, data: evidence });
  });

  // POST /:sessionId/evidence/batch — submit multiple evidence records
  fastify.post("/:sessionId/evidence/batch", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = batchEvidenceSchema.parse(request.body);

    const access = await authorizeSessionAccess(sessionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const created = [];
    const skipped = [];

    for (const item of body.evidence) {
      // Check for duplicate
      const existing = await db.query.evidenceRecords.findFirst({
        where: (e, { and, eq }) =>
          and(eq(e.sessionId, sessionId), eq(e.contentRef, item.contentRef)),
      });
      if (existing) {
        skipped.push({ contentRef: item.contentRef, reason: "duplicate" });
        continue;
      }

      const [evidence] = await db
        .insert(evidenceRecords)
        .values({
          candidateId: access.assignment.candidateId,
          organizationId: access.assignment.organizationId,
          assignmentId: access.assignment.id,
          assessmentId: access.assignment.assessmentId,
          sessionId,
          type: item.type,
          timestamp: new Date(item.timestamp),
          title: item.title,
          summary: item.summary,
          file: item.file ?? null,
          revisionId: item.revisionId ?? null,
          sourceEventId: item.sourceEventId ?? null,
          resultId: item.resultId ?? null,
          contentRef: item.contentRef,
          provenance: item.provenance,
          integrity: item.integrity,
          testStatus: item.testStatus ?? null,
          metadata: item.metadata,
        })
        .returning();
      created.push(evidence);
    }

    return reply.status(201).send({
      success: true,
      data: { created, skipped, total: body.evidence.length },
    });
  });

  // GET /:sessionId/activity — paginated activity events for a session
  fastify.get("/:sessionId/activity", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const where = eq(activityEvents.sessionId, sessionId);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(activityEvents)
      .where(where);

    const items = await db
      .select()
      .from(activityEvents)
      .where(where)
      .orderBy(desc(activityEvents.timestamp))
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit));

    return reply.send({
      success: true,
      data: {
        items,
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
    });
  });

  // POST /:sessionId/activity — submit a single activity event
  fastify.post("/:sessionId/activity", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = submitActivitySchema.parse(request.body);

    const access = await authorizeSessionAccess(sessionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const [activity] = await db
      .insert(activityEvents)
      .values({
        sessionId,
        type: body.type,
        timestamp: new Date(body.timestamp),
        file: body.file ?? null,
        revisionId: body.revisionId ?? null,
        resultId: body.resultId ?? null,
        terminalId: body.terminalId ?? null,
        detail: body.detail,
        provenance: body.provenance,
        metadata: body.metadata,
      })
      .returning();

    return reply.status(201).send({ success: true, data: activity });
  });

  // POST /:sessionId/activity/batch — submit multiple activity events
  fastify.post("/:sessionId/activity/batch", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = batchActivitySchema.parse(request.body);

    const access = await authorizeSessionAccess(sessionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const created = [];

    for (const item of body.activities) {
      const [activity] = await db
        .insert(activityEvents)
        .values({
          sessionId,
          type: item.type,
          timestamp: new Date(item.timestamp),
          file: item.file ?? null,
          revisionId: item.revisionId ?? null,
          resultId: item.resultId ?? null,
          terminalId: item.terminalId ?? null,
          detail: item.detail,
          provenance: item.provenance,
          metadata: item.metadata,
        })
        .returning();
      created.push(activity);
    }

    return reply.status(201).send({
      success: true,
      data: { created, total: body.activities.length },
    });
  });
}

// Evidence lookup by id (mounted under /api/v1/evidence)
export async function evidenceRoutes(fastify: FastifyInstance) {
  // GET /:evidenceId — fetch a single evidence record
  fastify.get("/:evidenceId", async (request, reply) => {
    const user = (request as any).user;
    const { evidenceId } = request.params as { evidenceId: string };

    const evidence = await db.query.evidenceRecords.findFirst({
      where: (e, { eq }) => eq(e.id, evidenceId),
    });
    if (!evidence) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Evidence not found" },
      });
    }

    const access = await authorizeSessionAccess(evidence.sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    return reply.send({ success: true, data: evidence });
  });
}
