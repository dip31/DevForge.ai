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
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { assessmentSessions } from "./assignments";
import { assessmentVersions } from "./assessment";

export const fileTypeEnum = pgEnum("file_type", ["source", "test", "config", "asset", "other"]);

export const workspaceRevisions = pgTable(
  "workspace_revisions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    files: jsonb("files").notNull().default("[]"),
    message: text("message"),
    isSnapshot: boolean("is_snapshot").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionRevisionIdx: uniqueIndex("revisions_session_number_idx").on(
      table.sessionId,
      table.revisionNumber,
    ),
    sessionIdx: index("revisions_session_idx").on(table.sessionId),
  }),
);

export const sessionFiles = pgTable(
  "session_files",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    path: varchar("path", { length: 500 }).notNull(),
    language: varchar("language", { length: 50 }).notNull(),
    content: text("content").notNull(),
    isReadOnly: boolean("is_read_only").notNull().default(false),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionPathIdx: uniqueIndex("session_files_session_path_idx").on(table.sessionId, table.path),
    sessionIdx: index("session_files_session_idx").on(table.sessionId),
  }),
);

export const executionStatusEnum = pgEnum("execution_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "timeout",
  "cancelled",
]);

export const executionRuns = pgTable(
  "execution_runs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => workspaceRevisions.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull().default("run"),
    command: text("command"),
    status: executionStatusEnum("status").notNull().default("pending"),
    exitCode: integer("exit_code"),
    stdout: text("stdout"),
    stderr: text("stderr"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    resourceUsage: jsonb("resource_usage").default("{}"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("execution_runs_session_idx").on(table.sessionId),
    revisionIdx: index("execution_runs_revision_idx").on(table.revisionId),
    statusIdx: index("execution_runs_status_idx").on(table.status),
  }),
);

export const testRunStatusEnum = pgEnum("test_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const testResults = pgTable(
  "test_results",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    executionRunId: uuid("execution_run_id")
      .notNull()
      .references(() => executionRuns.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => workspaceRevisions.id, { onDelete: "cascade" }),
    testSuite: varchar("test_suite", { length: 255 }),
    testName: varchar("test_name", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    durationMs: integer("duration_ms"),
    output: text("output"),
    error: text("error"),
    criterion: varchar("criterion", { length: 255 }),
    isHidden: boolean("is_hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("test_results_session_idx").on(table.sessionId),
    executionRunIdx: index("test_results_execution_run_idx").on(table.executionRunId),
    revisionIdx: index("test_results_revision_idx").on(table.revisionId),
    statusIdx: index("test_results_status_idx").on(table.status),
  }),
);

export const executionArtifacts = pgTable(
  "execution_artifacts",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    executionRunId: uuid("execution_run_id")
      .notNull()
      .references(() => executionRuns.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    storagePath: varchar("storage_path", { length: 500 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    executionRunIdx: index("execution_artifacts_run_idx").on(table.executionRunId),
  }),
);
