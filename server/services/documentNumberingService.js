const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Generates automatic document numbers based on category and current date.
 * Format: {URUT}/{KODE_KAT}/SRN/{BULAN_ROMAWI}/{TAHUN}
 * Example: 001/UND/SRN/IV/2026
 */

const CATEGORY_CODES = {
    'Undangan': 'UN',
    'Tugas': 'ST',
    'Keputusan': 'SK',
    'Keterangan': 'SKet',
    'Pemberitahuan': 'PB',
    'Permohonan': 'PM',
    'Pengantar': 'SP',
    'Perintah': 'SPr',
    'Edaran': 'SE',
    'Rekomendasi': 'RK',
    'Pengumuman': 'PGM',
    'BAST': 'BA',
    'MOU': 'MoU',
    'MoU': 'MoU',
    'Pesanan': 'PO',
    'Umum': 'UMM',
    'Surat Teguran': 'STg',
    'Surat Peringatan': 'SPt',
    'SOP': 'SOP',
    'Lainnya': 'UM',
    'Berita Acara Kunjungan': 'BA',
};

const ROMAN_MONTHS = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV',
    5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII',
    9: 'IX', 10: 'X', 11: 'XI', 12: 'XII',
};

/**
 * Generate the next document number for a given category.
 * @param {string} category - Document category (e.g. 'Undangan')
 * @param {string} type - Document type ('SURAT_KELUAR', 'BAST', 'MOU')
 * @returns {Promise<string>} Generated number e.g. "001/UND/SRN/IV/2026"
 */
async function generateDocumentNumber(category, type) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const romanMonth = ROMAN_MONTHS[month];

    // Determine category code
    let catCode;
    if (type === 'BAST') {
        catCode = 'BA';
    } else if (type === 'MOU' || type === 'MoU') {
        catCode = 'MoU';
    } else if (type === 'SURAT_PESANAN') {
        catCode = 'PO';
    } else if (type === 'INVOICE') {
        catCode = 'INV';
    } else {
        catCode = CATEGORY_CODES[category] || 'UM';
    }

    // Count existing documents of same type/category in the same year to get sequence
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    const docs = await prisma.officeDocument.findMany({
        where: {
            type: { not: 'SURAT_MASUK' },
            number: { not: null },
            date: {
                gte: yearStart,
                lt: yearEnd,
            },
        },
        select: { number: true }
    });

    let maxSeq = 0;
    for (const d of docs) {
        if (d.number) {
            const parts = d.number.split('/');
            if (parts.length > 0 && !isNaN(parseInt(parts[0]))) {
                const seq = parseInt(parts[0]);
                if (seq > maxSeq) {
                    maxSeq = seq;
                }
            }
        }
    }

    const nextSeq = maxSeq + 1;

    const sequence = String(nextSeq).padStart(3, '0');
    return `${sequence}/${catCode}/SRN/${romanMonth}/${year}`;
}

/**
 * Get category code mapping for frontend display.
 */
function getCategoryCodes() {
    return CATEGORY_CODES;
}

module.exports = {
    generateDocumentNumber,
    getCategoryCodes,
    CATEGORY_CODES,
    ROMAN_MONTHS,
};
