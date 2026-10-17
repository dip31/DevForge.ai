import path from "node:path";
import { fileURLToPath } from "node:url";

// Typed configuration for the OpenHands integration. Everything here is
// server-side only: the session API key and the bridge secret are never logged,
// never returned to a client, and never baked into an error message. The
// integration is disabled unless OPENHANDS_ENABLED is explicitly set, so the
// existing Groq path stays the default and nothing changes for callers.

export const OPENHANDS_DEFAULT_SERVER_URL = "http://127.0.0.1:8999";
export const OPENHANDS_DEFAULT_MODEL = "openai/gpt-oss-120b";
export const OPENHANDS_DEFAULT_TIMEOUT_MS = 120_000;

// Resolve the repository root from this module's location. The file lives at
// apps/api/src/services/openhands/config.ts, so the repo root is five levels up.
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(MODULE_DIR, "..", "..", "..", "..", "..");

/** Absolute path to the Python bridge script the adapter spawns. */
export const OPENHANDS_BRIDGE_SCRIPT = path.join(MODULE_DIR, "bridge", "run_task.py");

/** Default interpreter location for the isolated OpenHands environment. */
export function defaultPythonPath(root: string = REPO_ROOT): string {
  return process.platform === "win32"
    ? path.join(root, ".openhands-env", "Scripts", "python.exe")
    : path.join(root, ".openhands-env", "bin", "python");
}

export type OpenHandsConfig = {
  enabled: boolean;
  serverUrl: string;
  sessionApiKey: string | null;
  secretKey: string | null;
  model: string;
  timeoutMs: number;
  /** Interpreter used to run the Python bridge. */
  pythonPath: string;
  /** Absolute path to the Python bridge script. */
  bridgeScript: string;
  /** Optional direct LLM credentials for the bridge. */
  llmApiKey: string | null;
  llmBaseUrl: string | null;
};

/** A configuration error safe to surface (never contains secret values). */
export class OpenHandsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenHandsConfigError";
  }
}

function parseBoolean(raw: string | undefined, fallback = false): boolean {
  if (raw == null) return fallback;
  const value = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off", ""].includes(value)) return false;
  return fallback;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new OpenHandsConfigError("OPENHANDS_TIMEOUT_MS must be a positive integer.");
  }
  return value;
}

/**
 * Parse and validate the OpenHands configuration from the environment.
 *
 * When the feature is disabled this never throws: the rest of the server can
 * boot without a single OpenHands variable set. When it is enabled, every
 * required value is validated up front so a misconfigured server fails loudly
 * and early instead of silently degrading.
 */
export function loadOpenHandsConfig(env: NodeJS.ProcessEnv = process.env): OpenHandsConfig {
  const enabled = parseBoolean(env.OPENHANDS_ENABLED, false);

  const serverUrl = (env.OPENHANDS_AGENT_SERVER_URL?.trim() || OPENHANDS_DEFAULT_SERVER_URL).replace(
    /\/+$/,
    "",
  );
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new OpenHandsConfigError("OPENHANDS_AGENT_SERVER_URL must be a valid absolute URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new OpenHandsConfigError("OPENHANDS_AGENT_SERVER_URL must use http or https.");
  }

  const sessionApiKey = env.OPENHANDS_SESSION_API_KEY?.trim() || null;
  const secretKey = env.OPENHANDS_SECRET_KEY?.trim() || null;
  const model = env.OPENHANDS_MODEL?.trim() || OPENHANDS_DEFAULT_MODEL;
  const timeoutMs = parsePositiveInt(env.OPENHANDS_TIMEOUT_MS, OPENHANDS_DEFAULT_TIMEOUT_MS);
  const pythonPath = env.OPENHANDS_PYTHON?.trim() || defaultPythonPath();
  const llmApiKey = env.OPENHANDS_LLM_API_KEY?.trim() || null;
  const llmBaseUrl = env.OPENHANDS_LLM_BASE_URL?.trim() || null;

  if (enabled) {
    if (!sessionApiKey) {
      throw new OpenHandsConfigError(
        "OPENHANDS_SESSION_API_KEY is required when OPENHANDS_ENABLED is true.",
      );
    }
    if (!secretKey) {
      throw new OpenHandsConfigError(
        "OPENHANDS_SECRET_KEY is required when OPENHANDS_ENABLED is true.",
      );
    }
  }

  return {
    enabled,
    serverUrl,
    sessionApiKey,
    secretKey,
    model,
    timeoutMs,
    pythonPath,
    bridgeScript: OPENHANDS_BRIDGE_SCRIPT,
    llmApiKey,
    llmBaseUrl,
  };
}

/** True when the OpenHands coding-agent path is enabled for this server. */
export function isOpenHandsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseBoolean(env.OPENHANDS_ENABLED, false);
}
