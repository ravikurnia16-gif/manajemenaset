const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const types = await prisma.vehicle.findMany({ select: { type: true }, distinct: ['type'] });
    console.log(JSON.stringify(types, null, 2));
    process.exit(0);
}
main();
