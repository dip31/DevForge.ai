import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
  jsonb,
  decimal,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { assessmentSessions } from "./assignments";
import { users, organizations } from "./auth";

export const aiProviderEnum = pgEnum("ai_provider", ["openai", "anthropic", "groq", "local"]);

export const aiInteractionTypeEnum = pgEnum("ai_interaction_type", [
  "coach_prompt",
  "coach_response",
  "mentor_prompt",
  "mentor_response",
  "code_generation",
  "code_explanation",
  "debugging_help",
]);

export const aiUsageRecords = pgTable(
  "ai_usage_records",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sessionId: uuid("session_id").references(() => assessmentSessions.id, {
      onDelete: "set null",
    }),
    provider: aiProviderEnum("provider").notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    interactionType: aiInteractionTypeEnum("interaction_type").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    estimatedCost: decimal("estimated_cost", { precision: 10, scale: 6 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("ai_usage_org_idx").on(table.organizationId),
    candidateIdx: index("ai_usage_candidate_idx").on(table.candidateId),
    sessionIdx: index("ai_usage_session_idx").on(table.sessionId),
    createdAtIdx: index("ai_usage_created_at_idx").on(table.createdAt),
  }),
);

export const aiInteractions = pgTable(
  "ai_interactions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    usageRecordId: uuid("usage_record_id").references(() => aiUsageRecords.id, {
      onDelete: "set null",
    }),
    type: aiInteractionTypeEnum("type").notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    explanation: text("explanation"),
    suggestion: jsonb("suggestion"),
    model: varchar("model", { length: 100 }).notNull(),
    provider: aiProviderEnum("provider").notNull(),
    tokensUsed: integer("tokens_used").notNull().default(0),
    latencyMs: integer("latency_ms"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("ai_interactions_session_idx_v2").on(table.sessionId),
    typeIdx: index("ai_interactions_type_idx_v2").on(table.type),
    createdAtIdx: index("ai_interactions_created_at_idx_v2").on(table.createdAt),
  }),
);

export const aiProviderConfigs = pgTable(
  "ai_provider_configs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .unique(),
    provider: aiProviderEnum("provider").notNull(),
    apiKeyEncrypted: text("api_key_encrypted"),
    defaultModel: varchar("default_model", { length: 100 }).notNull(),
    fallbackModels: jsonb("fallback_models").notNull().default("[]"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),
    maxTokensPerRequest: integer("max_tokens_per_request").notNull().default(4096),
    temperature: decimal("temperature", { precision: 3, scale: 2 }).notNull().default("0.7"),
    maxCostPerMonth: decimal("max_cost_per_month", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: uniqueIndex("ai_configs_org_idx").on(table.organizationId),
    providerIdx: index("ai_configs_provider_idx").on(table.provider),
  }),
);
