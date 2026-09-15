const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { uploadProfileImages, procesarImagenesPerfil } = require('../middleware/upload');
const { handleUserAction } = require('../handlers/users.handler');

const router = express.Router();

// "listar" (buscar/ver perfiles) puede usarse sin sesion; actualizar/borrar exigen auth
// dentro del propio handler (requireAuth) para mantener una unica puerta de entrada.
router.post('/', optionalAuth, uploadProfileImages, procesarImagenesPerfil('avatars'), handleUserAction);
router.get('/', optionalAuth, handleUserAction);

module.exports = router;
