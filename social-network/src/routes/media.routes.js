const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { uploadMedia, procesarMediaSubida } = require('../middleware/upload');
const { handleMediaAction } = require('../handlers/media.handler');

const router = express.Router();

router.post('/', optionalAuth, uploadMedia.single('file'), procesarMediaSubida('media'), handleMediaAction);
router.get('/', optionalAuth, handleMediaAction);

module.exports = router;
