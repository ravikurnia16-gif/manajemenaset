const express = require('express');
const router = express.Router();
const sarprasFolderController = require('../controllers/sarprasFolderController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, sarprasFolderController.getAllFolders);
router.post('/', verifyToken, authorizeRole(['SUPER_ADMIN']), sarprasFolderController.createFolder);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), sarprasFolderController.deleteFolder);

module.exports = router;
