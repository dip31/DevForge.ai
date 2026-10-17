import { z } from "zod";
import {
  uuidSchema,
  paginationSchema,
  paginatedResponseSchema,
  isoDateSchema,
  positiveIntSchema,
} from "./common";

export const aiProviderSchema = z.enum(["openai", "anthropic", "groq", "local"]);
export const aiInteractionTypeSchema = z.enum([
  "coach_prompt",
  "coach_response",
  "mentor_prompt",
  "mentor_response",
  "code_generation",
  "code_explanation",
  "debugging_help",
]);

export const aiUsageRecordSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  candidateId: uuidSchema.nullable().optional(),
  sessionId: uuidSchema.nullable().optional(),
  provider: aiProviderSchema,
  model: z.string().min(1).max(100),
  interactionType: aiInteractionTypeSchema,
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  estimatedCost: z.number().nonnegative().default(0),
  currency: z.string().length(3).default("USD"),
  metadata: z.record(z.unknown()).default({}),
  createdAt: isoDateSchema,
});

export const aiSuggestionSchema = z.object({
  file: z.string().min(1).max(500),
  content: z.string(),
  label: z.string().min(1).max(255),
});

export const aiInteractionSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  usageRecordId: uuidSchema.nullable().optional(),
  type: z.enum([
    "coach_prompt",
    "coach_response",
    "mentor_prompt",
    "mentor_response",
    "code_generation",
    "code_explanation",
    "debugging_help",
  ]),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(50000),
  explanation: z.string().max(50000).nullable().optional(),
  suggestion: aiSuggestionSchema.nullable().optional(),
  model: z.string().min(1).max(100),
  provider: aiProviderSchema,
  tokensUsed: z.number().int().nonnegative().default(0),
  latencyMs: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: isoDateSchema,
});

export const aiProviderConfigSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  provider: aiProviderSchema,
  apiKeyEncrypted: z.string().nullable().optional(),
  defaultModel: z.string().min(1).max(100),
  fallbackModels: z.array(z.string()).default([]),
  isEnabled: z.boolean().default(true),
  rateLimitPerMinute: z.number().int().positive().default(60),
  maxTokensPerRequest: z.number().int().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  maxCostPerMonth: z.number().nonnegative().nullable().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const updateAiProviderConfigRequestSchema = z.object({
  provider: aiProviderSchema.optional(),
  apiKey: z.string().optional(),
  defaultModel: z.string().min(1).max(100).optional(),
  fallbackModels: z.array(z.string()).optional(),
  isEnabled: z.boolean().optional(),
  rateLimitPerMinute: z.number().int().positive().optional(),
  maxTokensPerRequest: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxCostPerMonth: z.number().nonnegative().nullable().optional(),
});

export const aiCoachContextFileSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(200000),
});

export const aiCoachContextSchema = z.object({
  currentFile: z.string().max(500).optional(),
  files: z.array(aiCoachContextFileSchema).max(200).optional(),
  // Assessment context the candidate can already see in the workspace. Used to
  // ground hints on real acceptance criteria instead of fabricated ones.
  instructions: z.string().max(10000).nullable().optional(),
  requirements: z.array(z.string().max(500)).max(100).optional(),
  testResults: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        name: z.string().max(200),
        status: z.enum(["passed", "failed", "pending"]),
        diagnostic: z.string().max(2000),
        criterion: z.string().max(200).optional(),
      }),
    )
    .max(200)
    .optional(),
});

export const aiCoachHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(50000),
});

export const aiCoachRequestSchema = z.object({
  sessionId: uuidSchema.optional(),
  action: z.enum(["hint", "explain", "debug", "prompt"]),
  prompt: z.string().max(5000).optional(),
  context: aiCoachContextSchema.optional(),
  // Prior turns supplied by the client so the model can follow the conversation.
  // Bounded and never trusted for permissions or hidden data.
  history: z.array(aiCoachHistoryMessageSchema).max(20).optional(),
});

export const aiCoachResponseSchema = z.object({
  id: z.string().min(1).max(100),
  sessionId: z.string().max(100).nullable(),
  type: aiInteractionTypeSchema,
  role: z.literal("assistant"),
  content: z.string().min(1).max(50000),
  explanation: z.string().max(5000).nullable(),
  suggestion: aiSuggestionSchema.nullable(),
  provider: aiProviderSchema,
  model: z.string().min(1).max(100),
  tokensUsed: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative().nullable(),
  persisted: z.boolean(),
  createdAt: isoDateSchema,
});

export const aiMentorRequestSchema = z.object({
  sessionId: uuidSchema,
  question: z.string().min(1).max(5000),
  filePath: z.string().max(500).optional(),
});

export const aiCodeGenerationRequestSchema = z.object({
  sessionId: uuidSchema,
  prompt: z.string().min(1).max(5000),
  language: z.string().min(1).max(50),
  context: z.record(z.unknown()).default({}),
});

export type AiUsageRecord = z.infer<typeof aiUsageRecordSchema>;
export type AiInteraction = z.infer<typeof aiInteractionSchema>;
export type AiProviderConfig = z.infer<typeof aiProviderConfigSchema>;
export type UpdateAiProviderConfigRequest = z.infer<typeof updateAiProviderConfigRequestSchema>;
export type AiCoachContext = z.infer<typeof aiCoachContextSchema>;
export type AiCoachContextFile = z.infer<typeof aiCoachContextFileSchema>;
export type AiCoachHistoryMessage = z.infer<typeof aiCoachHistoryMessageSchema>;
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;
export type AiCoachRequest = z.infer<typeof aiCoachRequestSchema>;
export type AiCoachResponse = z.infer<typeof aiCoachResponseSchema>;
export type AiMentorRequest = z.infer<typeof aiMentorRequestSchema>;
export type AiCodeGenerationRequest = z.infer<typeof aiCodeGenerationRequestSchema>;
