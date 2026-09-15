/**
 * HANDLER DE GRUPOS
 * action = crear | actualizar | borrar | listar
 * Acciones adicionales sobre miembros se manejan con sub-acciones:
 *   action = "unirse" | "salir"
 */
const { pool } = require('../config/db');

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para realizar esta accion' });
    return false;
  }
  return true;
}

function mapGroup(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    coverUrl: row.cover_url,
    privacy: row.privacy,
    ownerId: row.owner_id,
    membersCount: row.members_count !== undefined ? Number(row.members_count) : undefined,
    isMember: row.is_member !== undefined ? Boolean(row.is_member) : undefined,
    createdAt: row.created_at
  };
}

async function crear(req, res) {
  if (!requireAuth(req, res)) return;
  const { name, description, privacy } = req.body;
  const coverUrl = req.file ? `/uploads/groups/${req.file.filename}` : null;

  if (!name) return res.status(400).json({ ok: false, error: 'El nombre del grupo es obligatorio' });

  const result = await pool.query(
    `INSERT INTO groups (name, description, cover_url, privacy, owner_id)
     VALUES ($1, $2, $3, COALESCE($4, 'public'), $5) RETURNING *`,
    [name, description || '', coverUrl, privacy, req.userId]
  );

  await pool.query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin')`,
    [result.rows[0].id, req.userId]
  );

  res.status(201).json({ ok: true, group: mapGroup(result.rows[0]) });
}

async function actualizar(req, res) {
  if (!requireAuth(req, res)) return;
  const { id, name, description, privacy, unirse, salir } = req.body;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta el id del grupo' });

  // Unirse / salir del grupo (accion secundaria dentro de "actualizar")
  if (unirse) {
    await pool.query(
      `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, req.userId]
    );
    return res.json({ ok: true, message: 'Te uniste al grupo' });
  }
  if (salir) {
    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.userId]);
    return res.json({ ok: true, message: 'Saliste del grupo' });
  }

  const existing = await pool.query('SELECT * FROM groups WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
  if (existing.rows[0].owner_id !== req.userId) {
    return res.status(403).json({ ok: false, error: 'Solo el propietario puede editar el grupo' });
  }

  const coverUrl = req.file ? `/uploads/groups/${req.file.filename}` : existing.rows[0].cover_url;

  const result = await pool.query(
    `UPDATE groups SET name = COALESCE($1, name), description = COALESCE($2, description),
        cover_url = $3, privacy = COALESCE($4, privacy)
     WHERE id = $5 RETURNING *`,
    [name, description, coverUrl, privacy, id]
  );

  res.json({ ok: true, group: mapGroup(result.rows[0]) });
}

async function borrar(req, res) {
  if (!requireAuth(req, res)) return;
  const id = req.body.id || req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta el id del grupo' });

  const existing = await pool.query('SELECT * FROM groups WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
  if (existing.rows[0].owner_id !== req.userId) {
    return res.status(403).json({ ok: false, error: 'Solo el propietario puede eliminar el grupo' });
  }

  await pool.query('UPDATE groups SET deleted_at = NOW() WHERE id = $1', [id]);
  res.json({ ok: true, message: 'Grupo eliminado' });
}

async function listar(req, res) {
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { q, id, page = 1, limit = 20 } = source;
  const viewerId = req.userId || null;

  if (id) {
    const result = await pool.query(
      `SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
              EXISTS(SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = $2) AS is_member
       FROM groups g WHERE g.id = $1 AND g.deleted_at IS NULL`,
      [id, viewerId]
    );
    if (result.rows.length === 0) return res.status(404).json({ ok: false, error: 'Grupo no encontrado' });
    return res.json({ ok: true, group: mapGroup(result.rows[0]) });
  }

  const offset = (Number(page) - 1) * Number(limit);
  const result = await pool.query(
    `SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
            EXISTS(SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = $1) AS is_member
     FROM groups g
     WHERE g.deleted_at IS NULL AND ($2::text IS NULL OR g.name ILIKE '%' || $2 || '%')
     ORDER BY g.created_at DESC
     LIMIT $3 OFFSET $4`,
    [viewerId, q || null, Number(limit), offset]
  );

  res.json({ ok: true, groups: result.rows.map(mapGroup) });
}

async function handleGroupAction(req, res, next) {
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

module.exports = { handleGroupAction };
