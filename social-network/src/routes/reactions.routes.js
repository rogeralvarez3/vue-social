const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { handleReactionAction } = require('../handlers/reactions.handler');

const router = express.Router();

router.post('/', optionalAuth, handleReactionAction);
router.get('/', optionalAuth, handleReactionAction);

module.exports = router;
