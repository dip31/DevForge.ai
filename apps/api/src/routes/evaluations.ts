import { FastifyInstance } from "fastify";
import { db } from "../services/database";
import {
  evaluations,
  evaluationCriteria,
  candidateFeedback,
  reviewerNotes,
  reviewerDecisions,
} from "@database/schema";
import { eq, and, or, inArray, desc, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { evaluationStatusSchema } from "@contracts/evaluation";

const addNoteSchema = z.object({
  note: z.string().min(1).max(10000),
  criterionId: z.string().uuid().optional(),
  isInternal: z.boolean().optional().default(true),
});

const submitDecisionSchema = z.object({
  overallOutcome: z.string().min(1).max(50),
  criterionDecisions: z
    .array(
      z.object({
        criterionId: z.string().uuid(),
        status: evaluationStatusSchema,
        notes: z.string().max(2000).optional(),
      }),
    )
    .optional()
    .default([]),
  notes: z.string().max(10000).optional(),
  isFinal: z.boolean().optional().default(false),
});

async function getUserOrgIds(userId: string): Promise<string[]> {
  const memberships = await db.query.organizationMemberships.findMany({
    where: (m, { eq }) => eq(m.userId, userId),
  });
  return memberships.map((m) => m.organizationId);
}

async function getMembership(userId: string, organizationId: string) {
  return db.query.organizationMemberships.findFirst({
    where: (m, { eq, and }) => and(eq(m.organizationId, organizationId), eq(m.userId, userId)),
  });
}

type LoadedEvaluation =
  | { ok: true; evaluation: typeof evaluations.$inferSelect; isMember: boolean }
  | { ok: false; status: 403 | 404; code: string; message: string };

async function loadEvaluation(id: string, userId: string): Promise<LoadedEvaluation> {
  const evaluation = await db.query.evaluations.findFirst({
    where: (e, { eq }) => eq(e.id, id),
  });
  if (!evaluation) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Evaluation not found" };
  }
  const orgIds = await getUserOrgIds(userId);
  const isMember = orgIds.includes(evaluation.organizationId);
  if (!isMember && evaluation.candidateId !== userId) {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "Access denied" };
  }
  return { ok: true, evaluation, isMember };
}

export async function evaluationRoutes(fastify: FastifyInstance) {
  // GET / — list evaluations scoped to the caller's access
  fastify.get("/", async (request, reply) => {
    const user = (request as any).user;
    const {
      page = 1,
      limit = 20,
      candidateId,
      organizationId,
    } = request.query as {
      page?: number;
      limit?: number;
      candidateId?: string;
      organizationId?: string;
    };

    const orgIds = await getUserOrgIds(user.id);
    const conditions: any[] = [];

    if (organizationId) {
      if (!orgIds.includes(organizationId)) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Access denied" },
        });
      }
      conditions.push(eq(evaluations.organizationId, organizationId));
    } else {
      const access = orgIds.length
        ? or(eq(evaluations.candidateId, user.id), inArray(evaluations.organizationId, orgIds))
        : eq(evaluations.candidateId, user.id);
      if (access) conditions.push(access);
    }

    if (candidateId) conditions.push(eq(evaluations.candidateId, candidateId));

    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(evaluations)
      .where(where);

    const items = await db
      .select()
      .from(evaluations)
      .where(where)
      .orderBy(desc(evaluations.evaluatedAt))
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

  // GET /session/:sessionId — evaluation for a session
  fastify.get("/session/:sessionId", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const evaluation = await db.query.evaluations.findFirst({
      where: (e, { eq }) => eq(e.sessionId, sessionId),
    });
    if (!evaluation) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Evaluation not found" },
      });
    }

    const orgIds = await getUserOrgIds(user.id);
    if (!orgIds.includes(evaluation.organizationId) && evaluation.candidateId !== user.id) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied" },
      });
    }

    return reply.send({ success: true, data: evaluation });
  });

  // GET /:id — fetch a single evaluation
  fastify.get("/:id", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const result = await loadEvaluation(id, user.id);
    if (!result.ok) {
      return reply
        .status(result.status)
        .send({ success: false, error: { code: result.code, message: result.message } });
    }
    return reply.send({ success: true, data: result.evaluation });
  });

  // GET /:id/criteria — evaluation criteria (candidates only see visible criteria)
  fastify.get("/:id/criteria", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const result = await loadEvaluation(id, user.id);
    if (!result.ok) {
      return reply
        .status(result.status)
        .send({ success: false, error: { code: result.code, message: result.message } });
    }

    const conditions: any[] = [eq(evaluationCriteria.evaluationId, id)];
    if (!result.isMember) conditions.push(eq(evaluationCriteria.candidateVisible, true));

    const criteria = await db
      .select()
      .from(evaluationCriteria)
      .where(and(...conditions))
      .orderBy(asc(evaluationCriteria.createdAt));

    return reply.send({ success: true, data: criteria });
  });

  // GET /:id/feedback — candidate feedback (hidden from candidates until released)
  fastify.get("/:id/feedback", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const result = await loadEvaluation(id, user.id);
    if (!result.ok) {
      return reply
        .status(result.status)
        .send({ success: false, error: { code: result.code, message: result.message } });
    }

    const feedback = await db.query.candidateFeedback.findFirst({
      where: (f, { eq }) => eq(f.evaluationId, id),
    });
    if (!feedback) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Feedback not found" },
      });
    }

    if (!result.isMember && !feedback.isAvailable) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Feedback not available" },
      });
    }

    return reply.send({ success: true, data: feedback });
  });

  // POST /:id/release-feedback — release feedback to the candidate
  fastify.post("/:id/release-feedback", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const result = await loadEvaluation(id, user.id);
    if (!result.ok) {
      return reply
        .status(result.status)
        .send({ success: false, error: { code: result.code, message: result.message } });
    }

    const membership = await getMembership(user.id, result.evaluation.organizationId);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    const existing = await db.query.candidateFeedback.findFirst({
      where: (f, { eq }) => eq(f.evaluationId, id),
    });

    const now = new Date();
    if (existing) {
      await db
        .update(candidateFeedback)
        .set({ isAvailable: true, releasedAt: now, releasedBy: user.id, updatedAt: now })
        .where(eq(candidateFeedback.id, existing.id));
    } else {
      await db.insert(candidateFeedback).values({
        evaluationId: id,
        feedback: {},
        isAvailable: true,
        releasedAt: now,
        releasedBy: user.id,
      });
    }

    await db
      .update(evaluations)
      .set({ reviewerStatus: "reviewed", updatedAt: now })
      .where(eq(evaluations.id, id));

    return reply.send({ success: true, data: { message: "Feedback released" } });
  });

  // POST /:evaluationId/reviewer-notes — add an internal reviewer note
  fastify.post("/:evaluationId/reviewer-notes", async (request, reply) => {
    const user = (request as any).user;
    const { evaluationId } = request.params as { evaluationId: string };
    const body = addNoteSchema.parse(request.body);

    const result = await loadEvaluation(evaluationId, user.id);
    if (!result.ok) {
      return reply
        .status(result.status)
        .send({ success: false, error: { code: result.code, message: result.message } });
    }

    const membership = await getMembership(user.id, result.evaluation.organizationId);
    if (!membership) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    const [note] = await db
      .insert(reviewerNotes)
      .values({
        evaluationId,
        reviewerId: user.id,
        note: body.note,
        isInternal: body.isInternal,
        criterionId: body.criterionId ?? null,
      })
      .returning();

    return reply.status(201).send({ success: true, data: note });
  });

  // POST /:evaluationId/reviewer-decisions — submit a reviewer decision
  fastify.post("/:evaluationId/reviewer-decisions", async (request, reply) => {
    const user = (request as any).user;
    const { evaluationId } = request.params as { evaluationId: string };
    const body = submitDecisionSchema.parse(request.body);

    const result = await loadEvaluation(evaluationId, user.id);
    if (!result.ok) {
      return reply
        .status(result.status)
        .send({ success: false, error: { code: result.code, message: result.message } });
    }

    const membership = await getMembership(user.id, result.evaluation.organizationId);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    const now = new Date();
    const existing = await db.query.reviewerDecisions.findFirst({
      where: (d, { eq }) => eq(d.evaluationId, evaluationId),
    });

    let decision;
    if (existing) {
      [decision] = await db
        .update(reviewerDecisions)
        .set({
          overallOutcome: body.overallOutcome,
          criterionDecisions: body.criterionDecisions,
          notes: body.notes ?? null,
          isFinal: body.isFinal,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(reviewerDecisions.id, existing.id))
        .returning();
    } else {
      [decision] = await db
        .insert(reviewerDecisions)
        .values({
          evaluationId,
          reviewerId: user.id,
          overallOutcome: body.overallOutcome,
          criterionDecisions: body.criterionDecisions,
          notes: body.notes ?? null,
          isFinal: body.isFinal,
          decidedAt: now,
        })
        .returning();
    }

    await db
      .update(evaluations)
      .set({
        reviewerStatus: body.isFinal ? "reviewed" : "needs_attention",
        reviewerOutcome: body.overallOutcome,
        internalReviewerNotes: body.notes ?? result.evaluation.internalReviewerNotes ?? "",
        updatedAt: now,
      })
      .where(eq(evaluations.id, evaluationId));

    return reply.status(201).send({ success: true, data: decision });
  });
}
