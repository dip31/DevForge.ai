import { FastifyInstance } from "fastify";
import { db } from "../services/database";
import { practiceTasks, practiceSessions, practiceAllowances, usageLedger } from "@database/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { startPracticeRequestSchema } from "@contracts/practice";

async function getOrCreateAllowance(candidateId: string) {
  const existing = await db.query.practiceAllowances.findFirst({
    where: (a, { eq }) => eq(a.candidateId, candidateId),
  });
  if (existing) return existing;

  const [created] = await db.insert(practiceAllowances).values({ candidateId }).returning();
  return created;
}

export async function practiceRoutes(fastify: FastifyInstance) {
  // GET /tasks — paginated practice task catalog
  fastify.get("/tasks", async (request, reply) => {
    const {
      page = 1,
      limit = 20,
      isActive,
    } = request.query as {
      page?: number;
      limit?: number;
      isActive?: boolean;
    };

    const conditions: any[] = [];
    if (isActive !== undefined) conditions.push(eq(practiceTasks.isActive, isActive));
    const where = conditions.length ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(practiceTasks)
      .where(where);

    const items = await db
      .select({
        id: practiceTasks.id,
        title: practiceTasks.title,
        description: practiceTasks.description,
        difficulty: practiceTasks.difficulty,
        skills: practiceTasks.skills,
        durationMinutes: practiceTasks.durationMinutes,
        isActive: practiceTasks.isActive,
      })
      .from(practiceTasks)
      .where(where)
      .orderBy(asc(practiceTasks.order))
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

  // GET /tasks/:taskId — full practice task detail
  fastify.get("/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };

    const task = await db.query.practiceTasks.findFirst({
      where: (t, { eq }) => eq(t.id, taskId),
    });
    if (!task) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Practice task not found" },
      });
    }

    return reply.send({ success: true, data: task });
  });

  // GET /sessions — paginated practice sessions for the caller
  fastify.get("/sessions", async (request, reply) => {
    const user = (request as any).user;
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

    const where = eq(practiceSessions.candidateId, user.id);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(practiceSessions)
      .where(where);

    const items = await db
      .select()
      .from(practiceSessions)
      .where(where)
      .orderBy(desc(practiceSessions.createdAt))
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

  // POST /sessions/start — start a new practice session, consuming an attempt
  fastify.post("/sessions/start", async (request, reply) => {
    const user = (request as any).user;
    const body = startPracticeRequestSchema.parse(request.body);

    const task = await db.query.practiceTasks.findFirst({
      where: (t, { eq, and }) => and(eq(t.id, body.taskId), eq(t.isActive, true)),
    });
    if (!task) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Practice task not found" },
      });
    }

    const allowance = await getOrCreateAllowance(user.id);
    const remainingFree = allowance.freeAttemptsLimit - allowance.freeAttemptsUsed;
    const paidRemaining = allowance.paidAttemptsPurchased - allowance.paidAttemptsUsed;
    const totalRemaining = remainingFree + paidRemaining;

    if (totalRemaining <= 0) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "No practice attempts remaining" },
      });
    }

    const now = new Date();
    const consumedFree = remainingFree > 0;
    await db
      .update(practiceAllowances)
      .set({
        freeAttemptsUsed: consumedFree
          ? allowance.freeAttemptsUsed + 1
          : allowance.freeAttemptsUsed,
        paidAttemptsUsed: consumedFree
          ? allowance.paidAttemptsUsed
          : allowance.paidAttemptsUsed + 1,
        updatedAt: now,
      })
      .where(eq(practiceAllowances.id, allowance.id));

    await db.insert(usageLedger).values({
      candidateId: user.id,
      eventType: "practice_start",
      eventId: task.id,
      attemptsConsumed: 1,
      description: `Started practice task: ${task.title}`,
    });

    const [{ count: attemptCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(practiceSessions)
      .where(and(eq(practiceSessions.candidateId, user.id), eq(practiceSessions.taskId, task.id)));

    const [session] = await db
      .insert(practiceSessions)
      .values({
        candidateId: user.id,
        taskId: task.id,
        status: "in_progress",
        attemptNumber: attemptCount + 1,
        startedAt: now,
        durationMinutes: task.durationMinutes,
        timeRemainingSeconds: task.durationMinutes * 60,
        totalPausedSeconds: 0,
        files: {},
        revisions: [],
        runHistory: [],
        testRuns: [],
        activity: [],
        coachMessages: [],
        metadata: {},
      })
      .returning();

    return reply.status(201).send({ success: true, data: session });
  });

  // GET /sessions/:sessionId — fetch a practice session owned by the caller
  fastify.get("/sessions/:sessionId", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const session = await db.query.practiceSessions.findFirst({
      where: (s, { eq, and }) => and(eq(s.id, sessionId), eq(s.candidateId, user.id)),
    });
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Practice session not found" },
      });
    }

    return reply.send({ success: true, data: session });
  });

  // GET /allowance — remaining practice attempts for the caller
  fastify.get("/allowance", async (request, reply) => {
    const user = (request as any).user;
    const allowance = await getOrCreateAllowance(user.id);

    const remainingFree = allowance.freeAttemptsLimit - allowance.freeAttemptsUsed;
    const paidRemaining = allowance.paidAttemptsPurchased - allowance.paidAttemptsUsed;

    return reply.send({
      success: true,
      data: {
        freeAttemptsUsed: allowance.freeAttemptsUsed,
        freeAttemptsLimit: allowance.freeAttemptsLimit,
        paidAttemptsPurchased: allowance.paidAttemptsPurchased,
        paidAttemptsUsed: allowance.paidAttemptsUsed,
        remainingFreeAttempts: Math.max(remainingFree, 0),
        totalRemainingAttempts: Math.max(remainingFree + paidRemaining, 0),
        canStartFreePractice: remainingFree > 0,
      },
    });
  });
}
