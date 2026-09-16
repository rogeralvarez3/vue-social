/**
 * Instancia central de axios.
 * - Adjunta el access token en cada peticion.
 * - Si el servidor responde 401 TOKEN_EXPIRED, intenta refrescar el token
 *   automaticamente (una sola vez) y reintenta la peticion original.
 * - El refresh token viaja SOLO en una cookie httpOnly (nunca lo toca este JS).
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

function getAccessToken() {
  return sessionStorage.getItem('accessToken') || null;
}

export function setAccessToken(token) {
  if (token) sessionStorage.setItem('accessToken', token);
  else sessionStorage.removeItem('accessToken');
}

export function getStoredUser() {
  const raw = sessionStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user) {
  if (user) sessionStorage.setItem('user', JSON.stringify(user));
  else sessionStorage.removeItem('user');
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refrescando = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (response?.status === 401 && response?.data?.code === 'TOKEN_EXPIRED' && !config._retry) {
      config._retry = true;
      try {
        if (!refrescando) {
          refrescando = axios.post('/api/auth/refresh', {}, { withCredentials: true });
        }
        const { data } = await refrescando;
        refrescando = null;
        setAccessToken(data.accessToken);
        setStoredUser(data.user);
        config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(config);
      } catch (refreshError) {
        refrescando = null;
        setAccessToken(null);
        setStoredUser(null);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
