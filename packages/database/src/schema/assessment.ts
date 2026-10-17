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
  check,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { organizations } from "./auth";
import { users } from "./auth";

export const assessmentStatusEnum = pgEnum("assessment_status", ["draft", "published", "archived"]);

export const difficultyEnum = pgEnum("difficulty", ["beginner", "intermediate", "advanced"]);

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    role: varchar("role", { length: 100 }).notNull(),
    skills: text("skills").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("intermediate"),
    status: assessmentStatusEnum("status").notNull().default("draft"),
    isPublic: boolean("is_public").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index("assessments_org_idx").on(table.organizationId),
    statusIdx: index("assessments_status_idx").on(table.status),
    createdByIdx: index("assessments_created_by_idx").on(table.createdBy),
  }),
);

export const assessmentVersions = pgTable(
  "assessment_versions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    role: varchar("role", { length: 100 }).notNull(),
    skills: text("skills").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("intermediate"),
    starterFiles: jsonb("starter_files").notNull().default("[]"),
    testConfig: jsonb("test_config").notNull().default("{}"),
    instructions: text("instructions"),
    aiPolicy: text("ai_policy"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    isCurrent: boolean("is_current").notNull().default(false),
  },
  (table) => ({
    assessmentVersionIdx: uniqueIndex("assessment_versions_assessment_version_idx").on(
      table.assessmentId,
      table.version,
    ),
    assessmentIdx: index("assessment_versions_assessment_idx").on(table.assessmentId),
    currentIdx: index("assessment_versions_current_idx").on(table.isCurrent),
  }),
);

export const rubricVersions = pgTable(
  "rubric_versions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    assessmentVersionId: uuid("assessment_version_id")
      .notNull()
      .references(() => assessmentVersions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    criteria: jsonb("criteria").notNull().default("[]"),
    totalPoints: integer("total_points").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    isCurrent: boolean("is_current").notNull().default(false),
  },
  (table) => ({
    versionIdx: uniqueIndex("rubric_versions_version_idx").on(
      table.assessmentVersionId,
      table.version,
    ),
    assessmentVersionIdx: index("rubric_versions_assessment_version_idx").on(
      table.assessmentVersionId,
    ),
    currentIdx: index("rubric_versions_current_idx").on(table.isCurrent),
  }),
);

export const assessmentFiles = pgTable(
  "assessment_files",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    assessmentVersionId: uuid("assessment_version_id")
      .notNull()
      .references(() => assessmentVersions.id, { onDelete: "cascade" }),
    path: varchar("path", { length: 500 }).notNull(),
    language: varchar("language", { length: 50 }).notNull(),
    content: text("content").notNull(),
    isReadOnly: boolean("is_read_only").notNull().default(false),
    isHidden: boolean("is_hidden").notNull().default(false),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    versionPathIdx: uniqueIndex("assessment_files_version_path_idx").on(
      table.assessmentVersionId,
      table.path,
    ),
    versionIdx: index("assessment_files_version_idx").on(table.assessmentVersionId),
  }),
);

export const assessmentTestConfigs = pgTable(
  "assessment_test_configs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    assessmentVersionId: uuid("assessment_version_id")
      .notNull()
      .references(() => assessmentVersions.id, { onDelete: "cascade" })
      .unique(),
    testCommand: varchar("test_command", { length: 255 }).notNull().default("npm test"),
    runCommand: varchar("run_command", { length: 255 }).notNull().default("npm run"),
    timeoutSeconds: integer("timeout_seconds").notNull().default(30),
    maxOutputSize: integer("max_output_size").notNull().default(1048576),
    hiddenTestFiles: jsonb("hidden_test_files").notNull().default("[]"),
    publicTestFiles: jsonb("public_test_files").notNull().default("[]"),
    environmentVariables: jsonb("environment_variables").notNull().default("{}"),
    resourceLimits: jsonb("resource_limits").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    versionIdx: uniqueIndex("test_configs_version_idx").on(table.assessmentVersionId),
  }),
);
