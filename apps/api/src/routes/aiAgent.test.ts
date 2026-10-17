import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const dbState = vi.hoisted(() => ({
  first: {} as Record<string, any>,
  list: {} as Record<string, any[]>,
}));

// In-memory workspace store shared by the mocked workspaceService functions.
const store = vi.hoisted(() => ({
  files: new Map<
    string,
    { path: string; content: string; language: string; isReadOnly: boolean }
  >(),
}));

const groqState = vi.hoisted(() => ({
  configured: true,
  queue: [] as Array<{
    content?: string | null;
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  }>,
  error: null as Error | null,
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
  const table = (name: string) => ({
    findFirst: vi.fn(async () => dbState.first[name] ?? null),
    findMany: vi.fn(async () => dbState.list[name] ?? []),
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
          { ...row, id: row.id ?? "rec-1", createdAt: new Date("2025-01-01T00:00:00.000Z") },
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
    retryAfterSeconds?: number;
    quotaType?: string;
    constructor(
      message: string,
      code: string,
      statusCode: number,
      retryAfterSeconds?: number,
      quotaType?: string,
    ) {
      super(message);
      this.name = "CoachProviderError";
      this.code = code;
      this.statusCode = statusCode;
      this.retryAfterSeconds = retryAfterSeconds;
      this.quotaType = quotaType;
    }
  }
  return {
    GROQ_PROVIDER: "groq",
    CoachProviderError,
    isGroqConfigured: () => groqState.configured,
    getGroqModel: () => "openai/gpt-oss-120b",
    requestAgentCompletion: async () => {
      // Fail only once the queued turns are consumed, so tests can model a
      // provider that succeeds for a while and then starts failing.
      if (groqState.queue.length > 0) {
        const next = groqState.queue.shift()!;
        return {
          content: next.content ?? null,
          toolCalls: next.toolCalls ?? [],
          model: "openai/gpt-oss-120b",
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        };
      }
      if (groqState.error) throw groqState.error;
      return {
        content: "done",
        toolCalls: [],
        model: "openai/gpt-oss-120b",
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      };
    },
  };
});

// Keep the pure path/diff helpers real; replace only the DB-backed functions
// with an in-memory store so the loop and apply endpoint act on real state.
vi.mock("../services/workspaceService", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, any>;
  const lang = (path: string) => actual.languageFromPath(path);
  const list = async () => [...store.files.values()].map((f) => ({ id: f.path, ...f }));
  const read = async (_sid: string, path: string) => {
    const f = store.files.get(path);
    return f ? { id: f.path, ...f } : null;
  };
  const write = async (_sid: string, path: string, content: string, opts: any = {}) => {
    const existing = store.files.get(path);
    const record = {
      path,
      content,
      language: lang(path),
      isReadOnly: opts.isReadOnly ?? existing?.isReadOnly ?? false,
    };
    store.files.set(path, record);
    return { id: path, ...record };
  };
  const remove = async (_sid: string, path: string) => store.files.delete(path);
  const search = async (_sid: string, query: string) =>
    [...store.files.values()]
      .filter((f) => f.path.includes(query) || f.content.includes(query))
      .map((f) => ({ path: f.path, preview: "" }));
  return {
    ...actual,
    listSessionFiles: list,
    readSessionFile: read,
    writeSessionFile: write,
    deleteSessionFile: remove,
    searchSessionFiles: search,
    createDbWorkspaceStore: (_sid: string) => ({
      list: () => list(),
      read: (p: string) => read(_sid, p),
      write: (p: string, c: string, o?: any) => write(_sid, p, c, o),
      remove: (p: string) => remove(_sid, p),
      search: (q: string) => search(_sid, q),
    }),
  };
});

import { aiAgentRoutes } from "./aiAgent";
import { errorHandler } from "../middleware/errorHandler";
import { CoachProviderError } from "../services/groqProvider";
import { AGENT_TOOL_DEFINITIONS } from "../services/agentTools";

const UUID = "11111111-1111-1111-1111-111111111111";
let app: FastifyInstance;

function seedOwnedSession() {
  dbState.first.assessmentSessions = {
    id: UUID,
    assignmentId: "as-1",
    status: "in_progress",
    assessmentVersionId: "ver-1",
  };
  dbState.first.candidateAssignments = {
    id: "as-1",
    candidateId: "user-1",
    organizationId: "org-x",
  };
  dbState.first.organizationMemberships = null;
  dbState.first.assessmentVersions = { id: "ver-1", instructions: "Implement summarize()." };
  dbState.list.sessionFiles = [];
  dbState.list.testResults = [];
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.addHook("preHandler", async (request) => {
    (request as any).user = { id: "user-1", role: "candidate" };
  });
  await app.register(aiAgentRoutes, { prefix: "/api/v1/sessions" });
  await app.ready();
});

afterAll(() => app.close());

beforeEach(() => {
  store.files.clear();
  groqState.configured = true;
  groqState.error = null;
  groqState.queue = [];
  seedOwnedSession();
});

describe("agent tool definitions", () => {
  it("exposes a closed, schema-typed tool set", () => {
    const names = AGENT_TOOL_DEFINITIONS.map((t) => t.function.name);
    expect(names).toContain("list_workspace_files");
    expect(names).toContain("create_workspace_file");
    expect(names).toContain("edit_workspace_file");
    expect(names).toContain("delete_workspace_file");
    expect(names).toContain("get_task_context");
  });
});

describe("POST /:sessionId/ai-agent — authorization", () => {
  it("runs a local demo session against an in-memory workspace and marks it not persisted", async () => {
    groqState.queue = [
      {
        toolCalls: [
          {
            id: "c1",
            name: "create_workspace_file",
            arguments: { path: "src/local.js", content: "export const local = true;\n" },
          },
        ],
      },
      { content: "Created src/local.js in your local workspace.", toolCalls: [] },
    ];
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/session-demo/ai-agent",
      payload: {
        prompt: "add a local file",
        context: { files: [{ path: "src/App.js", content: "export default App;" }] },
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.persisted).toBe(false);
    expect(data.operations[0].kind).toBe("create_file");
    expect(data.operations[0].status).toBe("applied");
    expect(data.operations[0].content).toContain("export const local");
  });

  it("preserves applied operations when the provider fails mid-loop", async () => {
    groqState.queue = [
      {
        toolCalls: [
          {
            id: "c1",
            name: "create_workspace_file",
            arguments: { path: "src/partial.js", content: "export const partial = 1;\n" },
          },
        ],
      },
    ];
    groqState.error = new CoachProviderError(
      "The AI provider rate limited this request (the request limit). Try again in about 30s.",
      "provider_rate_limited",
      429,
      30,
      "requests",
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/session-demo/ai-agent",
      payload: { prompt: "create src/partial.js" },
    });
    // The run did not fully succeed, but the file that was created is kept.
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.stopReason).toBe("provider_error");
    expect(data.operations).toHaveLength(1);
    expect(data.operations[0]).toMatchObject({ kind: "create_file", status: "applied" });
    expect(data.content).toMatch(/provider stopped responding/i);
  });

  it("rejects a caller who does not own the session", async () => {
    dbState.first.candidateAssignments = {
      id: "as-1",
      candidateId: "someone-else",
      organizationId: "org-x",
    };
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent`,
      payload: { prompt: "inspect my code" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("rejects a submitted (locked) session", async () => {
    dbState.first.assessmentSessions.status = "submitted";
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent`,
      payload: { prompt: "inspect my code" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("SESSION_LOCKED");
  });

  it("enforces the assessment AI policy", async () => {
    dbState.first.assessmentVersions.aiPolicy = "AI assistance is not permitted.";
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent`,
      payload: { prompt: "inspect my code" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("AI_POLICY_BLOCKED");
  });

  it("fails clearly in production when unconfigured", async () => {
    groqState.configured = false;
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sessions/${UUID}/ai-agent`,
        payload: { prompt: "inspect my code" },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe("AI_PROVIDER_UNAVAILABLE");
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

describe("POST /:sessionId/ai-agent — tool loop", () => {
  it("applies a created file through the persistence layer and reports it", async () => {
    groqState.queue = [
      {
        toolCalls: [
          {
            id: "c1",
            name: "create_workspace_file",
            arguments: { path: "src/summarize.js", content: "export function summarize(r) {}\n" },
          },
        ],
      },
      { content: "Created src/summarize.js with a stub.", toolCalls: [] },
    ];

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent`,
      payload: { prompt: "add the summarize function" },
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.provider).toBe("groq");
    expect(data.persisted).toBe(true);
    expect(data.operations).toHaveLength(1);
    expect(data.operations[0].kind).toBe("create_file");
    expect(data.operations[0].status).toBe("applied");
    expect(store.files.has("src/summarize.js")).toBe(true);
    expect(data.content).toMatch(/Created src\/summarize\.js/);
  });

  it("stages a delete as pending and does not apply it until approved", async () => {
    store.files.set("src/old.js", {
      path: "src/old.js",
      content: "old",
      language: "javascript",
      isReadOnly: false,
    });
    groqState.queue = [
      {
        toolCalls: [{ id: "d1", name: "delete_workspace_file", arguments: { path: "src/old.js" } }],
      },
      { content: "Staged deletion of src/old.js for your approval.", toolCalls: [] },
    ];

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent`,
      payload: { prompt: "delete the old file" },
    });

    expect(res.statusCode).toBe(201);
    const op = res.json().data.operations[0];
    expect(op.kind).toBe("delete_file");
    expect(op.status).toBe("pending");
    expect(op.requiresApproval).toBe(true);
    expect(store.files.has("src/old.js")).toBe(true); // not applied yet

    // Approve it.
    const apply = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent/apply`,
      payload: { operations: [op] },
    });
    expect(apply.statusCode).toBe(200);
    expect(apply.json().data.applied).toHaveLength(1);
    expect(store.files.has("src/old.js")).toBe(false);
  });

  it("does not overwrite an existing file on create", async () => {
    store.files.set("src/app.js", {
      path: "src/app.js",
      content: "a",
      language: "javascript",
      isReadOnly: false,
    });
    groqState.queue = [
      {
        toolCalls: [
          {
            id: "c1",
            name: "create_workspace_file",
            arguments: { path: "src/app.js", content: "b" },
          },
        ],
      },
      { content: "Done.", toolCalls: [] },
    ];

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent`,
      payload: { prompt: "create app.js" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.operations).toHaveLength(0);
    expect(store.files.get("src/app.js")!.content).toBe("a"); // unchanged
  });

  it("rejects a path-traversal read and reports the tool error", async () => {
    groqState.queue = [
      {
        toolCalls: [
          { id: "r1", name: "read_workspace_file", arguments: { path: "../../etc/passwd" } },
        ],
      },
      { content: "I could not read that path.", toolCalls: [] },
    ];
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent`,
      payload: { prompt: "read /etc/passwd" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.operations).toHaveLength(0);
  });

  it("handles an unknown tool without executing anything", async () => {
    groqState.queue = [
      { toolCalls: [{ id: "x1", name: "run_shell", arguments: { cmd: "rm -rf /" } }] },
      { content: "I cannot run shell commands.", toolCalls: [] },
    ];
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent`,
      payload: { prompt: "run rm -rf /" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.operations).toHaveLength(0);
  });

  it("maps a provider error to an honest status and surfaces retry-after", async () => {
    groqState.error = new CoachProviderError(
      "The AI provider rate limited this request (the request limit). Try again in about 30s.",
      "provider_rate_limited",
      429,
      30,
      "requests",
    );
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent`,
      payload: { prompt: "inspect" },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe("PROVIDER_RATE_LIMITED");
    expect(res.json().error.details.retryAfterSeconds).toBe(30);
    expect(res.json().error.details.quotaType).toBe("requests");
  });
});

describe("POST /:sessionId/ai-agent/apply — validation", () => {
  it("rejects path traversal on apply", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent/apply`,
      payload: {
        operations: [
          {
            id: "op1",
            kind: "delete_file",
            path: "../secret",
            requiresApproval: true,
            status: "pending",
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.failed).toHaveLength(1);
    expect(res.json().data.applied).toHaveLength(0);
  });

  it("rejects apply on a locked session", async () => {
    dbState.first.assessmentSessions.status = "submitted";
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${UUID}/ai-agent/apply`,
      payload: {
        operations: [
          {
            id: "op1",
            kind: "delete_file",
            path: "a.js",
            requiresApproval: true,
            status: "pending",
          },
        ],
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("SESSION_LOCKED");
  });
});
