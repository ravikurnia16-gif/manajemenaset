const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.vehicleLocationHistory.count();
  const records = await prisma.vehicleLocationHistory.findMany({
    take: 5,
    orderBy: { id: 'desc' },
    include: { booking: true }
  });
  console.log('Total:', count);
  console.log('Records:', JSON.stringify(records, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
