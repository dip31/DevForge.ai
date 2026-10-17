import { spawn } from "node:child_process";
import type { Writable, Readable } from "node:stream";
import type { AgentOperation, AgentStopReason } from "@contracts/agent";
import { loadOpenHandsConfig, OpenHandsConfigError, type OpenHandsConfig } from "./config";
import {
  OpenHandsRuntimeError,
  type OpenHandsRunInput,
  type OpenHandsRunResult,
  type OpenHandsRuntime,
  type RuntimeOutcome,
  type RuntimeRunParams,
} from "./types";
import { WorkspaceBridge } from "./workspaceBridge";

// The adapter is the single boundary between DevForge and the OpenHands
// runtime. It seeds an isolated working copy from the authoritative store, asks
// the runtime to perform the task inside it, then reconciles the real file
// differences back into the store. The runtime itself is pluggable: the default
// implementation spawns the Python bridge (which uses the verified SDK remote-
// workspace pattern), and tests inject a fake runtime instead.

export interface OpenHandsAgentAdapter {
  runTask(input: OpenHandsRunInput): Promise<OpenHandsRunResult>;
}

// ── Python bridge runner ─────────────────────────────────────────────────────

/** The minimal child-process surface the runner needs (so tests can fake it). */
export type ChildProcessLike = {
  stdin: Writable | null;
  stdout: Readable | null;
  stderr: Readable | null;
  on(event: string, listener: (...args: any[]) => void): unknown;
  kill(signal?: NodeJS.Signals): boolean;
};

export type SpawnLike = (
  command: string,
  args: string[],
  options: Record<string, unknown>,
) => ChildProcessLike;

const MAX_STDERR_CHARS = 8000;
const MAX_STDOUT_CHARS = 200_000;

type BridgeEnvelope =
  | { ok: true; status?: string; model?: string; runtime_status?: string }
  | {
      ok: false;
      error?: { code?: string; message?: string; retry_after_seconds?: number; detail?: string };
    };

function errorForCode(code: string | undefined, message: string): OpenHandsRuntimeError {
  switch (code) {
    case "runtime_auth":
      return new OpenHandsRuntimeError(message, "runtime_auth", 502);
    case "runtime_rate_limited":
      return new OpenHandsRuntimeError(message, "runtime_rate_limited", 429);
    case "runtime_timeout":
      return new OpenHandsRuntimeError(message, "runtime_timeout", 504);
    case "runtime_unavailable":
      return new OpenHandsRuntimeError(message, "runtime_unavailable", 503);
    case "runtime_invalid_response":
      return new OpenHandsRuntimeError(message, "runtime_invalid_response", 502);
    default:
      return new OpenHandsRuntimeError(message, "runtime_upstream", 502);
  }
}

/** Spawn the Python bridge, write the payload to stdin, resolve on exit. */
export function runBridgeProcess(
  spawnImpl: SpawnLike,
  config: OpenHandsConfig,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string; spawnError?: Error }> {
  return new Promise((resolve) => {
    const child = spawnImpl(config.pythonPath, [config.bridgeScript], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    const finish = (result: { code: number | null; spawnError?: Error }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stdout, stderr });
    };

    child.stdout?.on("data", (chunk) => {
      if (stdout.length < MAX_STDOUT_CHARS) stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      if (stderr.length < MAX_STDERR_CHARS) stderr += chunk.toString();
    });
    child.on("error", (error) => finish({ code: null, spawnError: error }));
    child.on("close", (code) => {
      if (timedOut) {
        finish({ code, spawnError: new Error("__timeout__") });
        return;
      }
      finish({ code });
    });

    child.stdin?.end(JSON.stringify(payload));
  });
}

/**
 * The default runtime: spawn the isolated Python bridge, which connects to the
 * configured Agent Server and runs the task in the given working directory.
 */
export function createPythonBridgeRuntime(
  config: OpenHandsConfig,
  spawnImpl: SpawnLike = spawn as unknown as SpawnLike,
): OpenHandsRuntime {
  return async (params: RuntimeRunParams): Promise<RuntimeOutcome> => {
    const payload = {
      server_url: config.serverUrl,
      session_api_key: config.sessionApiKey,
      secret_key: config.secretKey,
      model: params.model,
      llm_api_key: config.llmApiKey,
      llm_base_url: config.llmBaseUrl,
      working_dir: params.workingDir,
      prompt: params.prompt,
      instructions: params.taskContext.instructions,
      requirements: params.taskContext.requirements,
      timeout_ms: params.timeoutMs,
    };

    const { code, stdout, stderr, spawnError } = await runBridgeProcess(
      spawnImpl,
      config,
      payload,
      params.timeoutMs,
    );

    if (spawnError) {
      if (spawnError.message === "__timeout__") {
        throw new OpenHandsRuntimeError(
          "The OpenHands agent run timed out.",
          "runtime_timeout",
          504,
        );
      }
      // ENOENT here means the isolated interpreter or bridge is missing.
      throw new OpenHandsRuntimeError(
        "The OpenHands runtime is not available on this server.",
        "runtime_unavailable",
        503,
        undefined,
        spawnError.message,
      );
    }

    const trimmed = stdout.trim();
    if (!trimmed) {
      throw new OpenHandsRuntimeError(
        "The OpenHands bridge returned no result.",
        "runtime_invalid_response",
        502,
        undefined,
        stderr.trim() || null,
      );
    }

    let envelope: BridgeEnvelope;
    try {
      envelope = JSON.parse(trimmed.split("\n").pop() ?? trimmed) as BridgeEnvelope;
    } catch {
      throw new OpenHandsRuntimeError(
        "The OpenHands bridge returned an invalid response.",
        "runtime_invalid_response",
        502,
        undefined,
        trimmed.slice(0, 500),
      );
    }

    if (!envelope.ok) {
      const code2 = envelope.error?.code;
      const message = envelope.error?.message || "The OpenHands agent run failed.";
      const err = errorForCode(code2, message);
      if (code2 === "runtime_rate_limited" && envelope.error?.retry_after_seconds != null) {
        throw new OpenHandsRuntimeError(
          err.message,
          err.code,
          err.statusCode,
          envelope.error.retry_after_seconds,
          envelope.error?.detail ?? null,
        );
      }
      throw err;
    }

    if (code !== 0) {
      throw new OpenHandsRuntimeError(
        "The OpenHands bridge exited unexpectedly.",
        "runtime_upstream",
        502,
        undefined,
        stderr.trim() || null,
      );
    }

    return {
      status: envelope.status === "error" ? "error" : "finished",
      model: envelope.model || params.model,
      runtimeStatus: envelope.runtime_status ?? null,
      detail: null,
    };
  };
}

// ── Adapter orchestration ────────────────────────────────────────────────────

export type AdapterDeps = {
  config?: OpenHandsConfig;
  runtime?: OpenHandsRuntime;
  bridge?: WorkspaceBridge;
};

function describeOperation(op: AgentOperation): string {
  const verb =
    op.kind === "create_file"
      ? "Created"
      : op.kind === "edit_file"
        ? "Edited"
        : op.kind === "delete_file"
          ? "Staged deletion of"
          : "Created folder";
  return `${verb} ${op.path}`;
}

function summarizeOperations(operations: AgentOperation[], runtimeFailed: boolean): string {
  const applied = operations.filter((op) => op.status === "applied");
  const pending = operations.filter((op) => op.status === "pending");
  const failed = operations.filter((op) => op.status === "failed");

  if (operations.length === 0) {
    return runtimeFailed
      ? "The OpenHands run did not complete and no workspace changes were detected."
      : "The OpenHands agent finished without making any workspace changes.";
  }

  const lines: string[] = [
    runtimeFailed
      ? "The OpenHands run stopped before finishing. These changes were detected on disk:"
      : "The OpenHands agent completed its run.",
  ];
  if (applied.length > 0) {
    lines.push("", "**Applied changes:**");
    for (const op of applied) lines.push(`- ${describeOperation(op)}`);
  }
  if (pending.length > 0) {
    lines.push("", "**Staged (awaiting your approval):**");
    for (const op of pending) lines.push(`- ${describeOperation(op)}`);
  }
  if (failed.length > 0) {
    lines.push("", "**Rejected (conflicted or invalid):**");
    for (const op of failed) lines.push(`- ${op.path}: ${op.error ?? "rejected"}`);
  }
  return lines.join("\n");
}

/**
 * Build the adapter. `deps` exists purely for tests; production callers use the
 * environment-derived configuration and the real Python bridge runtime.
 */
export function createOpenHandsAdapter(deps: AdapterDeps = {}): OpenHandsAgentAdapter {
  const config = deps.config ?? loadOpenHandsConfig();
  const bridge =
    deps.bridge ?? new WorkspaceBridge({ rootDir: WorkspaceBridge.defaultRootDir() });
  const runtime = deps.runtime ?? createPythonBridgeRuntime(config);

  return {
    async runTask(input: OpenHandsRunInput): Promise<OpenHandsRunResult> {
      if (!config.enabled) {
        throw new OpenHandsRuntimeError(
          "The OpenHands coding agent is not enabled on this server.",
          "runtime_unconfigured",
          503,
        );
      }

      const seeded = await bridge.seed(input.store);
      let outcome: RuntimeOutcome | null = null;
      let runtimeError: OpenHandsRuntimeError | null = null;

      try {
        outcome = await runtime({
          workingDir: seeded.workingDir,
          prompt: input.prompt,
          taskContext: input.taskContext,
          model: config.model,
          timeoutMs: config.timeoutMs,
          config,
        });
      } catch (error) {
        runtimeError =
          error instanceof OpenHandsRuntimeError
            ? error
            : new OpenHandsRuntimeError(
                "The OpenHands runtime failed.",
                "runtime_upstream",
                502,
                undefined,
                error instanceof Error ? error.message : null,
              );
      }

      let reconciled: { operations: AgentOperation[] };
      try {
        reconciled = await bridge.reconcile(input.store, seeded);
      } finally {
        // Keep the working copy only when the run failed, for diagnostics.
        await bridge.cleanup(seeded, { keep: Boolean(runtimeError) });
      }

      const operations = reconciled.operations;

      // A hard runtime failure with nothing on disk to show for it must surface
      // as an error, never as a fabricated success.
      if (runtimeError && operations.length === 0) throw runtimeError;

      const stopReason: AgentStopReason = runtimeError
        ? "provider_error"
        : outcome && outcome.status === "error"
          ? "provider_error"
          : "completed";

      const appliedCount = operations.filter((op) => op.status === "applied").length;
      const pendingCount = operations.filter((op) => op.status === "pending").length;
      const failedCount = operations.filter((op) => op.status === "failed").length;
      const warnings: string[] = [];
      if (runtimeError) warnings.push(runtimeError.message);
      if (failedCount > 0) warnings.push(`${failedCount} change(s) were rejected.`);

      return {
        content: summarizeOperations(operations, Boolean(runtimeError)),
        operations,
        stopReason,
        model: outcome?.model ?? config.model,
        persisted: appliedCount > 0,
        appliedCount,
        pendingCount,
        failedCount,
        warnings,
      };
    },
  };
}

export { OpenHandsConfigError };
