import { FastifyInstance } from "fastify";
import { db } from "../services/database";
import {
  candidateAssignments,
  assessments,
  assessmentVersions,
  users,
  organizationMemberships,
} from "@database/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  createAssignmentRequestSchema,
  updateAssignmentRequestSchema,
  withdrawAssignmentRequestSchema,
} from "@contracts/assignments";

export async function assignmentRoutes(fastify: FastifyInstance) {
  // GET / — list assignments (recruiter view)
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

    const memberships = await db.query.organizationMemberships.findMany({
      where: (m, { eq }) => eq(m.userId, user.id),
    });
    const allOrgIds = memberships.map((m) => m.organizationId);
    const orgIds = organizationId
      ? [organizationId].filter((id) => allOrgIds.includes(id))
      : allOrgIds;

    if (orgIds.length === 0) {
      return reply.send({
        success: true,
        data: { items: [], total: 0, page, limit, totalPages: 0 },
      });
    }

    const conditions = [inArray(candidateAssignments.organizationId, orgIds)];
    if (status) conditions.push(eq(candidateAssignments.status, status as any));
    const where = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(candidateAssignments)
      .where(where);

    const items = await db
      .select()
      .from(candidateAssignments)
      .where(where)
      .orderBy(desc(candidateAssignments.createdAt))
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

  // POST / — create assignment
  fastify.post("/", async (request, reply) => {
    const user = (request as any).user;
    const body = createAssignmentRequestSchema.parse(request.body);
    const { assessmentId, assessmentVersionId, candidateId, deadline, expiresAt, metadata } = body;

    const assessment = await db.query.assessments.findFirst({
      where: (a, { eq }) => eq(a.id, assessmentId),
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

    const candidate = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, candidateId),
    });
    if (!candidate) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "CANDIDATE_NOT_FOUND",
          message: "Candidate not found",
        },
      });
    }

    const existing = await db.query.candidateAssignments.findFirst({
      where: (a, { eq, and }) =>
        and(eq(a.assessmentId, assessmentId), eq(a.candidateId, candidateId)),
    });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: {
          code: "ALREADY_ASSIGNED",
          message: "Candidate already assigned",
        },
      });
    }

    const version = assessmentVersionId
      ? await db.query.assessmentVersions.findFirst({
          where: (v, { eq }) => eq(v.id, assessmentVersionId),
        })
      : await db.query.assessmentVersions.findFirst({
          where: (v, { eq, and }) => and(eq(v.assessmentId, assessmentId), eq(v.isCurrent, true)),
        });

    if (!version) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "NO_VERSION",
          message: "No assessment version available",
        },
      });
    }

    const [assignment] = await db
      .insert(candidateAssignments)
      .values({
        organizationId: assessment.organizationId,
        assessmentId,
        assessmentVersionId: version.id,
        candidateId,
        assignedBy: user.id,
        status: "invited",
        deadline: deadline ? new Date(deadline) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        metadata: metadata ?? {},
      })
      .returning();

    return reply.status(201).send({ success: true, data: assignment });
  });

  // GET /candidate/me — candidate's own assignments
  fastify.get("/candidate/me", async (request, reply) => {
    const user = (request as any).user;
    const assignments = await db.query.candidateAssignments.findMany({
      where: (a, { eq }) => eq(a.candidateId, user.id),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });

    const enriched = await Promise.all(
      assignments.map(async (assignment) => {
        const version = await db.query.assessmentVersions.findFirst({
          where: (v, { eq }) => eq(v.id, assignment.assessmentVersionId),
        });
        const assessment = await db.query.assessments.findFirst({
          where: (a, { eq }) => eq(a.id, assignment.assessmentId),
        });
        return {
          ...assignment,
          taskDetails: {
            title: version?.title ?? assessment?.title,
            description: version?.description ?? assessment?.description,
            role: version?.role ?? assessment?.role,
            skills: version?.skills ?? assessment?.skills,
            durationMinutes: version?.durationMinutes ?? assessment?.durationMinutes,
            difficulty: version?.difficulty ?? assessment?.difficulty,
            instructions: version?.instructions,
            aiPolicy: version?.aiPolicy,
          },
        };
      }),
    );

    return reply.send({ success: true, data: enriched });
  });

  // GET /:id
  fastify.get("/:id", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const assignment = await db.query.candidateAssignments.findFirst({
      where: (a, { eq }) => eq(a.id, id),
    });
    if (!assignment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assignment not found" },
      });
    }

    const isCandidate = assignment.candidateId === user.id;
    const isAssigner = assignment.assignedBy === user.id;
    if (!isCandidate && !isAssigner) {
      const membership = await db.query.organizationMemberships.findFirst({
        where: (m, { eq, and }) =>
          and(eq(m.organizationId, assignment.organizationId), eq(m.userId, user.id)),
      });
      if (!membership) {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Access denied" },
        });
      }
    }

    const version = await db.query.assessmentVersions.findFirst({
      where: (v, { eq }) => eq(v.id, assignment.assessmentVersionId),
    });
    const assessment = await db.query.assessments.findFirst({
      where: (a, { eq }) => eq(a.id, assignment.assessmentId),
    });

    const responseData = {
      ...assignment,
      taskDetails: {
        title: version?.title ?? assessment?.title,
        description: version?.description ?? assessment?.description,
        role: version?.role ?? assessment?.role,
        skills: version?.skills ?? assessment?.skills,
        durationMinutes: version?.durationMinutes ?? assessment?.durationMinutes,
        difficulty: version?.difficulty ?? assessment?.difficulty,
        instructions: version?.instructions,
        aiPolicy: version?.aiPolicy,
      },
    };

    return reply.send({ success: true, data: responseData });
  });

  // PATCH /:id
  fastify.patch("/:id", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const body = updateAssignmentRequestSchema.parse(request.body);

    const assignment = await db.query.candidateAssignments.findFirst({
      where: (a, { eq }) => eq(a.id, id),
    });
    if (!assignment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assignment not found" },
      });
    }

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) =>
        and(eq(m.organizationId, assignment.organizationId), eq(m.userId, user.id)),
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.deadline !== undefined)
      updates.deadline = body.deadline ? new Date(body.deadline) : null;
    if (body.expiresAt !== undefined)
      updates.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    const [updated] = await db
      .update(candidateAssignments)
      .set(updates)
      .where(eq(candidateAssignments.id, id))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // POST /:id/withdraw
  fastify.post("/:id/withdraw", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const body = withdrawAssignmentRequestSchema.parse(request.body);

    const assignment = await db.query.candidateAssignments.findFirst({
      where: (a, { eq }) => eq(a.id, id),
    });
    if (!assignment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assignment not found" },
      });
    }

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) =>
        and(eq(m.organizationId, assignment.organizationId), eq(m.userId, user.id)),
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    if (assignment.status === "submitted" || assignment.status === "evaluated") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_STATE",
          message: "Cannot withdraw submitted assignment",
        },
      });
    }

    const [updated] = await db
      .update(candidateAssignments)
      .set({
        status: "withdrawn",
        withdrawnAt: new Date(),
        withdrawnReason: body.reason,
        updatedAt: new Date(),
      })
      .where(eq(candidateAssignments.id, id))
      .returning();

    return reply.send({ success: true, data: updated });
  });
}
