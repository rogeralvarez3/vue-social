const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { handleLikeAction } = require('../handlers/likes.handler');

const router = express.Router();

router.post('/', optionalAuth, handleLikeAction);
router.get('/', optionalAuth, handleLikeAction);

module.exports = router;
