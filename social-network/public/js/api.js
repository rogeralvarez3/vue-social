/**
 * Cliente API del frontend.
 * - Guarda el access token en memoria (variable JS) + localStorage como respaldo.
 * - El refresh token vive SOLO en una cookie httpOnly (el JS nunca la toca).
 * - Si una peticion responde 401 por token expirado, intenta refrescar
 *   automaticamente una vez y reintenta la peticion original.
 */
const API_BASE = '/api';

const Auth = {
  getAccessToken() {
    return sessionStorage.getItem('accessToken') || null;
  },
  setAccessToken(token) {
    if (token) sessionStorage.setItem('accessToken', token);
    else sessionStorage.removeItem('accessToken');
  },
  getUser() {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },
  setUser(user) {
    if (user) sessionStorage.setItem('user', JSON.stringify(user));
    else sessionStorage.removeItem('user');
  },
  logoutLocal() {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('user');
  }
};

async function apiRequest(path, { method = 'GET', body, isForm = false, _retry = false } = {}) {
  const headers = {};
  const token = Auth.getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include', // necesario para enviar la cookie del refresh token
    body: isForm ? body : body ? JSON.stringify(body) : undefined
  });

  let data;
  try { data = await response.json(); } catch { data = {}; }

  // Si el access token expiro, intentamos refrescarlo una sola vez
  if (response.status === 401 && data.code === 'TOKEN_EXPIRED' && !_retry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiRequest(path, { method, body, isForm, _retry: true });
    }
  }

  if (!response.ok) {
    throw new Error(data.error || 'Error en la peticion');
  }
  return data;
}

async function tryRefreshToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!res.ok) return false;
    const data = await res.json();
    Auth.setAccessToken(data.accessToken);
    Auth.setUser(data.user);
    return true;
  } catch {
    return false;
  }
}

const Api = {
  register: (payload) => apiRequest('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => apiRequest('/auth/login', { method: 'POST', body: payload }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  me: () => apiRequest('/auth/me'),

  // Todas estas llamadas usan el patron { action: ... } sobre una unica URL
  posts: (payload) => apiRequest('/posts', { method: 'POST', body: payload }),
  postsForm: (formData) => apiRequest('/posts', { method: 'POST', isForm: true, body: formData }),
  comments: (payload) => apiRequest('/comments', { method: 'POST', body: payload }),
  likes: (payload) => apiRequest('/likes', { method: 'POST', body: payload }),
  friends: (payload) => apiRequest('/friends', { method: 'POST', body: payload }),
  messages: (payload) => apiRequest('/messages', { method: 'POST', body: payload }),
  notifications: (payload) => apiRequest('/notifications', { method: 'POST', body: payload })
};
