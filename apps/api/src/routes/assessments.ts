import { FastifyInstance } from "fastify";
import { db } from "../services/database";
import {
  assessments,
  assessmentVersions,
  assessmentTestConfigs,
  organizationMemberships,
} from "@database/schema";
import { eq, and, desc, sql, like, inArray } from "drizzle-orm";
import {
  createAssessmentRequestSchema,
  updateAssessmentRequestSchema,
} from "@contracts/assessment";

export async function assessmentRoutes(fastify: FastifyInstance) {
  // GET / — list assessments for the user's organizations.
  // When `organizationId` is supplied the list is scoped to that single
  // organization (the caller must be a member). Without it, the list spans
  // every organization the caller belongs to.
  fastify.get("/", async (request, reply) => {
    const user = (request as any).user;
    const {
      page = 1,
      limit = 20,
      status,
      search,
      organizationId,
    } = request.query as {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
      organizationId?: string;
    };

    const memberships = await db.query.organizationMemberships.findMany({
      where: (m, { eq }) => eq(m.userId, user.id),
    });

    let orgIds = memberships.map((m) => m.organizationId);
    if (organizationId) {
      if (!orgIds.includes(organizationId)) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this organization" },
        });
      }
      orgIds = [organizationId];
    }

    if (orgIds.length === 0) {
      return reply.send({
        success: true,
        data: { items: [], total: 0, page, limit, totalPages: 0 },
      });
    }

    const conditions = [inArray(assessments.organizationId, orgIds)];
    if (status) conditions.push(eq(assessments.status, status as any));
    if (search) conditions.push(like(assessments.title, `%${search}%`));
    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(assessments)
      .where(where);

    const items = await db
      .select()
      .from(assessments)
      .where(where)
      .orderBy(desc(assessments.updatedAt))
      .limit(limit)
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

  // POST / — create assessment scoped to an explicitly selected organization.
  // The organization is never inferred: the caller must send organizationId and
  // hold an owner/admin role in that specific organization.
  fastify.post("/", async (request, reply) => {
    const user = (request as any).user;
    const body = createAssessmentRequestSchema.parse(request.body);

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) =>
        and(
          eq(m.userId, user.id),
          eq(m.organizationId, body.organizationId),
          inArray(m.role, ["owner", "admin"]),
        ),
    });
    if (!membership) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions for this organization" },
      });
    }

    const orgId = body.organizationId;

    const [newAssessment] = await db
      .insert(assessments)
      .values({
        organizationId: orgId,
        title: body.title,
        description: body.description,
        role: body.role,
        skills: body.skills,
        durationMinutes: body.durationMinutes,
        difficulty: body.difficulty,
        isPublic: body.isPublic ?? false,
        createdBy: user.id,
      })
      .returning();

    const [version] = await db
      .insert(assessmentVersions)
      .values({
        assessmentId: newAssessment.id,
        version: 1,
        title: body.title,
        description: body.description,
        role: body.role,
        skills: body.skills,
        durationMinutes: body.durationMinutes,
        difficulty: body.difficulty,
        starterFiles: [],
        testConfig: {},
        isCurrent: true,
      })
      .returning();

    await db.insert(assessmentTestConfigs).values({ assessmentVersionId: version.id });

    return reply.status(201).send({ success: true, data: newAssessment });
  });

  // GET /:id
  fastify.get("/:id", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const assessment = await db.query.assessments.findFirst({
      where: (a, { eq }) => eq(a.id, id),
    });
    if (!assessment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assessment not found" },
      });
    }

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) =>
        and(eq(m.organizationId, assessment.organizationId), eq(m.userId, user.id)),
    });
    if (!membership && !assessment.isPublic) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied" },
      });
    }

    return reply.send({ success: true, data: assessment });
  });

  // PATCH /:id
  fastify.patch("/:id", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const updates = updateAssessmentRequestSchema.parse(request.body);

    const assessment = await db.query.assessments.findFirst({
      where: (a, { eq }) => eq(a.id, id),
    });
    if (!assessment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assessment not found" },
      });
    }

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) =>
        and(eq(m.organizationId, assessment.organizationId), eq(m.userId, user.id)),
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    const [updated] = await db
      .update(assessments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(assessments.id, id))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // DELETE /:id
  fastify.delete("/:id", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const assessment = await db.query.assessments.findFirst({
      where: (a, { eq }) => eq(a.id, id),
    });
    if (!assessment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assessment not found" },
      });
    }

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) =>
        and(eq(m.organizationId, assessment.organizationId), eq(m.userId, user.id)),
    });
    if (!membership || membership.role !== "owner") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Only owner can delete" },
      });
    }

    await db.delete(assessments).where(eq(assessments.id, id));
    return reply.send({
      success: true,
      data: { message: "Assessment deleted" },
    });
  });

  // POST /:id/publish
  fastify.post("/:id/publish", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const assessment = await db.query.assessments.findFirst({
      where: (a, { eq }) => eq(a.id, id),
    });
    if (!assessment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assessment not found" },
      });
    }

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) =>
        and(eq(m.organizationId, assessment.organizationId), eq(m.userId, user.id)),
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }
    if (assessment.status === "published") {
      return reply.status(400).send({
        success: false,
        error: { code: "ALREADY_PUBLISHED", message: "Already published" },
      });
    }

    const now = new Date();
    const [updated] = await db
      .update(assessments)
      .set({
        status: "published",
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(assessments.id, id))
      .returning();

    // Also update the current version's publishedAt
    await db
      .update(assessmentVersions)
      .set({ publishedAt: now })
      .where(and(eq(assessmentVersions.assessmentId, id), eq(assessmentVersions.isCurrent, true)));

    return reply.send({ success: true, data: updated });
  });

  // GET /:id/versions
  fastify.get("/:id/versions", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const assessment = await db.query.assessments.findFirst({
      where: (a, { eq }) => eq(a.id, id),
    });
    if (!assessment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assessment not found" },
      });
    }

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) =>
        and(eq(m.organizationId, assessment.organizationId), eq(m.userId, user.id)),
    });
    if (!membership && !assessment.isPublic) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied" },
      });
    }

    const versions = await db.query.assessmentVersions.findMany({
      where: (v, { eq }) => eq(v.assessmentId, id),
      orderBy: (v, { desc }) => [desc(v.version)],
    });
    return reply.send({ success: true, data: versions });
  });

  // POST /:id/versions — create new version
  fastify.post("/:id/versions", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const assessment = await db.query.assessments.findFirst({
      where: (a, { eq }) => eq(a.id, id),
    });
    if (!assessment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assessment not found" },
      });
    }

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) =>
        and(eq(m.organizationId, assessment.organizationId), eq(m.userId, user.id)),
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    const latest = await db.query.assessmentVersions.findFirst({
      where: (v, { eq }) => eq(v.assessmentId, id),
      orderBy: (v, { desc }) => [desc(v.version)],
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    await db
      .update(assessmentVersions)
      .set({ isCurrent: false })
      .where(eq(assessmentVersions.assessmentId, id));

    const [newVersion] = await db
      .insert(assessmentVersions)
      .values({
        assessmentId: id,
        version: nextVersion,
        title: assessment.title,
        description: assessment.description,
        role: assessment.role,
        skills: assessment.skills,
        durationMinutes: assessment.durationMinutes,
        difficulty: assessment.difficulty,
        starterFiles: [],
        testConfig: {},
        isCurrent: true,
      })
      .returning();

    return reply.status(201).send({ success: true, data: newVersion });
  });

  // GET /:id/current-version
  fastify.get("/:id/current-version", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const assessment = await db.query.assessments.findFirst({
      where: (a, { eq }) => eq(a.id, id),
    });
    if (!assessment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assessment not found" },
      });
    }

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) =>
        and(eq(m.organizationId, assessment.organizationId), eq(m.userId, user.id)),
    });
    if (!membership && !assessment.isPublic) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied" },
      });
    }

    const version = await db.query.assessmentVersions.findFirst({
      where: (v, { eq, and }) => and(eq(v.assessmentId, id), eq(v.isCurrent, true)),
    });
    if (!version) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "No current version" },
      });
    }
    return reply.send({ success: true, data: version });
  });
}
