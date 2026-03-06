const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const res = await prisma.user.updateMany({
        where: { position: 'Staff Keuangan dan Administrasi (Sarpras)' },
        data: { role: 'SUPER_ADMIN' }
    });
    console.log('Updated users:', res.count);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
