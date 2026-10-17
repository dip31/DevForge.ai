import { z } from "zod";
import {
  uuidSchema,
  paginationSchema,
  paginatedResponseSchema,
  isoDateSchema,
  positiveIntSchema,
  nonNegativeIntSchema,
} from "./common";

export const assessmentStatusSchema = z.enum(["draft", "published", "archived"]);
export const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const assessmentSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  role: z.string().min(1).max(100),
  skills: z.string().min(1).max(500),
  durationMinutes: positiveIntSchema,
  difficulty: difficultySchema.default("intermediate"),
  status: assessmentStatusSchema.default("draft"),
  isPublic: z.boolean().default(false),
  createdBy: uuidSchema.nullable().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  publishedAt: isoDateSchema.nullable().optional(),
  archivedAt: isoDateSchema.nullable().optional(),
});

export const createAssessmentRequestSchema = z.object({
  organizationId: uuidSchema,
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  role: z.string().min(1).max(100),
  skills: z.string().min(1).max(500),
  durationMinutes: positiveIntSchema,
  difficulty: difficultySchema.default("intermediate"),
  isPublic: z.boolean().default(false),
});

export const updateAssessmentRequestSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(5000).optional(),
  role: z.string().min(1).max(100).optional(),
  skills: z.string().min(1).max(500).optional(),
  durationMinutes: positiveIntSchema.optional(),
  difficulty: difficultySchema.optional(),
  isPublic: z.boolean().optional(),
});

export const publishAssessmentRequestSchema = z.object({
  version: z.number().int().positive().optional(),
});

export const assessmentVersionSchema = z.object({
  id: uuidSchema,
  assessmentId: uuidSchema,
  version: z.number().int().positive(),
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  role: z.string().min(1).max(100),
  skills: z.string().min(1).max(500),
  durationMinutes: positiveIntSchema,
  difficulty: difficultySchema.default("intermediate"),
  starterFiles: z
    .array(
      z.object({
        path: z.string().min(1).max(500),
        language: z.string().min(1).max(50),
        content: z.string(),
        isReadOnly: z.boolean().default(false),
        isHidden: z.boolean().default(false),
        order: z.number().int().nonnegative().default(0),
      }),
    )
    .default([]),
  testConfig: z.record(z.unknown()).default({}),
  instructions: z.string().max(10000).nullable().optional(),
  aiPolicy: z.string().max(5000).nullable().optional(),
  createdAt: isoDateSchema,
  publishedAt: isoDateSchema.nullable().optional(),
  isCurrent: z.boolean().default(false),
});

export const rubricCriterionSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(2000),
  category: z.string().min(1).max(100),
  weight: positiveIntSchema,
  points: positiveIntSchema,
});

export const rubricVersionSchema = z.object({
  id: uuidSchema,
  assessmentVersionId: uuidSchema,
  version: z.number().int().positive(),
  criteria: z.array(rubricCriterionSchema).default([]),
  totalPoints: z.number().int().positive().default(100),
  createdAt: isoDateSchema,
  isCurrent: z.boolean().default(false),
});

export const assessmentFileSchema = z.object({
  id: uuidSchema,
  assessmentVersionId: uuidSchema,
  path: z.string().min(1).max(500),
  language: z.string().min(1).max(50),
  content: z.string(),
  isReadOnly: z.boolean().default(false),
  isHidden: z.boolean().default(false),
  order: z.number().int().nonnegative().default(0),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const assessmentTestConfigSchema = z.object({
  id: uuidSchema,
  assessmentVersionId: uuidSchema,
  testCommand: z.string().max(255).default("npm test"),
  runCommand: z.string().max(255).default("npm run"),
  timeoutSeconds: z.number().int().positive().default(30),
  maxOutputSize: z.number().int().positive().default(1048576),
  hiddenTestFiles: z.array(z.string()).default([]),
  publicTestFiles: z.array(z.string()).default([]),
  environmentVariables: z.record(z.string()).default({}),
  resourceLimits: z.record(z.unknown()).default({}),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const createRubricRequestSchema = z.object({
  criteria: z.array(rubricCriterionSchema).default([]),
  totalPoints: positiveIntSchema.default(100),
});

export const updateRubricRequestSchema = z.object({
  criteria: z.array(rubricCriterionSchema).optional(),
  totalPoints: positiveIntSchema.optional(),
});

export const createAssessmentFileRequestSchema = z.object({
  path: z.string().min(1).max(500),
  language: z.string().min(1).max(50),
  content: z.string(),
  isReadOnly: z.boolean().default(false),
  isHidden: z.boolean().default(false),
  order: nonNegativeIntSchema.default(0),
});

export const updateAssessmentFileRequestSchema = z.object({
  path: z.string().min(1).max(500).optional(),
  language: z.string().min(1).max(50).optional(),
  content: z.string().optional(),
  isReadOnly: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  order: nonNegativeIntSchema.optional(),
});

export const updateAssessmentTestConfigRequestSchema = z.object({
  testCommand: z.string().max(255).optional(),
  runCommand: z.string().max(255).optional(),
  timeoutSeconds: positiveIntSchema.optional(),
  maxOutputSize: positiveIntSchema.optional(),
  hiddenTestFiles: z.array(z.string()).optional(),
  publicTestFiles: z.array(z.string()).optional(),
  environmentVariables: z.record(z.string()).optional(),
  resourceLimits: z.record(z.unknown()).optional(),
});

export type Assessment = z.infer<typeof assessmentSchema>;
export type CreateAssessmentRequest = z.infer<typeof createAssessmentRequestSchema>;
export type UpdateAssessmentRequest = z.infer<typeof updateAssessmentRequestSchema>;
export type AssessmentVersion = z.infer<typeof assessmentVersionSchema>;
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;
export type RubricVersion = z.infer<typeof rubricVersionSchema>;
export type CreateRubricRequest = z.infer<typeof createRubricRequestSchema>;
export type UpdateRubricRequest = z.infer<typeof updateRubricRequestSchema>;
export type AssessmentFile = z.infer<typeof assessmentFileSchema>;
export type CreateAssessmentFileRequest = z.infer<typeof createAssessmentFileRequestSchema>;
export type UpdateAssessmentFileRequest = z.infer<typeof updateAssessmentFileRequestSchema>;
export type AssessmentTestConfig = z.infer<typeof assessmentTestConfigSchema>;
export type UpdateAssessmentTestConfigRequest = z.infer<
  typeof updateAssessmentTestConfigRequestSchema
>;
