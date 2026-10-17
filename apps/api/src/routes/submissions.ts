import { FastifyInstance, FastifyReply } from "fastify";
import { db } from "../services/database";
import { authorizeSessionAccess, type SessionAccessFailure } from "../services/sessionAccess";
import { submissions, verificationChallenges, assessmentSessions } from "@database/schema";
import { eq, desc } from "drizzle-orm";
import { createSubmissionRequestSchema } from "@contracts/proofloop";
import { redactResultsForCandidate } from "../services/testRunner";
import {
  processAssessmentSubmission,
  processChallengeFollowUp,
  challengeEntryPresent,
  type SubmissionFile,
} from "../services/submissionService";

function fail(reply: FastifyReply, access: SessionAccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

function redactChallenge(challenge: typeof verificationChallenges.$inferSelect, includePrivate: boolean) {
  const { privateTests, ...rest } = challenge;
  return {
    ...rest,
    privateTests: includePrivate ? privateTests : undefined,
  };
}

export async function submissionRoutes(fastify: FastifyInstance) {
  // POST /:sessionId/submissions — create an immutable submission version.
  // Assessment submissions run the public/hidden suite and produce an
  // evaluation. Verification follow-ups run the challenge's private tests.
  fastify.post("/:sessionId/submissions", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = createSubmissionRequestSchema.parse(request.body);

    const access = await authorizeSessionAccess(sessionId, user.id, "write");
    if (!access.ok) return fail(reply, access);
    if (!access.isOwner) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Only the candidate may submit this session." },
      });
    }

    if (body.kind === "verification_followup") {
      if (!body.challengeId) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_REQUEST", message: "challengeId is required for a follow-up." },
        });
      }
      const challenge = await db.query.verificationChallenges.findFirst({
        where: (c, { and, eq }) => and(eq(c.id, body.challengeId as string), eq(c.sessionId, sessionId)),
      });
      if (!challenge) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Challenge not found for this session." },
        });
      }
      if (["verified", "revoked", "expired"].includes(challenge.status)) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_STATE", message: "This challenge can no longer be submitted." },
        });
      }
      if (!challengeEntryPresent(challenge, body.files)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "MISSING_ENTRY",
            message: `Follow-up must include ${challenge.entryFile}.`,
          },
        });
      }

      await db
        .update(verificationChallenges)
        .set({
          status: challenge.status === "offered" ? "submitted" : challenge.status,
          startedAt: challenge.startedAt ?? new Date(),
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(verificationChallenges.id, challenge.id));

      const result = await processChallengeFollowUp({
        session: access.session,
        assignment: access.assignment,
        challenge,
        files: body.files as SubmissionFile[],
        idempotencyKey: body.idempotencyKey ?? null,
      });

      const updatedChallenge = await db.query.verificationChallenges.findFirst({
        where: (c, { eq }) => eq(c.id, challenge.id),
      });

      return reply.status(result.reused ? 200 : 201).send({
        success: true,
        data: {
          kind: "verification_followup",
          submissionId: result.submission.id,
          submissionVersion: result.submission.submissionVersion,
          reused: result.reused,
          results: redactResultsForCandidate(result.results),
          challenge: updatedChallenge ? redactChallenge(updatedChallenge, false) : null,
        },
      });
    }

    // Assessment submission.
    const result = await processAssessmentSubmission({
      session: access.session,
      assignment: access.assignment,
      files: body.files as SubmissionFile[],
      idempotencyKey: body.idempotencyKey ?? null,
    });

    if (!result.reused) {
      await db
        .update(assessmentSessions)
        .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
        .where(eq(assessmentSessions.id, sessionId));
    }

    return reply.status(result.reused ? 200 : 201).send({
      success: true,
      data: {
        kind: "assessment",
        submissionId: result.submission.id,
        submissionVersion: result.submission.submissionVersion,
        reused: result.reused,
        evaluationId: result.evaluationId,
        results: redactResultsForCandidate(result.results),
        challenges: result.challenges.map((challenge) => redactChallenge(challenge, false)),
      },
    });
  });

  // GET /:sessionId/submissions — list submissions (candidate or org member).
  fastify.get("/:sessionId/submissions", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const rows = await db.query.submissions.findMany({
      where: (s, { eq }) => eq(s.sessionId, sessionId),
      orderBy: (s, { desc }) => [desc(s.submissionVersion)],
    });

    const includePrivate = !access.isOwner;
    return reply.send({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        sessionId: row.sessionId,
        submissionVersion: row.submissionVersion,
        kind: row.kind,
        status: row.status,
        testSummary: row.testSummary,
        submittedAt: row.submittedAt,
        _includePrivate: includePrivate,
      })),
    });
  });

  // GET /:sessionId/submissions/:submissionId — a single submission.
  fastify.get("/:sessionId/submissions/:submissionId", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId, submissionId } = request.params as {
      sessionId: string;
      submissionId: string;
    };

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const row = await db.query.submissions.findFirst({
      where: (s, { and, eq }) => and(eq(s.id, submissionId), eq(s.sessionId, sessionId)),
    });
    if (!row) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Submission not found." },
      });
    }

    return reply.send({ success: true, data: row });
  });
}
