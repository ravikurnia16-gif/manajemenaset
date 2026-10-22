const express = require('express');
const { register, login, changePassword, getDevRoles, devLogin } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.put('/change-password', verifyToken, changePassword);

// DEV ONLY: Helper endpoints for localhost quick role testing
router.get('/dev-roles', getDevRoles);
router.post('/dev-login', devLogin);

module.exports = router;
