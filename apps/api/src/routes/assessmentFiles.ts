import { FastifyInstance, FastifyReply } from "fastify";
import { db } from "../services/database";
import { authorizeVersionAccess, type AccessFailure } from "../services/assessmentAccess";
import { assessmentFiles } from "@database/schema";
import { eq, and } from "drizzle-orm";
import { updateAssessmentFileRequestSchema } from "@contracts/assessment";

function fail(reply: FastifyReply, access: AccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

export async function assessmentFileRoutes(fastify: FastifyInstance) {
  // GET /:fileId — fetch a starter file
  fastify.get("/:fileId", async (request, reply) => {
    const user = (request as any).user;
    const { fileId } = request.params as { fileId: string };

    const file = await db.query.assessmentFiles.findFirst({
      where: (f, { eq }) => eq(f.id, fileId),
    });
    if (!file) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "File not found" },
      });
    }

    const access = await authorizeVersionAccess(file.assessmentVersionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    return reply.send({ success: true, data: file });
  });

  // PATCH /:fileId — update a starter file
  fastify.patch("/:fileId", async (request, reply) => {
    const user = (request as any).user;
    const { fileId } = request.params as { fileId: string };
    const body = updateAssessmentFileRequestSchema.parse(request.body);

    const file = await db.query.assessmentFiles.findFirst({
      where: (f, { eq }) => eq(f.id, fileId),
    });
    if (!file) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "File not found" },
      });
    }

    const access = await authorizeVersionAccess(file.assessmentVersionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    if (body.path !== undefined && body.path !== file.path) {
      const existing = await db.query.assessmentFiles.findFirst({
        where: (f, { eq, and }) =>
          and(eq(f.assessmentVersionId, file.assessmentVersionId), eq(f.path, body.path!)),
      });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: "FILE_EXISTS", message: "File already exists at this path" },
        });
      }
    }

    const [updated] = await db
      .update(assessmentFiles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(assessmentFiles.id, fileId))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // DELETE /:fileId — remove a starter file
  fastify.delete("/:fileId", async (request, reply) => {
    const user = (request as any).user;
    const { fileId } = request.params as { fileId: string };

    const file = await db.query.assessmentFiles.findFirst({
      where: (f, { eq }) => eq(f.id, fileId),
    });
    if (!file) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "File not found" },
      });
    }

    const access = await authorizeVersionAccess(file.assessmentVersionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    await db.delete(assessmentFiles).where(eq(assessmentFiles.id, fileId));
    return reply.send({ success: true, data: { message: "File deleted" } });
  });
}
