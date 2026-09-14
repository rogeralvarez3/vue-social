/**
 * HANDLER DE REACCIONES (tipo Facebook)
 * action = crear (reaccionar / cambiar tipo de reaccion) | borrar (quitar reaccion) | listar
 * Cada usuario tiene UNA sola reaccion por publicacion; si ya existia, se actualiza el tipo.
 */
const { pool } = require('../config/db');
const { emitToAll, emitToUser } = require('../config/socket');

const TIPOS_VALIDOS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para realizar esta accion' });
    return false;
  }
  return true;
}

async function crear(req, res) {
  if (!requireAuth(req, res)) return;
  const { postId, type = 'like' } = req.body;
  if (!postId) return res.status(400).json({ ok: false, error: 'Falta postId' });
  if (!TIPOS_VALIDOS.includes(type)) {
    return res.status(400).json({ ok: false, error: `Tipo de reaccion invalido. Usa: ${TIPOS_VALIDOS.join(', ')}` });
  }

  const post = await pool.query('SELECT user_id FROM posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
  if (post.rows.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada' });

  const result = await pool.query(
    `INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, $3)
     ON CONFLICT (post_id, user_id) DO UPDATE SET type = EXCLUDED.type, created_at = NOW()
     RETURNING *`,
    [postId, req.userId, type]
  );

  emitToAll('reaccion:nueva', { postId, userId: req.userId, type });

  if (post.rows[0].user_id !== req.userId) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, actor_id, entity_id, data) VALUES ($1, 'reaction', $2, $3, $4)`,
      [post.rows[0].user_id, req.userId, postId, JSON.stringify({ reactionType: type })]
    );
    emitToUser(post.rows[0].user_id, 'notificacion:nueva', { type: 'reaction', postId, actorId: req.userId, reactionType: type });
  }

  res.status(201).json({ ok: true, reaction: result.rows[0] });
}

async function borrar(req, res) {
  if (!requireAuth(req, res)) return;
  const postId = req.body.postId || req.query.postId;
  if (!postId) return res.status(400).json({ ok: false, error: 'Falta postId' });

  await pool.query('DELETE FROM reactions WHERE post_id = $1 AND user_id = $2', [postId, req.userId]);
  emitToAll('reaccion:borrada', { postId, userId: req.userId });
  res.json({ ok: true, message: 'Reaccion eliminada' });
}

async function listar(req, res) {
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { postId } = source;
  if (!postId) return res.status(400).json({ ok: false, error: 'Falta postId' });

  const result = await pool.query(
    `SELECT r.type, u.id, u.username, u.full_name, u.avatar_url
     FROM reactions r JOIN users u ON u.id = r.user_id
     WHERE r.post_id = $1
     ORDER BY r.created_at DESC`,
    [postId]
  );

  const resumen = {};
  for (const tipo of TIPOS_VALIDOS) resumen[tipo] = 0;
  result.rows.forEach(r => { resumen[r.type] = (resumen[r.type] || 0) + 1; });

  res.json({ ok: true, resumen, usuarios: result.rows });
}

async function handleReactionAction(req, res, next) {
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

module.exports = { handleReactionAction, TIPOS_VALIDOS };
