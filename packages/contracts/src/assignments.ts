import { z } from "zod";
import {
  uuidSchema,
  paginationSchema,
  paginatedResponseSchema,
  isoDateSchema,
  positiveIntSchema,
} from "./common";

export const assignmentStatusSchema = z.enum([
  "invited",
  "in_progress",
  "submitted",
  "evaluated",
  "reviewed",
  "expired",
  "withdrawn",
]);

export const sessionStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "paused",
  "submitted",
  "expired",
]);

export const candidateAssignmentSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  assessmentId: uuidSchema,
  assessmentVersionId: uuidSchema,
  candidateId: uuidSchema,
  assignedBy: uuidSchema,
  status: assignmentStatusSchema.default("invited"),
  deadline: isoDateSchema.nullable().optional(),
  startedAt: isoDateSchema.nullable().optional(),
  submittedAt: isoDateSchema.nullable().optional(),
  expiresAt: isoDateSchema.nullable().optional(),
  withdrawnAt: isoDateSchema.nullable().optional(),
  withdrawnReason: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  taskDetails: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      role: z.string().optional(),
      skills: z.string().optional(),
      durationMinutes: z.number().int().positive().optional(),
      difficulty: z.string().optional(),
      instructions: z.string().nullable().optional(),
      aiPolicy: z.string().nullable().optional(),
      starterFiles: z
        .array(
          z.object({
            path: z.string(),
            language: z.string(),
            isReadOnly: z.boolean().default(false),
          }),
        )
        .optional(),
    })
    .optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const createAssignmentRequestSchema = z.object({
  assessmentId: uuidSchema,
  assessmentVersionId: uuidSchema,
  candidateId: uuidSchema,
  deadline: isoDateSchema.optional(),
  expiresAt: isoDateSchema.optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const updateAssignmentRequestSchema = z.object({
  deadline: isoDateSchema.nullable().optional(),
  expiresAt: isoDateSchema.nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const withdrawAssignmentRequestSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const assessmentSessionSchema = z.object({
  id: uuidSchema,
  assignmentId: uuidSchema,
  candidateId: uuidSchema,
  assessmentVersionId: uuidSchema,
  status: sessionStatusSchema.default("not_started"),
  startedAt: isoDateSchema.nullable().optional(),
  pausedAt: isoDateSchema.nullable().optional(),
  resumedAt: isoDateSchema.nullable().optional(),
  submittedAt: isoDateSchema.nullable().optional(),
  expiresAt: isoDateSchema.nullable().optional(),
  timeRemainingSeconds: z.number().int().nonnegative().nullable().optional(),
  totalPausedSeconds: z.number().int().nonnegative().default(0),
  currentFile: z.string().max(500).nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  taskDetails: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      role: z.string().optional(),
      skills: z.string().optional(),
      durationMinutes: z.number().int().positive().optional(),
      difficulty: z.string().optional(),
      instructions: z.string().nullable().optional(),
      aiPolicy: z.string().nullable().optional(),
    })
    .optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const startSessionRequestSchema = z.object({
  assignmentId: uuidSchema,
});

export const submitSessionRequestSchema = z.object({
  sessionId: uuidSchema,
});

export const sessionStateEventSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  eventType: z.string().min(1).max(50),
  previousStatus: z
    .enum(["not_started", "in_progress", "paused", "submitted", "expired"])
    .nullable()
    .optional(),
  newStatus: z.enum(["not_started", "in_progress", "paused", "submitted", "expired"]),
  triggeredBy: uuidSchema.nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});

export type CandidateAssignment = z.infer<typeof candidateAssignmentSchema>;
export type CreateAssignmentRequest = z.infer<typeof createAssignmentRequestSchema>;
export type UpdateAssignmentRequest = z.infer<typeof updateAssignmentRequestSchema>;
export type AssessmentSession = z.infer<typeof assessmentSessionSchema>;
export type StartSessionRequest = z.infer<typeof startSessionRequestSchema>;
export type SubmitSessionRequest = z.infer<typeof submitSessionRequestSchema>;
export type SessionStateEvent = z.infer<typeof sessionStateEventSchema>;
