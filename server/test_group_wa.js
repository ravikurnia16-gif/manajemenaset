const whatsappService = require('./services/whatsappService');

const GROUP_ID = '12036341954292088@g.us';

(async () => {
    console.log(`Testing sending message to Group A: ${GROUP_ID}`);
    const result = await whatsappService.sendMessage(GROUP_ID, "Tes Pesan Langsung ke Grup dari Server.");

    if (result) {
        console.log("✅ Berhasil kirim pesan!");
        console.log(result);
    } else {
        console.error("❌ Gagal kirim pesan.");
    }
})();
