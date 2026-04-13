const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { clearCache } = require('../services/waTemplateService');

// Default templates to seed
const DEFAULT_TEMPLATES = [
    // === KENDARAAN ===
    {
        slug: 'BUS_BOOKING_CREATED_REQUESTER',
        name: 'Konfirmasi Booking Bus (ke Pemesan)',
        category: 'KENDARAAN',
        description: 'Dikirim ke pemesan setelah booking bus berhasil dibuat.',
        content: `✅ *BOOKING BUS BERHASIL* 🚌\n\nBismillah Ustadz/Ustadzah *{{nama_pemesan}}*,\n\nPemesanan bus Anda telah dikonfirmasi:\n📍 *Tujuan*: {{tujuan}}\n📅 *Jadwal*: {{tanggal}}\n🚌 *Armada*: {{nama_bus}}\n👥 *Penumpang*: {{jumlah_penumpang}} orang\n🏢 *Unit*: {{unit}}\n\n📋 *Kode Booking*: {{token}}\n\n_Sistem Manajemen Aset_`,
        recipientPositions: '[]',
        availableVars: '["nama_pemesan","tujuan","tanggal","nama_bus","jumlah_penumpang","unit","token"]'
    },
    {
        slug: 'BUS_BOOKING_CREATED_ADMIN',
        name: 'Notifikasi Booking Bus Baru (ke Admin)',
        category: 'KENDARAAN',
        description: 'Dikirim ke Kabid & Staff Aset setelah ada booking bus baru.',
        content: `🚌 *BOOKING BUS BARU* 🚌\n\n📍 *Tujuan*: {{tujuan}}\n📅 *Jadwal*: {{tanggal}}\n👤 *Pemesan*: {{nama_pemesan}}\n📞 *Kontak*: wa.me/{{telepon_pemesan}}\n🏢 *Unit*: {{unit}}\n👥 *Penumpang*: {{jumlah_penumpang}} orang\n🚌 *Armada*: {{nama_bus}} ({{plat_bus}})\n👤 *Supir*: {{nama_supir}}\n\nMohon dipastikan persiapan armada. Syukron.`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana","Staff Manajemen Aset"]',
        availableVars: '["nama_pemesan","telepon_pemesan","tujuan","tanggal","nama_bus","plat_bus","nama_supir","jumlah_penumpang","unit","token"]'
    },
    {
        slug: 'BUS_REMINDER_H1',
        name: 'Pengingat Konfirmasi Bus H-1',
        category: 'KENDARAAN',
        description: 'Dikirim otomatis H-1 ke pemesan untuk konfirmasi jadwal JADI/BATAL.',
        content: `📢 *KONFIRMASI JADWAL BUS (H-1)* 🚌\n\nBismillah Ustadz/Ustadzah *{{nama_pemesan}}*,\n\nKami dari Bagian Sarpras ingin memastikan kembali rencana keberangkatan bus untuk:\n📍 *Tujuan*: {{tujuan}}\n📅 *Jadwal*: {{tanggal}}\n\nBerikut armada yang Ustadz/Ustadzah pesan. Mohon klik link di bawah ini untuk konfirmasi apakah jadwal masing-masing bus tetap *JADI* dilaksanakan atau *BATAL*:\n\n{{daftar_bus_link}}\n\nKonfirmasi Ustadz/Ustadzah sangat kami harapkan agar kami dapat menyiapkan armada dengan maksimal. Syukron.\n_Sistem Manajemen Aset_`,
        recipientPositions: '[]',
        availableVars: '["nama_pemesan","tujuan","tanggal","daftar_bus_link"]'
    },
    {
        slug: 'BUS_CONFIRM_JADI_STAFF',
        name: 'Konfirmasi Bus JADI (ke Staff)',
        category: 'KENDARAAN',
        description: 'Dikirim ke Staff setelah pemesan mengkonfirmasi jadwal TETAP JADI.',
        content: `✅ *KONFIRMASI JADWAL BUS (FIX)*\n\nAlhamdulillah! Pemesan *{{nama_pemesan}}* telah mengonfirmasi bahwa jadwal bus ke *{{tujuan}}* besok *TETAP JADI*.\n\n🚌 *Armada*: {{nama_bus}} ({{plat_bus}})\n👤 *Driver*: {{nama_supir}}\n\nMohon dipastikan armada dan personil dalam kondisi prima. Jazakallah Khairan.\n_Sistem Manajemen Aset_`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_pemesan","tujuan","nama_bus","plat_bus","nama_supir"]'
    },
    {
        slug: 'BUS_CONFIRM_BATAL_STAFF',
        name: 'Konfirmasi Bus BATAL (ke Staff)',
        category: 'KENDARAAN',
        description: 'Dikirim ke Staff setelah pemesan membatalkan jadwal.',
        content: `❌ *PEMBATALAN JADWAL BUS*\n\nInformasi: Pemesan *{{nama_pemesan}}* telah *MEMBATALKAN* jadwal bus ke *{{tujuan}}* untuk besok.\n\nArmada *{{nama_bus}}* ({{plat_bus}}) kini tersedia kembali untuk unit lain yang membutuhkan. Syukron.\n_Sistem Manajemen Aset_`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_pemesan","tujuan","nama_bus","plat_bus"]'
    },
    {
        slug: 'BUS_DRIVER_ASSIGNED',
        name: 'Penugasan Supir Bus',
        category: 'KENDARAAN',
        description: 'Dikirim ke supir saat ditugaskan untuk perjalanan bus.',
        content: `🚌 *PENUGASAN PERJALANAN BUS*\n\nUstadz *{{nama_supir}}*, Anda ditugaskan untuk mengemudi:\n\n📍 *Tujuan*: {{tujuan}}\n📅 *Jadwal*: {{tanggal}}\n🚌 *Armada*: {{nama_bus}} ({{plat_bus}})\n👤 *Pemesan*: {{nama_pemesan}}\n👥 *Penumpang*: {{jumlah_penumpang}} orang\n\nMohon mempersiapkan diri dan armada. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_supir","tujuan","tanggal","nama_bus","plat_bus","nama_pemesan","jumlah_penumpang"]'
    },
    {
        slug: 'BUS_COMPLETED_INVOICE',
        name: 'Kuitansi Pelunasan Bus',
        category: 'KENDARAAN',
        description: 'Dikirim ke pemesan saat pembayaran sudah dilunasi.',
        content: `🧾 *KUITANSI PELUNASAN BUS YDI* 🚌\n\nAlhamdulillah Ustadz/Ustadzah *{{nama_pemesan}}*,\nPembayaran sewa operasional bus telah kami terima.\n\n📍 *Tujuan*: {{tujuan}}\n📅 *Tanggal*: {{tanggal}}\n💰 *Nominal*: Rp {{tagihan}}\n\n🧾 Kuitansi digital: {{link_invoice}}\n\nJazakumullahu khairan atas kerjasamanya.\n_Sistem Manajemen Aset_`,
        recipientPositions: '[]',
        availableVars: '["nama_pemesan","tujuan","tanggal","tagihan","link_invoice"]'
    },
    {
        slug: 'BUS_UNPAID_REMINDER',
        name: 'Pengingat Tagihan Bus Belum Lunas',
        category: 'KENDARAAN',
        description: 'Dikirim berkala ke Staff untuk tagihan bus yang belum dibayar.',
        content: `💰 *PENGINGAT TAGIHAN BUS BELUM LUNAS*\n\nBerikut daftar tagihan yang belum diselesaikan:\n\n{{daftar_tagihan}}\n\nMohon ditindaklanjuti. Syukron.\n_Sistem Manajemen Aset_`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["daftar_tagihan"]'
    },

    // === PEMELIHARAAN ===
    {
        slug: 'MAINTENANCE_CREATED_SUBMITTER',
        name: 'Konfirmasi Laporan Pemeliharaan (ke Pelapor)',
        category: 'PEMELIHARAAN',
        description: 'Dikirim ke pelapor setelah laporan pemeliharaan berhasil dibuat.',
        content: `*Info Laporan Pemeliharaan*\n\nUstadz/Ustadzah *{{nama_pelapor}}*, laporan pemeliharaan Anda telah kami terima.\n\n📋 *Judul*: {{judul}}\n📄 *Kode*: {{kode}}\n🔧 *Tipe*: {{tipe}}\n\nMohon menunggu proses pengerjaan.`,
        recipientPositions: '[]',
        availableVars: '["nama_pelapor","judul","kode","tipe"]'
    },
    {
        slug: 'MAINTENANCE_CREATED_ADMIN',
        name: 'Notifikasi Laporan Pemeliharaan Baru (ke Admin)',
        category: 'PEMELIHARAAN',
        description: 'Dikirim ke Staff Aset saat ada laporan baru masuk.',
        content: `🔧 *LAPORAN PEMELIHARAAN BARU*\n\n👤 *Pelapor*: {{nama_pelapor}}\n📞 *Kontak*: wa.me/{{telepon_pelapor}}\n⚡ *Urgensi*: {{urgensi}}\n📂 *Kategori*: {{kategori}}\n📜 *Kode*: {{kode}}\n📋 *Judul*: {{judul}}\n📝 *Masalah*: {{deskripsi}}\n\n📦 *Aset Terkait*:\n{{daftar_aset}}\n\nMohon segera ditindaklanjuti.\n\nSyukron jazakumullahu khairan.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_pelapor","telepon_pelapor","urgensi","kategori","kode","judul","deskripsi","daftar_aset"]'
    },
    {
        slug: 'MAINTENANCE_STATUS_UPDATE',
        name: 'Update Status Pemeliharaan (ke Pelapor)',
        category: 'PEMELIHARAAN',
        description: 'Dikirim ke pelapor saat status laporan berubah.',
        content: `*Info Laporan Pemeliharaan*\n\nUstadz/Ustadzah *{{nama_pelapor}}*,\n\nLaporan Anda *"{{judul}}"* ({{kode}})\nStatus terbaru: *{{status}}*\n{{detail_tambahan}}\n`,
        recipientPositions: '[]',
        availableVars: '["nama_pelapor","judul","kode","status","detail_tambahan"]'
    },
    {
        slug: 'MAINTENANCE_ASSIGNED_TECH',
        name: 'Penugasan Teknisi (ke Teknisi)',
        category: 'PEMELIHARAAN',
        description: 'Dikirim ke teknisi saat ditugaskan untuk perbaikan.',
        content: `🛠 *PENUGASAN PEMELIHARAAN*\n\nHalo *{{nama_teknisi}}*,\nAnda ditugaskan untuk memperbaiki: *{{judul}}*.\n\n📜 *Kode*: {{kode}}\n📋 *Judul*: {{judul}}\n📝 *Masalah*: {{deskripsi}}\n\nSyukron jazakumullahu khairan.`,
        recipientPositions: '[]',
        availableVars: '["nama_teknisi","judul","kode","deskripsi"]'
    },

    // === PENGADAAN ===
    {
        slug: 'PROCUREMENT_STATUS_UPDATE',
        name: 'Update Status Pengadaan',
        category: 'PENGADAAN',
        description: 'Dikirim ke pengaju saat status pengadaan berubah.',
        content: `📦 *UPDATE PENGADAAN*\n\nUstadz/Ustadzah *{{nama_pengaju}}*,\n\nPengajuan *"{{judul}}"* ({{kode}})\nStatus terbaru: *{{status}}*\n\n{{detail_tambahan}}`,
        recipientPositions: '[]',
        availableVars: '["nama_pengaju","judul","kode","status","detail_tambahan"]'
    },

    // === PERSONALIA ===
    {
        slug: 'ASSIGNMENT_NEW',
        name: 'Penugasan Baru (ke Staff)',
        category: 'PERSONALIA',
        description: 'Dikirim ke staff saat mendapat tugas baru.',
        content: `📋 *PENUGASAN BARU*\n\nHalo *{{nama_staff}}*,\n\nAnda mendapat tugas baru:\n📝 *Judul*: {{judul}}\n📅 *Deadline*: {{deadline}}\n⚡ *Prioritas*: {{prioritas}}\n\n{{deskripsi}}\n\nMohon segera ditindaklanjuti. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_staff","judul","deadline","prioritas","deskripsi"]'
    },
    {
        slug: 'ASSIGNMENT_DEADLINE_REMINDER',
        name: 'Pengingat Deadline Tugas',
        category: 'PERSONALIA',
        description: 'Dikirim saat deadline tugas mendekat.',
        content: `⏰ *PENGINGAT DEADLINE*\n\nHalo *{{nama_staff}}*,\n\nTugas Anda *"{{judul}}"* akan jatuh tempo pada *{{deadline}}*.\nProgress saat ini: *{{progress}}%*\n\nMohon segera diselesaikan. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_staff","judul","deadline","progress"]'
    }
];

// Get all templates
const getAllTemplates = async (req, res) => {
    try {
        const templates = await prisma.waNotificationTemplate.findMany({
            orderBy: [{ category: 'asc' }, { name: 'asc' }]
        });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single template
const getTemplateBySlug = async (req, res) => {
    try {
        const template = await prisma.waNotificationTemplate.findUnique({
            where: { slug: req.params.slug }
        });
        if (!template) return res.status(404).json({ error: 'Template tidak ditemukan' });
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update template
const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, recipientPositions, isActive } = req.body;

        const updateData = {};
        if (content !== undefined) updateData.content = content;
        if (recipientPositions !== undefined) updateData.recipientPositions = typeof recipientPositions === 'string' ? recipientPositions : JSON.stringify(recipientPositions);
        if (isActive !== undefined) updateData.isActive = isActive;

        const template = await prisma.waNotificationTemplate.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        clearCache();
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Seed default templates (only insert if slug doesn't exist)
const seedTemplates = async (req, res) => {
    try {
        let created = 0;
        for (const tpl of DEFAULT_TEMPLATES) {
            const exists = await prisma.waNotificationTemplate.findUnique({
                where: { slug: tpl.slug }
            });
            if (!exists) {
                await prisma.waNotificationTemplate.create({ data: tpl });
                created++;
            }
        }
        res.json({ message: `${created} template baru berhasil ditambahkan.`, total: DEFAULT_TEMPLATES.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Reset a template to its default content
const resetTemplate = async (req, res) => {
    try {
        const { slug } = req.params;
        const defaultTpl = DEFAULT_TEMPLATES.find(t => t.slug === slug);
        if (!defaultTpl) return res.status(404).json({ error: 'Template default tidak ditemukan' });

        const template = await prisma.waNotificationTemplate.update({
            where: { slug },
            data: {
                content: defaultTpl.content,
                recipientPositions: defaultTpl.recipientPositions
            }
        });

        clearCache();
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllTemplates,
    getTemplateBySlug,
    updateTemplate,
    seedTemplates,
    resetTemplate,
    DEFAULT_TEMPLATES
};
