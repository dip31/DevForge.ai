/**
 * Drizzle ORM database client.
 *
 * Supabase connection modes:
 *   - Transaction pooler  (port 6543) — use for serverless/edge, no prepared statements.
 *   - Session pooler      (port 5432) — use for long-lived Node.js servers.
 *   - Direct connection   (port 5432) — use for Drizzle migrations only.
 *
 * Set DATABASE_URL to the session pooler string for this runtime process.
 * Set DATABASE_MIGRATION_URL to the direct connection string for migrations.
 *
 * Supabase requires SSL in production — DATABASE_SSL=true.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getConfig } from "@config";
import * as schema from "@database/schema";

const config = getConfig();

const client = postgres(config.DATABASE_URL, {
  max: config.DATABASE_POOL_SIZE,
  idle_timeout: 20,
  connect_timeout: 10,
  // Supabase requires SSL in production. In local Docker dev, set DATABASE_SSL=false.
  ssl: config.DATABASE_SSL ? "require" : false,
  // Disable prepared statements when using the transaction pooler (pgBouncer).
  // Safe to leave false for session pooler / direct connections too.
  prepare: false,
});

export const db = drizzle(client, { schema });

export async function closeDatabase() {
  await client.end();
}
