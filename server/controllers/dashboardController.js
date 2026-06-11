const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const predictiveService = require('../services/predictiveService');

exports.getDashboardStats = async (req, res) => {
    try {
        const { role, unitId: userUnitId } = req.user;
        const { unitId: filterUnitId } = req.query;
        const now = new Date();
        let where = {
            condition: { not: 'DISPOSED' }
        };

        // 0. Fetch Units (for filter dropdown)
        const units = await prisma.unit.findMany({
            select: { id: true, name: true, code: true }
        });

        // Determine filtering logic
        const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT', 'KABID_SARPRAS'].includes(role) || req.user.position === 'Kepala Bidang Sarana dan Prasarana';
        
        let allowedUnitIds = [userUnitId];
        const userUnit = await prisma.unit.findUnique({ where: { id: userUnitId } });
        if (userUnit && userUnit.name.startsWith('Kantor Yayasan -')) {
            const parentUnit = await prisma.unit.findFirst({ where: { name: 'Kantor Yayasan' } });
            if (parentUnit) allowedUnitIds.push(parentUnit.id);
        }

        if (!isGlobalAdmin) {
            where.unitId = { in: allowedUnitIds };
            if (filterUnitId && allowedUnitIds.includes(parseInt(filterUnitId))) {
                where.unitId = parseInt(filterUnitId);
            }
        } else if (filterUnitId) {
            where.unitId = parseInt(filterUnitId);
        }

        // 1. Fetch assets for value calculation
        const allAssets = await prisma.asset.findMany({
            where,
            select: { price: true, purchaseDate: true, usefulLife: true }
        });

        const totalBookValue = allAssets.reduce((sum, a) => {
            const purchaseDate = new Date(a.purchaseDate);
            const monthsElapsed = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
            const totalMonths = (a.usefulLife || 5) * 12;

            const monthlyDepreciation = a.price / totalMonths;
            const accumulatedDepreciation = Math.min(a.price, monthlyDepreciation * Math.max(0, monthsElapsed));
            const bookValue = Math.max(0, a.price - accumulatedDepreciation);

            return sum + bookValue;
        }, 0);

        // 2. Fetch other counts
        const [totalAssets, damagedAssets] = await Promise.all([
            prisma.asset.count({ where }),
            prisma.asset.count({
                where: {
                    ...where,
                    condition: { in: ['RUSAK_RINGAN', 'RUSAK_BERAT'] }
                }
            })
        ]);

        // 3. Calculate Expired Assets (Habis Umur)
        const expiredAssetsCount = allAssets.filter(a => {
            const expiryDate = new Date(a.purchaseDate);
            expiryDate.setFullYear(expiryDate.getFullYear() + (a.usefulLife || 5));
            return expiryDate < now;
        }).length;

        // 3. Category Composition (Pie Chart)
        const categories = await prisma.category.findMany({
            include: {
                assets: {
                    where,
                    select: { id: true }
                }
            }
        });
        const pieData = categories.map(c => ({
            name: c.name,
            value: c.assets.length
        })).filter(d => d.value > 0);

        // 4. Monthly Statistics (Last 6 Months)
        const chartData = [];
        const spendingData = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthName = date.toLocaleString('id-ID', { month: 'short' });
            const year = date.getFullYear();
            const month = date.getMonth();

            const startOfMonth = new Date(year, month, 1);
            const endOfMonth = new Date(year, month + 1, 0);

            const assetsInMonth = await prisma.asset.findMany({
                where: {
                    ...where,
                    purchaseDate: {
                        gte: startOfMonth,
                        lte: endOfMonth
                    }
                },
                select: { price: true }
            });

            const count = assetsInMonth.length;
            const totalSpent = assetsInMonth.reduce((sum, a) => sum + (a.price || 0), 0);

            chartData.push({ name: monthName, value: count });
            spendingData.push({ name: monthName, value: totalSpent });
        }

        // 5. Maintenance Statistics
        const maintenanceStats = await prisma.maintenance.groupBy({
            by: ['status'],
            where: where.unitId ? { unitId: where.unitId } : {},
            _count: { _all: true }
        });

        const maintenanceData = maintenanceStats.map(s => ({
            name: s.status,
            value: s._count._all
        }));

        // 6. Unit Statistics (Table Data) - Only useful if no specific unit filter is applied
        const unitStats = [];
        if (isGlobalAdmin) {
            const unitsWithAssets = await prisma.unit.findMany({
                include: {
                    assets: {
                        where: { condition: { not: 'DISPOSED' } },
                        select: { id: true, price: true, purchaseDate: true, usefulLife: true, condition: true }
                    }
                }
            });

            unitsWithAssets.forEach(u => {
                const totalAssets = u.assets.length;
                const damagedCount = u.assets.filter(a => ['RUSAK_RINGAN', 'RUSAK_BERAT'].includes(a.condition)).length;

                // Book Value calculation for unit
                const totalValue = u.assets.reduce((sum, a) => {
                    const purchaseDate = new Date(a.purchaseDate);
                    const monthsElapsed = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
                    const totalMonths = (a.usefulLife || 5) * 12;
                    const monthlyDepreciation = a.price / totalMonths;
                    const bookValue = Math.max(0, a.price - Math.min(a.price, monthlyDepreciation * Math.max(0, monthsElapsed)));
                    return sum + bookValue;
                }, 0);

                unitStats.push({
                    id: u.id,
                    name: u.name,
                    code: u.code,
                    assetCount: totalAssets,
                    damagedCount: damagedCount,
                    totalValue: totalValue
                });
            });
            unitStats.sort((a, b) => b.assetCount - a.assetCount);
        }

        // 7. Predictive Maintenance (Due Soon)
        const dueSoonAssets = await predictiveService.getDueSoonAssets(14); // Next 14 days

        res.json({
            stats: {
                totalAssets,
                totalValue: totalBookValue,
                damagedAssets,
                expiredAssets: expiredAssetsCount
            },
            pieData,
            chartData,
            spendingData,
            maintenanceData,
            unitStats,
            dueSoonAssets,
            units: isGlobalAdmin ? units : []
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
};
