// Nocturne Prints — SQLite database (node:sqlite, zero-config).
// Tables: creators, collections, products, variants, customers, orders,
// order_items, admin_sessions, customer_sessions, settings.
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "nocturne.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
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
  status TEXT NOT NULL DEFAULT 'active', -- active | archived | coming_soon
  featured INTEGER NOT NULL DEFAULT 0,
  is_sale INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 1 -- 1 = clearly-marked demonstration content
);
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- e.g. '8x10 Print'
  sku TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  compare_at_cents INTEGER,         -- sale reference price
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
  ref TEXT NOT NULL UNIQUE,         -- human order reference e.g. NCP-20261009-AB12
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
  status TEXT NOT NULL DEFAULT 'paid_test', -- paid_test | pending | fulfilled | cancelled
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
  percent_off INTEGER NOT NULL,     -- 0-100
  active INTEGER NOT NULL DEFAULT 1
);
`);
