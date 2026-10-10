import { useEffect, useRef, useState } from "react";
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
  const [images, setImages] = useState(product?.images || []);
  const [pending, setPending] = useState([]); // Files chosen before the product is saved
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!product?.slug);
  const [createdId, setCreatedId] = useState(null); // id of a just-created product, for safe retries
  const fileRef = useRef(null);
  const set = (k) => (e) => {
    if (k === "slug") setSlugTouched(true);
    if (k === "title" && !product?.id && !slugTouched) {
      const auto = e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      setF((prev) => ({ ...prev, title: e.target.value, slug: auto }));
      return;
    }
    setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  };
  const setV = (i, k) => (e) => setVariants(variants.map((v, j) => j === i ? { ...v, [k]: e.target.value } : v));
  const save = async () => {
    setErr(""); setSaving(true);
    try {
      let pid = product?.id || createdId;
      if (!pid) {
        const r = await adminApi.saveProduct({
          ...f,
          variants: variants.map((v) => ({
            name: v.name, sku: v.sku,
            price_cents: Math.round(parseFloat(v.price_cents || 0) * 1),
            compare_at_cents: v.compare_at_cents === "" ? null : Math.round(parseFloat(v.compare_at_cents) * 1),
            stock: parseInt(v.stock || 0, 10),
          })),
        });
        pid = r.id;
        setCreatedId(pid);
      } else {
        await adminApi.saveProduct({
          ...f,
          variants: variants.map((v) => ({
            name: v.name, sku: v.sku,
            price_cents: Math.round(parseFloat(v.price_cents || 0) * 1),
            compare_at_cents: v.compare_at_cents === "" ? null : Math.round(parseFloat(v.compare_at_cents) * 1),
            stock: parseInt(v.stock || 0, 10),
          })),
        }, pid);
      }
      for (const p of [...pending]) {
        await adminApi.uploadImage(pid, p.file);
        URL.revokeObjectURL(p.preview);
        setPending((prev) => prev.filter((x) => x.preview !== p.preview));
      }
      onDone();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };
  const pick = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (product?.id) {
      // Editing an existing product: upload straight away.
      (async () => {
        setErr(""); setUploading(true);
        try {
          for (const file of files) {
            const r = await adminApi.uploadImage(product.id, file);
            setImages((prev) => [...prev, r]);
          }
        } catch (ex) { setErr(ex.message); }
        setUploading(false);
      })();
    } else {
      // New product: stage the files; they upload when the product is saved.
      setPending((prev) => [...prev, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const dropPending = (preview) => {
    URL.revokeObjectURL(preview);
    setPending((prev) => prev.filter((p) => p.preview !== preview));
  };
  const removeImage = async (imageId) => {
    if (!confirm("Delete this image?")) return;
    try {
      await adminApi.deleteImage(product.id, imageId);
      setImages(images.filter((i) => i.id !== imageId));
    } catch (ex) { setErr(ex.message); }
  };
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{product ? "Edit product" : "New product"}</h3>
        {err && <div className="alert error">{err}</div>}
        <div className="form-grid">
          <div className="field"><label>Title</label><input value={f.title} onChange={set("title")} /></div>
          <div className="field"><label>Slug</label><input value={f.slug} onChange={set("slug")} placeholder="my-product" />
            <span style={{ fontSize: ".78rem", color: "var(--muted)" }}>Must be unique — used in the product's URL.</span></div>
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
        <h4>Product images</h4>
        <p style={{ color: "var(--muted)", fontSize: ".85rem", margin: "0 0 8px" }}>
          Uploaded photos replace the generative artwork on the storefront. JPEG, PNG or WebP, max 3&nbsp;MB each.
          {!product?.id && " Photos you pick now upload automatically when you save the product."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          {images.map((i) => (
            <div key={i.id} style={{ position: "relative", width: 96 }}>
              <img src={i.url} alt="" style={{ width: 96, height: 120, objectFit: "cover", borderRadius: 8, display: "block" }} />
              <button className="btn ghost small" aria-label="Delete image"
                onClick={() => removeImage(i.id)}
                style={{ position: "absolute", top: 4, right: 4, padding: "2px 8px" }}>✕</button>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.preview} style={{ position: "relative", width: 96 }}>
              <img src={p.preview} alt="" style={{ width: 96, height: 120, objectFit: "cover", borderRadius: 8, display: "block", opacity: 0.85 }} />
              <span style={{ position: "absolute", bottom: 4, left: 4, fontSize: ".7rem", background: "rgba(0,0,0,.6)", color: "#fff", padding: "1px 6px", borderRadius: 4 }}>pending</span>
              <button className="btn ghost small" aria-label="Remove photo"
                onClick={() => dropPending(p.preview)}
                style={{ position: "absolute", top: 4, right: 4, padding: "2px 8px" }}>✕</button>
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pick} disabled={uploading || saving} />
        {(uploading || saving) && <p style={{ color: "var(--muted)" }}>{saving ? "Saving product and uploading photos…" : "Uploading…"}</p>}
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
          <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save product"}</button>
          <button className="btn ghost" onClick={onCancel} disabled={saving}>Cancel</button>
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

function Collections() {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null);
  const load = () => adminApi.collections().then(setList).catch(() => {});
  useEffect(load, []);
  const create = async () => {
    setErr("");
    try {
      await adminApi.addCollection({ title, slug, description: desc });
      setTitle(""); setSlug(""); setDesc(""); load();
    } catch (e) { setErr(e.message); }
  };
  const saveEdit = async () => {
    setErr("");
    try { await adminApi.saveCollection(editing.id, editing); setEditing(null); load(); }
    catch (e) { setErr(e.message); }
  };
  const remove = async (c) => {
    if (!confirm(`Delete collection "${c.title}"?`)) return;
    setErr("");
    try { await adminApi.deleteCollection(c.id); load(); }
    catch (e) { setErr(e.message); }
  };
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Collections</h3>
      {err && <div className="alert error">{err}</div>}
      <div className="table-wrap"><table className="data">
        <thead><tr><th>Title</th><th>Slug</th><th>Products</th><th /></tr></thead>
        <tbody>{list.map((c) => (
          <tr key={c.id}>
            <td>{c.title}</td><td>{c.slug}</td><td>{c.productCount}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              <button className="link-btn" onClick={() => setEditing({ ...c })}>Edit</button>
              <button className="link-btn" onClick={() => remove(c)}>Delete</button>
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit collection</h3>
            <div className="field"><label>Title</label>
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            <div className="field"><label>Description</label>
              <textarea rows="2" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="field"><label>Sort order</label>
              <input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} /></div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn" onClick={saveEdit}>Save</button>
              <button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <h4 style={{ marginTop: 22 }}>New collection</h4>
      <div className="form-grid">
        <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>Slug</label><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-collection" /></div>
      </div>
      <div className="field"><label>Description</label>
        <textarea rows="2" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <button className="btn" onClick={create} style={{ marginTop: 10 }}>Add collection</button>
    </>
  );
}

function Discounts() {
  const [list, setList] = useState([]);
  const [code, setCode] = useState("");
  const [pct, setPct] = useState(10);
  const [err, setErr] = useState("");
  const load = () => adminApi.discounts().then(setList).catch(() => {});
  useEffect(load, []);
  const create = async () => {
    setErr("");
    try { await adminApi.addDiscount({ code, percent_off: parseInt(pct, 10), active: true }); setCode(""); setPct(10); load(); }
    catch (e) { setErr(e.message); }
  };
  const toggle = async (d) => {
    try { await adminApi.saveDiscount(d.code, { percent_off: d.percent_off, active: !d.active }); load(); }
    catch (e) { setErr(e.message); }
  };
  const remove = async (d) => {
    if (!confirm(`Delete code "${d.code}"?`)) return;
    try { await adminApi.deleteDiscount(d.code); load(); }
    catch (e) { setErr(e.message); }
  };
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Discount codes</h3>
      {err && <div className="alert error">{err}</div>}
      <div className="table-wrap"><table className="data">
        <thead><tr><th>Code</th><th>Off</th><th>Active</th><th /></tr></thead>
        <tbody>{list.map((d) => (
          <tr key={d.code}>
            <td><code>{d.code}</code></td><td>{d.percent_off}%</td>
            <td><button className="link-btn" onClick={() => toggle(d)}>{d.active ? "Yes" : "No"}</button></td>
            <td><button className="link-btn" onClick={() => remove(d)}>Delete</button></td>
          </tr>
        ))}</tbody>
      </table></div>
      <h4 style={{ marginTop: 22 }}>New code</h4>
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
        <div className="field"><label>Code</label><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER20" /></div>
        <div className="field"><label>Percent off</label><input type="number" min="1" max="100" value={pct} onChange={(e) => setPct(e.target.value)} /></div>
        <div className="field"><label>&nbsp;</label><button className="btn" onClick={create}>Add code</button></div>
      </div>
    </>
  );
}

function Customers() {
  const [list, setList] = useState([]);
  useEffect(() => { adminApi.customers().then(setList).catch(() => {}); }, []);
  return (
    <>
      <h3 style={{ marginTop: 0 }}>Customers</h3>
      {list.length === 0 ? <p style={{ color: "var(--muted)" }}>No customer accounts yet.</p> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Orders</th></tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id}>
              <td>{c.name || "—"}</td><td>{c.email}</td>
              <td>{new Date(c.created_at).toLocaleDateString()}</td><td>{c.orders}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
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
        <NavLink to="/admin/collections" className={({ isActive }) => isActive ? "active" : ""}>Collections</NavLink>
        <NavLink to="/admin/discounts" className={({ isActive }) => isActive ? "active" : ""}>Discounts</NavLink>
        <NavLink to="/admin/customers" className={({ isActive }) => isActive ? "active" : ""}>Customers</NavLink>
        <NavLink to="/admin/orders" className={({ isActive }) => isActive ? "active" : ""}>Orders</NavLink>
        <NavLink to="/admin/settings" className={({ isActive }) => isActive ? "active" : ""}>Settings</NavLink>
        <button className="link-btn" style={{ textAlign: "left" }} onClick={() => { logout(); nav("/"); }}>Sign out</button>
      </nav>
      <div>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="products" element={<Products />} />
          <Route path="collections" element={<Collections />} />
          <Route path="discounts" element={<Discounts />} />
          <Route path="customers" element={<Customers />} />
          <Route path="orders" element={<Orders />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}
