// Checkout: server-side cart validation, totals, test-mode payment, orders.
// TEST MODE ONLY until a real provider is wired (see payments.js).
// Card details are NEVER accepted or stored.
import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../db/database.js";
import { customerFromSession, bearerToken } from "../auth.js";

export const checkout = Router();

function getSetting(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

// Validate cart items against live stock/prices. Never trust client totals.
export function validateCart(items) {
  const errors = [];
  const lines = [];
  if (!Array.isArray(items) || items.length === 0) errors.push("Cart is empty.");
  const seen = new Set();
  for (const it of items || []) {
    const vid = it?.variantId;
    const qty = parseInt(it?.quantity, 10);
    if (!vid || seen.has(vid)) { errors.push(`Invalid item.`); continue; }
    seen.add(vid);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) { errors.push(`Invalid quantity.`); continue; }
    const v = db.prepare(
      `SELECT v.*, p.title, p.status FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`
    ).get(vid);
    if (!v) { errors.push(`Unknown item.`); continue; }
    if (v.status !== "active") { errors.push(`"${v.title}" is not available.`); continue; }
    if (v.stock < qty) { errors.push(`Only ${v.stock} left of "${v.title} — ${v.name}".`); continue; }
    lines.push({ variantId: v.id, productId: v.product_id, title: v.title, variantName: v.name, unitPriceCents: v.price_cents, quantity: qty });
  }
  return { errors, lines };
}

function totals(lines, discountCode) {
  const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  let discount = 0;
  if (discountCode) {
    const dc = db.prepare("SELECT * FROM discount_codes WHERE code = ? AND active = 1").get(String(discountCode).toUpperCase().trim());
    if (dc) discount = Math.round(subtotal * (dc.percent_off / 100));
  }
  const freeOver = parseInt(getSetting("free_shipping_over_cents", "5000"), 10);
  const flat = parseInt(getSetting("shipping_flat_cents", "500", 10));
  const shipping = subtotal - discount >= freeOver || subtotal === 0 ? 0 : flat;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping };
}

checkout.post("/cart/validate", (req, res) => {
  const { items, discountCode } = req.body || {};
  const { errors, lines } = validateCart(items);
  if (errors.length) return res.status(422).json({ ok: false, errors });
  res.json({ ok: true, ...totals(lines, discountCode), currency: getSetting("currency", "USD") });
});

// Modular payment interface. Only "test" is implemented; real providers
// plug in here AFTER credentials are supplied, with server-side verification.
const payments = {
  test: {
    label: "Test payment (no real charge)",
    async charge({ totalCents }) {
      if (totalCents <= 0) throw new Error("Invalid total");
      await new Promise((r) => setTimeout(r, 600)); // simulate gateway latency
      return { ok: true, providerRef: "TEST-" + crypto.randomBytes(4).toString("hex").toUpperCase() };
    },
  },
};

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

checkout.post("/checkout", async (req, res) => {
  try {
    const testMode = getSetting("test_mode", "1") !== "0";
    const { items, discountCode, customer, provider = "test" } = req.body || {};
    if (!testMode && provider === "test")
      return res.status(400).json({ error: "TEST_DISABLED", message: "Test payments are disabled. Configure a payment provider." });
    if (provider !== "test" || !payments[provider])
      return res.status(400).json({ error: "NO_PROVIDER", message: "Payment provider not configured. Test mode only." });

    const { errors, lines } = validateCart(items);
    if (errors.length) return res.status(422).json({ error: "CART_INVALID", errors });

    const c = customer || {};
    const fieldErrors = [];
    if (!c.name || c.name.trim().length < 2) fieldErrors.push("Full name is required.");
    if (!emailRe.test(c.email || "")) fieldErrors.push("A valid email is required.");
    if (!c.address1 || c.address1.trim().length < 3) fieldErrors.push("Street address is required.");
    if (!c.city) fieldErrors.push("City is required.");
    if (!c.postcode) fieldErrors.push("Postal code is required.");
    if (!c.country) fieldErrors.push("Country is required.");
    if (fieldErrors.length) return res.status(422).json({ error: "INVALID_FIELDS", errors: fieldErrors });

    const t = totals(lines, discountCode);
    const pay = await payments[provider].charge({ totalCents: t.total });
    if (!pay.ok) return res.status(502).json({ error: "PAYMENT_FAILED", message: "Payment was not completed." });

    const ref = `NCP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const oid = crypto.randomUUID();
    const cust = customerFromSession(bearerToken(req));
    const now = new Date().toISOString();
    const ins = db.prepare(
      `INSERT INTO orders (id, ref, customer_id, email, name, address1, address2, city, postcode, country,
        subtotal_cents, shipping_cents, discount_cents, total_cents, currency, status, test_mode, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid_test', 1, ?)`
    );
    const dec = db.prepare("UPDATE variants SET stock = stock - ? WHERE id = ?");
    const insItem = db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, variant_id, title, variant_name, unit_price_cents, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const txn = () => {
      db.exec("BEGIN");
      try {
        ins.run(oid, ref, cust?.id || null, c.email.trim(), c.name.trim(), c.address1.trim(), (c.address2 || "").trim(),
          c.city.trim(), c.postcode.trim(), c.country.trim(), t.subtotal, t.shipping, t.discount, t.total,
          getSetting("currency", "USD"), now);
        for (const l of lines) {
          dec.run(l.quantity, l.variantId);
          insItem.run(crypto.randomUUID(), oid, l.productId, l.variantId, l.title, l.variantName, l.unitPriceCents, l.quantity);
        }
        db.exec("COMMIT");
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    };
    txn();
    res.json({ ok: true, ref, total: t.total / 100, testMode: true, providerRef: pay.providerRef });
  } catch (e) {
    console.error("checkout error", e);
    res.status(500).json({ error: "CHECKOUT_FAILED", message: "Checkout could not be completed." });
  }
});

checkout.get("/orders/:ref", (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE ref = ?").get(req.params.ref);
  if (!o) return res.status(404).json({ error: "NOT_FOUND" });
  const items = db.prepare("SELECT title, variant_name, unit_price_cents, quantity FROM order_items WHERE order_id = ?").all(o.id);
  res.json({
    ref: o.ref, status: o.status, testMode: Boolean(o.test_mode), createdAt: o.created_at,
    email: o.email, name: o.name, currency: o.currency,
    subtotal: o.subtotal_cents / 100, shipping: o.shipping_cents / 100,
    discount: o.discount_cents / 100, total: o.total_cents / 100,
    items: items.map((i) => ({ title: i.title, variant: i.variant_name, price: i.unit_price_cents / 100, quantity: i.quantity })),
  });
});
