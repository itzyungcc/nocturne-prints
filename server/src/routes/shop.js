// Public storefront API: creators, collections, products, settings.
import { Router } from "express";
import { db } from "../db/database.js";

export const shop = Router();

const money = (c) => (c == null ? null : c / 100);

async function productWithVariants(row) {
  const variants = (await db
    .prepare("SELECT id, name, sku, price_cents, compare_at_cents, stock FROM variants WHERE product_id = ? ORDER BY sort_order")
    .all(row.id))
    .map((v) => ({ ...v, price: money(v.price_cents), compareAt: money(v.compare_at_cents) }));
  const images = (await db
    .prepare("SELECT id, mime FROM product_images WHERE product_id = ? ORDER BY sort_order")
    .all(row.id))
    .map((i) => ({ id: i.id, mime: i.mime, url: `/api/images/${i.id}` }));
  const prices = variants.map((v) => v.price_cents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const inStock = variants.some((v) => v.stock > 0);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    creator: row.creator_name,
    creatorId: row.creator_id,
    collection: row.collection_slug ? { id: row.collection_id, slug: row.collection_slug, title: row.collection_title } : null,
    description: row.description,
    specs: row.specs,
    artSeed: row.art_seed,
    palette: row.palette,
    status: row.status,
    featured: Boolean(row.featured),
    isSale: Boolean(row.is_sale),
    demo: Boolean(row.demo),
    createdAt: row.created_at,
    variants,
    images,
    priceMin: money(min),
    priceMax: money(max),
    singlePrice: min === max,
    inStock,
  };
}

const BASE = `
  SELECT p.*, c.name AS creator_name, col.slug AS collection_slug, col.title AS collection_title
  FROM products p
  JOIN creators c ON c.id = p.creator_id
  LEFT JOIN collections col ON col.id = p.collection_id`;

shop.get("/creators/:id", async (req, res) => {
  const row = await db.prepare("SELECT * FROM creators WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ id: row.id, name: row.name, bio: row.bio, avatarSeed: row.avatar_seed, website: row.website, twitter: row.twitter, instagram: row.instagram });
});

shop.get("/collections", async (req, res) => {
  const rows = await db.prepare("SELECT * FROM collections ORDER BY sort_order").all();
  const withCounts = await Promise.all(rows.map(async (c) => ({
    ...c,
    productCount: (await db.prepare("SELECT COUNT(*) n FROM products WHERE collection_id = ? AND status = 'active'").get(c.id)).n,
  })));
  res.json(withCounts);
});

shop.get("/collections/:slug", async (req, res) => {  const c = await db.prepare("SELECT * FROM collections WHERE slug = ?").get(req.params.slug);
  if (!c) return res.status(404).json({ error: "NOT_FOUND" });
  const creator = await db.prepare("SELECT * FROM creators WHERE id = ?").get(c.creator_id);
  res.json({ ...c, creator: { id: creator.id, name: creator.name, bio: creator.bio, avatarSeed: creator.avatar_seed, twitter: creator.twitter, instagram: creator.instagram } });
});

// Public product image bytes (uploaded in admin; stored in the database).
shop.get("/images/:id", async (req, res) => {
  const row = await db.prepare("SELECT mime, data FROM product_images WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "NOT_FOUND" });
  res.setHeader("Content-Type", row.mime);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(row.data)); // node:sqlite returns Uint8Array; pg returns Buffer
});

// GET /api/products?collection=&q=&sort=&availability=&page=&perPage=
shop.get("/products", async (req, res) => {
  const { collection, q, sort = "featured", availability = "all", page = "1", perPage = "12" } = req.query;
  const where = ["p.status != 'archived'"];
  const params = [];
  if (collection) { where.push("col.slug = ?"); params.push(collection); }
  if (q) { where.push("(p.title LIKE ? OR p.description LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  let rows = await Promise.all(
    (await db.prepare(`${BASE} WHERE ${where.join(" AND ")}`).all(...params)).map(productWithVariants)
  );
  if (availability === "in_stock") rows = rows.filter((r) => r.inStock && r.status === "active");
  else if (availability === "on_sale") rows = rows.filter((r) => r.isSale);
  else if (availability === "coming_soon") rows = rows.filter((r) => r.status === "coming_soon");

  const by = {
    featured: (a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt),
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    price_asc: (a, b) => a.priceMin - b.priceMin,
    price_desc: (a, b) => b.priceMax - a.priceMax,
    alpha: (a, b) => a.title.localeCompare(b.title),
    popularity: (a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title),
  }[sort] || ((a, b) => 0);
  rows.sort(by);

  const pg = Math.max(1, parseInt(page, 10) || 1);
  const pp = Math.min(48, Math.max(1, parseInt(perPage, 10) || 12));
  const total = rows.length;
  res.json({ total, page: pg, perPage: pp, pages: Math.ceil(total / pp), items: rows.slice((pg - 1) * pp, pg * pp) });
});

shop.get("/products/:slug", async (req, res) => {
  const row = await db.prepare(`${BASE} WHERE p.slug = ?`).get(req.params.slug);
  if (!row || row.status === "archived") return res.status(404).json({ error: "NOT_FOUND" });
  const product = await productWithVariants(row);
  const related = await Promise.all(
    (await db.prepare(`${BASE} WHERE p.collection_id = ? AND p.id != ? AND p.status = 'active' LIMIT 4`)
      .all(row.collection_id, row.id)).map(productWithVariants)
  );
  res.json({ ...product, related });
});

shop.get("/settings", async (req, res) => {
  const rows = await db.prepare("SELECT key, value FROM settings").all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  res.json({
    storeName: out.store_name || "Nocturne Prints",
    tagline: out.store_tagline || "",
    currency: out.currency || "USD",
    ageGateEnabled: out.age_gate_enabled === "1",
    ageGateMinimum: parseInt(out.age_gate_minimum || "18", 10),
    testMode: out.test_mode !== "0",
    shippingFlat: money(parseInt(out.shipping_flat_cents || "500", 10)),
    freeShippingOver: money(parseInt(out.free_shipping_over_cents || "5000", 10)),
  });
});
