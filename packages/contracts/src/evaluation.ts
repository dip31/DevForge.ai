import { z } from "zod";

import { uuidSchema, isoDateSchema } from "./common";

export const evaluationStatusSchema = z.enum([
  "demonstrated",

  "partially_demonstrated",

  "not_demonstrated_in_available_evidence",

  "inconclusive",

  "invalid_assessment_evidence",
]);

export const evidenceSufficiencySchema = z.enum([
  "sufficient",

  "partial",

  "insufficient",

  "invalid",
]);

export const evaluationRecordStatusSchema = z.enum([
  "awaiting_evaluation",

  "ready_for_review",

  "inconclusive",

  "needs_attention",

  "reviewed",
]);

export const reviewerStatusSchema = z.enum([
  "pending",

  "in_review",

  "reviewed",

  "needs_attention",
]);

export const reviewActionSchema = z.enum([
  "accepted",

  "overridden",

  "clarification_requested",
]);

export const evaluationSchema = z.object({
  id: uuidSchema,

  version: z.number().int().positive().default(1),

  previousEvaluationId: uuidSchema.nullable().optional(),

  candidateId: uuidSchema,

  candidateName: z.string().min(1).max(255),

  organizationId: uuidSchema,

  organizationName: z.string().min(1).max(255),

  assignmentId: uuidSchema,

  assessmentId: uuidSchema,

  assessmentTitle: z.string().min(1).max(255),

  taskTitle: z.string().min(1).max(255),

  sessionId: uuidSchema,

  submissionRevisionId: uuidSchema,

  submissionTimestamp: z.string().datetime(),

  rubricVersion: z.string().min(1).max(100),

  evaluatorVersion: z.string().min(1).max(100),

  evaluatorMethod: z.string().min(1).max(100),

  evaluatedAt: z.string().datetime(),

  evidenceCoverage: z.number().int().min(0).max(100).default(0),

  aggregateScore: z.number().int().min(0).max(100).nullable().optional(),

  excludedCriteria: z.array(z.string()).default([]),

  evaluationStatus: evaluationRecordStatusSchema.default("awaiting_evaluation"),

  limitations: z.array(z.string()).default([]),

  conflicts: z.array(z.string()).default([]),

  reviewerStatus: reviewerStatusSchema.default("pending"),

  reviewerOutcome: z.string().max(50).nullable().optional(),

  internalReviewerNotes: z.string().max(10000).default(""),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),
});

export const evaluationCriterionSchema = z.object({
  id: uuidSchema,

  evaluationId: uuidSchema,

  criterionId: z.string().min(1).max(100),

  name: z.string().min(1).max(255),

  description: z.string().min(1).max(2000),

  rubric: z.string().min(1).max(5000),

  weight: z.number().int().positive(),

  status: evaluationStatusSchema,

  supportedScore: z.number().int().min(0).max(100).nullable().optional(),

  sufficiency: evidenceSufficiencySchema,

  missingEvidence: z.array(z.string()).default([]),

  explanation: z.string().min(1).max(5000),

  candidateVisible: z.boolean().default(true),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),
});

export const findingEvidenceLinkSchema = z.object({
  id: uuidSchema,

  criterionId: uuidSchema,

  evidenceId: uuidSchema,

  linkType: z.string().min(1).max(50),

  createdAt: z.string().datetime(),
});

export const reviewEventSchema = z.object({
  id: uuidSchema,

  evaluationId: uuidSchema,

  criterionId: uuidSchema,

  action: reviewActionSchema,

  previousStatus: evaluationStatusSchema,

  newStatus: evaluationStatusSchema,

  reviewerId: uuidSchema,

  reviewerName: z.string().min(1).max(255),

  reason: z.string().min(1).max(5000),

  evidenceIds: z.array(uuidSchema).default([]),

  timestamp: z.string().datetime(),
});

export const reviewOverrideRequestSchema = z.object({
  criterionId: uuidSchema,

  newStatus: evaluationStatusSchema,

  reason: z.string().min(1).max(5000),

  evidenceIds: z.array(uuidSchema).default([]),
});

export type Evaluation = z.infer<typeof evaluationSchema>;

export type EvaluationCriterion = z.infer<typeof evaluationCriterionSchema>;

export type FindingEvidenceLink = z.infer<typeof findingEvidenceLinkSchema>;

export type ReviewEvent = z.infer<typeof reviewEventSchema>;

export type ReviewOverrideRequest = z.infer<typeof reviewOverrideRequestSchema>;
