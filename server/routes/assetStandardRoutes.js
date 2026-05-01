const express = require('express');
const router = express.Router();
const asc = require('../controllers/assetStandardController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

router.use(verifyToken);

// List and detail are accessible to all authenticated users for reference
router.get('/', asc.getAllStandards);
router.get('/:id', asc.getStandardById);

// Writing/Deleting restricted to Super Admin, Admin Aset, and Admin Unit
const writeAccess = authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'ADMIN_UNIT']);

router.post('/', writeAccess, handleUpload('image', 'standards'), asc.createStandard);
router.put('/:id', writeAccess, handleUpload('image', 'standards'), asc.updateStandard);
router.delete('/:id', writeAccess, asc.deleteStandard);

module.exports = router;
