import { z } from "zod";

import { uuidSchema, isoDateSchema, positiveIntSchema } from "./common";

export const subscriptionStatusSchema = z.enum([
  "active",

  "past_due",

  "canceled",

  "incomplete",

  "trialing",
]);

export const billingIntervalSchema = z.enum(["monthly", "yearly"]);

export const invoiceStatusSchema = z.enum([
  "draft",

  "open",

  "paid",

  "void",

  "uncollectible",
]);

export const paymentStatusSchema = z.enum([
  "pending",

  "succeeded",

  "failed",

  "refunded",

  "canceled",
]);

export const subscriptionPlanSchema = z.object({
  id: uuidSchema,

  name: z.string().min(1).max(100),

  description: z.string().max(2000).nullable().optional(),

  priceAmount: z.number().int().nonnegative(),

  priceCurrency: z.string().length(3).default("USD"),

  interval: billingIntervalSchema.default("monthly"),

  features: z.record(z.unknown()).default({}),

  practiceAttemptsIncluded: z.number().int().nonnegative().default(0),

  assessmentCreditsIncluded: z.number().int().nonnegative().default(0),

  maxTeamMembers: positiveIntSchema.default(1),

  isActive: z.boolean().default(true),

  isPopular: z.boolean().default(false),

  sortOrder: z.number().int().nonnegative().default(0),

  stripePriceId: z.string().max(255).nullable().optional(),

  createdAt: isoDateSchema,

  updatedAt: isoDateSchema,
});

export const subscriptionSchema = z.object({
  id: uuidSchema,

  organizationId: uuidSchema,

  planId: uuidSchema,

  status: subscriptionStatusSchema.default("incomplete"),

  currentPeriodStart: z.string().datetime(),

  currentPeriodEnd: z.string().datetime(),

  cancelAtPeriodEnd: z.boolean().default(false),

  canceledAt: z.string().datetime().nullable().optional(),

  trialStart: z.string().datetime().nullable().optional(),

  trialEnd: z.string().datetime().nullable().optional(),

  stripeCustomerId: z.string().max(255).nullable().optional(),

  stripeSubscriptionId: z.string().max(255).nullable().optional(),

  metadata: z.record(z.unknown()).default({}),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),
});

export const createSubscriptionRequestSchema = z.object({
  planId: uuidSchema,

  paymentMethodId: z.string().optional(),
});

export const updateSubscriptionRequestSchema = z.object({
  cancelAtPeriodEnd: z.boolean().optional(),
});

export const invoiceSchema = z.object({
  id: uuidSchema,

  organizationId: uuidSchema,

  subscriptionId: uuidSchema.nullable().optional(),

  status: z.enum(["draft", "open", "paid", "void", "uncollectible"]).default("draft"),

  amountDue: z.number().int().nonnegative(),

  amountPaid: z.number().int().nonnegative().default(0),

  amountRemaining: z.number().int().nonnegative(),

  currency: z.string().length(3).default("USD"),

  invoiceNumber: z.string().min(1).max(50),

  issueDate: z.string().datetime(),

  dueDate: z.string().datetime(),

  paidAt: z.string().datetime().nullable().optional(),

  voidedAt: z.string().datetime().nullable().optional(),

  stripeInvoiceId: z.string().max(255).nullable().optional(),

  hostedInvoiceUrl: z.string().url().nullable().optional(),

  invoicePdfUrl: z.string().url().nullable().optional(),

  metadata: z.record(z.unknown()).default({}),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),
});

export const paymentSchema = z.object({
  id: uuidSchema,

  organizationId: uuidSchema,

  invoiceId: uuidSchema.nullable().optional(),

  amount: z.number().int().nonnegative(),

  currency: z.string().length(3).default("USD"),

  status: z.enum(["pending", "succeeded", "failed", "refunded", "canceled"]).default("pending"),

  paymentMethod: z.string().max(50).nullable().optional(),

  paymentMethodDetails: z.record(z.unknown()).default({}),

  stripePaymentIntentId: z.string().max(255).nullable().optional(),

  stripeChargeId: z.string().max(255).nullable().optional(),

  failureReason: z.string().nullable().optional(),

  refundedAt: z.string().datetime().nullable().optional(),

  refundAmount: z.number().int().nonnegative().nullable().optional(),

  metadata: z.record(z.unknown()).default({}),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),
});

export const createPaymentRequestSchema = z.object({
  amount: z.number().int().positive(),

  currency: z.string().length(3).default("USD"),

  paymentMethodId: z.string(),

  invoiceId: uuidSchema.optional(),
});

export const paymentWebhookEventSchema = z.object({
  id: uuidSchema,

  provider: z.string().max(50).default("stripe"),

  eventType: z.string().min(1).max(100),

  eventId: z.string().min(1).max(255),

  payload: z.record(z.unknown()),

  processed: z.boolean().default(false),

  processedAt: z.string().datetime().nullable().optional(),

  error: z.string().nullable().optional(),

  createdAt: z.string().datetime(),
});

export const creditTransactionSchema = z.object({
  id: uuidSchema,

  organizationId: uuidSchema,

  type: z.string().min(1).max(50),

  amount: z.number().int(),

  balanceAfter: z.number().int(),

  description: z.string().max(2000).nullable().optional(),

  referenceId: uuidSchema.nullable().optional(),

  referenceType: z.string().max(50).nullable().optional(),

  metadata: z.record(z.unknown()).default({}),

  createdAt: z.string().datetime(),
});

export const creditBalanceSchema = z.object({
  balance: z.number().int(),

  pendingCredits: z.number().int().nonnegative(),
});

export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export type Subscription = z.infer<typeof subscriptionSchema>;

export type CreateSubscriptionRequest = z.infer<typeof createSubscriptionRequestSchema>;

export type UpdateSubscriptionRequest = z.infer<typeof updateSubscriptionRequestSchema>;

export type Invoice = z.infer<typeof invoiceSchema>;

export type Payment = z.infer<typeof paymentSchema>;

export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>;

export type PaymentWebhookEvent = z.infer<typeof paymentWebhookEventSchema>;

export type CreditTransaction = z.infer<typeof creditTransactionSchema>;

export type CreditBalance = z.infer<typeof creditBalanceSchema>;
