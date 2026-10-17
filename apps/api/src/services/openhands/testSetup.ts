#!/usr/bin/env node
/**
 * Test OpenHands setup without making actual LLM calls
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { loadOpenHandsConfig, isOpenHandsEnabled } from "./config.js";

console.log("🧪 OpenHands Setup Test (No LLM Calls)\n");

// 1. Check if enabled
const enabled = isOpenHandsEnabled();
console.log(`1. Feature flag: ${enabled ? "✅ ENABLED" : "❌ DISABLED"}`);

if (!enabled) {
  console.log("\n⚠️  Set OPENHANDS_ENABLED=true in apps/api/.env to test\n");
  process.exit(0);
}

// 2. Load config
let config;
try {
  config = loadOpenHandsConfig();
  console.log("2. Configuration: ✅ VALID");
} catch (error: any) {
  console.log(`2. Configuration: ❌ ERROR - ${error.message}`);
  process.exit(1);
}

// 3. Check Python
if (!existsSync(config.pythonPath)) {
  console.log(`3. Python interpreter: ❌ NOT FOUND at ${config.pythonPath}`);
  process.exit(1);
}
console.log(`3. Python interpreter: ✅ FOUND`);

// 4. Check bridge script
if (!existsSync(config.bridgeScript)) {
  console.log(`4. Bridge script: ❌ NOT FOUND at ${config.bridgeScript}`);
  process.exit(1);
}
console.log(`4. Bridge script: ✅ FOUND`);

// 5. Test Python can import OpenHands SDK
console.log("5. OpenHands SDK: Testing...");
const testImport = spawn(config.pythonPath, ["-c", "from openhands.sdk import Conversation; print('OK')"], {
  stdio: ["ignore", "pipe", "pipe"],
});

let importOutput = "";
let importError = "";

testImport.stdout.on("data", (data) => {
  importOutput += data.toString();
});

testImport.stderr.on("data", (data) => {
  importError += data.toString();
});

testImport.on("close", (code) => {
  if (code === 0 && importOutput.includes("OK")) {
    console.log("5. OpenHands SDK: ✅ INSTALLED");
  } else {
    console.log("5. OpenHands SDK: ❌ NOT INSTALLED");
    if (importError) {
      console.log(`   Error: ${importError.substring(0, 200)}`);
    }
    process.exit(1);
  }

  // 6. Test Agent Server connectivity
  console.log("6. Agent Server: Testing...");
  
  fetch(`${config.serverUrl}/health`)
    .then((res) => {
      if (res.ok) {
        console.log(`6. Agent Server: ✅ RUNNING at ${config.serverUrl}`);
        console.log("\n✅ All checks passed! OpenHands setup is correct.\n");
        console.log("📝 Next steps:");
        console.log("   1. Add your OpenAI API key to OPENHANDS_LLM_API_KEY");
        console.log("   2. Run: npx tsx src/services/openhands/smokeTest.ts");
        console.log("   3. Or restart API and test through frontend\n");
      } else {
        console.log(`6. Agent Server: ❌ HTTP ${res.status}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.log(`6. Agent Server: ❌ NOT REACHABLE`);
      console.log(`   Error: ${error.message}`);
      console.log(`\n   Start the server with:`);
      console.log(`   ${config.pythonPath} -m openhands.agent_server --host 127.0.0.1 --port 8999\n`);
      process.exit(1);
    });
});
