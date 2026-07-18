const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Helper to automatically append activity to user's daily report
 * @param {number} userId - The user ID performing the action
 * @param {string} category - Category: 'KEUANGAN' | 'ASET' | 'GUDANG' | 'KENDARAAN' | 'UMUM'
 * @param {string} activity - Description of the activity (e.g. 'Menambahkan aset baru: Laptop HP')
 */
const logDailyActivity = async (userId, category, activity) => {
    try {
        if (!userId) return;
        
        // Find today's report for this user and category
        const todayStart = dayjs().tz('Asia/Jakarta').startOf('day').toDate();
        const todayEnd = dayjs().tz('Asia/Jakarta').endOf('day').toDate();

        let report = await prisma.personnelReport.findFirst({
            where: {
                userId,
                type: 'DAILY',
                category,
                date: {
                    gte: todayStart,
                    lte: todayEnd
                }
            }
        });

        const timeString = dayjs().tz('Asia/Jakarta').format('HH:mm');
        const newLogEntry = `[${timeString}] (Otomatis) ${activity}`;

        if (report) {
            // Append to existing content
            await prisma.personnelReport.update({
                where: { id: report.id },
                data: {
                    content: report.content + '\n' + newLogEntry
                }
            });
        } else {
            // Create new daily report
            await prisma.personnelReport.create({
                data: {
                    userId,
                    type: 'DAILY',
                    category,
                    content: newLogEntry,
                    date: new Date()
                }
            });
        }
    } catch (error) {
        console.error('Error in logDailyActivity:', error);
    }
};

module.exports = { logDailyActivity };
