import { FastifyInstance } from "fastify";
import { db } from "../services/database";
import {
  assessmentSessions,
  candidateAssignments,
  assessmentVersions,
  assessmentFiles,
  sessionFiles,
} from "@database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { startSessionRequestSchema } from "@contracts/assignments";

const heartbeatSchema = z.object({
  currentFile: z.string().max(500).optional(),
  timeRemainingSeconds: z.number().int().nonnegative().optional(),
});

export async function sessionRoutes(fastify: FastifyInstance) {
  // POST /start
  fastify.post("/start", async (request, reply) => {
    const user = (request as any).user;
    const body = startSessionRequestSchema.parse(request.body);
    const { assignmentId } = body;

    const assignment = await db.query.candidateAssignments.findFirst({
      where: (a, { eq, and }) => and(eq(a.id, assignmentId), eq(a.candidateId, user.id)),
    });
    if (!assignment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assignment not found" },
      });
    }
    if (assignment.status !== "invited" && assignment.status !== "in_progress") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_STATE",
          message: "Assignment cannot be started",
        },
      });
    }

    const existingSession = await db.query.assessmentSessions.findFirst({
      where: (s, { eq }) => eq(s.assignmentId, assignmentId),
    });
    if (existingSession) {
      if (existingSession.status === "submitted") {
        return reply.status(400).send({
          success: false,
          error: {
            code: "ALREADY_SUBMITTED",
            message: "Session already submitted",
          },
        });
      }
      let activeSession = existingSession;
      if (
        existingSession.status === "in_progress" &&
        existingSession.expiresAt &&
        new Date() > new Date(existingSession.expiresAt)
      ) {
        const [expired] = await db
          .update(assessmentSessions)
          .set({ status: "expired", timeRemainingSeconds: 0, updatedAt: new Date() })
          .where(eq(assessmentSessions.id, existingSession.id))
          .returning();
        activeSession = expired;
      }

      const [existingAssignment, existingVersion] = await Promise.all([
        db.query.candidateAssignments.findFirst({
          where: (a, { eq }) => eq(a.id, activeSession.assignmentId),
        }),
        db.query.assessmentVersions.findFirst({
          where: (v, { eq }) => eq(v.id, activeSession.assessmentVersionId),
        }),
      ]);
      const existingAssessment = existingAssignment
        ? await db.query.assessments.findFirst({
            where: (a, { eq }) => eq(a.id, existingAssignment.assessmentId),
          })
        : null;

      const taskDetails = {
        title: existingVersion?.title ?? existingAssessment?.title,
        description: existingVersion?.description ?? existingAssessment?.description,
        role: existingVersion?.role ?? existingAssessment?.role,
        skills: existingVersion?.skills ?? existingAssessment?.skills,
        durationMinutes: existingVersion?.durationMinutes ?? existingAssessment?.durationMinutes,
        difficulty: existingVersion?.difficulty ?? existingAssessment?.difficulty,
        instructions: existingVersion?.instructions,
        aiPolicy: existingVersion?.aiPolicy,
      };

      const isReadOnly = activeSession.status === "submitted" || activeSession.status === "expired";
      return reply.send({ success: true, data: { ...activeSession, taskDetails, isReadOnly } });
    }

    const version = await db.query.assessmentVersions.findFirst({
      where: (v, { eq }) => eq(v.id, assignment.assessmentVersionId),
    });

    const now = new Date();
    const durationMinutes = version?.durationMinutes ?? 60;
    const expiresAt = new Date(now.getTime() + durationMinutes * 60000);

    const [session] = await db
      .insert(assessmentSessions)
      .values({
        assignmentId,
        candidateId: user.id,
        assessmentVersionId: assignment.assessmentVersionId,
        status: "in_progress",
        startedAt: now,
        expiresAt,
        timeRemainingSeconds: durationMinutes * 60,
        totalPausedSeconds: 0,
        metadata: {},
      })
      .returning();

    // Seed starter files into sessionFiles if available
    const filesToSeed: Array<{
      path: string;
      language: string;
      content: string;
      isReadOnly?: boolean;
    }> = [];

    const dbFiles = await db.query.assessmentFiles.findMany({
      where: (f, { eq }) => eq(f.assessmentVersionId, assignment.assessmentVersionId),
      orderBy: (f, { asc }) => [asc(f.order), asc(f.path)],
    });

    if (dbFiles.length > 0) {
      for (const f of dbFiles) {
        filesToSeed.push({
          path: f.path,
          language: f.language,
          content: f.content,
          isReadOnly: f.isReadOnly,
        });
      }
    } else if (Array.isArray(version?.starterFiles) && version.starterFiles.length > 0) {
      for (const f of version.starterFiles as any[]) {
        if (f && typeof f.path === "string") {
          filesToSeed.push({
            path: f.path,
            language: f.language ?? "text",
            content: f.content ?? "",
            isReadOnly: f.isReadOnly ?? false,
          });
        }
      }
    }

    for (const file of filesToSeed) {
      await db.insert(sessionFiles).values({
        sessionId: session.id,
        path: file.path,
        language: file.language,
        content: file.content,
        isReadOnly: file.isReadOnly ?? false,
      });
    }

    await db
      .update(candidateAssignments)
      .set({ status: "in_progress", startedAt: now, updatedAt: now })
      .where(eq(candidateAssignments.id, assignmentId));

    const [assignmentRecord, versionRecord] = await Promise.all([
      db.query.candidateAssignments.findFirst({
        where: (a, { eq }) => eq(a.id, session.assignmentId),
      }),
      db.query.assessmentVersions.findFirst({
        where: (v, { eq }) => eq(v.id, session.assessmentVersionId),
      }),
    ]);
    const assessmentRecord = assignmentRecord
      ? await db.query.assessments.findFirst({
          where: (a, { eq }) => eq(a.id, assignmentRecord.assessmentId),
        })
      : null;

    const taskDetails = {
      title: versionRecord?.title ?? assessmentRecord?.title,
      description: versionRecord?.description ?? assessmentRecord?.description,
      role: versionRecord?.role ?? assessmentRecord?.role,
      skills: versionRecord?.skills ?? assessmentRecord?.skills,
      durationMinutes: versionRecord?.durationMinutes ?? assessmentRecord?.durationMinutes,
      difficulty: versionRecord?.difficulty ?? assessmentRecord?.difficulty,
      instructions: versionRecord?.instructions,
      aiPolicy: versionRecord?.aiPolicy,
    };

    return reply
      .status(201)
      .send({ success: true, data: { ...session, taskDetails, isReadOnly: false } });
  });

  // GET /by-assignment/:assignmentId — get active/latest session for an assignment
  fastify.get("/by-assignment/:assignmentId", async (request, reply) => {
    const user = (request as any).user;
    const { assignmentId } = request.params as { assignmentId: string };

    const assignment = await db.query.candidateAssignments.findFirst({
      where: (a, { eq, and }) => and(eq(a.id, assignmentId), eq(a.candidateId, user.id)),
    });
    if (!assignment) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Assignment not found" },
      });
    }

    const session = await db.query.assessmentSessions.findFirst({
      where: (s, { eq }) => eq(s.assignmentId, assignmentId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "No session found for this assignment" },
      });
    }

    let activeSession = session;
    if (
      session.status === "in_progress" &&
      session.expiresAt &&
      new Date() > new Date(session.expiresAt)
    ) {
      const [expired] = await db
        .update(assessmentSessions)
        .set({ status: "expired", timeRemainingSeconds: 0, updatedAt: new Date() })
        .where(eq(assessmentSessions.id, session.id))
        .returning();
      activeSession = expired;
    }

    const [assignmentRecord, versionRecord] = await Promise.all([
      db.query.candidateAssignments.findFirst({
        where: (a, { eq }) => eq(a.id, activeSession.assignmentId),
      }),
      db.query.assessmentVersions.findFirst({
        where: (v, { eq }) => eq(v.id, activeSession.assessmentVersionId),
      }),
    ]);
    const assessmentRecord = assignmentRecord
      ? await db.query.assessments.findFirst({
          where: (a, { eq }) => eq(a.id, assignmentRecord.assessmentId),
        })
      : null;

    const taskDetails = {
      title: versionRecord?.title ?? assessmentRecord?.title,
      description: versionRecord?.description ?? assessmentRecord?.description,
      role: versionRecord?.role ?? assessmentRecord?.role,
      skills: versionRecord?.skills ?? assessmentRecord?.skills,
      durationMinutes: versionRecord?.durationMinutes ?? assessmentRecord?.durationMinutes,
      difficulty: versionRecord?.difficulty ?? assessmentRecord?.difficulty,
      instructions: versionRecord?.instructions,
      aiPolicy: versionRecord?.aiPolicy,
    };

    const isReadOnly = activeSession.status === "submitted" || activeSession.status === "expired";
    return reply.send({ success: true, data: { ...activeSession, taskDetails, isReadOnly } });
  });

  // GET /:sessionId
  fastify.get("/:sessionId", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const session = await db.query.assessmentSessions.findFirst({
      where: (s, { eq, and }) => and(eq(s.id, sessionId), eq(s.candidateId, user.id)),
    });
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Session not found" },
      });
    }

    let activeSession = session;
    // Check expiry
    if (session.status === "in_progress" && session.expiresAt && new Date() > new Date(session.expiresAt)) {
      const [expired] = await db
        .update(assessmentSessions)
        .set({ status: "expired", timeRemainingSeconds: 0, updatedAt: new Date() })
        .where(eq(assessmentSessions.id, sessionId))
        .returning();
      activeSession = expired;
    }

    const [assignmentRecord, versionRecord] = await Promise.all([
      db.query.candidateAssignments.findFirst({
        where: (a, { eq }) => eq(a.id, activeSession.assignmentId),
      }),
      db.query.assessmentVersions.findFirst({
        where: (v, { eq }) => eq(v.id, activeSession.assessmentVersionId),
      }),
    ]);
    const assessmentRecord = assignmentRecord
      ? await db.query.assessments.findFirst({
          where: (a, { eq }) => eq(a.id, assignmentRecord.assessmentId),
        })
      : null;

    const taskDetails = {
      title: versionRecord?.title ?? assessmentRecord?.title,
      description: versionRecord?.description ?? assessmentRecord?.description,
      role: versionRecord?.role ?? assessmentRecord?.role,
      skills: versionRecord?.skills ?? assessmentRecord?.skills,
      durationMinutes: versionRecord?.durationMinutes ?? assessmentRecord?.durationMinutes,
      difficulty: versionRecord?.difficulty ?? assessmentRecord?.difficulty,
      instructions: versionRecord?.instructions,
      aiPolicy: versionRecord?.aiPolicy,
    };

    const isReadOnly = activeSession.status === "submitted" || activeSession.status === "expired";
    return reply.send({ success: true, data: { ...activeSession, taskDetails, isReadOnly } });
  });

  // POST /:sessionId/submit
  fastify.post("/:sessionId/submit", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const session = await db.query.assessmentSessions.findFirst({
      where: (s, { eq, and }) => and(eq(s.id, sessionId), eq(s.candidateId, user.id)),
    });
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Session not found" },
      });
    }
    if (session.status === "submitted") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "ALREADY_SUBMITTED",
          message: "Session already submitted",
        },
      });
    }
    if (session.status === "expired") {
      return reply.status(400).send({
        success: false,
        error: { code: "SESSION_EXPIRED", message: "Session has expired" },
      });
    }

    const now = new Date();
    const [updated] = await db
      .update(assessmentSessions)
      .set({
        status: "submitted",
        submittedAt: now,
        timeRemainingSeconds: 0,
        updatedAt: now,
      })
      .where(eq(assessmentSessions.id, sessionId))
      .returning();

    await db
      .update(candidateAssignments)
      .set({ status: "submitted", submittedAt: now, updatedAt: now })
      .where(eq(candidateAssignments.id, session.assignmentId));

    return reply.send({ success: true, data: updated });
  });

  // POST /:sessionId/pause
  fastify.post("/:sessionId/pause", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const session = await db.query.assessmentSessions.findFirst({
      where: (s, { eq, and }) => and(eq(s.id, sessionId), eq(s.candidateId, user.id)),
    });
    if (!session || session.status !== "in_progress") {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_STATE", message: "Session cannot be paused" },
      });
    }

    const now = new Date();
    const [updated] = await db
      .update(assessmentSessions)
      .set({ status: "paused", pausedAt: now, updatedAt: now })
      .where(eq(assessmentSessions.id, sessionId))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // POST /:sessionId/resume
  fastify.post("/:sessionId/resume", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const session = await db.query.assessmentSessions.findFirst({
      where: (s, { eq, and }) => and(eq(s.id, sessionId), eq(s.candidateId, user.id)),
    });
    if (!session || session.status !== "paused") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_STATE",
          message: "Session cannot be resumed",
        },
      });
    }

    const now = new Date();
    const pausedMs = session.pausedAt ? now.getTime() - new Date(session.pausedAt).getTime() : 0;
    const [updated] = await db
      .update(assessmentSessions)
      .set({
        status: "in_progress",
        resumedAt: now,
        pausedAt: null,
        totalPausedSeconds: session.totalPausedSeconds + Math.floor(pausedMs / 1000),
        updatedAt: now,
      })
      .where(eq(assessmentSessions.id, sessionId))
      .returning();

    return reply.send({ success: true, data: updated });
  });

  // POST /:sessionId/heartbeat
  fastify.post("/:sessionId/heartbeat", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = heartbeatSchema.parse(request.body);

    const session = await db.query.assessmentSessions.findFirst({
      where: (s, { eq, and }) => and(eq(s.id, sessionId), eq(s.candidateId, user.id)),
    });
    if (!session || session.status !== "in_progress") {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_STATE", message: "Session not active" },
      });
    }

    // Server-side expiry enforcement
    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
      await db
        .update(assessmentSessions)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(assessmentSessions.id, sessionId));
      return reply.status(400).send({
        success: false,
        error: { code: "SESSION_EXPIRED", message: "Session has expired" },
      });
    }

    const [updated] = await db
      .update(assessmentSessions)
      .set({
        currentFile: body.currentFile ?? session.currentFile,
        timeRemainingSeconds: body.timeRemainingSeconds ?? session.timeRemainingSeconds,
        updatedAt: new Date(),
      })
      .where(eq(assessmentSessions.id, sessionId))
      .returning();

    return reply.send({ success: true, data: updated });
  });
}
