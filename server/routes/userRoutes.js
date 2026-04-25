const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, authorizeRole, authorizeSarprasAdmin } = require('../middleware/authMiddleware');

router.get('/', verifyToken, userController.getAllUsers);
router.get('/staff', verifyToken, authorizeSarprasAdmin(), userController.getSarprasStaff);
router.get('/profile', verifyToken, userController.getProfile);
router.put('/profile', verifyToken, userController.updateProfile);
router.post('/', verifyToken, authorizeRole(['SUPER_ADMIN']), userController.createUser);
router.put('/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), userController.updateUser);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), userController.deleteUser);

module.exports = router;
