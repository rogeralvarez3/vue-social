/**
 * HANDLER DE USUARIOS / PERFIL
 * action = actualizar (editar perfil propio / subir avatar-portada / pais-ciudad)
 *          | borrar (desactivar cuenta propia, borrado logico)
 *          | listar (buscar usuarios por nombre / obtener perfil por id o username
 *                     / listar ciudades disponibles con "listarCiudades: true")
 * (El "crear" de usuarios vive en auth.routes.js como /register, por ser un flujo de seguridad)
 */
const { pool } = require('../config/db');

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    bio: row.bio,
    country: row.country,
    city: row.city,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    createdAt: row.created_at
  };
}

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para realizar esta accion' });
    return false;
  }
  return true;
}

async function actualizar(req, res) {
  if (!requireAuth(req, res)) return;
  const { fullName, bio, country, city } = req.body;

  const avatarUrl = req.files?.avatar?.[0] ? `/uploads/avatars/${req.files.avatar[0].filename}` : undefined;
  const coverUrl = req.files?.cover?.[0] ? `/uploads/avatars/${req.files.cover[0].filename}` : undefined;

  const result = await pool.query(
    `UPDATE users SET
        full_name = COALESCE($1, full_name),
        bio = COALESCE($2, bio),
        country = COALESCE($3, country),
        city = COALESCE($4, city),
        avatar_url = COALESCE($5, avatar_url),
        cover_url = COALESCE($6, cover_url)
     WHERE id = $7
     RETURNING *`,
    [fullName, bio, country, city, avatarUrl, coverUrl, req.userId]
  );

  res.json({ ok: true, user: publicUser(result.rows[0]) });
}

async function borrar(req, res) {
  if (!requireAuth(req, res)) return;
  // Borrado logico: desactiva la cuenta sin perder el historial (posts, comentarios, etc.)
  await pool.query(
    `UPDATE users SET deleted_at = NOW(), is_active = FALSE WHERE id = $1`,
    [req.userId]
  );
  res.json({ ok: true, message: 'Cuenta desactivada' });
}

async function listar(req, res) {
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { q, id, username, page = 1, limit = 20, listarCiudades } = source;

  // Alimenta el selector "ver publicaciones de otra ciudad" del feed
  if (listarCiudades) {
    const result = await pool.query(
      `SELECT DISTINCT city, country FROM users
       WHERE deleted_at IS NULL AND city IS NOT NULL AND city <> ''
       ORDER BY city ASC`
    );
    return res.json({ ok: true, ciudades: result.rows });
  }

  if (id || username) {
    const result = await pool.query(
      `SELECT * FROM users WHERE (id = $1 OR username = $2) AND deleted_at IS NULL`,
      [id || null, username || null]
    );
    if (result.rows.length === 0) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    return res.json({ ok: true, user: publicUser(result.rows[0]) });
  }

  const offset = (Number(page) - 1) * Number(limit);
  const result = await pool.query(
    `SELECT * FROM users
     WHERE deleted_at IS NULL AND ($1::text IS NULL OR username ILIKE '%' || $1 || '%' OR full_name ILIKE '%' || $1 || '%')
     ORDER BY username ASC
     LIMIT $2 OFFSET $3`,
    [q || null, Number(limit), offset]
  );

  res.json({ ok: true, users: result.rows.map(publicUser) });
}

async function handleUserAction(req, res, next) {
  try {
    const action = (req.body.action || req.query.action || '').toLowerCase();
    switch (action) {
      case 'actualizar': return await actualizar(req, res);
      case 'borrar': return await borrar(req, res);
      case 'listar': return await listar(req, res);
      default:
        return res.status(400).json({ ok: false, error: 'Accion no valida. Usa: actualizar | borrar | listar' });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { handleUserAction };
