const fs = require('fs');
const controllerPath = 'd:/MANAJEMEN ASET/server/controllers/uniformController.js';
let content = fs.readFileSync(controllerPath, 'utf8');

const fulfillStart = content.indexOf('exports.fulfillSale = async (req, res) => {');
const fulfillEnd = content.indexOf('exports.updateSalePayment = async (req, res) => {');

const newCode = `exports.manageSaleItems = async (req, res) => {
    const { itemUpdates } = req.body;
    try {
        const saleId = parseInt(req.params.id);
        
        if (!itemUpdates || !Array.isArray(itemUpdates)) {
            return res.status(400).json({ error: 'Data update tidak valid' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const sale = await tx.uniformSale.findUnique({
                where: { id: saleId },
                include: { items: true }
            });

            if (!sale) throw new Error('Pesanan tidak ditemukan');
            
            const itemsMap = new Map(sale.items.map(i => [i.id, i]));
            let subtotalAdjustment = 0;

            for (const update of itemUpdates) {
                const item = itemsMap.get(parseInt(update.saleItemId));
                if (!item) continue;
                
                const oldStatus = item.status;
                const newStatus = update.status;
                
                if (oldStatus === newStatus) continue;

                const qty = item.qty;
                const generateTrxCode = async (prefix) => {
                    const latest = await tx.uniformStockTransaction.findFirst({
                        where: { code: { startsWith: prefix } },
                        orderBy: { id: 'desc' }
                    });
                    const now = new Date();
                    const year = now.getFullYear();
                    let nextNum = 1;
                    if (latest) {
                        const parts = latest.code.split('/');
                        if (parts.length === 4 && parts[2] === year.toString()) {
                            nextNum = parseInt(parts[3]) + 1;
                        }
                    }
                    return \`\${prefix}/\${year}/\${nextNum.toString().padStart(3, '0')}\`;
                };

                // PENDING/INDENT/TIDAK_TERSEDIA -> SEDIA (Mutation: Source -> Transit)
                if (['PENDING', 'INDENT', 'TIDAK_TERSEDIA'].includes(oldStatus) && newStatus === 'SEDIA') {
                    const sourceWhId = parseInt(update.sourceWarehouseId);
                    const transitWhId = parseInt(update.transitWarehouseId);
                    if (!sourceWhId || !transitWhId) throw new Error(\`Pilih gudang asal dan gudang transit untuk item \${item.itemName}\`);
                    
                    const stockSource = await tx.uniformStock.findUnique({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: sourceWhId } }
                    });
                    if (!stockSource || stockSource.quantity < qty) throw new Error(\`Stok \${item.itemName} di gudang asal tidak mencukupi\`);
                    
                    await tx.uniformStock.update({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: sourceWhId } },
                        data: { quantity: { decrement: qty } }
                    });
                    
                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: transitWhId } },
                        create: { variantId: item.variantId, warehouseId: transitWhId, quantity: qty, avgCost: stockSource.avgCost },
                        update: { quantity: { increment: qty } }
                    });

                    const trxCode = await generateTrxCode('TRX/SRG');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-MUT-' + Math.floor(Math.random()*1000),
                            type: 'MUTATION',
                            variantId: item.variantId,
                            warehouseId: sourceWhId,
                            toWarehouseId: transitWhId,
                            quantity: qty,
                            costPerUnit: stockSource.avgCost,
                            totalCost: stockSource.avgCost * qty,
                            referenceType: 'SALE',
                            referenceId: sale.id,
                            note: \`Pemindahan ke Gudang Transit untuk Pesanan \${sale.code}\`,
                            createdById: req.user?.id || null
                        }
                    });
                }
                
                // PENDING/INDENT/TIDAK_TERSEDIA/SEDIA -> DIAMBIL
                else if (['PENDING', 'INDENT', 'TIDAK_TERSEDIA', 'SEDIA'].includes(oldStatus) && newStatus === 'DIAMBIL') {
                    let whId;
                    if (oldStatus === 'SEDIA') {
                        whId = parseInt(update.transitWarehouseId); // Need to know which transit warehouse it was in
                        if (!whId) throw new Error(\`Pilih gudang transit (asal ambil) untuk item \${item.itemName}\`);
                    } else {
                        whId = parseInt(update.sourceWarehouseId); // Terjual langsung
                        if (!whId) throw new Error(\`Pilih gudang asal untuk penjualan langsung item \${item.itemName}\`);
                    }
                    
                    const stock = await tx.uniformStock.findUnique({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: whId } }
                    });
                    if (!stock || stock.quantity < qty) throw new Error(\`Stok \${item.itemName} tidak mencukupi untuk DIAMBIL\`);
                    
                    await tx.uniformStock.update({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: whId } },
                        data: { quantity: { decrement: qty } }
                    });
                    
                    const trxCode = await generateTrxCode('TRX/SRG');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-OUT-' + Math.floor(Math.random()*1000),
                            type: 'OUT',
                            variantId: item.variantId,
                            warehouseId: whId,
                            quantity: -qty,
                            costPerUnit: stock.avgCost,
                            totalCost: stock.avgCost * qty,
                            referenceType: 'SALE',
                            referenceId: sale.id,
                            note: \`Barang DIAMBIL untuk Pesanan \${sale.code}\`,
                            createdById: req.user?.id || null
                        }
                    });
                    
                    // Increment delivered qty
                    await tx.uniformSaleItem.update({
                        where: { id: item.id },
                        data: { qtyDelivered: qty } // fully delivered
                    });
                }
                
                // SEDIA -> BATAL
                else if (oldStatus === 'SEDIA' && newStatus === 'BATAL') {
                    const transitWhId = parseInt(update.transitWarehouseId);
                    const returnWhId = parseInt(update.returnWarehouseId);
                    if (!transitWhId || !returnWhId) throw new Error(\`Pilih gudang transit dan gudang pengembalian untuk membatalkan item \${item.itemName}\`);
                    
                    const stockTransit = await tx.uniformStock.findUnique({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: transitWhId } }
                    });
                    if (!stockTransit || stockTransit.quantity < qty) throw new Error(\`Stok \${item.itemName} di gudang transit tidak ditemukan untuk dibatalkan\`);
                    
                    await tx.uniformStock.update({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: transitWhId } },
                        data: { quantity: { decrement: qty } }
                    });
                    
                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: returnWhId } },
                        create: { variantId: item.variantId, warehouseId: returnWhId, quantity: qty, avgCost: stockTransit.avgCost },
                        update: { quantity: { increment: qty } }
                    });

                    const trxCode = await generateTrxCode('TRX/SRG');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-MUT-' + Math.floor(Math.random()*1000),
                            type: 'MUTATION',
                            variantId: item.variantId,
                            warehouseId: transitWhId,
                            toWarehouseId: returnWhId,
                            quantity: qty,
                            costPerUnit: stockTransit.avgCost,
                            totalCost: stockTransit.avgCost * qty,
                            referenceType: 'SALE',
                            referenceId: sale.id,
                            note: \`Pengembalian barang batal dari Gudang Transit untuk Pesanan \${sale.code}\`,
                            createdById: req.user?.id || null
                        }
                    });
                    
                    subtotalAdjustment -= item.totalPrice;
                }
                
                // PENDING/INDENT/TIDAK_TERSEDIA -> BATAL
                else if (['PENDING', 'INDENT', 'TIDAK_TERSEDIA'].includes(oldStatus) && newStatus === 'BATAL') {
                    subtotalAdjustment -= item.totalPrice;
                }
                
                // DIAMBIL -> BATAL
                else if (oldStatus === 'DIAMBIL' && newStatus === 'BATAL') {
                    const returnWhId = parseInt(update.returnWarehouseId);
                    if (!returnWhId) throw new Error(\`Pilih gudang pengembalian untuk item \${item.itemName}\`);
                    
                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: returnWhId } },
                        create: { variantId: item.variantId, warehouseId: returnWhId, quantity: qty, avgCost: 0 },
                        update: { quantity: { increment: qty } }
                    });

                    const trxCode = await generateTrxCode('TRX/SRG');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-IN-' + Math.floor(Math.random()*1000),
                            type: 'IN',
                            variantId: item.variantId,
                            warehouseId: returnWhId,
                            quantity: qty,
                            costPerUnit: 0,
                            totalCost: 0,
                            referenceType: 'SALE',
                            referenceId: sale.id,
                            note: \`Pengembalian barang batal (sudah diambil) untuk Pesanan \${sale.code}\`,
                            createdById: req.user?.id || null
                        }
                    });
                    
                    subtotalAdjustment -= item.totalPrice;
                    await tx.uniformSaleItem.update({
                        where: { id: item.id },
                        data: { qtyDelivered: 0 }
                    });
                }
                
                // DIAMBIL -> SEDIA (Undo pickup)
                else if (oldStatus === 'DIAMBIL' && newStatus === 'SEDIA') {
                    const returnWhId = parseInt(update.returnWarehouseId); // Should be transit warehouse
                    if (!returnWhId) throw new Error(\`Pilih gudang transit pengembalian untuk item \${item.itemName}\`);
                    
                    await tx.uniformStock.upsert({
                        where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: returnWhId } },
                        create: { variantId: item.variantId, warehouseId: returnWhId, quantity: qty, avgCost: 0 },
                        update: { quantity: { increment: qty } }
                    });

                    const trxCode = await generateTrxCode('TRX/SRG');
                    await tx.uniformStockTransaction.create({
                        data: {
                            code: trxCode + '-IN-' + Math.floor(Math.random()*1000),
                            type: 'IN',
                            variantId: item.variantId,
                            warehouseId: returnWhId,
                            quantity: qty,
                            costPerUnit: 0,
                            totalCost: 0,
                            referenceType: 'SALE',
                            referenceId: sale.id,
                            note: \`Pembatalan pengambilan, kembali ke Gudang Transit untuk Pesanan \${sale.code}\`,
                            createdById: req.user?.id || null
                        }
                    });
                    
                    await tx.uniformSaleItem.update({
                        where: { id: item.id },
                        data: { qtyDelivered: 0 }
                    });
                }
                
                // Save item status
                await tx.uniformSaleItem.update({
                    where: { id: item.id },
                    data: { status: newStatus }
                });
                
                // update local map
                item.status = newStatus;
            }

            // Update Sale Status and Totals
            let newStatus = sale.status;
            let allFinal = true;
            let anyPending = false;
            let anySedia = false;
            
            for (const item of itemsMap.values()) {
                if (item.status !== 'DIAMBIL' && item.status !== 'BATAL') {
                    allFinal = false;
                }
                if (['PENDING', 'INDENT', 'TIDAK_TERSEDIA'].includes(item.status)) {
                    anyPending = true;
                }
                if (item.status === 'SEDIA') {
                    anySedia = true;
                }
            }
            
            if (allFinal && itemsMap.size > 0) {
                newStatus = 'SELESAI';
            } else if (anySedia || Array.from(itemsMap.values()).some(i => i.status === 'DIAMBIL')) {
                newStatus = 'PROSES';
            } else {
                newStatus = 'PENDING';
            }

            // Adjust invoice
            const newSubtotal = Math.max(0, sale.subtotal + subtotalAdjustment);
            const newTotalAmount = Math.max(0, newSubtotal - sale.discount);
            let paymentStatus = sale.paymentStatus;
            if (newTotalAmount === 0) {
                paymentStatus = 'PAID';
            } else if (sale.paidAmount >= newTotalAmount) {
                paymentStatus = 'PAID';
            } else if (sale.paidAmount > 0) {
                paymentStatus = 'PARTIAL';
            } else {
                paymentStatus = 'UNPAID';
            }

            const updatedSale = await tx.uniformSale.update({
                where: { id: saleId },
                data: {
                    status: newStatus,
                    subtotal: newSubtotal,
                    totalAmount: newTotalAmount,
                    paymentStatus
                },
                include: { items: true }
            });

            return updatedSale;
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

`;

const finalContent = content.substring(0, fulfillStart) + newCode + content.substring(fulfillEnd);
fs.writeFileSync(controllerPath, finalContent);
console.log('Successfully updated controller');
