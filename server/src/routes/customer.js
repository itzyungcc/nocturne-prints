// Customer accounts: register / login / me / my orders. scrypt-hashed passwords.
import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../db/database.js";
import { hashPassword, verifyPassword, createCustomerSession, customerFromSession, bearerToken } from "../auth.js";

export const customer = Router();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

customer.post("/auth/register", async (req, res) => {
  const { email, name, password } = req.body || {};
  if (!emailRe.test(email || "")) return res.status(422).json({ error: "INVALID_EMAIL" });
  if (!password || password.length < 8) return res.status(422).json({ error: "WEAK_PASSWORD", message: "Password must be at least 8 characters." });
  if (await db.prepare("SELECT id FROM customers WHERE email = ?").get(email.toLowerCase()))
    return res.status(409).json({ error: "EMAIL_TAKEN" });
  const { hash, salt } = hashPassword(password);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO customers (id, email, name, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, email.toLowerCase(), (name || "").trim(), hash, salt, new Date().toISOString());
  const token = await createCustomerSession(id);
  res.json({ token, customer: { id, email: email.toLowerCase(), name: (name || "").trim() } });
});

customer.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const row = await db.prepare("SELECT * FROM customers WHERE email = ?").get((email || "").toLowerCase());
  if (!row || !verifyPassword(password || "", row.pass_hash, row.pass_salt))
    return res.status(401).json({ error: "BAD_CREDENTIALS", message: "Email or password is incorrect." });
  const token = await createCustomerSession(row.id);
  res.json({ token, customer: { id: row.id, email: row.email, name: row.name } });
});

customer.get("/me", async (req, res) => {
  const c = await customerFromSession(bearerToken(req));
  if (!c) return res.status(401).json({ error: "UNAUTHORIZED" });
  res.json(c);
});

customer.get("/me/orders", async (req, res) => {
  const c = await customerFromSession(bearerToken(req));
  if (!c) return res.status(401).json({ error: "UNAUTHORIZED" });
  const orders = await db.prepare("SELECT ref, status, total_cents, currency, created_at, test_mode FROM orders WHERE customer_id = ? ORDER BY created_at DESC").all(c.id);
  res.json(orders.map((o) => ({ ref: o.ref, status: o.status, total: o.total_cents / 100, currency: o.currency, createdAt: o.created_at, testMode: Boolean(o.test_mode) })));
});

customer.post("/auth/logout", async (req, res) => {
  const t = bearerToken(req);
  if (t) await db.prepare("DELETE FROM customer_sessions WHERE token = ?").run(t);
  res.json({ ok: true });
});
