const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Generates automatic document numbers based on category and current date.
 * Format: {URUT}/{KODE_KAT}/SARPRAS/{BULAN_ROMAWI}/{TAHUN}
 * Example: 001/UND/SARPRAS/IV/2026
 */

const CATEGORY_CODES = {
    'Undangan': 'UND',
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
    'Berita Acara': 'BA',
    'BAST': 'BA',
    'Serah Terima Barang': 'BA',
    'MOU': 'MOU',
    'Lainnya': 'UM',
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
 * @returns {Promise<string>} Generated number e.g. "001/UND/SARPRAS/IV/2026"
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
    } else if (type === 'MOU') {
        catCode = 'MOU';
    } else {
        catCode = CATEGORY_CODES[category] || 'UM';
    }

    // Count existing documents of same type/category in the same year to get sequence
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    const lastDoc = await prisma.officeDocument.findFirst({
        where: {
            type: { not: 'SURAT_MASUK' },
            number: { not: null },
            date: {
                gte: yearStart,
                lt: yearEnd,
            },
        },
        orderBy: {
            id: 'desc',
        },
    });

    let nextSeq = 1;
    if (lastDoc && lastDoc.number) {
        const parts = lastDoc.number.split('/');
        if (parts.length > 0 && !isNaN(parseInt(parts[0]))) {
            nextSeq = parseInt(parts[0]) + 1;
        } else {
            // fallback if format is weird
            const count = await prisma.officeDocument.count({
                where: { type: { not: 'SURAT_MASUK' }, number: { not: null }, date: { gte: yearStart, lt: yearEnd } }
            });
            nextSeq = count + 1;
        }
    }

    const sequence = String(nextSeq).padStart(3, '0');
    return `${sequence}/${catCode}/SARPRAS/${romanMonth}/${year}`;
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
