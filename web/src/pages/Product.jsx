import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, money } from "../lib/api";
import { ProductArt, ProductCard } from "../components/Product";
import { addToCart } from "../lib/cart";
import { SkeletonGrid } from "../components/Product";

export function ProductPage({ notify, onQuickShop }) {
  const { slug } = useParams();
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);

  useEffect(() => {
    setP(null); setMissing(false); setImg(0); setQty(1);
    api.get(`/api/products/${slug}`)
      .then((d) => { setP(d); setVariantId(d.variants.find((v) => v.stock > 0)?.id || d.variants[0]?.id); })
      .catch(() => setMissing(true));
    window.scrollTo(0, 0);
  }, [slug]);

  if (missing) return <div className="empty"><h3>Product not found</h3><p><Link to="/">Back to the shop</Link></p></div>;
  if (!p) return <SkeletonGrid n={2} />;

  const variant = p.variants.find((v) => v.id === variantId);
  const soldOut = p.status !== "active" || !p.variants.some((v) => v.stock > 0);
  const gallery = [0, 1, 2];

  const add = () => {
    if (!variant || variant.stock < qty) return;
    addToCart(p, variant, qty);
    notify(`Added ${qty} × “${p.title} — ${variant.name}” to cart`);
  };

  return (
    <>
      <p style={{ margin: "18px 0 0", fontSize: ".88rem", color: "var(--muted)" }}>
        <Link to="/">Home</Link> {p.collection && <> / <Link to={`/collections/${p.collection.slug}`}>{p.collection.title}</Link></>} / {p.title}
      </p>
      <div className="product-layout">
        <div>
          <div className="gallery-main">
            <ProductArt seed={p.artSeed} palette={p.palette} variant={gallery[img]} alt={p.title} eager />
          </div>
          <div className="thumbs" role="tablist" aria-label="Product images">
            {gallery.map((g) => (
              <button key={g} role="tab" aria-selected={img === g} aria-label={`View image ${g + 1}`} onClick={() => setImg(g)}>
                <ProductArt seed={p.artSeed} palette={p.palette} variant={g} alt="" />
              </button>
            ))}
          </div>
          {p.demo && <p className="demo-note" style={{ marginTop: 10 }}>Demo artwork: original generative placeholder. Final products ship with the artist's authorized images.</p>}
        </div>
        <div className="product-info">
          {p.isSale && <span className="badge sale" style={{ position: "static" }}>Sale</span>}
          <h1>{p.title}</h1>
          <div className="creator-line">by {p.creator}</div>
          <div className="price-line">
            {variant ? money(variant.price_cents) : ""}
            {variant?.compareAt && <s>{money(variant.compareAt * 100)}</s>}
          </div>
          {p.status === "coming_soon" ? (
            <div className="alert info">Coming soon — this piece is at the printer. Check back shortly.</div>
          ) : soldOut ? (
            <div className="alert error">Sold out — join the mailing list in the footer to hear about restocks.</div>
          ) : (
            <>
              <div className="variant-row" role="group" aria-label="Choose a variant">
                {p.variants.map((v) => (
                  <button key={v.id} className="variant-pill" aria-pressed={v.id === variantId}
                    disabled={v.stock < 1} onClick={() => { setVariantId(v.id); setQty(1); }}>
                    {v.name} — {money(v.price_cents)}{v.stock < 1 ? " (sold out)" : ""}
                  </button>
                ))}
              </div>
              <div className="stock-line">
                {variant && variant.stock <= 5
                  ? <span className="card-stock low">Only {variant.stock} left in this variant</span>
                  : <span className="card-stock">In stock, ready to ship</span>}
              </div>
              <div className="qty-row">
                <span className="qty">
                  <button aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                  <span aria-live="polite">{qty}</span>
                  <button aria-label="Increase quantity" onClick={() => setQty(Math.min(variant?.stock || 1, qty + 1))}>+</button>
                </span>
                <button className="btn" style={{ flex: 1 }} disabled={!variant || variant.stock < qty} onClick={add}>
                  Add to cart — {variant ? money(variant.price_cents * qty) : ""}
                </button>
              </div>
            </>
          )}
          <h3 style={{ marginTop: 22 }}>About this piece</h3>
          <p className="desc">{p.description}</p>
          {p.specs && <div className="specs">{p.specs}</div>}
        </div>
      </div>
      {p.related?.length > 0 && (
        <section className="related" aria-label="Related products">
          <h3>You may also like</h3>
          <div className="grid">
            {p.related.map((r) => <ProductCard key={r.id} product={r} onQuickShop={onQuickShop} />)}
          </div>
        </section>
      )}
    </>
  );
}
