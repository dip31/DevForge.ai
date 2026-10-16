import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

import Fastify from "fastify";

import { healthRoutes } from "./health";

// Mock the database module so tests run without a real DB

vi.mock("../services/database", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
  },

  closeDatabase: vi.fn(),
}));

describe("Health routes", () => {
  const app = Fastify({ logger: false });

  beforeAll(async () => {
    await app.register(healthRoutes, { prefix: "/api/v1" });

    await app.ready();
  });

  afterAll(() => app.close());

  it("GET /api/v1/health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });

    expect(res.statusCode).toBe(200);

    const body = res.json();

    expect(body.status).toBe("ok");

    expect(typeof body.timestamp).toBe("string");
  });

  it("GET /api/v1/health/live returns alive", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health/live" });

    expect(res.statusCode).toBe(200);

    expect(res.json().status).toBe("alive");
  });

  it("GET /api/v1/health/ready returns ready when DB is up", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health/ready" });

    expect(res.statusCode).toBe(200);

    expect(res.json().status).toBe("ready");
  });

  it("GET /api/v1/health/ready returns not ready when DB is down", async () => {
    const { db } = await import("../services/database");

    vi.mocked(db.execute).mockRejectedValueOnce(new Error("connection refused"));

    const res = await app.inject({ method: "GET", url: "/api/v1/health/ready" });

    expect(res.statusCode).toBe(200);

    const body = res.json();

    expect(body.status).toBe("not ready");
  });
});
