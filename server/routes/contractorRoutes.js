const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/contractorController');
const { verifyToken, authorizeRole, authorizePembangunanAccess } = require('../middleware/authMiddleware');
const { handleBulkUpload } = require('../middleware/uploadMiddleware');

router.use(verifyToken);

router.get('/', ctrl.getAllContractors);
router.get('/:id', ctrl.getContractorById);
router.post('/', authorizePembangunanAccess(), handleBulkUpload('media', 1, 'contractors'), ctrl.createContractor);
router.put('/:id', authorizePembangunanAccess(), handleBulkUpload('media', 1, 'contractors'), ctrl.updateContractor);
router.delete('/:id', authorizeRole(['SUPER_ADMIN']), ctrl.deleteContractor);

module.exports = router;
