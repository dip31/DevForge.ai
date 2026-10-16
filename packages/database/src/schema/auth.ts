/**
 * Module 01 â€” Identity & Organizations
 *
 * Authentication identity is managed entirely by Supabase Auth (auth.users).
 * This schema contains application-level profile data linked to the Supabase
 * auth UUID, plus organizations, memberships, and the old user_sessions table
 * (retained for audit compatibility; new sessions go through Supabase Auth).
 *
 * Identity mapping:
 *   Supabase auth.users.id (uuid)  â”€â”€â†’  user_profiles.auth_id (uuid, unique)
 *   user_profiles.id               â”€â”€â†’  all application FKs (assignments, evidence, etc.)
 *
 * Do NOT duplicate auth.users columns (email, password) in this table.
 * Read email/name from the Supabase token claims; persist app-specific fields here.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";

// â”€â”€ Enums â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const userRoleEnum = pgEnum("user_role", ["candidate", "recruiter", "admin"]);
export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

// user_session_status is kept for historical audit records only.
// Live auth sessions are managed by Supabase Auth.
export const userSessionStatusEnum = pgEnum("user_session_status", [
  "active",
  "expired",
  "revoked",
]);

// â”€â”€ user_profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// One row per Supabase Auth user. Created on first verified login.
// auth_id = auth.users.id from Supabase â€” the JWT "sub" claim.

export const userProfiles = pgTable(
  "user_profiles",
  {
    // Internal application ID â€” used by all FK relationships in this schema.
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    // Supabase Auth user ID â€” the `sub` claim in every issued JWT.
    // Unique; used to look up the profile on every authenticated request.
    authId: uuid("auth_id").notNull().unique(),

    // Denormalized for convenience â€” kept in sync with Supabase Auth claims.
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),

    // Application role â€” separate from Supabase auth roles.
    role: userRoleEnum("role").notNull().default("candidate"),

    avatarUrl: varchar("avatar_url", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    authIdIdx: uniqueIndex("user_profiles_auth_id_idx").on(table.authId),
    emailIdx: uniqueIndex("user_profiles_email_idx").on(table.email),
    roleIdx: index("user_profiles_role_idx").on(table.role),
    activeIdx: index("user_profiles_active_idx").on(table.isActive),
  }),
);

// Alias for internal code that still references `users`.
// Migrate call sites to `userProfiles` progressively.
export const users = userProfiles;

// â”€â”€ organizations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),
    logoUrl: varchar("logo_url", { length: 500 }),
    websiteUrl: varchar("website_url", { length: 500 }),
    billingEmail: varchar("billing_email", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    settings: text("settings").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("organizations_slug_idx").on(table.slug),
    activeIdx: index("organizations_active_idx").on(table.isActive),
  }),
);

// â”€â”€ organization_memberships â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    role: organizationRoleEnum("role").notNull().default("member"),
    invitedBy: uuid("invited_by").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgUserIdx: uniqueIndex("org_memberships_org_user_idx").on(table.organizationId, table.userId),
    orgIdx: index("org_memberships_org_idx").on(table.organizationId),
    userIdx: index("org_memberships_user_idx").on(table.userId),
    roleIdx: index("org_memberships_role_idx").on(table.role),
  }),
);

// â”€â”€ user_sessions (audit / legacy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Kept for historical audit records. New auth sessions are managed by Supabase.

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    status: userSessionStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("user_sessions_user_idx").on(table.userId),
    tokenHashIdx: uniqueIndex("user_sessions_token_hash_idx").on(table.tokenHash),
    statusIdx: index("user_sessions_status_idx").on(table.status),
    expiresAtIdx: index("user_sessions_expires_at_idx").on(table.expiresAt),
  }),
);

// â”€â”€ candidate_profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const candidateProfiles = pgTable(
  "candidate_profiles",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    headline: varchar("headline", { length: 255 }),
    bio: text("bio"),
    location: varchar("location", { length: 255 }),
    timezone: varchar("timezone", { length: 50 }).default("UTC"),
    githubUrl: varchar("github_url", { length: 500 }),
    linkedinUrl: varchar("linkedin_url", { length: 500 }),
    portfolioUrl: varchar("portfolio_url", { length: 500 }),
    skills: text("skills").default("[]"),
    experienceYears: integer("experience_years"),
    preferredRoles: text("preferred_roles").default("[]"),
    practiceAttemptsUsed: integer("practice_attempts_used").notNull().default(0),
    practiceAttemptsLimit: integer("practice_attempts_limit").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: uniqueIndex("candidate_profiles_user_idx").on(table.userId),
  }),
);
