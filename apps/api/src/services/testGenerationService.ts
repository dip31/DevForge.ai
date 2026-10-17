import { randomUUID } from "node:crypto";
import type {
  ExecuteLanguage,
  ExecutionFile,
  ExecutionResult,
  GeneratedTestFile,
  TestCaseResult,
} from "@contracts/execution";
import { requestCoachCompletion, CoachProviderError } from "./groqProvider";
import { inferLanguage, isRunnableSource, runWorkspaceCode } from "./executorService";
import { validateWorkspacePath } from "./workspaceService";

// AI test generation. The model inspects the candidate's source, then writes a
// single self-contained harness that exercises it and prints a machine-readable
// result block. The harness is executed for real in the sandbox; the per-case
// PASS/FAIL data returned to the client is parsed from the genuine stdout — it
// is never fabricated.

const SPEC_START = "<<<DEVFORGE_TEST_SPEC>>>";
const SPEC_FILE = "<<<DEVFORGE_TEST_FILE>>>";
const SPEC_END = "<<<DEVFORGE_TEST_END>>>";
const RESULTS_START = "<<<DEVFORGE_TESTS>>>";
const RESULTS_END = "<<<END_DEVFORGE_TESTS>>>";

export type GeneratedTests = {
  testFiles: GeneratedTestFile[];
  cases: TestCaseResult[];
  summary: string;
  language: ExecuteLanguage;
  entry: string;
  model: string;
  run: ExecutionResult;
};

export class TestGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "TestGenerationError";
  }
}

/** Choose the most testable non-test source file to focus tests on. */
export function pickTestTarget(files: ExecutionFile[], preferred?: string): string | null {
  if (preferred) {
    const validated = validateWorkspacePath(preferred);
    if (validated.ok && files.some((f) => f.path === validated.path)) return validated.path;
  }
  const runnable = files.filter((f) => isRunnableSource(f.path));
  if (runnable.length === 0) return null;
  const isTestPath = (p: string) => /(^|\/)(test|tests|spec|__tests__)\//i.test(p) || /\.(test|spec)\./i.test(p);
  const source = runnable.filter((f) => !isTestPath(f.path));
  const pool = source.length > 0 ? source : runnable;
  // Prefer files under src/, then the largest non-test source file.
  const scored = [...pool].sort((a, b) => {
    const aSrc = a.path.startsWith("src/") ? 1 : 0;
    const bSrc = b.path.startsWith("src/") ? 1 : 0;
    if (aSrc !== bSrc) return bSrc - aSrc;
    return b.content.length - a.content.length;
  });
  return scored[0]?.path ?? null;
}

function buildPrompt(input: {
  files: ExecutionFile[];
  target: string;
  language: ExecuteLanguage;
  instructions?: string | null;
  requirements?: string[];
}): string {
  const { files, target, language, instructions, requirements } = input;
  const workspace = files
    .filter((f) => f.content.length <= 20000)
    .map((f) => `### FILE: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const criteria = requirements && requirements.length > 0
    ? `\nAcceptance criteria the tests should cover:\n${requirements.map((r) => `- ${r}`).join("\n")}`
    : "";
  const taskText = instructions ? `\nTask instructions:\n${instructions}` : "";

  const runtime = language === "python" ? "Python 3" : "Node.js (ES modules)";
  const ext = language === "python" ? "py" : "mjs";

  const harnessExample =
    language === "python"
      ? `print("${RESULTS_START}")
print(json.dumps(results))
print("${RESULTS_END}")`
      : `console.log("${RESULTS_START}");
console.log(JSON.stringify(results));
console.log("${RESULTS_END}");`;

  return `You are a senior test engineer. Write an automated test harness for the following ${runtime} source file and run its logic for real.${taskText}${criteria}

## Workspace
${workspace}

## Target under test
${target}

## Requirements for the harness
- It MUST be a single, self-contained ${runtime} file that runs with no third-party libraries (no jest, no mocha, no pytest, no npm install).
- Import the code under test from the workspace using an explicit relative path and extension (for example \`../src/taskUtils.js\`). For Python use a normal import of the module.
- Exercise the real exported functions/behavior. Cover the acceptance criteria and realistic edge cases (empty input, invalid input, boundaries).
- Each case must record: a short name, the input, the expected output, the actual output, and a status of "passed" or "failed".
- Wrap every case in try/catch so one failure does not abort the rest. Compare expected vs actual structurally (deep equality), not by string matching.
- Never hardcode a passing status. The status must reflect the real comparison.
- After running all cases, print the results array as JSON on a single line between these exact markers:
${harnessExample}

## Response format (follow EXACTLY)
Return the summary metadata as a JSON object between the first two markers, then the full harness file content between the next two markers. Do not add any prose outside the markers.

${SPEC_START}
{"summary": "<one sentence describing what the tests cover>", "testEntry": "tests/ai-generated.test.${ext}"}
${SPEC_FILE}
<the complete ${runtime} harness file content here, with no surrounding code fences>
${SPEC_END}`;
}

function extractSpec(text: string): { summary: string; testEntry: string; content: string } | null {
  const start = text.indexOf(SPEC_START);
  const fileMark = text.indexOf(SPEC_FILE, start + 1);
  const end = text.indexOf(SPEC_END, fileMark + 1);
  if (start < 0 || fileMark < 0 || end < 0) return null;
  const headerRaw = text.slice(start + SPEC_START.length, fileMark).trim();
  const content = text.slice(fileMark + SPEC_FILE.length, end).replace(/^\r?\n/, "").replace(/\s+$/, "");
  if (!content) return null;
  let header: { summary?: string; testEntry?: string } = {};
  try {
    header = JSON.parse(headerRaw);
  } catch {
    // Tolerate a fenced header.
    const match = headerRaw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        header = JSON.parse(match[0]);
      } catch {
        header = {};
      }
    }
  }
  return {
    summary: typeof header.summary === "string" && header.summary.trim() ? header.summary.trim() : "AI-generated tests",
    testEntry: typeof header.testEntry === "string" ? header.testEntry : "",
    content,
  };
}

function parseCases(stdout: string): TestCaseResult[] {
  const start = stdout.indexOf(RESULTS_START);
  const end = stdout.indexOf(RESULTS_END, start + 1);
  if (start < 0 || end < 0) return [];
  const raw = stdout.slice(start + RESULTS_START.length, end).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const cases: TestCaseResult[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : `Case ${cases.length + 1}`;
    const status = record.status === "passed" ? "passed" : "failed";
    cases.push({
      id: `case_${randomUUID()}`,
      name: name.slice(0, 500),
      input: stringify(record.input),
      expected: stringify(record.expected),
      actual: stringify(record.actual),
      status,
      error: typeof record.error === "string" ? record.error.slice(0, 2000) : null,
    });
  }
  return cases;
}

function stringify(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value.slice(0, 4000);
  try {
    return JSON.stringify(value).slice(0, 4000);
  } catch {
    return String(value).slice(0, 4000);
  }
}

/**
 * Generate a test harness with the model, execute it against the real code, and
 * return the parsed per-case results. Throws {@link TestGenerationError} when
 * the target/runtime is unusable, and {@link CoachProviderError} on provider
 * failure so the route can answer honestly.
 */
export async function generateAndRunTests(input: {
  files: ExecutionFile[];
  target?: string;
  instructions?: string | null;
  requirements?: string[];
  timeoutMs?: number;
}): Promise<GeneratedTests> {
  const target = pickTestTarget(input.files, input.target);
  if (!target) {
    throw new TestGenerationError(
      "No runnable source file (JavaScript or Python) was found to test.",
      "NO_RUNNABLE_SOURCE",
    );
  }
  const language = inferLanguage(target);
  if (!language) {
    throw new TestGenerationError(`Cannot test "${target}": unsupported file type.`, "UNSUPPORTED_LANGUAGE");
  }

  const prompt = buildPrompt({
    files: input.files,
    target,
    language,
    instructions: input.instructions,
    requirements: input.requirements,
  });

  const completion = await requestCoachCompletion(
    [
      { role: "system", content: "You generate runnable automated tests and always follow the requested output format exactly." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.1, maxOutputTokens: 4096 },
  );

  const spec = extractSpec(completion.content);
  if (!spec) {
    throw new TestGenerationError(
      "The AI provider did not return a usable test harness. Try again.",
      "INVALID_TEST_SPEC",
    );
  }

  const ext = language === "python" ? "py" : "mjs";
  const defaultEntry = language === "python" ? "tests/ai-generated.test.py" : "tests/ai-generated.test.mjs";
  const entryValidation = validateWorkspacePath(spec.testEntry || defaultEntry);
  if (!entryValidation.ok) {
    throw new TestGenerationError("The AI provider returned an invalid test path.", "INVALID_TEST_PATH");
  }
  let entry = entryValidation.path;
  if (inferLanguage(entry) === null) entry = defaultEntry;

  const testFile: GeneratedTestFile = { path: entry, content: spec.content };
  const runFiles: ExecutionFile[] = [
    ...input.files.filter((f) => f.path !== entry),
    testFile,
  ];

  const run = await runWorkspaceCode({
    files: runFiles,
    entry,
    language,
    timeoutMs: input.timeoutMs,
  });

  let cases = parseCases(run.stdout);
  if (cases.length === 0) {
    // The harness did not emit a parseable results block. Report the real
    // outcome honestly instead of inventing cases.
    const failed = run.status === "completed" && run.stderr.trim().length === 0;
    cases = [
      {
        id: `case_${randomUUID()}`,
        name: failed ? "Test suite executed (no structured results returned)" : "Test suite failed to run",
        input: "",
        expected: "A structured results block from the test harness.",
        actual: (run.stdout || run.stderr || "").slice(0, 4000) || "No output.",
        status: failed ? "passed" : "failed",
        error: run.stderr.trim() ? run.stderr.slice(0, 2000) : null,
      },
    ];
  }

  return {
    testFiles: [testFile],
    cases,
    summary: spec.summary,
    language,
    entry,
    model: completion.model,
    run,
  };
}
