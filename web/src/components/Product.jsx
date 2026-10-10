import { useState } from "react";
import { Link } from "react-router-dom";
import { artSVG } from "../lib/art";
import { money, priceRange } from "../lib/api";
import { addToCart } from "../lib/cart";

export function ProductArt({ seed, palette, variant = 0, alt = "", eager = false, src }) {
  const [loaded, setLoaded] = useState(false);
  const url = src || artSVG(seed, palette, variant);
  return (
    <img
      src={url}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      onLoad={() => setLoaded(true)}
      style={{ opacity: loaded ? 1 : 0, transition: "opacity .3s" }}
    />
  );
}

// First uploaded photo wins; falls back to generative art.
export function productImage(p) {
  return p.images && p.images.length ? p.images[0].url : null;
}

function badgeFor(p) {
  if (p.status === "coming_soon") return <span className="badge soon">Coming soon</span>;
  if (!p.inStock) return <span className="badge oos">Sold out</span>;
  if (p.isSale) return <span className="badge sale">Sale</span>;
  return null;
}

export function ProductCard({ product, onQuickShop }) {
  const stockLine = product.status === "coming_soon" ? null
    : !product.inStock ? <span className="card-stock out">Out of stock</span>
    : product.variants.some((v) => v.stock > 0 && v.stock <= 5)
      ? <span className="card-stock low">Low stock</span>
      : <span className="card-stock">In stock</span>;
  return (
    <article className="card">
      <div className="card-media">
        <Link to={`/products/${product.slug}`} aria-label={product.title} tabIndex={-1}>
          <ProductArt seed={product.artSeed} palette={product.palette} src={productImage(product)} alt="" />
        </Link>
        {badgeFor(product)}
        {product.inStock && product.status === "active" && (
          <div className="quick-shop">
            <button className="btn block small" onClick={() => onQuickShop(product)}>Quick shop</button>
          </div>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title"><Link to={`/products/${product.slug}`}>{product.title}</Link></h3>
        <span className="card-creator">{product.creator}</span>
        <span className="card-price">
          {priceRange(product)}
          {product.isSale && product.variants[0]?.compareAt && <s>{money(product.variants[0].compareAt * 100)}</s>}
        </span>
        {stockLine}
        <p className="card-desc">{product.description}</p>
        <Link className="details-link" to={`/products/${product.slug}`}>View full details →</Link>
      </div>
    </article>
  );
}

export function QuickShopModal({ product, onClose, notify }) {
  const [variantId, setVariantId] = useState(product.variants.find((v) => v.stock > 0)?.id);
  const variant = product.variants.find((v) => v.id === variantId);
  const add = () => {
    if (!variant || variant.stock < 1) return;
    addToCart(product, variant, 1);
    notify(`Added “${product.title} — ${variant.name}” to cart`);
    onClose();
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Quick shop ${product.title}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ width: 110, flexShrink: 0 }}><ProductArt seed={product.artSeed} palette={product.palette} src={productImage(product)} alt="" eager /></div>
          <div>
            <h3 style={{ margin: "0 0 4px" }}>{product.title}</h3>
            <div className="card-price">{variant ? money(variant.price_cents) : priceRange(product)}</div>
          </div>
        </div>
        <div className="variant-row" role="group" aria-label="Variant">
          {product.variants.map((v) => (
            <button key={v.id} className="variant-pill" aria-pressed={v.id === variantId}
              disabled={v.stock < 1} onClick={() => setVariantId(v.id)}>
              {v.name}{v.stock < 1 ? " — sold out" : ""}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn block" disabled={!variant || variant.stock < 1} onClick={add}>Add to cart</button>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <p style={{ marginTop: 10 }}><Link to={`/products/${product.slug}`} onClick={onClose}>View full details →</Link></p>
      </div>
    </div>
  );
}

export function SkeletonGrid({ n = 8 }) {
  return (
    <div className="grid" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skel" style={{ aspectRatio: "4/5" }} />
      ))}
    </div>
  );
}
