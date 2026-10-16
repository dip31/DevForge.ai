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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { assessmentSessions, candidateAssignments } from "./assignments";
import { users } from "./auth";
import { evidenceRecords } from "./evidence";
import { organizations } from "./auth";
import { assessments } from "./assessment";

export const evaluationStatusEnum = pgEnum("evaluation_status", [
  "demonstrated",
  "partially_demonstrated",
  "not_demonstrated_in_available_evidence",
  "inconclusive",
  "invalid_assessment_evidence",
]);

export const evidenceSufficiencyEnum = pgEnum("evidence_sufficiency", [
  "sufficient",
  "partial",
  "insufficient",
  "invalid",
]);

export const evaluationRecordStatusEnum = pgEnum("evaluation_record_status", [
  "awaiting_evaluation",
  "ready_for_review",
  "inconclusive",
  "needs_attention",
  "reviewed",
]);

export const reviewerStatusEnum = pgEnum("reviewer_status", [
  "pending",
  "in_review",
  "reviewed",
  "needs_attention",
]);

export const reviewActionEnum = pgEnum("review_action", [
  "accepted",
  "overridden",
  "clarification_requested",
]);

export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    version: integer("version").notNull().default(1),
    previousEvaluationId: uuid("previous_evaluation_id").references(
      (): AnyPgColumn => evaluations.id,
      { onDelete: "set null" },
    ),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    candidateName: varchar("candidate_name", { length: 255 }).notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    organizationName: varchar("organization_name", { length: 255 }).notNull(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => candidateAssignments.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    assessmentTitle: varchar("assessment_title", { length: 255 }).notNull(),
    taskTitle: varchar("task_title", { length: 255 }).notNull(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    submissionRevisionId: uuid("submission_revision_id").notNull(),
    submissionTimestamp: timestamp("submission_timestamp", {
      withTimezone: true,
    }).notNull(),
    rubricVersion: varchar("rubric_version", { length: 100 }).notNull(),
    evaluatorVersion: varchar("evaluator_version", { length: 100 }).notNull(),
    evaluatorMethod: varchar("evaluator_method", { length: 100 }).notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
    evidenceCoverage: integer("evidence_coverage").notNull().default(0),
    aggregateScore: integer("aggregate_score"),
    excludedCriteria: jsonb("excluded_criteria").notNull().default("[]"),
    evaluationStatus: evaluationRecordStatusEnum("evaluation_status")
      .notNull()
      .default("awaiting_evaluation"),
    limitations: jsonb("limitations").notNull().default("[]"),
    conflicts: jsonb("conflicts").notNull().default("[]"),
    reviewerStatus: reviewerStatusEnum("reviewer_status").notNull().default("pending"),
    reviewerOutcome: varchar("reviewer_outcome", { length: 50 }),
    internalReviewerNotes: text("internal_reviewer_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: uniqueIndex("evaluations_session_idx").on(table.sessionId),
    candidateIdx: index("evaluations_candidate_idx").on(table.candidateId),
    orgIdx: index("evaluations_org_idx").on(table.organizationId),
    statusIdx: index("evaluations_status_idx").on(table.evaluationStatus),
    reviewerStatusIdx: index("evaluations_reviewer_status_idx").on(table.reviewerStatus),
  }),
);

export const evaluationCriteria = pgTable(
  "evaluation_criteria",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    criterionId: varchar("criterion_id", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    rubric: text("rubric").notNull(),
    weight: integer("weight").notNull(),
    status: evaluationStatusEnum("status").notNull(),
    supportedScore: integer("supported_score"),
    sufficiency: evidenceSufficiencyEnum("sufficiency").notNull(),
    missingEvidence: jsonb("missing_evidence").notNull().default("[]"),
    explanation: text("explanation").notNull(),
    candidateVisible: boolean("candidate_visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    evaluationIdx: index("criteria_evaluation_idx").on(table.evaluationId),
    criterionIdx: index("criteria_criterion_idx").on(table.criterionId),
  }),
);

export const findingEvidenceLinks = pgTable(
  "finding_evidence_links",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidenceRecords.id, { onDelete: "cascade" }),
    linkType: varchar("link_type", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    criterionIdx: index("finding_evidence_criterion_idx").on(table.criterionId),
    evidenceIdx: index("finding_evidence_evidence_idx").on(table.evidenceId),
  }),
);

export const reviewEvents = pgTable(
  "review_events",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => evaluationCriteria.id, { onDelete: "cascade" }),
    action: reviewActionEnum("action").notNull(),
    previousStatus: evaluationStatusEnum("previous_status").notNull(),
    newStatus: evaluationStatusEnum("new_status").notNull(),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reviewerName: varchar("reviewer_name", { length: 255 }).notNull(),
    reason: text("reason").notNull(),
    evidenceIds: jsonb("evidence_ids").notNull().default("[]"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    evaluationIdx: index("review_events_evaluation_idx").on(table.evaluationId),
    criterionIdx: index("review_events_criterion_idx").on(table.criterionId),
    reviewerIdx: index("review_events_reviewer_idx").on(table.reviewerId),
    timestampIdx: index("review_events_timestamp_idx").on(table.timestamp),
  }),
);

export const candidateFeedback = pgTable(
  "candidate_feedback",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" })
      .unique(),
    feedback: jsonb("feedback").notNull().default("{}"),
    isAvailable: boolean("is_available").notNull().default(false),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: uuid("released_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    evaluationIdx: uniqueIndex("candidate_feedback_evaluation_idx").on(table.evaluationId),
  }),
);
