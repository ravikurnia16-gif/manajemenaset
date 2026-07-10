const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$connect();
        console.log('DB_OK');

        // Check if Unit "Divisi Pendidikan" exists
        let unit = await prisma.unit.findFirst({
            where: { name: { contains: 'Pendidikan' } }
        });

        if (!unit) {
            console.log('Creating Unit Divisi Pendidikan...');
            unit = await prisma.unit.create({
                data: {
                    code: 'DIV-PEND',
                    name: 'Divisi Pendidikan',
                    description: 'Divisi Pendidikan'
                }
            });
        }
        
        console.log('Unit ID:', unit.id);

        // Check if user exists
        let user = await prisma.user.findFirst({
            where: { username: 'kadiv_pendidikan' }
        });

        if (!user) {
            console.log('Creating User Kepala Divisi Pendidikan...');
            const bcrypt = require('bcryptjs');
            const password = await bcrypt.hash('password123', 10);
            user = await prisma.user.create({
                data: {
                    username: 'kadiv_pendidikan',
                    name: 'Kepala Divisi Pendidikan',
                    password: password,
                    role: 'GLOBAL_TERBATAS',
                    position: 'Kepala Divisi Pendidikan',
                    unitId: unit.id
                }
            });
        }
        
        console.log('User created/found:', user.username);
        
    } catch (e) {
        console.error('DB_ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
