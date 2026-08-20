
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    await prisma.notificationRule.upsert({
        where: { eventName: 'NEW_UNIFORM_ORDER' },
        update: {},
        create: {
            eventName: 'NEW_UNIFORM_ORDER',
            messageTpl: 'Halo Staff Gudang,\n\nAda pesanan seragam baru masuk:\nNama: [NAMA_PEMESAN]\nRef: [NO_REFERENSI]\nTotal: [TOTAL_TAGIHAN]\n\nCek pesanan: [LINK_INVOICE]',
            targetGroup: '',
            isActive: true
        }
    });
    console.log('Rule created');
}
main().catch(console.error).finally(() => prisma.\());

