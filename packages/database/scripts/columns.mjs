/**
 * Safe column-level inspection for key tables.
 * Prints column metadata only — no credentials, no data.
 * Usage: node columns.mjs <env-file> table1 table2 ...
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
const tables = process.argv.slice(3);
const { default: postgres } = await import("postgres");
const client = postgres(url, { connect_timeout: 10, ssl: "require", prepare: false, onnotice: () => {} });

for (const table of tables) {
  const cols = await client.unsafe(
    `select column_name, data_type, is_nullable, column_default, character_maximum_length
     from information_schema.columns
     where table_schema='public' and table_name = $1
     order by ordinal_position`,
    [table],
  );
  console.log(`\n### ${table} (${cols.length} columns)`);
  for (const c of cols) {
    const def = c.column_default ? ` default=${String(c.column_default).slice(0, 40)}` : "";
    const len = c.character_maximum_length ? `(${c.character_maximum_length})` : "";
    console.log(
      `  ${c.column_name}: ${c.data_type}${len} ${c.is_nullable === "YES" ? "null" : "not null"}${def}`,
    );
  }
  const fks = await client.unsafe(
    `select kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_col
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
     join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
     where tc.table_schema='public' and tc.table_name = $1 and tc.constraint_type='FOREIGN KEY'
     order by kcu.column_name`,
    [table],
  );
  if (fks.length) {
    console.log("  FKs:");
    for (const f of fks) console.log(`    ${f.column_name} -> ${f.ref_table}.${f.ref_col}`);
  }
  const idx = await client.unsafe(
    `select indexname from pg_indexes where schemaname='public' and tablename = $1 order by indexname`,
    [table],
  );
  if (idx.length) {
    console.log(`  indexes: ${idx.map((i) => i.indexname).join(", ")}`);
  }
}

await client.end();
