import { describe, it, expect } from "vitest";

import { envSchema, testConfig } from "./index";

describe("envSchema validation", () => {
  const base = {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/devforge",

    SUPABASE_URL: "https://abc.supabase.co",

    SUPABASE_SECRET_KEY: "service-role-key-placeholder-not-real",

    SUPABASE_JWT_SECRET: "test-jwt-secret-minimum-32-characters-long",
  };

  it("parses a valid minimal config", () => {
    const result = envSchema.safeParse(base);

    expect(result.success).toBe(true);
  });

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL, ...rest } = base;

    const result = envSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it("rejects missing SUPABASE_URL", () => {
    const { SUPABASE_URL, ...rest } = base;

    const result = envSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it("rejects missing SUPABASE_SECRET_KEY", () => {
    const { SUPABASE_SECRET_KEY, ...rest } = base;

    const result = envSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it("rejects missing SUPABASE_JWT_SECRET", () => {
    const { SUPABASE_JWT_SECRET, ...rest } = base;

    const result = envSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it("rejects SUPABASE_JWT_SECRET shorter than 32 characters", () => {
    const result = envSchema.safeParse({
      ...base,
      SUPABASE_JWT_SECRET: "short",
    });

    expect(result.success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const result = envSchema.safeParse(base);

    if (!result.success) throw result.error;

    expect(result.data.PORT).toBe(3000);

    expect(result.data.NODE_ENV).toBe("development");

    expect(result.data.DATABASE_SSL).toBe(true);

    expect(result.data.LOG_LEVEL).toBe("info");
  });

  it("accepts DATABASE_MIGRATION_URL when provided", () => {
    const result = envSchema.safeParse({
      ...base,

      DATABASE_MIGRATION_URL: "postgresql://postgres:postgres@localhost:5432/devforge",
    });

    expect(result.success).toBe(true);
  });
});

describe("testConfig", () => {
  it("returns a valid config object for tests", () => {
    const config = testConfig();

    expect(config.NODE_ENV).toBe("test");

    expect(config.SUPABASE_URL).toBeTruthy();

    expect(config.SUPABASE_JWT_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
