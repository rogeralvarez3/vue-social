/**
 * HANDLER DE MENSAJES PRIVADOS
 * action = crear (enviar mensaje) | actualizar (marcar como leido) | borrar | listar (conversacion)
 * Los mensajes nuevos se emiten por Socket.io al destinatario en tiempo real.
 */
const { pool } = require('../config/db');
const { emitToUser } = require('../config/socket');

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para realizar esta accion' });
    return false;
  }
  return true;
}

async function crear(req, res) {
  if (!requireAuth(req, res)) return;
  const { receiverId, content } = req.body;
  if (!receiverId || !content) {
    return res.status(400).json({ ok: false, error: 'receiverId y content son obligatorios' });
  }

  const result = await pool.query(
    `INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *`,
    [req.userId, receiverId, content]
  );

  const message = result.rows[0];
  // Entrega en tiempo real al destinatario (y confirmacion al remitente en otras pestañas)
  emitToUser(receiverId, 'mensaje:nuevo', message);
  emitToUser(req.userId, 'mensaje:enviado', message);

  res.status(201).json({ ok: true, message });
}

async function actualizar(req, res) {
  if (!requireAuth(req, res)) return;
  const { id } = req.body; // marcar como leido
  if (!id) return res.status(400).json({ ok: false, error: 'Falta el id del mensaje' });

  const existing = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'Mensaje no encontrado' });
  if (existing.rows[0].receiver_id !== req.userId) {
    return res.status(403).json({ ok: false, error: 'Solo el destinatario puede marcarlo como leido' });
  }

  const result = await pool.query('UPDATE messages SET is_read = TRUE WHERE id = $1 RETURNING *', [id]);
  emitToUser(existing.rows[0].sender_id, 'mensaje:leido', { id });
  res.json({ ok: true, message: result.rows[0] });
}

async function borrar(req, res) {
  if (!requireAuth(req, res)) return;
  const id = req.body.id || req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta el id del mensaje' });

  const existing = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'Mensaje no encontrado' });
  if (![existing.rows[0].sender_id, existing.rows[0].receiver_id].includes(req.userId)) {
    return res.status(403).json({ ok: false, error: 'No puedes borrar este mensaje' });
  }

  await pool.query('UPDATE messages SET deleted_at = NOW() WHERE id = $1', [id]);
  res.json({ ok: true, message: 'Mensaje eliminado' });
}

async function listar(req, res) {
  if (!requireAuth(req, res)) return;
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { withUserId, page = 1, limit = 30 } = source;
  if (!withUserId) return res.status(400).json({ ok: false, error: 'Falta withUserId' });

  const offset = (Number(page) - 1) * Number(limit);
  const result = await pool.query(
    `SELECT * FROM messages
     WHERE deleted_at IS NULL
       AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [req.userId, withUserId, Number(limit), offset]
  );

  res.json({ ok: true, mensajes: result.rows.reverse() });
}

async function handleMessageAction(req, res, next) {
  try {
    const action = (req.body.action || req.query.action || '').toLowerCase();
    switch (action) {
      case 'crear': return await crear(req, res);
      case 'actualizar': return await actualizar(req, res);
      case 'borrar': return await borrar(req, res);
      case 'listar': return await listar(req, res);
      default:
        return res.status(400).json({ ok: false, error: 'Accion no valida. Usa: crear | actualizar | borrar | listar' });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { handleMessageAction };
