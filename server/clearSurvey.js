const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe('DELETE FROM SurveyAnswer');
        await prisma.$executeRawUnsafe('DELETE FROM SurveyResponse');
        await prisma.$executeRawUnsafe('DELETE FROM SurveyQuestion');
        console.log("Data survey lama berhasil dihapus via SQL.");
    } catch (e) {
        console.error("Gagal menghapus data:", e.message);
    }
}

main().finally(() => prisma.$disconnect());
