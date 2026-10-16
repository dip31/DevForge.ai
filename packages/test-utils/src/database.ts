import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { envSchema } from "@config";
import * as schema from "@database/schema";

export function createTestDatabase() {
  const config = {
    NODE_ENV: "test",
    PORT: "3000",
    HOST: "0.0.0.0",
    DATABASE_URL:
      process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/devforge_test",
    DATABASE_POOL_SIZE: "5",
    DATABASE_SSL: "false",
    JWT_SECRET: "test-secret-key-minimum-32-characters-long",
    JWT_ACCESS_EXPIRY: "15m",
    JWT_REFRESH_EXPIRY: "7d",
    JWT_ISSUER: "devforge-api",
    JWT_AUDIENCE: "devforge-web",
    BCRYPT_ROUNDS: "10",
    CORS_ORIGIN: "http://localhost:8443",
    CORS_CREDENTIALS: "true",
    RATE_LIMIT_MAX: "1000",
    RATE_LIMIT_WINDOW_MS: "60000",
    LOG_LEVEL: "error",
    LOG_PRETTY: "false",
  };

  const client = postgres("postgresql://postgres:postgres@localhost:5432/devforge_test", {
    max: 5,
    idle_timeout: 10,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

export async function setupTestDatabase() {
  const db = createTestDatabase();
  return db;
}

export async function teardownTestDatabase(db: ReturnType<typeof createTestDatabase>) {
  await db.$client.end();
}

export async function truncateAllTables(db: ReturnType<typeof createTestDatabase>) {
  const tables = [
    "audit_events",
    "data_access_requests",
    "data_retention_policies",
    "webhook_deliveries",
    "webhook_endpoints",
    "integration_sync_logs",
    "integration_connections",
    "export_jobs",
    "ai_interactions",
    "ai_usage_records",
    "ai_provider_configs",
    "notification_jobs",
    "notification_templates",
    "candidate_feedback",
    "reviewer_decisions",
    "reviewer_notes",
    "review_events",
    "finding_evidence_links",
    "evaluation_criteria",
    "evaluations",
    "review_queue",
    "reviewer_notes",
    "reviewer_decisions",
    "practice_sessions",
    "practice_tasks",
    "practice_allowances",
    "usage_ledger",
    "subscription_plans",
    "subscriptions",
    "invoices",
    "payments",
    "payment_webhook_events",
    "credit_transactions",
    "ai_usage_records",
    "ai_interactions",
    "ai_provider_configs",
    "notification_jobs",
    "notification_templates",
    "audit_events",
    "data_retention_policies",
    "data_access_requests",
    "integration_connections",
    "integration_sync_logs",
    "webhook_endpoints",
    "webhook_deliveries",
    "export_jobs",
    "evidence_records",
    "activity_events",
    "ai_interactions",
    "code_revision_links",
    "test_results",
    "execution_artifacts",
    "execution_runs",
    "session_files",
    "workspace_revisions",
    "session_state_events",
    "assessment_sessions",
    "candidate_assignments",
    "rubric_versions",
    "assessment_versions",
    "assessment_files",
    "assessment_test_configs",
    "assessments",
    "rubric_versions",
    "candidate_profiles",
    "user_sessions",
    "organization_memberships",
    "organizations",
    "users",
  ];

  for (const table of tables) {
    try {
      await sql`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`;
    } catch {
      // Table might not exist, ignore
    }
  }
}

import { sql } from "drizzle-orm";
