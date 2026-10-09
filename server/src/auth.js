// Password hashing (scrypt) + opaque session tokens.
// Admin: single account, password from ADMIN_PASSWORD env (never hardcoded).
// Customers: email + scrypt-hashed password.
import crypto from "node:crypto";
import { db } from "./db/database.js";

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const { hash: h } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(hash, "hex"));
}

export function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

export function adminPasswordSet() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function verifyAdminPassword(password) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const a = Buffer.from(String(password));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function createAdminSession() {
  const token = newToken();
  const now = new Date();
  const exp = new Date(now.getTime() + SESSION_TTL_MS);
  await db.prepare(
    "INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?, ?, ?)"
  ).run(token, now.toISOString(), exp.toISOString());
  return token;
}

export async function validAdminSession(token) {
  if (!token) return false;
  const row = await db.prepare("SELECT * FROM admin_sessions WHERE token = ?").get(token);
  if (!row) return false;
  if (Date.parse(row.expires_at) < Date.now()) {
    await db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(token);
    return false;
  }
  return true;
}

export async function destroyAdminSession(token) {
  await db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(token);
}

export async function createCustomerSession(customerId) {
  const token = newToken();
  const now = new Date();
  const exp = new Date(now.getTime() + SESSION_TTL_MS);
  await db.prepare(
    "INSERT INTO customer_sessions (token, customer_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(token, customerId, now.toISOString(), exp.toISOString());
  return token;
}

export async function customerFromSession(token) {
  if (!token) return null;
  const row = await db.prepare("SELECT * FROM customer_sessions WHERE token = ?").get(token);
  if (!row || Date.parse(row.expires_at) < Date.now()) return null;
  return (await db.prepare("SELECT id, email, name, created_at FROM customers WHERE id = ?").get(row.customer_id)) || null;
}

export function bearerToken(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/);
  return m ? m[1] : null;
}

export async function requireAdmin(req, res, next) {
  if (!(await validAdminSession(bearerToken(req)))) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Admin sign-in required." });
  }
  next();
}
