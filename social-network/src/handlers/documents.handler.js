/**
 * HANDLER DE DOCUMENTOS
 * action = crear | borrar | listar
 */
const { pool } = require('../config/db');

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para realizar esta accion' });
    return false;
  }
  return true;
}

function mapDocument(row) {
  return {
    id: row.id,
    userId: row.user_id,
    author: row.username ? { username: row.username, fullName: row.full_name } : undefined,
    filename: row.filename,
    url: row.url,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes !== undefined ? Number(row.size_bytes) : undefined,
    createdAt: row.created_at
  };
}

async function crear(req, res) {
  if (!requireAuth(req, res)) return;
  if (!req.file) return res.status(400).json({ ok: false, error: 'Debes adjuntar un archivo' });

  const url = `/uploads/documents/${req.file.filename}`;

  const result = await pool.query(
    `INSERT INTO documents (user_id, filename, url, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.userId, req.file.originalname, url, req.file.mimetype, req.file.size]
  );

  res.status(201).json({ ok: true, document: mapDocument(result.rows[0]) });
}

async function borrar(req, res) {
  if (!requireAuth(req, res)) return;
  const id = req.body.id || req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta el id' });

  const existing = await pool.query('SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'No encontrado' });
  if (existing.rows[0].user_id !== req.userId) {
    return res.status(403).json({ ok: false, error: 'No puedes borrar documentos de otro usuario' });
  }

  await pool.query('UPDATE documents SET deleted_at = NOW() WHERE id = $1', [id]);
  res.json({ ok: true, message: 'Documento eliminado' });
}

async function listar(req, res) {
  if (!requireAuth(req, res)) return;
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { userId, page = 1, limit = 20 } = source;
  const offset = (Number(page) - 1) * Number(limit);

  const objetivo = userId || req.userId;
  const result = await pool.query(
    `SELECT d.*, u.username, u.full_name
     FROM documents d JOIN users u ON u.id = d.user_id
     WHERE d.deleted_at IS NULL AND d.user_id = $1
     ORDER BY d.created_at DESC
     LIMIT $2 OFFSET $3`,
    [objetivo, Number(limit), offset]
  );

  res.json({ ok: true, documents: result.rows.map(mapDocument) });
}

async function handleDocumentAction(req, res, next) {
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

module.exports = { handleDocumentAction };
