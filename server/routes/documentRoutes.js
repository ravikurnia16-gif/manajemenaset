const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { verifyToken } = require('../middleware/authMiddleware');

// Apply auth to all routes in this file
router.use(verifyToken);

// --- DOCUMENT (SURAT KELUAR) ---
router.get('/', documentController.getAllDocuments);
router.post('/', documentController.createDocument);
router.get('/:id', documentController.getDocument);
router.put('/:id', documentController.updateDocument);
router.delete('/:id', documentController.deleteDocument);
router.post('/:id/submit', documentController.submitDocument);
router.post('/:id/approve', documentController.approveDocument);
router.post('/:id/reject', documentController.rejectDocument);

// --- QR VALIDATION (Public-ish, but still needs token for now) ---
router.get('/validate/:hash', documentController.validateDocumentQR);

// --- SIGNATURE ---
router.get('/signature/me', documentController.getMySignature);
router.post('/signature/upload', documentController.uploadSignature);

// --- INCOMING MAIL (SURAT MASUK) ---
router.get('/incoming-mail/all', documentController.getAllIncomingMail);
router.post('/incoming-mail', documentController.createIncomingMail);
router.put('/incoming-mail/:id', documentController.updateIncomingMail);
router.delete('/incoming-mail/:id', documentController.deleteIncomingMail);

module.exports = router;
