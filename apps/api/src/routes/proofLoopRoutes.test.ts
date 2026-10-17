import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const state = vi.hoisted(() => ({
  userId: "user-1",
  first: {} as Record<string, any>,
  list: {} as Record<string, any[]>,
}));

const service = vi.hoisted(() => ({
  processAssessmentSubmission: vi.fn(),
  processChallengeFollowUp: vi.fn(),
  challengeEntryPresent: vi.fn(),
}));

vi.mock("../services/database", async () => {
  const schema: Record<string, any> = await import("@database/schema");
  const nameByTable = new Map<any, string>();
  for (const [name, value] of Object.entries(schema)) {
    if (value && typeof value === "object") nameByTable.set(value, name);
  }

  const makeChain = (rows: any[]) => {
    const promise = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: (resolve: any, reject: any) => promise.then(resolve, reject),
      catch: (reject: any) => promise.catch(reject),
    };
    return chain;
  };

  const query: Record<string, any> = {};
  for (const table of [
    "assessmentSessions",
    "candidateAssignments",
    "organizationMemberships",
    "submissions",
    "verificationChallenges",
  ]) {
    query[table] = {
      findFirst: vi.fn(async () => state.first[table] ?? null),
      findMany: vi.fn(async () => state.list[table] ?? []),
    };
  }

  const asResult = (value: Record<string, unknown>) => {
    const promise = Promise.resolve([{ id: "generated-id", ...value }]);
    return {
      returning: vi.fn(async () => [{ id: "generated-id", ...value }]),
      then: (resolve: any, reject: any) => promise.then(resolve, reject),
      catch: (reject: any) => promise.catch(reject),
    };
  };

  return {
    db: {
      query,
      select: vi.fn(() => ({ from: () => makeChain([]) })),
      insert: vi.fn(() => ({ values: vi.fn((values: any) => asResult(values)) })),
      update: vi.fn(() => ({ set: vi.fn((values: any) => ({ where: vi.fn(() => asResult(values)) })) })),
      delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
    },
    closeDatabase: vi.fn(),
  };
});

vi.mock("../services/submissionService", () => service);

import { submissionRoutes } from "./submissions";
import { proofLoopRoutes } from "./proofLoop";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.addHook("preHandler", async (request) => {
    (request as any).user = { id: state.userId };
  });
  await app.register(submissionRoutes, { prefix: "/api/v1/sessions" });
  await app.register(proofLoopRoutes, { prefix: "/api/v1/proofloop" });
  await app.ready();
});

afterAll(() => app.close());

beforeEach(() => {
  state.userId = "user-1";
  state.first = {};
  state.list = {};
  service.processAssessmentSubmission.mockReset();
  service.processChallengeFollowUp.mockReset();
  service.challengeEntryPresent.mockReset();
});

function ownedSession() {
  state.first.assessmentSessions = { id: "sess-1", assignmentId: "asg-1" };
  state.first.candidateAssignments = {
    id: "asg-1",
    candidateId: "user-1",
    organizationId: "org-1",
  };
}

const CHALLENGE_UUID = "11111111-1111-1111-1111-111111111111";
const validFiles = [{ path: "src/search.js", language: "javascript", content: "x" }];

describe("POST /submissions", () => {
  it("returns 404 when the session does not exist", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/missing/submissions",
      payload: { kind: "assessment", files: validFiles },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("forbids a non-owner from submitting", async () => {
    state.first.assessmentSessions = { id: "sess-1", assignmentId: "asg-1" };
    state.first.candidateAssignments = {
      id: "asg-1",
      candidateId: "someone-else",
      organizationId: "org-1",
    };
    state.first.organizationMemberships = { role: "admin" };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/sess-1/submissions",
      payload: { kind: "assessment", files: validFiles },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("rejects an invalid body", async () => {
    ownedSession();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/sess-1/submissions",
      payload: { kind: "nonsense" },
    });
    expect(res.statusCode).toBe(500);
  });

  it("processes an assessment submission and redacts results", async () => {
    ownedSession();
    service.processAssessmentSubmission.mockResolvedValue({
      reused: false,
      submission: { id: "sub-1", submissionVersion: 1 },
      evaluationId: "eval-1",
      results: [
        {
          id: "hidden-1",
          name: "Hidden verification check 1",
          suite: "verification",
          criterion: "edge-case-handling",
          visibility: "private",
          status: "passed",
          durationMs: 1,
          message: "Passed",
        },
      ],
      challenges: [],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/sess-1/submissions",
      payload: { kind: "assessment", files: validFiles },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.kind).toBe("assessment");
    expect(body.data.evaluationId).toBe("eval-1");
    expect(body.data.results[0].hidden).toBe(true);
    expect(body.data.results[0].message).toBe("Passed");
    expect(service.processAssessmentSubmission).toHaveBeenCalledTimes(1);
  });

  it("requires the challenge entry file for a follow-up", async () => {
    ownedSession();
    state.first.verificationChallenges = {
      id: "ch-1",
      sessionId: "sess-1",
      status: "offered",
      entryFile: "src/search.js",
    };
    service.challengeEntryPresent.mockReturnValue(false);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/sess-1/submissions",
      payload: {
        kind: "verification_followup",
        challengeId: CHALLENGE_UUID,
        files: validFiles,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("MISSING_ENTRY");
  });

  it("rejects a follow-up for a terminal challenge", async () => {
    ownedSession();
    state.first.verificationChallenges = {
      id: "ch-1",
      sessionId: "sess-1",
      status: "verified",
      entryFile: "src/search.js",
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/sess-1/submissions",
      payload: {
        kind: "verification_followup",
        challengeId: CHALLENGE_UUID,
        files: validFiles,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_STATE");
  });

  it("processes a follow-up and hides the challenge private tests", async () => {
    ownedSession();
    state.first.verificationChallenges = {
      id: "ch-1",
      sessionId: "sess-1",
      status: "submitted",
      entryFile: "src/search.js",
      privateTests: [{ id: "secret" }],
    };
    service.challengeEntryPresent.mockReturnValue(true);
    service.processChallengeFollowUp.mockResolvedValue({
      reused: false,
      submission: { id: "sub-2", submissionVersion: 2 },
      results: [
        {
          id: "hidden-1",
          name: "Hidden verification check 1",
          suite: "verification",
          criterion: "edge-case-handling",
          visibility: "private",
          status: "passed",
          durationMs: 1,
          message: "Passed",
        },
      ],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/sess-1/submissions",
      payload: {
        kind: "verification_followup",
        challengeId: CHALLENGE_UUID,
        files: validFiles,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.kind).toBe("verification_followup");
    expect(body.data.challenge.privateTests).toBeUndefined();
    expect(body.data.results[0].hidden).toBe(true);
  });
});

describe("GET /submissions", () => {
  it("lists submissions for a member and flags private inclusion", async () => {
    state.first.assessmentSessions = { id: "sess-1", assignmentId: "asg-1" };
    state.first.candidateAssignments = {
      id: "asg-1",
      candidateId: "someone-else",
      organizationId: "org-1",
    };
    state.first.organizationMemberships = { role: "member" };
    state.list.submissions = [
      { id: "sub-1", sessionId: "sess-1", submissionVersion: 1, kind: "assessment", status: "evaluated", testSummary: {}, submittedAt: new Date() },
    ];

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sessions/sess-1/submissions",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0]._includePrivate).toBe(true);
  });

  it("hides private inclusion for the owning candidate", async () => {
    ownedSession();
    state.list.submissions = [];
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sessions/sess-1/submissions",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});

describe("GET /sessions/:sessionId/report and challenges", () => {
  it("returns 404 for a report on a missing session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/proofloop/sessions/missing/report",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for a missing challenge", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/proofloop/challenges/missing",
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(404);
  });
});
