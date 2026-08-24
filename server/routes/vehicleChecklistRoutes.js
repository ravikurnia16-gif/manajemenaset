const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/vehicleChecklistController');

const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, checklistController.getChecklists);
router.get('/summary/missing', verifyToken, checklistController.getMissingChecklistsSummary);
router.post('/', verifyToken, checklistController.createChecklist);
router.post('/audit/trigger', verifyToken, checklistController.triggerChecklistAudit);

module.exports = router;
