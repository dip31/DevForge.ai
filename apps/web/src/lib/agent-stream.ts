import { API_BASE_URL, ApiErrorResponse } from "./api";
import { getAuthHeader } from "./auth";
import type { AgentStreamEvent } from "@contracts/execution";

export type AgentStreamRequest = {
  prompt: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: {
    currentFile?: string;
    files?: Array<{ path: string; content: string }>;
    instructions?: string | null;
    requirements?: string[];
  };
};

/**
 * Opens the agent streaming endpoint with fetch + a ReadableStream reader
 * (EventSource cannot POST or send the Authorization header). Each parsed SSE
 * `data:` frame is a real step the server executed. Resolves when the stream
 * ends; rejects with an ApiErrorResponse on a non-2xx response.
 */
export async function streamAgentRun(
  sessionId: string,
  body: AgentStreamRequest,
  handlers: { onEvent: (event: AgentStreamEvent) => void; signal?: AbortSignal },
): Promise<void> {
  const authHeader = await getAuthHeader();
  const response = await fetch(
    `${API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/ai-agent/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
      signal: handlers.signal,
    },
  );

  if (!response.ok || !response.body) {
    let code = "HTTP_ERROR";
    let message = `HTTP ${response.status}`;
    let details: Record<string, unknown> | undefined;
    try {
      const parsed = await response.json();
      const envelope = parsed?.error ?? parsed;
      code = envelope?.code ?? code;
      message = envelope?.message ?? message;
      details = envelope?.details;
    } catch {
      // non-JSON error body
    }
    throw new ApiErrorResponse(response.status, code, message, details);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushFrames = (chunk: string) => {
    buffer += chunk;
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          handlers.onEvent(JSON.parse(payload) as AgentStreamEvent);
        } catch {
          // ignore malformed frames
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  };

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      flushFrames(decoder.decode(value, { stream: true }));
    }
    flushFrames(decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
