import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { adminApi, api, money } from "../lib/api";

function useAdmin() {
  const [token, setToken] = useState(localStorage.getItem("ncp_admin"));
  const login = async (password) => {
    const r = await adminApi.login(password);
    localStorage.setItem("ncp_admin", r.token);
    setToken(r.token);
  };
  const logout = () => { adminApi.logout().catch(() => {}); localStorage.removeItem("ncp_admin"); setToken(null); };
  return { token, login, logout };
}

function Overview() {
  const [d, setD] = useState(null);
  useEffect(() => { adminApi.overview().then(setD).catch(() => {}); }, []);
  if (!d) return <p>Loading…</p>;
  return (
    <>
      <div className="stat-cards">
        <div className="stat"><div className="n">{d.products}</div><div className="l">Active products</div></div>
        <div className="stat"><div className="n">{d.orders}</div><div className="l">Orders</div></div>
        <div className="stat"><div className="n">{money(d.revenueCents)}</div><div className="l">Revenue (all)</div></div>
        <div className="stat"><div className="n">{d.lowStock.length}</div><div className="l">Low-stock variants</div></div>
      </div>
      <h3>Low stock (≤ 5)</h3>
      {d.lowStock.length === 0 ? <p style={{ color: "var(--muted)" }}>All stocked up.</p> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Product</th><th>SKU</th><th>Stock</th></tr></thead>
          <tbody>{d.lowStock.map((r, i) => <tr key={i}><td>{r.title}</td><td>{r.sku}</td><td>{r.stock}</td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}

function ProductEditor({ product, collections, onDone, onCancel }) {
  const [f, setF] = useState({
    title: product?.title || "", slug: product?.slug || "",
    collection_id: product?.collection_id || "", description: product?.description || "",
    specs: product?.specs || "", art_seed: product?.art_seed || "", palette: product?.palette || "nocturne",
    status: product?.status || "active", featured: !!product?.featured, is_sale: !!product?.is_sale,
  });
  const [variants, setVariants] = useState(
    product?.variants?.map((v) => ({ name: v.name, sku: v.sku, price_cents: v.price_cents, compare_at_cents: v.compare_at_cents ?? "", stock: v.stock })) ||
    [{ name: "Standard", sku: "", price_cents: 1500, compare_at_cents: "", stock: 10 }]
  );
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setV = (i, k) => (e) => setVariants(variants.map((v, j) => j === i ? { ...v, [k]: e.target.value } : v));
  const save = async () => {
    setErr("");
    try {
      await adminApi.saveProduct({
        ...f,
        variants: variants.map((v) => ({
          name: v.name, sku: v.sku,
          price_cents: Math.round(parseFloat(v.price_cents || 0) * 1),
          compare_at_cents: v.compare_at_cents === "" ? null : Math.round(parseFloat(v.compare_at_cents) * 1),
          stock: parseInt(v.stock || 0, 10),
        })),
      }, product?.id);
      onDone();
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{product ? "Edit product" : "New product"}</h3>
        {err && <div className="alert error">{err}</div>}
        <div className="form-grid">
          <div className="field"><label>Title</label><input value={f.title} onChange={set("title")} /></div>
          <div className="field"><label>Slug</label><input value={f.slug} onChange={set("slug")} placeholder="my-product" /></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Collection</label>
            <select value={f.collection_id} onChange={set("collection_id")}>
              <option value="">— none —</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select></div>
          <div className="field"><label>Status</label>
            <select value={f.status} onChange={set("status")}>
              <option value="active">Active</option><option value="coming_soon">Coming soon</option><option value="archived">Archived</option>
            </select></div>
        </div>
        <div className="field"><label>Description</label><textarea rows="3" value={f.description} onChange={set("description")} /></div>
        <div className="field"><label>Specs</label><input value={f.specs} onChange={set("specs")} /></div>
        <div className="form-grid">
          <div className="field"><label>Art seed (generative artwork)</label><input value={f.art_seed} onChange={set("art_seed")} placeholder="unique-seed" /></div>
          <div className="field"><label>Palette</label>
            <select value={f.palette} onChange={set("palette")}>
              {["nocturne", "neon", "ember", "moon"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select></div>
        </div>
        <div style={{ display: "flex", gap: 16, margin: "8px 0" }}>
          <label><input type="checkbox" checked={f.featured} onChange={set("featured")} /> Featured</label>
          <label><input type="checkbox" checked={f.is_sale} onChange={set("is_sale")} /> On sale</label>
        </div>
        <h4>Variants (prices in cents)</h4>
        {variants.map((v, i) => (
          <div key={i} className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr auto" }}>
            <div className="field"><label>Name</label><input value={v.name} onChange={setV(i, "name")} /></div>
            <div className="field"><label>Price ¢</label><input type="number" value={v.price_cents} onChange={setV(i, "price_cents")} /></div>
            <div className="field"><label>Was ¢</label><input type="number" value={v.compare_at_cents} onChange={setV(i, "compare_at_cents")} placeholder="—" /></div>
            <div className="field"><label>Stock</label><input type="number" value={v.stock} onChange={setV(i, "stock")} /></div>
            <div className="field"><label>&nbsp;</label><button className="btn ghost small" onClick={() => setVariants(variants.filter((_, j) => j !== i))}>✕</button></div>
          </div>
        ))}
        <button className="btn ghost small" onClick={() => setVariants([...variants, { name: "", sku: "", price_cents: 0, compare_at_cents: "", stock: 0 }])}>+ Add variant</button>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button className="btn" onClick={save}>Save product</button>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Products() {
  const [list, setList] = useState([]);
  const [cols, setCols] = useState([]);
  const [editing, setEditing] = useState(null); // null | {} | product
  const load = () => adminApi.products().then(setList).catch(() => {});
  useEffect(() => { load(); adminApi.collections().then(setCols).catch(() => {}); }, []);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Products</h3>
        <button className="btn small" onClick={() => setEditing({})}>+ New product</button>
      </div>
      <div className="table-wrap"><table className="data">
        <thead><tr><th>Title</th><th>Collection</th><th>Status</th><th>Variants</th><th /></tr></thead>
        <tbody>{list.map((p) => (
          <tr key={p.id}>
            <td>{p.title}{p.demo ? " (demo)" : ""}</td><td>{p.collection_title || "—"}</td><td>{p.status}</td>
            <td>{p.variants.map((v) => `${v.name}: $${(v.price_cents / 100).toFixed(2)} (${v.stock})`).join(" · ")}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              <button className="link-btn" onClick={() => setEditing(p)}>Edit</button>
              <button className="link-btn" onClick={() => { if (confirm(`Archive "${p.title}"?`)) adminApi.archiveProduct(p.id).then(load); }}>Archive</button>
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      {editing && <ProductEditor product={editing.id ? editing : null} collections={cols}
        onDone={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />}
    </>
  );
}

function Orders() {
  const [orders, setOrders] = useState([]);
  useEffect(() => { adminApi.orders().then(setOrders).catch(() => {}); }, []);
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Orders</h3>
      {orders.length === 0 ? <p style={{ color: "var(--muted)" }}>No orders yet.</p> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Ref</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th /></tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.id}>
              <td>{o.ref}</td><td>{o.name}<br /><span style={{ color: "var(--muted)" }}>{o.email}</span></td>
              <td>{o.items.map((i) => `${i.quantity}× ${i.title} (${i.variant_name})`).join("; ")}</td>
              <td>{money(o.total_cents)}</td>
              <td><select value={o.status} aria-label={`Status for ${o.ref}`}
                onChange={(e) => adminApi.orderStatus(o.id, e.target.value).then(() => setOrders(orders.map((x) => x.id === o.id ? { ...x, status: e.target.value } : x)))}>
                {["paid_test", "pending", "fulfilled", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select></td>
              <td>{o.test_mode ? <span className="badge soon" style={{ position: "static" }}>test</span> : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}

function Settings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { adminApi.settings().then(setS).catch(() => {}); }, []);
  if (!s) return <p>Loading…</p>;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.type === "checkbox" ? (e.target.checked ? "1" : "0") : e.target.value });
  const save = async () => { await adminApi.saveSettings(s); setMsg("Settings saved."); setTimeout(() => setMsg(""), 2500); };
  const F = (k, label, type = "text") => (
    <div className="field"><label>{label}</label>
      {type === "checkbox" ? <input type="checkbox" checked={s[k] === "1"} onChange={set(k)} style={{ width: "auto" }} />
      : <input value={s[k] || ""} onChange={set(k)} />}</div>
  );
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Store settings</h3>
      {msg && <div className="alert ok">{msg}</div>}
      <div className="form-grid">
        {F("store_name", "Store name")}{F("store_tagline", "Tagline")}
        {F("currency", "Currency (ISO code)")}{F("age_gate_minimum", "Age gate minimum age")}
        {F("shipping_flat_cents", "Flat shipping (cents)")}{F("free_shipping_over_cents", "Free shipping over (cents)")}
      </div>
      <div style={{ display: "flex", gap: 18, margin: "10px 0" }}>
        <label><input type="checkbox" checked={s.age_gate_enabled === "1"} onChange={set("age_gate_enabled")} /> Age gate enabled</label>
        <label><input type="checkbox" checked={s.test_mode === "1"} onChange={set("test_mode")} /> Test payment mode</label>
      </div>
      <button className="btn" onClick={save}>Save settings</button>
      <div className="alert warn" style={{ marginTop: 18 }}>
        Payments: only <strong>test mode</strong> is implemented. To accept real payments, wire a provider into the
        <code> payments </code> interface in <code>server/src/routes/checkout.js</code> (server-side verification required),
        then switch test mode off here.
      </div>
    </>
  );
}

export function AdminPage() {
  const { token, login, logout } = useAdmin();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);
  const nav = useNavigate();

  if (!token) {
    const go = async (e) => {
      e.preventDefault(); setErr(""); setNotConfigured(false);
      try { await login(password); setPassword(""); }
      catch (ex) { ex.code === "ADMIN_NOT_CONFIGURED" ? setNotConfigured(true) : setErr(ex.message); }
    };
    return (
      <div style={{ maxWidth: 400, margin: "0 auto", padding: "40px 0 80px" }}>
        <h2>Store admin</h2>
        {notConfigured && <div className="alert warn">ADMIN_PASSWORD is not set in the server environment. Set it and restart the server.</div>}
        {err && <div className="alert error">{err}</div>}
        <form onSubmit={go}>
          <div className="field"><label htmlFor="admin-pass">Admin password</label>
            <input id="admin-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></div>
          <button className="btn block" type="submit">Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <nav className="admin-nav" aria-label="Admin">
        <NavLink to="/admin" end className={({ isActive }) => isActive ? "active" : ""}>Overview</NavLink>
        <NavLink to="/admin/products" className={({ isActive }) => isActive ? "active" : ""}>Products</NavLink>
        <NavLink to="/admin/orders" className={({ isActive }) => isActive ? "active" : ""}>Orders</NavLink>
        <NavLink to="/admin/settings" className={({ isActive }) => isActive ? "active" : ""}>Settings</NavLink>
        <button className="link-btn" style={{ textAlign: "left" }} onClick={() => { logout(); nav("/"); }}>Sign out</button>
      </nav>
      <div>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="products" element={<Products />} />
          <Route path="orders" element={<Orders />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}
