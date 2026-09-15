/**
 * HANDLER DE MEDIOS (fotos, videos y audios)
 * action = crear | borrar | listar
 * El body/query lleva ademas: type = "photo" | "video" | "audio"
 *
 * Esta tabla se alimenta de dos fuentes: subidas directas desde las
 * secciones Fotos/Videos/Audios, y adjuntos de publicaciones (en ese caso
 * postId queda enlazado, ver handlers/posts.handler.js).
 */
const { pool } = require('../config/db');
const { emitToAll } = require('../config/socket');

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para realizar esta accion' });
    return false;
  }
  return true;
}

function mapMedia(row) {
  return {
    id: row.id,
    userId: row.user_id,
    author: row.username ? { username: row.username, fullName: row.full_name, avatarUrl: row.avatar_url } : undefined,
    postId: row.post_id,
    type: row.type,
    url: row.url,
    caption: row.caption,
    createdAt: row.created_at
  };
}

async function crear(req, res) {
  if (!requireAuth(req, res)) return;
  const { type = 'photo', caption } = req.body;
  if (!['photo', 'video', 'audio'].includes(type)) {
    return res.status(400).json({ ok: false, error: 'type debe ser "photo", "video" o "audio"' });
  }
  if (!req.file) return res.status(400).json({ ok: false, error: 'Debes adjuntar un archivo' });

  const url = `/uploads/media/${req.file.filename}`;

  const result = await pool.query(
    `INSERT INTO media (user_id, type, url, caption) VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.userId, type, url, caption || '']
  );

  emitToAll('media:nuevo', { type, userId: req.userId });
  res.status(201).json({ ok: true, media: mapMedia(result.rows[0]) });
}

async function borrar(req, res) {
  if (!requireAuth(req, res)) return;
  const id = req.body.id || req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta el id' });

  const existing = await pool.query('SELECT * FROM media WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'No encontrado' });
  if (existing.rows[0].user_id !== req.userId) {
    return res.status(403).json({ ok: false, error: 'No puedes borrar archivos de otro usuario' });
  }

  await pool.query('UPDATE media SET deleted_at = NOW() WHERE id = $1', [id]);
  res.json({ ok: true, message: 'Eliminado correctamente' });
}

async function listar(req, res) {
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { type, userId, page = 1, limit = 24 } = source;
  const offset = (Number(page) - 1) * Number(limit);

  const params = [Number(limit), offset];
  let where = 'WHERE m.deleted_at IS NULL';

  if (type) {
    params.push(type);
    where += ` AND m.type = $${params.length}`;
  }
  if (userId) {
    params.push(userId);
    where += ` AND m.user_id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT m.*, u.username, u.full_name, u.avatar_url
     FROM media m JOIN users u ON u.id = m.user_id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );

  res.json({ ok: true, media: result.rows.map(mapMedia) });
}

async function handleMediaAction(req, res, next) {
  try {
    const action = (req.body.action || req.query.action || '').toLowerCase();
    switch (action) {
      case 'crear': return await crear(req, res);
      case 'borrar': return await borrar(req, res);
      case 'listar': return await listar(req, res);
      default:
        return res.status(400).json({ ok: false, error: 'Accion no valida. Usa: crear | borrar | listar' });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { handleMediaAction };
