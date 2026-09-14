/**
 * Conexion Socket.io autenticada con el access token actual.
 * Expone un objeto global `socket` que feed.js usa para escuchar eventos
 * en tiempo real: publicaciones nuevas, likes, comentarios, notificaciones.
 */
const socket = io({
  auth: { token: Auth.getAccessToken() }
});

socket.on('connect_error', (err) => {
  console.warn('Socket.io no pudo conectar:', err.message);
});
