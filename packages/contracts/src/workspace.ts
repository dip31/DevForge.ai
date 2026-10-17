import { z } from "zod";

import { uuidSchema, isoDateSchema } from "./common";

export const fileTypeSchema = z.enum(["source", "test", "config", "asset", "other"]);

export const workspaceRevisionSchema = z.object({
  id: uuidSchema,

  sessionId: uuidSchema,

  revisionNumber: z.number().int().positive(),

  files: z
    .array(
      z.object({
        path: z.string().min(1).max(500),

        language: z.string().min(1).max(50),

        content: z.string(),

        isReadOnly: z.boolean().default(false),

        isDeleted: z.boolean().default(false),
      }),
    )
    .default([]),

  message: z.string().max(2000).nullable().optional(),

  isSnapshot: z.boolean().default(false),

  createdAt: isoDateSchema,
});

export const sessionFileSchema = z.object({
  id: uuidSchema,

  sessionId: uuidSchema,

  path: z.string().min(1).max(500),

  language: z.string().min(1).max(50),

  content: z.string(),

  isReadOnly: z.boolean().default(false),

  isDeleted: z.boolean().default(false),

  createdAt: isoDateSchema,

  updatedAt: isoDateSchema,
});

export const executionStatusSchema = z.enum([
  "pending",

  "running",

  "completed",

  "failed",

  "timeout",

  "cancelled",
]);

export const executionRunSchema = z.object({
  id: uuidSchema,

  sessionId: uuidSchema,

  revisionId: uuidSchema,

  type: z.string().max(50).default("run"),

  command: z.string().max(1000).nullable().optional(),

  status: executionStatusSchema.default("pending"),

  exitCode: z.number().int().nullable().optional(),

  stdout: z.string().nullable().optional(),

  stderr: z.string().nullable().optional(),

  startedAt: z.string().datetime(),

  completedAt: z.string().datetime().nullable().optional(),

  durationMs: z.number().int().nonnegative().nullable().optional(),

  resourceUsage: z.record(z.unknown()).default({}),

  error: z.string().nullable().optional(),

  createdAt: isoDateSchema,
});

export const testRunStatusSchema = z.enum([
  "pending",

  "running",

  "completed",

  "failed",
]);

export const testResultSchema = z.object({
  id: uuidSchema,

  sessionId: uuidSchema,

  executionRunId: uuidSchema,

  revisionId: uuidSchema,

  testSuite: z.string().max(255).nullable().optional(),

  testName: z.string().min(1).max(255),

  status: z.enum(["passed", "failed", "pending"]),

  durationMs: z.number().int().nonnegative().nullable().optional(),

  output: z.string().nullable().optional(),

  error: z.string().nullable().optional(),

  criterion: z.string().max(255).nullable().optional(),

  isHidden: z.boolean().default(false),

  createdAt: isoDateSchema,
});

export const executionArtifactSchema = z.object({
  id: uuidSchema,

  executionRunId: uuidSchema,

  name: z.string().min(1).max(255),

  type: z.string().min(1).max(50),

  storagePath: z.string().min(1).max(500),

  sizeBytes: z.number().int().positive(),

  mimeType: z.string().max(100).nullable().optional(),

  metadata: z.record(z.unknown()).default({}),

  createdAt: isoDateSchema,
});

export const runExecutionRequestSchema = z.object({
  sessionId: uuidSchema,

  revisionId: uuidSchema,

  type: z.string().max(50).default("run"),

  command: z.string().max(1000).optional(),
});

export const runTestsRequestSchema = z.object({
  sessionId: uuidSchema,

  revisionId: uuidSchema,
});

export const saveRevisionRequestSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().min(1).max(500),

      language: z.string().min(1).max(50),

      content: z.string(),

      isReadOnly: z.boolean().default(false),
    }),
  ),

  message: z.string().max(2000).optional(),

  isSnapshot: z.boolean().default(false),
});

export type WorkspaceRevision = z.infer<typeof workspaceRevisionSchema>;

export type SessionFile = z.infer<typeof sessionFileSchema>;

export type ExecutionRun = z.infer<typeof executionRunSchema>;

export type TestResult = z.infer<typeof testResultSchema>;

export type ExecutionArtifact = z.infer<typeof executionArtifactSchema>;

export type RunExecutionRequest = z.infer<typeof runExecutionRequestSchema>;

export type RunTestsRequest = z.infer<typeof runTestsRequestSchema>;

export type SaveRevisionRequest = z.infer<typeof saveRevisionRequestSchema>;
