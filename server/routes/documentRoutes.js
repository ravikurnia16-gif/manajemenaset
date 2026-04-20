const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { requireAuth } = require('../middleware/auth');

// Apply auth to all routes in this file
router.use(requireAuth);

router.get('/', documentController.getAllDocuments);
router.post('/', documentController.createDocument);
router.put('/:id/status', documentController.updateDocumentStatus);

module.exports = router;
