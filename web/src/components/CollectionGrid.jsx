import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { ProductCard, QuickShopModal, SkeletonGrid } from "./Product";

const SORTS = [
  ["featured", "Featured"], ["popularity", "Popularity"], ["newest", "Newest"],
  ["alpha", "Alphabetical"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"],
];

export function CollectionGrid({ collectionSlug, searchQuery, notify, onQuickShop }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("featured");
  const [avail, setAvail] = useState("all");
  const [dense, setDense] = useState(false);

  useEffect(() => { setPage(1); }, [collectionSlug, searchQuery, sort, avail]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    const params = new URLSearchParams({ sort, availability: avail, page, perPage: "12" });
    if (collectionSlug) params.set("collection", collectionSlug);
    if (searchQuery) params.set("q", searchQuery);
    api.get(`/api/products?${params}`)
      .then((d) => {
        if (!alive) return;
        setItems((prev) => (page === 1 ? d.items : [...prev, ...d.items]));
        setTotal(d.total); setPages(d.pages);
      })
      .catch(() => alive && setError("Could not load products. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [collectionSlug, searchQuery, sort, avail, page]);

  const filtersActive = sort !== "featured" || avail !== "all" || searchQuery;
  const clearAll = () => { setSort("featured"); setAvail("all"); };

  return (
    <section aria-label="Products">
      <div className="controls">
        <label>Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products" style={{ marginLeft: 8 }}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Availability filter" style={{ display: "flex", gap: 8 }}>
          {[["all", "All"], ["in_stock", "In stock"], ["on_sale", "On sale"], ["coming_soon", "Coming soon"]].map(([v, l]) => (
            <button key={v} className="chip" aria-pressed={avail === v} onClick={() => setAvail(v)}>{l}</button>
          ))}
        </div>
        <button className="chip" aria-pressed={dense} onClick={() => setDense(!dense)} title="Toggle grid density">
          {dense ? "Comfortable" : "Compact"}
        </button>
        {filtersActive && <button className="clear-btn" onClick={clearAll}>Clear all filters</button>}
        <span className="result-count" role="status">{loading ? "Loading…" : `${total} product${total === 1 ? "" : "s"}`}</span>
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading ? <SkeletonGrid /> : items.length === 0 ? (
        <div className="empty">
          <h3>No products found</h3>
          <p>Try a different search or clear the filters.</p>
          {filtersActive && <button className="btn ghost" onClick={clearAll}>Clear all filters</button>}
        </div>
      ) : (
        <>
          <div className={`grid${dense ? " compact" : ""}`}>
            {items.map((p) => <ProductCard key={p.id} product={p} onQuickShop={onQuickShop} />)}
          </div>
          {pages > 1 && (
            <div className="load-more">
              {page < pages ? (
                <button className="btn ghost" onClick={() => setPage(page + 1)}>Load more ({total - page * 12} remaining)</button>
              ) : <span style={{ color: "var(--muted)" }}>You've seen all {total} products.</span>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
