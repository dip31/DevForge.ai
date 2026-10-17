#!/usr/bin/env node
/**
 * Debug script to test the Python bridge directly and see stderr output.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, "..", "..", "..", "..", "..");

function defaultPythonPath(): string {
  return process.platform === "win32"
    ? path.join(REPO_ROOT, ".openhands-env", "Scripts", "python.exe")
    : path.join(REPO_ROOT, ".openhands-env", "bin", "python");
}

const pythonPath = process.env.OPENHANDS_PYTHON?.trim() || defaultPythonPath();
const bridgeScript = path.join(MODULE_DIR, "bridge", "run_task.py");

console.log("🔍 Testing Python bridge directly");
console.log(`Python: ${pythonPath}`);
console.log(`Bridge: ${bridgeScript}`);
console.log("");

const payload = {
  server_url: "http://127.0.0.1:8999",
  session_api_key: process.env.OPENHANDS_SESSION_API_KEY || "",
  working_dir: path.join(REPO_ROOT, "workspace", "conversations"),
  prompt: "Create a file called test.txt with the content 'Hello World'",
  model: "groq/llama-3.3-70b-versatile",
  llm_api_key: process.env.OPENHANDS_LLM_API_KEY || "",
  llm_base_url: process.env.OPENHANDS_LLM_BASE_URL || "",
  instructions: null,
  requirements: [],
  timeout_ms: 120000,
};

console.log("📤 Sending payload:");
console.log(JSON.stringify(payload, null, 2));
console.log("");

const child = spawn(pythonPath, [bridgeScript], {
  stdio: ["pipe", "pipe", "pipe"],
  env: process.env,
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (data) => {
  stdout += data.toString();
});

child.stderr.on("data", (data) => {
  const text = data.toString();
  stderr += text;
  console.log("🔧 [stderr]:", text.trim());
});

child.stdin.write(JSON.stringify(payload));
child.stdin.end();

child.on("close", (code) => {
  console.log("");
  console.log("📥 Exit code:", code);
  console.log("");
  console.log("📥 stdout:");
  console.log(stdout);
  console.log("");
  
  try {
    const lines = stdout.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const result = JSON.parse(lastLine);
    console.log("✅ Parsed result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log("❌ Failed to parse result:", error);
  }
});
