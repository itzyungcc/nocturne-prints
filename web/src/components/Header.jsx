import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../lib/cart";

export function Header({ onCartOpen, collections }) {
  const { count } = useCart();
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const goSearch = (e) => { e.preventDefault(); if (q.trim()) { nav(`/search?q=${encodeURIComponent(q.trim())}`); setMenu(false); } };
  return (
    <header className="header">
      <div className="wrap header-inner">
        <button className="icon-btn hamburger" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
        <Link to="/" className="logo" aria-label="Nocturne Prints home">
          <span className="logo-moon" aria-hidden="true" /><span>NOCTURNE</span>
        </Link>
        <nav className="nav" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>Home</NavLink>
          {(collections || []).map((c) => (
            <NavLink key={c.id} to={`/collections/${c.slug}`} className={({ isActive }) => isActive ? "active" : ""}>{c.title}</NavLink>
          ))}
        </nav>
        <div className="header-spacer" />
        <form className="search-box" onSubmit={goSearch} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prints…" aria-label="Search products" />
        </form>
        <Link to="/account" className="icon-btn" aria-label="Account">👤</Link>
        <button className="icon-btn" aria-label={`Open cart, ${count} items`} onClick={onCartOpen}>
          🛒{count > 0 && <span className="cart-count">{count}</span>}
        </button>
      </div>
      <div className={`mobile-menu${menu ? " open" : ""}`}>
        <form onSubmit={goSearch} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prints…" aria-label="Search products" />
        </form>
        <Link to="/" onClick={() => setMenu(false)}>Home</Link>
        {(collections || []).map((c) => (
          <Link key={c.id} to={`/collections/${c.slug}`} onClick={() => setMenu(false)}>{c.title}</Link>
        ))}
        <Link to="/account" onClick={() => setMenu(false)}>Account</Link>
      </div>
    </header>
  );
}

export function Footer({ settings }) {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <h4>{settings?.storeName || "Nocturne Prints"}</h4>
          <p>{settings?.tagline || "Art prints for the night hours."}</p>
          <p className="demo-note">Demo catalog: all artwork is original generative placeholder content, marked demo in the database.</p>
        </div>
        <div>
          <h4>Shop</h4>
          <Link to="/">All products</Link>
          <Link to="/search?q=print">Prints</Link>
          <Link to="/search?q=sticker">Stickers</Link>
        </div>
        <div>
          <h4>Help</h4>
          <Link to="/account">Account & orders</Link>
          <Link to="/admin">Store admin</Link>
        </div>
      </div>
      <div className="wrap" style={{ marginTop: 22 }}>
        <span className="demo-note">© 2026 {settings?.storeName || "Nocturne Prints"}. Original demo content — not affiliated with any reference store.</span>
      </div>
    </footer>
  );
}
