/**
 * Safe schema/migration state inspection.
 * Prints table names, counts and migration journal state only — no credentials.
 * Usage: node schema-state.mjs <env-file>
 */
import { readFileSync } from "node:fs";

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

const env = loadEnv(process.argv[2]);
const url = env.DATABASE_MIGRATION_URL || env.DATABASE_URL;
const { default: postgres } = await import("postgres");
const client = postgres(url, { connect_timeout: 10, ssl: "require", prepare: false, onnotice: () => {} });

async function q(sql) {
  return client.unsafe(sql);
}

const pub = await q("select current_database() db, current_user usr");
console.log(`database=${pub[0].db}  user=${pub[0].usr}`);

const ver = await q("select version() v");
console.log(`server=${String(ver[0].v).split(" on ")[0]}`);

const tables = await q(
  "select table_name from information_schema.tables where table_schema='public' order by table_name",
);
console.log(`\npublic tables (${tables.length}):`);
for (const t of tables) console.log(`  - ${t.table_name}`);

const migrationTable = await q(
  "select to_regclass('public.__drizzle_migrations') as t",
);
console.log(`\n__drizzle_migrations table: ${migrationTable[0].t ?? "(absent)"}`);
if (migrationTable[0].t) {
  const cnt = await q("select count(*)::int c from public.__drizzle_migrations");
  console.log(`migration rows recorded: ${cnt[0].c}`);
  const last = await q(
    "select created_at, hash from public.__drizzle_migrations order by id desc limit 1",
  );
  if (last.length) {
    console.log(`last migration applied: created_at=${last[0].created_at} hash=${last[0].hash}`);
  }
}

const enums = await q(
  "select t.typname as name from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e' order by 1",
);
console.log(`\nenum types (${enums.length}): ${enums.map((e) => e.name).join(", ")}`);

await client.end();
