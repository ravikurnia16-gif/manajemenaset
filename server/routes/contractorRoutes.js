const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/contractorController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const { handleBulkUpload } = require('../middleware/uploadMiddleware');

router.use(verifyToken);

router.get('/', ctrl.getAllContractors);
router.get('/:id', ctrl.getContractorById);
router.post('/', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG']), handleBulkUpload('media', 1, 'contractors'), ctrl.createContractor);
router.put('/:id', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG']), handleBulkUpload('media', 1, 'contractors'), ctrl.updateContractor);
router.delete('/:id', authorizeRole(['SUPER_ADMIN']), ctrl.deleteContractor);

module.exports = router;
