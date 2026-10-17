import Groq, {
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  RateLimitError,
} from "groq-sdk";

// Groq hosts an OpenAI-compatible chat-completions API. This module is the only
// place that talks to it, so the rest of the server can stay provider-agnostic
// and the provider can be swapped or mocked in tests.

export const GROQ_PROVIDER = "groq" as const;
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

export type CoachChatRole = "system" | "user" | "assistant";

export type CoachChatMessage = {
  role: CoachChatRole;
  content: string;
};

export type GroqCompletion = {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

// Tool-calling support. Groq exposes an OpenAI-compatible `tools` parameter; a
// model that wants to call a tool returns `tool_calls` (and often empty content)
// instead of a plain message. The server — never the model — decides whether a
// requested tool actually runs.
export type GroqTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type GroqToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type GroqToolCallPayload = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type GroqAgentCompletion = {
  content: string | null;
  toolCalls: GroqToolCall[];
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type CoachProviderErrorCode =
  | "provider_unconfigured"
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_auth"
  | "provider_upstream"
  | "provider_invalid_response";

// Which provider quota was hit, when the provider tells us. Groq's RPM/TPM
// limits and daily caps are enforced separately, so surfacing the kind lets the
// UI tell the candidate something accurate ("wait a few seconds" vs "daily cap").
export type GroqQuotaType = "requests" | "tokens" | "daily" | "unknown";

// A normalized error the route can translate into an honest HTTP response.
// The caller must never convert this into a fabricated success.
export class CoachProviderError extends Error {
  constructor(
    message: string,
    public readonly code: CoachProviderErrorCode,
    public readonly statusCode: number,
    // For rate limits: how long the provider asked us to wait, in seconds.
    public readonly retryAfterSeconds?: number,
    public readonly quotaType?: GroqQuotaType,
  ) {
    super(message);
    this.name = "CoachProviderError";
  }
}

// The subset of the Groq client this module depends on. Keeping it structural
// makes the provider easy to fake in tests without touching the network.
export type GroqClientLike = {
  chat: {
    completions: {
      create: (params: {
        model: string;
        messages: Array<{
          role: CoachChatRole | "tool";
          content: string | null;
          tool_call_id?: string;
          tool_calls?: GroqToolCallPayload[];
        }>;
        temperature?: number;
        max_tokens?: number;
        tools?: GroqTool[];
        tool_choice?: "auto" | "none";
      }) => Promise<{
        choices?: Array<{
          message?: {
            content?: string | null;
            role?: string;
            tool_calls?: Array<{
              id?: string;
              type?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        } | null;
        model?: string;
      }>;
    };
  };
};

export type GroqProviderOptions = {
  client?: GroqClientLike;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  temperature?: number;
};

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.2;

// Bounded retry for transient provider rate limits. We only retry the provider
// *request* (which is a pure text/tool-call generation with no side effects),
// never a file operation. If the provider asks us to wait longer than this, we
// stop and surface the limit honestly instead of hanging the request.
export const MAX_RATE_LIMIT_RETRIES = 2;
export const MAX_RETRY_WAIT_MS = 5000;

let sharedClient: { key: string; client: GroqClientLike } | null = null;

// The chat-completions base URL. Defaults to Groq's API; set GROQ_BASE_URL to
// use any OpenAI-compatible gateway (OpenRouter, Together, etc.).
function getBaseUrl(): string | undefined {
  const raw = process.env.GROQ_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

// The Groq SDK hardcodes its request path as `/openai/v1/chat/completions`
// (Groq's own API layout). Generic OpenAI-compatible gateways such as
// OpenRouter expose `/chat/completions` directly under their base URL, so when
// a custom base URL is configured we strip the extra `/openai/v1` prefix. This
// keeps the SDK's own error classes (auth, rate-limit, timeout) intact.
function gatewayFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const rewritten = url.includes("/openai/v1/") ? url.replace("/openai/v1/", "/") : url;
  return globalThis.fetch(rewritten, init);
}

function getSharedClient(apiKey: string): GroqClientLike {
  const baseURL = getBaseUrl();
  const key = `${apiKey}\u0000${baseURL ?? ""}`;
  if (sharedClient && sharedClient.key === key) return sharedClient.client;
  const client = new Groq({
    apiKey,
    baseURL,
    maxRetries: 0,
    // Only rewrite when pointed at a non-Groq gateway.
    ...(baseURL ? { fetch: gatewayFetch } : {}),
  }) as unknown as GroqClientLike;
  sharedClient = { key, client };
  return client;
}

/** True when the server has an AI provider API key available. */
export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0);
}

/** The configured model, or the package default. */
export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

function resolveOptions(options: GroqProviderOptions) {
  const parsedTimeout = Number(process.env.GROQ_TIMEOUT_MS);
  const parsedMaxTokens = Number(process.env.GROQ_MAX_OUTPUT_TOKENS);
  return {
    apiKey: options.apiKey ?? process.env.GROQ_API_KEY?.trim(),
    model: options.model ?? getGroqModel(),
    timeoutMs:
      options.timeoutMs ??
      (Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS),
    maxOutputTokens:
      options.maxOutputTokens ??
      (Number.isFinite(parsedMaxTokens) && parsedMaxTokens > 0
        ? parsedMaxTokens
        : DEFAULT_MAX_OUTPUT_TOKENS),
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read the `retry-after` header a provider sends with a 429. Groq sends whole
 * seconds; we also tolerate an HTTP-date. Returns undefined when absent.
 */
function extractRetryAfterSeconds(error: unknown): number | undefined {
  const headers = (error as { headers?: { get?: (name: string) => string | null } })?.headers;
  if (!headers || typeof headers.get !== "function") return undefined;
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  return undefined;
}

/** Classify which provider quota a 429 refers to, when the body tells us. */
function classifyQuota(error: unknown): GroqQuotaType {
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  // Groq returns { error: { type: "requests" | "tokens", code: "rate_limit_exceeded" } }.
  const body = (error as { error?: unknown })?.error;
  let bodyHint = "";
  if (body && typeof body === "object") {
    const inner = ((body as Record<string, unknown>).error ?? body) as Record<string, unknown>;
    bodyHint = `${inner?.type ?? ""} ${inner?.code ?? ""}`.toLowerCase();
  }
  const haystack = `${message} ${bodyHint}`;
  if (haystack.includes("daily") || haystack.includes("per day")) return "daily";
  if (haystack.includes("token")) return "tokens";
  if (haystack.includes("request")) return "requests";
  return "unknown";
}

function mapGroqError(error: unknown): CoachProviderError {
  if (error instanceof CoachProviderError) return error;
  if (error instanceof AuthenticationError) {
    return new CoachProviderError(
      "The AI provider rejected the server credentials.",
      "provider_auth",
      502,
    );
  }
  if (error instanceof RateLimitError) {
    const retryAfterSeconds = extractRetryAfterSeconds(error);
    const quotaType = classifyQuota(error);
    const scope =
      quotaType === "daily"
        ? "the daily quota"
        : quotaType === "tokens"
          ? "the token limit"
          : quotaType === "requests"
            ? "the request limit"
            : "a rate limit";
    const wait =
      retryAfterSeconds != null
        ? ` Try again in about ${retryAfterSeconds}s.`
        : " Try again shortly.";
    return new CoachProviderError(
      `The AI provider rate limited this request (${scope}).${wait}`,
      "provider_rate_limited",
      429,
      retryAfterSeconds,
      quotaType,
    );
  }
  if (error instanceof APIConnectionTimeoutError) {
    return new CoachProviderError("The AI provider timed out.", "provider_timeout", 504);
  }
  if (error instanceof APIConnectionError) {
    return new CoachProviderError("Could not reach the AI provider.", "provider_upstream", 502);
  }
  if (error instanceof APIError) {
    return new CoachProviderError("The AI provider returned an error.", "provider_upstream", 502);
  }
  return new CoachProviderError("The AI provider request failed.", "provider_upstream", 502);
}

/**
 * Run a single provider request with a bounded retry for rate limits only. The
 * retry is safe because it repeats a pure generation call, never a file write.
 * When the provider asks us to wait longer than {@link MAX_RETRY_WAIT_MS}, we
 * stop and let the honest 429 (with its retry-after) propagate.
 */
async function withRateLimitRetry<T>(run: () => Promise<T>, timeoutMs: number): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await withTimeout(
        run(),
        timeoutMs,
        () => new CoachProviderError("The AI provider timed out.", "provider_timeout", 504),
      );
    } catch (error) {
      const mapped = mapGroqError(error);
      if (mapped.code === "provider_rate_limited" && attempt < MAX_RATE_LIMIT_RETRIES) {
        const waitMs = (mapped.retryAfterSeconds ?? 1) * 1000;
        if (waitMs <= MAX_RETRY_WAIT_MS) {
          await sleep(Math.max(waitMs, 250));
          attempt += 1;
          continue;
        }
      }
      throw mapped;
    }
  }
}

/**
 * Request a single chat completion from Groq. Throws {@link CoachProviderError}
 * on any failure so the caller can respond honestly instead of guessing.
 */
export async function requestCoachCompletion(
  messages: CoachChatMessage[],
  options: GroqProviderOptions = {},
): Promise<GroqCompletion> {
  const { apiKey, model, timeoutMs, maxOutputTokens, temperature } = resolveOptions(options);

  if (!apiKey) {
    throw new CoachProviderError(
      "The AI provider is not configured on this server.",
      "provider_unconfigured",
      503,
    );
  }

  const client = options.client ?? getSharedClient(apiKey);

  try {
    const response = await withRateLimitRetry(
      () =>
        client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxOutputTokens,
        }),
      timeoutMs,
    );

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new CoachProviderError(
        "The AI provider returned an empty response.",
        "provider_invalid_response",
        502,
      );
    }

    const usage = response.usage ?? {};
    return {
      content,
      model: response.model ?? model,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    };
  } catch (error) {
    throw mapGroqError(error);
  }
}

export type AgentChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCallPayload[] }
  | { role: "tool"; content: string; tool_call_id: string };

function parseToolArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Request a completion that may call tools. Returns the assistant text (if any)
 * and any tool calls the model requested. This never executes a tool: it only
 * reports what the model asked for so the caller can validate and run each call
 * against the authorized workspace.
 */
export async function requestAgentCompletion(
  messages: AgentChatMessage[],
  tools: GroqTool[],
  options: GroqProviderOptions = {},
): Promise<GroqAgentCompletion> {
  const { apiKey, model, timeoutMs, maxOutputTokens, temperature } = resolveOptions(options);

  if (!apiKey) {
    throw new CoachProviderError(
      "The AI provider is not configured on this server.",
      "provider_unconfigured",
      503,
    );
  }

  const client = options.client ?? getSharedClient(apiKey);

  try {
    const response = await withRateLimitRetry(
      () =>
        client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxOutputTokens,
          tools,
          tool_choice: "auto",
        }),
      timeoutMs,
    );

    const message = response.choices?.[0]?.message;
    const rawCalls = message?.tool_calls ?? [];
    const toolCalls: GroqToolCall[] = [];
    for (const call of rawCalls) {
      const name = call.function?.name;
      if (!name) continue;
      toolCalls.push({
        id: call.id || `call_${toolCalls.length}`,
        name,
        arguments: parseToolArguments(call.function?.arguments),
      });
    }

    const content = message?.content?.trim() || null;

    // A response with neither content nor tool calls is unusable — report it as
    // an invalid response rather than fabricating progress.
    if (!content && toolCalls.length === 0) {
      throw new CoachProviderError(
        "The AI provider returned an empty response.",
        "provider_invalid_response",
        502,
      );
    }

    const usage = response.usage ?? {};
    return {
      content,
      toolCalls,
      model: response.model ?? model,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    };
  } catch (error) {
    throw mapGroqError(error);
  }
}
