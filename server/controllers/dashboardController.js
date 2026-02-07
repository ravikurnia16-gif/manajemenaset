const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getDashboardStats = async (req, res) => {
    try {
        const now = new Date();

        // 1. Fetch assets for value calculation
        const allAssets = await prisma.asset.findMany({
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
            prisma.asset.count(),
            prisma.asset.count({
                where: {
                    condition: { in: ['RUSAK_RINGAN', 'RUSAK_BERAT'] }
                }
            })
        ]);
        const assetsForExpiry = allAssets; // Use already fetched data

        // 3. Calculate Expired Assets (Habis Umur)
        // purchaseDate + usefulLife < now
        const expiredAssetsCount = allAssets.filter(a => {
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
                totalValue: totalBookValue,
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
