/**
 * HANDLER DE AMISTADES
 * action = crear (enviar solicitud) | actualizar (aceptar/rechazar/bloquear)
 *          | borrar (cancelar solicitud o eliminar amistad) | listar (amigos / solicitudes pendientes)
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
  const { addresseeId } = req.body;
  if (!addresseeId) return res.status(400).json({ ok: false, error: 'Falta addresseeId' });
  if (addresseeId === req.userId) {
    return res.status(400).json({ ok: false, error: 'No puedes enviarte una solicitud a ti mismo' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO friendships (requester_id, addressee_id, status)
       VALUES ($1, $2, 'pending') RETURNING *`,
      [req.userId, addresseeId]
    );
    emitToUser(addresseeId, 'amistad:solicitud', { from: req.userId, friendshipId: result.rows[0].id });
    res.status(201).json({ ok: true, friendship: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Ya existe una solicitud entre estos usuarios' });
    }
    throw err;
  }
}

async function actualizar(req, res) {
  if (!requireAuth(req, res)) return;
  const { id, status } = req.body; // status: accepted | rejected | blocked
  if (!id || !['accepted', 'rejected', 'blocked'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'id y status (accepted|rejected|blocked) son obligatorios' });
  }

  const existing = await pool.query('SELECT * FROM friendships WHERE id = $1', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'Solicitud no encontrada' });

  // Solo el destinatario puede aceptar/rechazar/bloquear
  if (existing.rows[0].addressee_id !== req.userId) {
    return res.status(403).json({ ok: false, error: 'No puedes modificar esta solicitud' });
  }

  const result = await pool.query('UPDATE friendships SET status = $1 WHERE id = $2 RETURNING *', [status, id]);

  if (status === 'accepted') {
    emitToUser(existing.rows[0].requester_id, 'amistad:aceptada', { by: req.userId, friendshipId: id });
  }

  res.json({ ok: true, friendship: result.rows[0] });
}

async function borrar(req, res) {
  if (!requireAuth(req, res)) return;
  const id = req.body.id || req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta el id de la amistad/solicitud' });

  const existing = await pool.query('SELECT * FROM friendships WHERE id = $1', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'No encontrada' });
  if (![existing.rows[0].requester_id, existing.rows[0].addressee_id].includes(req.userId)) {
    return res.status(403).json({ ok: false, error: 'No puedes eliminar esta relacion' });
  }

  await pool.query('DELETE FROM friendships WHERE id = $1', [id]);
  res.json({ ok: true, message: 'Relacion eliminada' });
}

async function listar(req, res) {
  if (!requireAuth(req, res)) return;
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { tipo = 'amigos' } = source; // amigos | pendientes_recibidas | pendientes_enviadas

  let query, params;
  if (tipo === 'pendientes_recibidas') {
    query = `SELECT f.id, u.id AS user_id, u.username, u.full_name, u.avatar_url, f.created_at
              FROM friendships f JOIN users u ON u.id = f.requester_id
              WHERE f.addressee_id = $1 AND f.status = 'pending'`;
    params = [req.userId];
  } else if (tipo === 'pendientes_enviadas') {
    query = `SELECT f.id, u.id AS user_id, u.username, u.full_name, u.avatar_url, f.created_at
              FROM friendships f JOIN users u ON u.id = f.addressee_id
              WHERE f.requester_id = $1 AND f.status = 'pending'`;
    params = [req.userId];
  } else {
    query = `SELECT f.id, u.id AS user_id, u.username, u.full_name, u.avatar_url
              FROM friendships f
              JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
              WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'`;
    params = [req.userId];
  }

  const result = await pool.query(query, params);
  res.json({ ok: true, resultados: result.rows });
}

async function handleFriendAction(req, res, next) {
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

module.exports = { handleFriendAction };
