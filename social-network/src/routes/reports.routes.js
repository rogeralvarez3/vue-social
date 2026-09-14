const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleReportAction } = require('../handlers/reports.handler');

const router = express.Router();

router.post('/', authenticate, handleReportAction);
router.get('/', authenticate, handleReportAction);

module.exports = router;
