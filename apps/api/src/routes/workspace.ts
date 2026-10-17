import { FastifyInstance, FastifyReply } from "fastify";
import { db } from "../services/database";
import { authorizeSessionAccess, type SessionAccessFailure } from "../services/sessionAccess";
import { workspaceRevisions, sessionFiles } from "@database/schema";
import { eq, and } from "drizzle-orm";
import { saveRevisionRequestSchema } from "@contracts/workspace";
import { z } from "zod";

const upsertFileSchema = z.object({
  path: z.string().min(1).max(500),
  language: z.string().min(1).max(50),
  content: z.string(),
  isReadOnly: z.boolean().optional(),
});

function fail(reply: FastifyReply, access: SessionAccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

export async function workspaceRoutes(fastify: FastifyInstance) {
  // GET /:sessionId/revisions — list workspace revisions for a session
  fastify.get("/:sessionId/revisions", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const revisions = await db.query.workspaceRevisions.findMany({
      where: (r, { eq }) => eq(r.sessionId, sessionId),
      orderBy: (r, { desc }) => [desc(r.revisionNumber)],
    });
    return reply.send({ success: true, data: revisions });
  });

  // POST /:sessionId/revisions — save a new revision
  fastify.post("/:sessionId/revisions", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = saveRevisionRequestSchema.parse(request.body);

    const access = await authorizeSessionAccess(sessionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const latest = await db.query.workspaceRevisions.findFirst({
      where: (r, { eq }) => eq(r.sessionId, sessionId),
      orderBy: (r, { desc }) => [desc(r.revisionNumber)],
    });
    const revisionNumber = (latest?.revisionNumber ?? 0) + 1;

    const [revision] = await db
      .insert(workspaceRevisions)
      .values({
        sessionId,
        revisionNumber,
        files: body.files,
        message: body.message,
        isSnapshot: body.isSnapshot,
      })
      .returning();

    return reply.status(201).send({ success: true, data: revision });
  });

  // GET /:sessionId/files — list live session files
  fastify.get("/:sessionId/files", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const files = await db.query.sessionFiles.findMany({
      where: (f, { eq, and }) => and(eq(f.sessionId, sessionId), eq(f.isDeleted, false)),
      orderBy: (f, { asc }) => [asc(f.path)],
    });
    return reply.send({ success: true, data: files });
  });

  // POST /:sessionId/files — create or update a session file
  fastify.post("/:sessionId/files", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = upsertFileSchema.parse(request.body);

    const access = await authorizeSessionAccess(sessionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const existing = await db.query.sessionFiles.findFirst({
      where: (f, { eq, and }) => and(eq(f.sessionId, sessionId), eq(f.path, body.path)),
    });

    if (existing) {
      const [updated] = await db
        .update(sessionFiles)
        .set({
          language: body.language,
          content: body.content,
          isReadOnly: body.isReadOnly ?? existing.isReadOnly,
          isDeleted: false,
          updatedAt: new Date(),
        })
        .where(eq(sessionFiles.id, existing.id))
        .returning();
      return reply.send({ success: true, data: updated });
    }

    const [file] = await db
      .insert(sessionFiles)
      .values({
        sessionId,
        path: body.path,
        language: body.language,
        content: body.content,
        isReadOnly: body.isReadOnly ?? false,
      })
      .returning();

    return reply.status(201).send({ success: true, data: file });
  });

  // DELETE /:sessionId/files/:path — soft-delete a session file
  fastify.delete("/:sessionId/files/:path", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId, path } = request.params as { sessionId: string; path: string };

    const access = await authorizeSessionAccess(sessionId, user.id, "write");
    if (!access.ok) return fail(reply, access);

    const existing = await db.query.sessionFiles.findFirst({
      where: (f, { eq, and }) => and(eq(f.sessionId, sessionId), eq(f.path, path)),
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "File not found" },
      });
    }

    await db
      .update(sessionFiles)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(sessionFiles.id, existing.id));

    return reply.send({ success: true, data: { message: "File deleted" } });
  });
}
