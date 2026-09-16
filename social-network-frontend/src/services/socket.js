/**
 * Conexion Socket.io autenticada con el access token actual.
 * Se conecta/reconecta cada vez que cambia el usuario logueado.
 */
import { io } from 'socket.io-client';

let socket = null;

export function conectarSocket(token) {
  if (socket) {
    socket.disconnect();
  }
  socket = io('/', {
    auth: { token },
    withCredentials: true,
    autoConnect: true
  });
  return socket;
}

export function obtenerSocket() {
  return socket;
}

export function desconectarSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
