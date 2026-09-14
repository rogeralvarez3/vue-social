const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleMessageAction } = require('../handlers/messages.handler');

const router = express.Router();

router.post('/', authenticate, handleMessageAction);
router.get('/', authenticate, handleMessageAction);

module.exports = router;
