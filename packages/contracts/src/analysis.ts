import { z } from "zod";
import { uuidSchema, isoDateSchema } from "./common";

export const analysisStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
]);

export const findingCategorySchema = z.enum([
  "requirement",
  "test",
  "build",
  "type_check",
  "code_quality",
  "security",
  "performance",
]);

export const findingSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

export const verificationStatusSchema = z.enum([
  "verified",
  "unverified",
  "unavailable",
  "conflicting",
]);

export const analysisResultSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  assignmentId: uuidSchema,
  assessmentId: uuidSchema,
  revisionId: uuidSchema,
  status: analysisStatusSchema,
  filesAnalyzed: z.number().int().nonnegative(),
  testsRun: z.number().int().nonnegative(),
  testsPassed: z.number().int().nonnegative(),
  testsFailed: z.number().int().nonnegative(),
  requirementsCovered: z.number().int().nonnegative(),
  requirementsTotal: z.number().int().nonnegative(),
  codeQualityScore: z.number().int().min(0).max(100).nullable(),
  findings: z.array(
    z.object({
      id: z.string(),
      category: findingCategorySchema,
      severity: findingSeveritySchema,
      title: z.string().min(1).max(255),
      message: z.string().min(1).max(5000),
      file: z.string().max(500).nullable().optional(),
      line: z.number().int().positive().nullable().optional(),
      evidenceIds: z.array(uuidSchema).default([]),
      verificationStatus: verificationStatusSchema,
      metadata: z.record(z.unknown()).default({}),
    }),
  ),
  limitations: z.array(z.string()).default([]),
  provider: z.string().max(50).nullable(),
  providerModel: z.string().max(100).nullable(),
  analysisVersion: z.string().max(50),
  createdAt: isoDateSchema,
  completedAt: isoDateSchema.nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const startAnalysisRequestSchema = z.object({
  sessionId: uuidSchema,
  revisionId: uuidSchema.optional(),
  includeAIReview: z.boolean().default(true),
});

export const analysisProgressSchema = z.object({
  id: uuidSchema,
  status: analysisStatusSchema,
  progress: z.number().int().min(0).max(100),
  currentStage: z.string().max(100).nullable(),
  message: z.string().max(500).nullable(),
  updatedAt: isoDateSchema,
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisFinding = AnalysisResult["findings"][number];
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type FindingCategory = z.infer<typeof findingCategorySchema>;
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type StartAnalysisRequest = z.infer<typeof startAnalysisRequestSchema>;
export type AnalysisProgress = z.infer<typeof analysisProgressSchema>;
