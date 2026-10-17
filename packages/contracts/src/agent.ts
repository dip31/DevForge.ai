import { z } from "zod";
import { uuidSchema, isoDateSchema } from "./common";
import { aiCoachContextSchema, aiCoachHistoryMessageSchema } from "./ai";

// The workspace tools the agent is allowed to request. This is the closed set:
// the model can never name a tool outside this enum, and the server validates
// every call against it. No shell, network, database, or env access.
export const agentToolNameSchema = z.enum([
  "list_workspace_files",
  "read_workspace_file",
  "get_task_context",
  "create_workspace_directory",
  "create_workspace_file",
  "edit_workspace_file",
  "delete_workspace_file",
  "search_workspace_files",
]);
export type AgentToolName = z.infer<typeof agentToolNameSchema>;

// Kinds of workspace mutations the agent can propose.
export const agentOperationKindSchema = z.enum([
  "create_file",
  "edit_file",
  "delete_file",
  "create_directory",
]);
export type AgentOperationKind = z.infer<typeof agentOperationKindSchema>;

// Lifecycle: a write is staged as "pending" (candidate approval required) before
// it is ever applied. Only after the backend confirms the write does it become
// "applied". Rejected and failed operations never mutate the workspace.
export const agentOperationStatusSchema = z.enum(["pending", "applied", "rejected", "failed"]);
export type AgentOperationStatus = z.infer<typeof agentOperationStatusSchema>;

// A minimal unified diff between the previous and proposed content. `previous`
// is null for a create; `next` is null for a delete.
export const agentDiffSchema = z.object({
  path: z.string().min(1).max(500),
  previous: z.string().nullable(),
  next: z.string().nullable(),
});
export type AgentDiff = z.infer<typeof agentDiffSchema>;

export const agentOperationSchema = z.object({
  id: z.string().min(1).max(100),
  kind: agentOperationKindSchema,
  path: z.string().min(1).max(500),
  // Proposed new content for create/edit. Null for delete and directory.
  content: z.string().nullable().optional(),
  // Content the file had when the agent read it, used for stale detection.
  expectedPreviousContent: z.string().nullable().optional(),
  language: z.string().max(50).optional(),
  // True when the operation must be explicitly approved by the candidate.
  requiresApproval: z.boolean(),
  status: agentOperationStatusSchema,
  diff: agentDiffSchema.nullable().optional(),
  appliedAt: isoDateSchema.nullable().optional(),
  error: z.string().max(1000).nullable().optional(),
});
export type AgentOperation = z.infer<typeof agentOperationSchema>;

// A single tool invocation, validated and typed. Arguments are validated per
// tool by the server; the model never gets to define its own shape.
export const agentToolCallSchema = z.object({
  id: z.string().min(1).max(100),
  name: agentToolNameSchema,
  arguments: z.record(z.unknown()).default({}),
});
export type AgentToolCall = z.infer<typeof agentToolCallSchema>;

export const agentToolResultSchema = z.object({
  tool: agentToolNameSchema,
  ok: z.boolean(),
  // Read payload (list/read/search/context).
  content: z.string().max(200000).nullable().optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(500),
        type: z.enum(["file", "directory"]),
        language: z.string().max(50).optional(),
        sizeBytes: z.number().int().nonnegative().optional(),
      }),
    )
    .max(1000)
    .nullable()
    .optional(),
  // For write tools: the staged operation that still requires approval.
  operation: agentOperationSchema.nullable().optional(),
  // Human-readable outcome (success, conflict, denied).
  message: z.string().max(2000).nullable().optional(),
  error: z.string().max(1000).nullable().optional(),
});
export type AgentToolResult = z.infer<typeof agentToolResultSchema>;

export const agentRequestSchema = z.object({
  prompt: z.string().min(1).max(5000),
  context: aiCoachContextSchema.optional(),
  history: z.array(aiCoachHistoryMessageSchema).max(20).optional(),
});
export type AgentRequest = z.infer<typeof agentRequestSchema>;

export const agentStopReasonSchema = z.enum([
  "completed",
  "max_iterations",
  "no_progress",
  "provider_error",
]);
export type AgentStopReason = z.infer<typeof agentStopReasonSchema>;

export const agentResponseSchema = z.object({
  id: z.string().min(1).max(100),
  sessionId: z.string().max(100).nullable(),
  // Final natural-language response (markdown) produced by the model.
  content: z.string().min(1).max(60000),
  provider: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  // Operations the model proposed. Reads are executed inline and never appear
  // here; writes are applied immediately (delete staged for approval).
  operations: z.array(agentOperationSchema).max(50).default([]),
  // Why the loop ended. "provider_error" means the run stopped because the
  // provider failed partway; any listed operations are still real.
  stopReason: agentStopReasonSchema.default("completed"),
  tokensUsed: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative().nullable(),
  persisted: z.boolean(),
  createdAt: isoDateSchema,
});
export type AgentResponse = z.infer<typeof agentResponseSchema>;

// The candidate approves a subset of the previously staged operations. The
// server re-authorizes and re-validates every path and the current file content
// before writing, so a rejected or stale operation can never mutate the
// workspace. Content is supplied again so the operation is self-contained and
// no server-side staging table is required.
export const applyOperationsRequestSchema = z.object({
  operations: z.array(agentOperationSchema).min(1).max(50),
});
export type ApplyOperationsRequest = z.infer<typeof applyOperationsRequestSchema>;

export const applyOperationsResponseSchema = z.object({
  applied: z.array(agentOperationSchema).default([]),
  failed: z.array(agentOperationSchema).default([]),
});
export type ApplyOperationsResponse = z.infer<typeof applyOperationsResponseSchema>;

export const agentSessionIdSchema = uuidSchema;
