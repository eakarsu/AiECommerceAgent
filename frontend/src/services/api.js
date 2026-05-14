// Centralized API client (fixes audit gap: empty services/ folder)
// All page-level fetch logic should go through this client.

const BASE = '/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    if (res.status === 401) {
      // Trigger logout via removing token; AuthContext will redirect
      localStorage.removeItem('token');
    }
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function apiGet(path, query) {
  const url = new URL(BASE + path, window.location.origin);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString().replace(window.location.origin, ''), {
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

export async function apiPost(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse(res);
}

export async function apiPut(path, body) {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse(res);
}

export async function apiDelete(path) {
  const res = await fetch(BASE + path, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

// Convenience domain methods for the new AI features
export const InventoryReorderApi = {
  list: (params) => apiGet('/ai/inventory-reorder/suggestions', params),
  predict: (productId, lead_time_days) => apiPost('/ai/inventory-reorder', { productId, lead_time_days }),
  setStatus: (id, status) => apiPut(`/ai/inventory-reorder/suggestions/${id}`, { status }),
};

export const PriceElasticityApi = {
  list: (params) => apiGet('/ai/price-elasticity', params),
  start: (productId) => apiPost('/ai/price-elasticity/start', { productId }),
  recordEvent: (id, variant, type) => apiPost(`/ai/price-elasticity/${id}/event`, { variant, type }),
  conclude: (id) => apiPost(`/ai/price-elasticity/${id}/conclude`),
};

export const PhotoCritiqueApi = {
  list: (params) => apiGet('/ai/photo-critique', params),
  critique: (productId, image_url) => apiPost('/ai/photo-critique', { productId, image_url }),
};

export const ConciergeApi = {
  newSession: (customerId, cart_snapshot) => apiPost('/ai/concierge/sessions', { customerId, cart_snapshot }),
  getSession: (id) => apiGet(`/ai/concierge/sessions/${id}`),
  list: (params) => apiGet('/ai/concierge/sessions', params),
  send: (id, content) => apiPost(`/ai/concierge/sessions/${id}/message`, { content }),
};

export const FraudClusterApi = {
  list: (params) => apiGet('/ai/fraud-clusters', params),
  detect: () => apiPost('/ai/fraud-clusters/detect'),
  get: (id) => apiGet(`/ai/fraud-clusters/${id}`),
  update: (id, body) => apiPut(`/ai/fraud-clusters/${id}`, body),
};

export const AuthApi = {
  forgotPassword: (email) => apiPost('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => apiPost('/auth/reset-password', { token, new_password }),
  changePassword: (current_password, new_password) =>
    apiPost('/auth/change-password', { current_password, new_password }),
};

export default { apiGet, apiPost, apiPut, apiDelete };
