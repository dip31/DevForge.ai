/**
 * User profile management.
 *
 * On first authenticated request, a user_profiles row is created from
 * the Supabase JWT claims. On subsequent requests the row is returned
 * from the database.
 *
 * This keeps Supabase Auth as the authoritative identity source while
 * storing application-specific data (role, practice attempts, etc.)
 * in the application database.
 */

import { db } from "./database";

import { userProfiles } from "@database/schema";

import { eq } from "drizzle-orm";

export interface ProfileClaims {
  /** Supabase auth.users.id — the JWT sub claim. */

  authId: string;

  email: string;

  name?: string;

  role?: "candidate" | "recruiter" | "admin";
}

/**
 * Find the application profile for a Supabase auth user.
 * Returns null if no profile exists yet — caller should upsert.
 */

export async function findProfileByAuthId(authId: string) {
  return db.query.userProfiles.findFirst({
    where: (p, { eq }) => eq(p.authId, authId),
  });
}

/**
 * Create a new profile row from JWT claims.
 * Idempotent — if the auth_id already exists, returns the existing row.
 */

export async function upsertProfile(claims: ProfileClaims) {
  const existing = await findProfileByAuthId(claims.authId);

  if (existing) return existing;

  const [created] = await db
    .insert(userProfiles)
    .values({
      authId: claims.authId,

      email: claims.email,

      name: claims.name ?? claims.email.split("@")[0],

      role: claims.role ?? "candidate",

      isActive: true,
    })
    .returning();

  return created;
}
