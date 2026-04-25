const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Generate automatic document number
 * @param {string} categoryCode - Category Code (e.g., 'SURAT_KELUAR', 'BAST', 'SOP')
 * @param {string} unitCode - Unit Code
 * @param {number} sopVersion - Version number for SOP
 * @returns {Promise<string>} Generated document number
 */
const generateDocumentNumber = async (categoryCode, unitCode, sopVersion = 1) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const romanMonth = romanMonths[currentMonth - 1];

  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear + 1, 0, 1);

  // Use a transaction or simply count since it's an estimation for now
  // For production with high concurrency, a separate counter table is better
  const count = await prisma.document.count({
    where: {
      category: { code: categoryCode },
      createdAt: {
        gte: startOfYear,
        lt: endOfYear
      }
    }
  });

  const sequence = String(count + 1).padStart(3, '0');
  const safeUnitCode = unitCode || 'PST'; // PST for Pusat if no unit

  switch (categoryCode) {
    case 'SURAT_KELUAR':
      // [No_Urut]/SARPRAS/[KODE_UNIT]/[BULAN_ROMAWI]/[TAHUN]
      return `${sequence}/SARPRAS/${safeUnitCode}/${romanMonth}/${currentYear}`;
    case 'BAST':
      // [No_Urut]/BAST-SARPRAS/[KODE_UNIT]/[TAHUN]
      return `${sequence}/BAST-SARPRAS/${safeUnitCode}/${currentYear}`;
    case 'SOP':
      // SOP/SARPRAS/[KODE_UNIT]/[No_Urut]/[VERSI]
      return `SOP/SARPRAS/${safeUnitCode}/${sequence}/V${sopVersion}`;
    default:
      return `${sequence}/DOC/${currentYear}`;
  }
};

module.exports = {
  generateDocumentNumber
};
