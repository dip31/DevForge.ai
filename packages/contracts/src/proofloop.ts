import { z } from "zod";

import { uuidSchema, isoDateSchema, paginationSchema, paginatedResponseSchema } from "./common";

export const RUNNER_KIND = "javascript-function" as const;

export const testVisibilitySchema = z.enum(["public", "private"]);

export const runnerTestSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  suite: z.string().max(255).optional(),
  criterion: z.string().min(1).max(255),
  visibility: testVisibilitySchema.default("public"),
  args: z.array(z.unknown()).default([]),
  expected: z.unknown(),
  description: z.string().max(2000).optional(),
});

export const runnerTestConfigSchema = z.object({
  runner: z.literal(RUNNER_KIND).default(RUNNER_KIND),
  entryFile: z.string().min(1).max(500),
  exportName: z.string().min(1).max(100),
  timeoutMs: z.number().int().positive().max(10000).default(2000),
  tests: z.array(runnerTestSchema).default([]),
});

export const submissionFileSchema = z.object({
  path: z.string().min(1).max(500),
  language: z.string().min(1).max(50).default("javascript"),
  content: z.string(),
});

export const submissionKindSchema = z.enum(["assessment", "verification_followup"]);

export const createSubmissionRequestSchema = z.object({
  kind: submissionKindSchema.default("assessment"),
  challengeId: uuidSchema.optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
  files: z.array(submissionFileSchema).min(1).max(200),
});

export const redactedTestResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  suite: z.string().nullable().optional(),
  criterion: z.string().nullable().optional(),
  status: z.enum(["passed", "failed", "error"]),
  hidden: z.boolean(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  message: z.string(),
});

export const submissionSummarySchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  submissionVersion: z.number().int().positive(),
  kind: submissionKindSchema,
  challengeId: uuidSchema.nullable().optional(),
  status: z.enum(["completed", "failed", "cancelled"]),
  passedTests: z.number().int().nonnegative(),
  totalTests: z.number().int().nonnegative(),
  submittedAt: isoDateSchema,
  results: z.array(redactedTestResultSchema).default([]),
});

export const skillStatusSchema = z.enum([
  "demonstrated",
  "partially_demonstrated",
  "not_demonstrated_in_available_evidence",
  "not_assessed",
  "inconclusive",
]);

export const skillAssessmentSchema = z.object({
  id: uuidSchema,
  criterionId: z.string(),
  skillKey: z.string(),
  name: z.string(),
  status: skillStatusSchema,
  originalStatus: skillStatusSchema,
  explanation: z.string(),
  evidenceIds: z.array(z.string()).default([]),
  lastChallengeId: uuidSchema.nullable().optional(),
});

export const skillGapSchema = z.object({
  criterionId: z.string(),
  skillKey: z.string(),
  name: z.string(),
  status: skillStatusSchema,
  reason: z.string(),
  gapType: z.enum(["demonstrated", "partially_demonstrated", "not_assessed", "inconclusive", "not_demonstrated"]),
});

export const challengeTemplateSchema = z.object({
  id: uuidSchema,
  key: z.string(),
  title: z.string(),
  description: z.string(),
  skillKey: z.string(),
  targetCriterionId: z.string(),
  prompt: z.string(),
  instructions: z.string(),
  entryFile: z.string(),
  exportName: z.string(),
  isActive: z.boolean(),
  privateTests: z.array(runnerTestSchema).optional(),
});

export const challengeStatusSchema = z.enum([
  "offered",
  "in_progress",
  "submitted",
  "verified",
  "failed",
  "expired",
  "revoked",
]);

export const verificationChallengeSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  evaluationId: uuidSchema.nullable().optional(),
  templateKey: z.string(),
  criterionId: z.string(),
  skillKey: z.string(),
  title: z.string(),
  prompt: z.string(),
  instructions: z.string(),
  entryFile: z.string(),
  exportName: z.string(),
  status: challengeStatusSchema,
  triggerSummary: z.string(),
  originalStatus: skillStatusSchema,
  resultStatus: skillStatusSchema.nullable().optional(),
  passedTests: z.number().int().nonnegative(),
  totalTests: z.number().int().nonnegative(),
  offeredAt: isoDateSchema,
  submittedAt: isoDateSchema.nullable().optional(),
  completedAt: isoDateSchema.nullable().optional(),
  privateTests: z.array(runnerTestSchema).optional(),
});

export const createChallengeRequestSchema = z.object({
  templateKey: z.string().min(1).max(100),
});

export const proofLoopSessionStateSchema = z.object({
  sessionId: uuidSchema,
  skills: z.array(skillAssessmentSchema).default([]),
  gaps: z.array(skillGapSchema).default([]),
  challenges: z.array(verificationChallengeSchema).default([]),
});

export const proofLoopReportSchema = z.object({
  sessionId: uuidSchema,
  evaluationId: uuidSchema.nullable().optional(),
  assessmentTitle: z.string().nullable().optional(),
  skills: z.array(skillAssessmentSchema).default([]),
  challenges: z.array(verificationChallengeSchema).default([]),
  submissions: z.array(submissionSummarySchema).default([]),
});

export type RunnerTest = z.infer<typeof runnerTestSchema>;
export type RunnerTestConfig = z.infer<typeof runnerTestConfigSchema>;
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>;
export type RedactedTestResult = z.infer<typeof redactedTestResultSchema>;
export type SubmissionSummary = z.infer<typeof submissionSummarySchema>;
export type SkillStatus = z.infer<typeof skillStatusSchema>;
export type SkillAssessment = z.infer<typeof skillAssessmentSchema>;
export type SkillGap = z.infer<typeof skillGapSchema>;
export type ChallengeTemplate = z.infer<typeof challengeTemplateSchema>;
export type VerificationChallenge = z.infer<typeof verificationChallengeSchema>;
export type CreateChallengeRequest = z.infer<typeof createChallengeRequestSchema>;
export type ProofLoopSessionState = z.infer<typeof proofLoopSessionStateSchema>;
export type ProofLoopReport = z.infer<typeof proofLoopReportSchema>;

export { paginationSchema, paginatedResponseSchema };
