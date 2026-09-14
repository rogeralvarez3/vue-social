import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// El backend (social-network) corre en HTTPS con certificado autofirmado local.
// secure: false le dice al proxy de Vite que no rechace ese certificado
// (solo para desarrollo local; en produccion cada uno se sirve por su cuenta).
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'https://localhost:4000';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND_URL, changeOrigin: true, secure: false },
      '/uploads': { target: BACKEND_URL, changeOrigin: true, secure: false },
      '/socket.io': { target: BACKEND_URL, changeOrigin: true, secure: false, ws: true }
    }
  }
});
