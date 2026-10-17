import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { assessmentSessions, candidateAssignments } from "./assignments";
import { workspaceRevisions } from "./workspace";
import { assessments } from "./assessment";

export const analysisStatusEnum = pgEnum("analysis_status", [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
]);

export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => candidateAssignments.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => workspaceRevisions.id, { onDelete: "cascade" }),
    status: analysisStatusEnum("status").notNull().default("pending"),
    filesAnalyzed: integer("files_analyzed").notNull().default(0),
    testsRun: integer("tests_run").notNull().default(0),
    testsPassed: integer("tests_passed").notNull().default(0),
    testsFailed: integer("tests_failed").notNull().default(0),
    requirementsCovered: integer("requirements_covered").notNull().default(0),
    requirementsTotal: integer("requirements_total").notNull().default(0),
    codeQualityScore: integer("code_quality_score"),
    findings: jsonb("findings").notNull().default("[]"),
    limitations: jsonb("limitations").notNull().default("[]"),
    provider: varchar("provider", { length: 50 }),
    providerModel: varchar("provider_model", { length: 100 }),
    analysisVersion: varchar("analysis_version", { length: 50 }).notNull(),
    metadata: jsonb("metadata").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    sessionIdx: index("analysis_runs_session_idx").on(table.sessionId),
    assignmentIdx: index("analysis_runs_assignment_idx").on(table.assignmentId),
    statusIdx: index("analysis_runs_status_idx").on(table.status),
    revisionIdx: index("analysis_runs_revision_idx").on(table.revisionId),
  }),
);
