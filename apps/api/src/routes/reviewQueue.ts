import { FastifyInstance } from "fastify";
import { db } from "../services/database";
import { reviewQueue } from "@database/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { assignReviewerRequestSchema } from "@contracts/reports";

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

export async function reviewQueueRoutes(fastify: FastifyInstance) {
  // GET / — paginated review queue scoped to the caller's organizations
  fastify.get("/", async (request, reply) => {
    const user = (request as any).user;
    const {
      page = 1,
      limit = 20,
      status,
      organizationId,
    } = request.query as {
      page?: number;
      limit?: number;
      status?: string;
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
      conditions.push(eq(reviewQueue.organizationId, organizationId));
    } else if (orgIds.length) {
      conditions.push(inArray(reviewQueue.organizationId, orgIds));
    } else {
      return reply.send({
        success: true,
        data: { items: [], total: 0, page, limit, totalPages: 0 },
      });
    }

    if (status) conditions.push(eq(reviewQueue.status, status as any));

    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewQueue)
      .where(where);

    const items = await db
      .select()
      .from(reviewQueue)
      .where(where)
      .orderBy(desc(reviewQueue.priority), desc(reviewQueue.submittedAt))
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

  // GET /:id — fetch a single review queue item
  fastify.get("/:id", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const item = await db.query.reviewQueue.findFirst({
      where: (i, { eq }) => eq(i.id, id),
    });
    if (!item) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Review queue item not found" },
      });
    }

    const orgIds = await getUserOrgIds(user.id);
    if (!orgIds.includes(item.organizationId)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied" },
      });
    }

    return reply.send({ success: true, data: item });
  });

  // POST /:id/assign — assign a reviewer to a queue item
  fastify.post("/:id/assign", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const body = assignReviewerRequestSchema.parse(request.body);

    const item = await db.query.reviewQueue.findFirst({
      where: (i, { eq }) => eq(i.id, id),
    });
    if (!item) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Review queue item not found" },
      });
    }

    const membership = await getMembership(user.id, item.organizationId);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    const reviewerMembership = await getMembership(body.reviewerId, item.organizationId);
    if (!reviewerMembership) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_OPERATION",
          message: "Reviewer is not a member of this organization",
        },
      });
    }

    const now = new Date();
    const [updated] = await db
      .update(reviewQueue)
      .set({
        assignedReviewerId: body.reviewerId,
        status: item.status === "awaiting_evaluation" ? "in_review" : item.status,
        reviewStartedAt: item.reviewStartedAt ?? now,
        updatedAt: now,
      })
      .where(eq(reviewQueue.id, id))
      .returning();

    return reply.send({ success: true, data: updated });
  });
}
