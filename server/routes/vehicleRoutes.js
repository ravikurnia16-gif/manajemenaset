const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { verifyToken } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

// Public Routes
router.get('/public', vehicleController.getAllVehicles);

// Protected Routes
router.get('/', verifyToken, vehicleController.getAllVehicles);
router.get('/dashboard', verifyToken, vehicleController.getVehicleDashboard);
router.get('/:id', verifyToken, vehicleController.getVehicleById);
router.post('/', verifyToken, handleUpload('photo', 'vehicles'), vehicleController.createVehicle);
router.put('/:id', verifyToken, handleUpload('photo', 'vehicles'), vehicleController.updateVehicle);
router.put('/:id/mark-paid', verifyToken, vehicleController.markVehicleAsPaid);
router.delete('/:id', verifyToken, vehicleController.deleteVehicle);

// Test Routes (Tanpa Token untuk kemudahan testing di browser)
router.get('/test/pajak', vehicleController.triggerTaxCheck);
router.get('/test/wa', vehicleController.sendTestWA);
router.get('/test/wa-pure', vehicleController.sendPureTestWA);
router.get('/test/debug-maintenance', async (req, res) => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
        const logs = await prisma.vehicleService.findMany({ where: { cost: 170000 } });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Maintenance Routes
const maintenanceCtrl = require('../controllers/vehicleMaintenanceController');
router.get('/maintenance/all', verifyToken, maintenanceCtrl.getAllMaintenanceLogs);
router.get('/maintenance/:id', verifyToken, maintenanceCtrl.getMaintenanceLogById);
router.post('/maintenance', verifyToken, maintenanceCtrl.createMaintenanceLog);
router.put('/maintenance/:id', verifyToken, maintenanceCtrl.updateMaintenanceLog);
router.delete('/maintenance/:id', verifyToken, maintenanceCtrl.deleteMaintenanceLog);

// Maintenance Reminder Routes (Hybrid KM + Date)
const reminderCtrl = require('../controllers/vehicleReminderController');
router.get('/reminders/components', verifyToken, reminderCtrl.getRoutineComponents);
router.get('/reminders/all', verifyToken, reminderCtrl.getAllReminders);
router.get('/reminders/:vehicleId', verifyToken, reminderCtrl.getVehicleReminders);
router.post('/reminders', verifyToken, reminderCtrl.upsertReminder);
router.delete('/reminders/:id', verifyToken, reminderCtrl.deleteReminder);

// Weekly Report Routes
const reportCtrl = require('../controllers/vehicleReportController');
router.get('/:id/reports/weekly/draft', verifyToken, reportCtrl.getWeeklyDraft);
router.post('/reports/weekly', verifyToken, reportCtrl.createWeeklyReport);
router.get('/:id/reports/weekly', verifyToken, reportCtrl.getVehicleReports);

// Booking / Peminjaman Routes
const bookingCtrl = require('../controllers/vehicleBookingController');
router.get('/booking/all', verifyToken, bookingCtrl.getBookings);
router.post('/booking/request', verifyToken, bookingCtrl.requestBooking);
router.post('/booking/:id/review', verifyToken, bookingCtrl.reviewBooking);
router.post('/booking/:id/start', verifyToken, bookingCtrl.startTrip);
router.post('/booking/:id/end', verifyToken, bookingCtrl.endTrip);
router.put('/booking/:id/extend', verifyToken, bookingCtrl.extendTrip);
router.post('/booking/:id/cancel', verifyToken, bookingCtrl.cancelBooking);
router.put('/booking/:id/history', verifyToken, bookingCtrl.updateBookingHistory);

module.exports = router;
