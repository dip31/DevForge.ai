import { FastifyInstance, FastifyReply } from "fastify";
import { db } from "../services/database";
import { authorizeSessionAccess, type SessionAccessFailure } from "../services/sessionAccess";
import {
  skillAssessments,
  verificationChallenges,
  evaluations,
} from "@database/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { createChallengeRequestSchema, type SkillStatus } from "@contracts/proofloop";
import {
  detectSkillGaps,
  validateChallengeTemplate,
  type ApprovedTemplate,
} from "../services/proofLoopEngine";
import { toApprovedTemplate, getActiveTemplatesForOrganization } from "../services/submissionService";

function fail(reply: FastifyReply, access: SessionAccessFailure) {
  return reply
    .status(access.status)
    .send({ success: false, error: { code: access.code, message: access.message } });
}

function challengeToClient(
  challenge: typeof verificationChallenges.$inferSelect,
  includePrivate: boolean,
) {
  const { privateTests, ...rest } = challenge;
  return { ...rest, privateTests: includePrivate ? privateTests : undefined };
}

export async function proofLoopRoutes(fastify: FastifyInstance) {
  // GET /sessions/:sessionId — ProofLoop state (skills, gaps, challenges).
  fastify.get("/sessions/:sessionId", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const [skills, challenges] = await Promise.all([
      db.query.skillAssessments.findMany({
        where: (s, { eq }) => eq(s.sessionId, sessionId),
      }),
      db.query.verificationChallenges.findMany({
        where: (c, { eq }) => eq(c.sessionId, sessionId),
        orderBy: (c, { desc }) => [desc(c.offeredAt)],
      }),
    ]);

    const gaps = detectSkillGaps(
      skills.map((skill) => ({
        criterionId: skill.criterionId,
        name: skill.name,
        status: skill.status as SkillStatus,
        evidenceIds: (skill.evidenceIds as string[]) ?? [],
        explanation: skill.explanation,
      })),
    ).filter((gap) => gap.status !== "demonstrated");

    const includePrivate = !access.isOwner;
    return reply.send({
      success: true,
      data: {
        sessionId,
        skills,
        gaps,
        challenges: challenges.map((challenge) => challengeToClient(challenge, includePrivate)),
      },
    });
  });

  // GET /sessions/:sessionId/report — evidence-backed ProofLoop report.
  fastify.get("/sessions/:sessionId/report", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    const includePrivate = !access.isOwner;

    const [skills, challenges, evaluation, submissionRows] = await Promise.all([
      db.query.skillAssessments.findMany({ where: (s, { eq }) => eq(s.sessionId, sessionId) }),
      db.query.verificationChallenges.findMany({
        where: (c, { eq }) => eq(c.sessionId, sessionId),
        orderBy: (c, { asc }) => [asc(c.offeredAt)],
      }),
      db.query.evaluations.findFirst({ where: (e, { eq }) => eq(e.sessionId, sessionId) }),
      db.query.submissions.findMany({
        where: (s, { eq }) => eq(s.sessionId, sessionId),
        orderBy: (s, { asc }) => [asc(s.submissionVersion)],
      }),
    ]);

    const criteria = evaluation
      ? await db.query.evaluationCriteria.findMany({
          where: (c, { eq }) => eq(c.evaluationId, evaluation.id),
        })
      : [];

    return reply.send({
      success: true,
      data: {
        sessionId,
        evaluationId: evaluation?.id ?? null,
        assessmentTitle: evaluation?.assessmentTitle ?? null,
        skills,
        criteria,
        challenges: challenges.map((challenge) => challengeToClient(challenge, includePrivate)),
        submissions: submissionRows.map((row) => ({
          id: row.id,
          submissionVersion: row.submissionVersion,
          kind: row.kind,
          status: row.status,
          testSummary: row.testSummary,
          submittedAt: row.submittedAt,
        })),
      },
    });
  });

  // GET /challenges/:challengeId — single challenge.
  fastify.get("/challenges/:challengeId", async (request, reply) => {
    const user = (request as any).user;
    const { challengeId } = request.params as { challengeId: string };

    const challenge = await db.query.verificationChallenges.findFirst({
      where: (c, { eq }) => eq(c.id, challengeId),
    });
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Challenge not found." },
      });
    }
    const access = await authorizeSessionAccess(challenge.sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);

    return reply.send({
      success: true,
      data: challengeToClient(challenge, !access.isOwner),
    });
  });

  // POST /sessions/:sessionId/challenges — manually offer an approved challenge
  // for an existing gap (organization reviewers; validated against the rubric).
  fastify.post("/sessions/:sessionId/challenges", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.params as { sessionId: string };
    const body = createChallengeRequestSchema.parse(request.body);

    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);
    if (access.isOwner) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Only reviewers may create challenges." },
      });
    }

    const skills = await db.query.skillAssessments.findMany({
      where: (s, { eq }) => eq(s.sessionId, sessionId),
    });
    const gaps = detectSkillGaps(
      skills.map((skill) => ({
        criterionId: skill.criterionId,
        name: skill.name,
        status: skill.status as SkillStatus,
        evidenceIds: (skill.evidenceIds as string[]) ?? [],
        explanation: skill.explanation,
      })),
    );

    const templates = await getActiveTemplatesForOrganization(access.assignment.organizationId);
    const approved: ApprovedTemplate[] = templates.map(toApprovedTemplate);
    const target = templates.find((t) => t.key === body.templateKey);
    if (!target) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Challenge template not found." },
      });
    }

    const gap = gaps.find((g) => g.criterionId === target.targetCriterionId);
    if (!gap) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "NO_GAP",
          message: "No open skill gap matches this template's target criterion.",
        },
      });
    }

    const validation = validateChallengeTemplate(target, gap);
    if (!validation.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_TEMPLATE", message: validation.reason },
      });
    }

    const existing = await db.query.verificationChallenges.findFirst({
      where: (c, { and, eq }) =>
        and(eq(c.sessionId, sessionId), eq(c.templateKey, body.templateKey)),
    });
    if (existing) {
      return reply.send({ success: true, data: challengeToClient(existing, true) });
    }

    const evaluation = await db.query.evaluations.findFirst({
      where: (e, { eq }) => eq(e.sessionId, sessionId),
    });
    const triggerEvidenceId = (gap.evidenceIds as string[])[0] ?? null;

    const [challenge] = await db
      .insert(verificationChallenges)
      .values({
        organizationId: access.assignment.organizationId,
        sessionId,
        assignmentId: access.assignment.id,
        assessmentId: access.assignment.assessmentId,
        assessmentVersionId: access.assignment.assessmentVersionId,
        evaluationId: evaluation?.id ?? null,
        templateId: target.id,
        templateKey: target.key,
        criterionId: gap.criterionId,
        skillKey: gap.skillKey,
        title: target.title,
        prompt: target.prompt,
        instructions: target.instructions,
        entryFile: target.entryFile,
        exportName: target.exportName,
        privateTests: target.privateTests,
        status: "offered",
        triggerEvidenceId,
        triggerSummary: gap.reason,
        originalStatus: gap.status,
      })
      .returning();

    return reply.status(201).send({
      success: true,
      data: challengeToClient(challenge, true),
    });
  });

  // GET /templates — approved templates for the caller's organization.
  fastify.get("/templates", async (request, reply) => {
    const user = (request as any).user;
    const { sessionId } = request.query as { sessionId?: string };
    if (!sessionId) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_REQUEST", message: "sessionId query parameter is required." },
      });
    }
    const access = await authorizeSessionAccess(sessionId, user.id, "read");
    if (!access.ok) return fail(reply, access);
    if (access.isOwner) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Templates are only available to reviewers." },
      });
    }

    const templates = await getActiveTemplatesForOrganization(access.assignment.organizationId);
    return reply.send({ success: true, data: templates.map(toApprovedTemplate) });
  });

  // POST /challenges/:challengeId/start — candidate begins a challenge.
  fastify.post("/challenges/:challengeId/start", async (request, reply) => {
    const user = (request as any).user;
    const { challengeId } = request.params as { challengeId: string };

    const challenge = await db.query.verificationChallenges.findFirst({
      where: (c, { eq }) => eq(c.id, challengeId),
    });
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Challenge not found." },
      });
    }
    const access = await authorizeSessionAccess(challenge.sessionId, user.id, "write");
    if (!access.ok) return fail(reply, access);
    if (!access.isOwner) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Only the candidate may start this challenge." },
      });
    }

    if (challenge.status === "offered") {
      await db
        .update(verificationChallenges)
        .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(verificationChallenges.id, challengeId));
    }

    const updated = await db.query.verificationChallenges.findFirst({
      where: (c, { eq }) => eq(c.id, challengeId),
    });
    return reply.send({ success: true, data: updated });
  });
}
