/**
 * Middleware que protege rutas verificando el access token JWT
 * enviado en el header: Authorization: Bearer <token>
 */
const { verifyAccessToken } = require('../utils/tokens');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: 'No autenticado: falta el token de acceso' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.username = payload.username;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ ok: false, error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ ok: false, error: 'Token invalido' });
  }
}

/**
 * Version "opcional": si hay token valido, adjunta el usuario;
 * si no hay o es invalido, continua igual (util para listados publicos).
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.username = payload.username;
  } catch (err) {
    // ignorar token invalido en modo opcional
  }
  next();
}

module.exports = { authenticate, optionalAuth };
