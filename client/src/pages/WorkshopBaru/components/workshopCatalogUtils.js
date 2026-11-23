export const PRESET_UNITS = ['Unit', 'Set', 'Pcs', 'Meter', 'm²', "m'", 'Lembar', 'Batang', 'Paket', 'Titik'];

export const WORKSHOP_CATEGORIES = [
    { id: 'KAYU', label: 'Pekerjaan Kayu', badge: '🪵 Pekerjaan Kayu', chipCls: 'bg-orange-100 text-orange-800 border-orange-200' },
    { id: 'BESI', label: 'Pekerjaan Besi', badge: '⚙️ Pekerjaan Besi', chipCls: 'bg-slate-200 text-slate-800 border-slate-300' },
    { id: 'UMUM', label: 'Campuran / Umum', badge: '🛠️ Kayu & Besi', chipCls: 'bg-teal-100 text-teal-800 border-teal-200' }
];

export const getCategoryMeta = (categoryId) => {
    const upper = String(categoryId || '').toUpperCase();
    return WORKSHOP_CATEGORIES.find((c) => c.id === upper) || null;
};

/**
 * Mengekstrak kategori (KAYU | BESI | UMUM), satuan, mode harga (FIXED | CUSTOM | VARIANT),
 * catatan harga, dan daftar varian satuan/bentuk dari field specification VendorProduct.
 */
export function parseCatalogSpecification(rawSpec = '') {
    let text = String(rawSpec || '');
    let category = '';
    let unit = 'Unit';
    let priceMode = 'FIXED';
    let priceNote = '';
    let variants = [];

    const catMatch = text.match(/\[Kategori:\s*(KAYU|BESI|UMUM)\]/i);
    if (catMatch) {
        category = catMatch[1].toUpperCase();
        text = text.replace(catMatch[0], '');
    }

    const unitMatch = text.match(/\[Satuan:\s*([^\]]+)\]/i);
    if (unitMatch) {
        unit = unitMatch[1].trim() || 'Unit';
        text = text.replace(unitMatch[0], '');
    }

    const modeMatch = text.match(/\[HargaMode:\s*(FIXED|CUSTOM|VARIANT)\]/i);
    if (modeMatch) {
        priceMode = modeMatch[1].toUpperCase();
        text = text.replace(modeMatch[0], '');
    }

    const noteMatch = text.match(/\[CatatanHarga:\s*([^\]]+)\]/i);
    if (noteMatch) {
        priceNote = noteMatch[1].trim();
        text = text.replace(noteMatch[0], '');
    }

    const variantsMatch = text.match(/\[VarianHarga:\s*(\[[\s\S]*?\])\]/);
    if (variantsMatch) {
        try {
            const parsed = JSON.parse(variantsMatch[1]);
            if (Array.isArray(parsed)) {
                variants = parsed
                    .filter((v) => v && (v.label || v.unit))
                    .map((v) => ({
                        label: String(v.label || '').trim(),
                        unit: String(v.unit || unit || 'Unit').trim(),
                        price: Number(v.price) || 0
                    }));
            }
        } catch {
            variants = [];
        }
        text = text.replace(variantsMatch[0], '');
    }

    return {
        category,
        unit,
        priceMode,
        priceNote,
        variants,
        cleanSpec: text.trim()
    };
}

/**
 * Menyusun string specification gabungan yang aman dan tetap rapi di Data Vendor.
 */
export function buildCatalogSpecification({ category = '', unit = 'Unit', priceMode = 'FIXED', priceNote = '', variants = [], cleanSpec = '' }) {
    const sanitizeTagText = (val) => String(val || '').replace(/[[\]]/g, '').trim();
    const tags = [];

    const cleanCat = String(category || '').toUpperCase();
    if (['KAYU', 'BESI', 'UMUM'].includes(cleanCat)) {
        tags.push(`[Kategori: ${cleanCat}]`);
    }

    tags.push(`[Satuan: ${sanitizeTagText(unit) || 'Unit'}]`);

    if (priceMode && priceMode !== 'FIXED') {
        tags.push(`[HargaMode: ${priceMode}]`);
    }
    const cleanNote = sanitizeTagText(priceNote);
    if (cleanNote) {
        tags.push(`[CatatanHarga: ${cleanNote}]`);
    }
    if (priceMode === 'VARIANT' && Array.isArray(variants) && variants.length > 0) {
        const cleanVariants = variants
            .filter((v) => (v.label || '').trim() || (v.unit || '').trim())
            .map((v) => ({
                label: sanitizeTagText(v.label || 'Varian'),
                unit: sanitizeTagText(v.unit || unit || 'Unit'),
                price: Math.max(0, Number(v.price) || 0)
            }));
        if (cleanVariants.length > 0) {
            tags.push(`[VarianHarga: ${JSON.stringify(cleanVariants)}]`);
        }
    }
    return `${tags.join(' ')} ${String(cleanSpec || '').trim()}`.trim();
}

/**
 * Menentukan kategori produk (KAYU / BESI / UMUM):
 * Prioritaskan tag eksplisit `[Kategori: ...]`, lalu fallback ke pencocokan kata kunci untuk produk lama.
 */
export function inferCatalogCategory(product) {
    const parsed = parseCatalogSpecification(product?.specification);
    if (parsed.category) return parsed.category;

    const hay = `${product?.name || ''} ${parsed.cleanSpec || ''}`.toLowerCase();
    const isKayu = Boolean(hay.match(/kayu|mebel|meja|kursi|lemari|rak|partisi|pintu|kusen|triplex|multipleks/));
    const isBesi = Boolean(hay.match(/besi|las|tralis|kanopi|pagar|baja|rangka|hollow|steinless|stainless/));
    if (isKayu && !isBesi) return 'KAYU';
    if (isBesi && !isKayu) return 'BESI';
    if (isKayu && isBesi) return 'UMUM';
    return '';
}
