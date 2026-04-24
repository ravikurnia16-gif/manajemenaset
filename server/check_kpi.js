
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkKPIData() {
    try {
        const targetMonth = 4; // April
        const targetYear = 2026;
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

        console.log(`Checking data for ${targetMonth}/${targetYear}...`);

        const assignments = await prisma.personnelAssignment.count({
            where: { createdAt: { gte: startDate, lte: endDate } }
        });

        const dailyReports = await prisma.personnelReport.count({
            where: { date: { gte: startDate, lte: endDate }, type: 'DAILY' }
        });

        const weeklyPlans = await prisma.personnelReport.count({
            where: { date: { gte: startDate, lte: endDate }, type: 'WEEKLY' }
        });

        const staffCount = await prisma.user.count({
            where: {
                OR: [
                    { position: { contains: 'Sarana dan Prasarana' } },
                    { position: { contains: 'Manajemen Aset' } },
                    { position: { contains: 'Gudang dan Logistik' } },
                    { position: { contains: 'Teknisi' } },
                    { position: { contains: 'Keuangan dan Administrasi' } },
                    { position: { contains: 'Kendaraan' } }
                ]
            }
        });

        console.log('Results:');
        console.log('- Total Staff (Sarpras):', staffCount);
        console.log('- Assignments this month:', assignments);
        console.log('- Daily Reports this month:', dailyReports);
        console.log('- Weekly Plans this month:', weeklyPlans);

        if (staffCount === 0) {
            console.warn('WARNING: No staff found with matching positions. KPI will be empty.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

checkKPIData();
