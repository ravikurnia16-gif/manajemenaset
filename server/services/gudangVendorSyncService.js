const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Mendapatkan atau membuat vendor default untuk Gudang & Logistik (Bidang Sarana) di master Vendor
 */
async function getOrCreateGudangSaranaVendor(tx = prisma) {
    let vendor = await tx.vendor.findFirst({
        where: {
            OR: [
                { name: 'Gudang & Logistik (Bidang Sarana)' },
                { name: 'Bidang Sarana (Gudang & Logistik)' },
                { name: 'Bidang Sarana' },
                { name: { contains: 'Gudang & Logistik (Bidang Sarana)' } },
                { name: { contains: 'Gudang Sarana' } },
                { name: { contains: 'Bidang Sarana' } }
            ]
        }
    });

    if (!vendor) {
        vendor = await tx.vendor.create({
            data: {
                name: 'Gudang & Logistik (Bidang Sarana)',
                category: 'Gudang & Logistik',
                phone: '08116600022',
                email: 'sarpras@dareliman.or.id',
                address: 'Jl. Gunuang Juaro, Surau Gadang, Nanggalo, Padang (Gudang Sarana)',
                description: 'Unit Penyedia & Pergudangan Logistik, ATK, Bahan Kebersihan, Material, dan Perlengkapan Internal Bidang Sarana Yayasan Dar El-Iman Padang. Seluruh data barang tersinkron otomatis dengan Manajemen Gudang.',
                isVerified: true
            }
        });
    }

    return vendor;
}

/**
 * Format string spesifikasi dari data InvItem
 */
function buildSpecification(item, categoryName) {
    const parts = [];
    parts.push(`[GudangInv:${item.id}]`);
    if (item.code) parts.push(`Kode: ${item.code}`);
    if (item.unit) parts.push(`Satuan: ${item.unit}`);
    if (categoryName) parts.push(`Kategori: ${categoryName}`);
    if (item.isAsset) parts.push('Klasifikasi: Aset');
    if (item.description && item.description.trim()) parts.push(item.description.trim());
    return parts.join(' • ');
}

/**
 * Sinkronisasi satu InvItem ke VendorProduct milik Gudang & Logistik (Bidang Sarana)
 */
async function syncInvItemToVendorProduct(itemOrId, tx = prisma) {
    try {
        let item = itemOrId;
        if (typeof itemOrId === 'number' || typeof itemOrId === 'string') {
            item = await tx.invItem.findUnique({
                where: { id: parseInt(itemOrId, 10) },
                include: { category: true }
            });
        } else if (item && !item.category && item.categoryId) {
            const cat = await tx.invCategory.findUnique({ where: { id: item.categoryId } });
            item.category = cat;
        }

        if (!item) return null;

        const vendor = await getOrCreateGudangSaranaVendor(tx);
        const categoryName = item.category?.name || '';
        const targetPrice = (item.sellingPrice !== null && item.sellingPrice !== undefined && !isNaN(Number(item.sellingPrice)) && Number(item.sellingPrice) > 0)
            ? Number(item.sellingPrice)
            : (item.price !== null && item.price !== undefined && !isNaN(Number(item.price)) ? Number(item.price) : 0);

        const specString = buildSpecification(item, categoryName);

        // Cari VendorProduct yang sudah terhubung (berdasarkan marker [GudangInv:ID] atau nama & vendorId)
        let existingProduct = await tx.vendorProduct.findFirst({
            where: {
                vendorId: vendor.id,
                OR: [
                    { specification: { contains: `[GudangInv:${item.id}]` } },
                    { name: item.name }
                ]
            }
        });

        if (existingProduct) {
            const priceChanged = targetPrice > 0 && targetPrice !== existingProduct.price;
            const updated = await tx.vendorProduct.update({
                where: { id: existingProduct.id },
                data: {
                    name: item.name,
                    price: targetPrice > 0 ? targetPrice : existingProduct.price,
                    specification: specString,
                    image: item.image || existingProduct.image
                }
            });

            if (priceChanged) {
                await tx.vendorPriceHistory.create({
                    data: {
                        productId: updated.id,
                        price: targetPrice
                    }
                });
            }

            return updated;
        } else {
            const created = await tx.vendorProduct.create({
                data: {
                    vendorId: vendor.id,
                    name: item.name,
                    price: targetPrice > 0 ? targetPrice : null,
                    specification: specString,
                    image: item.image || null
                }
            });

            if (targetPrice > 0) {
                await tx.vendorPriceHistory.create({
                    data: {
                        productId: created.id,
                        price: targetPrice
                    }
                });
            }

            return created;
        }
    } catch (error) {
        console.error(`[GudangVendorSync] Error syncing item ${itemOrId?.id || itemOrId}:`, error.message);
        return null;
    }
}

/**
 * Hapus VendorProduct saat InvItem dihapus
 */
async function removeVendorProductForInvItem(itemId, tx = prisma) {
    try {
        const vendor = await getOrCreateGudangSaranaVendor(tx);
        const product = await tx.vendorProduct.findFirst({
            where: {
                vendorId: vendor.id,
                specification: { contains: `[GudangInv:${itemId}]` }
            }
        });

        if (product) {
            await tx.vendorProduct.delete({
                where: { id: product.id }
            });
        }
    } catch (error) {
        console.error(`[GudangVendorSync] Error removing product for item ${itemId}:`, error.message);
    }
}

/**
 * Sinkronkan semua barang di Manajemen Gudang (InvItem) ke Data Vendor (Bidang Sarana)
 */
async function syncAllInventoryItemsToVendor() {
    try {
        const items = await prisma.invItem.findMany({
            include: { category: true }
        });

        if (items.length === 0) return { total: 0, synced: 0 };

        const vendor = await getOrCreateGudangSaranaVendor();
        let syncedCount = 0;

        for (const item of items) {
            const res = await syncInvItemToVendorProduct(item);
            if (res) syncedCount++;
        }

        return { total: items.length, synced: syncedCount, vendorId: vendor.id };
    } catch (error) {
        console.error('[GudangVendorSync] Error in syncAllInventoryItemsToVendor:', error.message);
        return { error: error.message };
    }
}

module.exports = {
    getOrCreateGudangSaranaVendor,
    syncInvItemToVendorProduct,
    removeVendorProductForInvItem,
    syncAllInventoryItemsToVendor
};
