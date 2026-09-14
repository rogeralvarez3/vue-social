/**
 * Una sola URL para crear, actualizar, borrar y listar publicaciones.
 * El body/query define: { action: 'crear' | 'actualizar' | 'borrar' | 'listar', ... }
 * El adjunto (foto, video o audio) viaja en el campo "media" del formulario;
 * el servidor detecta el tipo automaticamente y lo procesa (comprime/transcodifica).
 */
const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { uploadPostMedia, procesarMediaSubida } = require('../middleware/upload');
const { handlePostAction } = require('../handlers/posts.handler');

const router = express.Router();

// optionalAuth: permite listar publicaciones publicas sin sesion,
// pero identifica al usuario si hay token (para reacciones/borrar/editar)
router.post('/', optionalAuth, uploadPostMedia.single('media'), procesarMediaSubida('posts'), handlePostAction);

// Tambien se admite GET para "listar" (mas comodo para consumir desde el navegador)
router.get('/', optionalAuth, handlePostAction);

module.exports = router;
