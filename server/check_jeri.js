const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkJeri() {
    try {
        console.log('Checking user with NIP: 18121079...');
        const user = await prisma.user.findFirst({
            where: { nip: '18121079' }
        });

        if (user) {
            console.log('USER FOUND:');
            console.log('ID:', user.id);
            console.log('Name:', user.name);
            console.log('NIP:', user.nip);
            console.log('Phone:', user.phone || '(EMPTY) - WA WILL FAIL');
            console.log('Role:', user.role);

            if (!user.phone) {
                console.error('!!! WARNING: Phone number is missing. WA notifications will NOT work. !!!');
            } else {
                console.log('Phone number exists. user.phone');
            }
        } else {
            console.error('!!! USER NOT FOUND !!!');
            console.error('No user with NIP 18121079 exists in the database.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkJeri();
