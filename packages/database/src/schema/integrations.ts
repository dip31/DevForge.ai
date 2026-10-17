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

export const integrationProviderEnum = pgEnum("integration_provider", [
  "greenhouse",
  "lever",
  "workday",
  "bamboohr",
  "slack",
  "teams",
  "email",
  "webhook",
  "custom",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "active",
  "inactive",
  "error",
  "pending_setup",
]);

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    status: integrationStatusEnum("status").notNull().default("pending_setup"),
    config: jsonb("config").notNull().default("{}"),
    credentialsEncrypted: text("credentials_encrypted"),
    syncEnabled: boolean("sync_enabled").notNull().default(true),
    syncFrequency: varchar("sync_frequency", { length: 50 }).notNull().default("daily"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncStatus: varchar("last_sync_status", { length: 50 }),
    lastSyncError: text("last_sync_error"),
    fieldMappings: jsonb("field_mappings").default("{}"),
    filters: jsonb("filters").default("{}"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("integrations_org_idx").on(table.organizationId),
    providerIdx: index("integrations_provider_idx").on(table.provider),
    statusIdx: index("integrations_status_idx").on(table.status),
  }),
);

export const integrationSyncLogs = pgTable(
  "integration_sync_logs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => integrationConnections.id, { onDelete: "cascade" }),
    syncType: varchar("sync_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    recordsProcessed: integer("records_processed").notNull().default(0),
    recordsCreated: integer("records_created").notNull().default(0),
    recordsUpdated: integer("records_updated").notNull().default(0),
    recordsFailed: integer("records_failed").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").default("{}"),
  },
  (table) => ({
    connectionIdx: index("sync_logs_connection_idx").on(table.connectionId),
    statusIdx: index("sync_logs_status_idx").on(table.status),
    startedAtIdx: index("sync_logs_started_at_idx").on(table.startedAt),
  }),
);

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    events: jsonb("events").notNull().default("[]"),
    secret: varchar("secret", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    retryPolicy: jsonb("retry_policy").notNull().default("{}"),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    lastStatus: varchar("last_status", { length: 50 }),
    lastError: text("last_error"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("webhooks_org_idx").on(table.organizationId),
    activeIdx: index("webhooks_active_idx").on(table.isActive),
  }),
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    attempt: integer("attempt").notNull().default(1),
    maxAttempts: integer("max_attempts").notNull().default(3),
    isSuccess: boolean("is_success").notNull().default(false),
    error: text("error"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    endpointIdx: index("webhook_deliveries_endpoint_idx").on(table.endpointId),
    eventTypeIdx: index("webhook_deliveries_event_idx").on(table.eventType),
    statusIdx: index("webhook_deliveries_success_idx").on(table.isSuccess),
    nextRetryIdx: index("webhook_deliveries_next_retry_idx").on(table.nextRetryAt),
  }),
);

export const exportJobs = pgTable(
  "export_jobs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    format: varchar("format", { length: 20 }).notNull().default("json"),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    filters: jsonb("filters").default("{}"),
    filePath: varchar("file_path", { length: 500 }),
    fileSize: integer("file_size"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index("export_jobs_org_idx").on(table.organizationId),
    statusIdx: index("export_jobs_status_idx").on(table.status),
  }),
);
