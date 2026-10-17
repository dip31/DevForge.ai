import { describe, it, expect, vi } from "vitest";
import {
  buildSubmissionFiles,
  serverResultsToTestRun,
  toProofLoopChallenge,
  canSyncToServer,
  applyServerSubmission,
  submitAssessmentToServer,
  submitChallengeFollowUp,
  loadProofLoopChallenge,
} from "./serverAdapter";
import type { AssessmentSession } from "../data";
import type { SubmissionResponse, ServerChallenge } from "./api-endpoints";
import type { CreateSubmissionRequest, ProofLoopSessionState } from "@contracts/proofloop";

function makeSession(overrides: Partial<AssessmentSession> = {}): AssessmentSession {
  return {
    sessionId: "session-1",
    candidateId: "alex-morgan",
    companyId: "company-1",
    assignmentId: "assignment-1",
    assessmentId: "binary-search",
    startedAt: "2026-01-01T00:00:00.000Z",
    durationMinutes: 30,
    currentFile: "src/search.js",
    files: [
      { path: "src/search.js", language: "javascript", content: "export function binarySearch(){}" },
      { path: "README.md", language: "markdown", content: "readme", readOnly: true },
    ],
    savedFiles: [],
    unsaved: false,
    revisions: [{ id: "revision-3", timestamp: "2026-01-01T00:30:00.000Z", files: [] }],
    coachMessages: [],
    runHistory: [],
    testRuns: [],
    activity: [],
    submittedAt: "2026-01-01T00:30:00.000Z",
    ...overrides,
  };
}

const serverChallenge: ServerChallenge = {
  id: "challenge-1",
  sessionId: "server-session-1",
  templateKey: "binary-search-duplicate-handling",
  criterionId: "edge-case-handling",
  skillKey: "edge-case-handling",
  title: "Duplicate and boundary handling",
  prompt: "Handle duplicates.",
  instructions: "Edit src/search.js only.",
  entryFile: "src/search.js",
  exportName: "binarySearch",
  status: "offered",
  triggerSummary: "Failed duplicate check.",
  originalStatus: "not_demonstrated_in_available_evidence",
  resultStatus: null,
  passedTests: 2,
  totalTests: 6,
  offeredAt: "2026-01-01T00:31:00.000Z",
};

const submissionResponse: SubmissionResponse = {
  kind: "assessment",
  submissionId: "submission-1",
  submissionVersion: 1,
  reused: false,
  evaluationId: "evaluation-1",
  results: [
    {
      id: "basic-found",
      name: "Finds a middle value",
      suite: "public",
      criterion: "search-correctness",
      status: "passed",
      hidden: false,
      durationMs: 1,
      message: "Passed",
    },
    {
      id: "hidden-1",
      name: "Hidden verification check 1",
      suite: "verification",
      criterion: "edge-case-handling",
      status: "failed",
      hidden: true,
      durationMs: 1,
      message: "A hidden edge-case check did not pass.",
    },
  ],
  challenges: [serverChallenge],
};

describe("buildSubmissionFiles", () => {
  it("excludes read-only files and preserves language", () => {
    const files = buildSubmissionFiles(makeSession());
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: "src/search.js", language: "javascript" });
  });
});

describe("serverResultsToTestRun", () => {
  it("maps server statuses onto local test result statuses", () => {
    const run = serverResultsToTestRun(submissionResponse, "2026-01-01T00:31:00.000Z");
    expect(run.results).toHaveLength(2);
    expect(run.results[0].status).toBe("passed");
    expect(run.results[1].status).toBe("failed");
    expect(run.results[1].name).toBe("Hidden verification check 1");
    expect(run.results[1].criterion).toBe("edge-case-handling");
  });
});

describe("toProofLoopChallenge", () => {
  it("maps the server challenge onto the local shape", () => {
    expect(toProofLoopChallenge(serverChallenge)).toMatchObject({
      id: "challenge-1",
      status: "offered",
      criterionId: "edge-case-handling",
      passedTests: 2,
      totalTests: 6,
    });
  });
});

describe("canSyncToServer", () => {
  it("is false without a server session id", () => {
    expect(canSyncToServer(makeSession())).toBe(false);
  });
  it("is true with a server session id", () => {
    expect(canSyncToServer(makeSession({ serverSessionId: "srv-1" }))).toBe(true);
  });
});

describe("applyServerSubmission", () => {
  it("records the evaluation id, appends results and surfaces the challenge", () => {
    const next = applyServerSubmission(
      makeSession({ serverSessionId: "srv-1", serverSyncPending: true }),
      submissionResponse,
      "2026-01-01T00:31:00.000Z",
    );
    expect(next.serverEvaluationId).toBe("evaluation-1");
    expect(next.serverSyncPending).toBe(false);
    expect(next.serverError).toBeUndefined();
    expect(next.activeChallenge?.id).toBe("challenge-1");
    expect(next.originalSubmittedAt).toBe("2026-01-01T00:30:00.000Z");
    expect(next.testRuns).toHaveLength(1);
  });
});

describe("submitAssessmentToServer", () => {
  it("refuses to submit without a server session", async () => {
    const client = {
      create: vi.fn((_sessionId: string, _data: CreateSubmissionRequest) =>
        Promise.resolve({ success: true as const, data: submissionResponse }),
      ),
    };
    const result = await submitAssessmentToServer(makeSession(), client);
    expect(result.ok).toBe(false);
    expect(client.create).not.toHaveBeenCalled();
  });

  it("submits editable files and merges the response", async () => {
    const create = vi.fn((_sessionId: string, _data: CreateSubmissionRequest) =>
      Promise.resolve({ success: true as const, data: submissionResponse }),
    );
    const result = await submitAssessmentToServer(
      makeSession({ serverSessionId: "srv-1" }),
      { create },
    );
    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    const payload = create.mock.calls[0][1];
    expect(payload.kind).toBe("assessment");
    expect(payload.files).toHaveLength(1);
    expect(payload.idempotencyKey).toContain("revision-3");
    if (result.ok) expect(result.session.serverEvaluationId).toBe("evaluation-1");
  });

  it("returns a soft error when the server rejects the submission", async () => {
    const create = vi.fn((_sessionId: string, _data: CreateSubmissionRequest) =>
      Promise.reject(new Error("network down")),
    );
    const result = await submitAssessmentToServer(
      makeSession({ serverSessionId: "srv-1" }),
      { create },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("network down");
  });
});

describe("submitChallengeFollowUp", () => {
  it("sends a verification follow-up with the challenge id", async () => {
    const followUpResponse: SubmissionResponse = {
      ...submissionResponse,
      kind: "verification_followup",
      evaluationId: undefined,
      challenge: { ...serverChallenge, status: "verified", resultStatus: "demonstrated" },
      challenges: undefined,
    };
    const create = vi.fn((_sessionId: string, _data: CreateSubmissionRequest) =>
      Promise.resolve({ success: true as const, data: followUpResponse }),
    );
    const result = await submitChallengeFollowUp(
      {
        session: makeSession({ serverSessionId: "srv-1" }),
        challengeId: "challenge-1",
        files: [{ path: "src/search.js", language: "javascript", content: "x" }],
      },
      { create },
    );
    expect(result.ok).toBe(true);
    const payload = create.mock.calls[0][1];
    expect(payload.kind).toBe("verification_followup");
    expect(payload.challengeId).toBe("challenge-1");
    if (result.ok) {
      expect(result.session.activeChallenge?.status).toBe("verified");
      expect(result.session.activeChallenge?.resultStatus).toBe("demonstrated");
    }
  });
});

describe("loadProofLoopChallenge", () => {
  it("returns null when there is no server session", async () => {
    const result = await loadProofLoopChallenge(makeSession(), { getState: vi.fn() });
    expect(result).toBeNull();
  });

  it("returns the first challenge from server state", async () => {
    const getState = vi.fn((_sessionId: string) =>
      Promise.resolve({
        success: true as const,
        data: { sessionId: "srv-1", skills: [], gaps: [], challenges: [serverChallenge] },
      } as unknown as { success: true; data: ProofLoopSessionState }),
    );
    const result = await loadProofLoopChallenge(makeSession({ serverSessionId: "srv-1" }), {
      getState,
    });
    expect(result?.id).toBe("challenge-1");
  });
});
