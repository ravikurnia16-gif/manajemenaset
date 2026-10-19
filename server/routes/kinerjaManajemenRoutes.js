const express = require('express');
const router = express.Router();
const kinerjaController = require('../controllers/kinerjaManajemenController');
const { verifyToken } = require('../middleware/authMiddleware');

// Middleware: Khusus Kepala Bidang Sarana
const authorizeKabidSaranaStrict = (req, res, next) => {
    const pos = (req.user?.position || '').toLowerCase();
    const role = req.user?.role || '';
    const isKabidSarana = pos.includes('kepala bidang sarana') || role === 'KABID_SARPRAS' || role === 'SUPER_ADMIN';

    if (!isKabidSarana) {
        return res.status(403).json({ 
            success: false, 
            error: 'Akses terbatas eksklusif untuk jabatan Kepala Bidang Sarana.' 
        });
    }
    next();
};

router.use(verifyToken);
router.use(authorizeKabidSaranaStrict);

// 1. Radar Pengecualian / Management by Exception
router.get('/mbe-radar', kinerjaController.getMbeRadar);

// 2. Papan PPP Harian (Progress, Plans, Problems)
router.get('/daily-ppp', kinerjaController.getDailyPpp);

// 3. Evaluasi Siklus Mingguan PDCA (Plan, Do, Check, Act)
router.get('/weekly-pdca', kinerjaController.getWeeklyPdca);

// 4. Dashboard OKR (Objectives and Key Results)
router.get('/okr', kinerjaController.getOkrDashboard);
router.post('/okr', kinerjaController.saveOkr);

// 5. Rencana & Penugasan Staf
router.get('/staff-plans', kinerjaController.getStaffPlansAndAssignments);
router.post('/plans', kinerjaController.saveStaffPlan);
router.put('/plans/:id', kinerjaController.saveStaffPlan);
router.put('/plans/:id/item', kinerjaController.updatePlanItemStatus);
router.delete('/plans/:id', kinerjaController.deleteStaffPlan);
router.post('/assign', kinerjaController.createAssignmentFromPlan);

// 6. Input Laporan Harian Terpadu PPP
router.post('/daily-report', kinerjaController.saveDailyReportFromPpp);

module.exports = router;
