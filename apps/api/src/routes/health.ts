import { FastifyInstance } from "fastify";
import { db } from "../services/database";
import { sql } from "drizzle-orm";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  fastify.get("/health/ready", async () => {
    try {
      // Check database connection
      await db.execute(sql`SELECT 1`);
      return { status: "ready", timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: "not ready", timestamp: new Date().toISOString() };
    }
  });

  fastify.get("/health/live", async () => {
    return { status: "alive", timestamp: new Date().toISOString() };
  });
}
