const { sendMessage } = require('./services/whatsappService');

async function test() {
    console.log(`[${new Date().toLocaleTimeString()}] 🚀 Starting staggered queue test...`);

    // Simulate 3 messages being sent at the same time
    const p1 = sendMessage('08123456789', 'Pesan 1 (Antrian)');
    const p2 = sendMessage('08123456789', 'Pesan 2 (Antrian)');
    const p3 = sendMessage('08123456789', 'Pesan 3 (Antrian)');

    console.log('Messages queued. Waiting for completion...');

    await Promise.all([p1, p2, p3]);

    console.log(`[${new Date().toLocaleTimeString()}] ✅ Test finished.`);
}

test();
