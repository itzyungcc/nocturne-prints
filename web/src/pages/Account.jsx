import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../lib/api";

export function AccountPage({ notify }) {
  const [me, setMe] = useState(null);
  const [orders, setOrders] = useState([]);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [err, setErr] = useState("");

  const load = () => {
    api.get("/api/me").then((c) => {
      setMe(c);
      api.get("/api/me/orders").then(setOrders).catch(() => {});
    }).catch(() => setMe(null));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      const r = await api.post(`/api/auth/${mode}`, form);
      localStorage.setItem("ncp_token", r.token);
      notify(mode === "register" ? "Account created — welcome!" : "Signed in");
      load();
    } catch (ex) { setErr(ex.message); }
  };
  const logout = async () => {
    await api.post("/api/auth/logout", {}).catch(() => {});
    localStorage.removeItem("ncp_token"); setMe(null); setOrders([]);
  };

  if (!me) {
    return (
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "30px 0 60px" }}>
        <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
        {err && <div className="alert error">{err}</div>}
        <form onSubmit={submit}>
          {mode === "register" && (
            <div className="field"><label htmlFor="a-name">Name</label><input id="a-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></div>
          )}
          <div className="field"><label htmlFor="a-email">Email</label><input id="a-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" required /></div>
          <div className="field"><label htmlFor="a-pass">Password {mode === "register" && "(min 8 characters)"}</label><input id="a-pass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></div>
          <button className="btn block" type="submit">{mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <p style={{ marginTop: 14 }}>
          {mode === "login" ? <>New here? <button className="link-btn" onClick={() => setMode("register")}>Create an account</button></>
          : <>Have an account? <button className="link-btn" onClick={() => setMode("login")}>Sign in</button></>}
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "30px 0 60px" }}>
      <h2>Hello, {me.name || me.email}</h2>
      <p style={{ color: "var(--muted)" }}>{me.email} · <button className="link-btn" onClick={logout}>Sign out</button></p>
      <h3>Order history</h3>
      {orders.length === 0 ? <p style={{ color: "var(--muted)" }}>No orders yet. <Link to="/">Browse the collection</Link>.</p> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Reference</th><th>Date</th><th>Total</th><th>Status</th><th /></tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.ref}><td>{o.ref}</td><td>{new Date(o.createdAt).toLocaleDateString()}</td>
              <td>{money(Math.round(o.total * 100))}</td><td>{o.status.replace("_", " ")}{o.testMode ? " (test)" : ""}</td>
              <td><Link to={`/order/${o.ref}`}>View</Link></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
