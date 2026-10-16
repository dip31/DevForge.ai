import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const state = vi.hoisted(() => ({
  userId: "user-1",
  first: {} as Record<string, any>,
  list: {} as Record<string, any[]>,
  rows: {} as Record<string, any[]>,
  count: {} as Record<string, number>,
}));

vi.mock("../services/database", async () => {
  const queryTables = [
    "assessmentSessions",
    "candidateAssignments",
    "organizationMemberships",
    "workspaceRevisions",
    "sessionFiles",
    "evidenceRecords",
    "activityEvents",
    "evaluations",
    "evaluationCriteria",
    "candidateFeedback",
    "reviewerNotes",
    "reviewerDecisions",
    "reviewQueue",
    "practiceTasks",
    "practiceSessions",
    "practiceAllowances",
    "usageLedger",
  ];

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
      offset: () => chain,
      then: (resolve: any, reject: any) => promise.then(resolve, reject),
      catch: (reject: any) => promise.catch(reject),
    };
    return chain;
  };

  const query: Record<string, any> = {};
  for (const table of queryTables) {
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
      select: vi.fn((fields: any) => ({
        from: (table: any) => {
          const name = nameByTable.get(table);
          const rows = name ? (state.rows[name] ?? []) : [];
          if (fields && typeof fields === "object" && "count" in fields) {
            return makeChain([{ count: name ? (state.count[name] ?? rows.length) : 0 }]);
          }
          return makeChain(rows);
        },
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((values: any) => {
          const name = nameByTable.get(table);
          const defaults =
            name === "practiceAllowances"
              ? {
                  freeAttemptsUsed: 0,
                  freeAttemptsLimit: 3,
                  paidAttemptsPurchased: 0,
                  paidAttemptsUsed: 0,
                }
              : {};
          return asResult({ ...defaults, ...values });
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: any) => ({ where: vi.fn(() => asResult(values)) })),
      })),
      delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
    },
    closeDatabase: vi.fn(),
  };
});

import { workspaceRoutes } from "./workspace";
import { sessionEvidenceRoutes, evidenceRoutes } from "./evidence";
import { evaluationRoutes } from "./evaluations";
import { reviewQueueRoutes } from "./reviewQueue";
import { practiceRoutes } from "./practice";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.addHook("preHandler", async (request) => {
    (request as any).user = { id: state.userId };
  });
  await app.register(workspaceRoutes, { prefix: "/api/v1/sessions" });
  await app.register(sessionEvidenceRoutes, { prefix: "/api/v1/sessions" });
  await app.register(evidenceRoutes, { prefix: "/api/v1/evidence" });
  await app.register(evaluationRoutes, { prefix: "/api/v1/evaluations" });
  await app.register(reviewQueueRoutes, { prefix: "/api/v1/review-queue" });
  await app.register(practiceRoutes, { prefix: "/api/v1/practice" });
  await app.ready();
});

afterAll(() => app.close());

beforeEach(() => {
  state.userId = "user-1";
  state.first = {};
  state.list = {};
  state.rows = {};
  state.count = {};
});

function ownedSession() {
  state.first.assessmentSessions = { id: "sess-1", assignmentId: "asg-1" };
  state.first.candidateAssignments = {
    id: "asg-1",
    candidateId: "user-1",
    organizationId: "org-1",
  };
}

describe("route registration", () => {
  it("registers practice, evaluations, review-queue and session routes", async () => {
    state.list.organizationMemberships = [];
    const practice = await app.inject({ method: "GET", url: "/api/v1/practice/tasks" });
    expect(practice.statusCode).toBe(200);

    const queue = await app.inject({ method: "GET", url: "/api/v1/review-queue" });
    expect(queue.statusCode).toBe(200);

    const evaluations = await app.inject({ method: "GET", url: "/api/v1/evaluations" });
    expect(evaluations.statusCode).toBe(200);
  });
});

describe("workspace routes", () => {
  it("returns 404 when the session does not exist", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/sessions/missing/revisions" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("lists revisions for the owning candidate", async () => {
    ownedSession();
    state.list.workspaceRevisions = [{ id: "rev-1", revisionNumber: 1 }];
    const res = await app.inject({ method: "GET", url: "/api/v1/sessions/sess-1/revisions" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });

  it("creates the next revision number", async () => {
    ownedSession();
    state.first.workspaceRevisions = { id: "rev-2", revisionNumber: 2 };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/sess-1/revisions",
      payload: { files: [{ path: "a.js", language: "javascript", content: "x" }] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.revisionNumber).toBe(3);
  });

  it("rejects a non-member non-owner with 403", async () => {
    state.first.assessmentSessions = { id: "sess-1", assignmentId: "asg-1" };
    state.first.candidateAssignments = {
      id: "asg-1",
      candidateId: "someone-else",
      organizationId: "org-1",
    };
    state.first.organizationMemberships = null;
    const res = await app.inject({ method: "GET", url: "/api/v1/sessions/sess-1/revisions" });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("creates a session file when none exists", async () => {
    ownedSession();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/sess-1/files",
      payload: { path: "src/app.js", language: "javascript", content: "hi" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.path).toBe("src/app.js");
  });

  it("updates an existing session file", async () => {
    ownedSession();
    state.first.sessionFiles = { id: "f-1", path: "src/app.js", isReadOnly: false };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/sess-1/files",
      payload: { path: "src/app.js", language: "javascript", content: "updated" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 404 when deleting a missing file", async () => {
    ownedSession();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/sessions/sess-1/files/${encodeURIComponent("missing.js")}`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("soft-deletes an existing file", async () => {
    ownedSession();
    state.first.sessionFiles = { id: "f-1", path: "src/app.js" };
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/sessions/sess-1/files/${encodeURIComponent("src/app.js")}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe("File deleted");
  });
});

describe("evidence routes", () => {
  it("returns paginated evidence for the owning candidate", async () => {
    ownedSession();
    state.rows.evidenceRecords = [{ id: "ev-1" }, { id: "ev-2" }];
    state.count.evidenceRecords = 2;
    const res = await app.inject({ method: "GET", url: "/api/v1/sessions/sess-1/evidence" });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.totalPages).toBe(1);
  });

  it("returns paginated activity for the owning candidate", async () => {
    ownedSession();
    state.rows.activityEvents = [{ id: "act-1" }];
    const res = await app.inject({ method: "GET", url: "/api/v1/sessions/sess-1/activity" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items).toHaveLength(1);
  });

  it("returns 404 for a missing evidence record", async () => {
    state.first.evidenceRecords = null;
    const res = await app.inject({ method: "GET", url: "/api/v1/evidence/missing" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when evidence belongs to an inaccessible session", async () => {
    state.first.evidenceRecords = { id: "ev-1", sessionId: "sess-1" };
    state.first.assessmentSessions = { id: "sess-1", assignmentId: "asg-1" };
    state.first.candidateAssignments = {
      id: "asg-1",
      candidateId: "other",
      organizationId: "org-1",
    };
    state.first.organizationMemberships = null;
    const res = await app.inject({ method: "GET", url: "/api/v1/evidence/ev-1" });
    expect(res.statusCode).toBe(403);
  });
});

describe("practice routes", () => {
  it("returns a paginated task catalog", async () => {
    state.rows.practiceTasks = [{ id: "task-1", title: "T", isActive: true }];
    const res = await app.inject({ method: "GET", url: "/api/v1/practice/tasks" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items).toHaveLength(1);
  });

  it("returns 404 for a missing task", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/practice/tasks/missing" });
    expect(res.statusCode).toBe(404);
  });

  it("returns default allowance when none exists", async () => {
    state.first.practiceAllowances = null;
    const res = await app.inject({ method: "GET", url: "/api/v1/practice/allowance" });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.freeAttemptsLimit).toBe(3);
    expect(body.totalRemainingAttempts).toBe(3);
    expect(body.canStartFreePractice).toBe(true);
  });

  it("rejects starting a session when no attempts remain", async () => {
    state.first.practiceTasks = { id: "task-1", title: "T", durationMinutes: 30, isActive: true };
    state.first.practiceAllowances = {
      id: "alw-1",
      freeAttemptsUsed: 3,
      freeAttemptsLimit: 3,
      paidAttemptsPurchased: 0,
      paidAttemptsUsed: 0,
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/practice/sessions/start",
      payload: { taskId: "11111111-1111-1111-1111-111111111111" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("starts a practice session and consumes a free attempt", async () => {
    state.first.practiceTasks = { id: "task-1", title: "T", durationMinutes: 30, isActive: true };
    state.first.practiceAllowances = {
      id: "alw-1",
      freeAttemptsUsed: 0,
      freeAttemptsLimit: 3,
      paidAttemptsPurchased: 0,
      paidAttemptsUsed: 0,
    };
    state.count.practiceSessions = 0;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/practice/sessions/start",
      payload: { taskId: "11111111-1111-1111-1111-111111111111" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json().data;
    expect(body.status).toBe("in_progress");
    expect(body.attemptNumber).toBe(1);
    expect(body.timeRemainingSeconds).toBe(1800);
  });

  it("returns 404 when a practice session is not owned by the caller", async () => {
    state.first.practiceSessions = null;
    const res = await app.inject({ method: "GET", url: "/api/v1/practice/sessions/missing" });
    expect(res.statusCode).toBe(404);
  });
});

describe("evaluation routes", () => {
  it("lists only the caller's own evaluations when they have no organizations", async () => {
    state.list.organizationMemberships = [];
    state.rows.evaluations = [{ id: "eval-1", candidateId: "user-1" }];
    const res = await app.inject({ method: "GET", url: "/api/v1/evaluations" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items).toHaveLength(1);
  });

  it("returns 403 when filtering by an organization the caller does not belong to", async () => {
    state.list.organizationMemberships = [];
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/evaluations?organizationId=org-x",
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for a missing evaluation", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/evaluations/missing" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when the caller is neither candidate nor member", async () => {
    state.first.evaluations = { id: "eval-1", candidateId: "other", organizationId: "org-1" };
    state.list.organizationMemberships = [];
    const res = await app.inject({ method: "GET", url: "/api/v1/evaluations/eval-1" });
    expect(res.statusCode).toBe(403);
  });

  it("hides feedback from the candidate until released", async () => {
    state.first.evaluations = { id: "eval-1", candidateId: "user-1", organizationId: "org-1" };
    state.list.organizationMemberships = [];
    state.first.candidateFeedback = { id: "fb-1", isAvailable: false };
    const res = await app.inject({ method: "GET", url: "/api/v1/evaluations/eval-1/feedback" });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("rejects releasing feedback for a plain member", async () => {
    state.first.evaluations = { id: "eval-1", candidateId: "other", organizationId: "org-1" };
    state.list.organizationMemberships = [{ organizationId: "org-1" }];
    state.first.organizationMemberships = { organizationId: "org-1", role: "member" };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/evaluations/eval-1/release-feedback",
    });
    expect(res.statusCode).toBe(403);
  });

  it("releases feedback for an admin", async () => {
    state.first.evaluations = { id: "eval-1", candidateId: "other", organizationId: "org-1" };
    state.list.organizationMemberships = [{ organizationId: "org-1" }];
    state.first.organizationMemberships = { organizationId: "org-1", role: "admin" };
    state.first.candidateFeedback = null;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/evaluations/eval-1/release-feedback",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe("Feedback released");
  });

  it("rejects reviewer notes from a non-member", async () => {
    state.first.evaluations = { id: "eval-1", candidateId: "user-1", organizationId: "org-1" };
    state.list.organizationMemberships = [];
    state.first.organizationMemberships = null;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/evaluations/eval-1/reviewer-notes",
      payload: { note: "looks good" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("accepts a reviewer decision from an admin", async () => {
    state.first.evaluations = {
      id: "eval-1",
      candidateId: "other",
      organizationId: "org-1",
      internalReviewerNotes: null,
    };
    state.list.organizationMemberships = [{ organizationId: "org-1" }];
    state.first.organizationMemberships = { organizationId: "org-1", role: "admin" };
    state.first.reviewerDecisions = null;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/evaluations/eval-1/reviewer-decisions",
      payload: { overallOutcome: "pass", isFinal: true },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.overallOutcome).toBe("pass");
  });
});

describe("review queue routes", () => {
  it("returns an empty page when the caller has no organizations", async () => {
    state.list.organizationMemberships = [];
    const res = await app.inject({ method: "GET", url: "/api/v1/review-queue" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items).toEqual([]);
  });

  it("lists queue items for a member organization", async () => {
    state.list.organizationMemberships = [{ organizationId: "org-1" }];
    state.rows.reviewQueue = [{ id: "rq-1", organizationId: "org-1" }];
    const res = await app.inject({ method: "GET", url: "/api/v1/review-queue" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items).toHaveLength(1);
  });

  it("returns 404 for a missing queue item", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/review-queue/missing" });
    expect(res.statusCode).toBe(404);
  });

  it("rejects assignment from a plain member", async () => {
    state.first.reviewQueue = { id: "rq-1", organizationId: "org-1", status: "ready_for_review" };
    state.first.organizationMemberships = { organizationId: "org-1", role: "member" };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/review-queue/rq-1/assign",
      payload: { reviewerId: "22222222-2222-2222-2222-222222222222" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("assigns a reviewer for an admin", async () => {
    state.first.reviewQueue = { id: "rq-1", organizationId: "org-1", status: "ready_for_review" };
    state.first.organizationMemberships = { organizationId: "org-1", role: "admin" };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/review-queue/rq-1/assign",
      payload: { reviewerId: "22222222-2222-2222-2222-222222222222" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.assignedReviewerId).toBe("22222222-2222-2222-2222-222222222222");
  });
});
