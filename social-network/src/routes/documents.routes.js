const express = require('express');
const { authenticate } = require('../middleware/auth');
const { uploadDocument } = require('../middleware/upload');
const { handleDocumentAction } = require('../handlers/documents.handler');

const router = express.Router();

router.post('/', authenticate, uploadDocument.single('file'), handleDocumentAction);
router.get('/', authenticate, handleDocumentAction);

module.exports = router;
