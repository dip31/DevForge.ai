import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),

  // ── Database ──────────────────────────────────────────────────────────────
  // Runtime connection — use Supabase transaction pooler for serverless/edge,
  // or a direct connection for long-lived server processes.
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: z.coerce.boolean().default(true),

  // Direct connection for Drizzle migrations (bypasses PgBouncer).
  // Set to the Supabase "direct connection" string when running migrations.
  // Falls back to DATABASE_URL when not set (local Docker dev).
  DATABASE_MIGRATION_URL: z.string().url().optional(),

  // ── Supabase ──────────────────────────────────────────────────────────────
  // Project URL — safe to include in server config, matches VITE_SUPABASE_URL.
  SUPABASE_URL: z.string().url(),

  // Secret key — server-only, never exposed to the browser.
  // Used to verify JWTs and for trusted admin operations.
  SUPABASE_SECRET_KEY: z.string().min(20),

  // JWT secret for verifying Supabase-issued access tokens.
  // Found at: Project → Settings → API → JWT Settings → JWT Secret.
  SUPABASE_JWT_SECRET: z.string().min(32),

  // ── Server ────────────────────────────────────────────────────────────────
  CORS_ORIGIN: z.string().url().default("http://localhost:8443"),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),

  // ── Optional integrations — server starts without these ───────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_PRETTY: z.coerce.boolean().default(false),

  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),

  EXECUTOR_URL: z.string().url().optional(),
  EXECUTOR_API_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:");
    console.error(result.error.format());
    throw new Error("Invalid environment configuration");
  }
  cachedConfig = result.data;
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}

/** Minimal config for unit tests — no external services required. */
export function testConfig(): EnvConfig {
  return {
    NODE_ENV: "test",
    PORT: 3001,
    HOST: "0.0.0.0",
    DATABASE_URL:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/devforge_test",
    DATABASE_MIGRATION_URL: undefined,
    DATABASE_POOL_SIZE: 5,
    DATABASE_SSL: false,
    SUPABASE_URL: process.env.SUPABASE_URL ?? "https://placeholder.supabase.co",
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "test-secret-key-placeholder-not-real",
    SUPABASE_JWT_SECRET:
      process.env.SUPABASE_JWT_SECRET ?? "test-jwt-secret-minimum-32-characters-long",
    CORS_ORIGIN: "http://localhost:8443",
    CORS_CREDENTIALS: true,
    RATE_LIMIT_MAX: 1000,
    RATE_LIMIT_WINDOW_MS: 60000,
    LOG_LEVEL: "error",
    LOG_PRETTY: false,
  };
}
