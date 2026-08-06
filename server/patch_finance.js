const fs = require('fs');
const controllerPath = 'd:/MANAJEMEN ASET/server/controllers/uniformController.js';
let content = fs.readFileSync(controllerPath, 'utf8');

const financeStart = content.indexOf('exports.getFinanceReport = async (req, res) => {');

const newCode = `exports.getFinanceReport = async (req, res) => {
    try {
        // 1. Total Pendapatan (Revenue)
        // Penjualan yang statusnya bukan CANCELLED
        const sales = await prisma.uniformSale.findMany({
            where: { status: { not: 'CANCELLED' } },
            include: { items: true }
        });
        
        let totalRevenue = 0;
        const cashFlow = [];
        
        sales.forEach(s => {
            // Calculate revenue only from DIAMBIL items
            const revenueFromSale = s.items.reduce((sum, item) => {
                if (item.status === 'DIAMBIL') {
                    return sum + item.totalPrice;
                }
                return sum;
            }, 0);
            
            totalRevenue += revenueFromSale;
            
            if (revenueFromSale > 0) {
                cashFlow.push({
                    type: 'IN',
                    date: s.createdAt,
                    amount: revenueFromSale,
                    description: \`Pendapatan Barang Diambil: \${s.code} (\${s.customerName || 'Pelanggan'})\`,
                    reference: s.code
                });
            }
        });

        // 2. Total Pengeluaran (Expenses)
        // Proyek yang sudah SELESAI
        const completedProjects = await prisma.uniformProject.findMany({
            where: { status: 'SELESAI' },
            include: { selections: { where: { status: 'DIPILIH' } } }
        });
        
        let totalExpenses = 0;
        const projectExpenses = [];
        for (const proj of completedProjects) {
            if (proj.selections.length > 0) {
                const cost = proj.selections[0].proposedPrice || 0;
                totalExpenses += cost;
                projectExpenses.push({
                    id: proj.id,
                    title: proj.title,
                    cost: cost,
                    updatedAt: proj.updatedAt
                });
            }
        }

        // 3. Nilai Stok (Asset Value)
        const stocks = await prisma.uniformStock.findMany({
            include: { variant: { include: { item: true } } }
        });
        
        const totalAssetValue = stocks.reduce((sum, stock) => {
            const price = stock.variant.sellPrice || stock.variant.item.sellPrice || 0;
            return sum + (stock.quantity * price);
        }, 0);

        // 4. Laba / Rugi
        const netProfit = totalRevenue - totalExpenses;

        // Pengeluaran dari Proyek
        projectExpenses.forEach(p => {
            if (p.cost > 0) {
                cashFlow.push({
                    type: 'OUT',
                    date: p.updatedAt,
                    amount: p.cost,
                    description: \`Pembayaran Proyek: \${p.title}\`,
                    reference: \`PRJ-\${p.id}\`
                });
            }
        });

        // Urutkan berdasarkan tanggal terbaru
        cashFlow.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            summary: {
                totalRevenue,
                totalExpenses,
                netProfit,
                totalAssetValue
            },
            cashFlow: cashFlow.slice(0, 50) // Batasi 50 transaksi terbaru
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};`;

const financeEnd = content.indexOf('};', content.indexOf('res.status(500).json({ error: error.message });', financeStart)) + 2;

const finalContent = content.substring(0, financeStart) + newCode + content.substring(financeEnd);
fs.writeFileSync(controllerPath, finalContent);
console.log('Successfully updated getFinanceReport');
