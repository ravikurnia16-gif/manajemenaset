const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/vehicleChecklistController');

const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, checklistController.getChecklists);
router.post('/', authenticateToken, checklistController.createChecklist);

module.exports = router;
