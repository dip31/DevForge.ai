import { z } from "zod";

import { uuidSchema, isoDateSchema } from "./common";

import { evaluationStatusSchema } from "./evaluation";

export const reviewQueueStatusSchema = z.enum([
  "awaiting_evaluation",

  "ready_for_review",

  "in_review",

  "reviewed",

  "needs_attention",
]);

export const reviewQueueItemSchema = z.object({
  id: uuidSchema,

  evaluationId: uuidSchema,

  candidateId: uuidSchema,

  organizationId: uuidSchema,

  assignmentId: uuidSchema,

  status: reviewQueueStatusSchema.default("awaiting_evaluation"),

  priority: z.number().int().default(0),

  assignedReviewerId: uuidSchema.nullable().optional(),

  submittedAt: z.string().datetime(),

  evaluationCompletedAt: z.string().datetime().nullable().optional(),

  reviewStartedAt: z.string().datetime().nullable().optional(),

  reviewCompletedAt: z.string().datetime().nullable().optional(),

  metadata: z.record(z.unknown()).default({}),

  createdAt: isoDateSchema,

  updatedAt: isoDateSchema,
});

export const reviewQueueFilterSchema = z.object({
  status: reviewQueueStatusSchema.optional(),

  organizationId: uuidSchema.optional(),

  reviewerId: uuidSchema.optional(),

  dateFrom: isoDateSchema.optional(),

  dateTo: isoDateSchema.optional(),
});

export const assignReviewerRequestSchema = z.object({
  reviewerId: uuidSchema,
});

export const reviewerNoteSchema = z.object({
  id: uuidSchema,

  evaluationId: uuidSchema,

  reviewerId: uuidSchema,

  note: z.string().min(1).max(10000),

  isInternal: z.boolean().default(true),

  criterionId: uuidSchema.nullable().optional(),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),
});

export const createReviewerNoteRequestSchema = z.object({
  evaluationId: uuidSchema,

  note: z.string().min(1).max(10000),

  isInternal: z.boolean().default(true),

  criterionId: uuidSchema.optional(),
});

export const updateReviewerNoteRequestSchema = z.object({
  note: z.string().min(1).max(10000).optional(),

  isInternal: z.boolean().optional(),

  criterionId: uuidSchema.nullable().optional(),
});

export const reviewerDecisionSchema = z.object({
  id: uuidSchema,

  evaluationId: uuidSchema,

  reviewerId: uuidSchema,

  overallOutcome: z.string().min(1).max(50),

  criterionDecisions: z
    .array(
      z.object({
        criterionId: uuidSchema,

        status: evaluationStatusSchema,

        notes: z.string().max(2000).optional(),
      }),
    )
    .default([]),

  notes: z.string().max(10000).nullable().optional(),

  isFinal: z.boolean().default(false),

  decidedAt: z.string().datetime(),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),
});

export const createReviewerDecisionRequestSchema = z.object({
  evaluationId: uuidSchema,

  overallOutcome: z.string().min(1).max(50),

  criterionDecisions: z
    .array(
      z.object({
        criterionId: uuidSchema,

        status: evaluationStatusSchema,

        notes: z.string().max(2000).optional(),
      }),
    )
    .default([]),

  notes: z.string().max(10000).optional(),

  isFinal: z.boolean().default(false),
});

export const candidateFeedbackSchema = z.object({
  id: uuidSchema,

  evaluationId: uuidSchema,

  feedback: z.record(z.unknown()).default({}),

  isAvailable: z.boolean().default(false),

  releasedAt: z.string().datetime().nullable().optional(),

  releasedBy: uuidSchema.nullable().optional(),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),
});

export const releaseFeedbackRequestSchema = z.object({
  evaluationId: uuidSchema,
});

export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;

export type ReviewQueueFilter = z.infer<typeof reviewQueueFilterSchema>;

export type AssignReviewerRequest = z.infer<typeof assignReviewerRequestSchema>;

export type ReviewerNote = z.infer<typeof reviewerNoteSchema>;

export type CreateReviewerNoteRequest = z.infer<typeof createReviewerNoteRequestSchema>;

export type UpdateReviewerNoteRequest = z.infer<typeof updateReviewerNoteRequestSchema>;

export type ReviewerDecision = z.infer<typeof reviewerDecisionSchema>;

export type CreateReviewerDecisionRequest = z.infer<typeof createReviewerDecisionRequestSchema>;

export type CandidateFeedback = z.infer<typeof candidateFeedbackSchema>;

export type ReleaseFeedbackRequest = z.infer<typeof releaseFeedbackRequestSchema>;
