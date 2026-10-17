/**
 * Supabase JWT authentication middleware for Fastify.
 *
 * Verification strategy: verify the JWT signature locally using the
 * SUPABASE_JWT_SECRET (HS256). This avoids a network round-trip to Supabase
 * on every request and is the recommended approach for trusted server processes.
 *
 * The middleware then looks up the application user_profile by auth_id so that
 * downstream handlers get an internal user ID suitable for FK lookups.
 *
 * Token flow:
 *   Browser  →  Supabase Auth  →  access_token (JWT, HS256)
 *   Browser  →  Authorization: Bearer <access_token>
 *   Fastify  →  verify signature  →  extract sub  →  lookup user_profile
 */
import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getConfig } from "@config";
import { db } from "../services/database";

// Shape attached to every authenticated request.
export interface AuthUser {
  /** Internal user_profiles.id — use for all FK relationships. */
  id: string;
  /** Supabase auth.users.id — the JWT sub claim. */
  authId: string;
  email: string;
  role: string;
}

// Token-only claims, attached when a profile may not exist yet.
export interface AuthToken {
  authId: string;
  email: string;
  role: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    auth?: AuthToken;
  }
}

// Supabase JWT claims shape (subset we care about).
interface SupabaseJwtPayload {
  sub: string; // Supabase auth.users.id
  email?: string;
  role?: string; // Supabase role (authenticated / anon / service_role)
  app_metadata?: { role?: string };
  user_metadata?: { name?: string; full_name?: string };
  aud?: string | string[];
  exp?: number;
  iat?: number;
  [claim: string]: unknown;
}

export class AuthError extends Error {
  constructor(
    public readonly code:
      | "MISSING_TOKEN"
      | "TOKEN_EXPIRED"
      | "INVALID_TOKEN"
      | "USER_NOT_FOUND"
      | "ACCOUNT_INACTIVE",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Extract and verify a Supabase Bearer token from the Authorization header.
 * Returns the decoded payload — does NOT look up the database profile.
 *
 * Supabase projects sign access tokens one of two ways:
 *   - Legacy: HS256 with the shared JWT secret (SUPABASE_JWT_SECRET).
 *   - Current (default for new projects): asymmetric ES256/RS256 keys, verified
 *     against the project JWKS at /.well-known/jwks.json.
 *
 * We try the shared secret first (fast, no network, legacy projects), then fall
 * back to the remote JWKS so modern asymmetric projects verify correctly.
 */
let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getRemoteJwks() {
  if (!remoteJwks) {
    const { SUPABASE_URL } = getConfig();
    remoteJwks = createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", SUPABASE_URL));
  }
  return remoteJwks;
}

export async function verifySupabaseToken(
  authHeader: string | undefined,
): Promise<SupabaseJwtPayload> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("MISSING_TOKEN", "Missing or invalid authorization header");
  }

  const token = authHeader.slice(7);
  const config = getConfig();

  // 1. Legacy HS256 shared secret — no network round-trip.
  try {
    return jwt.verify(token, config.SUPABASE_JWT_SECRET, {
      algorithms: ["HS256"],
    }) as SupabaseJwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError("TOKEN_EXPIRED", "Access token has expired");
    }
    // Not an HS256 token (or wrong secret) — fall through to asymmetric JWKS.
  }

  // 2. Asymmetric keys via the project JWKS (current Supabase default).
  try {
    const { payload } = await jwtVerify(token, getRemoteJwks(), {
      algorithms: ["ES256", "RS256"],
    });
    return payload as unknown as SupabaseJwtPayload;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "ERR_JWT_EXPIRED") {
      throw new AuthError("TOKEN_EXPIRED", "Access token has expired");
    }
    throw new AuthError("INVALID_TOKEN", "Invalid access token");
  }
}

/**
 * Fastify preHandler hook — verifies the Supabase JWT and attaches an
 * AuthUser to request.user. Replies 401 on any failure.
 *
 * Usage:
 *   fastify.addHook("preHandler", authMiddleware)
 *   // or per-route:
 *   fastify.get("/protected", { preHandler: authMiddleware }, handler)
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const payload = await verifySupabaseToken(request.headers.authorization);

    // Look up the application profile using the Supabase auth UUID.
    const profile = await db.query.userProfiles.findFirst({
      where: (p, { eq }) => eq(p.authId, payload.sub),
      columns: {
        id: true,
        authId: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!profile) {
      reply.status(401).send({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User profile not found" },
      });
      return;
    }

    if (!profile.isActive) {
      reply.status(401).send({
        success: false,
        error: { code: "ACCOUNT_INACTIVE", message: "Account is inactive" },
      });
      return;
    }

    request.user = {
      id: profile.id,
      authId: profile.authId,
      email: profile.email,
      role: profile.role,
    };
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "TOKEN_EXPIRED" ? 401 : 401;
      reply.status(status).send({
        success: false,
        error: { code: err.code, message: err.message },
      });
      return;
    }
    throw err;
  }
}

/**
 * Lightweight auth hook — verifies the Supabase JWT and attaches token claims
 * to request.auth WITHOUT requiring an existing user_profiles row.
 *
 * Use this ONLY for endpoints that must work before a profile exists, such as
 * the profile-bootstrap route that creates the row on first sign-in. All other
 * routes should use authMiddleware, which resolves the internal user ID.
 */
export async function authTokenMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const payload = await verifySupabaseToken(request.headers.authorization);
    request.auth = {
      authId: payload.sub,
      email: payload.email ?? "",
      role: payload.role ?? "authenticated",
    };
  } catch (err) {
    if (err instanceof AuthError) {
      reply.status(401).send({
        success: false,
        error: { code: err.code, message: err.message },
      });
      return;
    }
    throw err;
  }
}
