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

export const auditEventTypeEnum = pgEnum("audit_event_type", [
  "user_created",
  "user_updated",
  "user_deleted",
  "login",
  "logout",
  "password_changed",
  "email_changed",
  "role_changed",
  "organization_created",
  "organization_updated",
  "organization_deleted",
  "membership_added",
  "membership_removed",
  "membership_role_changed",
  "assessment_created",
  "assessment_updated",
  "assessment_published",
  "assessment_archived",
  "assignment_created",
  "assignment_updated",
  "assignment_withdrawn",
  "session_started",
  "session_submitted",
  "session_expired",
  "submission_received",
  "evaluation_created",
  "evaluation_updated",
  "review_override",
  "review_completed",
  "feedback_released",
  "practice_attempt_consumed",
  "subscription_created",
  "subscription_updated",
  "subscription_canceled",
  "payment_succeeded",
  "payment_failed",
  "webhook_received",
  "api_key_created",
  "api_key_revoked",
  "security_settings_changed",
  "data_export",
  "data_deletion_request",
]);

export const auditSeverityEnum = pgEnum("audit_severity", ["info", "warning", "critical"]);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eventType: auditEventTypeEnum("event_type").notNull(),
    severity: auditSeverityEnum("severity").notNull().default("info"),
    description: text("description").notNull(),
    entityType: varchar("entity_type", { length: 100 }),
    entityId: uuid("entity_id"),
    previousState: jsonb("previous_state"),
    newState: jsonb("new_state"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    requestId: varchar("request_id", { length: 255 }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("audit_events_org_idx").on(table.organizationId),
    userIdx: index("audit_events_user_idx").on(table.userId),
    eventTypeIdx: index("audit_events_type_idx").on(table.eventType),
    severityIdx: index("audit_events_severity_idx").on(table.severity),
    entityIdx: index("audit_events_entity_idx").on(table.entityType, table.entityId),
    createdAtIdx: index("audit_events_created_at_idx").on(table.createdAt),
    requestIdIdx: index("audit_events_request_id_idx").on(table.requestId),
  }),
);

export const dataRetentionPolicies = pgTable(
  "data_retention_policies",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .unique(),
    assessmentDataDays: integer("assessment_data_days").notNull().default(2555),
    sessionDataDays: integer("session_data_days").notNull().default(2555),
    evidenceDataDays: integer("evidence_data_days").notNull().default(2555),
    evaluationDataDays: integer("evaluation_data_days").notNull().default(2555),
    auditLogDays: integer("audit_log_days").notNull().default(2555),
    practiceDataDays: integer("practice_data_days").notNull().default(1095),
    billingDataDays: integer("billing_data_days").notNull().default(2555),
    isEnabled: boolean("is_enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: uniqueIndex("retention_policies_org_idx").on(table.organizationId),
  }),
);

export const dataAccessRequests = pgTable(
  "data_access_requests",
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
    requestType: varchar("request_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    requestedData: jsonb("requested_data").notNull().default("{}"),
    responseData: jsonb("response_data"),
    processedBy: uuid("processed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("data_access_requests_org_idx").on(table.organizationId),
    userIdx: index("data_access_requests_user_idx").on(table.userId),
    statusIdx: index("data_access_requests_status_idx").on(table.status),
  }),
);
