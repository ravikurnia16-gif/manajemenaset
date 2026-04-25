const router = require('express').Router();
const ctrl = require('../controllers/officeDocumentController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

// Public verification endpoint (no auth needed)
router.get('/verify/:uuid', ctrl.verifyDocument);

// All other routes require authentication
router.use(verifyToken);

// Statistics
router.get('/stats', ctrl.getStats);

// Category codes
router.get('/categories', ctrl.getCategories);

// Surat Masuk (Incoming Mail)
router.get('/incoming', ctrl.getIncomingMail);
router.post('/incoming', ctrl.createIncomingMail);

// Surat Keluar / BAST / MOU (Outgoing Documents)
router.get('/outgoing', ctrl.getOutgoingDocuments);
router.post('/outgoing', ctrl.createOutgoingDocument);

// Single document operations
router.get('/:id', ctrl.getDocumentById);
router.put('/:id', ctrl.updateDocument);
router.delete('/:id', ctrl.deleteDocument);

// Workflow
router.post('/:id/submit', ctrl.submitForApproval);
router.post('/:id/approve',
    authorizeRole(['SUPER_ADMIN', 'KABID_SARPRAS']),
    ctrl.approveAndSign
);
router.post('/:id/reject',
    authorizeRole(['SUPER_ADMIN', 'KABID_SARPRAS']),
    ctrl.rejectDocument
);

// Multi-party signing (BAST/MOU)
router.post('/:id/sign-party', ctrl.signAsParty);

// PDF generation
router.get('/:id/pdf', ctrl.generatePDF);

module.exports = router;
