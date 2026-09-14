/**
 * HANDLER DE PUBLICACIONES (posts)
 *
 * En vez de tener un controlador por endpoint (POST /posts, PUT /posts/:id,
 * DELETE /posts/:id, GET /posts...), toda la logica vive aqui y se decide
 * segun req.body.action / req.query.action:
 *
 *   action = "crear"      -> nueva publicacion
 *   action = "actualizar" -> editar publicacion propia
 *   action = "borrar"     -> borrado logico de publicacion propia
 *   action = "listar"     -> feed / publicaciones de un usuario
 *
 * Cada publicacion admite UN adjunto: foto, video o audio (campo "media" del
 * formulario; el middleware de subida detecta el tipo y lo procesa). Ademas
 * de guardarse en la publicacion, ese adjunto se replica en la tabla `media`
 * para que aparezca automaticamente en las secciones Fotos / Videos / Audios
 * del menu, enlazado a la publicacion de origen (post_id).
 *
 * routes/posts.routes.js es solo un "despachador" muy delgado que llama
 * a la funcion correspondiente de este archivo.
 */
const { pool } = require('../config/db');
const { emitToAll, emitToUser } = require('../config/socket');

function mapPost(row) {
  return {
    id: row.id,
    userId: row.user_id,
    author: row.username ? { username: row.username, fullName: row.full_name, avatarUrl: row.avatar_url } : undefined,
    content: row.content,
    mediaUrl: row.media_url,
    mediaType: row.media_type, // photo | video | audio | null
    privacy: row.privacy,
    likesCount: row.likes_count !== undefined ? Number(row.likes_count) : undefined,
    commentsCount: row.comments_count !== undefined ? Number(row.comments_count) : undefined,
    likedByMe: row.liked_by_me !== undefined ? Boolean(row.liked_by_me) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para realizar esta accion' });
    return false;
  }
  return true;
}

/**
 * Replica el adjunto de una publicacion en la tabla `media`, para que
 * aparezca en las secciones Fotos / Videos / Audios del menu lateral.
 */
async function registrarEnGaleria({ userId, postId, type, url, caption }) {
  await pool.query(
    `INSERT INTO media (user_id, post_id, type, url, caption) VALUES ($1, $2, $3, $4, $5)`,
    [userId, postId, type, url, (caption || '').slice(0, 280)]
  );
}

async function crear(req, res) {
  if (!requireAuth(req, res)) return;
  const { content, privacy } = req.body;
  const mediaUrl = req.file ? `/uploads/posts/${req.file.filename}` : null;
  const mediaType = req.file ? req.file.mediaType : null; // photo | video | audio (lo calculo el middleware)

  if (!content && !mediaUrl) {
    return res.status(400).json({ ok: false, error: 'La publicacion necesita texto, una foto, un video o un audio' });
  }

  const result = await pool.query(
    `INSERT INTO posts (user_id, content, media_url, media_type, privacy)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'public'))
     RETURNING *`,
    [req.userId, content || '', mediaUrl, mediaType, privacy]
  );

  const postRow = result.rows[0];

  if (mediaUrl) {
    await registrarEnGaleria({ userId: req.userId, postId: postRow.id, type: mediaType, url: mediaUrl, caption: content });
  }

  const post = mapPost(postRow);
  // Tiempo real: avisamos a todos los conectados que hay una publicacion nueva
  // (en una red social real esto se filtraria a amigos, aqui se simplifica)
  emitToAll('post:nuevo', post);
  if (mediaUrl) emitToAll('media:nuevo', { type: mediaType, userId: req.userId });

  res.status(201).json({ ok: true, post });
}

async function actualizar(req, res) {
  if (!requireAuth(req, res)) return;
  const { id, content, privacy } = req.body;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta el id de la publicacion' });

  const existing = await pool.query('SELECT * FROM posts WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada' });
  if (existing.rows[0].user_id !== req.userId) {
    return res.status(403).json({ ok: false, error: 'No puedes editar publicaciones de otro usuario' });
  }

  const nuevoAdjunto = !!req.file;
  const mediaUrl = nuevoAdjunto ? `/uploads/posts/${req.file.filename}` : existing.rows[0].media_url;
  const mediaType = nuevoAdjunto ? req.file.mediaType : existing.rows[0].media_type;

  const result = await pool.query(
    `UPDATE posts SET content = COALESCE($1, content), media_url = $2, media_type = $3, privacy = COALESCE($4, privacy)
     WHERE id = $5 RETURNING *`,
    [content, mediaUrl, mediaType, privacy, id]
  );

  if (nuevoAdjunto) {
    await registrarEnGaleria({ userId: req.userId, postId: id, type: mediaType, url: mediaUrl, caption: content });
  }

  const post = mapPost(result.rows[0]);
  emitToAll('post:actualizado', post);
  res.json({ ok: true, post });
}

async function borrar(req, res) {
  if (!requireAuth(req, res)) return;
  const id = req.body.id || req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta el id de la publicacion' });

  const existing = await pool.query('SELECT * FROM posts WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'Publicacion no encontrada' });
  if (existing.rows[0].user_id !== req.userId) {
    return res.status(403).json({ ok: false, error: 'No puedes borrar publicaciones de otro usuario' });
  }

  await pool.query('UPDATE posts SET deleted_at = NOW() WHERE id = $1', [id]);
  // El adjunto tambien desaparece de las galerias Fotos/Videos/Audios
  await pool.query('UPDATE media SET deleted_at = NOW() WHERE post_id = $1', [id]);
  emitToAll('post:borrado', { id });
  res.json({ ok: true, message: 'Publicacion eliminada' });
}

async function listar(req, res) {
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { userId, page = 1, limit = 10 } = source;
  const offset = (Number(page) - 1) * Number(limit);
  const viewerId = req.userId || null;

  const params = [viewerId, Number(limit), offset];
  let where = 'WHERE p.deleted_at IS NULL';

  if (userId) {
    params.push(userId);
    where += ` AND p.user_id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT p.*, u.username, u.full_name, u.avatar_url,
            (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes_count,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comments_count,
            EXISTS(SELECT 1 FROM likes l2 WHERE l2.post_id = p.id AND l2.user_id = $1) AS liked_by_me
     FROM posts p
     JOIN users u ON u.id = p.user_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  );

  res.json({ ok: true, posts: result.rows.map(mapPost) });
}

/**
 * Punto de entrada unico: recibe la peticion y despacha segun la accion.
 */
async function handlePostAction(req, res, next) {
  try {
    const action = (req.body.action || req.query.action || '').toLowerCase();

    switch (action) {
      case 'crear':
        return await crear(req, res);
      case 'actualizar':
        return await actualizar(req, res);
      case 'borrar':
        return await borrar(req, res);
      case 'listar':
        return await listar(req, res);
      default:
        return res.status(400).json({
          ok: false,
          error: 'Accion no valida. Usa: crear | actualizar | borrar | listar'
        });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { handlePostAction };
