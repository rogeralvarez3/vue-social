/**
 * HANDLER DE LIKES
 * action = crear (dar like) | borrar (quitar like) | listar (ver quien dio like)
 */
const { pool } = require('../config/db');
const { emitToAll, emitToUser } = require('../config/socket');

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para realizar esta accion' });
    return false;
  }
  return true;
}

async function crear(req, res) {
  if (!requireAuth(req, res)) return;
  const { postId } = req.body;
  if (!postId) return res.status(400).json({ ok: false, error: 'Falta postId' });

  const post = await pool.query('SELECT user_id FROM posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
  if (post.rows.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada' });

  try {
    await pool.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [postId, req.userId]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Ya diste like a esta publicacion' });
    }
    throw err;
  }

  emitToAll('like:nuevo', { postId, userId: req.userId });

  if (post.rows[0].user_id !== req.userId) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, actor_id, entity_id) VALUES ($1, 'like', $2, $3)`,
      [post.rows[0].user_id, req.userId, postId]
    );
    emitToUser(post.rows[0].user_id, 'notificacion:nueva', { type: 'like', postId, actorId: req.userId });
  }

  res.status(201).json({ ok: true, message: 'Like agregado' });
}

async function borrar(req, res) {
  if (!requireAuth(req, res)) return;
  const postId = req.body.postId || req.query.postId;
  if (!postId) return res.status(400).json({ ok: false, error: 'Falta postId' });

  await pool.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, req.userId]);
  emitToAll('like:borrado', { postId, userId: req.userId });
  res.json({ ok: true, message: 'Like eliminado' });
}

async function listar(req, res) {
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { postId } = source;
  if (!postId) return res.status(400).json({ ok: false, error: 'Falta postId' });

  const result = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url
     FROM likes l JOIN users u ON u.id = l.user_id
     WHERE l.post_id = $1
     ORDER BY l.created_at DESC`,
    [postId]
  );

  res.json({ ok: true, users: result.rows });
}

async function handleLikeAction(req, res, next) {
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

module.exports = { handleLikeAction };
