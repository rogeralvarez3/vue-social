/**
 * Configuracion de Socket.io.
 * Cada usuario conectado se une a una "room" privada: user:<id>
 * De esa forma podemos emitir eventos dirigidos a un usuario especifico
 * (notificaciones, mensajes, likes, comentarios) sin exponerlos a nadie mas.
 */
const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/tokens');

let io = null;

function initSocket(httpServer, corsOrigin) {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true
    }
  });

  // Middleware de autenticacion para sockets: exige un access token valido
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('No autorizado: falta token'));

      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      next();
    } catch (err) {
      next(new Error('No autorizado: token invalido'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on('disconnect', () => {
      // No se requiere limpieza manual: socket.io gestiona las rooms al desconectar
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io no ha sido inicializado todavia');
  return io;
}

/**
 * Emite un evento a un usuario especifico (a todas sus pestañas/dispositivos conectados)
 */
function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

/**
 * Emite un evento a todos los usuarios conectados (ej: nuevo post publico)
 */
function emitToAll(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

module.exports = { initSocket, getIO, emitToUser, emitToAll };
