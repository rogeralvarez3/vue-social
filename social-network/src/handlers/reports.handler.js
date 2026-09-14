/**
 * HANDLER DE REPORTES
 * action = listar
 * Parametros: recurso = "reacciones" | "comentarios" | "publicaciones" | "amigos"
 *             periodo = "dia" | "semana" | "mes"
 *             desde, hasta (opcionales, ISO date) - por defecto ultimos 30/12/6 segun periodo
 *
 * Devuelve series listas para graficar: [{ periodo: '2026-09-01', total: 12 }, ...]
 * Todo se calcula sobre los datos del usuario autenticado (sus propias
 * publicaciones/comentarios/reacciones recibidas y sus amistades).
 */
const { pool } = require('../config/db');

function requireAuth(req, res) {
  if (!req.userId) {
    res.status(401).json({ ok: false, error: 'Debes iniciar sesion para ver los reportes' });
    return false;
  }
  return true;
}

const TRUNC_POR_PERIODO = { dia: 'day', semana: 'week', mes: 'month' };

function rangoPorDefecto(periodo) {
  const hasta = new Date();
  const desde = new Date();
  if (periodo === 'dia') desde.setDate(desde.getDate() - 30);
  else if (periodo === 'semana') desde.setDate(desde.getDate() - 7 * 12);
  else desde.setMonth(desde.getMonth() - 6);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

async function reaccionesPorPeriodo(userId, trunc, desde, hasta) {
  const result = await pool.query(
    `SELECT date_trunc($1, r.created_at) AS periodo, r.type, COUNT(*) AS total
     FROM reactions r
     JOIN posts p ON p.id = r.post_id
     WHERE p.user_id = $2 AND r.created_at BETWEEN $3 AND $4
     GROUP BY periodo, r.type
     ORDER BY periodo ASC`,
    [trunc, userId, desde, hasta]
  );
  return result.rows;
}

async function comentariosPorPeriodo(userId, trunc, desde, hasta) {
  const result = await pool.query(
    `SELECT date_trunc($1, c.created_at) AS periodo, COUNT(*) AS total
     FROM comments c
     JOIN posts p ON p.id = c.post_id
     WHERE p.user_id = $2 AND c.deleted_at IS NULL AND c.created_at BETWEEN $3 AND $4
     GROUP BY periodo
     ORDER BY periodo ASC`,
    [trunc, userId, desde, hasta]
  );
  return result.rows;
}

async function publicacionesPorPeriodo(userId, trunc, desde, hasta) {
  const result = await pool.query(
    `SELECT date_trunc($1, created_at) AS periodo, COUNT(*) AS total
     FROM posts
     WHERE user_id = $2 AND deleted_at IS NULL AND created_at BETWEEN $3 AND $4
     GROUP BY periodo
     ORDER BY periodo ASC`,
    [trunc, userId, desde, hasta]
  );
  return result.rows;
}

async function amigosPorPeriodo(userId, trunc, desde, hasta) {
  const result = await pool.query(
    `SELECT date_trunc($1, updated_at) AS periodo, COUNT(*) AS total
     FROM friendships
     WHERE (requester_id = $2 OR addressee_id = $2) AND status = 'accepted'
       AND updated_at BETWEEN $3 AND $4
     GROUP BY periodo
     ORDER BY periodo ASC`,
    [trunc, userId, desde, hasta]
  );
  return result.rows;
}

async function listar(req, res) {
  if (!requireAuth(req, res)) return;
  const source = Object.keys(req.query).length ? req.query : req.body;
  const { recurso = 'publicaciones', periodo = 'dia' } = source;

  const trunc = TRUNC_POR_PERIODO[periodo];
  if (!trunc) return res.status(400).json({ ok: false, error: 'periodo debe ser: dia | semana | mes' });

  const defaults = rangoPorDefecto(periodo);
  const desde = source.desde || defaults.desde;
  const hasta = source.hasta || defaults.hasta;

  let filas;
  switch (recurso) {
    case 'reacciones':
      filas = await reaccionesPorPeriodo(req.userId, trunc, desde, hasta);
      return res.json({
        ok: true,
        recurso,
        periodo,
        // Para reacciones devolvemos ademas el desglose por tipo (like, love, etc.)
        serie: agregarSimple(filas),
        porTipo: filas
      });
    case 'comentarios':
      filas = await comentariosPorPeriodo(req.userId, trunc, desde, hasta);
      break;
    case 'publicaciones':
      filas = await publicacionesPorPeriodo(req.userId, trunc, desde, hasta);
      break;
    case 'amigos':
      filas = await amigosPorPeriodo(req.userId, trunc, desde, hasta);
      break;
    default:
      return res.status(400).json({ ok: false, error: 'recurso debe ser: reacciones | comentarios | publicaciones | amigos' });
  }

  res.json({ ok: true, recurso, periodo, serie: agregarSimple(filas) });
}

function agregarSimple(filas) {
  const mapa = new Map();
  filas.forEach(f => {
    const key = f.periodo.toISOString ? f.periodo.toISOString() : f.periodo;
    mapa.set(key, (mapa.get(key) || 0) + Number(f.total));
  });
  return Array.from(mapa.entries()).map(([periodo, total]) => ({ periodo, total }));
}

/**
 * Resumen general (tarjetas superiores del dashboard de reportes):
 * totales acumulados de los ultimos 30 dias.
 */
async function resumen(req, res) {
  if (!requireAuth(req, res)) return;
  const desde = new Date();
  desde.setDate(desde.getDate() - 30);

  const [posts, comments, reactions, friends] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM posts WHERE user_id = $1 AND deleted_at IS NULL AND created_at >= $2', [req.userId, desde]),
    pool.query(
      `SELECT COUNT(*) FROM comments c JOIN posts p ON p.id = c.post_id
       WHERE p.user_id = $1 AND c.deleted_at IS NULL AND c.created_at >= $2`,
      [req.userId, desde]
    ),
    pool.query(
      `SELECT COUNT(*) FROM reactions r JOIN posts p ON p.id = r.post_id
       WHERE p.user_id = $1 AND r.created_at >= $2`,
      [req.userId, desde]
    ),
    pool.query(
      `SELECT COUNT(*) FROM friendships
       WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted' AND updated_at >= $2`,
      [req.userId, desde]
    )
  ]);

  res.json({
    ok: true,
    resumen: {
      publicaciones: Number(posts.rows[0].count),
      comentarios: Number(comments.rows[0].count),
      reacciones: Number(reactions.rows[0].count),
      nuevosAmigos: Number(friends.rows[0].count)
    }
  });
}

async function handleReportAction(req, res, next) {
  try {
    const action = (req.body.action || req.query.action || 'listar').toLowerCase();
    switch (action) {
      case 'listar': return await listar(req, res);
      case 'resumen': return await resumen(req, res);
      default:
        return res.status(400).json({ ok: false, error: 'Accion no valida. Usa: listar | resumen' });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { handleReportAction };
