/**
 * Store de autenticacion: usuario actual, login/registro/logout,
 * y arranque de la conexion Socket.io autenticada.
 */
import { defineStore } from 'pinia';
import { AuthApi } from '@/services/resources';
import { setAccessToken, setStoredUser, getStoredUser } from '@/services/api';
import { conectarSocket, desconectarSocket } from '@/services/socket';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: getStoredUser(),
    cargando: false,
    error: null
  }),
  getters: {
    estaAutenticado: (state) => !!state.user
  },
  actions: {
    async login(identifier, password) {
      this.cargando = true;
      this.error = null;
      try {
        const data = await AuthApi.login({ identifier, password });
        this._establecerSesion(data);
        return true;
      } catch (err) {
        this.error = err.response?.data?.error || 'No se pudo iniciar sesion';
        return false;
      } finally {
        this.cargando = false;
      }
    },
    async registrar(payload) {
      this.cargando = true;
      this.error = null;
      try {
        const data = await AuthApi.register(payload);
        this._establecerSesion(data);
        return true;
      } catch (err) {
        this.error = err.response?.data?.error || 'No se pudo crear la cuenta';
        return false;
      } finally {
        this.cargando = false;
      }
    },
    async cerrarSesion() {
      try { await AuthApi.logout(); } catch { /* continuar igual */ }
      this.user = null;
      setAccessToken(null);
      setStoredUser(null);
      desconectarSocket();
    },
    actualizarUsuarioLocal(usuarioParcial) {
      this.user = { ...this.user, ...usuarioParcial };
      setStoredUser(this.user);
    },
    _establecerSesion(data) {
      this.user = data.user;
      setAccessToken(data.accessToken);
      setStoredUser(data.user);
      conectarSocket(data.accessToken);
    },
    reconectarSocketSiHaySesion() {
      const token = sessionStorage.getItem('accessToken');
      if (token) conectarSocket(token);
    }
  }
});
