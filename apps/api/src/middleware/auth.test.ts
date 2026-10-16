/**
 * Authentication middleware unit tests.
 *
 * These tests run without a real Supabase project or database.
 * They verify token parsing, error handling, and the shape of AuthUser.
 *
 * Integration tests against a real Supabase project are gated behind
 * SUPABASE_URL / SUPABASE_SECRET_KEY environment variables.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import jwt from "jsonwebtoken";

import { verifySupabaseToken, AuthError } from "./auth";

import { resetConfig } from "@config";

const TEST_JWT_SECRET = "test-jwt-secret-minimum-32-characters-long";

// Inject a minimal config for tests without a real .env

vi.mock("@config", async (importOriginal) => {
  const original = await importOriginal<typeof import("@config")>();

  return {
    ...original,

    getConfig: () => ({
      SUPABASE_JWT_SECRET: TEST_JWT_SECRET,

      SUPABASE_URL: "https://placeholder.supabase.co",

      SUPABASE_SECRET_KEY: "test-secret-key-placeholder-not-real",

      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/devforge_test",

      DATABASE_POOL_SIZE: 5,

      DATABASE_SSL: false,

      NODE_ENV: "test",

      PORT: 3001,

      HOST: "0.0.0.0",

      CORS_ORIGIN: "http://localhost:8443",

      CORS_CREDENTIALS: true,

      RATE_LIMIT_MAX: 1000,

      RATE_LIMIT_WINDOW_MS: 60000,

      LOG_LEVEL: "error",

      LOG_PRETTY: false,
    }),
  };
});

function makeToken(payload: object, secret = TEST_JWT_SECRET, options: jwt.SignOptions = {}) {
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: "15m",
    ...options,
  });
}

// The JWKS/asymmetric fallback is exercised against a real Supabase project in
// production; unit tests use HS256 tokens, so stub jose to stay offline.
vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: async () => {
    throw new Error("JWKS verification is not available in unit tests");
  },
}));

describe("verifySupabaseToken", () => {
  it("throws MISSING_TOKEN when no header is provided", async () => {
    await expect(verifySupabaseToken(undefined)).rejects.toThrow(
      expect.objectContaining({ code: "MISSING_TOKEN" }),
    );
  });

  it("throws MISSING_TOKEN when header has wrong format", async () => {
    await expect(verifySupabaseToken("Basic abc123")).rejects.toThrow(
      expect.objectContaining({ code: "MISSING_TOKEN" }),
    );
  });

  it("throws INVALID_TOKEN for a malformed token", async () => {
    await expect(verifySupabaseToken("Bearer not.a.jwt")).rejects.toThrow(
      expect.objectContaining({ code: "INVALID_TOKEN" }),
    );
  });

  it("throws INVALID_TOKEN when signed with wrong secret", async () => {
    const token = makeToken(
      { sub: "user-123", email: "a@b.com" },
      "wrong-secret-here-32-chars-long",
    );

    await expect(verifySupabaseToken(`Bearer ${token}`)).rejects.toThrow(
      expect.objectContaining({ code: "INVALID_TOKEN" }),
    );
  });

  it("throws TOKEN_EXPIRED for an expired token", async () => {
    const token = makeToken(
      { sub: "user-123", email: "a@b.com" },

      TEST_JWT_SECRET,

      { expiresIn: "-1s" },
    );

    await expect(verifySupabaseToken(`Bearer ${token}`)).rejects.toThrow(
      expect.objectContaining({ code: "TOKEN_EXPIRED" }),
    );
  });

  it("returns the decoded payload for a valid token", async () => {
    const token = makeToken({
      sub: "user-uuid-abc",

      email: "dev@example.com",

      role: "authenticated",
    });

    const payload = await verifySupabaseToken(`Bearer ${token}`);

    expect(payload.sub).toBe("user-uuid-abc");

    expect(payload.email).toBe("dev@example.com");
  });

  it("AuthError has the expected code and message", async () => {
    try {
      await verifySupabaseToken(undefined);

      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);

      expect((err as AuthError).code).toBe("MISSING_TOKEN");
    }
  });
});

describe("authMiddleware (Fastify integration)", () => {
  // Mock the database module — we don't connect to a real DB in unit tests.

  vi.mock("../services/database", () => ({
    db: {
      query: {
        userProfiles: {
          findFirst: vi.fn(),
        },
      },
    },

    closeDatabase: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 with MISSING_TOKEN when no Authorization header", async () => {
    const { authMiddleware } = await import("./auth");

    const { db } = await import("../services/database");

    const reply = {
      status: vi.fn().mockReturnThis(),

      send: vi.fn().mockReturnThis(),
    };

    const request = { headers: {} } as any;

    await authMiddleware(request as any, reply as any);

    expect(reply.status).toHaveBeenCalledWith(401);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,

        error: expect.objectContaining({ code: "MISSING_TOKEN" }),
      }),
    );
  });

  it("returns 401 with TOKEN_EXPIRED for an expired token", async () => {
    const { authMiddleware } = await import("./auth");

    const expiredToken = makeToken({ sub: "u1", email: "a@b.com" }, TEST_JWT_SECRET, {
      expiresIn: "-1s",
    });

    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    const request = {
      headers: { authorization: `Bearer ${expiredToken}` },
    } as any;

    await authMiddleware(request, reply as any);

    expect(reply.status).toHaveBeenCalledWith(401);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "TOKEN_EXPIRED" }),
      }),
    );
  });

  it("returns 401 with USER_NOT_FOUND when profile is missing", async () => {
    const { authMiddleware } = await import("./auth");

    const { db } = (await import("../services/database")) as any;

    db.query.userProfiles.findFirst.mockResolvedValue(null);

    const token = makeToken({ sub: "unknown-auth-id", email: "x@y.com" });

    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    const request = { headers: { authorization: `Bearer ${token}` } } as any;

    await authMiddleware(request, reply as any);

    expect(reply.status).toHaveBeenCalledWith(401);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "USER_NOT_FOUND" }),
      }),
    );
  });

  it("attaches user to request when token and profile are valid", async () => {
    const { authMiddleware } = await import("./auth");

    const { db } = (await import("../services/database")) as any;

    const authId = "supabase-auth-uuid-123";

    db.query.userProfiles.findFirst.mockResolvedValue({
      id: "internal-profile-id",

      authId,

      email: "valid@example.com",

      role: "candidate",

      isActive: true,
    });

    const token = makeToken({ sub: authId, email: "valid@example.com" });

    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    const request = { headers: { authorization: `Bearer ${token}` } } as any;

    await authMiddleware(request, reply as any);

    expect(reply.status).not.toHaveBeenCalled();

    expect(request.user).toMatchObject({
      id: "internal-profile-id",

      authId,

      email: "valid@example.com",

      role: "candidate",
    });
  });

  it("returns 401 with ACCOUNT_INACTIVE for deactivated users", async () => {
    const { authMiddleware } = await import("./auth");

    const { db } = (await import("../services/database")) as any;

    db.query.userProfiles.findFirst.mockResolvedValue({
      id: "profile-id",

      authId: "auth-id",

      email: "inactive@example.com",

      role: "candidate",

      isActive: false,
    });

    const token = makeToken({ sub: "auth-id", email: "inactive@example.com" });

    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    const request = { headers: { authorization: `Bearer ${token}` } } as any;

    await authMiddleware(request, reply as any);

    expect(reply.status).toHaveBeenCalledWith(401);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "ACCOUNT_INACTIVE" }),
      }),
    );
  });
});
