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
import { users } from "./auth";

export const practiceTaskStatusEnum = pgEnum("practice_task_status", [
  "not_started",
  "in_progress",
  "completed",
  "expired",
]);

export const practiceSessions = pgTable(
  "practice_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").notNull(),
    status: practiceTaskStatusEnum("status").notNull().default("not_started"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes").notNull(),
    timeRemainingSeconds: integer("time_remaining_seconds"),
    totalPausedSeconds: integer("total_paused_seconds").notNull().default(0),
    currentFile: varchar("current_file", { length: 500 }),
    files: jsonb("files").notNull().default("[]"),
    revisions: jsonb("revisions").notNull().default("[]"),
    runHistory: jsonb("run_history").notNull().default("[]"),
    testRuns: jsonb("test_runs").notNull().default("[]"),
    activity: jsonb("activity").notNull().default("[]"),
    coachMessages: jsonb("coach_messages").notNull().default("[]"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    candidateIdx: index("practice_sessions_candidate_idx").on(table.candidateId),
    taskIdx: index("practice_sessions_task_idx").on(table.taskId),
    statusIdx: index("practice_sessions_status_idx").on(table.status),
  }),
);

export const practiceTasks = pgTable(
  "practice_tasks",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    difficulty: varchar("difficulty", { length: 20 }).notNull(),
    skills: jsonb("skills").notNull().default("[]"),
    durationMinutes: integer("duration_minutes").notNull(),
    starterFiles: jsonb("starter_files").notNull().default("[]"),
    testPatterns: jsonb("test_patterns").notNull().default("[]"),
    isActive: boolean("is_active").notNull().default(true),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index("practice_tasks_active_idx").on(table.isActive),
    orderIdx: index("practice_tasks_order_idx").on(table.order),
  }),
);

export const practiceAllowances = pgTable(
  "practice_allowances",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    freeAttemptsUsed: integer("free_attempts_used").notNull().default(0),
    freeAttemptsLimit: integer("free_attempts_limit").notNull().default(3),
    paidAttemptsPurchased: integer("paid_attempts_purchased").notNull().default(0),
    paidAttemptsUsed: integer("paid_attempts_used").notNull().default(0),
    subscriptionId: uuid("subscription_id"),
    lastResetAt: timestamp("last_reset_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    candidateIdx: uniqueIndex("practice_allowances_candidate_idx").on(table.candidateId),
  }),
);

export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    eventId: uuid("event_id").notNull(),
    attemptsConsumed: integer("attempts_consumed").notNull().default(0),
    description: text("description"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    candidateIdx: index("usage_ledger_candidate_idx").on(table.candidateId),
    eventIdx: index("usage_ledger_event_idx").on(table.eventType, table.eventId),
    createdAtIdx: index("usage_ledger_created_at_idx").on(table.createdAt),
  }),
);
