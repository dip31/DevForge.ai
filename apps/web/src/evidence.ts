import { ActivityEvent, AssessmentSession, CoachMessage, TestResult, Rubric } from "./data";

export type EvidenceType =
  | "submitted_snapshot"
  | "earlier_snapshot"
  | "test_result"
  | "application_run"
  | "ai_coach_prompt"
  | "ai_coach_response"
  | "file_event"
  | "assessment_event"
  | "terminal_command";

export type EvidenceIntegrity = "available" | "partial" | "unavailable" | "mismatch";
export type EvidenceProvenance = "candidate_action" | "system_generated" | "unknown";

export type EvidenceRecord = {
  id: string;
  candidateId: string;
  companyId: string;
  assignmentId: string;
  assessmentId: string;
  sessionId: string;
  type: EvidenceType;
  timestamp: string;
  title: string;
  summary: string;
  file?: string;
  revisionId?: string;
  sourceEventId?: string;
  resultId?: string;
  contentRef: string;
  provenance: EvidenceProvenance;
  integrity: EvidenceIntegrity;
  testStatus?: TestResult["status"];
};

export type EvaluationStatus =
  | "Demonstrated"
  | "Partially Demonstrated"
  | "Not Demonstrated in Available Evidence"
  | "Inconclusive"
  | "Invalid Assessment Evidence";

export type EvidenceSufficiency = "Sufficient" | "Partial" | "Insufficient" | "Invalid";

export type CriterionFinding = {
  id: string;
  name: string;
  description: string;
  rubric: string;
  weight: number;
  status: EvaluationStatus;
  supportedScore?: number;
  evidenceIds: string[];
  explanation: string;
  sufficiency: EvidenceSufficiency;
  missingEvidence: string[];
  candidateVisible: boolean;
};

export type ReviewEvent = {
  id: string;
  criterionId: string;
  action: "accepted" | "overridden" | "clarification_requested";
  previousStatus: EvaluationStatus;
  newStatus: EvaluationStatus;
  reviewerId: string;
  reviewerName: string;
  timestamp: string;
  reason: string;
  evidenceIds: string[];
};

export type EvaluationRecord = {
  id: string;
  version: number;
  previousEvaluationId?: string;
  candidateId: string;
  candidateName: string;
  companyId: string;
  companyName: string;
  assignmentId: string;
  assessmentId: string;
  assessmentTitle: string;
  taskTitle: string;
  sessionId: string;
  submissionRevisionId: string;
  submissionTimestamp: string;
  rubricVersion: string;
  evaluatorVersion: string;
  evaluatorMethod: "deterministic_rule_based_demo";
  evaluatedAt: string;
  evidence: EvidenceRecord[];
  criteria: CriterionFinding[];
  evidenceCoverage: number;
  aggregateScore?: number;
  excludedCriteria: string[];
  evaluationStatus:
    | "Awaiting Evaluation"
    | "Ready for Review"
    | "Inconclusive"
    | "Needs Attention"
    | "Reviewed";
  limitations: string[];
  conflicts: string[];
  reviewerStatus: "Pending" | "In Review" | "Reviewed" | "Needs Attention";
  reviewerOutcome?: string;
  internalReviewerNotes: string;
  reviewEvents: ReviewEvent[];
  candidateFeedbackAvailable: boolean;
};

export const EVALUATION_RUBRIC_VERSION = "novatech-frontend-rubric-v1";
export const EVALUATOR_VERSION = "devforge-rule-evaluator-v1";

const ids = (session: AssessmentSession) => ({
  candidateId: session.candidateId,
  companyId: session.companyId,
  assignmentId: session.assignmentId,
  assessmentId: session.assessmentId,
  sessionId: session.sessionId,
});

function eventEvidence(session: AssessmentSession, event: ActivityEvent): EvidenceRecord | null {
  const base = ids(session);
  if (event.type === "terminal_command_entered")
    return {
      ...base,
      id: `evidence-event-${event.id}`,
      type: "terminal_command",
      timestamp: event.timestamp,
      title: "Demo terminal command",
      summary: event.detail,
      sourceEventId: event.id,
      resultId: event.terminalId,
      contentRef: `activity:${event.id}`,
      provenance: event.provenance,
      integrity: "partial",
    };
  if (["file_opened", "code_changed", "workspace_saved"].includes(event.type))
    return {
      ...base,
      id: `evidence-event-${event.id}`,
      type: "file_event",
      timestamp: event.timestamp,
      title: event.type.replace(/_/g, " "),
      summary: event.detail,
      file: event.file,
      revisionId: event.revisionId,
      sourceEventId: event.id,
      contentRef: `activity:${event.id}`,
      provenance: event.provenance,
      integrity: "available",
    };
  if (["assessment_started", "assessment_submitted"].includes(event.type))
    return {
      ...base,
      id: `evidence-event-${event.id}`,
      type: "assessment_event",
      timestamp: event.timestamp,
      title: event.type.replace(/_/g, " "),
      summary: event.detail,
      revisionId: event.revisionId,
      sourceEventId: event.id,
      contentRef: `activity:${event.id}`,
      provenance: event.provenance,
      integrity: "available",
    };
  return null;
}

function coachEvidence(session: AssessmentSession, message: CoachMessage): EvidenceRecord {
  return {
    ...ids(session),
    id: `evidence-coach-${message.id}`,
    type: message.role === "candidate" ? "ai_coach_prompt" : "ai_coach_response",
    timestamp: message.timestamp,
    title: message.role === "candidate" ? "Candidate AI Coach prompt" : "Demo AI Coach response",
    summary: message.content,
    file: session.currentFile,
    contentRef: `coach:${message.id}`,
    provenance: message.role === "candidate" ? "candidate_action" : "system_generated",
    integrity: "available",
  };
}

export function normalizeEvidence(session: AssessmentSession): EvidenceRecord[] {
  if (!session.submittedAt) return [];
  const base = ids(session);
  const finalRevision = session.revisions.at(-1)?.id ?? "revision-0";
  const evidence: EvidenceRecord[] = [
    {
      ...base,
      id: `evidence-submission-${session.sessionId}`,
      type: "submitted_snapshot",
      timestamp: session.submittedAt,
      title: "Submitted code snapshot",
      summary: `${session.savedFiles.length} workspace files captured in the locked submission.`,
      revisionId: finalRevision,
      contentRef: `revision:${finalRevision}`,
      provenance: "unknown",
      integrity: "available",
    },
  ];
  session.revisions.slice(0, -1).forEach((revision) =>
    evidence.push({
      ...base,
      id: `evidence-revision-${revision.id}`,
      type: "earlier_snapshot",
      timestamp: revision.timestamp,
      title: `Earlier code snapshot · ${revision.id}`,
      summary: `${revision.files.length} workspace files captured at save time.`,
      revisionId: revision.id,
      contentRef: `revision:${revision.id}`,
      provenance: "unknown",
      integrity: "available",
    }),
  );
  session.testRuns.forEach((run) =>
    run.results.forEach((result) =>
      evidence.push({
        ...base,
        id: `evidence-test-${run.id}-${result.id}`,
        type: "test_result",
        timestamp: run.timestamp,
        title: result.name,
        summary: result.diagnostic,
        revisionId: run.revisionId,
        resultId: `${run.id}:${result.id}`,
        contentRef: `test:${run.id}:${result.id}`,
        provenance: "system_generated",
        integrity: run.revisionId === finalRevision ? "available" : "mismatch",
        testStatus: result.status,
      }),
    ),
  );
  session.runHistory.forEach((run) =>
    evidence.push({
      ...base,
      id: `evidence-run-${run.id}`,
      type: "application_run",
      timestamp: run.timestamp,
      title: "Supported application run",
      summary: run.message,
      revisionId: run.revisionId,
      resultId: run.id,
      contentRef: `run:${run.id}`,
      provenance: "system_generated",
      integrity: run.revisionId === finalRevision ? "available" : "partial",
    }),
  );
  session.coachMessages.forEach((message) => evidence.push(coachEvidence(session, message)));
  session.activity.forEach((event) => {
    const normalized = eventEvidence(session, event);
    if (normalized) evidence.push(normalized);
  });
  return evidence.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

const evidenceOf = (evidence: EvidenceRecord[], type: EvidenceType) =>
  evidence.filter((item) => item.type === type);

export function createEvaluation(
  session: AssessmentSession,
  previous?: EvaluationRecord | null,
  customRubrics?: Rubric[],
): EvaluationRecord {
  if (!session.submittedAt) throw new Error("A submitted session is required for evaluation.");
  const evidence = normalizeEvidence(session);
  const finalRevision = session.revisions.at(-1)?.id ?? "revision-0";
  const latestTestRun = session.testRuns.at(-1);
  const latestTestEvidence = latestTestRun
    ? evidence.filter(
        (item) => item.type === "test_result" && item.resultId?.startsWith(`${latestTestRun.id}:`),
      )
    : [];
  const testMismatch = !!latestTestRun && latestTestRun.revisionId !== finalRevision;
  const passed = latestTestRun?.results.filter((result) => result.status === "passed").length ?? 0;
  const submitted = evidenceOf(evidence, "submitted_snapshot");
  const snapshots = [...evidenceOf(evidence, "earlier_snapshot"), ...submitted];
  const fileEvents = evidenceOf(evidence, "file_event");
  const candidatePrompts = evidenceOf(evidence, "ai_coach_prompt");
  const coachResponses = evidenceOf(evidence, "ai_coach_response");
  const testRuns = session.testRuns.length;
  const codeChanged = session.activity.filter((event) => event.type === "code_changed").length;
  const saved = session.activity.filter((event) => event.type === "workspace_saved").length;
  const utilitySource =
    session.savedFiles.find((file) => file.path === "src/taskUtils.js")?.content ?? "";
  const appSource = session.savedFiles.find((file) => file.path === "src/App.jsx")?.content ?? "";
  const structuredCode =
    (utilitySource.match(/export function/g)?.length ?? 0) >= 3 && appSource.includes("useState");

  const functional: CriterionFinding = testMismatch
    ? {
        id: "functional-correctness",
        name: "Functional Correctness",
        description: "Supported task behaviors operate as required.",
        rubric: "Six deterministic public checks against the exact submitted revision.",
        weight: 30,
        status: "Invalid Assessment Evidence",
        evidenceIds: latestTestEvidence.map((item) => item.id),
        explanation:
          "The latest test run references a different revision than the submitted snapshot. The results cannot be attributed to the submission.",
        sufficiency: "Invalid",
        missingEvidence: ["A deterministic test run against the submitted revision."],
        candidateVisible: true,
      }
    : !latestTestRun
      ? {
          id: "functional-correctness",
          name: "Functional Correctness",
          description: "Supported task behaviors operate as required.",
          rubric: "Six deterministic public checks against the exact submitted revision.",
          weight: 30,
          status: "Inconclusive",
          evidenceIds: submitted.map((item) => item.id),
          explanation:
            "A submitted snapshot is available, but no supported test run was captured. Correctness cannot be concluded from source presence alone.",
          sufficiency: "Insufficient",
          missingEvidence: ["A deterministic test run against the submitted revision."],
          candidateVisible: true,
        }
      : {
          id: "functional-correctness",
          name: "Functional Correctness",
          description: "Supported task behaviors operate as required.",
          rubric: "Six deterministic public checks against the exact submitted revision.",
          weight: 30,
          status:
            passed === 6
              ? "Demonstrated"
              : passed >= 3
                ? "Partially Demonstrated"
                : "Not Demonstrated in Available Evidence",
          supportedScore: Math.round((passed / 6) * 100),
          evidenceIds: [
            ...submitted.map((item) => item.id),
            ...latestTestEvidence.map((item) => item.id),
          ],
          explanation: `${passed} of 6 supported deterministic checks passed against ${latestTestRun.revisionId}. This describes available test evidence only.`,
          sufficiency: passed === 6 ? "Sufficient" : "Partial",
          missingEvidence:
            passed === 6
              ? []
              : latestTestRun.results
                  .filter((result) => result.status !== "passed")
                  .map((result) => `Passing evidence for ${result.name}.`),
          candidateVisible: true,
        };

  const quality: CriterionFinding = submitted.length
    ? {
        id: "code-quality",
        name: "Code Quality and Maintainability",
        description: "The submitted structure is readable and separates responsibilities.",
        rubric:
          "Deterministic source indicators: named utility functions, UI/state separation, and available final snapshot.",
        weight: 20,
        status: structuredCode
          ? "Partially Demonstrated"
          : "Not Demonstrated in Available Evidence",
        supportedScore: structuredCode ? 70 : 35,
        evidenceIds: submitted.map((item) => item.id),
        explanation: structuredCode
          ? "The submitted snapshot contains named task utilities and separates task transformations from UI state. The rule-based evaluator cannot assess broader design judgment."
          : "The submitted snapshot is available, but the expected source-structure indicators were not detected.",
        sufficiency: "Partial",
        missingEvidence: [
          "Human review of readability, abstractions, and maintainability trade-offs.",
        ],
        candidateVisible: true,
      }
    : {
        id: "code-quality",
        name: "Code Quality and Maintainability",
        description: "The submitted structure is readable and separates responsibilities.",
        rubric: "Review of the submitted source snapshot.",
        weight: 20,
        status: "Inconclusive",
        evidenceIds: [],
        explanation: "No submitted code snapshot is available.",
        sufficiency: "Insufficient",
        missingEvidence: ["Submitted source snapshot."],
        candidateVisible: true,
      };

  const testing: CriterionFinding = latestTestRun
    ? {
        id: "testing-debugging",
        name: "Testing and Debugging",
        description: "The available process includes test execution and response to diagnostics.",
        rubric: "Captured revision-linked test runs, diagnostics, and save/test iteration.",
        weight: 20,
        status: testRuns >= 2 && saved >= 1 ? "Partially Demonstrated" : "Partially Demonstrated",
        supportedScore: Math.min(85, 45 + testRuns * 10 + saved * 5),
        evidenceIds: evidence
          .filter(
            (item) =>
              item.type === "test_result" ||
              (item.type === "file_event" && item.title === "workspace saved"),
          )
          .map((item) => item.id),
        explanation: `${testRuns} deterministic test run${
          testRuns === 1 ? " was" : "s were"
        } captured with revision-linked diagnostics. Event records show actions, not the candidate's intent or independent understanding.`,
        sufficiency: testRuns >= 2 ? "Sufficient" : "Partial",
        missingEvidence:
          testRuns >= 2 ? [] : ["An additional test-and-revision cycle after diagnostics."],
        candidateVisible: true,
      }
    : {
        id: "testing-debugging",
        name: "Testing and Debugging",
        description: "The available process includes test execution and response to diagnostics.",
        rubric: "Captured revision-linked test runs and diagnostics.",
        weight: 20,
        status: "Inconclusive",
        evidenceIds: [],
        explanation: "No supported test run was captured.",
        sufficiency: "Insufficient",
        missingEvidence: ["A captured supported test run."],
        candidateVisible: true,
      };

  const problemSolving: CriterionFinding =
    snapshots.length > 1 && codeChanged > 0
      ? {
          id: "problem-solving",
          name: "Problem-Solving Evidence",
          description:
            "The available process shows iterative work connected to revisions and checks.",
          rubric: "Multiple snapshots plus actual edit, save, run, or test events.",
          weight: 15,
          status: "Partially Demonstrated",
          supportedScore: Math.min(
            80,
            40 + Math.min(20, snapshots.length * 5) + Math.min(20, codeChanged * 5),
          ),
          evidenceIds: [
            ...snapshots.map((item) => item.id),
            ...fileEvents.slice(-8).map((item) => item.id),
          ],
          explanation: `${snapshots.length} code snapshots and ${codeChanged} recorded change event${
            codeChanged === 1 ? "" : "s"
          } show an iterative workflow. These records do not prove reasoning quality or authorship.`,
          sufficiency: "Partial",
          missingEvidence: [
            "A candidate-authored explanation of the chosen approach and trade-offs.",
          ],
          candidateVisible: true,
        }
      : {
          id: "problem-solving",
          name: "Problem-Solving Evidence",
          description:
            "The available process shows iterative work connected to revisions and checks.",
          rubric: "Multiple snapshots plus actual edit, save, run, or test events.",
          weight: 15,
          status: "Inconclusive",
          evidenceIds: snapshots.map((item) => item.id),
          explanation:
            "The available process record does not contain enough revision-linked iteration to support a problem-solving finding.",
          sufficiency: "Insufficient",
          missingEvidence: [
            "Multiple saved revisions.",
            "A candidate-authored explanation of approach.",
          ],
          candidateVisible: true,
        };

  const appliedSuggestion = session.activity.some(
    (event) =>
      event.type === "code_changed" && event.detail.includes("applied demo coach suggestion"),
  );
  const ai: CriterionFinding = candidatePrompts.length
    ? {
        id: "ai-collaboration",
        name: "AI Collaboration and Code Verification",
        description:
          "Captured AI interactions are reviewed and connected to verification activity.",
        rubric:
          "Candidate prompts, available coach responses, explicit suggestion application, and subsequent supported checks.",
        weight: 15,
        status: appliedSuggestion && latestTestRun ? "Partially Demonstrated" : "Inconclusive",
        supportedScore: appliedSuggestion && latestTestRun ? 65 : undefined,
        evidenceIds: [
          ...candidatePrompts.map((item) => item.id),
          ...coachResponses.map((item) => item.id),
          ...(appliedSuggestion
            ? fileEvents
                .filter((item) => item.summary.includes("applied demo coach suggestion"))
                .map((item) => item.id)
            : []),
          ...(appliedSuggestion ? latestTestEvidence.map((item) => item.id) : []),
        ],
        explanation:
          appliedSuggestion && latestTestRun
            ? "A candidate prompt, explicit suggestion application, and later supported test run were captured. This supports a limited collaboration finding but does not prove independent understanding."
            : "AI Coach prompts were captured, but the available records do not establish that a suggestion was explicitly applied and verified.",
        sufficiency: appliedSuggestion && latestTestRun ? "Partial" : "Insufficient",
        missingEvidence:
          appliedSuggestion && latestTestRun
            ? ["Candidate explanation of why the applied change was correct."]
            : [
                "An explicit applied suggestion linked to subsequent verification.",
                "Candidate explanation of the resulting code.",
              ],
        candidateVisible: true,
      }
    : {
        id: "ai-collaboration",
        name: "AI Collaboration and Code Verification",
        description:
          "Captured AI interactions are reviewed and connected to verification activity.",
        rubric: "Candidate prompts, available coach responses, and linked verification actions.",
        weight: 15,
        status: "Inconclusive",
        evidenceIds: [],
        explanation:
          "No candidate-initiated AI Coach interaction was captured. This is missing evidence, not proof of weak AI collaboration.",
        sufficiency: "Insufficient",
        missingEvidence: [
          "A candidate-initiated AI Coach interaction.",
          "Verification evidence linked to an AI-assisted change.",
        ],
        candidateVisible: true,
      };

  const criteria = [functional, quality, testing, problemSolving, ai];
  const excludedCriteria = criteria
    .filter(
      (criterion) =>
        criterion.supportedScore === undefined ||
        ["Inconclusive", "Invalid Assessment Evidence"].includes(criterion.status),
    )
    .map((criterion) => criterion.id);
  const aggregateScore =
    excludedCriteria.length === 0
      ? Math.round(
          criteria.reduce(
            (sum, criterion) => sum + ((criterion.supportedScore ?? 0) * criterion.weight) / 100,
            0,
          ),
        )
      : undefined;
  const evidenceCoverage = Math.round(
    (criteria.reduce(
      (sum, criterion) =>
        sum +
        (criterion.sufficiency === "Sufficient"
          ? 1
          : criterion.sufficiency === "Partial"
            ? 0.5
            : 0),
      0,
    ) /
      criteria.length) *
      100,
  );
  const conflicts = testMismatch
    ? [
        `Latest test revision ${latestTestRun?.revisionId} does not match submitted revision ${finalRevision}.`,
      ]
    : [];
  const inconclusiveCount = criteria.filter(
    (criterion) => criterion.status === "Inconclusive",
  ).length;
  const evaluationStatus = conflicts.length
    ? "Needs Attention"
    : inconclusiveCount >= 3
      ? "Inconclusive"
      : "Ready for Review";

  return {
    id: `evaluation-${session.sessionId}-v${(previous?.version ?? 0) + 1}`,
    version: (previous?.version ?? 0) + 1,
    previousEvaluationId: previous?.id,
    candidateId: session.candidateId,
    candidateName: "Alex Morgan",
    companyId: session.companyId,
    companyName: "NovaTech Solutions",
    assignmentId: session.assignmentId,
    assessmentId: session.assessmentId,
    assessmentTitle: "Frontend Developer Coding Challenge",
    taskTitle: "Build a Team Task Manager",
    sessionId: session.sessionId,
    submissionRevisionId: finalRevision,
    submissionTimestamp: session.submittedAt,
    rubricVersion: customRubrics?.length
      ? `${EVALUATION_RUBRIC_VERSION}-custom-${customRubrics.length}`
      : EVALUATION_RUBRIC_VERSION,
    evaluatorVersion: EVALUATOR_VERSION,
    evaluatorMethod: "deterministic_rule_based_demo",
    evaluatedAt: new Date().toISOString(),
    evidence,
    criteria,
    evidenceCoverage,
    aggregateScore,
    excludedCriteria,
    evaluationStatus,
    limitations: [
      "Evaluation is deterministic and rule-based; no external AI evaluation model was used.",
      "Source activity cannot establish independent authorship, intent, or understanding.",
      "The supported runner analyzes known task patterns and does not execute arbitrary submitted code.",
      "Browser-local records are not production-grade evidence storage or authorization.",
    ],
    conflicts,
    reviewerStatus: "Pending",
    internalReviewerNotes: "",
    reviewEvents: [],
    candidateFeedbackAvailable: true,
  };
}

export function effectiveCriterionStatus(evaluation: EvaluationRecord, criterionId: string) {
  return (
    [...evaluation.reviewEvents]
      .reverse()
      .find(
        (event) =>
          event.criterionId === criterionId &&
          (event.action === "overridden" || event.action === "accepted"),
      )?.newStatus ?? evaluation.criteria.find((criterion) => criterion.id === criterionId)?.status
  );
}
