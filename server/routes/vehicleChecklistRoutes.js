const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/vehicleChecklistController');

const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, checklistController.getChecklists);
router.post('/', verifyToken, checklistController.createChecklist);

module.exports = router;
