const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const users = await prisma.user.findMany({
        where: { name: { in: ['Ravi Kurnia', 'Ringgo Afriwansyah Putra', 'Syafriyan', 'Rian Yulianto', 'Jeri Saputra', 'Eldo Darjumeianto Putra'] } },
        select: { name: true, phone: true }
    });
    console.log(users);
}
run().catch(console.error).finally(() => prisma.$disconnect());
