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
  decimal,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { users } from "./auth";
import { organizations } from "./auth";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "trialing",
]);

export const billingIntervalEnum = pgEnum("billing_interval", ["monthly", "yearly"]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "canceled",
]);

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    priceAmount: integer("price_amount").notNull(),
    priceCurrency: varchar("price_currency", { length: 3 }).notNull().default("USD"),
    interval: billingIntervalEnum("interval").notNull().default("monthly"),
    features: jsonb("features").notNull().default("{}"),
    practiceAttemptsIncluded: integer("practice_attempts_included").notNull().default(0),
    assessmentCreditsIncluded: integer("assessment_credits_included").notNull().default(0),
    maxTeamMembers: integer("max_team_members").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    isPopular: boolean("is_popular").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    stripePriceId: varchar("stripe_price_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index("plans_active_idx").on(table.isActive),
  }),
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .unique(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("incomplete"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    trialStart: timestamp("trial_start", { withTimezone: true }),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: uniqueIndex("subscriptions_org_idx").on(table.organizationId),
    planIdx: index("subscriptions_plan_idx").on(table.planId),
    statusIdx: index("subscriptions_status_idx").on(table.status),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    amountDue: integer("amount_due").notNull(),
    amountPaid: integer("amount_paid").notNull().default(0),
    amountRemaining: integer("amount_remaining").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull().defaultNow(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }),
    hostedInvoiceUrl: varchar("hosted_invoice_url", { length: 500 }),
    invoicePdfUrl: varchar("invoice_pdf_url", { length: 500 }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("invoices_org_idx").on(table.organizationId),
    statusIdx: index("invoices_status_idx").on(table.status),
    numberIdx: uniqueIndex("invoices_number_idx").on(table.invoiceNumber),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    paymentMethod: varchar("payment_method", { length: 50 }),
    paymentMethodDetails: jsonb("payment_method_details").default("{}"),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
    failureReason: text("failure_reason"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundAmount: integer("refund_amount"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("payments_org_idx").on(table.organizationId),
    invoiceIdx: index("payments_invoice_idx").on(table.invoiceId),
    statusIdx: index("payments_status_idx").on(table.status),
  }),
);

export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    provider: varchar("provider", { length: 50 }).notNull().default("stripe"),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    eventId: varchar("event_id", { length: 255 }).notNull().unique(),
    payload: jsonb("payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventIdIdx: uniqueIndex("webhook_events_event_id_idx").on(table.eventId),
    processedIdx: index("webhook_events_processed_idx").on(table.processed),
  }),
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    description: text("description"),
    referenceId: uuid("reference_id"),
    referenceType: varchar("reference_type", { length: 50 }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("credit_transactions_org_idx").on(table.organizationId),
    referenceIdx: index("credit_transactions_ref_idx").on(table.referenceId, table.referenceType),
  }),
);
