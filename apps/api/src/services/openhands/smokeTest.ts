#!/usr/bin/env node
/**
 * OpenHands Integration Smoke Test
 *
 * This script performs a real end-to-end test of the OpenHands integration:
 * 1. Creates an isolated MemoryWorkspaceStore with one existing file
 * 2. Asks OpenHands to create a new file
 * 3. Verifies the new file was created with correct content
 * 4. Asks OpenHands to edit the new file
 * 5. Verifies the edit was applied
 * 6. Verifies the original file was not modified
 *
 * Prerequisites:
 * - OpenHands Agent Server running on http://127.0.0.1:8999
 * - OPENHANDS_SESSION_API_KEY configured in environment
 * - LLM credentials available (via Agent Server or OPENHANDS_LLM_API_KEY)
 *
 * Usage:
 *   node --loader tsx apps/api/src/services/openhands/smokeTest.ts
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env file from apps/api directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "..", "..", "..", ".env");
config({ path: envPath });

import { createOpenHandsAdapter } from "./adapter.js";
import { MemoryWorkspaceStore } from "../workspaceService.js";
import { loadOpenHandsConfig } from "./config.js";

async function smokeTest() {
  console.log("🧪 OpenHands Integration Smoke Test\n");

  // Verify configuration
  console.log("1️⃣  Checking configuration...");
  let config;
  try {
    config = loadOpenHandsConfig();
    if (!config.enabled) {
      console.error("❌ OPENHANDS_ENABLED is false. Set it to true to run this test.");
      process.exit(1);
    }
    if (!config.sessionApiKey) {
      console.error("❌ OPENHANDS_SESSION_API_KEY is not configured.");
      process.exit(1);
    }
    console.log("✅ Configuration loaded");
    console.log(`   Server URL: ${config.serverUrl}`);
    console.log(`   Model: ${config.model}`);
    console.log(`   Timeout: ${config.timeoutMs}ms\n`);
  } catch (error) {
    console.error("❌ Configuration error:", error);
    process.exit(1);
  }

  // Create workspace with existing file
  console.log("2️⃣  Creating isolated workspace...");
  const store = new MemoryWorkspaceStore([
    {
      path: "src/existing.ts",
      content: `export function multiply(a: number, b: number): number {
  return a * b;
}
`,
    },
  ]);
  console.log("✅ Workspace created with src/existing.ts\n");

  // Create adapter
  console.log("3️⃣  Initializing OpenHands adapter...");
  const adapter = createOpenHandsAdapter({ config });
  console.log("✅ Adapter initialized\n");

  // Test 1: Create a new file
  console.log("4️⃣  Test 1: Creating a new file...");
  console.log('   Prompt: "Create src/math.ts with an add function that takes two numbers"');
  try {
    const result1 = await adapter.runTask({
      store,
      prompt:
        "Create src/math.ts with an exported TypeScript function called add that takes two number parameters and returns their sum.",
      taskContext: {
        instructions: "Write clean, simple TypeScript code with type annotations.",
        requirements: ["Export the function", "Include proper TypeScript types"],
        aiPolicy: null,
      },
    });

    console.log(`✅ Agent completed (${result1.stopReason})`);
    console.log(`   Model: ${result1.model}`);
    console.log(`   Operations: ${result1.appliedCount} applied, ${result1.pendingCount} pending, ${result1.failedCount} failed`);

    if (result1.warnings.length > 0) {
      console.log(`   Warnings: ${result1.warnings.join("; ")}`);
    }

    // Verify the new file was created
    const mathFile = await store.read("src/math.ts");
    if (!mathFile) {
      console.error("❌ Expected src/math.ts to be created, but it was not found");
      process.exit(1);
    }

    console.log(`\n   📄 src/math.ts created:`);
    console.log(mathFile.content.split("\n").map((line) => `      ${line}`).join("\n"));

    // Verify it contains expected content
    if (!mathFile.content.includes("add") || !mathFile.content.includes("number")) {
      console.error("\n❌ File content doesn't match expectations");
      process.exit(1);
    }

    console.log("\n✅ Test 1 passed: File created with correct content\n");
  } catch (error) {
    console.error("❌ Test 1 failed:", error);
    process.exit(1);
  }

  // Test 2: Edit the file
  console.log("5️⃣  Test 2: Editing the file...");
  console.log('   Prompt: "Add a subtract function to src/math.ts"');
  try {
    const result2 = await adapter.runTask({
      store,
      prompt:
        "Add an exported TypeScript function called subtract to src/math.ts that takes two number parameters and returns their difference.",
      taskContext: {
        instructions: "Add the function without removing the existing add function.",
        requirements: ["Keep the add function", "Add the subtract function"],
        aiPolicy: null,
      },
    });

    console.log(`✅ Agent completed (${result2.stopReason})`);
    console.log(`   Operations: ${result2.appliedCount} applied, ${result2.pendingCount} pending, ${result2.failedCount} failed`);

    // Verify the file was edited
    const mathFileUpdated = await store.read("src/math.ts");
    if (!mathFileUpdated) {
      console.error("❌ src/math.ts disappeared after edit");
      process.exit(1);
    }

    console.log(`\n   📄 src/math.ts after edit:`);
    console.log(mathFileUpdated.content.split("\n").map((line) => `      ${line}`).join("\n"));

    // Verify both functions exist
    if (!mathFileUpdated.content.includes("add") || !mathFileUpdated.content.includes("subtract")) {
      console.error("\n❌ File doesn't contain both add and subtract functions");
      process.exit(1);
    }

    console.log("\n✅ Test 2 passed: File edited correctly\n");
  } catch (error) {
    console.error("❌ Test 2 failed:", error);
    process.exit(1);
  }

  // Verify original file unchanged
  console.log("6️⃣  Verifying original file unchanged...");
  const existingFile = await store.read("src/existing.ts");
  if (!existingFile) {
    console.error("❌ Original file src/existing.ts disappeared");
    process.exit(1);
  }
  if (!existingFile.content.includes("multiply")) {
    console.error("❌ Original file src/existing.ts was modified");
    process.exit(1);
  }
  console.log("✅ Original file unchanged\n");

  // Success
  console.log("🎉 All tests passed!");
  console.log("\n📊 Summary:");
  console.log("   ✓ Configuration validated");
  console.log("   ✓ Workspace isolation working");
  console.log("   ✓ File creation successful");
  console.log("   ✓ File editing successful");
  console.log("   ✓ Original files protected");
  console.log("\n✅ OpenHands integration is working correctly!\n");
}

smokeTest().catch((error) => {
  console.error("\n❌ Smoke test failed with unhandled error:");
  console.error(error);
  process.exit(1);
});
