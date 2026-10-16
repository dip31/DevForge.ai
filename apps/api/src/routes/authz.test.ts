import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const state = vi.hoisted(() => ({
  userId: "user-1",
  role: "recruiter",
  first: {} as Record<string, any>,
  list: {} as Record<string, any[]>,
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
      offset: () => chain,
      then: (resolve: any, reject: any) => promise.then(resolve, reject),
      catch: (reject: any) => promise.catch(reject),
    };
    return chain;
  };

  const queryTables = [
    "organizations",
    "organizationMemberships",
    "assessments",
    "assessmentVersions",
    "candidateAssignments",
    "assessmentSessions",
    "sessionFiles",
    "workspaceRevisions",
    "evidenceRecords",
    "activityEvents",
    "evaluations",
    "evaluationCriteria",
    "candidateFeedback",
    "reviewQueue",
    "practiceSessions",
    "practiceAllowances",
    "practiceTasks",
    "aiInteractions",
    "users",
  ];
  const query: Record<string, any> = {};
  for (const table of queryTables) {
    query[table] = {
      findFirst: vi.fn(async () => state.first[table] ?? null),
      findMany: vi.fn(async () => state.list[table] ?? []),
    };
  }

  const database: any = {
    query,
    select: vi.fn((fields: any) => ({
      from: (table: any) => {
        const name = nameByTable.get(table);
        if (fields && typeof fields === "object" && "count" in fields) {
          return makeChain([{ count: 0 }]);
        }
        return makeChain(name ? (state.list[name] ?? []) : []);
      },
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "generated" }]) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "generated" }]) })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
    transaction: vi.fn(async (cb: any) => cb(database)),
  };

  return { db: database, closeDatabase: vi.fn() };
});

import { sessionRoutes } from "./sessions";
import { workspaceRoutes } from "./workspace";
import { assessmentRoutes } from "./assessments";
import { membershipRoutes } from "./memberships";
import { evaluationRoutes } from "./evaluations";
import { reviewQueueRoutes } from "./reviewQueue";
import { errorHandler } from "../middleware/errorHandler";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.addHook("preHandler", async (request) => {
    (request as any).user = { id: state.userId, role: state.role };
  });
  await app.register(sessionRoutes, { prefix: "/api/v1/auth/sessions" });
  await app.register(workspaceRoutes, { prefix: "/api/v1/sessions" });
  await app.register(assessmentRoutes, { prefix: "/api/v1/assessments" });
  await app.register(membershipRoutes, { prefix: "/api/v1/organizations" });
  await app.register(evaluationRoutes, { prefix: "/api/v1/evaluations" });
  await app.register(reviewQueueRoutes, { prefix: "/api/v1/review-queue" });
  await app.ready();
});

afterAll(() => app.close());

beforeEach(() => {
  state.userId = "user-1";
  state.role = "recruiter";
  state.first = {};
  state.list = {};
});

describe("candidate isolation — sessions", () => {
  it("hides another candidate's session behind a 404", async () => {
    // The route filters by `candidateId = caller`, so a session owned by another
    // candidate is invisible to the query and the handler sees no row.
    state.first.assessmentSessions = null;

    const res = await app.inject({ method: "GET", url: "/api/v1/auth/sessions/s-1" });

    expect(res.statusCode).toBe(404);
  });

  it("returns the session to its owning candidate", async () => {
    state.first.assessmentSessions = { id: "s-1", candidateId: "user-1" };

    const res = await app.inject({ method: "GET", url: "/api/v1/auth/sessions/s-1" });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe("s-1");
  });

  it("refuses to start a session for an assignment the caller does not own", async () => {
    state.first.candidateAssignments = null;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sessions/start",
      payload: { assignmentId: "22222222-2222-2222-2222-222222222222" },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("candidate isolation — workspace", () => {
  it("denies writing files to a session the caller neither owns nor shares an org with", async () => {
    state.first.assessmentSessions = { id: "s-1", assignmentId: "as-1" };
    state.first.candidateAssignments = {
      id: "as-1",
      candidateId: "other-candidate",
      organizationId: "org-x",
    };
    state.first.organizationMemberships = null;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/s-1/files",
      payload: { path: "index.ts", language: "typescript", content: "x" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("allows the owning candidate to read workspace revisions", async () => {
    state.first.assessmentSessions = { id: "s-1", assignmentId: "as-1" };
    state.first.candidateAssignments = {
      id: "as-1",
      candidateId: "user-1",
      organizationId: "org-x",
    };
    state.list.workspaceRevisions = [{ id: "r-1", revisionNumber: 1 }];

    const res = await app.inject({ method: "GET", url: "/api/v1/sessions/s-1/revisions" });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });
});

describe("cross-organization isolation — assessments", () => {
  const orgA = "11111111-1111-1111-1111-111111111111";
  const orgB = "22222222-2222-2222-2222-222222222222";

  it("denies listing versions of another organization's assessment", async () => {
    state.first.assessments = { id: "a-1", organizationId: orgB, isPublic: false };
    state.first.organizationMemberships = null;

    const res = await app.inject({ method: "GET", url: `/api/v1/assessments/a-1/versions` });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("denies reading the current version of another organization's assessment", async () => {
    state.first.assessments = { id: "a-1", organizationId: orgB, isPublic: false };
    state.first.organizationMemberships = null;

    const res = await app.inject({ method: "GET", url: `/api/v1/assessments/a-1/current-version` });

    expect(res.statusCode).toBe(403);
  });

  it("allows a member of the owning organization to list versions", async () => {
    state.first.assessments = { id: "a-1", organizationId: orgA, isPublic: false };
    state.first.organizationMemberships = { organizationId: orgA, userId: "user-1", role: "member" };
    state.list.assessmentVersions = [{ id: "v-1", version: 1 }];

    const res = await app.inject({ method: "GET", url: `/api/v1/assessments/a-1/versions` });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });

  it("blocks a plain member from updating an assessment (admin+ only)", async () => {
    state.first.assessments = { id: "a-1", organizationId: orgA, isPublic: false };
    state.first.organizationMemberships = { organizationId: orgA, userId: "user-1", role: "member" };

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/assessments/a-1`,
      payload: { title: "renamed" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("blocks an admin from deleting an assessment (owner only)", async () => {
    state.first.assessments = { id: "a-1", organizationId: orgA, isPublic: false };
    state.first.organizationMemberships = { organizationId: orgA, userId: "user-1", role: "admin" };

    const res = await app.inject({ method: "DELETE", url: `/api/v1/assessments/a-1` });

    expect(res.statusCode).toBe(403);
  });
});

describe("cross-organization isolation — members and review queue", () => {
  it("denies listing members of an organization the caller does not belong to", async () => {
    state.first.organizationMemberships = null;

    const res = await app.inject({ method: "GET", url: "/api/v1/organizations/org-x/members" });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("denies scoping the review queue to another organization", async () => {
    state.list.organizationMemberships = [{ organizationId: "org-1", role: "owner" }];

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/review-queue?organizationId=org-2",
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("cross-organization isolation — evaluations", () => {
  it("denies reading an evaluation from another organization", async () => {
    state.first.evaluations = { id: "e-1", organizationId: "org-x", candidateId: "other" };
    state.list.organizationMemberships = [];

    const res = await app.inject({ method: "GET", url: "/api/v1/evaluations/e-1" });

    expect(res.statusCode).toBe(403);
  });

  it("hides unreleased feedback from the candidate", async () => {
    state.first.evaluations = { id: "e-1", organizationId: "org-x", candidateId: "user-1" };
    state.list.organizationMemberships = [];
    state.first.candidateFeedback = { id: "f-1", evaluationId: "e-1", isAvailable: false };

    const res = await app.inject({ method: "GET", url: "/api/v1/evaluations/e-1/feedback" });

    expect(res.statusCode).toBe(403);
  });
});
