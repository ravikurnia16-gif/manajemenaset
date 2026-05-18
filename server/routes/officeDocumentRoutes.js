const router = require('express').Router();
const ctrl = require('../controllers/officeDocumentController');
const { verifyToken, authorizeRole, authorizeEOfficeAccess } = require('../middleware/authMiddleware');
const { handleUpload, handleBulkUpload } = require('../middleware/uploadMiddleware');

// Public verification endpoint (no auth needed)
router.get('/verify/:uuid', ctrl.verifyDocument);
router.get('/verify/:uuid/pdf', ctrl.generatePublicPDF);

// All other routes require authentication and Sarpras/Admin access
router.use(verifyToken);
router.use(authorizeEOfficeAccess());

// Statistics
router.get('/stats', ctrl.getStats);

// Category codes
router.get('/categories', ctrl.getCategories);

// Docx extraction
router.post('/extract-docx', handleBulkUpload('files', 1, 'e-office/temp'), ctrl.extractDocx);

// Internal Users for WA sending
router.get('/internal-users', ctrl.getInternalUsers);

// Surat Masuk (Incoming Mail)
router.get('/incoming', ctrl.getIncomingMail);
router.post('/incoming', handleBulkUpload('files', 5, 'e-office/surat-masuk'), ctrl.createIncomingMail);

// Surat Keluar / BAST / MOU (Outgoing Documents)
router.get('/outgoing', ctrl.getOutgoingDocuments);
router.post('/outgoing', handleBulkUpload('files', 5, 'e-office/surat-keluar'), ctrl.createOutgoingDocument);

// Single document operations
router.get('/:id', ctrl.getDocumentById);
router.put('/:id', handleBulkUpload('files', 5, 'e-office'), ctrl.updateDocument);
router.put('/:id/final-file', handleBulkUpload('files', 1, 'e-office/final'), ctrl.uploadFinalFile);
router.delete('/:id', authorizeRole(['SUPER_ADMIN']), ctrl.deleteDocument);

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

// Invoice Payment Status
router.patch('/:id/payment-status', ctrl.updatePaymentStatus);

// Order Status & Deadline (Pesanan category - bypasses draft constraint)
router.patch('/:id/order-status', ctrl.updateOrderStatus);

router.post('/:id/send-wa', ctrl.sendInvoiceWA);

// Send document via WhatsApp (generic, for all document types)
router.post('/:id/send-doc-wa', ctrl.sendDocumentWA);

// PDF generation
router.get('/:id/pdf', ctrl.generatePDF);

// TTE Asset Download
router.get('/:id/tte-asset', ctrl.downloadTTEAsset);

module.exports = router;

