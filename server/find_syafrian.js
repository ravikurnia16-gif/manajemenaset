const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findUser() {
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: 'Syafrian' } },
          { username: { contains: 'Syafrian' } }
        ]
      },
      select: { id: true, name: true, username: true, position: true, unitId: true }
    });
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

findUser();
