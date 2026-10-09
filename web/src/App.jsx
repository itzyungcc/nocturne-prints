import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import "./styles.css";
import { api } from "./lib/api";
import { Header, Footer } from "./components/Header";
import { CartDrawer, AgeGate, Toast } from "./components/Chrome";
import { QuickShopModal } from "./components/Product";
import { HomePage, CollectionPage, SearchPage } from "./pages/Browse";
import { ProductPage } from "./pages/Product";
import { CheckoutPage, OrderPage } from "./pages/Checkout";
import { AccountPage } from "./pages/Account";
import { AdminPage } from "./pages/Admin";

function Shell() {
  const [settings, setSettings] = useState(null);
  const [collections, setCollections] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [quickShop, setQuickShop] = useState(null);
  const [toast, setToast] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    api.get("/api/settings").then(setSettings).catch(() => {});
    api.get("/api/collections").then(setCollections).catch(() => {});
  }, []);

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }, []);

  useEffect(() => {
    document.title = settings?.storeName ? `${settings.storeName} — ${settings.tagline}` : "Nocturne Prints";
  }, [settings]);

  return (
    <>
      <AgeGate settings={settings} />
      <Header onCartOpen={() => setCartOpen(true)} collections={collections} />
      <main className="wrap">
        <Routes>
          <Route path="/" element={<HomePage notify={notify} onQuickShop={setQuickShop} />} />
          <Route path="/collections/:slug" element={<CollectionPage notify={notify} onQuickShop={setQuickShop} />} />
          <Route path="/search" element={<SearchPage notify={notify} onQuickShop={setQuickShop} />} />
          <Route path="/products/:slug" element={<ProductPage notify={notify} onQuickShop={setQuickShop} />} />
          <Route path="/checkout" element={<CheckoutPage settings={settings} notify={notify} />} />
          <Route path="/order/:ref" element={<OrderPage />} />
          <Route path="/account" element={<AccountPage notify={notify} />} />
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="*" element={<div className="empty"><h3>Page not found</h3><p><a href="/">Back home</a></p></div>} />
        </Routes>
      </main>
      <Footer settings={settings} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); nav("/checkout"); }} />
      {quickShop && <QuickShopModal product={quickShop} onClose={() => setQuickShop(null)} notify={notify} />}
      <Toast message={toast} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
