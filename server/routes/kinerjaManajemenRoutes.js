const express = require('express');
const router = express.Router();
const kinerjaController = require('../controllers/kinerjaManajemenController');
const { verifyToken } = require('../middleware/authMiddleware');

// Middleware: Khusus Kepala Bidang Sarana & Admin Aset
const authorizeKabidSaranaStrict = (req, res, next) => {
    const pos = (req.user?.position || '').toLowerCase();
    const role = req.user?.role || '';
    const isAuthorized = pos.includes('kepala bidang sarana') || 
                         pos.includes('admin aset') || 
                         pos.includes('manajemen aset') ||
                         role === 'KABID_SARPRAS' || 
                         role === 'ADMIN_ASET' || 
                         role === 'SUPER_ADMIN';

    if (!isAuthorized) {
        return res.status(403).json({ 
            success: false, 
            error: 'Akses terbatas untuk Kepala Bidang Sarana dan Admin Aset.' 
        });
    }
    next();
};

// Middleware: Khusus Posisi Kepala Bidang Sarana (untuk MBE dan OKR)
const authorizeKabidOnly = (req, res, next) => {
    const pos = (req.user?.position || '').toLowerCase();
    const isKabid = pos.includes('kepala bidang sarana');

    if (!isKabid) {
        return res.status(403).json({ 
            success: false, 
            error: 'Akses fitur MBE dan OKR hanya untuk position Kepala Bidang Sarana.' 
        });
    }
    next();
};

router.use(verifyToken);
router.use(authorizeKabidSaranaStrict);

// 1. Radar Pengecualian / Management by Exception
router.get('/mbe-radar', authorizeKabidOnly, kinerjaController.getMbeRadar);

// 2. Papan PPP Harian (Progress, Plans, Problems)
router.get('/daily-ppp', kinerjaController.getDailyPpp);

// 3. Evaluasi Siklus Mingguan PDCA (Plan, Do, Check, Act)
router.get('/weekly-pdca', kinerjaController.getWeeklyPdca);

// 4. Dashboard OKR (Objectives and Key Results)
router.get('/okr', authorizeKabidOnly, kinerjaController.getOkrDashboard);
router.post('/okr', authorizeKabidOnly, kinerjaController.saveOkr);

// 5. Rencana & Penugasan Staf
router.get('/staff-plans', kinerjaController.getStaffPlansAndAssignments);
router.post('/plans', kinerjaController.saveStaffPlan);
router.put('/plans/:id', kinerjaController.saveStaffPlan);
router.put('/plans/:id/item', kinerjaController.updatePlanItemStatus);
router.delete('/plans/:id', kinerjaController.deleteStaffPlan);
router.post('/assign', kinerjaController.createAssignmentFromPlan);
router.put('/assignments/:id/item', kinerjaController.updateAssignmentItemStatus);

// 6. Input Laporan Harian Terpadu PPP
router.post('/daily-report', kinerjaController.saveDailyReportFromPpp);

module.exports = router;
