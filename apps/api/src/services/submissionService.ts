import { db } from "./database";
import { eq, and, desc } from "drizzle-orm";
import {
  assessmentSessions,
  candidateAssignments,
  assessmentVersions,
  rubricVersions,
  workspaceRevisions,
  executionRuns,
  testResults as testResultsTable,
  evidenceRecords,
  activityEvents,
  evaluations,
  evaluationCriteria,
  findingEvidenceLinks,
  submissions,
  verificationChallenges,
  skillAssessments,
  challengeTemplates,
} from "@database/schema";
import {
  parseRunnerConfig,
  selectChallengeTemplate,
  detectSkillGaps,
  aggregateVerification,
  type ApprovedTemplate,
} from "./proofLoopEngine";
import { buildCriterionFindings, toCriterionDbStatus, type RubricCriterion } from "./evaluationEngine";
import { runJavaScriptFunctionTests, type TestExecutionResult } from "./testRunner";

export type SessionRow = typeof assessmentSessions.$inferSelect;
export type AssignmentRow = typeof candidateAssignments.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type ChallengeRow = typeof verificationChallenges.$inferSelect;

export type SubmissionFile = { path: string; language: string; content: string };

async function nextSubmissionVersion(sessionId: string): Promise<number> {
  const latest = await db.query.submissions.findFirst({
    where: (s, { eq }) => eq(s.sessionId, sessionId),
    orderBy: (s, { desc }) => [desc(s.submissionVersion)],
  });
  return (latest?.submissionVersion ?? 0) + 1;
}

async function nextRevisionNumber(sessionId: string): Promise<number> {
  const latest = await db.query.workspaceRevisions.findFirst({
    where: (r, { eq }) => eq(r.sessionId, sessionId),
    orderBy: (r, { desc }) => [desc(r.revisionNumber)],
  });
  return (latest?.revisionNumber ?? 0) + 1;
}

/**
 * Persist an immutable submission version. Retry-safe: when an idempotencyKey
 * is supplied and a submission with that key already exists it is returned
 * unchanged, so duplicate client retries never create a second version.
 */
export async function createSubmission(input: {
  session: SessionRow;
  assignment: AssignmentRow;
  files: SubmissionFile[];
  kind: "assessment" | "verification_followup";
  challengeId?: string | null;
  idempotencyKey?: string | null;
  submissionTimestamp?: Date;
}): Promise<{ submission: SubmissionRow; reused: boolean }> {
  const { session, assignment, files, kind } = input;

  if (input.idempotencyKey) {
    const existing = await db.query.submissions.findFirst({
      where: (s, { eq }) => eq(s.idempotencyKey, input.idempotencyKey as string),
    });
    if (existing) return { submission: existing, reused: true };
  }

  const revisionNumber = await nextRevisionNumber(session.id);
  const submittedAt = input.submissionTimestamp ?? new Date();
  const [revision] = await db
    .insert(workspaceRevisions)
    .values({
      sessionId: session.id,
      revisionNumber,
      files,
      message:
        kind === "verification_followup"
          ? "Verification challenge follow-up submission"
          : "Assessment submission",
      isSnapshot: true,
    })
    .returning();

  const submissionVersion = await nextSubmissionVersion(session.id);
  const [submission] = await db
    .insert(submissions)
    .values({
      sessionId: session.id,
      submissionVersion,
      kind,
      challengeId: input.challengeId ?? null,
      candidateId: session.candidateId,
      organizationId: assignment.organizationId,
      assignmentId: assignment.id,
      assessmentId: assignment.assessmentId,
      assessmentVersionId: assignment.assessmentVersionId,
      revisionId: revision.id,
      files,
      idempotencyKey: input.idempotencyKey ?? null,
      status: "completed",
      submittedAt,
    })
    .returning();

  return { submission, reused: false };
}

export type RecordedTests = {
  executionRunId: string;
  results: TestExecutionResult[];
  ok: boolean;
  error?: string;
};

/** Execute the assessment's deterministic test suite for a submission. */
export async function executeTestsForSubmission(input: {
  session: SessionRow;
  submission: SubmissionRow;
}): Promise<RecordedTests> {
  const { session, submission } = input;
  const version = await db.query.assessmentVersions.findFirst({
    where: (v, { eq }) => eq(v.id, submission.assessmentVersionId),
  });

  const config = parseRunnerConfig(version?.testConfig);
  const files = submission.files as SubmissionFile[];

  if (!config) {
    const [run] = await db
      .insert(executionRuns)
      .values({
        sessionId: session.id,
        revisionId: submission.revisionId,
        type: "test",
        command: "deterministic-runner",
        status: "failed",
        error: "No executable test configuration is defined for this assessment version.",
        completedAt: new Date(),
      })
      .returning();
    return {
      executionRunId: run.id,
      results: [],
      ok: false,
      error: "No executable test configuration is defined for this assessment version.",
    };
  }

  const entry =
    files.find((file) => file.path === config.entryFile) ??
    files.find((file) => file.path.endsWith(config.entryFile.split("/").pop() ?? ""));
  const source = entry?.content ?? "";

  const outcome = runJavaScriptFunctionTests(source, config, config.tests);
  const completedAt = new Date();
  const [run] = await db
    .insert(executionRuns)
    .values({
      sessionId: session.id,
      revisionId: submission.revisionId,
      type: "test",
      command: `runner:${config.runner}`,
      status: outcome.ok ? "completed" : "failed",
      exitCode: outcome.ok ? 0 : 1,
      error: outcome.error ?? null,
      startedAt: completedAt,
      completedAt,
      durationMs: outcome.results.reduce((sum, result) => sum + result.durationMs, 0),
    })
    .returning();

  if (outcome.results.length > 0) {
    await db.insert(testResultsTable).values(
      outcome.results.map((result) => ({
        sessionId: session.id,
        executionRunId: run.id,
        revisionId: submission.revisionId,
        testSuite: result.suite,
        testName: result.name,
        status: result.status,
        durationMs: result.durationMs,
        output: result.message,
        criterion: result.criterion,
        isHidden: result.visibility === "private",
      })),
    );
  }

  return { executionRunId: run.id, results: outcome.results, ok: outcome.ok, error: outcome.error };
}

export type EvidenceRow = typeof evidenceRecords.$inferSelect;

/** Persist evidence for a submission and its test results (idempotent by contentRef). */
export async function recordSubmissionEvidence(input: {
  session: SessionRow;
  assignment: AssignmentRow;
  submission: SubmissionRow;
  results: TestExecutionResult[];
  label: string;
}): Promise<{ evidence: EvidenceRow[]; byCriterion: Map<string, string[]>; byTestId: Map<string, string> }> {
  const { session, assignment, submission, results } = input;
  const base = {
    candidateId: session.candidateId,
    organizationId: assignment.organizationId,
    assignmentId: assignment.id,
    assessmentId: assignment.assessmentId,
    sessionId: session.id,
    revisionId: submission.revisionId,
  };

  const existing = await db.query.evidenceRecords.findFirst({
    where: (e, { and, eq }) =>
      and(
        eq(e.sessionId, session.id),
        eq(e.contentRef, `submission:${submission.id}:snapshot`),
      ),
  });

  const snapshot =
    existing ??
    (
      await db
        .insert(evidenceRecords)
        .values({
          ...base,
          type: "submitted_snapshot",
          timestamp: submission.submittedAt,
          title: input.label,
          summary: `${(submission.files as SubmissionFile[]).length} file(s) captured in submission v${submission.submissionVersion}.`,
          contentRef: `submission:${submission.id}:snapshot`,
          provenance: "candidate_action",
          integrity: "available",
          metadata: { submissionVersion: submission.submissionVersion, kind: submission.kind },
        })
        .returning()
    )[0];

  const evidence: EvidenceRow[] = [snapshot];
  const byCriterion = new Map<string, string[]>();
  const byTestId = new Map<string, string>();

  for (const result of results) {
    const contentRef = `submission:${submission.id}:test:${result.id}`;
    const found = await db.query.evidenceRecords.findFirst({
      where: (e, { eq }) => eq(e.contentRef, contentRef),
    });
    const row =
      found ??
      (
        await db
          .insert(evidenceRecords)
          .values({
            ...base,
            type: "test_result",
            timestamp: submission.submittedAt,
            title: result.name,
            summary: result.message,
            sourceEventId: result.id,
            resultId: result.id,
            contentRef,
            provenance: "system_generated",
            integrity: "available",
            testStatus: result.status === "error" ? "failed" : result.status,
            metadata: {
              submissionVersion: submission.submissionVersion,
              hidden: result.visibility === "private",
              criterion: result.criterion,
            },
          })
          .returning()
      )[0];
    evidence.push(row);
    byTestId.set(result.id, row.id);
    if (result.criterion) {
      const list = byCriterion.get(result.criterion) ?? [];
      list.push(row.id);
      byCriterion.set(result.criterion, list);
    }
  }

  await recordActivity(input.session.id, "test_run", `${input.label}: ${results.length} check(s) recorded.`);

  return { evidence, byCriterion, byTestId };
}

export async function recordActivity(sessionId: string, type: string, detail: string) {
  await db.insert(activityEvents).values({
    sessionId,
    type,
    timestamp: new Date(),
    detail,
    provenance: "system_generated",
  });
}

export type EvaluationUpsertResult = {
  evaluationId: string;
  criteria: ReturnType<typeof buildCriterionFindings>["criteria"];
};

async function loadRubric(criterionVersionId: string): Promise<RubricCriterion[]> {
  const rubric = await db.query.rubricVersions.findFirst({
    where: (r, { and, eq }) => and(eq(r.assessmentVersionId, criterionVersionId), eq(r.isCurrent, true)),
  });
  if (!rubric) return [];
  return (rubric.criteria as RubricCriterion[]) ?? [];
}

/**
 * Create or upgrade the evaluation for a session. The evaluation row is unique
 * per session; re-submitting (or a follow-up) bumps its version and rewrites
 * the criteria findings, linking each finding to the evidence that supports it.
 */
export async function upsertEvaluation(input: {
  session: SessionRow;
  assignment: AssignmentRow;
  submission: SubmissionRow;
  results: TestExecutionResult[];
  evidenceByCriterion: Map<string, string[]>;
}): Promise<EvaluationUpsertResult> {
  const { session, assignment, submission, results, evidenceByCriterion } = input;

  const [version, assignmentAssessments] = await Promise.all([
    db.query.assessmentVersions.findFirst({
      where: (v, { eq }) => eq(v.id, submission.assessmentVersionId),
    }),
    db.query.assessments.findFirst({
      where: (a, { eq }) => eq(a.id, assignment.assessmentId),
    }),
  ]);

  const rubricCriteria = await loadRubric(submission.assessmentVersionId);
  const build = buildCriterionFindings(rubricCriteria, results);

  const candidateName = await resolveCandidateName(session.candidateId);
  const organizationName = await resolveOrganizationName(assignment.organizationId);

  const existing = await db.query.evaluations.findFirst({
    where: (e, { eq }) => eq(e.sessionId, session.id),
  });

  const now = new Date();
  const base = {
    candidateId: session.candidateId,
    candidateName,
    organizationId: assignment.organizationId,
    organizationName,
    assignmentId: assignment.id,
    assessmentId: assignment.assessmentId,
    assessmentTitle: assignmentAssessments?.title ?? "Assessment",
    taskTitle: version?.title ?? assignmentAssessments?.title ?? "Assessment task",
    sessionId: session.id,
    submissionRevisionId: submission.revisionId,
    submissionTimestamp: submission.submittedAt,
    rubricVersion: "rubric-v1",
    evaluatorVersion: "devforge-rule-evaluator-v1",
    evaluatorMethod: "deterministic_rule_based",
    evaluatedAt: now,
    evidenceCoverage: build.evidenceCoverage,
    aggregateScore: build.aggregateScore,
    evaluationStatus: build.evaluationStatus,
    limitations: build.limitations,
    updatedAt: now,
  };

  let evaluationId: string;
  if (existing) {
    await db
      .update(evaluations)
      .set({ ...base, version: existing.version + 1, previousEvaluationId: existing.id })
      .where(eq(evaluations.id, existing.id));
    evaluationId = existing.id;
    await db.delete(evaluationCriteria).where(eq(evaluationCriteria.evaluationId, evaluationId));
  } else {
    const [created] = await db.insert(evaluations).values(base).returning();
    evaluationId = created.id;
  }

  for (const finding of build.criteria) {
    const evidenceIds = evidenceByCriterion.get(finding.criterionId) ?? [];
    const [criterion] = await db
      .insert(evaluationCriteria)
      .values({
        evaluationId,
        criterionId: finding.criterionId,
        name: finding.name,
        description: finding.description,
        rubric: finding.rubric,
        weight: finding.weight,
        status: toCriterionDbStatus(finding.status),
        supportedScore: finding.supportedScore,
        sufficiency: finding.sufficiency,
        missingEvidence: finding.missingEvidence,
        explanation: finding.explanation,
        candidateVisible: finding.candidateVisible,
      })
      .returning();

    for (const evidenceId of evidenceIds) {
      await db.insert(findingEvidenceLinks).values({
        criterionId: criterion.id,
        evidenceId,
        linkType: finding.status === "demonstrated" ? "supports" : "context",
      });
    }

    await upsertSkillAssessment({
      sessionId: session.id,
      evaluationId,
      organizationId: assignment.organizationId,
      criterionId: finding.criterionId,
      name: finding.name,
      status: finding.status,
      evidenceIds,
      explanation: finding.explanation,
    });
  }

  return { evaluationId, criteria: build.criteria };
}

async function upsertSkillAssessment(input: {
  sessionId: string;
  evaluationId: string;
  organizationId: string;
  criterionId: string;
  name: string;
  status: ReturnType<typeof buildCriterionFindings>["criteria"][number]["status"];
  evidenceIds: string[];
  explanation: string;
}) {
  const existing = await db.query.skillAssessments.findFirst({
    where: (s, { and, eq }) =>
      and(eq(s.sessionId, input.sessionId), eq(s.criterionId, input.criterionId)),
  });
  const now = new Date();
  if (existing) {
    await db
      .update(skillAssessments)
      .set({
        evaluationId: input.evaluationId,
        name: input.name,
        status: input.status,
        evidenceIds: input.evidenceIds,
        explanation: input.explanation,
        updatedAt: now,
      })
      .where(eq(skillAssessments.id, existing.id));
    return;
  }
  await db.insert(skillAssessments).values({
    sessionId: input.sessionId,
    evaluationId: input.evaluationId,
    organizationId: input.organizationId,
    criterionId: input.criterionId,
    skillKey: input.criterionId,
    name: input.name,
    status: input.status,
    originalStatus: input.status,
    evidenceIds: input.evidenceIds,
    explanation: input.explanation,
    history: [{ at: now.toISOString(), event: "initial_evaluation", status: input.status }],
  });
}

async function resolveCandidateName(userId: string): Promise<string> {
  const profile = await db.query.userProfiles.findFirst({
    where: (p, { eq }) => eq(p.id, userId),
  });
  return profile?.name ?? "Candidate";
}

async function resolveOrganizationName(organizationId: string): Promise<string> {
  const org = await db.query.organizations.findFirst({
    where: (o, { eq }) => eq(o.id, organizationId),
  });
  return org?.name ?? "Organization";
}

export type OfferResult = {
  created: ChallengeRow[];
};

/**
 * After evaluation, offer a targeted verification challenge for each gap that
 * has an approved template. Existing challenges for the same session+template
 * are not duplicated.
 */
export async function offerChallengesForGaps(input: {
  session: SessionRow;
  assignment: AssignmentRow;
  evaluationId: string;
  criteria: ReturnType<typeof buildCriterionFindings>["criteria"];
  evidenceByCriterion: Map<string, string[]>;
}): Promise<OfferResult> {
  const { session, assignment, evaluationId, criteria, evidenceByCriterion } = input;

  const gaps = detectSkillGaps(
    criteria.map((criterion) => ({
      criterionId: criterion.criterionId,
      name: criterion.name,
      status: criterion.status,
      evidenceIds: evidenceByCriterion.get(criterion.criterionId) ?? [],
      explanation: criterion.explanation,
    })),
  ).filter((gap) => gap.status !== "demonstrated");

  if (gaps.length === 0) return { created: [] };

  const templates = await db.query.challengeTemplates.findMany({
    where: (t, { eq }) => eq(t.isActive, true),
  });
  const approved: ApprovedTemplate[] = templates.map(toApprovedTemplate);

  const created: ChallengeRow[] = [];
  for (const gap of gaps) {
    const template = selectChallengeTemplate(gap, approved);
    if (!template) continue;
    // Non-global templates must belong to this organization.
    const row = templates.find((t) => t.key === template.key);
    if (row?.organizationId && row.organizationId !== assignment.organizationId) continue;

    const existing = await db.query.verificationChallenges.findFirst({
      where: (c, { and, eq }) =>
        and(eq(c.sessionId, session.id), eq(c.templateKey, template.key)),
    });
    if (existing) continue;

    const triggerEvidenceId = (evidenceByCriterion.get(gap.criterionId) ?? [])[0] ?? null;
    const [challenge] = await db
      .insert(verificationChallenges)
      .values({
        organizationId: assignment.organizationId,
        sessionId: session.id,
        assignmentId: assignment.id,
        assessmentId: assignment.assessmentId,
        assessmentVersionId: assignment.assessmentVersionId,
        evaluationId,
        templateId: template.id,
        templateKey: template.key,
        criterionId: gap.criterionId,
        skillKey: gap.skillKey,
        title: template.title,
        prompt: template.prompt,
        instructions: template.instructions,
        entryFile: template.entryFile,
        exportName: template.exportName,
        privateTests: template.privateTests,
        status: "offered",
        triggerEvidenceId,
        triggerSummary: gap.reason,
        originalStatus: gap.status,
      })
      .returning();

    await db
      .update(skillAssessments)
      .set({ lastChallengeId: challenge.id, updatedAt: new Date() })
      .where(
        and(
          eq(skillAssessments.sessionId, session.id),
          eq(skillAssessments.criterionId, gap.criterionId),
        ),
      );

    created.push(challenge);
  }

  return { created };
}

export function toApprovedTemplate(row: typeof challengeTemplates.$inferSelect): ApprovedTemplate {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    skillKey: row.skillKey,
    targetCriterionId: row.targetCriterionId,
    prompt: row.prompt,
    instructions: row.instructions,
    entryFile: row.entryFile,
    exportName: row.exportName,
    privateTests: (row.privateTests as ApprovedTemplate["privateTests"]) ?? [],
    isActive: row.isActive,
  };
}

export async function getActiveTemplatesForOrganization(organizationId: string) {
  const rows = await db.query.challengeTemplates.findMany({
    where: (t, { eq }) => eq(t.isActive, true),
  });
  return rows.filter((row) => !row.organizationId || row.organizationId === organizationId);
}

/** Full assessment submission pipeline (used by the submissions route). */
export async function processAssessmentSubmission(input: {
  session: SessionRow;
  assignment: AssignmentRow;
  files: SubmissionFile[];
  idempotencyKey?: string | null;
}) {
  const { submission, reused } = await createSubmission({
    session: input.session,
    assignment: input.assignment,
    files: input.files,
    kind: "assessment",
    idempotencyKey: input.idempotencyKey ?? null,
  });

  if (reused) {
    const evaluation = await db.query.evaluations.findFirst({
      where: (e, { eq }) => eq(e.sessionId, input.session.id),
    });
    return { submission, results: [], evaluationId: evaluation?.id ?? null, challenges: [], reused };
  }

  const tests = await executeTestsForSubmission({ session: input.session, submission });
  const recorded = await recordSubmissionEvidence({
    session: input.session,
    assignment: input.assignment,
    submission,
    results: tests.results,
    label: `Submitted code snapshot v${submission.submissionVersion}`,
  });

  const evaluation = await upsertEvaluation({
    session: input.session,
    assignment: input.assignment,
    submission,
    results: tests.results,
    evidenceByCriterion: recorded.byCriterion,
  });

  const offers = await offerChallengesForGaps({
    session: input.session,
    assignment: input.assignment,
    evaluationId: evaluation.evaluationId,
    criteria: evaluation.criteria,
    evidenceByCriterion: recorded.byCriterion,
  });

  await db
    .update(submissions)
    .set({
      testSummary: {
        passed: tests.results.filter((r) => r.status === "passed").length,
        total: tests.results.length,
      },
    })
    .where(eq(submissions.id, submission.id));

  return {
    submission,
    results: tests.results,
    evaluationId: evaluation.evaluationId,
    challenges: offers.created,
    reused,
  };
}

/** Follow-up verification pipeline for an offered challenge. */
export async function processChallengeFollowUp(input: {
  session: SessionRow;
  assignment: AssignmentRow;
  challenge: ChallengeRow;
  files: SubmissionFile[];
  idempotencyKey?: string | null;
}) {
  const { submission, reused } = await createSubmission({
    session: input.session,
    assignment: input.assignment,
    files: input.files,
    kind: "verification_followup",
    challengeId: input.challenge.id,
    idempotencyKey: input.idempotencyKey ?? null,
  });

  if (reused) {
    return { submission, results: [] as TestExecutionResult[], reused: true };
  }

  const privateTests = (input.challenge.privateTests as ApprovedTemplate["privateTests"]) ?? [];
  const entry =
    input.files.find((file) => file.path === input.challenge.entryFile) ??
    input.files.find(
      (file) => file.path.endsWith(input.challenge.entryFile.split("/").pop() ?? ""),
    );
  const source = entry?.content ?? "";

  const outcome = runJavaScriptFunctionTests(
    source,
    {
      entryFile: input.challenge.entryFile,
      exportName: input.challenge.exportName,
      timeoutMs: 2000,
    },
    privateTests,
  );

  const [run] = await db
    .insert(executionRuns)
    .values({
      sessionId: input.session.id,
      revisionId: submission.revisionId,
      type: "verification",
      command: `runner:verification:${input.challenge.templateKey}`,
      status: outcome.ok ? "completed" : "failed",
      exitCode: outcome.ok ? 0 : 1,
      error: outcome.error ?? null,
      completedAt: new Date(),
    })
    .returning();

  if (outcome.results.length > 0) {
    await db.insert(testResultsTable).values(
      outcome.results.map((result) => ({
        sessionId: input.session.id,
        executionRunId: run.id,
        revisionId: submission.revisionId,
        testSuite: result.suite,
        testName: result.name,
        status: result.status,
        durationMs: result.durationMs,
        output: result.message,
        criterion: input.challenge.criterionId,
        isHidden: true,
      })),
    );
  }

  const recorded = await recordSubmissionEvidence({
    session: input.session,
    assignment: input.assignment,
    submission,
    results: outcome.results,
    label: `Verification follow-up snapshot: ${input.challenge.title}`,
  });

  const aggregation = aggregateVerification(input.challenge.originalStatus, outcome.results);

  const now = new Date();
  await db
    .update(verificationChallenges)
    .set({
      status: aggregation.resultStatus === "demonstrated" ? "verified" : "failed",
      followUpSubmissionId: submission.id,
      resultStatus: aggregation.resultStatus,
      passedTests: aggregation.passedTests,
      totalTests: aggregation.totalTests,
      submittedAt: submission.submittedAt,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(verificationChallenges.id, input.challenge.id));

  const skill = await db.query.skillAssessments.findFirst({
    where: (s, { and, eq }) =>
      and(eq(s.sessionId, input.session.id), eq(s.criterionId, input.challenge.criterionId)),
  });
  const priorHistory = Array.isArray(skill?.history) ? (skill?.history as unknown[]) : [];
  const followUpEvidenceId = recorded.evidence[0]?.id;
  if (skill) {
    await db
      .update(skillAssessments)
      .set({
        status: aggregation.resultStatus,
        evidenceIds: [
          ...(Array.isArray(skill.evidenceIds) ? (skill.evidenceIds as string[]) : []),
          ...(followUpEvidenceId ? [followUpEvidenceId] : []),
        ],
        lastChallengeId: input.challenge.id,
        explanation: aggregation.combinedExplanation,
        history: [
          ...priorHistory,
          {
            at: now.toISOString(),
            event: "verification_follow_up",
            challengeId: input.challenge.id,
            originalStatus: input.challenge.originalStatus,
            resultStatus: aggregation.resultStatus,
            passed: aggregation.passedTests,
            total: aggregation.totalTests,
          },
        ],
        updatedAt: now,
      })
      .where(eq(skillAssessments.id, skill.id));
  }

  // Reflect the effective outcome on the evaluation criterion without erasing
  // the original skill status (kept on skill_assessments.originalStatus/history).
  await db
    .update(evaluationCriteria)
    .set({
      status: toCriterionDbStatus(aggregation.resultStatus),
      supportedScore:
        aggregation.totalTests > 0
          ? Math.round((aggregation.passedTests / aggregation.totalTests) * 100)
          : null,
      explanation: aggregation.combinedExplanation,
      updatedAt: now,
    })
    .where(
      and(
        eq(evaluationCriteria.evaluationId, input.challenge.evaluationId ?? ""),
        eq(evaluationCriteria.criterionId, input.challenge.criterionId),
      ),
    );

  if (followUpEvidenceId && input.challenge.evaluationId) {
    const criterionRow = await db.query.evaluationCriteria.findFirst({
      where: (c, { and, eq }) =>
        and(
          eq(c.evaluationId, input.challenge.evaluationId as string),
          eq(c.criterionId, input.challenge.criterionId),
        ),
    });
    if (criterionRow) {
      await db.insert(findingEvidenceLinks).values({
        criterionId: criterionRow.id,
        evidenceId: followUpEvidenceId,
        linkType: "verification",
      });
    }
  }

  return { submission, results: outcome.results, reused: false, aggregation };
}

/** Validate that a set of files includes the challenge entry point. */
export function challengeEntryPresent(challenge: ChallengeRow, files: SubmissionFile[]): boolean {
  return files.some(
    (file) =>
      file.path === challenge.entryFile ||
      file.path.endsWith(challenge.entryFile.split("/").pop() ?? ""),
  );
}
