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
    {
        slug: 'VEHICLE_BOOKING_CREATED_ADMIN',
        name: 'Booking Kendaraan Baru (ke Admin & PIC)',
        category: 'KENDARAAN',
        description: 'Dikirim ke admin dan PIC armada saat ada pemesanan kendaraan baru.',
        content: `🚗 *BOOKING KENDARAAN BARU*\n\n👤 *Pemesan*: {{nama_pemesan}}\n📅 *Waktu*: {{waktu}}\n🚗 *Armada*: {{nama_kendaraan}}\n👤 *Driver*: {{nama_supir}}\n📍 *Tujuan*: {{tujuan}}\n📌 *Keperluan*: {{keperluan}}\n👨‍💼 *PIC Armada*: {{nama_pic}}\n\n*Status*: {{status}}\n\nMohon ditinjau di sistem.`,
        recipientPositions: '["Staff Manajemen Aset","PIC Armada"]',
        availableVars: '["nama_pemesan","waktu","nama_kendaraan","nama_supir","tujuan","keperluan","nama_pic","status"]'
    },
    {
        slug: 'VEHICLE_BOOKING_CREATED_KABID',
        name: 'Booking Kendaraan (ke Kabid - Prioritas)',
        category: 'KENDARAAN',
        description: 'Dikirim ke Kabid untuk booking prioritas pimpinan yayasan.',
        content: `⭐ *BOOKING KENDARAAN PRIORITAS*\n\nAda pemesanan kendaraan pimpinan yayasan:\n👤 *Pemesan*: {{nama_pemesan}}\n📅 *Waktu*: {{waktu}}\n🚗 *Armada*: {{nama_kendaraan}}\n👤 *Driver*: {{nama_supir}}\n📍 *Tujuan*: {{tujuan}}\n\n*Status*: Sistem telah memberikan Persetujuan Otomatis.`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["nama_pemesan","waktu","nama_kendaraan","nama_supir","tujuan"]'
    },
    {
        slug: 'VEHICLE_BOOKING_STATUS_UPDATE',
        name: 'Update Status Booking Kendaraan',
        category: 'KENDARAAN',
        description: 'Dikirim ke pemesan saat booking disetujui/ditolak.',
        content: `🚗 *UPDATE BOOKING KENDARAAN*\n\nBismillah, permintaan {{jenis_layanan}} kendaraan Anda untuk *{{nama_kendaraan}}* telah diupdate.\n\nStatus: *{{status_text}}*\n📅 Waktu: {{waktu_str}}\n📍 Tujuan: {{tujuan}}\n👤 Admin: {{nama_admin}}\n\nCatatan: {{catatan}}\n\nSelamat bertugas!`,
        recipientPositions: '[]',
        availableVars: '["jenis_layanan","status_text","nama_kendaraan","waktu_str","tujuan","nama_admin","catatan"]'
    },
    {
        slug: 'VEHICLE_BOOKING_FINISHED',
        name: 'Booking Kendaraan Selesai/Ditolak',
        category: 'KENDARAAN',
        description: 'Dikirim ke pemesan saat perjalanan selesai atau ditolak.',
        content: `🚗 *INFO BOOKING KENDARAAN*\n\nPermintaan {{jenis_layanan}} Anda untuk kendaraan *{{nama_kendaraan}}* telah {{status_text}}.\n\n📅 Waktu: {{waktu_str}}\n📍 Tujuan: {{tujuan}}\n👤 Admin: {{nama_admin}}\n\nCatatan: {{catatan}}`,
        recipientPositions: '[]',
        availableVars: '["jenis_layanan","status_text","nama_kendaraan","waktu_str","tujuan","nama_admin","catatan"]'
    },
    {
        slug: 'VEHICLE_BOOKING_DISCREPANCY_KABID',
        name: 'Peringatan Diskrepansi Odometer',
        category: 'KENDARAAN',
        description: 'Dikirim ke Kabid jika ada selisih kilometer yang tidak wajar.',
        content: `⚠️ *PERINGATAN DISKREPANSI KM*\n\nTerdeteksi selisih kilometer saat mulai perjalanan pada kendaraan *{{nama_kendaraan}}*.\n\n👤 Pengguna: {{nama_pengguna}}\n🔢 KM Sistem: {{km_sistem}}\n🔢 KM Input: {{km_input}}\n📉 Selisih: *{{selisih}} KM*\n\nMohon segera divalidasi.`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["nama_kendaraan","nama_pengguna","km_sistem","km_input","selisih"]'
    },
    {
        slug: 'VEHICLE_BOOKING_FUEL_ALERT',
        name: 'Notifikasi Kondisi BBM Minim',
        category: 'KENDARAAN',
        description: 'Notifikasi ke admin dan PIC untuk memantau kondisi BBM kendaraan yang dilaporkan rendah.',
        content: `⛽ *PERINGATAN KONDISI BBM*\n\nKendaraan {{nama_kendaraan}} dilaporkan memiliki bbm minim oleh {{nama_pengguna}}.\nKondisi: {{kondisi_bbm}}\nKeterangan: {{keterangan}}\n\nMohon ditindaklanjuti untuk pengisian.`,
        recipientPositions: '["Staff Manajemen Aset","PIC Armada"]',
        availableVars: '["nama_kendaraan","nama_pengguna","kondisi_bbm","keterangan"]'
    },
    {
        slug: 'VEHICLE_REMINDER_H1',
        name: 'Reminder Pengembalian Kendaraan',
        category: 'KENDARAAN',
        description: 'Reminder ke user untuk menginput KM akhir setelah perjalanan.',
        content: `⏰ *PENGINGAT PENYELESAIAN PERJALANAN*\n\nArmada: {{nama_kendaraan}}\nDestinasi: {{tujuan}}\nWaktu Selesai: {{waktu_selesai}}\nSudah Lewat: *{{selisih_jam}} jam*\n\n⚠️ Mohon segera selesaikan perjalanan melalui aplikasi Sarpras dengan menginputkan Kilometer Akhir agar armada dapat digunakan oleh pengguna lain.`,
        recipientPositions: '[]',
        availableVars: '["nama_kendaraan","tujuan","waktu_selesai","selisih_jam"]'
    },
    {
        slug: 'VEHICLE_BOOKING_REVIEW',
        name: 'Review Pemakaian Kendaraan',
        category: 'KENDARAAN',
        description: 'Notifikasi ke user jika kendaraan tidak jadi digunakan.',
        content: `🚗 *PENGINGAT MEMULAI PERJALANAN*\n\nArmada: {{nama_kendaraan}}\nTujuan: {{tujuan}}\nJadwal: {{waktu_mulai}}\nSudah Lewat: *{{selisih_jam}} jam*\n\n⚠️ Jika Anda akan menggunakan armada, mohon segera mulai perjalanan melalui aplikasi SARPRAS. Jika tidak jadi, mohon batalkan request.`,
        recipientPositions: '[]',
        availableVars: '["nama_kendaraan","tujuan","waktu_mulai","selisih_jam"]'
    },
    {
        slug: 'VEHICLE_TAX_EXPIRING_ADMIN',
        name: 'Reminder Pajak Kendaraan Expired',
        category: 'KENDARAAN',
        description: 'Notifikasi masa berlaku pajak akan habis ke admin.',
        content: `⚠️ *PENGINGAT {{tipe_pajak}}*\n\nKendaraan *{{nama_kendaraan}}* ({{nomor_plat}}) akan jatuh tempo {{tipe_pajak}} dalam *{{tenggat_waktu}}*.\n\n📅 Jatuh Tempo: {{jatuh_tempo}}\nMohon segera diproses perpanjangannya.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_kendaraan","nomor_plat","tipe_pajak","jatuh_tempo","tenggat_waktu"]'
    },
    {
        slug: 'VEHICLE_PLATE_EXPIRING_ADMIN',
        name: 'Reminder Plat Nomor/KIR Expired',
        category: 'KENDARAAN',
        description: 'Notifikasi masa berlaku plat/KIR akan habis ke admin.',
        content: `⚠️ *PENGINGAT JADWAL KIR*\n\nKendaraan *{{nama_kendaraan}}* ({{nomor_plat}}) akan jatuh tempo *KIR* dalam *{{tenggat_waktu}}*.\n\n📅 Jatuh Tempo: {{jatuh_tempo}}\nMohon segera diproses pendaftarannya.`,
        recipientPositions: '["Staff Gudang dan Logistik"]',
        availableVars: '["nama_kendaraan","nomor_plat","jatuh_tempo","tenggat_waktu"]'
    },
    {
        slug: 'VEHICLE_DRIVER_EXPIRED_ADMIN',
        name: 'Reminder SIM Driver Expired',
        category: 'KENDARAAN',
        description: 'Notifikasi masa berlaku SIM driver akan habis ke admin.',
        content: `⚠️ *PENGINGAT SIM EXPIRED*\n\nMasa berlaku SIM driver *{{nama_penerima}}* akan habis.\n\n{{pesan_test}}`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_penerima","nomor_hp","pesan_test"]'
    },
    {
        slug: 'VEHICLE_REPORT_ADMIN',
        name: 'Laporan Mingguan Kendaraan (Belum)',
        category: 'KENDARAAN',
        description: 'Teguran ke PIC/Staff yang belum menginput laporan mingguan kendaraan.',
        content: `⚠️ *PENGINGAT LAPORAN MINGGUAN KENDARAAN*\n\nBerikut daftar kendaraan aktif yang *BELUM* dibuatkan Laporan periodik minggu ini ({{periode}}):\n\n{{daftar_kendaraan}}\n\nMohon segera diinput melalui aplikasi.`,
        recipientPositions: '["PIC Armada"]',
        availableVars: '["periode","daftar_kendaraan"]'
    },
    {
        slug: 'VEHICLE_MAINTENANCE_CREATED_ADMIN',
        name: 'Servis Kendaraan Baru',
        category: 'KENDARAAN',
        description: 'Notifikasi pengajuan servis/pemeliharaan kendaraan ke admin dan PIC.',
        content: `🛠 *PENGINGAT PEMELIHARAAN KENDARAAN*\n\nKendaraan *{{nama_kendaraan}}* ({{nomor_plat}}) sudah lama tidak servis rutin.\n\n📅 Terakhir: {{tgl_terakhir}}\n🔢 Terakhir: {{km_terakhir}} km\n🎯 Target: {{target_km}} km`,
        recipientPositions: '["Staff Manajemen Aset","PIC Armada"]',
        availableVars: '["nama_kendaraan","nomor_plat","tgl_terakhir","km_terakhir","target_km"]'
    },
    {
        slug: 'VEHICLE_MAINTENANCE_STATUS_UPDATE',
        name: 'Update Status Servis Kendaraan',
        category: 'KENDARAAN',
        description: 'Notifikasi perubahan status pengerjaan servis kendaraan.',
        content: `🔧 *PENGINGAT SERVICE KENDARAAN*\n\nKendaraan *{{nama_kendaraan}}* ({{nomor_plat}})\n\n🔢 KM Saat Ini: {{km_saat_ini}} km\n🎯 Target Service: {{target_service}} km\n\n{{status_text}}`,
        recipientPositions: '[]',
        availableVars: '["nama_kendaraan","nomor_plat","km_saat_ini","target_service","status_text"]'
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
        content: `📦 *INFO REQUEST PENGADAAN*\n\nUstadz/Ustadzah *{{nama_pengaju}}*, {{jumlah_request}} permintaan anda telah kami terima dengan rincian:\n\n{{daftar_barang}}\n\n{{info_status}}`,
        recipientPositions: '[]',
        availableVars: '["nama_pengaju","jumlah_request","daftar_barang","info_status"]'
    },
    {
        slug: 'PROCUREMENT_NEW_ADMIN',
        name: 'Pengadaan Baru (ke Admin)',
        category: 'PENGADAAN',
        description: 'Notifikasi ke admin pengadaan saat ada item baru masuk.',
        content: `📦 *INFO REQUEST PENGADAAN*\n\nAda {{jumlah_request}} pesanan baru dari:\n👤 *Nama* : {{nama_pengaju}}\n🆔 *NIY* : {{niy}}\n🏢 *Unit* : {{unit}}\n\n*Rincian Permintaan:*\n{{daftar_barang}}\n\nMohon segera diproses.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["jumlah_request","nama_pengaju","niy","unit","daftar_barang"]'
    },
    {
        slug: 'PROCUREMENT_IMPORT_ADMIN',
        name: 'Pengadaan Baru via Import (ke Admin)',
        category: 'PENGADAAN',
        description: 'Notifikasi ke admin saat ada data pengadaan di-import dari Excel.',
        content: `📥 *IMPORT REQUEST PENGADAAN*\n\nAda {{jumlah_request}} pesanan baru di-import dari Excel oleh:\n👤 *Nama* : {{nama_pengaju}}\n🆔 *NIY* : {{niy}}\n🏢 *Unit* : {{unit}}\n\n*Rincian Permintaan:*\n{{daftar_barang}}\n\nMohon segera diproses.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["jumlah_request","nama_pengaju","niy","unit","daftar_barang"]'
    },
    {
        slug: 'PROCUREMENT_STATUS_UPDATE',
        name: 'Update Status Pengadaan',
        category: 'PENGADAAN',
        description: 'Dikirim ke pengaju saat status pengadaan berubah.',
        content: `📦 *INFO REQUEST PENGADAAN*\n\nUstadz/Ustadzah *{{nama_pengaju}}*,\n\nPermintaan *{{judul}}* ({{kode}})\nStatus: *{{status}}*\n\n{{detail_tambahan}}`,
        recipientPositions: '[]',
        availableVars: '["nama_pengaju","judul","kode","status","detail_tambahan"]'
    },
    {
        slug: 'PROCUREMENT_DIRECT_ASSIGNED',
        name: 'Penugasan Langsung Pengadaan',
        category: 'PENGADAAN',
        description: 'Notifikasi ke PIC saat ditugaskan langsung oleh pimpinan.',
        content: `📦 *INFO PENUGASAN PENGADAAN (MANDAT KABID)*\n\nHalo {{nama_staf}},\nAnda menerima perintah langsung pengadaan *{{judul}}* dari Kepala Bidang.\n\n*Rincian Barang:*\n{{daftar_barang}}\n\nMohon segera diproses. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_staf","judul","daftar_barang"]'
    },
    {
        slug: 'PROCUREMENT_ITEM_ASSIGNED',
        name: 'Penugasan Item Pengadaan',
        category: 'PENGADAAN',
        description: 'Notifikasi ke staff saat ditugaskan mengelola item pengadaan.',
        content: `📦 *INFO PENUGASAN PENGADAAN*\n\nUstadz/Ustadzah *{{nama_staf}}*,\n\nAnda telah ditugaskan untuk mengelola item berikut pada pengajuan *{{judul}}*:\n\n{{daftar_barang}}\n\nMohon segera ditindaklanjuti. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_staf","judul","daftar_barang"]'
    },
    {
        slug: 'PROCUREMENT_VENDOR_SELECTED',
        name: 'Vendor Terpilih (ke Pengaju)',
        category: 'PENGADAAN',
        description: 'Notifikasi ke pengaju saat vendor untuk item yang diminta sudah dipilih.',
        content: `🏪 *VENDOR TERPILIH*\n\nUstadz/Ustadzah *{{nama_pengaju}}*,\nVendor terpilih untuk item *{{nama_barang}}* pada permintaan *{{judul}}*:\n\n🏪 *Vendor* : {{nama_vendor}}\n💰 *Harga* : Rp {{harga}}\n\nProses pengadaan sedang berjalan.`,
        recipientPositions: '[]',
        availableVars: '["nama_pengaju","nama_barang","judul","nama_vendor","harga"]'
    },
    {
        slug: 'PROCUREMENT_BAST_COMPLETED',
        name: 'Berita Acara Selesai (ke Pengaju)',
        category: 'PENGADAAN',
        description: 'Dikirim saat barang sudah diserahterimakan (BAST).',
        content: `✅ *PENGADAAN SELESAI (BAST)*\n\nAlhamdulillah, permintaan Anda *{{judul}}* telah *SELESAI (BAST)*.\n\n*Rincian:*\n{{daftar_barang}}\n\nBarang sudah diterima dan tercatat sebagai aset. Jazakumullahu Khairan.`,
        recipientPositions: '[]',
        availableVars: '["nama_pengaju","judul","daftar_barang"]'
    },

    // === PERSONALIA ===
    {
        slug: 'PERSONNEL_ASSIGNMENT_NEW',
        name: 'Penugasan Baru (ke Staff)',
        category: 'PERSONALIA',
        description: 'Dikirim ke staff saat mendapat tugas personalia baru.',
        content: `📋 *PENUGASAN KERJA BARU*\n\nHalo *{{nama_pegawai}}*,\n\nAnda mendapat penugasan baru:\n📝 *Tugas*: {{judul_tugas}}\n📅 *Deadline*: {{deadline}}\n👤 *Dari*: {{pemberi_tugas}}\n\n*Deskripsi*:\n{{deskripsi_tugas}}\n\nMohon dilaksanakan dengan amanah. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_pegawai","judul_tugas","deadline","pemberi_tugas","deskripsi_tugas"]'
    },
    {
        slug: 'PERSONNEL_ASSIGNMENT_REMINDER',
        name: 'Reminder Deadline Personalia',
        category: 'PERSONALIA',
        description: 'Pengingat otomatis saat deadline tugas personalia mendekat.',
        content: `⏰ *PENGINGAT DEADLINE TUGAS*\n\nHalo {{nama_pegawai}},\nTugas *"{{judul_tugas}}"* mendekati deadline ({{deadline}}).\n📊 Progres: {{progress}}%\n👤 Dari: {{pemberi_tugas}}\n\nMohon segera diselesaikan atau update progresnya. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_pegawai","judul_tugas","deadline","progress","pemberi_tugas"]'
    },
    {
        slug: 'PERSONNEL_ASSIGNMENT_DONE',
        name: 'Pengajuan Penundaan (ke Atasan)',
        category: 'PERSONALIA',
        description: 'Notifikasi ke pimpinan saat staff mengajukan penundaan deadline.',
        content: `⏳ *PENGAJUAN PENUNDAAN TUGAS*\n\nUstadz {{nama_assigner}},\nPelaksana *{{nama_pelaksana}}* mengajukan penundaan untuk tugas:\n\n📌 *Tugas*: {{judul_tugas}}\n📅 *Deadline Awal*: {{deadline_awal}}\n⏳ *Usulan Baru*: {{usulan_baru}}\n📝 *Alasan*: {{alasan}}\n\nMohon segera tinjau di aplikasi Sarpras.`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["nama_assigner","nama_pelaksana","judul_tugas","deadline_awal","usulan_baru","alasan"]'
    },
    {
        slug: 'PERSONNEL_ASSIGNMENT_REJECTED',
        name: 'Respon Penundaan (ke Staff)',
        category: 'PERSONALIA',
        description: 'Notifikasi status pengajuan penundaan tugas.',
        content: `📋 *STATUS PENUNDAAN TUGAS*\n\nUstadz {{nama_pegawai}}, pengajuan penundaan untuk tugas *{{judul_tugas}}* telah *{{status_text}}*.\n\n{{deadline_info}}\n\nMohon dicek kembali di aplikasi. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_pegawai","judul_tugas","status_text","deadline_info"]'
    },
    {
        slug: 'PERSONNEL_ASSIGNMENT_EVALUATED',
        name: 'Tugas Rutin Otomatis',
        category: 'PERSONALIA',
        description: 'Notifikasi saat tugas rutin masuk secara otomatis.',
        content: `⚙️ *TUGAS RUTIN OTOMATIS*\n\nBismillah, telah masuk tugas rutin otomatis:\n📌 *Judul*: {{judul_tugas}}\n👤 *Pemberi*: {{pemberi_tugas}}\n\n*Deskripsi*:\n{{deskripsi_tugas}}\n\nSemangat berkhidmah!`,
        recipientPositions: '[]',
        availableVars: '["judul_tugas","pemberi_tugas","deskripsi_tugas"]'
    },
    {
        slug: 'PERSONNEL_SUMMARY_DAILY',
        name: 'Rekap Laporan Harian (ke Kabid)',
        category: 'PERSONALIA',
        description: 'Rekapitulasi progres kerja harian staff ke pimpinan.',
        content: `📊 *RANGKUMAN LAPORAN HARIAN STAF*\n📅 *Tanggal* : {{tanggal}}\n\n{{isi_rangkuman}}\n\n_Silakan cek detail lengkapnya di aplikasi Manajemen Aset._`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["tanggal","isi_rangkuman"]'
    },
    {
        slug: 'PERSONNEL_RATING_NEW',
        name: 'Pengingat Rencana Kerja (ke Staff)',
        category: 'PERSONALIA',
        description: 'Reminder deadline rencana kerja pimpinan.',
        content: `🗓️ *PENGINGAT RENCANA KERJA*\n\nAssalamu\'alaikum Ustadz {{nama_staf}},\n\n{{pesan_peringatan}}`,
        recipientPositions: '[]',
        availableVars: '["nama_staf","judul_rencana","periode","deadline","pesan_peringatan"]'
    },
    {
        slug: 'PERSONNEL_RATING_NEW_KABID',
        name: 'Audit Rencana Kerja (ke Kabid)',
        category: 'PERSONALIA',
        description: 'Audit pimpinan terhadap rencana kerja staff yang terlambat.',
        content: `📊 *AUDIT RENCANA KERJA*\n\nLaporan pengingat untuk *{{nama_staf}}*:\n\n{{pesan_peringatan}}`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["nama_staf","pesan_peringatan"]'
    },
    {
        slug: 'PERSONNEL_SUMMARY_WEEKLY_STAFF',
        name: 'Teguran Laporan Harian (ke Staff)',
        category: 'PERSONALIA',
        description: 'Teguran mingguan ke staff yang belum melengkapi laporan.',
        content: `🚨 *PENGINGAT LAPORAN HARIAN*\n\nUstadz {{nama_ustadz}}, mohon lengkapi laporan harian pada mingu ini untuk hari:\n📅 *Hari*: {{hari_kosong}}\n\nMohon segera diisi demi ketertiban administrasi. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_ustadz","hari_kosong"]'
    },
    {
        slug: 'PERSONNEL_SUMMARY_WEEKLY_KABID',
        name: 'Audit Laporan Mingguan (ke Kabid)',
        category: 'PERSONALIA',
        description: 'Dashboard kedisiplinan laporan mingguan untuk pimpinan.',
        content: `⚠️ *AUDIT KEDISIPLINAN LAPORAN*\n\nDaftar staf yang belum melengkapi laporan mingguan:\n\n{{daftar_staf_kosong}}\n\nMohon arahannya.`,
        recipientPositions: '["Kepala Bidang Sarana dan Prasarana"]',
        availableVars: '["daftar_staf_kosong"]'
    },
    {
        slug: 'PERSONNEL_PUNISHMENT_NEW',
        name: 'Broadcast Pengingat Laporan',
        category: 'PERSONALIA',
        description: 'Broadcast pengingat ke seluruh staff di akhir pekan.',
        content: `Bismillah,\nAssalamu\'alaikum Ustadz *{{nama_ustadz}}*,\n\nMengingatkan agar tidak lupa melengkapi laporan harian periode ini. Statistik Anda: *{{jumlah_laporan}} Laporan*. Syukron.`,
        recipientPositions: '[]',
        availableVars: '["nama_ustadz","jumlah_laporan"]'
    },

    // === PINJAM ASET ===
    {
        slug: 'LOAN_CREATED_ADMIN',
        name: 'Permohonan Pinjam Aset (ke Admin)',
        category: 'UMUM',
        description: 'Dikirim ke admin saat ada pengajuan pinjam aset yayasan.',
        content: `📢 *PERMOHONAN PINJAM ASET*\n\nUser *{{nama_pemesan}}* mengajukan peminjaman aset:\n{{daftar_aset}}\n\n📅 Tanggal: {{tanggal}}\n📌 Keperluan: {{keperluan}}\n\nMohon tinjau di sistem. Syukron.`,
        recipientPositions: '["Staff Manajemen Aset"]',
        availableVars: '["nama_pemesan","daftar_aset","keperluan","tanggal"]'
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
                recipientPositions: defaultTpl.recipientPositions,
                availableVars: defaultTpl.availableVars
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
