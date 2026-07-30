const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Menghapus tabel seragam_proyek_item yang lama untuk update skema...");
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS seragam_proyek_item;`);
        console.log("Tabel berhasil dihapus.");
    } catch (e) {
        console.error("Gagal menghapus tabel:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
