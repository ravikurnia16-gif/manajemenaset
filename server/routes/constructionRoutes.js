const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/constructionController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const { handleBulkUpload } = require('../middleware/uploadMiddleware');

router.use(verifyToken);

router.get('/stats', ctrl.getStats);
router.get('/projects', ctrl.getAllProjects);
router.get('/projects/:id', ctrl.getProjectById);
router.post('/projects', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG']), handleBulkUpload('media', 5, 'construction'), ctrl.createProject);
router.put('/projects/:id', authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG']), handleBulkUpload('media', 5, 'construction'), ctrl.updateProject);
router.delete('/projects/:id', authorizeRole(['SUPER_ADMIN']), ctrl.deleteProject);

module.exports = router;
