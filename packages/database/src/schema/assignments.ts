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
import { users, organizations } from "./auth";
import { assessments, assessmentVersions } from "./assessment";

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "invited",
  "in_progress",
  "submitted",
  "evaluated",
  "reviewed",
  "expired",
  "withdrawn",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "not_started",
  "in_progress",
  "paused",
  "submitted",
  "expired",
]);

export const candidateAssignments = pgTable(
  "candidate_assignments",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    assessmentVersionId: uuid("assessment_version_id")
      .notNull()
      .references(() => assessmentVersions.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: assignmentStatusEnum("status").notNull().default("invited"),
    deadline: timestamp("deadline", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    withdrawnReason: text("withdrawn_reason"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgCandidateIdx: uniqueIndex("assignments_org_candidate_idx").on(
      table.organizationId,
      table.candidateId,
      table.assessmentId,
    ),
    orgIdx: index("assignments_org_idx").on(table.organizationId),
    candidateIdx: index("assignments_candidate_idx").on(table.candidateId),
    assessmentIdx: index("assignments_assessment_idx").on(table.assessmentId),
    statusIdx: index("assignments_status_idx").on(table.status),
    deadlineIdx: index("assignments_deadline_idx").on(table.deadline),
  }),
);

export const assessmentSessions = pgTable(
  "assessment_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => candidateAssignments.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assessmentVersionId: uuid("assessment_version_id")
      .notNull()
      .references(() => assessmentVersions.id, { onDelete: "cascade" }),
    status: sessionStatusEnum("status").notNull().default("not_started"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    resumedAt: timestamp("resumed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    timeRemainingSeconds: integer("time_remaining_seconds"),
    totalPausedSeconds: integer("total_paused_seconds").notNull().default(0),
    currentFile: varchar("current_file", { length: 500 }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentIdx: uniqueIndex("sessions_assignment_idx").on(table.assignmentId),
    candidateIdx: index("sessions_candidate_idx").on(table.candidateId),
    statusIdx: index("sessions_status_idx").on(table.status),
    expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
  }),
);

export const sessionStateEvents = pgTable(
  "session_state_events",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    previousStatus: sessionStatusEnum("previous_status"),
    newStatus: sessionStatusEnum("new_status").notNull(),
    triggeredBy: uuid("triggered_by").references(() => users.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("session_events_session_idx").on(table.sessionId),
    eventTypeIdx: index("session_events_type_idx").on(table.eventType),
    createdAtIdx: index("session_events_created_at_idx").on(table.createdAt),
  }),
);
