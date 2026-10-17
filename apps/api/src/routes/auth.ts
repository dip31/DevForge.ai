/**
 * Auth routes — Supabase Auth integration.
 *
 * With Supabase Auth, the browser handles sign-in/sign-up/password-reset
 * directly against the Supabase API using the @supabase/supabase-js client.
 * The Fastify API does NOT issue its own JWTs or store passwords.
 *
 * These routes exist for:
 *   - Verifying the current session via the Supabase JWT.
 *   - Returning the authenticated user's application profile.
 *
 * Sign-in, sign-up, OAuth, magic link, and password reset are all
 * handled client-side by Supabase Auth. See apps/web/src/lib/auth.tsx.
 */
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth";
import { db } from "../services/database";

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/auth/me
   * Returns the authenticated user's application profile.
   * Requires: Authorization: Bearer <supabase_access_token>
   */
  fastify.get("/me", { preHandler: authMiddleware }, async (request, reply) => {
    const user = request.user!;

    const profile = await db.query.userProfiles.findFirst({
      where: (p, { eq }) => eq(p.id, user.id),
    });

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "User profile not found" },
      });
    }

    return reply.send({ success: true, data: { user: profile } });
  });

  /**
   * POST /api/v1/auth/logout
   * Server-side logout — no-op since Supabase sessions are managed client-side.
   * The frontend should call supabase.auth.signOut() directly.
   * This endpoint exists for future server-side session revocation hooks.
   */
  fastify.post("/logout", async (_request, reply) => {
    return reply.send({ success: true, data: { message: "Signed out" } });
  });
}
