// Cart store: variant-aware items, persisted to localStorage.
// Server re-validates everything at checkout — client totals are display-only.
import { useSyncExternalStore } from "react";

const KEY = "ncp_cart_v1";
let items = [];
try { items = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { items = []; }
const listeners = new Set();
function save() {
  localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}
export function subscribeCart(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getCart() { return items; }

export function addToCart(product, variant, quantity = 1) {
  const found = items.find((i) => i.variantId === variant.id);
  if (found) found.quantity = Math.min(99, found.quantity + quantity);
  else items.push({
    variantId: variant.id, productId: product.id, slug: product.slug,
    title: product.title, variantName: variant.name,
    priceCents: variant.price_cents, compareAtCents: variant.compare_at_cents,
    artSeed: product.artSeed, palette: product.palette,
    imageUrl: product.images && product.images.length ? product.images[0].url : null,
    quantity: Math.min(99, quantity),
  });
  save();
}
export function setQty(variantId, quantity) {
  const q = parseInt(quantity, 10);
  if (!Number.isInteger(q) || q < 0 || q > 99) return;
  if (q === 0) items = items.filter((i) => i.variantId !== variantId);
  else { const f = items.find((i) => i.variantId === variantId); if (f) f.quantity = q; }
  save();
}
export function removeFromCart(variantId) { items = items.filter((i) => i.variantId !== variantId); save(); }
export function clearCart() { items = []; save(); }
export function cartCount() { return items.reduce((s, i) => s + i.quantity, 0); }
export function cartSubtotal() { return items.reduce((s, i) => s + i.priceCents * i.quantity, 0); }

export function useCart() {
  useSyncExternalStore(subscribeCart, getCart);
  return { items, count: cartCount(), subtotal: cartSubtotal() };
}
