import { z } from "zod";
import { aiProviderSchema } from "./ai";
import { agentOperationSchema, agentStopReasonSchema } from "./agent";

// Contracts for the real code-execution feature. Submitted workspace files are
// materialized into an isolated temporary directory on the API host and run via
// a short-lived child process (node / python). This is genuine execution — the
// output returned to the client is the program's actual stdout/stderr.

export const executeLanguageSchema = z.enum([
  "javascript",
  "typescript",
  "python",
]);
export type ExecuteLanguage = z.infer<typeof executeLanguageSchema>;

export const executionFileSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(200000),
});
export type ExecutionFile = z.infer<typeof executionFileSchema>;

export const executionOutcomeSchema = z.enum([
  "completed",
  "failed",
  "timeout",
  "error",
]);
export type ExecutionOutcome = z.infer<typeof executionOutcomeSchema>;

export const executeCodeRequestSchema = z.object({
  // The candidate's current workspace, supplied by the client (local demo
  // sessions have no server-side row) or resolved from the session on the server.
  files: z.array(executionFileSchema).max(200),
  // Workspace-relative path of the file to execute.
  entry: z.string().min(1).max(500),
  // Optional explicit language; when omitted the server infers it from `entry`.
  language: executeLanguageSchema.optional(),
  // Program standard input, piped to the child process.
  stdin: z.string().max(200000).optional(),
  // Hard wall-clock limit. Clamped server-side to a safe maximum.
  timeoutMs: z.number().int().positive().max(60000).optional(),
});
export type ExecuteCodeRequest = z.infer<typeof executeCodeRequestSchema>;

export const executionResultSchema = z.object({
  status: executionOutcomeSchema,
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  truncated: z.boolean(),
  durationMs: z.number().int().nonnegative(),
  command: z.string(),
  language: executeLanguageSchema,
  entry: z.string(),
  timedOut: z.boolean(),
});
export type ExecutionResult = z.infer<typeof executionResultSchema>;

export const executeCodeResponseSchema = z.object({
  success: z.literal(true),
  data: executionResultSchema,
});
export type ExecuteCodeResponse = z.infer<typeof executeCodeResponseSchema>;

// ── AI test generation + execution ──────────────────────────────────────────

export const generateTestsRequestSchema = z.object({
  files: z.array(executionFileSchema).max(200),
  // Optional focus file; when omitted the server selects the best runnable module.
  entry: z.string().min(1).max(500).optional(),
  instructions: z.string().max(10000).nullable().optional(),
  requirements: z.array(z.string().max(500)).max(100).optional(),
  timeoutMs: z.number().int().positive().max(60000).optional(),
});
export type GenerateTestsRequest = z.infer<typeof generateTestsRequestSchema>;

export const testCaseResultSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  input: z.string().max(4000),
  expected: z.string().max(4000),
  actual: z.string().max(4000),
  status: z.enum(["passed", "failed"]),
  error: z.string().max(2000).nullable().optional(),
});
export type TestCaseResult = z.infer<typeof testCaseResultSchema>;

export const generatedTestFileSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(200000),
});
export type GeneratedTestFile = z.infer<typeof generatedTestFileSchema>;

export const generateTestsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    testFiles: z.array(generatedTestFileSchema).max(10),
    cases: z.array(testCaseResultSchema).max(200),
    summary: z.string().max(2000),
    language: executeLanguageSchema,
    entry: z.string().max(500),
    provider: aiProviderSchema,
    model: z.string().max(100),
    // The genuine execution result the cases were parsed from.
    run: executionResultSchema,
  }),
});
export type GenerateTestsResponse = z.infer<typeof generateTestsResponseSchema>;

// ── Static web preview ──────────────────────────────────────────────────────
// The candidate's workspace is stashed server-side under a short-lived opaque
// token and served over HTTP so HTML/CSS/JS projects (including ES modules and
// relative assets) resolve exactly as they would in a real browser.

export const createPreviewRequestSchema = z.object({
  files: z.array(executionFileSchema).max(500),
  // Preferred entry page (workspace-relative). Defaults to an index.html.
  entry: z.string().min(1).max(500).optional(),
});
export type CreatePreviewRequest = z.infer<typeof createPreviewRequestSchema>;

export const createPreviewResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string().min(1).max(200),
    entry: z.string().min(1).max(500),
  }),
});
export type CreatePreviewResponse = z.infer<typeof createPreviewResponseSchema>;

// ── Streaming agent steps (Server-Sent Events) ──────────────────────────────

export const agentStreamPhaseSchema = z.enum([
  "planning",
  "analyzing",
  "writing",
  "deleting",
  "verifying",
  "done",
  "error",
]);
export type AgentStreamPhase = z.infer<typeof agentStreamPhaseSchema>;

export const agentStreamEventSchema = z.object({
  type: z.enum(["step", "done", "error"]),
  phase: agentStreamPhaseSchema,
  detail: z.string().max(500),
  // Present on the terminal "done" event.
  content: z.string().max(60000).nullable().optional(),
  stopReason: agentStopReasonSchema.nullable().optional(),
  tokensUsed: z.number().int().nonnegative().nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  persisted: z.boolean().nullable().optional(),
  // File operations the run proposed/applied. Only on the terminal "done" event.
  operations: z.array(agentOperationSchema).max(50).optional(),
});
export type AgentStreamEvent = z.infer<typeof agentStreamEventSchema>;
