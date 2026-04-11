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
const { checkBusBookingNotifications, checkUnpaidBusInvoices } = require('../controllers/busBookingController');

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
            } catch (err) {
                console.error('[Scheduler] Error in Vehicle Checks:', err);
            }
        }

        // ----------------------------------------------------
        // 4. OVERDUE REMINDERS (Multiple times daily)
        // 5:00, 8:00, 11:00, 14:00, 17:00, 20:00, 23:00
        // ----------------------------------------------------
        if ([5, 8, 11, 14, 17, 20, 23].includes(hour) && minute === 0) {
            console.log(`[Scheduler] Executing Overdue Vehicle Reminders at ${hour}:00...`);
            try {
                await checkOverdueVehicleBookings();
                await checkUpcomingVehicleBookings();
                await checkAssignmentDeadlines();

                // Specific Personnel Reminders
                if (hour === 8) await checkPlanDeadlines();
                if (hour === 20) await sendDailyPersonnelSummary();
            } catch (err) {
                console.error('[Scheduler] Error in Overdue Reminders:', err);
            }
        }

        // ----------------------------------------------------
        // 5. PERSONNEL: MISSING REPORTS AUDIT (Friday at 15:00)
        // ----------------------------------------------------
        if (day === 5 && hour === 15 && minute === 0) {
            console.log('[Scheduler] Executing Personnel Missing Report Audit & Vehicle Weekly Reports...');
            try {
                await checkMissingReportsWeekly();
                await checkMissingWeeklyReports();
            } catch (err) {
                console.error('[Scheduler] Error in Missing Reports Check:', err);
            }
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
