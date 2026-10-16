import { FastifyInstance, FastifyReply } from "fastify";
import { db } from "../services/database";
import { authorizeVersionAccess, type AccessFailure } from "../services/assessmentAccess";
import {
  rubricVersions,
  assessmentFiles,
  assessmentTestConfigs,
  assessmentVersions,
} from "@database/schema";
import { eq } from "drizzle-orm";
import {
  createRubricRequestSchema,
  createAssessmentFileRequestSchema,
  updateAssessmentTestConfigRequestSchema,
} from "@contracts/assessment";

function fail(reply: FastifyReply, access: AccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

export async function versionResourceRoutes(fastify: FastifyInstance) {
  // GET /:versionId/rubrics — list rubric versions for an assessment version
  fastify.get("/:versionId/rubrics", async (request, reply) => {
    const user = (request as any).user;
    const { versionId } = request.params as { versionId: string };

    const access = await authorizeVersionAccess(versionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const rubrics = await db.query.rubricVersions.findMany({
      where: (r, { eq }) => eq(r.assessmentVersionId, versionId),
      orderBy: (r, { desc }) => [desc(r.version)],
    });
    return reply.send({ success: true, data: rubrics });
  });

  // POST /:versionId/rubrics — create the next rubric version
  fastify.post("/:versionId/rubrics", async (request, reply) => {
    const user = (request as any).user;
    const { versionId } = request.params as { versionId: string };
    const body = createRubricRequestSchema.parse(request.body);

    const access = await authorizeVersionAccess(versionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const latest = await db.query.rubricVersions.findFirst({
      where: (r, { eq }) => eq(r.assessmentVersionId, versionId),
      orderBy: (r, { desc }) => [desc(r.version)],
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    await db
      .update(rubricVersions)
      .set({ isCurrent: false })
      .where(eq(rubricVersions.assessmentVersionId, versionId));

    const [rubric] = await db
      .insert(rubricVersions)
      .values({
        assessmentVersionId: versionId,
        version: nextVersion,
        criteria: body.criteria,
        totalPoints: body.totalPoints,
        isCurrent: true,
      })
      .returning();

    return reply.status(201).send({ success: true, data: rubric });
  });

  // GET /:versionId/files — list starter files for an assessment version
  fastify.get("/:versionId/files", async (request, reply) => {
    const user = (request as any).user;
    const { versionId } = request.params as { versionId: string };

    const access = await authorizeVersionAccess(versionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const files = await db.query.assessmentFiles.findMany({
      where: (f, { eq }) => eq(f.assessmentVersionId, versionId),
      orderBy: (f, { asc }) => [asc(f.order), asc(f.path)],
    });
    return reply.send({ success: true, data: files });
  });

  // POST /:versionId/files — create a starter file
  fastify.post("/:versionId/files", async (request, reply) => {
    const user = (request as any).user;
    const { versionId } = request.params as { versionId: string };
    const body = createAssessmentFileRequestSchema.parse(request.body);

    const access = await authorizeVersionAccess(versionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const existing = await db.query.assessmentFiles.findFirst({
      where: (f, { eq, and }) => and(eq(f.assessmentVersionId, versionId), eq(f.path, body.path)),
    });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: "FILE_EXISTS", message: "File already exists at this path" },
      });
    }

    const [file] = await db
      .insert(assessmentFiles)
      .values({
        assessmentVersionId: versionId,
        path: body.path,
        language: body.language,
        content: body.content,
        isReadOnly: body.isReadOnly,
        isHidden: body.isHidden,
        order: body.order,
      })
      .returning();

    return reply.status(201).send({ success: true, data: file });
  });

  // GET /:versionId/test-config — fetch or initialize the test configuration
  fastify.get("/:versionId/test-config", async (request, reply) => {
    const user = (request as any).user;
    const { versionId } = request.params as { versionId: string };

    const access = await authorizeVersionAccess(versionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const existing = await db.query.assessmentTestConfigs.findFirst({
      where: (c, { eq }) => eq(c.assessmentVersionId, versionId),
    });
    if (existing) return reply.send({ success: true, data: existing });

    const [created] = await db
      .insert(assessmentTestConfigs)
      .values({ assessmentVersionId: versionId })
      .returning();
    return reply.send({ success: true, data: created });
  });

  // PATCH /:versionId/test-config — update the test configuration
  fastify.patch("/:versionId/test-config", async (request, reply) => {
    const user = (request as any).user;
    const { versionId } = request.params as { versionId: string };
    const body = updateAssessmentTestConfigRequestSchema.parse(request.body);

    const access = await authorizeVersionAccess(versionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const existing = await db.query.assessmentTestConfigs.findFirst({
      where: (c, { eq }) => eq(c.assessmentVersionId, versionId),
    });

    if (!existing) {
      const [created] = await db
        .insert(assessmentTestConfigs)
        .values({ ...body, assessmentVersionId: versionId })
        .returning();
      await db
        .update(assessmentVersions)
        .set({ testConfig: body })
        .where(eq(assessmentVersions.id, versionId));
      return reply.send({ success: true, data: created });
    }

    const [updated] = await db
      .update(assessmentTestConfigs)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(assessmentTestConfigs.id, existing.id))
      .returning();

    const { id, assessmentVersionId, createdAt, updatedAt, ...versionTestConfig } = updated;
    await db
      .update(assessmentVersions)
      .set({ testConfig: versionTestConfig })
      .where(eq(assessmentVersions.id, versionId));

    return reply.send({ success: true, data: updated });
  });
}
