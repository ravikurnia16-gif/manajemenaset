const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.uniformProject.findMany({ include: { projectItems: true } });
  console.log(JSON.stringify(projects, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
