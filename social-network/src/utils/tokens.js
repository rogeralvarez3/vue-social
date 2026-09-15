/**
 * Manejo de tokens JWT.
 *
 * Access token: corta duracion (ej. 15 min), viaja en el header Authorization.
 * Refresh token: larga duracion (ej. 7 dias), viaja en una cookie httpOnly + secure,
 *   y ademas se guarda HASHEADO (sha256) en la base de datos para poder revocarlo
 *   y detectar reutilizacion (rotacion de tokens).
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${process.env.JWT_REFRESH_EXPIRES_DAYS || 7}d` }
  );
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

/**
 * Convierte el token en un hash irreversible para guardarlo en la BD.
 * Asi, si la base de datos se filtra, no se exponen tokens usables directamente.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken
};
