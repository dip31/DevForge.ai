import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgent, MAX_AGENT_ITERATIONS } from "./agentService";
import { MemoryWorkspaceStore } from "./workspaceService";
import { requestAgentCompletion, CoachProviderError } from "./groqProvider";
import type { GroqAgentCompletion } from "./groqProvider";

vi.mock("./groqProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./groqProvider")>();
  return {
    ...actual,
    getGroqModel: () => "openai/gpt-oss-120b",
    requestAgentCompletion: vi.fn(),
  };
});

const mockCompletion = vi.mocked(requestAgentCompletion);

function completion(partial: Partial<GroqAgentCompletion>): GroqAgentCompletion {
  return {
    content: null,
    toolCalls: [],
    model: "openai/gpt-oss-120b",
    promptTokens: 1,
    completionTokens: 1,
    totalTokens: 2,
    ...partial,
  };
}

function createCall(id: string, path: string, content: string) {
  return { id, name: "create_workspace_file", arguments: { path, content } };
}

const taskContext = { instructions: "Build the feature", requirements: ["typed"], aiPolicy: null };

beforeEach(() => {
  mockCompletion.mockReset();
});

describe("runAgent", () => {
  it("applies a create tool call and returns the model's final answer", async () => {
    mockCompletion
      .mockResolvedValueOnce(
        completion({ toolCalls: [createCall("c1", "src/example.ts", "export const x = 1;\n")] }),
      )
      .mockResolvedValueOnce(completion({ content: "Created src/example.ts." }));

    const store = new MemoryWorkspaceStore();
    const result = await runAgent({ store, prompt: "create src/example.ts", taskContext });

    expect(result.stopReason).toBe("completed");
    expect(result.content).toBe("Created src/example.ts.");
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toMatchObject({ kind: "create_file", status: "applied" });
    expect((await store.read("src/example.ts"))?.content).toContain("export const x = 1;");
  });

  it("preserves already-applied operations when the provider fails mid-loop", async () => {
    mockCompletion
      .mockResolvedValueOnce(
        completion({ toolCalls: [createCall("c1", "src/example.ts", "export const x = 1;\n")] }),
      )
      .mockRejectedValueOnce(
        new CoachProviderError(
          "rate limited (requests)",
          "provider_rate_limited",
          429,
          30,
          "requests",
        ),
      );

    const store = new MemoryWorkspaceStore();
    const result = await runAgent({ store, prompt: "create src/example.ts", taskContext });

    expect(result.stopReason).toBe("provider_error");
    expect(result.content).toMatch(/provider stopped responding/i);
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].status).toBe("applied");
    // The change really happened and must not be lost.
    expect((await store.read("src/example.ts"))?.content).toContain("export const x = 1;");
  });

  it("propagates the provider error when nothing had been applied yet", async () => {
    mockCompletion.mockRejectedValueOnce(
      new CoachProviderError(
        "rate limited (requests)",
        "provider_rate_limited",
        429,
        30,
        "requests",
      ),
    );

    const store = new MemoryWorkspaceStore();
    await expect(runAgent({ store, prompt: "do something", taskContext })).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
      retryAfterSeconds: 30,
    });
  });

  it("stops on repeated identical tool calls instead of looping forever", async () => {
    mockCompletion.mockResolvedValue(
      completion({ toolCalls: [{ id: "r", name: "list_workspace_files", arguments: {} }] }),
    );

    const store = new MemoryWorkspaceStore();
    const result = await runAgent({ store, prompt: "list files", taskContext });

    expect(result.stopReason).toBe("no_progress");
    expect(mockCompletion.mock.calls.length).toBeLessThan(MAX_AGENT_ITERATIONS);
  });

  it("caps the number of iterations", async () => {
    for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
      mockCompletion.mockResolvedValueOnce(
        completion({
          toolCalls: [createCall(`c${i}`, `src/f${i}.ts`, `export const v${i} = ${i};\n`)],
        }),
      );
    }

    const store = new MemoryWorkspaceStore();
    const result = await runAgent({ store, prompt: "create many files", taskContext });

    expect(result.stopReason).toBe("max_iterations");
    expect(result.iterations).toBe(MAX_AGENT_ITERATIONS);
    expect(result.operations).toHaveLength(MAX_AGENT_ITERATIONS);
  });
});
