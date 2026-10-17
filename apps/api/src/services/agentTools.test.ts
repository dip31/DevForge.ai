import { describe, it, expect } from "vitest";
import { executeAgentTool, type AgentTaskContext } from "./agentTools";
import { MemoryWorkspaceStore } from "./workspaceService";
import type { AgentToolCall, AgentToolName } from "@contracts/agent";

// These tests exercise the real tool dispatcher against a real (in-memory)
// workspace store. They prove file creation/editing/deletion works independently
// of Groq: no provider, no network, no agent loop — just the tools.

const emptyContext: AgentTaskContext = { instructions: null, requirements: [], aiPolicy: null };

function call(name: AgentToolName, args: Record<string, unknown> = {}): AgentToolCall {
  return { id: `call_${name}`, name, arguments: args };
}

function makeStore(seed: Array<{ path: string; content: string }> = []) {
  return new MemoryWorkspaceStore(seed);
}

describe("executeAgentTool — reads", () => {
  it("lists files and synthesizes parent folders", async () => {
    const store = makeStore([{ path: "src/app/main.ts", content: "export const x = 1;\n" }]);
    const result = await executeAgentTool({
      store,
      call: call("list_workspace_files"),
      context: emptyContext,
    });
    expect(result.ok).toBe(true);
    const paths = result.files?.map((entry) => entry.path) ?? [];
    expect(paths).toContain("src");
    expect(paths).toContain("src/app");
    expect(paths).toContain("src/app/main.ts");
  });

  it("reads a file's real contents", async () => {
    const store = makeStore([{ path: "README.md", content: "# Hello\n" }]);
    const result = await executeAgentTool({
      store,
      call: call("read_workspace_file", { path: "README.md" }),
      context: emptyContext,
    });
    expect(result.ok).toBe(true);
    expect(result.content).toBe("# Hello\n");
  });

  it("fails to read a missing file", async () => {
    const result = await executeAgentTool({
      store: makeStore(),
      call: call("read_workspace_file", { path: "nope.ts" }),
      context: emptyContext,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("searches paths and contents", async () => {
    const store = makeStore([
      { path: "src/a.ts", content: "const needle = 1;\n" },
      { path: "src/b.ts", content: "const other = 2;\n" },
    ]);
    const result = await executeAgentTool({
      store,
      call: call("search_workspace_files", { query: "needle" }),
      context: emptyContext,
    });
    expect(result.ok).toBe(true);
    expect(result.files?.map((f) => f.path)).toEqual(["src/a.ts"]);
  });

  it("returns task context", async () => {
    const result = await executeAgentTool({
      store: makeStore(),
      call: call("get_task_context"),
      context: {
        instructions: "Build a widget",
        requirements: ["Must be typed"],
        aiPolicy: "Overuse is penalized",
      },
    });
    expect(result.ok).toBe(true);
    expect(result.content).toContain("Build a widget");
    expect(result.content).toContain("Must be typed");
  });
});

describe("executeAgentTool — writes", () => {
  it("creates a file and reports an applied operation with a diff", async () => {
    const store = makeStore();
    const result = await executeAgentTool({
      store,
      call: call("create_workspace_file", {
        path: "src/example.ts",
        content: "export const x = 1;\n",
      }),
      context: emptyContext,
    });
    expect(result.ok).toBe(true);
    expect(result.operation?.kind).toBe("create_file");
    expect(result.operation?.status).toBe("applied");
    expect(result.operation?.requiresApproval).toBe(false);
    expect(result.operation?.diff?.previous).toBeNull();
    expect(result.operation?.diff?.next).toContain("export const x = 1;");
    expect(result.message).toMatch(/created/i);
    // The file really exists now.
    const stored = await store.read("src/example.ts");
    expect(stored?.content).toContain("export const x = 1;");
  });

  it("refuses to overwrite an existing file via create", async () => {
    const store = makeStore([{ path: "src/example.ts", content: "original\n" }]);
    const result = await executeAgentTool({
      store,
      call: call("create_workspace_file", { path: "src/example.ts", content: "replacement\n" }),
      context: emptyContext,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already exists/i);
    expect((await store.read("src/example.ts"))?.content).toBe("original\n");
  });

  it("edits an existing file and records the previous content", async () => {
    const store = makeStore([
      { path: "src/example.ts", content: "export function add(a, b) { return a + b; }\n" },
    ]);
    const next = "export function add(a: number, b: number): number {\n  return a + b;\n}\n";
    const result = await executeAgentTool({
      store,
      call: call("edit_workspace_file", { path: "src/example.ts", content: next }),
      context: emptyContext,
    });
    expect(result.ok).toBe(true);
    expect(result.operation?.kind).toBe("edit_file");
    expect(result.operation?.status).toBe("applied");
    expect(result.operation?.expectedPreviousContent).toContain("return a + b;");
    expect((await store.read("src/example.ts"))?.content).toBe(next);
  });

  it("fails to edit a file that does not exist", async () => {
    const result = await executeAgentTool({
      store: makeStore(),
      call: call("edit_workspace_file", { path: "missing.ts", content: "x" }),
      context: emptyContext,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("creates a directory marker", async () => {
    const store = makeStore();
    const result = await executeAgentTool({
      store,
      call: call("create_workspace_directory", { path: "src/components" }),
      context: emptyContext,
    });
    expect(result.ok).toBe(true);
    expect(result.operation?.kind).toBe("create_directory");
    expect(result.operation?.status).toBe("applied");
    expect(await store.read("src/components/.gitkeep")).not.toBeNull();
  });

  it("stages a delete without removing the file, requiring approval", async () => {
    const store = makeStore([{ path: "src/example.ts", content: "keep me\n" }]);
    const result = await executeAgentTool({
      store,
      call: call("delete_workspace_file", { path: "src/example.ts" }),
      context: emptyContext,
    });
    expect(result.ok).toBe(true);
    expect(result.operation?.kind).toBe("delete_file");
    expect(result.operation?.status).toBe("pending");
    expect(result.operation?.requiresApproval).toBe(true);
    // Crucially, the file is untouched until the candidate approves.
    expect(await store.read("src/example.ts")).not.toBeNull();
  });
});

describe("executeAgentTool — safety", () => {
  it("rejects parent-directory traversal", async () => {
    const result = await executeAgentTool({
      store: makeStore(),
      call: call("create_workspace_file", { path: "../escape.ts", content: "x" }),
      context: emptyContext,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects absolute paths", async () => {
    const result = await executeAgentTool({
      store: makeStore(),
      call: call("read_workspace_file", { path: "/etc/passwd" }),
      context: emptyContext,
    });
    expect(result.ok).toBe(false);
  });

  it("fails unknown tools safely", async () => {
    const result = await executeAgentTool({
      store: makeStore(),
      call: { id: "c", name: "delete_everything" as AgentToolName, arguments: {} },
      context: emptyContext,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unknown tool/i);
  });

  it("rejects malformed arguments", async () => {
    const result = await executeAgentTool({
      store: makeStore(),
      call: call("create_workspace_file", { path: 42 as unknown as string }),
      context: emptyContext,
    });
    expect(result.ok).toBe(false);
  });
});
