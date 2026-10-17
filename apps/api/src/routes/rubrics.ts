import { FastifyInstance, FastifyReply } from "fastify";
import { db } from "../services/database";
import { authorizeVersionAccess, type AccessFailure } from "../services/assessmentAccess";
import { rubricVersions } from "@database/schema";
import { eq } from "drizzle-orm";
import { updateRubricRequestSchema } from "@contracts/assessment";

function fail(reply: FastifyReply, access: AccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

export async function rubricRoutes(fastify: FastifyInstance) {
  // GET /:rubricId — fetch a rubric version
  fastify.get("/:rubricId", async (request, reply) => {
    const user = (request as any).user;
    const { rubricId } = request.params as { rubricId: string };

    const rubric = await db.query.rubricVersions.findFirst({
      where: (r, { eq }) => eq(r.id, rubricId),
    });
    if (!rubric) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Rubric not found" },
      });
    }

    const access = await authorizeVersionAccess(rubric.assessmentVersionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    return reply.send({ success: true, data: rubric });
  });

  // PATCH /:rubricId — update rubric criteria and total points
  fastify.patch("/:rubricId", async (request, reply) => {
    const user = (request as any).user;
    const { rubricId } = request.params as { rubricId: string };
    const body = updateRubricRequestSchema.parse(request.body);

    const rubric = await db.query.rubricVersions.findFirst({
      where: (r, { eq }) => eq(r.id, rubricId),
    });
    if (!rubric) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Rubric not found" },
      });
    }

    const access = await authorizeVersionAccess(rubric.assessmentVersionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const updates: Record<string, unknown> = {};
    if (body.criteria !== undefined) updates.criteria = body.criteria;
    if (body.totalPoints !== undefined) updates.totalPoints = body.totalPoints;

    const [updated] = await db
      .update(rubricVersions)
      .set(updates)
      .where(eq(rubricVersions.id, rubricId))
      .returning();

    return reply.send({ success: true, data: updated });
  });
}
