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
import { users, organizations } from "./auth";
import { assessments, assessmentVersions } from "./assessment";
import { assessmentSessions, candidateAssignments } from "./assignments";
import { workspaceRevisions } from "./workspace";

export const submissionKindEnum = pgEnum("submission_kind", ["assessment", "verification_followup"]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "completed",
  "failed",
  "cancelled",
]);

export const skillStatusEnum = pgEnum("skill_status", [
  "demonstrated",
  "partially_demonstrated",
  "not_demonstrated_in_available_evidence",
  "not_assessed",
  "inconclusive",
]);

export const challengeStatusEnum = pgEnum("challenge_status", [
  "offered",
  "in_progress",
  "submitted",
  "verified",
  "failed",
  "expired",
  "revoked",
]);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    submissionVersion: integer("submission_version").notNull(),
    kind: submissionKindEnum("kind").notNull().default("assessment"),
    challengeId: uuid("challenge_id"),
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
    assessmentVersionId: uuid("assessment_version_id")
      .notNull()
      .references(() => assessmentVersions.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => workspaceRevisions.id, { onDelete: "cascade" }),
    files: jsonb("files").notNull().default("[]"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    status: submissionStatusEnum("status").notNull().default("completed"),
    testSummary: jsonb("test_summary").default("{}"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionVersionIdx: uniqueIndex("submissions_session_version_idx").on(
      table.sessionId,
      table.submissionVersion,
    ),
    idempotencyIdx: uniqueIndex("submissions_idempotency_idx").on(table.idempotencyKey),
    sessionIdx: index("submissions_session_idx").on(table.sessionId),
    candidateIdx: index("submissions_candidate_idx").on(table.candidateId),
    kindIdx: index("submissions_kind_idx").on(table.kind),
  }),
);

export const challengeTemplates = pgTable(
  "challenge_templates",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    key: varchar("key", { length: 100 }).notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    skillKey: varchar("skill_key", { length: 100 }).notNull(),
    targetCriterionId: varchar("target_criterion_id", { length: 100 }).notNull(),
    prompt: text("prompt").notNull(),
    instructions: text("instructions").notNull().default(""),
    entryFile: varchar("entry_file", { length: 500 }).notNull(),
    exportName: varchar("export_name", { length: 100 }).notNull(),
    privateTests: jsonb("private_tests").notNull().default("[]"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyIdx: uniqueIndex("challenge_templates_key_idx").on(table.key),
    skillIdx: index("challenge_templates_skill_idx").on(table.skillKey),
  }),
);

export const verificationChallenges = pgTable(
  "verification_challenges",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => candidateAssignments.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    assessmentVersionId: uuid("assessment_version_id")
      .notNull()
      .references(() => assessmentVersions.id, { onDelete: "cascade" }),
    evaluationId: uuid("evaluation_id"),
    templateId: uuid("template_id")
      .notNull()
      .references(() => challengeTemplates.id, { onDelete: "restrict" }),
    templateKey: varchar("template_key", { length: 100 }).notNull(),
    criterionId: varchar("criterion_id", { length: 100 }).notNull(),
    skillKey: varchar("skill_key", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    prompt: text("prompt").notNull(),
    instructions: text("instructions").notNull().default(""),
    entryFile: varchar("entry_file", { length: 500 }).notNull(),
    exportName: varchar("export_name", { length: 100 }).notNull(),
    privateTests: jsonb("private_tests").notNull().default("[]"),
    status: challengeStatusEnum("status").notNull().default("offered"),
    triggerEvidenceId: uuid("trigger_evidence_id"),
    triggerSummary: text("trigger_summary").notNull().default(""),
    originalStatus: skillStatusEnum("original_status").notNull(),
    followUpSubmissionId: uuid("follow_up_submission_id"),
    resultStatus: skillStatusEnum("result_status"),
    passedTests: integer("passed_tests").notNull().default(0),
    totalTests: integer("total_tests").notNull().default(0),
    offeredAt: timestamp("offered_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionTemplateIdx: uniqueIndex("verification_challenges_session_template_idx").on(
      table.sessionId,
      table.templateKey,
    ),
    sessionIdx: index("verification_challenges_session_idx").on(table.sessionId),
    orgIdx: index("verification_challenges_org_idx").on(table.organizationId),
    statusIdx: index("verification_challenges_status_idx").on(table.status),
  }),
);

export const skillAssessments = pgTable(
  "skill_assessments",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    evaluationId: uuid("evaluation_id"),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    criterionId: varchar("criterion_id", { length: 100 }).notNull(),
    skillKey: varchar("skill_key", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    status: skillStatusEnum("status").notNull().default("not_assessed"),
    originalStatus: skillStatusEnum("original_status").notNull().default("not_assessed"),
    evidenceIds: jsonb("evidence_ids").notNull().default("[]"),
    explanation: text("explanation").notNull().default(""),
    lastChallengeId: uuid("last_challenge_id"),
    history: jsonb("history").notNull().default("[]"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionCriterionIdx: uniqueIndex("skill_assessments_session_criterion_idx").on(
      table.sessionId,
      table.criterionId,
    ),
    sessionIdx: index("skill_assessments_session_idx").on(table.sessionId),
  }),
);
