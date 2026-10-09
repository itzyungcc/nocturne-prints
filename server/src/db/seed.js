// Seed script: node src/db/seed.js
// Creates the demo catalog. ALL content here is original demonstration
// content (demo=1) — replace with the store owner's authorized artwork.
import { db } from "./database.js";

const now = new Date().toISOString();
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

function reset() {
  for (const t of ["order_items", "orders", "variants", "products", "collections", "creators", "discount_codes"]) {
    db.exec(`DELETE FROM "${t}"`);
  }
}

export function seedIfEmpty() {
  const n = db.prepare("SELECT COUNT(*) c FROM products").get().c;
  if (n > 0) return false;
  doSeed();
  return true;
}

function doSeed() {

reset();

// --- Creator ---
db.prepare(
  `INSERT INTO creators (id, name, bio, avatar_seed, website, twitter, instagram)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).run(
  "aoki",
  "AOKI",
  "Independent illustrator working after dark. Nocturne Prints collects original night-themed artwork as archival giclée prints, posters and stickers — drawn, printed and packed in small batches.",
  "aoki-avatar",
  "https://example.com",
  "@aoki_draws",
  "@aoki.draws"
);

// --- Collections ---
const collections = [
  { id: "neon-dreams", title: "Neon Dreams", slug: "neon-dreams", description: "Electric city nights, rendered in phosphor and glow.", sort: 0 },
  { id: "ink-ember", title: "Ink & Ember", slug: "ink-ember", description: "Warm darks, burnt edges and quiet firelight.", sort: 1 },
  { id: "paper-moons", title: "Paper Moons", slug: "paper-moons", description: "Cool moonlight studies in blue and silver.", sort: 2 },
];
for (const c of collections) {
  db.prepare(
    `INSERT INTO collections (id, title, slug, description, creator_id, sort_order) VALUES (?, ?, ?, ?, 'aoki', ?)`
  ).run(c.id, c.title, c.slug, c.description, c.sort);
}

// --- Products ---
// art_seed drives the original generative placeholder artwork (see web/src/lib/art.js).
const P = [
  // Neon Dreams
  { slug: "midnight-circuit", title: "Midnight Circuit Print", col: "neon-dreams", seed: "midnight-circuit", pal: "neon", desc: "A motherboard metropolis humming at 3am. Fine traces of cyan and magenta over deep indigo.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print" },
  { slug: "neon-harbor", title: "Neon Harbor Print", col: "neon-dreams", seed: "neon-harbor", pal: "neon", desc: "Dock lights doubling on black water. A study in reflection and sodium glow.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print" },
  { slug: "static-bloom", title: "Static Bloom Print", col: "neon-dreams", seed: "static-bloom", pal: "neon", desc: "A flower caught mid-broadcast. Petals of interference over a midnight field.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print" },
  { slug: "glasshouse-district", title: "Glasshouse District Print", col: "neon-dreams", seed: "glasshouse", pal: "neon", desc: "Towers of lit glass stacked against a violet sky. For lovers of vertical cities.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print" },
  { slug: "afterglow-poster", title: "Afterglow Poster", col: "neon-dreams", seed: "afterglow", pal: "neon", desc: "Large-format poster of the sun's last signal. One continuous gradient, edge to edge.", specs: "18x24in poster on 200gsm satin paper. Ships rolled in a tube.", kind: "poster", sale: [3000, 4000] },
  // Ink & Ember
  { slug: "ember-study-3", title: "Ember Study No. 3 Print", col: "ink-ember", seed: "ember-3", pal: "ember", desc: "The third in a series of firelight abstractions. Charcoal ground, ember core.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print" },
  { slug: "charcoal-tide", title: "Charcoal Tide Print", col: "ink-ember", seed: "charcoal-tide", pal: "ember", desc: "A dark shoreline drawn in one continuous gesture. Heavy blacks, one warm horizon.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print", lowstock: true },
  { slug: "paper-lantern", title: "Paper Lantern Print", col: "ink-ember", seed: "paper-lantern", pal: "ember", desc: "A single lantern against festival dark. Warm paper tones on near-black.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print" },
  { slug: "ashen-garden", title: "Ashen Garden Print", col: "ink-ember", seed: "ashen-garden", pal: "ember", desc: "A garden after the bonfire: silver stems, drifting sparks, quiet ground.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print" },
  { slug: "cinder-moth-sticker", title: "Cinder Moth Sticker", col: "ink-ember", seed: "cinder-moth", pal: "ember", desc: "A 3.5 inch vinyl sticker. Weatherproof, dishwasher-safe, moth-approved.", specs: '3.5" die-cut vinyl sticker. UV-resistant inks.', kind: "sticker" },
  // Paper Moons
  { slug: "paper-moon-1", title: "Paper Moon No. 1 Print", col: "paper-moons", seed: "paper-moon-1", pal: "moon", desc: "The first moon study: cut-paper circles over washed indigo.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print", featured: true },
  { slug: "tidecaller", title: "Tidecaller Print", col: "paper-moons", seed: "tidecaller", pal: "moon", desc: "Concentric silver rings pulling at a dark sea. Meditative and a little tidal.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print" },
  { slug: "lunar-cartography", title: "Lunar Cartography Print", col: "paper-moons", seed: "lunar-carto", pal: "moon", desc: "An imaginary map of the near side. Craters as cities, maria as oceans.", specs: "Archival giclée print on 230gsm matte paper. Ships flat in a rigid mailer.", kind: "print", featured: true },
  { slug: "nocturne-bundle", title: "Nocturne Bundle — 3 Prints", col: "paper-moons", seed: "nocturne-bundle", pal: "moon", desc: "Three moon-study prints as a set: Paper Moon No. 1, Tidecaller and Lunar Cartography, all in 8x10.", specs: "Three 8x10 archival prints. Ships flat in a rigid mailer.", kind: "bundle", sale: [5500, 7500] },
  { slug: "star-chart-sticker", title: "Star Chart Sticker", col: "paper-moons", seed: "star-chart", pal: "moon", desc: "A 3.5 inch vinyl sticker of a fictional constellation. For laptops and lamp posts.", specs: '3.5" die-cut vinyl sticker. UV-resistant inks.', kind: "sticker", outofstock: true },
  { slug: "sleepless-city", title: "Sleepless City Print", col: "paper-moons", seed: "sleepless-city", pal: "moon", desc: "A new city study, currently at the printer. Join the list to hear when it lands.", specs: "Details to follow.", kind: "print", coming: true },
];

const insP = db.prepare(
  `INSERT INTO products (id, slug, title, creator_id, collection_id, description, specs, art_seed, palette, status, featured, is_sale, created_at, demo)
   VALUES (?, ?, ?, 'aoki', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
);
const insV = db.prepare(
  `INSERT INTO variants (id, product_id, name, sku, price_cents, compare_at_cents, stock, sort_order)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

P.forEach((p, i) => {
  const pid = uid("p");
  const status = p.coming ? "coming_soon" : "active";
  insP.run(
    pid, p.slug, p.title, p.col, p.desc, p.specs, p.seed, p.pal,
    status, p.featured ? 1 : 0, p.sale ? 1 : 0,
    new Date(Date.now() - i * 86400000).toISOString()
  );
  const mk = (name, sku, price, compare, stock, order) =>
    insV.run(uid("v"), pid, name, sku, price, compare ?? null, stock, order);
  if (p.kind === "print") {
    mk('5x7 Print', `${p.slug}-5x7`, 1500, null, p.lowstock ? 3 : 24, 0);
    mk('8x10 Print', `${p.slug}-8x10`, 2000, null, 18, 1);
    mk('11x14 Print', `${p.slug}-11x14`, 2500, null, p.lowstock ? 0 : 12, 2);
  } else if (p.kind === "sticker") {
    mk('3.5" Sticker', `${p.slug}-sticker`, 500, null, p.outofstock ? 0 : 60, 0);
  } else if (p.kind === "poster") {
    mk('18x24 Poster', `${p.slug}-poster`, p.sale[0], p.sale[1], 15, 0);
  } else if (p.kind === "bundle") {
    mk('Set of 3 (8x10)', `${p.slug}-bundle`, p.sale[0], p.sale[1], 10, 0);
  }
});

// Discount code + settings
db.prepare("INSERT OR REPLACE INTO discount_codes (code, percent_off, active) VALUES ('WELCOME10', 10, 1)").run();
const settings = {
  store_name: "Nocturne Prints",
  store_tagline: "Art prints for the night hours",
  currency: "USD",
  age_gate_enabled: "1",
  age_gate_minimum: "18",
  test_mode: "1",
  shipping_flat_cents: "500",
  free_shipping_over_cents: "5000",
};
const insS = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
for (const [k, v] of Object.entries(settings)) insS.run(k, v);

const n = db.prepare("SELECT COUNT(*) c FROM products").get().c;
const v = db.prepare("SELECT COUNT(*) c FROM variants").get().c;
console.log(`seeded ${n} products, ${v} variants (demo content)`);
} // end doSeed

// Direct run: wipe + reseed (deliberate reset only).
if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  reset();
  doSeed();
}
