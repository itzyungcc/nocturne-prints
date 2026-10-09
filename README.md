# Nocturne Prints

A complete, original e-commerce storefront for art prints, posters and stickers —
layout-inspired by modern creator storefronts, with original branding, original
product content, and original generative placeholder artwork.

**Stack:** Node 24 + Express + `node:sqlite` (zero-config database) ·
Vite + React + React Router · no external services required.

## Quick start (local)

```bash
# 1. Backend
cd server
npm install
cp .env.example .env        # then set ADMIN_PASSWORD in .env
npm run seed                # creates the demo catalog (16 products, 40 variants)
npm start                   # API on http://localhost:4000

# 2. Frontend (new terminal)
cd web
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Production single-origin build:

```bash
cd web && npm install && npm run build
cd ../server && npm install && npm start   # serves web/dist + API on PORT
```

## Environment variables (server)

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | yes | Password for the `/admin` panel. Never commit a real value. |
| `PORT` | no | API port (default 4000; hosts like Render inject their own). |
| `DB_PATH` | no | SQLite file location (default `./data/nocturne.db`). |
| `ALLOWED_ORIGIN` | no | CORS origin. Leave unset for local dev; set to your frontend origin in production if split. |

`server/.env.example` documents these with no real secrets.

## What's fully operational

- Storefront: header/nav/search, creator hero, collection pages, product grid with
  sorting (featured, popularity, newest, A–Z, price), availability filters,
  compact/comfortable grid density, result counts, load-more pagination, skeleton
  and empty states.
- Product pages: 3-image gallery, variant pills with per-variant pricing, live
  stock status, quantity selector, related products, quick-shop modal.
- Cart: drawer, variant-aware items, add/remove/quantity, subtotal, persisted in
  `localStorage`, server-side re-validation at checkout.
- Checkout: validated address form, server-calculated totals, discount codes
  (seeded: `WELCOME10` = 10% off), flat $5 shipping / free over $50, order
  reference (`NCP-…`), order lookup page. **Runs in clearly-labelled TEST MODE —
  no real payment is processed.**
- Customer accounts: register/login (scrypt-hashed passwords), order history.
- Admin (`/admin`): token-authenticated dashboard — overview stats, product
  create/edit/archive (variants, stock, sale, featured), collections, order list
  with fulfillment status updates, store settings (name, currency, age gate,
  test mode, shipping).
- Age gate: configurable minimum age, on/off toggle in admin settings.

## What needs external credentials before going live

- **Payments:** only test mode is implemented. To take real money, implement a
  provider in the `payments` object in `server/src/routes/checkout.js`
  (server-side charge + webhook/order verification), then set `test_mode=0` in
  admin settings. Never store card details; never put secrets in frontend code.
- **Product images:** the demo catalog uses original *generative* placeholder
  artwork (`web/src/lib/art.js`, marked `demo=1` in the database). Replace
  `art_seed`/`palette` with the store owner's authorized image URLs (extend the
  product model with an `images` field) before selling real products.
- **Email:** order confirmation emails are not implemented; add an SMTP/API
  mailer on order creation if needed.

## Deployment (Render, free tier)

1. Push this repo to GitHub.
2. Create a **Web Service**: build command
   `cd web && npm install && npm run build && cd ../server && npm install`,
   start command `cd server && npm start`.
3. Environment: set `ADMIN_PASSWORD` (generate a strong value). Add a persistent
   disk mounted at `/opt/render/project/src/server/data` and set
   `DB_PATH=/opt/render/project/src/server/data/nocturne.db` so the SQLite
   database survives restarts (without a disk, Render's ephemeral filesystem
   wipes orders/products on every deploy — settings seed on boot only if empty).
4. Run the seed once after first deploy:
   `cd server && npm run seed` (via Render shell). Re-running is idempotent-ish
   (it wipes and re-seeds — back up first in production).
5. Set `ALLOWED_ORIGIN` if you split frontend/backend hosting.

`render.yaml` in the repo root encodes the above as a blueprint.

## Security notes

- Admin password lives only in the environment; the repo contains no secrets.
- All admin/customer mutations are authorized server-side; hiding UI is not the
  security boundary.
- Passwords hashed with scrypt; sessions are opaque random tokens.
- Checkout totals, stock and prices are computed server-side from the database —
  client values are display-only and re-validated.

## Content policy

All catalog content is **original demonstration content**: fictional creator,
fictional products, generative placeholder art. It is marked `demo=1` in the
database and labelled in the UI. Nothing is copied from any reference store.
The age gate is configurable; it does not replace legal or payment-provider
requirements in the merchant's jurisdiction.
