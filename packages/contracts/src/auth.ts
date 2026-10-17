import { z } from "zod";
import { uuidSchema, emailSchema, paginationSchema, paginatedResponseSchema } from "./common";

export const userRoleSchema = z.enum(["candidate", "recruiter", "admin"]);
export const organizationRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);
export const userSessionStatusSchema = z.enum(["active", "expired", "revoked"]);

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().default(false),
});

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255),
  role: userRoleSchema.default("candidate"),
});

export const loginResponseSchema = z.object({
  user: z.object({
    id: uuidSchema,
    email: emailSchema,
    name: z.string(),
    role: userRoleSchema,
    avatarUrl: z.string().url().nullable().optional(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
});

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});

export const resetPasswordRequestSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});

export const userSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  name: z.string(),
  role: userRoleSchema,
  avatarUrl: z.string().url().nullable().optional(),
  isActive: z.boolean(),
  emailVerified: z.boolean(),
  lastLoginAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const organizationSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  billingEmail: emailSchema.nullable().optional(),
  isActive: z.boolean(),
  settings: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// An organization together with the requesting user's role in it. This is the
// typed "organization context" returned to the client after authentication so
// the UI can select an active organization without guessing.
export const organizationWithRoleSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  billingEmail: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userRole: organizationRoleSchema,
});

export const organizationMembershipSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  userId: uuidSchema,
  role: organizationRoleSchema,
  invitedBy: uuidSchema.nullable().optional(),
  invitedAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const candidateProfileSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  headline: z.string().max(255).nullable().optional(),
  bio: z.string().nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  timezone: z.string().max(50).default("UTC"),
  githubUrl: z.string().url().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  portfolioUrl: z.string().url().nullable().optional(),
  skills: z.array(z.string()),
  experienceYears: z.number().int().nonnegative().nullable().optional(),
  preferredRoles: z.array(z.string()),
  practiceAttemptsUsed: z.number().int().nonnegative(),
  practiceAttemptsLimit: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createOrganizationRequestSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  billingEmail: emailSchema.optional(),
});

export const updateOrganizationRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  billingEmail: emailSchema.nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});

export const inviteMemberRequestSchema = z.object({
  email: emailSchema,
  role: organizationRoleSchema.default("member"),
});

export const updateMemberRoleRequestSchema = z.object({
  role: organizationRoleSchema,
});

export const sessionSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  tokenHash: z.string(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  status: userSessionStatusSchema,
  expiresAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type User = z.infer<typeof userSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationWithRole = z.infer<typeof organizationWithRoleSchema>;
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;
export type OrganizationMembership = z.infer<typeof organizationMembershipSchema>;
export type CandidateProfile = z.infer<typeof candidateProfileSchema>;
export type Session = z.infer<typeof sessionSchema>;
