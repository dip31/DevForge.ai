/**
 * Profile route — called by the frontend after a successful Supabase sign-in
 * to create or retrieve the application user profile.
 *
 * POST /api/v1/auth/profile
 *   Requires: Authorization: Bearer <supabase_access_token>
 *   Creates the user_profiles row if it doesn't exist.
 *   Returns the profile.
 *
 * GET /api/v1/auth/profile
 *   Returns the current authenticated user's profile.
 */

import { FastifyInstance } from "fastify";

import { z } from "zod";

import { authMiddleware } from "../middleware/auth";

import { authTokenMiddleware, verifySupabaseToken } from "../middleware/auth";

import { upsertProfile, findProfileByAuthId } from "../services/userProfile";

import { userProfiles } from "@database/schema";

import { db } from "../services/database";

import { eq } from "drizzle-orm";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),

  avatarUrl: z.string().url().nullable().optional(),
});

export async function profileRoutes(fastify: FastifyInstance) {
  // POST /profile — upsert profile from Supabase JWT claims
  //
  // Uses token-only auth: this is the bootstrap endpoint that creates the
  // user_profiles row on first sign-in, so it must NOT require a profile.

  fastify.post("/profile", { preHandler: authTokenMiddleware }, async (request, reply) => {
    // Re-read claims from the token to get name/metadata

    const payload = await verifySupabaseToken(request.headers.authorization);

    const authId = request.auth?.authId ?? payload.sub;

    const email = request.auth?.email || payload.email || "";

    const meta = payload.user_metadata as { name?: string; full_name?: string } | undefined;

    const name = meta?.name || meta?.full_name || email.split("@")[0];

    const profile = await upsertProfile({
      authId,

      email,

      name,
    });

    return reply.send({ success: true, data: profile });
  });

  // GET /profile — get current user profile

  fastify.get("/profile", { preHandler: authMiddleware }, async (request, reply) => {
    const user = request.user!;

    const profile = await db.query.userProfiles.findFirst({
      where: (p, { eq }) => eq(p.id, user.id),
    });

    if (!profile) {
      return reply.status(404).send({
        success: false,

        error: { code: "NOT_FOUND", message: "Profile not found" },
      });
    }

    return reply.send({ success: true, data: profile });
  });

  // PATCH /profile — update mutable profile fields

  fastify.patch("/profile", { preHandler: authMiddleware }, async (request, reply) => {
    const user = request.user!;

    const updates = updateProfileSchema.parse(request.body);

    const [updated] = await db
      .update(userProfiles)

      .set({ ...updates, updatedAt: new Date() })

      .where(eq(userProfiles.id, user.id))

      .returning();

    return reply.send({ success: true, data: updated });
  });
}
