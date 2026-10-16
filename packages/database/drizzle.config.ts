import { defineConfig } from "drizzle-kit";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env from repo root — drizzle-kit runs from packages/database/
// but the env file lives two levels up.
function loadRootEnv() {
  const envPath = resolve(__dirname, "../../.env");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // no .env file — fall back to environment variables already set
  }
}

loadRootEnv();

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_MIGRATION_URL ||
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/devforge",
  },
});
