import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const state = vi.hoisted(() => ({
  userId: "user-1",
  version: null as Record<string, unknown> | null,
  assessment: null as Record<string, unknown> | null,
  membership: null as Record<string, unknown> | null,
  rubric: null as Record<string, unknown> | null,
  rubrics: [] as Record<string, unknown>[],
  file: null as Record<string, unknown> | null,
  files: [] as Record<string, unknown>[],
  testConfig: null as Record<string, unknown> | null,
  assignments: [] as Record<string, unknown>[],
}));

vi.mock("../services/database", () => ({
  db: {
    query: {
      assessmentVersions: { findFirst: vi.fn(async () => state.version) },
      assessments: { findFirst: vi.fn(async () => state.assessment) },
      organizationMemberships: { findFirst: vi.fn(async () => state.membership) },
      rubricVersions: {
        findMany: vi.fn(async () => state.rubrics),
        findFirst: vi.fn(async () => state.rubric),
      },
      assessmentFiles: {
        findMany: vi.fn(async () => state.files),
        findFirst: vi.fn(async () => state.file),
      },
      assessmentTestConfigs: { findFirst: vi.fn(async () => state.testConfig) },
      candidateAssignments: { findMany: vi.fn(async () => state.assignments) },
    },
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(async () => [{ id: "generated-id", ...values }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: "generated-id", ...values }]),
        })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
  },
  closeDatabase: vi.fn(),
}));

import { assessmentRoutes } from "./assessments";
import { versionResourceRoutes } from "./versionResources";
import { rubricRoutes } from "./rubrics";
import { assessmentFileRoutes } from "./assessmentFiles";
import { assignmentRoutes } from "./assignments";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.addHook("preHandler", async (request) => {
    (request as any).user = { id: state.userId };
  });
  await app.register(assessmentRoutes, { prefix: "/api/v1/assessments" });
  await app.register(versionResourceRoutes, {
    prefix: "/api/v1/assessments/versions",
  });
  await app.register(rubricRoutes, { prefix: "/api/v1/rubrics" });
  await app.register(assessmentFileRoutes, {
    prefix: "/api/v1/assessment-files",
  });
  await app.register(assignmentRoutes, { prefix: "/api/v1/assignments" });
  await app.ready();
});

afterAll(() => app.close());

beforeEach(() => {
  state.userId = "user-1";
  state.version = { id: "ver-1", assessmentId: "asm-1" };
  state.assessment = { id: "asm-1", organizationId: "org-1", isPublic: false };
  state.membership = { organizationId: "org-1", userId: "user-1", role: "admin" };
  state.rubric = null;
  state.rubrics = [];
  state.file = null;
  state.files = [];
  state.testConfig = null;
  state.assignments = [];
});

describe("route registration", () => {
  it("serves assessment routes registered with the /api/v1/assessments prefix", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/assessments/asm-1" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe("asm-1");
  });

  it("serves assignment routes registered with the /api/v1/assignments prefix", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/assignments/candidate/me",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});

describe("GET /api/v1/assessments/versions/:versionId/rubrics", () => {
  it("returns rubric versions for an organization member", async () => {
    state.rubrics = [{ id: "rub-1", version: 1, criteria: [], totalPoints: 100, isCurrent: true }];
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/assessments/versions/ver-1/rubrics",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].id).toBe("rub-1");
  });

  it("returns 404 when the assessment version does not exist", async () => {
    state.version = null;
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/assessments/versions/missing/rubrics",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("returns 403 for a user outside the organization", async () => {
    state.membership = null;
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/assessments/versions/ver-1/rubrics",
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });
});

describe("POST /api/v1/assessments/versions/:versionId/rubrics", () => {
  it("rejects members without an owner or admin role", async () => {
    state.membership = { organizationId: "org-1", userId: "user-1", role: "member" };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assessments/versions/ver-1/rubrics",
      payload: { totalPoints: 50 },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("creates the next rubric version for an admin", async () => {
    state.rubric = { id: "rub-3", assessmentVersionId: "ver-1", version: 3 };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assessments/versions/ver-1/rubrics",
      payload: { totalPoints: 50 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.version).toBe(4);
    expect(body.data.totalPoints).toBe(50);
    expect(body.data.isCurrent).toBe(true);
  });
});

describe("PATCH /api/v1/rubrics/:rubricId", () => {
  it("returns 404 when the rubric does not exist", async () => {
    state.rubric = null;
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/rubrics/missing",
      payload: { totalPoints: 50 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("updates rubric total points for an admin", async () => {
    state.rubric = { id: "rub-1", assessmentVersionId: "ver-1", version: 1 };
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/rubrics/rub-1",
      payload: { totalPoints: 50 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.totalPoints).toBe(50);
  });
});

describe("assessment version files", () => {
  it("rejects duplicate paths with 409", async () => {
    state.file = { id: "file-1", assessmentVersionId: "ver-1", path: "src/index.ts" };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assessments/versions/ver-1/files",
      payload: { path: "src/index.ts", language: "typescript", content: "" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("FILE_EXISTS");
  });

  it("creates a starter file", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assessments/versions/ver-1/files",
      payload: { path: "src/index.ts", language: "typescript", content: "console.log(1)" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.path).toBe("src/index.ts");
    expect(res.json().data.order).toBe(0);
  });

  it("deletes a starter file", async () => {
    state.file = { id: "file-1", assessmentVersionId: "ver-1", path: "src/index.ts" };
    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/assessment-files/file-1",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe("File deleted");
  });
});

describe("assessment version test config", () => {
  it("initializes a default config when none exists", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/assessments/versions/ver-1/test-config",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.assessmentVersionId).toBe("ver-1");
  });

  it("updates fields provided in the patch", async () => {
    state.testConfig = {
      id: "tc-1",
      assessmentVersionId: "ver-1",
      testCommand: "npm test",
    };
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/assessments/versions/ver-1/test-config",
      payload: { timeoutSeconds: 60 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.timeoutSeconds).toBe(60);
  });
});
