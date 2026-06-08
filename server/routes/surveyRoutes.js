const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

// PUBLIC ROUTES
router.get('/active', surveyController.getActiveSurvey);
router.post('/submit', surveyController.submitSurvey);

// ADMIN ROUTES
const adminRoles = ['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS'];

// Stats & Responses
router.get('/stats', verifyToken, authorizeRole(adminRoles), surveyController.getSurveyStats);
router.get('/responses', verifyToken, authorizeRole(adminRoles), surveyController.getSurveyResponses);

// Survey Packages
router.get('/', verifyToken, authorizeRole(adminRoles), surveyController.getAllSurveys);
router.post('/', verifyToken, authorizeRole(adminRoles), surveyController.createSurvey);
router.put('/:id', verifyToken, authorizeRole(adminRoles), surveyController.updateSurvey);
router.delete('/:id', verifyToken, authorizeRole(adminRoles), surveyController.deleteSurvey);
router.post('/:id/duplicate', verifyToken, authorizeRole(adminRoles), surveyController.duplicateSurvey);

// Questions
router.get('/:surveyId/questions', verifyToken, authorizeRole(adminRoles), surveyController.getQuestionsBySurvey);
router.post('/questions', verifyToken, authorizeRole(adminRoles), surveyController.createQuestion);
router.put('/questions/:id', verifyToken, authorizeRole(adminRoles), surveyController.updateQuestion);
router.delete('/questions/:id', verifyToken, authorizeRole(adminRoles), surveyController.deleteQuestion);

module.exports = router;
