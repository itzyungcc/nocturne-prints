// Admin API. All routes (except login) require a valid admin session.
// Password comes from ADMIN_PASSWORD env — never hardcoded, never in the repo.
import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../db/database.js";
import {
  requireAdmin, createAdminSession, destroyAdminSession,
  verifyAdminPassword, adminPasswordSet, bearerToken,
} from "../auth.js";

export const admin = Router();

admin.post("/login", (req, res) => {
  if (!adminPasswordSet())
    return res.status(503).json({ error: "ADMIN_NOT_CONFIGURED", message: "Set ADMIN_PASSWORD in the server environment." });
  const { password } = req.body || {};
  if (!verifyAdminPassword(password || ""))
    return res.status(401).json({ error: "BAD_CREDENTIALS" });
  res.json({ token: createAdminSession() });
});

admin.post("/logout", (req, res) => {
  destroyAdminSession(bearerToken(req));
  res.json({ ok: true });
});

admin.use(requireAdmin);

admin.get("/overview", (req, res) => {
  const q = (sql, ...a) => db.prepare(sql).get(...a);
  res.json({
    products: q("SELECT COUNT(*) n FROM products WHERE status != 'archived'").n,
    orders: q("SELECT COUNT(*) n FROM orders").n,
    revenueCents: q("SELECT COALESCE(SUM(total_cents),0) n FROM orders WHERE status != 'cancelled'").n,
    lowStock: db.prepare("SELECT v.sku, v.stock, p.title FROM variants v JOIN products p ON p.id = v.product_id WHERE v.stock <= 5 ORDER BY v.stock").all(),
  });
});

// --- Products ---
admin.get("/products", (req, res) => {
  const rows = db.prepare(
    `SELECT p.*, col.title AS collection_title FROM products p LEFT JOIN collections col ON col.id = p.collection_id ORDER BY p.created_at DESC`
  ).all();
  res.json(rows.map((p) => ({
    ...p,
    variants: db.prepare("SELECT * FROM variants WHERE product_id = ? ORDER BY sort_order").all(p.id),
  })));
});

function upsertProduct(body, id) {
  const { slug, title, collection_id, description, specs, art_seed, palette, status, featured, is_sale, variants } = body;
  if (!title || !slug) throw Object.assign(new Error("title and slug required"), { status: 422 });
  const pid = id || crypto.randomUUID();
  db.prepare(
    `INSERT INTO products (id, slug, title, creator_id, collection_id, description, specs, art_seed, palette, status, featured, is_sale, created_at, demo)
     VALUES (?, ?, ?, 'aoki', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title=excluded.title, collection_id=excluded.collection_id,
       description=excluded.description, specs=excluded.specs, art_seed=excluded.art_seed, palette=excluded.palette,
       status=excluded.status, featured=excluded.featured, is_sale=excluded.is_sale`
  ).run(pid, slug, title, collection_id || null, description || "", specs || "", art_seed || slug, palette || "nocturne",
    status || "active", featured ? 1 : 0, is_sale ? 1 : 0, new Date().toISOString());
  db.prepare("DELETE FROM variants WHERE product_id = ?").run(pid);
  const ins = db.prepare("INSERT INTO variants (id, product_id, name, sku, price_cents, compare_at_cents, stock, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  (variants || []).forEach((v, i) => {
    if (!v.name || !(v.price_cents >= 0)) throw Object.assign(new Error("invalid variant"), { status: 422 });
    ins.run(crypto.randomUUID(), pid, v.name, v.sku || `${slug}-${i}`, Math.round(v.price_cents),
      v.compare_at_cents != null ? Math.round(v.compare_at_cents) : null, Math.max(0, parseInt(v.stock ?? 0, 10) || 0), i);
  });
  return pid;
}

admin.post("/products", (req, res) => {
  try { res.status(201).json({ id: upsertProduct(req.body) }); }
  catch (e) { res.status(e.status || 500).json({ error: "SAVE_FAILED", message: e.message }); }
});
admin.put("/products/:id", (req, res) => {
  try { res.json({ id: upsertProduct(req.body, req.params.id) }); }
  catch (e) { res.status(e.status || 500).json({ error: "SAVE_FAILED", message: e.message }); }
});
admin.post("/products/:id/archive", (req, res) => {
  db.prepare("UPDATE products SET status = 'archived' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// --- Collections ---
admin.get("/collections", (req, res) => {
  res.json(db.prepare("SELECT * FROM collections ORDER BY sort_order").all());
});
admin.post("/collections", (req, res) => {
  const { title, slug, description } = req.body || {};
  if (!title || !slug) return res.status(422).json({ error: "INVALID" });
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO collections (id, title, slug, description, creator_id, sort_order) VALUES (?, ?, ?, ?, 'aoki', 99)")
    .run(id, title, slug, description || "");
  res.status(201).json({ id });
});

// --- Orders ---
admin.get("/orders", (req, res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100").all();
  res.json(orders.map((o) => ({
    ...o,
    items: db.prepare("SELECT title, variant_name, unit_price_cents, quantity FROM order_items WHERE order_id = ?").all(o.id),
  })));
});
admin.post("/orders/:id/status", (req, res) => {
  const { status } = req.body || {};
  if (!["paid_test", "pending", "fulfilled", "cancelled"].includes(status))
    return res.status(422).json({ error: "INVALID_STATUS" });
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ ok: true });
});

// --- Settings ---
admin.get("/settings", (req, res) => {
  res.json(Object.fromEntries(db.prepare("SELECT key, value FROM settings").all().map((r) => [r.key, r.value])));
});
admin.put("/settings", (req, res) => {
  const allowed = ["store_name", "store_tagline", "currency", "age_gate_enabled", "age_gate_minimum", "test_mode", "shipping_flat_cents", "free_shipping_over_cents"];
  const ins = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  for (const k of allowed) if (req.body[k] !== undefined) ins.run(k, String(req.body[k]));
  res.json({ ok: true });
});
