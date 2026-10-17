import type {
  AssessmentSession,
  TestResult,
  TestRunRecord,
  ProofLoopChallenge,
} from "../data";
import {
  submissionsApi,
  proofLoopApi,
  type SubmissionResponse,
  type ServerChallenge,
} from "./api-endpoints";
import type { CreateSubmissionRequest } from "@contracts/proofloop";

export type SubmissionFilePayload = CreateSubmissionRequest["files"][number];

type SubmissionsClient = Pick<typeof submissionsApi, "create">;

/** Map the local workspace files onto the submission contract payload. */
export function buildSubmissionFiles(session: AssessmentSession): SubmissionFilePayload[] {
  return session.files
    .filter((file) => !file.readOnly)
    .map((file) => ({
      path: file.path,
      language: file.language || "javascript",
      content: file.content,
    }));
}

/**
 * Convert the redacted server results into a local TestRunRecord so the UI can
 * render evidence. Hidden checks arrive with their identity already stripped
 * (name "Hidden verification check N"); the pass/fail outcome is preserved.
 */
export function serverResultsToTestRun(
  response: SubmissionResponse,
  timestamp: string,
): TestRunRecord {
  const results: TestResult[] = response.results.map((result) => ({
    id: result.id,
    name: result.name,
    status: result.status === "passed" ? "passed" : "failed",
    diagnostic: result.message,
    criterion: result.criterion ?? "unmapped",
  }));
  return {
    id: `server-${response.submissionId}-v${response.submissionVersion}`,
    timestamp,
    revisionId: `server-v${response.submissionVersion}`,
    results,
  };
}

export function toProofLoopChallenge(challenge: ServerChallenge): ProofLoopChallenge {
  return {
    id: challenge.id,
    sessionId: challenge.sessionId,
    templateKey: challenge.templateKey,
    criterionId: challenge.criterionId,
    skillKey: challenge.skillKey,
    title: challenge.title,
    prompt: challenge.prompt,
    instructions: challenge.instructions,
    entryFile: challenge.entryFile,
    exportName: challenge.exportName,
    status: challenge.status,
    triggerSummary: challenge.triggerSummary,
    originalStatus: challenge.originalStatus,
    resultStatus: challenge.resultStatus ?? null,
    passedTests: challenge.passedTests ?? null,
    totalTests: challenge.totalTests ?? null,
    offeredAt: challenge.offeredAt ?? null,
    startedAt: challenge.startedAt ?? null,
    submittedAt: challenge.submittedAt ?? null,
    completedAt: challenge.completedAt ?? null,
  };
}

/** True when this session has a real backend session to which work can be sent. */
export function canSyncToServer(session: AssessmentSession): boolean {
  return typeof session.serverSessionId === "string" && session.serverSessionId.length > 0;
}

/**
 * Merge a server submission response back onto the local session: record the
 * server evaluation id, append the redacted results as a test run, and surface
 * the first offered verification challenge (if the engine produced one).
 */
export function applyServerSubmission(
  session: AssessmentSession,
  response: SubmissionResponse,
  timestamp: string,
): AssessmentSession {
  const serverRun = serverResultsToTestRun(response, timestamp);
  const challenge = response.challenges?.[0] ?? response.challenge ?? null;
  return {
    ...session,
    serverEvaluationId: response.evaluationId ?? session.serverEvaluationId,
    serverSyncPending: false,
    serverError: undefined,
    activeChallenge: challenge ? toProofLoopChallenge(challenge) : session.activeChallenge,
    originalSubmittedAt: session.originalSubmittedAt ?? session.submittedAt,
    testRuns: [
      ...session.testRuns.filter((run) => run.id !== serverRun.id),
      serverRun,
    ],
  };
}

export type SyncResult =
  | { ok: true; session: AssessmentSession }
  | { ok: false; error: string };

/**
 * Submit the completed local session to the backend as an assessment
 * submission. Only runs when a real server session id is present; failures are
 * returned (never thrown) so the UI can fall back to local evidence.
 */
export async function submitAssessmentToServer(
  session: AssessmentSession,
  client: SubmissionsClient = submissionsApi,
  timestamp: string = new Date().toISOString(),
): Promise<SyncResult> {
  if (!canSyncToServer(session)) {
    return { ok: false, error: "No server session is linked to this assessment." };
  }
  const files = buildSubmissionFiles(session);
  if (files.length === 0) {
    return { ok: false, error: "There are no editable files to submit." };
  }
  try {
    const response = await client.create(session.serverSessionId as string, {
      kind: "assessment",
      files,
      idempotencyKey: `assessment-${session.sessionId}-${session.revisions.at(-1)?.id ?? "0"}`,
    });
    return { ok: true, session: applyServerSubmission(session, response.data, timestamp) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server submission failed.";
    return { ok: false, error: message };
  }
}

export type ChallengeFollowUpInput = {
  session: AssessmentSession;
  challengeId: string;
  files: SubmissionFilePayload[];
};

export type ChallengeFollowUpResult =
  | { ok: true; session: AssessmentSession; response: SubmissionResponse }
  | { ok: false; error: string };

/**
 * Submit a verification follow-up for an active challenge. The server runs the
 * challenge's private tests and returns a redacted outcome plus the updated
 * challenge state.
 */
export async function submitChallengeFollowUp(
  input: ChallengeFollowUpInput,
  client: SubmissionsClient = submissionsApi,
  timestamp: string = new Date().toISOString(),
): Promise<ChallengeFollowUpResult> {
  const { session, challengeId, files } = input;
  if (!canSyncToServer(session)) {
    return { ok: false, error: "No server session is linked to this assessment." };
  }
  try {
    const response = await client.create(session.serverSessionId as string, {
      kind: "verification_followup",
      challengeId,
      files,
      idempotencyKey: `followup-${challengeId}-${session.revisions.at(-1)?.id ?? "0"}`,
    });
    return {
      ok: true,
      response: response.data,
      session: applyServerSubmission(session, response.data, timestamp),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Challenge submission failed.";
    return { ok: false, error: message };
  }
}

/** Refresh ProofLoop state (skills, gaps, challenges) from the backend. */
export async function loadProofLoopChallenge(
  session: AssessmentSession,
  client: Pick<typeof proofLoopApi, "getState"> = proofLoopApi,
): Promise<ProofLoopChallenge | null> {
  if (!canSyncToServer(session)) return null;
  try {
    const response = await client.getState(session.serverSessionId as string);
    const challenge = response.data.challenges[0];
    return challenge ? toProofLoopChallenge(challenge) : null;
  } catch {
    return null;
  }
}
