const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { verifyToken } = require('../middleware/authMiddleware');

// Apply auth to all routes in this file
router.use(verifyToken);

router.get('/', documentController.getAllDocuments);
router.post('/', documentController.createDocument);
router.post('/:id/submit', documentController.submitDocument);
router.post('/:id/approve', documentController.approveDocument);
router.post('/:id/reject', documentController.rejectDocument);

module.exports = router;
