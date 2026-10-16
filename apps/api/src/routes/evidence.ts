import { FastifyInstance, FastifyReply } from "fastify";
import { db } from "../services/database";
import { authorizeSessionAccess, type SessionAccessFailure } from "../services/sessionAccess";
import { evidenceRecords, activityEvents } from "@database/schema";
import { eq, desc, sql } from "drizzle-orm";

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
