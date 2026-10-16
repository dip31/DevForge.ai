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
import { evaluations, evaluationCriteria } from "./evaluation";
import { users, organizations } from "./auth";
import { candidateAssignments } from "./assignments";

export const reviewQueueStatusEnum = pgEnum("review_queue_status", [
  "awaiting_evaluation",
  "ready_for_review",
  "in_review",
  "reviewed",
  "needs_attention",
]);

export const reviewQueue = pgTable(
  "review_queue",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" })
      .unique(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => candidateAssignments.id, { onDelete: "cascade" }),
    status: reviewQueueStatusEnum("status").notNull().default("awaiting_evaluation"),
    priority: integer("priority").notNull().default(0),
    assignedReviewerId: uuid("assigned_reviewer_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    evaluationCompletedAt: timestamp("evaluation_completed_at", {
      withTimezone: true,
    }),
    reviewStartedAt: timestamp("review_started_at", { withTimezone: true }),
    reviewCompletedAt: timestamp("review_completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    evaluationIdx: uniqueIndex("review_queue_evaluation_idx").on(table.evaluationId),
    orgStatusIdx: index("review_queue_org_status_idx").on(table.organizationId, table.status),
    reviewerIdx: index("review_queue_reviewer_idx").on(table.assignedReviewerId),
    priorityIdx: index("review_queue_priority_idx").on(table.priority),
  }),
);

export const reviewerNotes = pgTable(
  "reviewer_notes",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    isInternal: boolean("is_internal").notNull().default(true),
    criterionId: uuid("criterion_id").references(() => evaluationCriteria.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    evaluationIdx: index("reviewer_notes_evaluation_idx").on(table.evaluationId),
    reviewerIdx: index("reviewer_notes_reviewer_idx").on(table.reviewerId),
  }),
);

export const reviewerDecisions = pgTable(
  "reviewer_decisions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    overallOutcome: varchar("overall_outcome", { length: 50 }).notNull(),
    criterionDecisions: jsonb("criterion_decisions").notNull().default("[]"),
    notes: text("notes"),
    isFinal: boolean("is_final").notNull().default(false),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    evaluationIdx: uniqueIndex("reviewer_decisions_evaluation_idx").on(table.evaluationId),
    reviewerIdx: index("reviewer_decisions_reviewer_idx").on(table.reviewerId),
  }),
);
