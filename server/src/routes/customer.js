// Customer accounts: register / login / me / my orders. scrypt-hashed passwords.
import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../db/database.js";
import { hashPassword, verifyPassword, createCustomerSession, customerFromSession, bearerToken } from "../auth.js";

export const customer = Router();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

customer.post("/auth/register", (req, res) => {
  const { email, name, password } = req.body || {};
  if (!emailRe.test(email || "")) return res.status(422).json({ error: "INVALID_EMAIL" });
  if (!password || password.length < 8) return res.status(422).json({ error: "WEAK_PASSWORD", message: "Password must be at least 8 characters." });
  if (db.prepare("SELECT id FROM customers WHERE email = ?").get(email.toLowerCase()))
    return res.status(409).json({ error: "EMAIL_TAKEN" });
  const { hash, salt } = hashPassword(password);
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO customers (id, email, name, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, email.toLowerCase(), (name || "").trim(), hash, salt, new Date().toISOString());
  const token = createCustomerSession(id);
  res.json({ token, customer: { id, email: email.toLowerCase(), name: (name || "").trim() } });
});

customer.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const row = db.prepare("SELECT * FROM customers WHERE email = ?").get((email || "").toLowerCase());
  if (!row || !verifyPassword(password || "", row.pass_hash, row.pass_salt))
    return res.status(401).json({ error: "BAD_CREDENTIALS", message: "Email or password is incorrect." });
  const token = createCustomerSession(row.id);
  res.json({ token, customer: { id: row.id, email: row.email, name: row.name } });
});

customer.get("/me", (req, res) => {
  const c = customerFromSession(bearerToken(req));
  if (!c) return res.status(401).json({ error: "UNAUTHORIZED" });
  res.json(c);
});

customer.get("/me/orders", (req, res) => {
  const c = customerFromSession(bearerToken(req));
  if (!c) return res.status(401).json({ error: "UNAUTHORIZED" });
  const orders = db.prepare("SELECT ref, status, total_cents, currency, created_at, test_mode FROM orders WHERE customer_id = ? ORDER BY created_at DESC").all(c.id);
  res.json(orders.map((o) => ({ ref: o.ref, status: o.status, total: o.total_cents / 100, currency: o.currency, createdAt: o.created_at, testMode: Boolean(o.test_mode) })));
});

customer.post("/auth/logout", (req, res) => {
  const t = bearerToken(req);
  if (t) db.prepare("DELETE FROM customer_sessions WHERE token = ?").run(t);
  res.json({ ok: true });
});
