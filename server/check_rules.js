
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const rules = await prisma.notificationRule.findMany();
    console.log(rules);
}
main().catch(console.error).finally(() => prisma.$disconnect());

