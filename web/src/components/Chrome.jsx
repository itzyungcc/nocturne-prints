import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProductArt, productImage } from "./Product";
import { money } from "../lib/api";
import { useCart, setQty, removeFromCart } from "../lib/cart";

export function CartDrawer({ open, onClose, onCheckout }) {
  const { items, subtotal } = useCart();
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Shopping cart">
        <div className="drawer-head">
          <h3 style={{ margin: 0 }}>Cart ({items.reduce((s, i) => s + i.quantity, 0)})</h3>
          <button className="icon-btn" aria-label="Close cart" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="empty">
              <h3>Your cart is empty</h3>
              <p>Beautiful night prints are waiting.</p>
              <Link to="/" className="btn" onClick={onClose}>Browse the collection</Link>
            </div>
          ) : items.map((i) => (
            <div className="cart-item" key={i.variantId}>
              <Link to={`/products/${i.slug}`} onClick={onClose}>
                <ProductArt seed={i.artSeed} palette={i.palette} src={i.imageUrl || null} alt="" />
              </Link>
              <div className="meta">
                <div className="t">{i.title}</div>
                <div className="v">{i.variantName}</div>
                <div className="row">
                  <span className="qty">
                    <button aria-label="Decrease quantity" onClick={() => setQty(i.variantId, i.quantity - 1)}>−</button>
                    <span>{i.quantity}</span>
                    <button aria-label="Increase quantity" onClick={() => setQty(i.variantId, i.quantity + 1)}>+</button>
                  </span>
                  <span style={{ fontWeight: 700 }}>{money(i.priceCents * i.quantity)}</span>
                </div>
                <button className="link-btn" onClick={() => removeFromCart(i.variantId)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="drawer-foot">
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginBottom: 12 }}>
              <span>Subtotal</span><span>{money(subtotal)}</span>
            </div>
            <button className="btn block" onClick={onCheckout}>Checkout</button>
            <p style={{ fontSize: ".8rem", color: "var(--muted)", textAlign: "center", margin: "8px 0 0" }}>
              Shipping & discounts calculated at checkout.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

export function AgeGate({ settings, onPass }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (settings && settings.ageGateEnabled && !localStorage.getItem("ncp_age_ok")) setShow(true);
  }, [settings]);
  if (!show) return null;
  const pass = () => { localStorage.setItem("ncp_age_ok", "1"); setShow(false); onPass && onPass(); };
  return (
    <div className="agegate" role="dialog" aria-modal="true" aria-label="Age verification">
      <div className="agegate-card">
        <h2>{settings?.storeName || "Nocturne Prints"}</h2>
        <p>This storefront may contain artwork intended for mature audiences. You must be {settings?.ageGateMinimum || 18} or older to enter.</p>
        <p style={{ fontSize: ".85rem", color: "var(--muted)" }}>All catalog content is original demonstration artwork. Nothing here is for sale as a real transaction — checkout runs in clearly-labelled test mode.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button className="btn block" onClick={pass}>I am {settings?.ageGateMinimum || 18}+ — Enter</button>
        </div>
        <p style={{ marginTop: 12 }}><a href="https://www.google.com" rel="noreferrer">Leave</a></p>
      </div>
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}
