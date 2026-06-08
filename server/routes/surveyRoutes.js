const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// PUBLIC ROUTES
router.get('/active-questions', surveyController.getActiveQuestions);
router.post('/submit', surveyController.submitSurvey);

// ADMIN ROUTES (Requires Login & Role)
const adminRoles = ['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS'];

router.get('/stats', verifyToken, authorizeRoles(...adminRoles), surveyController.getSurveyStats);
router.get('/responses', verifyToken, authorizeRoles(...adminRoles), surveyController.getSurveyResponses);

router.get('/questions', verifyToken, authorizeRoles(...adminRoles), surveyController.getQuestionsAdmin);
router.post('/questions', verifyToken, authorizeRoles(...adminRoles), surveyController.createQuestion);
router.put('/questions/:id', verifyToken, authorizeRoles(...adminRoles), surveyController.updateQuestion);
router.delete('/questions/:id', verifyToken, authorizeRoles(...adminRoles), surveyController.deleteQuestion);

module.exports = router;
