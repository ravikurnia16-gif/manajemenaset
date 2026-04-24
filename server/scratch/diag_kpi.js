const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Find the Kabid
    const kabid = await prisma.user.findFirst({
        where: { position: { contains: 'kepala bidang', mode: 'insensitive' } }
    });
    console.log('=== KABID ===');
    console.log('Username:', kabid?.username, '| Name:', kabid?.name);
    console.log('Position:', kabid?.position, '| Role:', kabid?.role);
    console.log('UnitId:', kabid?.unitId);

    if (!kabid) { console.log('NO KABID FOUND'); return; }

    // 2. Find all staff with the current query logic
    const staff = await prisma.user.findMany({
        where: {
            AND: [
                {
                    OR: [
                        { position: { contains: 'sarana dan prasarana', mode: 'insensitive' } },
                        { position: { contains: 'sarpras', mode: 'insensitive' } },
                        { position: { contains: 'manajemen aset', mode: 'insensitive' } },
                        { position: { contains: 'manajamen aset', mode: 'insensitive' } },
                        { position: { contains: 'gudang', mode: 'insensitive' } },
                        { position: { contains: 'logistik', mode: 'insensitive' } },
                        { position: { contains: 'teknisi', mode: 'insensitive' } },
                        { position: { contains: 'keuangan', mode: 'insensitive' } },
                        { position: { contains: 'administrasi', mode: 'insensitive' } },
                        { position: { contains: 'kendaraan', mode: 'insensitive' } },
                        { unitId: kabid.unitId || undefined }
                    ]
                },
                {
                    NOT: {
                        OR: [
                            { position: { contains: 'kepala bidang', mode: 'insensitive' } },
                            { role: 'SUPER_ADMIN' }
                        ]
                    }
                }
            ]
        },
        select: { id: true, name: true, position: true, unitId: true, role: true }
    });

    console.log('\n=== STAFF FOUND ===', staff.length, 'members');
    staff.forEach(s => console.log(`  - [${s.id}] ${s.name} | Pos: "${s.position}" | Unit: ${s.unitId} | Role: ${s.role}`));

    // 3. Check assignments for these staff
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const staffIds = staff.map(s => s.id);
    
    const assignmentsByMonth = await prisma.personnelAssignment.findMany({
        where: {
            assigneeId: { in: staffIds },
            OR: [
                { dueDate: { gte: startDate, lte: endDate } },
                { createdAt: { gte: startDate, lte: endDate } }
            ]
        }
    });
    console.log('\n=== ASSIGNMENTS (this month, due OR created) ===', assignmentsByMonth.length);

    // 4. Check ALL assignments for these staff (no date filter)
    const allAssignments = await prisma.personnelAssignment.count({
        where: { assigneeId: { in: staffIds } }
    });
    console.log('=== ALL ASSIGNMENTS (no date filter) ===', allAssignments);

    // 5. Check active assignments (IN_PROGRESS or PENDING)
    const activeAssignments = await prisma.personnelAssignment.findMany({
        where: {
            assigneeId: { in: staffIds },
            status: { in: ['IN_PROGRESS', 'PENDING'] }
        }
    });
    console.log('=== ACTIVE ASSIGNMENTS (IN_PROGRESS/PENDING) ===', activeAssignments.length);

    // 6. Check daily logs
    const dailyLogs = await prisma.personnelReport.count({
        where: {
            userId: { in: staffIds },
            type: 'DAILY',
            date: { gte: startDate, lte: endDate }
        }
    });
    console.log('\n=== DAILY LOGS (this month) ===', dailyLogs);

    // 7. Check plans (WEEKLY with isPlan metadata)
    const planReports = await prisma.personnelReport.findMany({
        where: {
            userId: { in: staffIds },
            type: 'WEEKLY',
            date: { gte: startDate, lte: endDate }
        }
    });
    console.log('=== PLAN REPORTS (this month) ===', planReports.length);
    let planItems = 0;
    planReports.forEach(p => {
        const items = p.metadata?.items || [];
        planItems += items.length;
    });
    console.log('=== PLAN ITEMS TOTAL ===', planItems);
}

main().catch(console.error).finally(() => prisma.$disconnect());
