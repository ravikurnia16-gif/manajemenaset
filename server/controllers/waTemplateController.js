const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { clearCache } = require('../services/waTemplateService');

// Default templates to seed
const DEFAULT_TEMPLATES = [
    // === KENDARAAN (BUS) ===
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
    {
        slug: 'BUS_COMPLETED_FINANCE',
        name: 'Notifikasi Selesai Trip (ke Pemesan)',
        category: 'KENDARAAN',
        description: 'Dikirim ke pemesan setelah perjalanan bus seluruhnya selesai untuk administrasi.',
        content: `🏁 *PERJALANAN SELESAI*\n\nAlhamdulillah, perjalanan bus ke *{{tujuan}}* telah selesai.\nMohon segera selesaikan administrasi di Bagian Keuangan Sarpras (Bapak Ridho). Syukron.`,
        recipientPositions: '[]',
        availableVars: '["tujuan"]'
    },
    {
        slug: 'BUS_COMPLETED_FINANCE_STAFF',
        name: 'Notifikasi Selesai Trip (ke Staff Keuangan)',
        category: 'KENDARAAN',
        description: 'Dikirim ke Staff Keuangan untuk memantau administrasi trip selesai.',
        content: `🏁 *PERJALANAN BUS SELESAI*\n\nArmada dari perjalanan ke *{{tujuan}}* (Pemesan: {{nama_pemesan}}) telah kembali.\n\nMohon dipantau pengadministrasiannya. Syukron.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["tujuan","nama_pemesan"]'
    },

    // === KENDARAAN (UMUM) ===
    {
        slug: 'VEHICLE_BOOKING_CREATED_ADMIN',
        name: 'Booking Kendaraan Baru (ke Admin)',
        category: 'KENDARAAN',
        description: 'Dikirim ke admin saat ada pemesanan kendaraan umum.',
        content: `🚗 *BOOKING KENDARAAN BARU*\n\n👤 *Pemesan*: {{nama_pemesan}}\n📅 *Waktu*: {{waktu}}\n🚗 *Armada*: {{nama_kendaraan}}\n📍 *Tujuan*: {{tujuan}}\n\nMohon ditinjau di sistem.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_pemesan","waktu","nama_kendaraan","tujuan"]'
    },
    {
        slug: 'VEHICLE_BOOKING_CREATED_KABID',
        name: 'Booking Kendaraan (ke Kabid - Prioritas)',
        category: 'KENDARAAN',
        description: 'Dikirim ke Kabid untuk booking prioritas pimpinan yayasan.',
        content: `⭐ *BOOKING KENDARAAN PRIORITAS*\n\nAda pemesanan kendaraan pimpinan yayasan:\n👤 *Pemesan*: {{nama_pemesan}}\n📅 *Waktu*: {{waktu}}\n📍 *Tujuan*: {{tujuan}}\n\n*Status*: Sistem telah memberikan Persetujuan Otomatis.`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["nama_pemesan","waktu","tujuan"]'
    },
    {
        slug: 'VEHICLE_BOOKING_STATUS_UPDATE',
        name: 'Update Status Booking Kendaraan',
        category: 'KENDARAAN',
        description: 'Dikirim ke pemesan saat booking disetujui/ditolak.',
        content: `🚗 *UPDATE BOOKING KENDARAAN*\n\nBismillah, permintaan kendaraan Anda untuk *{{nama_kendaraan}}* telah diupdate.\nStatus terbaru: *{{status}}*\n\nSelamat bertugas!`,
        recipientPositions: '[]',
        availableVars: '["nama_kendaraan","status"]'
    },
    {
        slug: 'VEHICLE_BOOKING_FINISHED',
        name: 'Booking Kendaraan Selesai/Ditolak',
        category: 'KENDARAAN',
        description: 'Dikirim ke pemesan saat perjalanan selesai atau ditolak.',
        content: `🚗 *INFO BOOKING KENDARAAN*\n\nPermintaan Anda untuk kendaraan *{{nama_kendaraan}}* telah {{status}}.\n{{catatan}}`,
        recipientPositions: '[]',
        availableVars: '["nama_kendaraan","status","catatan"]'
    },
    {
        slug: 'VEHICLE_BOOKING_DISCREPANCY_KABID',
        name: 'Peringatan Diskrepansi Odometer',
        category: 'KENDARAAN',
        description: 'Dikirim ke Kabid jika ada selisih kilometer yang tidak wajar.',
        content: `⚠️ *PERINGATAN DISKREPANSI KM*\n\nTerdeteksi selisih kilometer yang tidak wajar pada kendaraan *{{nama_kendaraan}}*.\nKm Awal: {{km_awal}}\nKm Akhir: {{km_akhir}}\n\nMohon segera divalidasi.`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["nama_kendaraan","km_awal","km_akhir"]'
    },
    {
        slug: 'VEHICLE_BOOKING_FUEL_ALERT',
        name: 'Notifikasi Pengisian BBM',
        category: 'KENDARAAN',
        description: 'Notifikasi ke admin untuk memantau pengisian BBM kendaraan.',
        content: `⛽ *PENGISIAN BBM KENDARAAN*\n\nKendaraan {{nama_kendaraan}} telah melakukan pengisian BBM.\nJumlah: {{liter}} Liter\nBy: {{nama_driver}}`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_kendaraan","liter","nama_driver"]'
    },
    {
        slug: 'VEHICLE_REMINDER_H1',
        name: 'Reminder Pengembalian Kendaraan',
        category: 'KENDARAAN',
        description: 'Reminder ke user untuk menginput KM akhir setelah perjalanan.',
        content: `⚠️ *REMINDER PENGEMBALIAN ARMAD*\n\nHalo {{nama_pemesan}},\nMohon segera selesaikan perjalanan melalui aplikasi Sarpras dengan menginputkan Kilometer Akhir agar armada dapat digunakan oleh pengguna lain. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_pemesan"]'
    },
    {
        slug: 'VEHICLE_BOOKING_REVIEW',
        name: 'Review Pemakaian Kendaraan',
        category: 'KENDARAAN',
        description: 'Notifikasi ke user jika kendaraan tidak jadi digunakan.',
        content: `🚗 *REVIEW PEMAKAIAN*\n\nUstadz/Ustadzah, jika kendaraan tidak jadi digunakan, mohon batalkan request agar armada dapat digunakan oleh pengguna lain. Syukron.`,
        recipientPositions: '[]',
        availableVars: '[]'
    },
    {
        slug: 'VEHICLE_TAX_EXPIRING_ADMIN',
        name: 'Reminder Pajak Kendaraan Expired',
        category: 'KENDARAAN',
        description: 'Notifikasi masa berlaku pajak akan habis ke admin.',
        content: `⚠️ *PAJAK KENDARAAN EXPIRED*\n\nPajak kendaraan *{{nama_kendaraan}}* ({{no_pol}}) akan habis dalam *{{sisa_hari}}* hari.\nMohon segera diurus perpanjangannya.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_kendaraan","no_pol","sisa_hari"]'
    },
    {
        slug: 'VEHICLE_PLATE_EXPIRING_ADMIN',
        name: 'Reminder Plat Nomor/KIR Expired',
        category: 'KENDARAAN',
        description: 'Notifikasi masa berlaku plat/KIR akan habis ke admin.',
        content: `⚠️ *PLATE/KIR EXPIRED*\n\nMasa berlaku STNK/KIR kendaraan *{{nama_kendaraan}}* ({{no_pol}}) akan habis dalam *{{sisa_hari}}* hari.\nMohon tindak lanjutnya.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_kendaraan","no_pol","sisa_hari"]'
    },
    {
        slug: 'VEHICLE_DRIVER_EXPIRED_ADMIN',
        name: 'Reminder SIM Driver Expired',
        category: 'KENDARAAN',
        description: 'Notifikasi masa berlaku SIM driver akan habis ke admin.',
        content: `⚠️ *SIM DRIVER EXPIRED*\n\nMasa berlaku SIM driver *{{nama_driver}}* akan habis dalam *{{sisa_hari}}* hari.\nMohon segera diingatkan.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_driver","sisa_hari"]'
    },
    {
        slug: 'VEHICLE_REPORT_ADMIN',
        name: 'Laporan Mingguan Kendaraan (Belum)',
        category: 'KENDARAAN',
        description: 'Teguran ke staff yang belum menginput laporan mingguan kendaraan.',
        content: `📝 *TEGURAN LAPORAN KENDARAAN*\n\nBismillah {{nama_staff}},\nAnda belum menginput laporan rutin mingguan untuk kendaraan yang Anda kelola.\n\nMohon segera diselesaikan. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_staff"]'
    },
    {
        slug: 'VEHICLE_MAINTENANCE_CREATED_ADMIN',
        name: 'Servis Kendaraan Baru',
        category: 'KENDARAAN',
        description: 'Notifikasi pengajuan servis/pemeliharaan kendaraan.',
        content: `🛠 *SERVIS KENDARAAN BARU*\n\nPengajuan servis untuk *{{nama_kendaraan}}* telah masuk.\nDeskripsi: {{deskripsi}}\n\nMohon ditinjau admin.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_kendaraan","deskripsi"]'
    },
    {
        slug: 'VEHICLE_MAINTENANCE_STATUS_UPDATE',
        name: 'Update Status Servis Kendaraan',
        category: 'KENDARAAN',
        description: 'Notifikasi perubahan status pengerjaan servis kendaraan.',
        content: `🛠 *UPDATE SERVIS KENDARAAN*\n\nServis kendaraan *{{nama_kendaraan}}* kini berstatus: *{{status}}*.\nCatatan: {{catatan}}`,
        recipientPositions: '[]',
        availableVars: '["nama_kendaraan","status","catatan"]'
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
        slug: 'PROCUREMENT_NEW_SUBMITTER',
        name: 'Konfirmasi Pengadaan (ke Pengaju)',
        category: 'PENGADAAN',
        description: 'Dikirim ke pengaju setelah membuat permintaan pengadaan.',
        content: `📦 *PENGADAAN DITERIMA*\n\nPengajuan pengadaan *"{{judul}}"* Anda telah masuk ke sistem.\nKode: {{kode}}\n\nMohon menunggu peninjauan pimpinan.`,
        recipientPositions: '[]',
        availableVars: '["nama_pengaju","judul","kode"]'
    },
    {
        slug: 'PROCUREMENT_NEW_ADMIN',
        name: 'Pengadaan Baru (ke Admin)',
        category: 'PENGADAAN',
        description: 'Notifikasi ke admin pengadaan saat ada item baru masuk.',
        content: `📦 *PENGAJUAN PENGADAAN BARU*\n\n👤 *Pengaju*: {{nama_pengaju}}\n📋 *Judul*: {{judul}}\n📜 *Kode*: {{kode}}\n\nMohon segera tinjau alur persetujuan.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_pengaju","judul","kode"]'
    },
    {
        slug: 'PROCUREMENT_STATUS_UPDATE',
        name: 'Update Status Pengadaan',
        category: 'PENGADAAN',
        description: 'Dikirim ke pengaju saat status pengadaan berubah.',
        content: `📦 *UPDATE PENGADAAN*\n\nUstadz/Ustadzah *{{nama_pengaju}}*,\n\nPengajuan *"{{judul}}"* ({{kode}})\nStatus terbaru: *{{status}}*\n\n{{detail_tambahan}}`,
        recipientPositions: '[]',
        availableVars: '["nama_pengaju","judul","kode","status","detail_tambahan"]'
    },
    {
        slug: 'PROCUREMENT_DIRECT_ASSIGNED',
        name: 'Penugasan Langsung Pengadaan',
        category: 'PENGADAAN',
        description: 'Notifikasi ke PIC saat ditugaskan langsung oleh pimpinan.',
        content: `📦 *MANDAT PENGADAAN*\n\nUstadz {{nama_pic}},\nAnda ditugaskan sebagai PIC untuk pengadaan: {{judul}}.\n\nMohon segera diproses sesuai arahan. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_pic","judul"]'
    },
    {
        slug: 'PROCUREMENT_BAST_COMPLETED',
        name: 'Berita Acara Selesai (ke Pengaju)',
        category: 'PENGADAAN',
        description: 'Dikirim saat barang sudah diserahterimakan (BAST).',
        content: `✅ *PENGADAAN SELESAI (BAST)*\n\nAlhamdulillah, barang untuk pengadaan *"{{judul}}"* telah diserahterimakan.\n\nMohon jaga dan rawat aset ini dengan baik. Jazakallah Khairan.`,
        recipientPositions: '[]',
        availableVars: '["judul"]'
    },

    // === PERSONALIA ===
    {
        slug: 'PERSONNEL_ASSIGNMENT_NEW',
        name: 'Penugasan Baru (ke Staff)',
        category: 'PERSONALIA',
        description: 'Dikirim ke staff saat mendapat tugas personalia baru.',
        content: `📋 *PENUGASAN KERJA BARU*\n\nHalo *{{nama_staff}}*,\n\nAnda mendapat penugasan baru:\n📝 *Tugas*: {{judul}}\n📅 *Target*: {{deadline}}\n\nMohon dilaksanakan dengan amanah. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_staff","judul","deadline"]'
    },
    {
        slug: 'PERSONNEL_ASSIGNMENT_REMINDER',
        name: 'Reminder Deadline Personalia',
        category: 'PERSONALIA',
        description: 'Pengingat otomatis saat deadline tugas personalia mendekat.',
        content: `⏰ *PENGINGAT DEADLINE*\n\nHalo {{nama_staff}},\nTugas *"{{judul}}"* sudah mendekati deadline ({{deadline}}).\n\nMohon segera diselesaikan. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_staff","judul","deadline"]'
    },
    {
        slug: 'PERSONNEL_ASSIGNMENT_DONE',
        name: 'Tugas Selesai (ke Atasan)',
        category: 'PERSONALIA',
        description: 'Notifikasi ke pimpinan saat staff menyelesaikan tugas.',
        content: `✅ *TUGAS SELESAI*\n\nStaff *{{nama_staff}}* telah menyelesaikan tugas: {{judul}}.\nMohon dilakukan peninjauan progres.`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["nama_staff","judul"]'
    },
    {
        slug: 'PERSONNEL_SUMMARY_DAILY',
        name: 'Rekap Laporan Harian (ke Kabid)',
        category: 'PERSONALIA',
        description: 'Rekapitulasi progres kerja harian staff ke pimpinan.',
        content: `📊 *REKAP LAPORAN HARIAN STAFF*\n\nBerikut ringkasan progres kerja hari ini:\n\n{{daftar_progres}}\n\n_Sistem Manajemen Aset_`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["daftar_progres"]'
    },
    {
        slug: 'PERSONNEL_RATING_NEW',
        name: 'Notifikasi Penilaian Pimpinan',
        category: 'PERSONALIA',
        description: 'Ulasan atau rating dari pimpinan terhadap kinerja staff.',
        content: `⭐ *PENILAIAN KINERJA*\n\nHalo {{nama_staff}},\nAnda mendapatkan ulasan dari Pimpinan:\n\n"{{ulasan}}"\n\nTerus tingkatkan kinerja ya! Jazakallah Khairan.`,
        recipientPositions: '[]',
        availableVars: '["nama_staff","ulasan"]'
    },
    {
        slug: 'PERSONNEL_PUNISHMENT_NEW',
        name: 'Notifikasi Teguran (ke Staff)',
        category: 'PERSONALIA',
        description: 'Dikirim ke staff yang tidak melengkapi laporan kerja.',
        content: `⚠️ *TEGURAN KEDISIPLINAN*\n\nHalo {{nama_staff}},\nSistem mencatat Anda belum melengkapi laporan kerja pada hari: {{hari_absen}}.\n\nMohon segera dilengkapi. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_staff","hari_absen"]'
    },

    // === PINJAM ASET ===
    {
        slug: 'LOAN_CREATED_ADMIN',
        name: 'Permohonan Pinjam Aset (ke Admin)',
        category: 'UMUM',
        description: 'Dikirim ke admin saat ada pengajuan pinjam aset yayasan.',
        content: `📢 *PERMOHONAN PINJAM ASET*\n\nUser *{{nama_peminjam}}* mengajukan peminjaman aset:\n{{daftar_aset}}\n\nMohon tinjau di sistem. Syukron.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_peminjam","daftar_aset"]'
    },
    {
        slug: 'LOAN_STATUS_UPDATE',
        name: 'Peringatan Terlambat Kembali',
        category: 'UMUM',
        description: 'Dikirim ke peminjam jika melewati batas pengembalian.',
        content: `⚠️ *PERINGATAN TERLAMBAT KEMBALI*\n\nHalo {{nama_peminjam}},\nMohon segera mengembalikan aset berikut yang telah melewati batas waktu:\n\n{{daftar_aset}}\n\nTerima kasih.`,
        recipientPositions: '[]',
        availableVars: '["nama_peminjam","daftar_aset"]'
    },

    // === KALENDER ===
    {
        slug: 'CALENDAR_EVENT_NEW',
        name: 'Kegiatan Baru di Kalender',
        category: 'UMUM',
        description: 'Notifikasi kegiatan baru yang melibatkan PIC.',
        content: `📅 *KEGIATAN SARPRAS BARU*\n\nAnda ditunjuk sebagai PIC untuk:\n📍 *Kegiatan*: {{nama_kegiatan}}\n📅 *Waktu*: {{waktu}}\n\nSemangat berkhidmah!`,
        recipientPositions: '[]',
        availableVars: '["nama_kegiatan","waktu"]'
    },
    {
        slug: 'CALENDAR_SUMMARY_WEEKLY',
        name: 'Rekap Kegiatan Mingguan',
        category: 'UMUM',
        description: 'Daftar seluruh agenda kegiatan dalam satu pekan.',
        content: `📅 *LAPORAN KEGIATAN PEKAN INI*\n\nBerikut daftar agenda kegiatan:\n\n{{daftar_kegiatan}}\n\nSyukron.`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["daftar_kegiatan"]'
    },

    // === LOGISTIK (SERAGAM) ===
    {
        slug: 'UNIFORM_ORDER_CREATED_CUSTOMER',
        name: 'Konfirmasi Pesanan Seragam',
        category: 'GUDANG',
        description: 'Dikirim ke pemesan setelah order seragam dibuat.',
        content: `👕 *PESANAN SERAGAM DITERIMA*\n\nPesanan seragam Anda nomor {{no_order}} telah kami terima.\nTotal: Rp {{total}}\n\nSilakan lakukan pembayaran di Bagian Logistik.`,
        recipientPositions: '[]',
        availableVars: '["no_order","total"]'
    },
    {
        slug: 'UNIFORM_ITEM_STATUS_COMPLETED',
        name: 'Notifikasi Seragam Ready',
        category: 'GUDANG',
        description: 'Dikirim saat barang seragam siap diambil.',
        content: `👕 *SERAGAM SIAP DIAMBIL*\n\nAlhamdulillah, item seragam {{nama_item}} untuk order {{no_order}} sudah tersedia.\nSilakan ambil di Bagian Logistik. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_item","no_order"]'
    },

    // === UMUM / ASET ===
    {
        slug: 'ASSET_SUMMARY_WEEKLY',
        name: 'Rekap Mingguan Aset Baru',
        category: 'UMUM',
        description: 'Rekapitulasi penambahan aset mingguan ke pimpinan.',
        content: `📈 *RINGKASAN ASET MINGGUAN*\n\nBerikut penambahan aset baru pekan ini:\n\n{{rekap_aset}}\n\n_Sistem Manajemen Aset_`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["rekap_aset"]'
    },
    {
        slug: 'MOVEMENT_CREATED_ADMIN',
        name: 'Mutasi Aset Baru',
        category: 'UMUM',
        description: 'Notifikasi saat terjadi perpindahan/mutasi aset.',
        content: `📦 *MUTASI ASET BARU*\n\nAset {{nama_aset}} telah dimutasi ke Unit {{unit_tujuan}}.\n\nMohon tindak lanjut pembaruan inventaris.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_aset","unit_tujuan"]'
    },
    {
        slug: 'TEST_WA_MSG',
        name: 'Tes Koneksi WhatsApp',
        category: 'UMUM',
        description: 'Digunakan untuk mencoba apakah API WA berjalan lancar.',
        content: `🧪 *TES KONEKSI WA SISTEM*\n\nBismillah, pesan ini dikirim untuk memastikan sistem notifikasi WhatsApp Manajemen Aset berfungsi dengan baik.\n\n_Pesan ini diabaikan saja._`,
        recipientPositions: '[]',
        availableVars: '[]'
    }
];
