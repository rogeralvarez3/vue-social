const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { uploadGroupCover, procesarImagenSubida } = require('../middleware/upload');
const { handleGroupAction } = require('../handlers/groups.handler');

const router = express.Router();

router.post('/', optionalAuth, uploadGroupCover.single('cover'), procesarImagenSubida('groups'), handleGroupAction);
router.get('/', optionalAuth, handleGroupAction);

module.exports = router;
