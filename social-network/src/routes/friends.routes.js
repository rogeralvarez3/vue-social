const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleFriendAction } = require('../handlers/friends.handler');

const router = express.Router();

// Las amistades siempre requieren sesion iniciada
router.post('/', authenticate, handleFriendAction);
router.get('/', authenticate, handleFriendAction);

module.exports = router;
