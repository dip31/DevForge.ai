import { z } from "zod";
import {
  uuidSchema,
  paginationSchema,
  paginatedResponseSchema,
  isoDateSchema,
  positiveIntSchema,
} from "./common";

export const practiceTaskStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "expired",
]);

export const practiceTaskSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  skills: z.array(z.string()).default([]),
  durationMinutes: positiveIntSchema,
  starterFiles: z
    .array(
      z.object({
        path: z.string().min(1).max(500),
        language: z.string().min(1).max(50),
        content: z.string(),
        isReadOnly: z.boolean().default(false),
        isHidden: z.boolean().default(false),
      }),
    )
    .default([]),
  testPatterns: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        name: z.string().min(1).max(255),
        pattern: z.string(),
        criterion: z.string().min(1).max(255),
        diagnostic: z.string().min(1).max(1000),
      }),
    )
    .default([]),
  isActive: z.boolean().default(true),
  order: z.number().int().nonnegative().default(0),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const practiceTaskSummarySchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  skills: z.array(z.string()).default([]),
  durationMinutes: positiveIntSchema,
  isActive: z.boolean().default(true),
});

export const practiceSessionSchema = z.object({
  id: uuidSchema,
  candidateId: uuidSchema,
  taskId: uuidSchema,
  status: z.enum(["not_started", "in_progress", "completed", "expired"]).default("not_started"),
  attemptNumber: z.number().int().positive().default(1),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
  durationMinutes: positiveIntSchema,
  timeRemainingSeconds: z.number().int().nonnegative().nullable().optional(),
  totalPausedSeconds: z.number().int().nonnegative().default(0),
  currentFile: z.string().max(500).nullable().optional(),
  files: z.record(z.unknown()).default({}),
  revisions: z.array(z.unknown()).default([]),
  runHistory: z.array(z.unknown()).default([]),
  testRuns: z.array(z.unknown()).default([]),
  activity: z.array(z.unknown()).default([]),
  coachMessages: z.array(z.unknown()).default([]),
  metadata: z.record(z.unknown()).default({}),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const startPracticeRequestSchema = z.object({
  taskId: uuidSchema,
});

export const practiceAllowanceSchema = z.object({
  id: uuidSchema,
  candidateId: uuidSchema,
  freeAttemptsUsed: z.number().int().nonnegative().default(0),
  freeAttemptsLimit: positiveIntSchema.default(3),
  paidAttemptsPurchased: z.number().int().nonnegative().default(0),
  paidAttemptsUsed: z.number().int().nonnegative().default(0),
  subscriptionId: uuidSchema.nullable().optional(),
  lastResetAt: isoDateSchema.nullable().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const usageLedgerEntrySchema = z.object({
  id: uuidSchema,
  candidateId: uuidSchema,
  eventType: z.string().min(1).max(50),
  eventId: uuidSchema,
  attemptsConsumed: z.number().int().nonnegative().default(0),
  description: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: isoDateSchema,
});

export const getPracticeAllowanceResponseSchema = z.object({
  freeAttemptsUsed: z.number().int().nonnegative(),
  freeAttemptsLimit: positiveIntSchema,
  paidAttemptsPurchased: z.number().int().nonnegative(),
  paidAttemptsUsed: z.number().int().nonnegative(),
  remainingFreeAttempts: z.number().int().nonnegative(),
  totalRemainingAttempts: z.number().int().nonnegative(),
  canStartFreePractice: z.boolean(),
});

export type PracticeTask = z.infer<typeof practiceTaskSchema>;
export type PracticeTaskSummary = z.infer<typeof practiceTaskSummarySchema>;
export type PracticeSession = z.infer<typeof practiceSessionSchema>;
export type StartPracticeRequest = z.infer<typeof startPracticeRequestSchema>;
export type PracticeAllowance = z.infer<typeof practiceAllowanceSchema>;
export type UsageLedgerEntry = z.infer<typeof usageLedgerEntrySchema>;
export type GetPracticeAllowanceResponse = z.infer<typeof getPracticeAllowanceResponseSchema>;
