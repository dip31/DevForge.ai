import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { runAgent } from "./agentService";
import { MemoryWorkspaceStore } from "./workspaceService";
import { isGroqConfigured, CoachProviderError } from "./groqProvider";

// Opt-in full integration test against the real Groq API. It is skipped by
// default so CI and the normal suite never depend on network or quota. Enable
// it explicitly with a live key:
//
//   GROQ_LIVE_TEST=1 npm run test:api -- --run src/services/agentLive.test.ts
//
// It proves the whole path end to end: provider request -> native tool call
// parsing -> agent loop -> real tool dispatch -> workspace mutation.

if (!process.env.GROQ_API_KEY) {
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
  loadEnv({ path: envPath });
}

const enabled = process.env.GROQ_LIVE_TEST === "1" && isGroqConfigured();

describe.skipIf(!enabled)("runAgent — live Groq integration", () => {
  it(
    "lists an empty workspace, creates a real file, then edits it",
    async () => {
      const taskContext = {
        instructions: "Add a typed add(a, b) function to src/example.ts.",
        requirements: ["The function must be typed."],
        aiPolicy: null,
      };
      const store = new MemoryWorkspaceStore();

      // 1. Create.
      let created;
      try {
        created = await runAgent({
          store,
          prompt:
            "Create src/example.ts with a typed TypeScript function add(a: number, b: number): number that returns the sum.",
          taskContext,
        });
      } catch (error) {
        // If quota is exhausted, report clearly instead of a false failure.
        if (error instanceof CoachProviderError && error.code === "provider_rate_limited") {
          console.warn(
            `[live test] skipped — provider quota exhausted (retry after ${error.retryAfterSeconds ?? "?"}s)`,
          );
          return;
        }
        throw error;
      }

      const createOp = created.operations.find(
        (op) => op.kind === "create_file" && op.path === "src/example.ts",
      );
      expect(createOp?.status).toBe("applied");
      const afterCreate = await store.read("src/example.ts");
      expect(afterCreate?.content).toMatch(/add/);
      expect(afterCreate?.content).toMatch(/number/);

      // 2. Edit the real file.
      const edited = await runAgent({
        store,
        prompt:
          "Edit src/example.ts so add also accepts negative numbers correctly and keeps its type annotations.",
        taskContext,
      });
      const editOp = edited.operations.find(
        (op) => op.kind === "edit_file" && op.path === "src/example.ts",
      );
      expect(editOp?.status).toBe("applied");
      const afterEdit = await store.read("src/example.ts");
      expect(afterEdit?.content).not.toBe(afterCreate?.content);
    },
    120_000,
  );
});
