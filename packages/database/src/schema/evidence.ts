import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { assessmentSessions, candidateAssignments } from "./assignments";
import { users, organizations } from "./auth";
import { assessments } from "./assessment";
import { workspaceRevisions, executionRuns, testResults } from "./workspace";

export const evidenceTypeEnum = pgEnum("evidence_type", [
  "submitted_snapshot",
  "earlier_snapshot",
  "test_result",
  "application_run",
  "ai_coach_prompt",
  "ai_coach_response",
  "file_event",
  "assessment_event",
  "terminal_command",
]);

export const evidenceIntegrityEnum = pgEnum("evidence_integrity", [
  "available",
  "partial",
  "unavailable",
  "mismatch",
]);

export const evidenceProvenanceEnum = pgEnum("evidence_provenance", [
  "candidate_action",
  "system_generated",
  "unknown",
]);

export const evidenceRecords = pgTable(
  "evidence_records",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => candidateAssignments.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    type: evidenceTypeEnum("type").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    summary: text("summary").notNull(),
    file: varchar("file", { length: 500 }),
    revisionId: uuid("revision_id").references(() => workspaceRevisions.id, {
      onDelete: "set null",
    }),
    sourceEventId: varchar("source_event_id", { length: 255 }),
    resultId: varchar("result_id", { length: 255 }),
    contentRef: varchar("content_ref", { length: 255 }).notNull(),
    provenance: evidenceProvenanceEnum("provenance").notNull(),
    integrity: evidenceIntegrityEnum("integrity").notNull().default("available"),
    testStatus: varchar("test_status", { length: 50 }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("evidence_session_idx").on(table.sessionId),
    candidateIdx: index("evidence_candidate_idx").on(table.candidateId),
    typeIdx: index("evidence_type_idx").on(table.type),
    timestampIdx: index("evidence_timestamp_idx").on(table.timestamp),
    contentRefIdx: uniqueIndex("evidence_content_ref_idx").on(table.contentRef),
  }),
);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    file: varchar("file", { length: 500 }),
    revisionId: uuid("revision_id").references(() => workspaceRevisions.id, {
      onDelete: "set null",
    }),
    resultId: uuid("result_id").references(() => testResults.id, {
      onDelete: "set null",
    }),
    terminalId: varchar("terminal_id", { length: 255 }),
    detail: text("detail").notNull(),
    provenance: evidenceProvenanceEnum("provenance").notNull(),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("activity_events_session_idx").on(table.sessionId),
    typeIdx: index("activity_events_type_idx").on(table.type),
    timestampIdx: index("activity_events_timestamp_idx").on(table.timestamp),
  }),
);

// aiInteractions is defined in ./ai (imported directly when needed)

export const codeRevisionLinks = pgTable(
  "code_revision_links",
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
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidenceRecords.id, { onDelete: "cascade" }),
    linkType: varchar("link_type", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    revisionIdx: index("code_revision_links_revision_idx").on(table.revisionId),
    evidenceIdx: index("code_revision_links_evidence_idx").on(table.evidenceId),
  }),
);
