import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  version: null as any,
  files: [] as any[],
  results: [] as any[],
}));

vi.mock("./database", () => ({
  db: {
    query: {
      assessmentVersions: { findFirst: vi.fn(async () => state.version) },
      sessionFiles: { findMany: vi.fn(async () => state.files) },
      testResults: { findMany: vi.fn(async () => state.results) },
    },
  },
  closeDatabase: vi.fn(),
}));

import { evaluateAiPolicy, resolveCoachContext } from "./coachContext";
import type { SessionAccessSuccess } from "./sessionAccess";

const access: SessionAccessSuccess = {
  ok: true,
  session: {
    id: "sess-1",
    assignmentId: "as-1",
    candidateId: "user-1",
    assessmentVersionId: "ver-1",
    currentFile: "src/taskUtils.js",
  },
  assignment: { id: "as-1", organizationId: "org-1" },
  isOwner: true,
} as unknown as SessionAccessSuccess;

beforeEach(() => {
  state.version = null;
  state.files = [];
  state.results = [];
});

describe("evaluateAiPolicy", () => {
  it("allows an empty or null policy", () => {
    expect(evaluateAiPolicy(null).allowed).toBe(true);
    expect(evaluateAiPolicy("").allowed).toBe(true);
  });

  it("blocks clear AI prohibitions", () => {
    expect(evaluateAiPolicy("AI assistance is not permitted for this assessment.").allowed).toBe(
      false,
    );
    expect(evaluateAiPolicy("No AI may be used here.").allowed).toBe(false);
    expect(evaluateAiPolicy("The AI Coach is disabled for this task.").allowed).toBe(false);
    expect(evaluateAiPolicy("This is an AI-free assessment.").allowed).toBe(false);
  });

  it("allows policies that only limit full solutions", () => {
    const policy =
      "Rule-based assistance is available for syntax and test diagnostics. Direct full-solution generation is not supported.";
    expect(evaluateAiPolicy(policy).allowed).toBe(true);
  });
});

describe("resolveCoachContext", () => {
  it("passes through client context for a non-persisted demo session", async () => {
    const resolved = await resolveCoachContext(null, {
      currentFile: "a.js",
      files: [{ path: "a.js", content: "x" }],
    });
    expect(resolved.filesSource).toBe("client");
    expect(resolved.aiPolicy).toBeNull();
    expect(resolved.policyBlocked).toBeNull();
    expect(resolved.context.currentFile).toBe("a.js");
  });

  it("prefers server workspace files and instructions over client input", async () => {
    state.version = { id: "ver-1", instructions: "Build a task manager.", aiPolicy: null };
    state.files = [
      { sessionId: "sess-1", path: "src/taskUtils.js", content: "server file", isDeleted: false },
    ];

    const resolved = await resolveCoachContext(access, {
      files: [{ path: "src/taskUtils.js", content: "client spoofed" }],
      instructions: "client spoofed instructions",
    });

    expect(resolved.filesSource).toBe("server");
    expect(resolved.context.files).toEqual([{ path: "src/taskUtils.js", content: "server file" }]);
    expect(resolved.context.instructions).toBe("Build a task manager.");
  });

  it("keeps currentFile only when it matches a real workspace file", async () => {
    state.files = [{ sessionId: "sess-1", path: "src/App.jsx", content: "app", isDeleted: false }];

    const resolved = await resolveCoachContext(access, { currentFile: "not-real.js" });
    expect(resolved.context.currentFile).toBe("src/App.jsx");
  });

  it("maps server test results and never exposes hidden ones", async () => {
    state.files = [{ sessionId: "sess-1", path: "src/a.js", content: "x", isDeleted: false }];
    state.results = [
      {
        id: "r1",
        testName: "Filter tasks",
        status: "failed",
        error: "expected active filter",
        output: null,
        criterion: "Filter tasks",
        isHidden: false,
      },
      {
        id: "r2",
        testName: "Hidden test",
        status: "failed",
        error: "secret",
        output: null,
        criterion: null,
        isHidden: true,
      },
    ];

    const resolved = await resolveCoachContext(access, {});
    expect(resolved.context.testResults).toEqual([
      {
        id: "r1",
        name: "Filter tasks",
        status: "failed",
        diagnostic: "expected active filter",
        criterion: "Filter tasks",
      },
    ]);
    expect(resolved.reportedDiagnostics).toEqual([]);
  });

  it("flags a policy block when the version disables AI", async () => {
    state.version = {
      id: "ver-1",
      instructions: null,
      aiPolicy: "No AI assistance is allowed.",
    };

    const resolved = await resolveCoachContext(access, {});
    expect(resolved.policyBlocked).not.toBeNull();
    expect(resolved.aiPolicy).toBe("No AI assistance is allowed.");
  });
});
