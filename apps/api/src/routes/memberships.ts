import { FastifyInstance } from "fastify";
import { db } from "../services/database";
import { organizationMemberships } from "@database/schema";
import { eq, and } from "drizzle-orm";
import { inviteMemberRequestSchema, updateMemberRoleRequestSchema } from "@contracts/auth";

export async function membershipRoutes(fastify: FastifyInstance) {
  // POST /:orgId/members — invite member
  fastify.post("/:orgId/members", async (request, reply) => {
    const user = (request as any).user;
    const { orgId } = request.params as { orgId: string };
    const body = inviteMemberRequestSchema.parse(request.body);
    const { email, role } = body;

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) => and(eq(m.organizationId, orgId), eq(m.userId, user.id)),
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    const invitedUser = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });
    if (!invitedUser) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User with this email not found",
        },
      });
    }

    const existing = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) => and(eq(m.organizationId, orgId), eq(m.userId, invitedUser.id)),
    });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: {
          code: "ALREADY_MEMBER",
          message: "User is already a member",
        },
      });
    }

    const [newMembership] = await db
      .insert(organizationMemberships)
      .values({
        organizationId: orgId,
        userId: invitedUser.id,
        role,
        invitedBy: user.id,
      })
      .returning();

    return reply.status(201).send({ success: true, data: newMembership });
  });

  // GET /:orgId/members
  fastify.get("/:orgId/members", async (request, reply) => {
    const user = (request as any).user;
    const { orgId } = request.params as { orgId: string };

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) => and(eq(m.organizationId, orgId), eq(m.userId, user.id)),
    });
    if (!membership) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Not a member of this organization",
        },
      });
    }

    const members = await db.query.organizationMemberships.findMany({
      where: (m, { eq }) => eq(m.organizationId, orgId),
      with: {
        user: {
          columns: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    });
    return reply.send({ success: true, data: members });
  });

  // PATCH /:orgId/members/:userId
  fastify.patch("/:orgId/members/:userId", async (request, reply) => {
    const user = (request as any).user;
    const { orgId, userId } = request.params as { orgId: string; userId: string };
    const body = updateMemberRoleRequestSchema.parse(request.body);
    const { role } = body;

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) => and(eq(m.organizationId, orgId), eq(m.userId, user.id)),
    });
    if (!membership || membership.role !== "owner") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Only owner can change roles" },
      });
    }
    if (userId === user.id) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_OPERATION",
          message: "Cannot change your own role",
        },
      });
    }

    const target = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) => and(eq(m.organizationId, orgId), eq(m.userId, userId)),
    });
    if (!target) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Member not found" },
      });
    }
    if (target.role === "owner") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_OPERATION",
          message: "Cannot change owner's role",
        },
      });
    }

    const [updated] = await db
      .update(organizationMemberships)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(organizationMemberships.organizationId, orgId),
          eq(organizationMemberships.userId, userId),
        ),
      )
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // DELETE /:orgId/members/:userId
  fastify.delete("/:orgId/members/:userId", async (request, reply) => {
    const user = (request as any).user;
    const { orgId, userId } = request.params as { orgId: string; userId: string };

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) => and(eq(m.organizationId, orgId), eq(m.userId, user.id)),
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }
    if (userId === user.id) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_OPERATION",
          message: "Cannot remove yourself",
        },
      });
    }

    const target = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) => and(eq(m.organizationId, orgId), eq(m.userId, userId)),
    });
    if (!target) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Member not found" },
      });
    }
    if (target.role === "owner") {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_OPERATION", message: "Cannot remove owner" },
      });
    }

    await db
      .delete(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, orgId),
          eq(organizationMemberships.userId, userId),
        ),
      );

    return reply.send({ success: true, data: { message: "Member removed" } });
  });
}
