import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, money } from "../lib/api";
import { ProductArt, productImage } from "../components/Product";
import { useCart, setQty, removeFromCart, clearCart } from "../lib/cart";

export function CheckoutPage({ settings, notify }) {
  const { items } = useCart();
  const nav = useNavigate();
  const [quote, setQuote] = useState(null);
  const [errors, setErrors] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [form, setForm] = useState({ name: "", email: "", address1: "", address2: "", city: "", postcode: "", country: "" });

  useEffect(() => {
    if (items.length === 0) { setQuote(null); return; }
    api.post("/api/cart/validate", { items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), discountCode })
      .then(setQuote)
      .catch((e) => { setQuote(null); setErrors(e.errors || [e.message]); });
  }, [items, discountCode]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const place = async (e) => {
    e.preventDefault();
    setPlacing(true); setErrors([]);
    try {
      const r = await api.post("/api/checkout", {
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        discountCode, customer: form, provider: "test",
      });
      clearCart();
      notify("Order placed — thank you!");
      nav(`/order/${r.ref}`, { state: { total: r.total } });
    } catch (err) {
      setErrors(err.errors || [err.message]);
      window.scrollTo(0, 0);
    } finally { setPlacing(false); }
  };

  if (items.length === 0) {
    return <div className="empty"><h3>Your cart is empty</h3><p><Link to="/">Browse the collection</Link> to add something beautiful.</p></div>;
  }

  return (
    <>
      <div className="collection-head" style={{ paddingTop: 24 }}><h2>Checkout</h2></div>
      {settings?.testMode && (
        <div className="test-banner" role="note">
          <strong>TEST MODE — no real payment.</strong> This checkout simulates a payment gateway so the full flow can be exercised.
          No card details are requested or stored. A real provider (e.g. Stripe) plugs into the modular <code>payments</code> interface in <code>server/src/routes/checkout.js</code> once credentials are supplied.
        </div>
      )}
      {errors.length > 0 && <div className="alert error"><ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <div className="checkout-layout">
        <form onSubmit={place} noValidate>
          <h3>Contact & delivery</h3>
          <div className="form-grid">
            <div className="field"><label htmlFor="f-name">Full name</label><input id="f-name" value={form.name} onChange={set("name")} autoComplete="name" required /></div>
            <div className="field"><label htmlFor="f-email">Email</label><input id="f-email" type="email" value={form.email} onChange={set("email")} autoComplete="email" required /></div>
          </div>
          <div className="field"><label htmlFor="f-a1">Street address</label><input id="f-a1" value={form.address1} onChange={set("address1")} autoComplete="street-address" required /></div>
          <div className="field"><label htmlFor="f-a2">Apartment, suite, etc. (optional)</label><input id="f-a2" value={form.address2} onChange={set("address2")} /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="f-city">City</label><input id="f-city" value={form.city} onChange={set("city")} autoComplete="address-level2" required /></div>
            <div className="field"><label htmlFor="f-pc">Postal code</label><input id="f-pc" value={form.postcode} onChange={set("postcode")} autoComplete="postal-code" required /></div>
          </div>
          <div className="field"><label htmlFor="f-country">Country</label><input id="f-country" value={form.country} onChange={set("country")} autoComplete="country-name" required /></div>
          <div className="field"><label htmlFor="f-disc">Discount code (optional — try WELCOME10)</label><input id="f-disc" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} placeholder="WELCOME10" /></div>
          <button className="btn block" disabled={placing || !quote} type="submit" style={{ marginTop: 8 }}>
            {placing ? "Processing test payment…" : `Pay ${quote ? money(quote.total) : ""} (test)`}
          </button>
          <p style={{ fontSize: ".82rem", color: "var(--muted)" }}>By placing this order you agree this is a demonstration checkout. No real charge occurs.</p>
        </form>
        <aside className="summary" aria-label="Order summary">
          <h3 style={{ marginTop: 0 }}>Order summary</h3>
          {items.map((i) => (
            <div className="cart-item" key={i.variantId}>
              <ProductArt seed={i.artSeed} palette={i.palette} src={i.imageUrl || null} alt="" />
              <div className="meta">
                <div className="t">{i.title}</div>
                <div className="v">{i.variantName} × {i.quantity}</div>
                <div className="row"><span /> <span style={{ fontWeight: 700 }}>{money(i.priceCents * i.quantity)}</span></div>
                <button className="link-btn" onClick={() => removeFromCart(i.variantId)}>Remove</button>
              </div>
            </div>
          ))}
          {quote ? (
            <>
              <div className="line"><span>Subtotal</span><span>{money(quote.subtotal)}</span></div>
              {quote.discount > 0 && <div className="line"><span>Discount</span><span>−{money(quote.discount)}</span></div>}
              <div className="line"><span>Shipping</span><span>{quote.shipping === 0 ? "Free" : money(quote.shipping)}</span></div>
              <div className="line total"><span>Total</span><span>{money(quote.total)}</span></div>
            </>
          ) : <p style={{ color: "var(--muted)" }}>Validating cart…</p>}
        </aside>
      </div>
    </>
  );
}

export function OrderPage() {
  const { ref } = useParams();
  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    api.get(`/api/orders/${ref}`).then(setOrder).catch(() => setMissing(true));
  }, [ref]);
  if (missing) return <div className="empty"><h3>Order not found</h3><p>Check the reference and try again.</p></div>;
  if (!order) return <p>Loading order…</p>;
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "30px 0 60px" }}>
      <div className="alert ok"><strong>Order confirmed.</strong> {order.testMode && "This was a test-mode order — no real payment was taken."}</div>
      <h2>Order {order.ref}</h2>
      <p style={{ color: "var(--muted)" }}>Placed {new Date(order.createdAt).toLocaleString()} · Status: {order.status.replace("_", " ")}</p>
      <div className="summary">
        {order.items.map((i, n) => (
          <div className="line" key={n}><span>{i.title} — {i.variant} × {i.quantity}</span><span>{money(Math.round(i.price * 100 * i.quantity))}</span></div>
        ))}
        <div className="line"><span>Subtotal</span><span>{money(Math.round(order.subtotal * 100))}</span></div>
        {order.discount > 0 && <div className="line"><span>Discount</span><span>−{money(Math.round(order.discount * 100))}</span></div>}
        <div className="line"><span>Shipping</span><span>{money(Math.round(order.shipping * 100))}</span></div>
        <div className="line total"><span>Total</span><span>{money(Math.round(order.total * 100))} {order.currency}</span></div>
      </div>
      <p><Link to="/">Continue shopping →</Link></p>
    </div>
  );
}
