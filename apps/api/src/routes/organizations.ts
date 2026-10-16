import { FastifyInstance } from "fastify";
import { db } from "../services/database";
import { organizations, organizationMemberships } from "@database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { createOrganizationRequestSchema, updateOrganizationRequestSchema } from "@contracts/auth";

export async function organizationRoutes(fastify: FastifyInstance) {
  // POST / — create organization
  // The organization and its owner membership are created in a single
  // transaction so a partially-created organization (without an owner) can
  // never be persisted. The slug uniqueness is also enforced by the database
  // constraint, which we translate into a 409 to cover concurrent requests.
  fastify.post("/", async (request, reply) => {
    const user = (request as any).user;
    const body = createOrganizationRequestSchema.parse(request.body);
    const { name, slug, description, billingEmail } = body;

    const existing = await db.query.organizations.findFirst({
      where: (o, { eq }) => eq(o.slug, slug),
    });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: {
          code: "SLUG_EXISTS",
          message: "Organization slug already taken",
        },
      });
    }

    try {
      const newOrg = await db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({
            name,
            slug,
            description,
            billingEmail,
          })
          .returning();

        await tx.insert(organizationMemberships).values({
          organizationId: org.id,
          userId: user.id,
          role: "owner",
          invitedBy: user.id,
          acceptedAt: new Date(),
        });

        return org;
      });

      return reply.status(201).send({ success: true, data: newOrg });
    } catch (err) {
      // Postgres unique-violation on the slug constraint (concurrent create).
      if ((err as { code?: string })?.code === "23505") {
        return reply.status(409).send({
          success: false,
          error: {
            code: "SLUG_EXISTS",
            message: "Organization slug already taken",
          },
        });
      }
      throw err;
    }
  });

  // GET / — list user's organizations with the caller's role (org context)
  fastify.get("/", async (request, reply) => {
    const user = (request as any).user;

    const memberships = await db.query.organizationMemberships.findMany({
      where: (m, { eq }) => eq(m.userId, user.id),
    });

    if (memberships.length === 0) {
      return reply.send({ success: true, data: [] });
    }

    const orgIds = memberships.map((m) => m.organizationId);
    const orgsData = await db.query.organizations.findMany({
      where: (o, { inArray }) => inArray(o.id, orgIds),
    });

    const roleByOrgId = Object.fromEntries(memberships.map((m) => [m.organizationId, m.role]));
    const result = orgsData.map((org) => ({
      ...org,
      userRole: roleByOrgId[org.id],
    }));

    return reply.send({ success: true, data: result });
  });

  // GET /:id
  fastify.get("/:id", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) => and(eq(m.organizationId, id), eq(m.userId, user.id)),
    });
    if (!membership) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Organization not found" },
      });
    }

    const org = await db.query.organizations.findFirst({
      where: (o, { eq }) => eq(o.id, id),
    });
    if (!org) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Organization not found" },
      });
    }

    return reply.send({
      success: true,
      data: { ...org, userRole: membership.role },
    });
  });

  // PATCH /:id
  fastify.patch("/:id", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const updates = updateOrganizationRequestSchema.parse(request.body);

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) => and(eq(m.organizationId, id), eq(m.userId, user.id)),
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    // Serialize settings to string for the text column
    const { settings, ...rest } = updates;
    const setValues: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date(),
    };
    if (settings !== undefined) setValues.settings = JSON.stringify(settings);

    const [updated] = await db
      .update(organizations)
      .set(setValues)
      .where(eq(organizations.id, id))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // DELETE /:id
  fastify.delete("/:id", async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq, and }) => and(eq(m.organizationId, id), eq(m.userId, user.id)),
    });
    if (!membership || membership.role !== "owner") {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only owner can delete organization",
        },
      });
    }

    await db.delete(organizations).where(eq(organizations.id, id));
    return reply.send({
      success: true,
      data: { message: "Organization deleted" },
    });
  });
}
