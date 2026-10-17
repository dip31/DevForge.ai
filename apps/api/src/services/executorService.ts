import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type {
  ExecuteCodeRequest,
  ExecuteLanguage,
  ExecutionFile,
  ExecutionResult,
} from "@contracts/execution";
import { validateWorkspacePath } from "./workspaceService";

// The only service that runs submitted code. Submitted workspace files are
// materialized into an isolated per-run temporary directory and executed by a
// short-lived child process. Guardrails: a fixed runtime allowlist (node /
// python), a hard wall-clock timeout, capped output, a scrubbed environment, and
// guaranteed cleanup. Paths are validated with the same gate the agent uses, so
// nothing can be written outside the run directory.

export const DEFAULT_TIMEOUT_MS = 10000;
export const MAX_TIMEOUT_MS = 30000;
export const MAX_OUTPUT_BYTES = 256 * 1024;

const EXTENSION_LANGUAGE: Record<string, ExecuteLanguage> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  mts: "typescript",
  tsx: "typescript",
  py: "python",
};

export function extensionOf(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** Infer the execution language from a workspace path, or null if unrunnable. */
export function inferLanguage(path: string): ExecuteLanguage | null {
  return EXTENSION_LANGUAGE[extensionOf(path)] ?? null;
}

/**
 * Candidate source files that can actually be executed in the sandbox. Used to
 * pick a default entry and to ground AI test generation.
 */
export function isRunnableSource(path: string): boolean {
  return inferLanguage(path) !== null;
}

let cachedPython: string | null | undefined;

/** Resolve a usable Python interpreter once, or null when unavailable. */
function resolvePython(): string | null {
  if (cachedPython !== undefined) return cachedPython;
  const candidates =
    process.platform === "win32" ? ["python", "python3", "py"] : ["python3", "python"];
  cachedPython = candidates.length > 0 ? candidates[0] : null;
  return cachedPython;
}

let cachedTsxCli: string | null | undefined;

/**
 * Locate the tsx CLI entry (a .mjs file we can run with `node`), avoiding the
 * Windows `.cmd` shim which cannot be spawned without a shell.
 */
function resolveTsxCli(): string | null {
  if (cachedTsxCli !== undefined) return cachedTsxCli;
  const roots = [process.cwd(), resolve(process.cwd(), ".."), resolve(process.cwd(), "..", "..")];
  for (const root of roots) {
    const candidate = join(root, "node_modules", "tsx", "dist", "cli.mjs");
    if (existsSync(candidate)) {
      cachedTsxCli = candidate;
      return cachedTsxCli;
    }
  }
  cachedTsxCli = null;
  return cachedTsxCli;
}

type ResolvedCommand = { command: string; args: string[] } | { error: string };

function resolveCommand(language: ExecuteLanguage, entry: string): ResolvedCommand {
  if (language === "python") {
    const python = resolvePython();
    if (!python) return { error: "No Python interpreter is available on the server." };
    return { command: python, args: [entry] };
  }
  if (language === "typescript") {
    const cli = resolveTsxCli();
    if (!cli) return { error: "TypeScript execution is not available on the server." };
    return { command: process.execPath, args: [cli, entry] };
  }
  // javascript
  return { command: process.execPath, args: [entry] };
}

let cachedPythonAvailable: boolean | null = null;

/** Whether a Python interpreter exists on this host (probed with `--version`). */
export function pythonAvailable(): Promise<boolean> {
  if (cachedPythonAvailable !== null) return Promise.resolve(cachedPythonAvailable);
  return new Promise((resolvePromise) => {
    const python = resolvePython();
    if (!python) return resolvePromise(false);
    const child = spawn(python, ["--version"], { shell: false, windowsHide: true });
    const done = (value: boolean) => {
      cachedPythonAvailable = value;
      resolvePromise(value);
    };
    child.on("error", () => done(false));
    child.on("close", (code) => done(code === 0));
    setTimeout(() => child.kill(), 3000);
  });
}

/**
 * Node treats a `.js` file as CommonJS unless its nearest package.json declares
 * `"type": "module"`. Assessment code uses ESM import/export, so in the sandbox
 * we merge a module type in unless the workspace explicitly declares one.
 */
async function ensureModulePackageJson(dir: string, files: Map<string, ExecutionFile>): Promise<void> {
  const existing = files.get("package.json");
  let parsed: Record<string, unknown> = {};
  if (existing) {
    try {
      const value = JSON.parse(existing.content);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>;
      }
    } catch {
      parsed = {};
    }
  }
  if (parsed.type === "module" || parsed.type === "commonjs") return;
  const merged = { ...parsed, type: "module" };
  await writeFile(join(dir, "package.json"), JSON.stringify(merged, null, 2), "utf8");
}

function buildSandboxEnv(dir: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    Path: process.env.Path ?? process.env.PATH ?? "",
    PATHEXT: process.env.PATHEXT ?? "",
    SystemRoot: process.env.SystemRoot ?? "",
    windir: process.env.windir ?? "",
    ComSpec: process.env.ComSpec ?? "",
    TEMP: dir,
    TMP: dir,
    HOME: dir,
    USERPROFILE: dir,
    LANG: "en_US.UTF-8",
    LC_ALL: "en_US.UTF-8",
    PYTHONIOENCODING: "utf-8",
    PYTHONDONTWRITEBYTECODE: "1",
    NODE_ENV: "sandbox",
    DEVFORGE_SANDBOX: "1",
  };
}

export class ExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

/**
 * Materialize the supplied workspace files into a temp dir and run the entry
 * file. Returns the genuine process result. Never throws for a program that
 * exits non-zero — that is reported as `status: "failed"` with a real exit code.
 * Throws {@link ExecutionError} only for invalid input or an unusable runtime.
 */
export async function runWorkspaceCode(input: ExecuteCodeRequest): Promise<ExecutionResult> {
  const language = input.language ?? inferLanguage(input.entry);
  if (!language) {
    throw new ExecutionError(
      `Cannot run "${input.entry}": unsupported file type. Use JavaScript or Python.`,
      "UNSUPPORTED_LANGUAGE",
    );
  }

  const files = new Map<string, ExecutionFile>();
  for (const file of input.files) {
    const validated = validateWorkspacePath(file.path);
    if (!validated.ok) {
      throw new ExecutionError(`Invalid workspace path "${file.path}": ${validated.error}`, "INVALID_PATH");
    }
    files.set(validated.path, { path: validated.path, content: file.content });
  }

  const entryValidation = validateWorkspacePath(input.entry);
  if (!entryValidation.ok) {
    throw new ExecutionError(`Invalid entry path: ${entryValidation.error}`, "INVALID_PATH");
  }
  const entry = entryValidation.path;
  if (!files.has(entry)) {
    throw new ExecutionError(`Entry file "${entry}" is not part of the workspace.`, "ENTRY_NOT_FOUND");
  }

  const timeoutMs = Math.min(
    Math.max(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, 250),
    MAX_TIMEOUT_MS,
  );

  const resolved = resolveCommand(language, entry);
  if ("error" in resolved) {
    throw new ExecutionError(resolved.error, "RUNTIME_UNAVAILABLE");
  }

  const dir = await mkdtemp(join(tmpdir(), "devforge-exec-"));
  try {
    for (const file of files.values()) {
      const target = join(dir, ...file.path.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf8");
    }
    if (language !== "python") {
      await ensureModulePackageJson(dir, files);
    }

    return await spawnAndCapture({
      command: resolved.command,
      args: resolved.args,
      cwd: dir,
      env: buildSandboxEnv(dir),
      stdin: input.stdin ?? "",
      timeoutMs,
      language,
      entry,
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function spawnAndCapture(params: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdin: string;
  timeoutMs: number;
  language: ExecuteLanguage;
  entry: string;
}): Promise<ExecutionResult> {
  const { command, args, cwd, env, stdin, timeoutMs, language, entry } = params;
  return new Promise<ExecutionResult>((resolvePromise) => {
    const startedAt = Date.now();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const status = timedOut
        ? "timeout"
        : exitCode === 0 && signal === null
          ? "completed"
          : "failed";
      resolvePromise({
        status,
        exitCode,
        signal: signal ?? null,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        truncated,
        durationMs: Math.max(0, Date.now() - startedAt),
        command: [command, ...args].join(" "),
        language,
        entry,
        timedOut,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      // Safety net if the process ignores the signal.
      setTimeout(() => finish(null, "SIGKILL"), 1000);
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdoutBytes >= MAX_OUTPUT_BYTES) {
        truncated = true;
        return;
      }
      stdoutBytes += chunk.length;
      stdoutChunks.push(chunk);
      if (stdoutBytes > MAX_OUTPUT_BYTES) truncated = true;
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrBytes >= MAX_OUTPUT_BYTES) {
        truncated = true;
        return;
      }
      stderrBytes += chunk.length;
      stderrChunks.push(chunk);
      if (stderrBytes > MAX_OUTPUT_BYTES) truncated = true;
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({
        status: "error",
        exitCode: null,
        signal: null,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: `${Buffer.concat(stderrChunks).toString("utf8")}\n${error.message}`.trim(),
        truncated,
        durationMs: Math.max(0, Date.now() - startedAt),
        command: [command, ...args].join(" "),
        language,
        entry,
        timedOut: false,
      });
    });

    child.on("close", (code, signal) => finish(code, signal));

    // Pipe stdin then close it so programs reading until EOF terminate.
    if (child.stdin) {
      child.stdin.on("error", () => undefined);
      child.stdin.end(stdin, "utf8");
    }
  });
}
