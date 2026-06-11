const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, authorizeRole, authorizeSarprasAdmin } = require('../middleware/authMiddleware');

router.get('/', verifyToken, userController.getAllUsers);
router.get('/staff', verifyToken, authorizeSarprasAdmin(), userController.getSarprasStaff);
router.get('/unit-admins', verifyToken, userController.getUnitAdmins);
router.get('/profile', verifyToken, userController.getProfile);
router.put('/profile', verifyToken, userController.updateProfile);
router.post('/', verifyToken, authorizeRole(['SUPER_ADMIN', 'KABID_SARPRAS']), userController.createUser);
router.put('/:id', verifyToken, authorizeRole(['SUPER_ADMIN', 'KABID_SARPRAS']), userController.updateUser);
router.delete('/:id', verifyToken, authorizeRole(['SUPER_ADMIN', 'KABID_SARPRAS']), userController.deleteUser);

// Temporary patch route to fix legacy KABID_SARPRAS role
router.get('/patch/kabid-role', async (req, res) => {
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const result = await prisma.user.updateMany({
            where: { position: 'Kepala Bidang Sarana' },
            data: { role: 'SUPER_ADMIN' }
        });
        res.json({ message: 'Success! Role Kepala Bidang Sarana telah diubah menjadi SUPER_ADMIN di database.', affected: result.count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
