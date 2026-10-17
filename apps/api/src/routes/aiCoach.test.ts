import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const state = vi.hoisted(() => ({
  userId: "user-1",
  role: "candidate",
  first: {} as Record<string, any>,
  list: {} as Record<string, any[]>,
}));

const groqState = vi.hoisted(() => ({
  configured: false,
  completion: {
    content: "Groq says: start with the failing filter.",
    model: "openai/gpt-oss-20b",
    promptTokens: 12,
    completionTokens: 8,
    totalTokens: 20,
  },
  error: null as Error | null,
  lastMessages: null as any,
}));

vi.mock("../services/database", () => {
  const makeChain = (rows: any[]) => {
    const promise = Promise.resolve(rows);
    const chain: any = {
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: (resolve: any, reject: any) => promise.then(resolve, reject),
      catch: (reject: any) => promise.catch(reject),
    };
    return chain;
  };

  const table = (name: keyof typeof state.first & string) => ({
    findFirst: vi.fn(async () => state.first[name] ?? null),
    findMany: vi.fn(async () => state.list[name] ?? []),
  });

  const database: any = {
    query: {
      assessmentSessions: table("assessmentSessions"),
      candidateAssignments: table("candidateAssignments"),
      organizationMemberships: table("organizationMemberships"),
      assessmentVersions: table("assessmentVersions"),
      sessionFiles: table("sessionFiles"),
      testResults: table("testResults"),
      aiInteractions: table("aiInteractions"),
    },
    select: vi.fn(() => ({ from: () => makeChain([]) })),
    insert: vi.fn(() => ({
      values: vi.fn((row: any) => ({
        returning: vi.fn(async () => [
          { ...row, id: "ai-1", createdAt: new Date("2025-01-01T00:00:00.000Z") },
        ]),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
    delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
  };

  return { db: database, closeDatabase: vi.fn() };
});

vi.mock("../services/groqProvider", async () => {
  class CoachProviderError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode: number) {
      super(message);
      this.name = "CoachProviderError";
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return {
    GROQ_PROVIDER: "groq",
    CoachProviderError,
    isGroqConfigured: () => groqState.configured,
    getGroqModel: () => "openai/gpt-oss-20b",
    requestCoachCompletion: async (messages: any) => {
      groqState.lastMessages = messages;
      if (groqState.error) throw groqState.error;
      return groqState.completion;
    },
  };
});

import { aiCoachRoutes } from "./aiCoach";
import { errorHandler } from "../middleware/errorHandler";
import { CoachProviderError } from "../services/groqProvider";

const UUID = "11111111-1111-1111-1111-111111111111";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.addHook("preHandler", async (request) => {
    (request as any).user = { id: state.userId, role: state.role };
  });
  await app.register(aiCoachRoutes, { prefix: "/api/v1/sessions" });
  await app.ready();
});

afterAll(() => app.close());

beforeEach(() => {
  state.userId = "user-1";
  state.role = "candidate";
  state.first = {
    assessmentVersions: null,
  };
  state.list = {
    sessionFiles: [],
    testResults: [],
  };
  groqState.configured = false;
  groqState.error = null;
  groqState.lastMessages = null;
});

describe("AI Coach route — deterministic preview (provider not configured)", () => {
  it("returns an unpersisted intent-aware response for a local demo session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/session-demo/ai-coach",
      payload: { action: "prompt", prompt: "make the entire theme dark" },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.persisted).toBe(false);
    expect(data.provider).toBe("local");
    expect(data.model).toBe("deterministic-v1");
    expect(data.content).toMatch(/can't change the theme/i);
    expect(data.content).not.toMatch(/one acceptance criterion at a time/i);
  });

  it("classifies a greeting without leaking debugging instructions", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/session-demo/ai-coach",
      payload: { action: "prompt", prompt: "hiii" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.content).toMatch(/hi!/i);
  });

  it("serves the owning candidate and persists the deterministic response", async () => {
    state.first.assessmentSessions = { id: UUID, assignmentId: "as-1", status: "in_progress" };
    state.first.candidateAssignments = {
      id: "as-1",
      candidateId: "user-1",
      organizationId: "org-x",
    };

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-coach`,
      payload: { action: "prompt", prompt: "hiii" },
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.persisted).toBe(true);
    expect(data.provider).toBe("local");
    expect(data.content).toMatch(/hi!/i);
  });

  it("fails clearly in production when the provider is not configured", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sessions/session-demo/ai-coach",
        payload: { action: "prompt", prompt: "hiii" },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe("AI_PROVIDER_UNAVAILABLE");
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

describe("AI Coach route — session isolation", () => {
  it("denies a caller who neither owns the session nor shares its organization", async () => {
    state.first.assessmentSessions = { id: UUID, assignmentId: "as-1" };
    state.first.candidateAssignments = {
      id: "as-1",
      candidateId: "other-candidate",
      organizationId: "org-x",
    };
    state.first.organizationMemberships = null;

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-coach`,
      payload: { action: "prompt", prompt: "explain this code" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("returns an empty history for local demo sessions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sessions/session-demo/ai-coach/history",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});

describe("AI Coach route — Groq provider", () => {
  beforeEach(() => {
    groqState.configured = true;
    state.first.assessmentSessions = {
      id: UUID,
      assignmentId: "as-1",
      status: "in_progress",
      assessmentVersionId: "ver-1",
    };
    state.first.candidateAssignments = {
      id: "as-1",
      candidateId: "user-1",
      organizationId: "org-x",
    };
  });

  it("routes to the model and reports the confirmed Groq provider identity", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-coach`,
      payload: { action: "prompt", prompt: "what should I do next?" },
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.persisted).toBe(true);
    expect(data.provider).toBe("groq");
    expect(data.model).toBe("openai/gpt-oss-20b");
    expect(data.content).toMatch(/Groq says/);
    expect(data.tokensUsed).toBe(20);
  });

  it("builds a system prompt that grounds the model in task context", async () => {
    state.first.assessmentVersions = { id: "ver-1", instructions: "Build a task manager." };
    state.list.sessionFiles = [
      {
        sessionId: UUID,
        path: "src/taskUtils.js",
        content: "export function filterTasks(tasks, filter) {}",
        isDeleted: false,
      },
    ];

    await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-coach`,
      payload: { action: "prompt", prompt: "hint?" },
    });

    const messages = groqState.lastMessages;
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toMatch(/Build a task manager/);
    expect(messages[0].content).toMatch(/src\/taskUtils\.js/);
    expect(messages.at(-1)).toEqual({ role: "user", content: "hint?" });
  });

  it("does not return a fabricated response when the provider errors", async () => {
    groqState.error = new CoachProviderError(
      "The AI provider is rate limiting requests. Try again shortly.",
      "provider_rate_limited",
      429,
    );

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-coach`,
      payload: { action: "prompt", prompt: "hint?" },
    });

    expect(res.statusCode).toBe(429);
    expect(res.json().success).toBe(false);
    expect(res.json().error.code).toBe("PROVIDER_RATE_LIMITED");
  });

  it("maps a provider timeout to an honest 504", async () => {
    groqState.error = new CoachProviderError("The AI provider timed out.", "provider_timeout", 504);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-coach`,
      payload: { action: "hint" },
    });

    expect(res.statusCode).toBe(504);
    expect(res.json().error.code).toBe("PROVIDER_TIMEOUT");
  });

  it("labels server-verified results and candidate-reported diagnostics separately", async () => {
    state.list.testResults = [
      {
        id: "r1",
        testName: "Filter tasks",
        status: "failed",
        error: "expected active filter",
        output: null,
        criterion: "Filter tasks by status",
        isHidden: false,
      },
    ];

    await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-coach`,
      payload: {
        action: "debug",
        context: {
          testResults: [
            { id: "client-1", name: "Local check", status: "failed", diagnostic: "local only" },
          ],
        },
      },
    });

    const system = groqState.lastMessages[0].content;
    expect(system).toMatch(/Verified test results/i);
    expect(system).toMatch(/expected active filter/);
    expect(system).toMatch(/Candidate-reported diagnostics/i);
    expect(system).toMatch(/NOT executed by the server/i);
    expect(system).toMatch(/local only/);
  });

  it("excludes hidden tests from the coach context", async () => {
    state.list.testResults = [
      {
        id: "hidden-1",
        testName: "Secret hidden test",
        status: "failed",
        error: "secret expected value",
        output: null,
        criterion: null,
        isHidden: true,
      },
    ];

    await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-coach`,
      payload: { action: "prompt", prompt: "which tests fail?" },
    });

    expect(groqState.lastMessages[0].content).not.toMatch(/Secret hidden test/);
    expect(groqState.lastMessages[0].content).not.toMatch(/secret expected value/);
  });
});

describe("AI Coach route — AI policy enforcement", () => {
  it("rejects the request when the assessment policy disables AI assistance", async () => {
    state.first.assessmentSessions = {
      id: UUID,
      assignmentId: "as-1",
      status: "in_progress",
      assessmentVersionId: "ver-1",
    };
    state.first.candidateAssignments = {
      id: "as-1",
      candidateId: "user-1",
      organizationId: "org-x",
    };
    state.first.assessmentVersions = {
      id: "ver-1",
      aiPolicy: "AI assistance is not permitted for this assessment.",
    };
    groqState.configured = true;

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-coach`,
      payload: { action: "prompt", prompt: "hint?" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("AI_POLICY_BLOCKED");
  });

  it("allows a policy that only restricts full-solution generation", async () => {
    state.first.assessmentSessions = {
      id: UUID,
      assignmentId: "as-1",
      status: "in_progress",
      assessmentVersionId: "ver-1",
    };
    state.first.candidateAssignments = {
      id: "as-1",
      candidateId: "user-1",
      organizationId: "org-x",
    };
    state.first.assessmentVersions = {
      id: "ver-1",
      aiPolicy:
        "Rule-based assistance is available for syntax and test diagnostics. Direct full-solution generation is not supported.",
    };
    groqState.configured = true;

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-coach`,
      payload: { action: "prompt", prompt: "hint?" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.provider).toBe("groq");
  });
});
