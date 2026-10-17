import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { RateLimitError } from "groq-sdk";
import {
  CoachProviderError,
  MAX_RATE_LIMIT_RETRIES,
  getGroqModel,
  isGroqConfigured,
  requestCoachCompletion,
  requestAgentCompletion,
  type GroqClientLike,
} from "./groqProvider";

const messages = [
  { role: "system" as const, content: "You are a coach." },
  { role: "user" as const, content: "hint" },
];

function fakeClient(result?: {
  content?: string | null;
  model?: string;
  usage?: Record<string, number> | null;
  hang?: boolean;
  reject?: unknown;
}): GroqClientLike {
  return {
    chat: {
      completions: {
        create: () => {
          if (result?.hang) return new Promise(() => {});
          if (result?.reject) return Promise.reject(result.reject);
          return Promise.resolve({
            choices: [{ message: { content: result?.content ?? "ok" } }],
            usage: result?.usage ?? {
              prompt_tokens: 3,
              completion_tokens: 4,
              total_tokens: 7,
            },
            model: result?.model,
          });
        },
      },
    },
  } as GroqClientLike;
}

const originalKey = process.env.GROQ_API_KEY;
const originalModel = process.env.GROQ_MODEL;

beforeEach(() => {
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_MODEL;
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GROQ_MODEL;
  else process.env.GROQ_MODEL = originalModel;
});

describe("isGroqConfigured", () => {
  it("is false without an API key", () => {
    expect(isGroqConfigured()).toBe(false);
  });

  it("is true when GROQ_API_KEY is set", () => {
    process.env.GROQ_API_KEY = "gsk_test";
    expect(isGroqConfigured()).toBe(true);
  });

  it("treats a blank key as unconfigured", () => {
    process.env.GROQ_API_KEY = "   ";
    expect(isGroqConfigured()).toBe(false);
  });
});

describe("getGroqModel", () => {
  it("falls back to the default model", () => {
    expect(getGroqModel()).toBe("openai/gpt-oss-20b");
  });

  it("uses GROQ_MODEL when set", () => {
    process.env.GROQ_MODEL = "llama-3.3-70b-versatile";
    expect(getGroqModel()).toBe("llama-3.3-70b-versatile");
  });
});

describe("requestCoachCompletion", () => {
  it("returns content and token usage from the injected client", async () => {
    const result = await requestCoachCompletion(messages, {
      client: fakeClient(),
      apiKey: "k",
    });
    expect(result.content).toBe("ok");
    expect(result.model).toBe("openai/gpt-oss-20b");
    expect(result.promptTokens).toBe(3);
    expect(result.completionTokens).toBe(4);
    expect(result.totalTokens).toBe(7);
  });

  it("throws a typed error when no API key is available", async () => {
    await expect(requestCoachCompletion(messages, { client: fakeClient() })).rejects.toMatchObject({
      code: "provider_unconfigured",
      statusCode: 503,
    });
  });

  it("times out a hanging request", async () => {
    const promise = requestCoachCompletion(messages, {
      client: fakeClient({ hang: true }),
      apiKey: "k",
      timeoutMs: 20,
    });
    await expect(promise).rejects.toMatchObject({
      code: "provider_timeout",
      statusCode: 504,
    });
  });

  it("rejects an empty completion instead of returning blank success", async () => {
    await expect(
      requestCoachCompletion(messages, { client: fakeClient({ content: "  " }), apiKey: "k" }),
    ).rejects.toMatchObject({
      code: "provider_invalid_response",
      statusCode: 502,
    });
  });

  it("maps unexpected failures to a generic upstream error", async () => {
    await expect(
      requestCoachCompletion(messages, {
        client: fakeClient({ reject: new Error("boom") }),
        apiKey: "k",
      }),
    ).rejects.toMatchObject({
      code: "provider_upstream",
      statusCode: 502,
    });
  });

  it("preserves an already-typed provider error", async () => {
    const typed = new CoachProviderError("nope", "provider_rate_limited", 429);
    await expect(
      requestCoachCompletion(messages, { client: fakeClient({ reject: typed }), apiKey: "k" }),
    ).rejects.toBe(typed);
  });
});

const tools = [
  {
    type: "function" as const,
    function: {
      name: "read_workspace_file",
      description: "Read a file",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
  },
];

function fakeToolClient(result: {
  content?: string | null;
  toolCalls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
  usage?: Record<string, number> | null;
  reject?: unknown;
}): GroqClientLike {
  return {
    chat: {
      completions: {
        create: () => {
          if (result.reject) return Promise.reject(result.reject);
          return Promise.resolve({
            choices: [
              {
                message: {
                  content: result.content ?? null,
                  tool_calls: result.toolCalls ?? [],
                },
              },
            ],
            usage: result.usage ?? { prompt_tokens: 5, completion_tokens: 6, total_tokens: 11 },
            model: "openai/gpt-oss-120b",
          });
        },
      },
    },
  } as GroqClientLike;
}

describe("requestAgentCompletion", () => {
  it("parses tool calls with validated JSON arguments", async () => {
    const result = await requestAgentCompletion(messages, tools, {
      apiKey: "k",
      client: fakeToolClient({
        toolCalls: [
          { id: "c1", function: { name: "read_workspace_file", arguments: '{"path":"src/a.js"}' } },
        ],
      }),
    });
    expect(result.toolCalls).toEqual([
      { id: "c1", name: "read_workspace_file", arguments: { path: "src/a.js" } },
    ]);
    expect(result.content).toBeNull();
    expect(result.totalTokens).toBe(11);
  });

  it("tolerates malformed tool arguments by returning empty args", async () => {
    const result = await requestAgentCompletion(messages, tools, {
      apiKey: "k",
      client: fakeToolClient({
        toolCalls: [{ id: "c1", function: { name: "read_workspace_file", arguments: "not json" } }],
      }),
    });
    expect(result.toolCalls[0].arguments).toEqual({});
  });

  it("returns content when the model answers without tools", async () => {
    const result = await requestAgentCompletion(messages, tools, {
      apiKey: "k",
      client: fakeToolClient({ content: "All done." }),
    });
    expect(result.content).toBe("All done.");
    expect(result.toolCalls).toHaveLength(0);
  });

  it("rejects a response with neither content nor tool calls", async () => {
    await expect(
      requestAgentCompletion(messages, tools, {
        apiKey: "k",
        client: fakeToolClient({ content: null, toolCalls: [] }),
      }),
    ).rejects.toMatchObject({ code: "provider_invalid_response", statusCode: 502 });
  });

  it("throws when unconfigured", async () => {
    await expect(
      requestAgentCompletion(messages, tools, { client: fakeToolClient({}) }),
    ).rejects.toMatchObject({ code: "provider_unconfigured", statusCode: 503 });
  });
});

// A real RateLimitError as Groq sends it: status 429, a structured body with a
// `type`, and a `retry-after` header. Constructing the actual SDK error (rather
// than a plain object) proves the provider recognizes and handles it correctly.
function rateLimitError(retryAfter: string | null, type: "requests" | "tokens" = "requests") {
  const headers = new Headers();
  if (retryAfter !== null) headers.set("retry-after", retryAfter);
  return new RateLimitError(
    429,
    {
      error: {
        message: `Rate limit reached on ${type} per minute`,
        type,
        code: "rate_limit_exceeded",
      },
    },
    `Rate limit reached on ${type} per minute`,
    headers,
  );
}

function sequencedClient(steps: Array<"limit" | "ok">): {
  client: GroqClientLike;
  calls: () => number;
} {
  let index = 0;
  const client = {
    chat: {
      completions: {
        create: () => {
          const step = steps[index] ?? "ok";
          index += 1;
          if (step === "limit") return Promise.reject(rateLimitError("1"));
          return Promise.resolve({
            choices: [{ message: { content: "ok" } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            model: "openai/gpt-oss-120b",
          });
        },
      },
    },
  } as GroqClientLike;
  return { client, calls: () => index };
}

describe("provider rate limiting", () => {
  it("retries a short 429 (retry-after under the cap) and then succeeds", async () => {
    vi.useFakeTimers();
    try {
      const { client, calls } = sequencedClient(["limit", "ok"]);
      const promise = requestAgentCompletion(messages, tools, { client, apiKey: "k" });
      await vi.advanceTimersByTimeAsync(1500);
      const result = await promise;
      expect(result.content).toBe("ok");
      expect(calls()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up after the bounded number of retries", async () => {
    vi.useFakeTimers();
    try {
      const { client, calls } = sequencedClient(["limit", "limit", "limit", "limit"]);
      const promise = requestAgentCompletion(messages, tools, { client, apiKey: "k" });
      const assertion = expect(promise).rejects.toMatchObject({
        code: "provider_rate_limited",
        statusCode: 429,
      });
      await vi.runAllTimersAsync();
      await assertion;
      expect(calls()).toBe(1 + MAX_RATE_LIMIT_RETRIES);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry when the provider asks us to wait longer than the cap", async () => {
    let calls = 0;
    const client = {
      chat: {
        completions: {
          create: () => {
            calls += 1;
            return Promise.reject(rateLimitError("30"));
          },
        },
      },
    } as GroqClientLike;
    await expect(
      requestAgentCompletion(messages, tools, { client, apiKey: "k" }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
      retryAfterSeconds: 30,
      quotaType: "requests",
    });
    expect(calls).toBe(1);
  });

  it("classifies a token quota from the provider body", async () => {
    const headers = new Headers({ "retry-after": "45" });
    const error = new RateLimitError(
      429,
      { error: { message: "Rate limit reached for tokens", type: "tokens" } },
      "rate limited",
      headers,
    );
    const client = {
      chat: { completions: { create: () => Promise.reject(error) } },
    } as GroqClientLike;
    await expect(requestCoachCompletion(messages, { client, apiKey: "k" })).rejects.toMatchObject({
      code: "provider_rate_limited",
      quotaType: "tokens",
      retryAfterSeconds: 45,
    });
  });
});
