/**
 * HANDLER DE COMENTARIOS (con respuestas anidadas -> arbol)
 * action = crear | actualizar | borrar | listar
 *
 * Cada comentario puede tener un parentId (otro comentario al que responde).
 * En "listar" se devuelven ya organizados como arbol: cada comentario trae
 * un array `replies` con sus respuestas (y estas, a su vez, las suyas).
 */
const { pool } = require('../config/db');
const { emitToAll, emitToUser } = require('../config/socket');

function mapComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    parentId: row.parent_id,
    author: row.username ? { username: row.username, fullName: row.full_name, avatarUrl: row.avatar_url } : undefined,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    replies: []
  };
}

/**
 * Convierte una lista plana de comentarios (ordenados por fecha) en un arbol,
 * anidando cada respuesta dentro de su comentario padre.
 */
function construirArbol(rows) {
  const porId = new Map();
  const raiz = [];

  rows.forEach(row => porId.set(row.id, mapComment(row)));

  rows.forEach(row => {
    const nodo = porId.get(row.id);
    if (row.parent_id && porId.has(row.parent_id)) {
      porId.get(row.parent_id).replies.push(nodo);
    } else {
      raiz.push(nodo);
    }
  });

  return raiz;
}

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para realizar esta accion' });
    return false;
  }
  return true;
}

async function crear(req, res) {
  if (!requireAuth(req, res)) return;
  const { postId, content, parentId } = req.body;
  if (!postId || !content) {
    return res.status(400).json({ ok: false, error: 'postId y content son obligatorios' });
  }

  const post = await pool.query('SELECT user_id FROM posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
  if (post.rows.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada' });

  if (parentId) {
    const parent = await pool.query('SELECT id, post_id FROM comments WHERE id = $1 AND deleted_at IS NULL', [parentId]);
    if (parent.rows.length === 0) return res.status(404).json({ ok: false, error: 'El comentario al que respondes no existe' });
    if (parent.rows[0].post_id !== postId) {
      return res.status(400).json({ ok: false, error: 'El comentario padre no pertenece a esta publicacion' });
    }
  }

  const result = await pool.query(
    `INSERT INTO comments (post_id, user_id, parent_id, content) VALUES ($1, $2, $3, $4) RETURNING *`,
    [postId, req.userId, parentId || null, content]
  );

  const withAuthor = await pool.query(
    `SELECT c.*, u.username, u.full_name, u.avatar_url FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
    [result.rows[0].id]
  );

  const comment = mapComment(withAuthor.rows[0]);
  emitToAll('comentario:nuevo', comment);

  // Notifica al dueño de la publicacion y, si es una respuesta, tambien a quien recibio la respuesta
  const destinatarios = new Set();
  if (post.rows[0].user_id !== req.userId) destinatarios.add(post.rows[0].user_id);
  if (parentId) {
    const parentAuthor = await pool.query('SELECT user_id FROM comments WHERE id = $1', [parentId]);
    if (parentAuthor.rows[0] && parentAuthor.rows[0].user_id !== req.userId) {
      destinatarios.add(parentAuthor.rows[0].user_id);
    }
  }
  for (const userId of destinatarios) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, actor_id, entity_id, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, parentId ? 'reply' : 'comment', req.userId, postId, JSON.stringify({ preview: content.slice(0, 80) })]
    );
    emitToUser(userId, 'notificacion:nueva', { type: parentId ? 'reply' : 'comment', postId, actorId: req.userId });
  }

  res.status(201).json({ ok: true, comment });
}

async function actualizar(req, res) {
  if (!requireAuth(req, res)) return;
  const { id, content } = req.body;
  if (!id || !content) return res.status(400).json({ ok: false, error: 'id y content son obligatorios' });

  const existing = await pool.query('SELECT * FROM comments WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'Comentario no encontrado' });
  if (existing.rows[0].user_id !== req.userId) {
    return res.status(403).json({ ok: false, error: 'No puedes editar comentarios de otro usuario' });
  }

  const result = await pool.query('UPDATE comments SET content = $1 WHERE id = $2 RETURNING *', [content, id]);
  emitToAll('comentario:actualizado', { id, content: result.rows[0].content, postId: result.rows[0].post_id });
  res.json({ ok: true, comment: mapComment(result.rows[0]) });
}

async function borrar(req, res) {
  if (!requireAuth(req, res)) return;
  const id = req.body.id || req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta el id del comentario' });

  const existing = await pool.query('SELECT * FROM comments WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'Comentario no encontrado' });
  if (existing.rows[0].user_id !== req.userId) {
    return res.status(403).json({ ok: false, error: 'No puedes borrar comentarios de otro usuario' });
  }

  // Borrado logico en cascada de sus respuestas, para no dejar hijos huerfanos visualmente
  await pool.query(
    `WITH RECURSIVE hijos AS (
        SELECT id FROM comments WHERE id = $1
        UNION ALL
        SELECT c.id FROM comments c JOIN hijos h ON c.parent_id = h.id
     )
     UPDATE comments SET deleted_at = NOW() WHERE id IN (SELECT id FROM hijos)`,
    [id]
  );

  emitToAll('comentario:borrado', { id, postId: existing.rows[0].post_id });
  res.json({ ok: true, message: 'Comentario eliminado' });
}

async function listar(req, res) {
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { postId } = source;
  if (!postId) return res.status(400).json({ ok: false, error: 'Falta postId' });

  const result = await pool.query(
    `SELECT c.*, u.username, u.full_name, u.avatar_url
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = $1 AND c.deleted_at IS NULL
     ORDER BY c.created_at ASC`,
    [postId]
  );

  res.json({ ok: true, comments: construirArbol(result.rows) });
}

async function handleCommentAction(req, res, next) {
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

module.exports = { handleCommentAction };
