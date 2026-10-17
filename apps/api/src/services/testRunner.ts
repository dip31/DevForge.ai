import vm from "node:vm";
import { isDeepStrictEqual } from "node:util";
import type { RunnerTest, RunnerTestConfig } from "@contracts/proofloop";

export type TestExecutionResult = {
  id: string;
  name: string;
  suite: string | null;
  criterion: string | null;
  visibility: "public" | "private";
  status: "passed" | "failed" | "error";
  durationMs: number;
  message: string;
};

const DISALLOWED_TOKENS = [
  "require(",
  "process.",
  "import(",
  "globalThis.",
  "Function(",
  "eval(",
  "__proto__",
  "constructor.constructor",
];

export type RunnerOutcome = {
  ok: boolean;
  error?: string;
  results: TestExecutionResult[];
};

function stripModuleSyntax(source: string): string {
  return source
    .replace(/^\s*export\s+default\s+/m, "")
    .replace(/\bexport\s+(async\s+function|function|const|let|var|class)\b/g, "$1")
    .replace(/\bexport\s*\{[^}]*\};?/g, "");
}

function findDisallowedToken(source: string): string | null {
  for (const token of DISALLOWED_TOKENS) {
    if (source.includes(token)) return token;
  }
  return null;
}

/**
 * Execute a candidate's exported function against deterministic test cases.
 *
 * SECURITY: This uses Node's `vm` module with a time limit and a token
 * denylist. `vm` is NOT a hardened security boundary. In production this must
 * be replaced by the remote executor configured via `EXECUTOR_URL` (an
 * isolated container/sandbox). The interface here is intentionally narrow so
 * the local runner can be swapped without touching callers.
 */
export function runJavaScriptFunctionTests(
  source: string,
  config: Pick<RunnerTestConfig, "entryFile" | "exportName" | "timeoutMs">,
  tests: RunnerTest[],
): RunnerOutcome {
  const results: TestExecutionResult[] = [];
  const timeoutMs = config.timeoutMs ?? 2000;

  const disallowed = findDisallowedToken(source);
  if (disallowed) {
    return {
      ok: false,
      error: `Submission contains a disallowed token: ${disallowed}`,
      results: tests.map((test) => ({
        id: test.id,
        name: test.name,
        suite: test.suite ?? null,
        criterion: test.criterion,
        visibility: test.visibility,
        status: "error",
        durationMs: 0,
        message: "Submission rejected before execution (disallowed construct).",
      })),
    };
  }

  const stripped = stripModuleSyntax(source);
  const context: Record<string, unknown> = Object.create(null);
  context.console = { log: () => {}, error: () => {}, warn: () => {} };
  vm.createContext(context);

  let candidateFn: unknown;
  try {
    const define = new vm.Script(
      `"use strict";\n${stripped}\n;globalThis.__runnerExport = (typeof ${config.exportName} === "function") ? ${config.exportName} : undefined;`,
      { filename: config.entryFile },
    );
    define.runInContext(context, { timeout: timeoutMs });
    candidateFn = context.__runnerExport;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `Failed to load submission: ${message}`,
      results: tests.map((test) => ({
        id: test.id,
        name: test.name,
        suite: test.suite ?? null,
        criterion: test.criterion,
        visibility: test.visibility,
        status: "error",
        durationMs: 0,
        message: `Submission did not load: ${message}`,
      })),
    };
  }

  if (typeof candidateFn !== "function") {
    return {
      ok: false,
      error: `Expected an exported function named "${config.exportName}".`,
      results: tests.map((test) => ({
        id: test.id,
        name: test.name,
        suite: test.suite ?? null,
        criterion: test.criterion,
        visibility: test.visibility,
        status: "error",
        durationMs: 0,
        message: `No exported function named "${config.exportName}" was found.`,
      })),
    };
  }

  const invoke = new vm.Script(`"use strict";\nglobalThis.__result = globalThis.__fn.apply(undefined, globalThis.__args);`);
  context.__fn = candidateFn;

  for (const test of tests) {
    const started = Date.now();
    context.__args = JSON.parse(JSON.stringify(test.args ?? []));
    context.__result = undefined;
    try {
      invoke.runInContext(context, { timeout: timeoutMs });
      const durationMs = Date.now() - started;
      const passed = isDeepStrictEqual(context.__result, test.expected);
      results.push({
        id: test.id,
        name: test.name,
        suite: test.suite ?? null,
        criterion: test.criterion,
        visibility: test.visibility,
        status: passed ? "passed" : "failed",
        durationMs,
        message: passed
          ? "Passed"
          : `Expected ${JSON.stringify(test.expected)} but received ${JSON.stringify(context.__result)}.`,
      });
    } catch (error) {
      const durationMs = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      const timedOut = message.includes("Script execution timed out");
      results.push({
        id: test.id,
        name: test.name,
        suite: test.suite ?? null,
        criterion: test.criterion,
        visibility: test.visibility,
        status: "error",
        durationMs,
        message: timedOut ? "Execution timed out." : `Threw: ${message}`,
      });
    }
  }

  return { ok: true, results };
}

/** Strip execution details so hidden test internals never reach candidates. */
export function redactResultsForCandidate(
  results: TestExecutionResult[],
): Array<{
  id: string;
  name: string;
  suite: string | null;
  criterion: string | null;
  status: "passed" | "failed" | "error";
  hidden: boolean;
  durationMs: number;
  message: string;
}> {
  let hiddenIndex = 0;
  return results.map((result) => {
    const hidden = result.visibility === "private";
    if (hidden) hiddenIndex += 1;
    return {
      id: hidden ? `hidden-${hiddenIndex}` : result.id,
      name: hidden ? `Hidden verification check ${hiddenIndex}` : result.name,
      suite: result.suite,
      criterion: result.criterion,
      status: result.status,
      hidden,
      durationMs: result.durationMs,
      message: hidden
        ? result.status === "passed"
          ? "Passed"
          : "A hidden edge-case check did not pass."
        : result.message,
    };
  });
}
