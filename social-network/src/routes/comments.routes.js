const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { handleCommentAction } = require('../handlers/comments.handler');

const router = express.Router();

router.post('/', optionalAuth, handleCommentAction);
router.get('/', optionalAuth, handleCommentAction);

module.exports = router;
