/**
 * Safe database connectivity diagnostic.
 *
 * Never prints passwords, full connection strings, or Supabase secret keys.
 * Only reports sanitized host/port/user/database metadata and driver error codes.
 *
 * Usage: node db-diagnose.mjs <path-to-env-file>
 */
import { readFileSync } from "node:fs";
import net from "node:net";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!(k in out)) out[k] = t.slice(eq + 1).trim();
  }
  return out;
}

function parse(uri) {
  const m = /^(?<scheme>[a-zA-Z]+):\/\/(?<user>[^:@/]+):(?<pwd>[^@/]+)@(?<host>[^:/?]+):(?<port>\d+)\/(?<db>[^?]*)(\?(?<qs>.*))?$/.exec(uri);
  if (!m) return null;
  return { ...m.groups };
}

const redact = (s) =>
  String(s)
    .replace(/:[^:@/]+@/g, ":<redacted>@")
    .replace(/postgres(\.[a-z0-9]+)?:[^@\s]+/gi, "postgres$1:<redacted>");

function tcpProbe(host, port, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const started = Date.now();
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve({ ok: true, ms: Date.now() - started });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ ok: false, error: "TIMEOUT" });
    });
    socket.once("error", (err) => {
      socket.destroy();
      resolve({ ok: false, error: err.code || err.message });
    });
    socket.connect(port, host);
  });
}

async function main() {
  const envPath = process.argv[2];
  const env = loadEnv(envPath);
  const report = [];

  for (const key of ["DATABASE_URL", "DATABASE_MIGRATION_URL"]) {
    const raw = env[key];
    report.push(`--- ${key} ---`);
    if (!raw) {
      report.push("  UNSET");
      continue;
    }
    const c = parse(raw);
    if (!c) {
      report.push("  PARSE FAILED (could not parse URI without printing it)");
      continue;
    }
    const hostKind = c.host.includes(".pooler.supabase.com")
      ? "SUPABASE SESSION POOLER"
      : c.host.startsWith("db.")
        ? "SUPABASE DIRECT CONNECTION"
        : "OTHER/UNKNOWN";
    report.push(`  host=${c.host}  port=${c.port}  user=${c.user}  db=${c.db || "(none)"}`);
    report.push(`  detected connection method: ${hostKind}`);
    report.push(
      `  password: length=${c.pwd.length} percentEncoded=${/%[0-9A-Fa-f]{2}/.test(c.pwd)} needsEncoding=${/[^A-Za-z0-9_\-~]/.test(decodeURIComponent(c.pwd.replace(/\+/g, " ")) )}`,
    );
    report.push(`  query: ${c.qs || "(none)"}`);

    const tcp = await tcpProbe(c.host, Number(c.port));
    report.push(`  TCP ${tcp.ok ? `reachable (${tcp.ms}ms)` : `FAILED: ${tcp.error}`}`);
    if (!tcp.ok) continue;

    try {
      const { default: postgres } = await import("postgres");
      const client = postgres(raw, {
        connect_timeout: 10,
        ssl: key === "DATABASE_MIGRATION_URL" || env.DATABASE_SSL === "true" ? "require" : false,
        prepare: false,
        onnotice: () => {},
      });
      const rows = await client.unsafe(
        "select current_database() as db, current_user as usr, version() as ver, current_setting('transaction_isolation') as iso",
      );
      const r = rows[0];
      report.push(`  CONNECTION: OK`);
      report.push(`  current_database=${r.db}  current_user=${r.usr}`);
      report.push(`  server=${String(r.ver).split(" on ")[0]}`);
      const [major] = String(r.ver).match(/\d+/) ?? ["?"];
      report.push(`  server major version=${major}`);
      await client.end();
    } catch (err) {
      const code = err?.code || "";
      const msg = redact(err?.message || String(err));
      report.push(`  CONNECTION: FAILED`);
      report.push(`  driver code=${code || "(none)"}  name=${err?.name || ""}`);
      report.push(`  message=${msg}`);
      if (code === "28P01") {
        report.push(
          "  interpretation: 28P01 = invalid_password (PostgreSQL auth failure). This is a CREDENTIAL problem, not a schema/migration problem.",
        );
      } else if (code === "3D000") {
        report.push("  interpretation: 3D000 = invalid_catalog_name (database does not exist).");
      } else if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
        report.push(
          "  interpretation: network/DNS failure — the host is unreachable, not a credentials problem.",
        );
      }
    }
  }

  console.log(report.join("\n"));
}

main().catch((err) => {
  console.error("diagnostic failed:", redact(err?.message || err));
  process.exit(1);
});
