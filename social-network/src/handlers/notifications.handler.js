/**
 * HANDLER DE NOTIFICACIONES
 * action = actualizar (marcar como leida/s) | listar
 */
const { pool } = require('../config/db');

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para realizar esta accion' });
    return false;
  }
  return true;
}

async function actualizar(req, res) {
  if (!requireAuth(req, res)) return;
  const { id, marcarTodas } = req.body;

  if (marcarTodas) {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.userId]);
    return res.json({ ok: true, message: 'Todas las notificaciones marcadas como leidas' });
  }

  if (!id) return res.status(400).json({ ok: false, error: 'Falta id o marcarTodas' });
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [id, req.userId]);
  res.json({ ok: true, message: 'Notificacion marcada como leida' });
}

async function listar(req, res) {
  if (!requireAuth(req, res)) return;
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { page = 1, limit = 20 } = source;
  const offset = (Number(page) - 1) * Number(limit);

  const result = await pool.query(
    `SELECT n.*, u.username AS actor_username, u.avatar_url AS actor_avatar
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.userId, Number(limit), offset]
  );

  res.json({ ok: true, notificaciones: result.rows });
}

async function handleNotificationAction(req, res, next) {
  try {
    const action = (req.body.action || req.query.action || '').toLowerCase();
    switch (action) {
      case 'actualizar': return await actualizar(req, res);
      case 'listar': return await listar(req, res);
      default:
        return res.status(400).json({ ok: false, error: 'Accion no valida. Usa: actualizar | listar' });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { handleNotificationAction };
