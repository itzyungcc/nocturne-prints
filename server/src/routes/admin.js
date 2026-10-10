// Admin API. All routes (except login) require a valid admin session.
// Password comes from ADMIN_PASSWORD env — never hardcoded, never in the repo.
import { Router } from "express";
import express from "express";
import crypto from "node:crypto";
import { db } from "../db/database.js";
import {
  requireAdmin, createAdminSession, destroyAdminSession,
  verifyAdminPassword, adminPasswordSet, bearerToken,
} from "../auth.js";

export const admin = Router();

admin.post("/login", async (req, res) => {
  if (!adminPasswordSet())
    return res.status(503).json({ error: "ADMIN_NOT_CONFIGURED", message: "Set ADMIN_PASSWORD in the server environment." });
  const { password } = req.body || {};
  if (!verifyAdminPassword(password || ""))
    return res.status(401).json({ error: "BAD_CREDENTIALS" });
  res.json({ token: await createAdminSession() });
});

admin.post("/logout", async (req, res) => {
  await destroyAdminSession(bearerToken(req));
  res.json({ ok: true });
});

admin.use(requireAdmin);

admin.get("/overview", async (req, res) => {
  const q = async (sql, ...a) => (await db.prepare(sql).get(...a));
  res.json({
    products: (await q("SELECT COUNT(*) n FROM products WHERE status != 'archived'")).n,
    orders: (await q("SELECT COUNT(*) n FROM orders")).n,
    revenueCents: (await q("SELECT COALESCE(SUM(total_cents),0) n FROM orders WHERE status != 'cancelled'")).n,
    lowStock: await db.prepare("SELECT v.sku, v.stock, p.title FROM variants v JOIN products p ON p.id = v.product_id WHERE v.stock <= 5 ORDER BY v.stock").all(),
  });
});

// --- Products ---
admin.get("/products", async (req, res) => {
  const rows = await db.prepare(
    `SELECT p.*, col.title AS collection_title FROM products p LEFT JOIN collections col ON col.id = p.collection_id ORDER BY p.created_at DESC`
  ).all();
  res.json(await Promise.all(rows.map(async (p) => ({
    ...p,
    variants: await db.prepare("SELECT * FROM variants WHERE product_id = ? ORDER BY sort_order").all(p.id),
    images: (await db.prepare("SELECT id, mime FROM product_images WHERE product_id = ? ORDER BY sort_order").all(p.id))
      .map((i) => ({ id: i.id, mime: i.mime, url: `/api/images/${i.id}` })),
  }))));
});

async function upsertProduct(body, id) {
  const { slug, title, collection_id, description, specs, art_seed, palette, status, featured, is_sale, variants } = body;
  if (!title || !slug) throw Object.assign(new Error("title and slug required"), { status: 422 });
  const pid = id || crypto.randomUUID();
  try {
    await db.prepare(
      `INSERT INTO products (id, slug, title, creator_id, collection_id, description, specs, art_seed, palette, status, featured, is_sale, created_at, demo)
       VALUES (?, ?, ?, 'aoki', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title=excluded.title, collection_id=excluded.collection_id,
         description=excluded.description, specs=excluded.specs, art_seed=excluded.art_seed, palette=excluded.palette,
         status=excluded.status, featured=excluded.featured, is_sale=excluded.is_sale`
    ).run(pid, slug, title, collection_id || null, description || "", specs || "", art_seed || slug, palette || "nocturne",
      status || "active", featured ? 1 : 0, is_sale ? 1 : 0, new Date().toISOString());
  } catch (e) {
    if (/unique|duplicate/i.test(e.message || ""))
      throw Object.assign(new Error(`The URL slug "${slug}" is already used by another product. Change the slug and save again.`), { status: 409 });
    throw e;
  }
  await db.prepare("DELETE FROM variants WHERE product_id = ?").run(pid);
  for (let i = 0; i < (variants || []).length; i++) {
    const v = variants[i];
    if (!v.name || !(v.price_cents >= 0)) throw Object.assign(new Error("invalid variant"), { status: 422 });
    await db.prepare("INSERT INTO variants (id, product_id, name, sku, price_cents, compare_at_cents, stock, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(crypto.randomUUID(), pid, v.name, v.sku || `${slug}-${i}`, Math.round(v.price_cents),
        v.compare_at_cents != null ? Math.round(v.compare_at_cents) : null, Math.max(0, parseInt(v.stock ?? 0, 10) || 0), i);
  }
  return pid;
}

admin.post("/products", async (req, res) => {
  try { res.status(201).json({ id: await upsertProduct(req.body) }); }
  catch (e) { res.status(e.status || 500).json({ error: "SAVE_FAILED", message: e.message }); }
});
admin.put("/products/:id", async (req, res) => {
  try { res.json({ id: await upsertProduct(req.body, req.params.id) }); }
  catch (e) { res.status(e.status || 500).json({ error: "SAVE_FAILED", message: e.message }); }
});
admin.post("/products/:id/archive", async (req, res) => {
  await db.prepare("UPDATE products SET status = 'archived' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// --- Product images (binary upload, stored in the database so they survive redeploys) ---
const rawImage = express.raw({ type: "image/*", limit: 3 * 1024 * 1024 });
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

admin.post("/products/:id/images", rawImage, async (req, res) => {
  try {
    const p = await db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "NOT_FOUND", message: "Product not found." });
    const mime = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME.has(mime))
      return res.status(415).json({ error: "BAD_IMAGE", message: "Only JPEG, PNG or WebP images are accepted." });
    if (!req.body || !req.body.length)
      return res.status(422).json({ error: "EMPTY_IMAGE", message: "No image data received." });
    const next = (await db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 n FROM product_images WHERE product_id = ?")
      .get(req.params.id)).n;
    const id = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO product_images (id, product_id, mime, data, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, req.params.id, mime, Buffer.from(req.body), next, new Date().toISOString());
    res.status(201).json({ id, mime, url: `/api/images/${id}` });
  } catch (e) {
    if (e.type === "entity.too.large")
      return res.status(413).json({ error: "TOO_LARGE", message: "Image must be under 3 MB." });
    res.status(500).json({ error: "UPLOAD_FAILED", message: e.message });
  }
});

admin.delete("/products/:id/images/:imageId", async (req, res) => {
  await db.prepare("DELETE FROM product_images WHERE id = ? AND product_id = ?")
    .run(req.params.imageId, req.params.id);
  res.json({ ok: true });
});

// --- Collections ---
admin.get("/collections", async (req, res) => {
  const rows = await db.prepare("SELECT * FROM collections ORDER BY sort_order").all();
  res.json(await Promise.all(rows.map(async (c) => ({
    ...c,
    productCount: (await db.prepare("SELECT COUNT(*) n FROM products WHERE collection_id = ?").get(c.id)).n,
  }))));
});
admin.post("/collections", async (req, res) => {
  const { title, slug, description } = req.body || {};
  if (!title || !slug) return res.status(422).json({ error: "INVALID", message: "Title and slug are required." });
  const id = crypto.randomUUID();
  try {
    await db.prepare("INSERT INTO collections (id, title, slug, description, creator_id, sort_order) VALUES (?, ?, ?, ?, 'aoki', 99)")
      .run(id, title, slug, description || "");
  } catch (e) {
    return res.status(409).json({ error: "SLUG_TAKEN", message: "That slug is already used." });
  }
  res.status(201).json({ id });
});
admin.put("/collections/:id", async (req, res) => {
  const { title, description, sort_order } = req.body || {};
  const c = await db.prepare("SELECT id FROM collections WHERE id = ?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "NOT_FOUND" });
  await db.prepare("UPDATE collections SET title = ?, description = ?, sort_order = ? WHERE id = ?")
    .run(title || "", description || "", parseInt(sort_order, 10) || 0, req.params.id);
  res.json({ ok: true });
});
admin.delete("/collections/:id", async (req, res) => {
  const n = (await db.prepare("SELECT COUNT(*) n FROM products WHERE collection_id = ?").get(req.params.id)).n;
  if (n > 0)
    return res.status(409).json({ error: "HAS_PRODUCTS", message: `${n} product(s) still use this collection. Move them first.` });
  await db.prepare("DELETE FROM collections WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// --- Discount codes ---
admin.get("/discounts", async (req, res) => {
  res.json(await db.prepare("SELECT code, percent_off, active FROM discount_codes ORDER BY code").all());
});
admin.post("/discounts", async (req, res) => {
  const code = String(req.body?.code || "").toUpperCase().trim();
  const percent = parseInt(req.body?.percent_off, 10);
  if (!/^[A-Z0-9_-]{3,24}$/.test(code))
    return res.status(422).json({ error: "INVALID", message: "Code must be 3–24 characters (letters, numbers, - or _)." });
  if (!Number.isInteger(percent) || percent < 1 || percent > 100)
    return res.status(422).json({ error: "INVALID", message: "Percent off must be between 1 and 100." });
  try {
    await db.prepare("INSERT INTO discount_codes (code, percent_off, active) VALUES (?, ?, ?)")
      .run(code, percent, req.body?.active === false ? 0 : 1);
  } catch (e) {
    return res.status(409).json({ error: "CODE_TAKEN", message: "That code already exists." });
  }
  res.status(201).json({ code });
});
admin.put("/discounts/:code", async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const percent = parseInt(req.body?.percent_off, 10);
  if (!Number.isInteger(percent) || percent < 1 || percent > 100)
    return res.status(422).json({ error: "INVALID", message: "Percent off must be between 1 and 100." });
  const r = await db.prepare("UPDATE discount_codes SET percent_off = ?, active = ? WHERE code = ?")
    .run(percent, req.body?.active === false ? 0 : 1, code);
  res.json({ ok: true });
});
admin.delete("/discounts/:code", async (req, res) => {
  await db.prepare("DELETE FROM discount_codes WHERE code = ?").run(String(req.params.code).toUpperCase());
  res.json({ ok: true });
});

// --- Customers (read-only) ---
admin.get("/customers", async (req, res) => {
  const rows = await db.prepare(
    "SELECT id, email, name, created_at FROM customers ORDER BY created_at DESC LIMIT 200"
  ).all();
  res.json(await Promise.all(rows.map(async (c) => ({
    ...c,
    orders: (await db.prepare("SELECT COUNT(*) n FROM orders WHERE customer_id = ?").get(c.id)).n,
  }))));
});

// --- Orders ---
admin.get("/orders", async (req, res) => {
  const orders = await db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100").all();
  res.json(await Promise.all(orders.map(async (o) => ({
    ...o,
    items: await db.prepare("SELECT title, variant_name, unit_price_cents, quantity FROM order_items WHERE order_id = ?").all(o.id),
  }))));
});
admin.post("/orders/:id/status", async (req, res) => {
  const { status } = req.body || {};
  if (!["paid_test", "pending", "fulfilled", "cancelled"].includes(status))
    return res.status(422).json({ error: "INVALID_STATUS" });
  await db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ ok: true });
});

// --- Settings ---
admin.get("/settings", async (req, res) => {
  res.json(Object.fromEntries((await db.prepare("SELECT key, value FROM settings").all()).map((r) => [r.key, r.value])));
});
admin.put("/settings", async (req, res) => {
  const allowed = ["store_name", "store_tagline", "currency", "age_gate_enabled", "age_gate_minimum", "test_mode", "shipping_flat_cents", "free_shipping_over_cents"];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      await db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value")
        .run(k, String(req.body[k]));
    }
  }
  res.json({ ok: true });
});
