const { sendCalendarReminders, sendWeeklyCalendarSummary } = require('../controllers/calendarController');
const { checkMaintenanceNotifications, checkKmServiceNotifications } = require('../controllers/vehicleMaintenanceController');
const { checkTaxNotifications, checkKirNotifications } = require('../controllers/vehicleController');
const { checkOverdueLoans } = require('../controllers/loanController');
const { checkOverdueVehicleBookings } = require('../controllers/vehicleBookingController');
const { sendWeeklyAssetSummary } = require('./summaryNotification');

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
            } catch (err) {
                console.error('[Scheduler] Error in Overdue Reminders:', err);
            }
        }

        // ----------------------------------------------------
        // 4. WEEKLY ASSET SUMMARY (Friday at 15:00 / 3 PM)
        // ----------------------------------------------------
        if (day === 5 && hour === 15 && minute === 0) {
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
