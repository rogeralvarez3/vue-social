const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleNotificationAction } = require('../handlers/notifications.handler');

const router = express.Router();

router.post('/', authenticate, handleNotificationAction);
router.get('/', authenticate, handleNotificationAction);

module.exports = router;
