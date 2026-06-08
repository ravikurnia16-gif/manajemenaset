const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

// PUBLIC ROUTES
router.get('/active-questions', surveyController.getActiveQuestions);
router.post('/submit', surveyController.submitSurvey);

// ADMIN ROUTES (Requires Login & Role)
const adminRoles = ['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS'];

router.get('/stats', verifyToken, authorizeRole(adminRoles), surveyController.getSurveyStats);
router.get('/responses', verifyToken, authorizeRole(adminRoles), surveyController.getSurveyResponses);

router.get('/questions', verifyToken, authorizeRole(adminRoles), surveyController.getQuestionsAdmin);
router.post('/questions', verifyToken, authorizeRole(adminRoles), surveyController.createQuestion);
router.put('/questions/:id', verifyToken, authorizeRole(adminRoles), surveyController.updateQuestion);
router.delete('/questions/:id', verifyToken, authorizeRole(adminRoles), surveyController.deleteQuestion);

module.exports = router;
