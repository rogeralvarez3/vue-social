/**
 * RUTAS DE AUTENTICACION
 * Estas rutas SI son dedicadas (no siguen el patron de "action"), porque el login
 * es un flujo de seguridad especial que conviene mantener explicito y claro:
 *
 *   POST /api/auth/register  -> crear cuenta
 *   POST /api/auth/login     -> iniciar sesion (devuelve access token + cookie refresh)
 *   POST /api/auth/refresh   -> renovar access token usando la cookie refresh
 *   POST /api/auth/logout    -> revocar el refresh token actual
 *   GET  /api/auth/me        -> obtener el usuario autenticado actual
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken
} = require('../utils/tokens');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);

// Limita intentos de login para mitigar fuerza bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, error: 'Demasiados intentos de inicio de sesion. Intenta mas tarde.' }
});

function cookieOptions() {
  return {
    httpOnly: true,
    // El servidor siempre corre sobre HTTPS (ver server.js), asi que la cookie
    // del refresh token siempre exige una conexion cifrada, incluso en desarrollo
    // local con el certificado autofirmado.
    secure: true,
    sameSite: 'lax',
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth'
  };
}

async function storeRefreshToken(userId, rawToken, req) {
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hashToken(rawToken), req.headers['user-agent'] || null, req.ip, expiresAt]
  );
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    createdAt: row.created_at
  };
}

// ---------------------------------------------------------
// REGISTRO
// ---------------------------------------------------------
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) {
      return res.status(400).json({ ok: false, error: 'Nombre de usuario invalido (3-30 caracteres, letras/numeros/._)' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ ok: false, error: 'El usuario o el correo ya estan registrados' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [username, email, passwordHash, fullName]
    );

    const user = result.rows[0];
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await storeRefreshToken(user.id, refreshToken, req);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
    res.status(201).json({ ok: true, accessToken, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------
// LOGIN
// ---------------------------------------------------------
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { identifier, password } = req.body; // identifier = username o email

    if (!identifier || !password) {
      return res.status(400).json({ ok: false, error: 'Usuario/correo y contraseña son obligatorios' });
    }

    const result = await pool.query(
      `SELECT * FROM users WHERE (username = $1 OR email = $1) AND deleted_at IS NULL`,
      [identifier]
    );

    // Respuesta generica para no revelar si el usuario existe o no
    const genericError = () => res.status(401).json({ ok: false, error: 'Credenciales invalidas' });

    if (result.rows.length === 0) return genericError();

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ ok: false, error: 'Cuenta deshabilitada' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return genericError();

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await storeRefreshToken(user.id, refreshToken, req);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
    res.json({ ok: true, accessToken, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------
// REFRESH (renovar access token) - con rotacion de refresh token
// ---------------------------------------------------------
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) return res.status(401).json({ ok: false, error: 'No hay sesion activa' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ ok: false, error: 'Sesion expirada, inicia sesion de nuevo' });
    }

    const tokenHash = hashToken(token);
    const dbToken = await pool.query(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2`,
      [tokenHash, payload.sub]
    );

    if (dbToken.rows.length === 0 || dbToken.rows[0].revoked) {
      // Posible reutilizacion de un token robado: revocamos todos por seguridad
      await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [payload.sub]);
      return res.status(401).json({ ok: false, error: 'Token invalido, vuelve a iniciar sesion' });
    }

    if (new Date(dbToken.rows[0].expires_at) < new Date()) {
      return res.status(401).json({ ok: false, error: 'Sesion expirada, inicia sesion de nuevo' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [payload.sub]);
    if (userResult.rows.length === 0) return res.status(401).json({ ok: false, error: 'Usuario no encontrado' });
    const user = userResult.rows[0];

    // Rotacion: revocar el token usado y emitir uno nuevo
    await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [dbToken.rows[0].id]);
    const newRefreshToken = signRefreshToken(user);
    await storeRefreshToken(user.id, newRefreshToken, req);
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, cookieOptions());

    const accessToken = signAccessToken(user);
    res.json({ ok: true, accessToken, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1', [hashToken(token)]);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    res.json({ ok: true, message: 'Sesion cerrada' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------
// CAMBIAR CONTRASEÑA (requiere sesion activa + contraseña actual)
// ---------------------------------------------------------
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: 'La contraseña actual y la nueva son obligatorias' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

    const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!match) return res.status(401).json({ ok: false, error: 'La contraseña actual no es correcta' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.userId]);

    // Por seguridad, al cambiar la contraseña se cierra el resto de sesiones activas
    await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [req.userId]);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });

    res.json({ ok: true, message: 'Contraseña actualizada. Vuelve a iniciar sesion.' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------
// USUARIO ACTUAL
// ---------------------------------------------------------
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    res.json({ ok: true, user: publicUser(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
