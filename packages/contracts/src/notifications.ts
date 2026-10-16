import { z } from "zod";
import {
  uuidSchema,
  paginationSchema,
  paginatedResponseSchema,
  isoDateSchema,
  positiveIntSchema,
} from "./common";

export const notificationTypeSchema = z.enum([
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

export const notificationChannelSchema = z.enum(["email", "in_app", "webhook"]);
export const notificationStatusSchema = z.enum(["pending", "sent", "delivered", "failed", "read"]);

export const notificationJobSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  userId: uuidSchema,
  type: notificationTypeSchema,
  channel: notificationChannelSchema,
  status: notificationStatusSchema.default("pending"),
  subject: z.string().max(255).nullable().optional(),
  body: z.string().max(50000).nullable().optional(),
  templateId: z.string().max(100).nullable().optional(),
  templateData: z.record(z.unknown()).default({}),
  referenceId: uuidSchema.nullable().optional(),
  referenceType: z.string().max(50).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  sentAt: z.string().datetime().nullable().optional(),
  deliveredAt: z.string().datetime().nullable().optional(),
  readAt: z.string().datetime().nullable().optional(),
  failureReason: z.string().max(2000).nullable().optional(),
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().positive().default(3),
  metadata: z.record(z.unknown()).default({}),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const createNotificationRequestSchema = z.object({
  organizationId: uuidSchema,
  userId: uuidSchema,
  type: notificationTypeSchema,
  channel: notificationChannelSchema,
  subject: z.string().max(255).optional(),
  body: z.string().max(50000).optional(),
  templateId: z.string().max(100).optional(),
  templateData: z.record(z.unknown()).default({}),
  referenceId: uuidSchema.optional(),
  referenceType: z.string().max(50).optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const notificationTemplateSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema.nullable().optional(),
  name: z.string().min(1).max(100),
  type: notificationTypeSchema,
  channel: notificationChannelSchema,
  subject: z.string().max(255).nullable().optional(),
  bodyTemplate: z.string().min(1).max(50000),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const createTemplateRequestSchema = z.object({
  name: z.string().min(1).max(100),
  type: notificationTypeSchema,
  channel: notificationChannelSchema,
  subject: z.string().max(255).optional(),
  bodyTemplate: z.string().min(1).max(50000),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const updateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: notificationTypeSchema.optional(),
  channel: notificationChannelSchema.optional(),
  subject: z.string().max(255).nullable().optional(),
  bodyTemplate: z.string().min(1).max(50000).optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export type NotificationJob = z.infer<typeof notificationJobSchema>;
export type CreateNotificationRequest = z.infer<typeof createNotificationRequestSchema>;
export type NotificationTemplate = z.infer<typeof notificationTemplateSchema>;
export type CreateTemplateRequest = z.infer<typeof createTemplateRequestSchema>;
export type UpdateTemplateRequest = z.infer<typeof updateTemplateRequestSchema>;
