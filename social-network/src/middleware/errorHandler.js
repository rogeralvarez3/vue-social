/**
 * Manejador de errores centralizado.
 * Captura errores de Multer, errores de validacion y errores generales,
 * evitando exponer detalles internos (stack traces) al cliente en produccion.
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);

  const esErrorDeArchivo =
    err.name === 'MulterError' ||
    /no permitido|Formato no soportado|No se pudo procesar el video/.test(err.message);

  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      ok: false,
      error: 'El archivo es demasiado grande. Prueba con uno más ligero o de menor duración.'
    });
  }

  if (esErrorDeArchivo) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';

  res.status(status).json({
    ok: false,
    error: isProd && status === 500 ? 'Error interno del servidor' : err.message
  });
}

module.exports = errorHandler;
