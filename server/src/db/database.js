// Async database interface for Nocturne Prints.
// Production: PostgreSQL when DATABASE_URL is set (Render free tier).
// Local dev: node:sqlite, zero config.
// Same API on both: prepare(sql).get/.all/.run (all async), exec(sql).
// SQL uses ? placeholders; the pg backend rewrites them to $n.
// Prefer ON CONFLICT upserts (supported by both) over INSERT OR REPLACE.
import path from "node:path";
import fs from "node:fs";

const usePg = Boolean(process.env.DATABASE_URL);

function pgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

let prepare;
let exec;

if (usePg) {
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  client.on("error", (e) => console.error("pg client error", e.message));
  await client.connect();
  console.log("db: postgresql");
  prepare = (sql) => {
    const q = pgPlaceholders(sql);
    return {
      get: async (...p) => (await client.query(q, p)).rows[0],
      all: async (...p) => (await client.query(q, p)).rows,
      run: async (...p) => { await client.query(q, p); return {}; },
    };
  };
  exec = async (sql) => { await client.query(pgPlaceholders(sql)); };
} else {
  const { DatabaseSync } = await import("node:sqlite");
  const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "nocturne.db");
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sdb = new DatabaseSync(DB_PATH);
  sdb.exec("PRAGMA journal_mode = WAL");
  console.log("db: sqlite", DB_PATH);
  prepare = (sql) => {
    const stmt = sdb.prepare(sql);
    return {
      get: async (...p) => stmt.get(...p),
      all: async (...p) => stmt.all(...p),
      run: async (...p) => { stmt.run(...p); return {}; },
    };
  };
  exec = async (sql) => { sdb.exec(sql); };
}

await exec(`
CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_seed TEXT NOT NULL DEFAULT 'nocturne',
  website TEXT NOT NULL DEFAULT '',
  twitter TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  creator_id TEXT NOT NULL REFERENCES creators(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  collection_id TEXT REFERENCES collections(id),
  description TEXT NOT NULL DEFAULT '',
  specs TEXT NOT NULL DEFAULT '',
  art_seed TEXT NOT NULL,
  palette TEXT NOT NULL DEFAULT 'nocturne',
  status TEXT NOT NULL DEFAULT 'active',
  featured INTEGER NOT NULL DEFAULT 0,
  is_sale INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  compare_at_cents INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customer_sessions (
  token TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customers(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  address1 TEXT NOT NULL DEFAULT '',
  address2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postcode TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'paid_test',
  test_mode INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS discount_codes (
  code TEXT PRIMARY KEY,
  percent_off INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
`);

export { prepare, exec };
export const db = { prepare, exec };
export const USING_PG = usePg;
