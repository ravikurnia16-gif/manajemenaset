const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getDashboardStats = async (req, res) => {
    try {
        const now = new Date();

        // 1. Basic Stats
        const [totalAssets, totalValue, damagedAssets, assets] = await Promise.all([
            prisma.asset.count(),
            prisma.asset.aggregate({ _sum: { price: true } }),
            prisma.asset.count({
                where: {
                    condition: { in: ['RUSAK_RINGAN', 'RUSAK_BERAT'] }
                }
            }),
            prisma.asset.findMany({
                select: { id: true, purchaseDate: true, usefulLife: true }
            })
        ]);

        // 2. Calculate Expired Assets (Habis Umur)
        // purchaseDate + usefulLife < now
        const expiredAssetsCount = assets.filter(a => {
            const expiryDate = new Date(a.purchaseDate);
            expiryDate.setFullYear(expiryDate.getFullYear() + (a.usefulLife || 5));
            return expiryDate < now;
        }).length;

        // 3. Category Composition (Pie Chart)
        const categories = await prisma.category.findMany({
            include: { _count: { select: { assets: true } } }
        });
        const pieData = categories.map(c => ({
            name: c.name,
            value: c._count.assets
        })).filter(d => d.value > 0);

        // 4. Monthly Statistics (Bar Chart - Last 6 Months)
        const chartData = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthName = date.toLocaleString('id-ID', { month: 'short' });
            const year = date.getFullYear();
            const month = date.getMonth();

            const startOfMonth = new Date(year, month, 1);
            const endOfMonth = new Date(year, month + 1, 0);

            const count = await prisma.asset.count({
                where: {
                    purchaseDate: {
                        gte: startOfMonth,
                        lte: endOfMonth
                    }
                }
            });

            chartData.push({ name: monthName, value: count });
        }

        res.json({
            stats: {
                totalAssets,
                totalValue: totalValue._sum.price || 0,
                damagedAssets,
                expiredAssets: expiredAssetsCount
            },
            pieData,
            chartData
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
};
