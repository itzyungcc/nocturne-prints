// Nocturne Prints API server.
import express from "express";
import path from "node:path";
import { db } from "./db/database.js";
import { seedIfEmpty } from "./db/seed.js";
import { shop } from "./routes/shop.js";
import { checkout } from "./routes/checkout.js";
import { customer } from "./routes/customer.js";
import { admin } from "./routes/admin.js";

const app = express();
app.use(express.json({ limit: "256kb" }));

// CORS for local dev (Vite on :5173). Restrict in production via ALLOWED_ORIGIN.
const allowed = process.env.ALLOWED_ORIGIN;
app.use((req, res, next) => {
  if (allowed) res.setHeader("Access-Control-Allow-Origin", allowed);
  else { res.setHeader("Access-Control-Allow-Origin", "*"); }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true, service: "nocturne-prints", testMode: true }));
app.use("/api", shop);
app.use("/api", checkout);
app.use("/api", customer);
app.use("/api/admin", admin);

// Serve the built frontend in production.
const webDist = path.join(process.cwd(), "..", "web", "dist");
app.use(express.static(webDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(webDist, "index.html"), (err) => err && next());
});

// Auto-seed the demo catalog on first boot when the database is empty
// (fresh deploy: Render's ephemeral filesystem starts empty). The seed
// content is marked demo=1 everywhere; set SEED_DEMO_DATA=0 to disable.
if (process.env.SEED_DEMO_DATA !== "0") {
  try {
    if (seedIfEmpty()) console.log("catalog empty on boot — seeded demo catalog (SEED_DEMO_DATA=0 to disable)");
  } catch (e) { console.warn("boot seed skipped:", e.message); }
}

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`nocturne-prints API on :${port}`));
