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
import { organizations } from "./auth";
import { candidateAssignments } from "./assignments";
import { evaluations } from "./evaluation";

export const notificationTypeEnum = pgEnum("notification_type", [
  "assessment_invitation",
  "assessment_started",
  "assessment_submitted",
  "assessment_expired",
  "evaluation_completed",
  "review_completed",
  "feedback_available",
  "deadline_reminder",
  "payment_due",
  "subscription_changed",
  "system_announcement",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "in_app",
  "webhook",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "delivered",
  "failed",
  "read",
]);

export const notificationJobs = pgTable(
  "notification_jobs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    subject: varchar("subject", { length: 255 }),
    body: text("body"),
    templateId: varchar("template_id", { length: 100 }),
    templateData: jsonb("template_data").default("{}"),
    referenceId: uuid("reference_id"),
    referenceType: varchar("reference_type", { length: 50 }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("notifications_org_idx").on(table.organizationId),
    userIdx: index("notifications_user_idx").on(table.userId),
    typeIdx: index("notifications_type_idx").on(table.type),
    statusIdx: index("notifications_status_idx").on(table.status),
    scheduledAtIdx: index("notifications_scheduled_at_idx").on(table.scheduledAt),
    referenceIdx: index("notifications_ref_idx").on(table.referenceId, table.referenceType),
  }),
);

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 100 }).notNull(),
    type: notificationTypeEnum("type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    subject: varchar("subject", { length: 255 }),
    bodyTemplate: text("body_template").notNull(),
    variables: jsonb("variables").notNull().default("[]"),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("templates_org_idx").on(table.organizationId),
    typeChannelIdx: index("templates_type_channel_idx").on(table.type, table.channel),
  }),
);
