import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { avatarSVG } from "../lib/art";
import { CollectionGrid } from "../components/CollectionGrid";
import { ProductArt, ProductCard, SkeletonGrid } from "../components/Product";

function CreatorHero({ creator }) {
  if (!creator) return null;
  return (
    <div className="creator">
      <img className="avatar" src={avatarSVG(creator.avatarSeed)} alt={`${creator.name} avatar`} width="88" height="88" />
      <div>
        <h1>{creator.name}</h1>
        <p className="bio">{creator.bio}</p>
        <div className="social">
          {creator.twitter && <a href={`https://twitter.com/${creator.twitter.replace("@", "")}`} target="_blank" rel="noreferrer">Twitter</a>}
          {creator.instagram && <a href={`https://instagram.com/${creator.instagram.replace("@", "")}`} target="_blank" rel="noreferrer">Instagram</a>}
          {creator.website && <a href={creator.website} target="_blank" rel="noreferrer">Website</a>}
        </div>
      </div>
    </div>
  );
}

export function HomePage({ notify, onQuickShop }) {
  const [collections, setCollections] = useState([]);
  const [creator, setCreator] = useState(null);
  const [featured, setFeatured] = useState([]);
  useEffect(() => {
    api.get("/api/collections").then(setCollections).catch(() => {});
    api.get("/api/creators/aoki").then(setCreator).catch(() => {});
    api.get("/api/products?sort=featured&perPage=4").then((d) => setFeatured(d.items.filter((p) => p.featured))).catch(() => {});
  }, []);
  return (
    <>
      <CreatorHero creator={creator} />
      <div className="collection-head">
        <h2>All Products</h2>
        <p>Original night-themed prints, posters and stickers — drawn after dark, printed in small batches.</p>
      </div>
      {featured.length > 0 && (
        <section aria-label="Featured">
          <h3>Featured</h3>
          <div className="grid">
            {featured.map((p) => <ProductCard key={p.id} product={p} onQuickShop={onQuickShop} />)}
          </div>
        </section>
      )}
      <CollectionGrid notify={notify} onQuickShop={onQuickShop} />
    </>
  );
}

export function CollectionPage({ notify, onQuickShop }) {
  const { slug } = useParams();
  const [col, setCol] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setMissing(false); setCol(null);
    api.get(`/api/collections/${slug}`).then(setCol).catch(() => setMissing(true));
  }, [slug]);
  if (missing) return <div className="empty"><h3>Collection not found</h3><p><Link to="/">Back to all products</Link></p></div>;
  if (!col) return <SkeletonGrid n={4} />;
  return (
    <>
      <CreatorHero creator={col.creator} />
      <div className="collection-head">
        <h2>{col.title}</h2>
        <p>{col.description}</p>
      </div>
      <CollectionGrid collectionSlug={slug} notify={notify} onQuickShop={onQuickShop} />
    </>
  );
}

export function SearchPage({ notify, onQuickShop }) {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  return (
    <>
      <div className="collection-head" style={{ paddingTop: 26 }}>
        <h2>Search results</h2>
        <p>{q ? <>Showing results for “<strong>{q}</strong>”</> : "Type in the search box to find prints."}</p>
      </div>
      {q && <CollectionGrid searchQuery={q} notify={notify} onQuickShop={onQuickShop} />}
    </>
  );
}
