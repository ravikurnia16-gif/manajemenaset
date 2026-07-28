const { sendCalendarReminders, sendWeeklyCalendarSummary } = require('../controllers/calendarController');
const { checkMaintenanceNotifications, checkKmServiceNotifications } = require('../controllers/vehicleMaintenanceController');
const { checkTaxNotifications, checkKirNotifications } = require('../controllers/vehicleController');
const { checkOverdueLoans } = require('../controllers/loanController');
const { checkOverdueVehicleBookings, checkUpcomingVehicleBookings } = require('../controllers/vehicleBookingController');
const { checkMissingWeeklyReports } = require('../controllers/vehicleReportController');
const { 
    checkAssignmentDeadlines, 
    generateRoutineTasks, 
    sendDailyPersonnelSummary, 
    checkPlanDeadlines, 
    checkMissingReportsWeekly 
} = require('../controllers/personnelController');
const { sendWeeklyAssetSummary } = require('./summaryNotification');
const { sendWeeklyBusTripSummary } = require('./tripSummaryNotification');
const { sendMaintenanceConditionSummary } = require('./maintenanceSummaryNotification');
const { sendUniformOrderSummary } = require('./uniformSummaryNotification');
const { checkAssetMaintenanceReminders, checkUnrespondedReports } = require('../controllers/maintenanceController');
const { checkBusBookingNotifications, checkUnpaidBusInvoices } = require('../controllers/busBookingController');
const { checkInvoiceDueDates } = require('../controllers/officeDocumentController');
const { sendReportReminders } = require('../controllers/laporanController');
const checklistController = require('../controllers/vehicleChecklistController');

let schedulerInterval = null;

const initScheduler = () => {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
    }

    console.log(`[${new Date().toLocaleString()}] [Scheduler] Initialized. Checking tasks every 60 seconds...`);

    schedulerInterval = setInterval(async () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const day = now.getDay(); // 0 = Sunday, 1 = Monday
        const hour = now.getHours();
        const minute = now.getMinutes();

        // ----------------------------------------------------
        // 0. ROUTINE TASK GENERATION (Daily at 00:01 AM)
        // ----------------------------------------------------
        if (hour === 0 && minute === 1) {
            console.log('[Scheduler] Executing Daily Routine Task Generation...');
            try {
                await generateRoutineTasks();
            } catch (err) {
                console.error('[Scheduler] Error in Routine Task Generation:', err);
            }
        }

        // ----------------------------------------------------
        // 0.5 REPORT REMINDERS (Daily at 11:52 and 16:07)
        // ----------------------------------------------------
        if ((hour === 11 && minute === 52) || (hour === 16 && minute === 7)) {
            console.log('[Scheduler] Executing Report Reminders...');
            try {
                await sendReportReminders();
            } catch (err) {
                console.error('[Scheduler] Error in Report Reminders:', err);
            }
        }

        // ----------------------------------------------------
        // 1. DAILY CALENDAR REMINDER (Every Day at 19:00 / 7 PM)
        // ----------------------------------------------------
        if (hour === 10 && minute === 0) {
            console.log('[Scheduler] Executing Daily Calendar Reminder...');
            try {
                await sendCalendarReminders();
            } catch (err) {
                console.error('[Scheduler] Error in Daily Reminder:', err);
            }
        }

        // ----------------------------------------------------
        // 2. WEEKLY CALENDAR SUMMARY (Monday at 07:30 AM)
        // ----------------------------------------------------
        if (day === 1 && hour === 7 && minute === 30) {
            console.log('[Scheduler] Executing Weekly Calendar Summary...');
            try {
                await sendWeeklyCalendarSummary();
            } catch (err) {
                console.error('[Scheduler] Error in Weekly Summary:', err);
            }
        }

        // ----------------------------------------------------
        // 2b. WEEKLY BUS TRIP SUMMARY (Monday at 07:35 AM)
        // ----------------------------------------------------
        if (day === 1 && hour === 7 && minute === 35) {
            console.log('[Scheduler] Executing Weekly Bus Trip Summary...');
            try {
                await sendWeeklyBusTripSummary();
            } catch (err) {
                console.error('[Scheduler] Error in Weekly Bus Trip Summary:', err);
            }
        }

        // ----------------------------------------------------
        // 2c. MAINTENANCE CONDITION SUMMARY (Monday, Wednesday & Friday at 07:35 AM)
        // ----------------------------------------------------
        if ([1, 3, 5].includes(day) && hour === 7 && minute === 35) {
            console.log('[Scheduler] Executing Maintenance Condition Summary...');
            try {
                await sendMaintenanceConditionSummary();
            } catch (err) {
                console.error('[Scheduler] Error in Maintenance Condition Summary:', err);
            }
        }

        // ----------------------------------------------------
        // 2d. UNIFORM ORDER SUMMARY (Monday, Wednesday & Friday at 07:40 AM)
        // ----------------------------------------------------
        if ([1, 3, 5].includes(day) && hour === 7 && minute === 40) {
            console.log('[Scheduler] Executing Uniform Order Summary...');
            try {
                await sendUniformOrderSummary();
            } catch (err) {
                console.error('[Scheduler] Error in Uniform Order Summary:', err);
            }
        }

        // ----------------------------------------------------
        // 3. VEHICLE CHECKS (Daily at 09:00 AM)
        // ----------------------------------------------------
        if (hour === 9 && minute === 0) {
            console.log('[Scheduler] Executing Vehicle Maintenance & Tax Checks...');
            try {
                await checkMaintenanceNotifications();
                await checkKmServiceNotifications();
                await checkTaxNotifications();
                await checkKirNotifications();
                await checkOverdueLoans();
                await checkBusBookingNotifications();
                await checkUnpaidBusInvoices();
                await checkInvoiceDueDates();
            } catch (err) {
                console.error('[Scheduler] Error in Vehicle Checks:', err);
            }
        }

        // ----------------------------------------------------
        // 3b. ASSET MAINTENANCE REMINDER (Daily at 08:30 AM)
        // ----------------------------------------------------
        if (hour === 8 && minute === 30) {
            console.log('[Scheduler] Executing Asset Maintenance Reminders & Unresponded Report Check...');
            try {
                await checkAssetMaintenanceReminders();
            } catch (err) {
                console.error('[Scheduler] Error in Asset Reminders:', err);
            }
            try {
                await checkUnrespondedReports();
            } catch (err) {
                console.error('[Scheduler] Error in Unresponded Reports Check:', err);
            }
        }

        // ----------------------------------------------------
        // 4. VEHICLE BOOKING REMINDERS (Every 1 hour, between 05:00 and 23:00)
        // ----------------------------------------------------
        if (hour >= 5 && hour < 23 && minute === 0) {
            console.log(`[Scheduler] Checking Vehicle Booking Reminders at ${hour}:00...`);
            try { await checkOverdueVehicleBookings(); } catch (e) { console.error('checkOverdueVehicleBookings failed:', e.message); }
            try { await checkUpcomingVehicleBookings(); } catch (e) { console.error('checkUpcomingVehicleBookings failed:', e.message); }
        }

        // ----------------------------------------------------
        // 5. PERIODIC TASKS (Every 3 hours)
        // 5:00, 8:00, 11:00, 14:00, 17:00, 20:00, 23:00
        // ----------------------------------------------------
        if ([5, 8, 11, 14, 17, 20, 23].includes(hour) && minute === 0) {
            console.log(`[Scheduler] Executing Periodic Jobs at ${hour}:00...`);
            try {
                await checkAssignmentDeadlines();

                // Specific Personnel Reminders
                if (hour === 8) await checkPlanDeadlines();
                if (hour === 20) await sendDailyPersonnelSummary();
            } catch (err) {
                console.error('[Scheduler] Error in Overdue Reminders:', err);
            }
        }

        // ----------------------------------------------------
        // 5. VEHICLE CHECKLIST SCHEDULER
        // ----------------------------------------------------
        // A. Daily Checklist Audit (Mon-Fri 18:00)
        if ([1,2,3,4,5].includes(day) && hour === 18 && minute === 0) {
            checklistController.auditDailyChecklists();
        }

        // B. Weekly Checklist Reminder (Mon 07:15)
        if (day === 1 && hour === 7 && minute === 15) {
            checklistController.sendWeeklyChecklistReminder();
        }

        // C. Weekly Checklist Audit (Fri 18:05)
        if (day === 5 && hour === 18 && minute === 5) {
            checklistController.auditWeeklyChecklists();
        }

        // ----------------------------------------------------
        // 6. WEEKLY ASSET SUMMARY (Friday at 15:30)
        // ----------------------------------------------------
        if (day === 5 && hour === 15 && minute === 30) {
            console.log('[Scheduler] Executing Weekly Asset Summary...');
            try {
                await sendWeeklyAssetSummary();
            } catch (err) {
                console.error('[Scheduler] Error in Weekly Asset Summary:', err);
            }
        }

    }, 60000); // Check every 60 seconds
};

module.exports = { initScheduler };
