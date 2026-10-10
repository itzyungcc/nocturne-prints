// API client + money formatting.
const BASE = "";

async function req(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = localStorage.getItem("ncp_token") || localStorage.getItem("ncp_admin");
  if (token && !opts.public) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Request failed (${res.status})`);
    err.code = data.error; err.errors = data.errors; err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => req(p, { method: "GET" }),
  post: (p, body) => req(p, { method: "POST", body: JSON.stringify(body || {}) }),
  put: (p, body) => req(p, { method: "PUT", body: JSON.stringify(body || {}) }),
};

export const adminApi = {
  login: (password) => req("/api/admin/login", { method: "POST", body: JSON.stringify({ password }), public: true }),
  logout: () => req("/api/admin/logout", { method: "POST", body: "{}" }),
  overview: () => api.get("/api/admin/overview"),
  products: () => api.get("/api/admin/products"),
  saveProduct: (p, id) => id ? api.put(`/api/admin/products/${id}`, p) : api.post("/api/admin/products", p),
  archiveProduct: (id) => api.post(`/api/admin/products/${id}/archive`),
  collections: () => api.get("/api/admin/collections"),
  addCollection: (c) => api.post("/api/admin/collections", c),
  saveCollection: (id, c) => api.put(`/api/admin/collections/${id}`, c),
  deleteCollection: (id) => req(`/api/admin/collections/${id}`, { method: "DELETE" }),
  discounts: () => api.get("/api/admin/discounts"),
  addDiscount: (d) => api.post("/api/admin/discounts", d),
  saveDiscount: (code, d) => api.put(`/api/admin/discounts/${encodeURIComponent(code)}`, d),
  deleteDiscount: (code) => req(`/api/admin/discounts/${encodeURIComponent(code)}`, { method: "DELETE" }),
  customers: () => api.get("/api/admin/customers"),
  orders: () => api.get("/api/admin/orders"),
  orderStatus: (id, status) => api.post(`/api/admin/orders/${id}/status`, { status }),
  settings: () => api.get("/api/admin/settings"),
  saveSettings: (s) => api.put("/api/admin/settings", s),
  uploadImage: async (productId, file) => {
    const token = localStorage.getItem("ncp_admin");
    const res = await fetch(`/api/admin/products/${productId}/images`, {
      method: "POST",
      headers: { "Content-Type": file.type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || `Upload failed (${res.status})`);
      err.code = data.error; err.status = res.status;
      throw err;
    }
    return data;
  },
  deleteImage: (productId, imageId) =>
    req(`/api/admin/products/${productId}/images/${imageId}`, { method: "DELETE" }),
};

export function money(cents) {
  return "$" + (cents / 100).toFixed(2);
}
export function priceRange(p) {
  if (p.singlePrice) return money(Math.round(p.priceMin * 100));
  return `${money(Math.round(p.priceMin * 100))} – ${money(Math.round(p.priceMax * 100))}`;
}
