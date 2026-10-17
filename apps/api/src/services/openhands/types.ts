import type { AgentOperation, AgentStopReason } from "@contracts/agent";
import type { AiCoachHistoryMessage } from "@contracts/ai";
import type { WorkspaceStore } from "../workspaceService";
import type { AgentTaskContext } from "../agentTools";
import type { OpenHandsConfig } from "./config";

// Adapter-facing types. These are the only shapes the rest of the server sees;
// no OpenHands SDK event, tensor, or Python object ever crosses this boundary.
// Stop reasons and operations reuse the shared DevForge contracts so the
// existing route, UI, and apply endpoint keep working unchanged.

export type OpenHandsStopReason = AgentStopReason;

/** Normalized runtime failures, mapping to honest HTTP responses upstream. */
export type OpenHandsErrorCode =
  | "runtime_unconfigured"
  | "runtime_unavailable"
  | "runtime_auth"
  | "runtime_rate_limited"
  | "runtime_timeout"
  | "runtime_invalid_response"
  | "runtime_upstream";

/**
 * A runtime/provider failure from the OpenHands bridge. The message is always
 * safe to log and return: it never contains the session key, bridge secret, or
 * LLM credentials.
 */
export class OpenHandsRuntimeError extends Error {
  constructor(
    message: string,
    public readonly code: OpenHandsErrorCode,
    public readonly statusCode: number,
    public readonly retryAfterSeconds?: number,
    public readonly detail?: string | null,
  ) {
    super(message);
    this.name = "OpenHandsRuntimeError";
  }
}

export type OpenHandsRunInput = {
  store: WorkspaceStore;
  prompt: string;
  taskContext: AgentTaskContext;
  history?: AiCoachHistoryMessage[];
  /** DevForge session id, for diagnostics only. Never sent to the runtime. */
  sessionId?: string | null;
};

/**
 * The outcome of one runtime execution, as reported by the bridge. The bridge
 * only ever reports whether the agent loop finished or failed; it never invents
 * file changes — those are read back from the working directory and reconciled
 * by the workspace bridge.
 */
export type RuntimeOutcome = {
  status: "finished" | "error";
  model: string;
  detail?: string | null;
  /** Raw runtime status string, preserved for diagnostics only. */
  runtimeStatus?: string | null;
};

/** Parameters handed to a runtime implementation (bridge or test double). */
export type RuntimeRunParams = {
  workingDir: string;
  prompt: string;
  taskContext: AgentTaskContext;
  model: string;
  timeoutMs: number;
  config: OpenHandsConfig;
};

/** A pluggable executor for one OpenHands run. */
export type OpenHandsRuntime = (params: RuntimeRunParams) => Promise<RuntimeOutcome>;

export type ReconcileStats = {
  created: number;
  modified: number;
  deleted: number;
  unchanged: number;
  conflicts: number;
};

export type ReconcileResult = {
  operations: AgentOperation[];
  stats: ReconcileStats;
};

export type OpenHandsRunResult = {
  content: string;
  operations: AgentOperation[];
  stopReason: OpenHandsStopReason;
  model: string;
  /** True when changes were written to the authoritative store. */
  persisted: boolean;
  appliedCount: number;
  pendingCount: number;
  failedCount: number;
  warnings: string[];
};

export type SmokeTestResult = {
  ok: boolean;
  message: string;
  details: Record<string, unknown>;
};
