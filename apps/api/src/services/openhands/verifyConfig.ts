#!/usr/bin/env node
/**
 * Quick configuration verification script
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env file from apps/api directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "..", "..", "..", ".env");
config({ path: envPath });

import { loadOpenHandsConfig, isOpenHandsEnabled } from "./config.js";

console.log("🔍 OpenHands Configuration Check\n");

try {
  const enabled = isOpenHandsEnabled();
  console.log(`✅ OPENHANDS_ENABLED: ${enabled}`);
  
  if (!enabled) {
    console.log("\n⚠️  OpenHands is disabled. Set OPENHANDS_ENABLED=true to test it.\n");
    process.exit(0);
  }

  const config = loadOpenHandsConfig();
  
  console.log(`✅ Server URL: ${config.serverUrl}`);
  console.log(`✅ Model: ${config.model}`);
  console.log(`✅ Timeout: ${config.timeoutMs}ms`);
  console.log(`✅ Python: ${config.pythonPath}`);
  console.log(`✅ Bridge: ${config.bridgeScript}`);
  
  if (!config.sessionApiKey) {
    console.log("❌ OPENHANDS_SESSION_API_KEY is missing!");
  } else {
    console.log(`✅ Session API Key: ${config.sessionApiKey.substring(0, 10)}...`);
  }
  
  if (!config.secretKey) {
    console.log("❌ OPENHANDS_SECRET_KEY is missing!");
  } else {
    console.log(`✅ Secret Key: ${config.secretKey.substring(0, 10)}...`);
  }
  
  if (!config.llmApiKey) {
    console.log("❌ OPENHANDS_LLM_API_KEY is missing!");
  } else {
    console.log(`✅ LLM API Key: ${config.llmApiKey.substring(0, 10)}...`);
  }
  
  if (!config.llmBaseUrl) {
    console.log("⚠️  OPENHANDS_LLM_BASE_URL not set (will use model default)");
  } else {
    console.log(`✅ LLM Base URL: ${config.llmBaseUrl}`);
  }
  
  console.log("\n✅ Configuration looks good! Ready to test OpenHands.\n");
  
} catch (error: any) {
  console.log(`\n❌ Configuration error: ${error.message}\n`);
  process.exit(1);
}
