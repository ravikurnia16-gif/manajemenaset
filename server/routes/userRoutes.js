const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), userController.getAllUsers);
router.post('/', verifyToken, authorizeRole(['SUPER_ADMIN']), userController.createUser);
router.put('/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), userController.updateUser);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN']), userController.deleteUser);

module.exports = router;
