const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { PrismaClient } = require('@prisma/client');
const aiService = require('./aiService');

dayjs.extend(utc);
dayjs.extend(timezone);

const defaultPrisma = new PrismaClient();

const DEFAULT_SOP_GENERAL_FORMAT = [
    '# STANDAR OPERASIONAL PROSEDUR (SOP)',
    '',
    '## A. Identitas Dokumen',
    '- Nomor Dokumen: [Diisi otomatis / sesuai nomor arsip Kantor AI]',
    '- Judul SOP: [Judul Jelas & Operasional]',
    '- Unit / Bidang: Bidang Sarana Yayasan Dar el-Iman',
    '- Tanggal Berlaku & Revisi: [Tanggal / Rev. 01]',
    '',
    '## 1. Tujuan',
    '- Menjelaskan maksud utama penyusunan SOP dan standar hasil yang diharapkan.',
    '',
    '## 2. Ruang Lingkup',
    '- Menyebutkan unit kerja, fasilitas, aset, kendaraan, atau proses yang tercakup dalam SOP.',
    '',
    '## 3. Dasar Kebijakan & Referensi',
    '- Mengacu pada ketentuan Yayasan Dar el-Iman, peraturan Bidang Sarana, dan SOP terkait.',
    '',
    '## 4. Definisi & Istilah',
    '- Penjelasan istilah teknis atau peran (misal: PIC, Admin Unit, Admin Aset, Kepala Bidang Sarana).',
    '',
    '## 5. Pihak Terkait & Tanggung Jawab',
    '- Pembagian tugas jelas antara Pemohon/Unit, PIC/Petugas Lapangan, Admin Aset/Sarpras, dan Kepala Bidang Sarana.',
    '',
    '## 6. Prosedur Pelaksanaan (Langkah demi Langkah)',
    '1. Tahap Persiapan / Pengajuan',
    '2. Tahap Verifikasi & Persetujuan',
    '3. Tahap Pelaksanaan / Eksekusi Lapangan',
    '4. Tahap Pencatatan Sistem & Dokumentasi',
    '5. Tahap Penyelesaian / Serah Terima',
    '',
    '## 7. Ketentuan Khusus, Larangan & Sanksi',
    '- Batasan waktu (SLA), kewajiban pelaporan kondisi, larangan penyalahgunaan, serta sanksi administratif/operasional.',
    '',
    '## 8. Formulir & Dokumen Pendukung',
    '- Daftar menu sistem terkait, form pemeriksaan, berita acara, atau lampiran bukti foto.',
    '',
    '## 9. Evaluasi & Penutup',
    '- Mekanisme audit kepatuhan berkala oleh Kepala Bidang Sarana dan masa berlaku SOP.'
].join('\n');

const DEFAULT_POLICY_GUIDELINES = [
    'Gunakan bahasa Indonesia baku, tegas, sopan, dan bernuansa amanah/islami sesuai kultur Yayasan Dar el-Iman.',
    'Sesuaikan prosedur dengan peran nyata yang berjalan di Bidang Sarana: Kepala Bidang Sarana, Admin Aset, Admin Unit, PIC Kendaraan, Staff Kendaraan, Staff Gudang & Logistik, Teknisi Pemeliharaan, dan Tim Workshop Unit 21.',
    'Semua dokumen yang dihasilkan adalah dokumen kerja internal Kantor AI dan belum dipublikasikan ke E-Office atau modul lain sebelum ditinjau pimpinan.'
].join('\n');

const CURATED_ADMIN_PROPOSALS = [
    {
        title: 'SOP Peminjaman, Pemakaian & Pelaporan KM Kendaraan Operasional (Termasuk Rollover Odometer)',
        category: 'SOP',
        domain: 'Kendaraan',
        priority: 'HIGH',
        rationale: 'Menstandarkan proses booking kendaraan, verifikasi foto odometer bila ada selisih KM, pembatasan digit odometer & rollover ke angka 1, serta kewajiban isi kondisi BBM saat End Trip.',
        brief: 'Susun SOP lengkap mulai pengajuan booking, ceklis pra-jalan, penanganan selisih odometer dan rollover 5-6 digit, hingga pilihan isi BBM sendiri atau lapor PIC saat End Trip.'
    },
    {
        title: 'SOP Ceklis Harian, Mingguan & Bulanan Armada serta Eskalasi Perbaikan Terkontrol',
        category: 'SOP',
        domain: 'Kendaraan',
        priority: 'HIGH',
        rationale: 'Memisahkan pencatatan temuan ceklis rutin harian agar tidak langsung membanjiri antrean request perbaikan sebelum diverifikasi PIC/Staff Kendaraan.',
        brief: 'Jelaskan jadwal pengisian ceklis harian/mingguan/bulanan, kriteria status SIAP JALAN vs PERLU PERBAIKAN, serta mekanisme tindak lanjut manual ke pengajuan perbaikan bengkel.'
    },
    {
        title: 'SOP Peminjaman Aset Inventaris Unit & Aset Kantor Yayasan',
        category: 'SOP',
        domain: 'Aset',
        priority: 'HIGH',
        rationale: 'Mengatur alur peminjaman aset antar unit dan persetujuan khusus oleh Admin Aset untuk aset milik unit Kantor Yayasan.',
        brief: 'Uraikan syarat kelayakan aset dipinjam, persetujuan Admin Unit / Admin Aset (khusus Kantor Yayasan), batas waktu pengembalian, dan pengecekan kondisi saat kembali.'
    },
    {
        title: 'SOP Pengelolaan Pesanan Workshop Kayu & Besi Unit 21',
        category: 'SOP',
        domain: 'Workshop',
        priority: 'NORMAL',
        rationale: 'Menyeragamkan katalog harga tetap, varian bentuk/ukuran, harga custom, estimasi penyelesaian, hingga penyelesaian otomatis saat progres mencapai 100%.',
        brief: 'Buat prosedur pemesanan pekerjaan kayu/besi dari unit kerja ke Workshop Unit 21, penentuan kategori pekerjaan, estimasi biaya, pembaruan progres hingga 100% selesai.'
    },
    {
        title: 'SOP Pengadaan Barang, Verifikasi Penawaran & Serah Terima (BAST)',
        category: 'SOP',
        domain: 'Pengadaan',
        priority: 'NORMAL',
        rationale: 'Memastikan seluruh pengadaan unit melewati validasi spesifikasi, perbandingan vendor yang transparan, dan serah terima terverifikasi.',
        brief: 'Rincikan alur RKB/pengajuan pengadaan, validasi Admin Aset & persetujuan Kepala Bidang Sarana, penerbitan PO/surat tugas, hingga BAST masuk aset/gudang.'
    },
    {
        title: 'Aturan Disiplin Kepatuhan Odometer, Kondisi BBM & Sanksi Keterlambatan Kendaraan',
        category: 'ATURAN',
        domain: 'Kendaraan',
        priority: 'HIGH',
        rationale: 'Menjadi payung hukum tertulis bagi seluruh pengemudi/peminjam kendaraan dinas agar tertib mencatat KM, BBM minimal setengah tangki, dan ketepatan waktu pengembalian.',
        brief: 'Susun pasal-pasal kewajiban pengemudi, toleransi selisih odometer 1 KM, aturan pelaporan BBM < 1/2 tangki, pembekuan akun (sanksi) sementara, serta mekanisme pemulihan.'
    },
    {
        title: 'SOP Pemeliharaan Aset Gedung, Sarpras & Penanganan Laporan Kerusakan Mendesak',
        category: 'SOP',
        domain: 'Pemeliharaan',
        priority: 'NORMAL',
        rationale: 'Memperjelas pembagian penanganan antara laporan kerusakan rutin, darurat, dan koordinasi teknisi lapangan.',
        brief: 'Jabarkan cara pelaporan kerusakan dengan bukti foto, klasifikasi urgensi (Normal/Urgent/Emergency), penugasan teknisi, verifikasi hasil perbaikan, dan penutupan tiket.'
    },
    {
        title: 'Surat Edaran Kepatuhan Audit Aset, Monitoring CCTV ROI & Kebersihan Gudang Logistik',
        category: 'SURAT',
        domain: 'Umum',
        priority: 'NORMAL',
        rationale: 'Mengingatkan seluruh penanggung jawab unit untuk menjaga kerapian aset terdaftar, pengawasan area penting, dan pencatatan mutasi/stok minimum gudang.',
        brief: 'Buat draft surat edaran resmi dari Bidang Sarana kepada seluruh Kepala Unit / PJ Sarpras terkait kepatuhan inventarisasi aset, stok minimum gudang, dan tata tertib keamanan area.'
    },
    {
        title: 'SOP Manajemen Stok Minimum, Penerimaan Vendor & Pengeluaran Barang Gudang Logistik',
        category: 'SOP',
        domain: 'Gudang',
        priority: 'NORMAL',
        rationale: 'Mencegah kekosongan stok barang operasional dan seragam serta menjamin kesesuaian pencatatan fisik dengan sistem.',
        brief: 'Jelaskan tata cara stock opname berkala, ambang batas minStock, penerimaan barang dari vendor, dan serah terima pesanan unit kerja.'
    }
];

let isRoutineRunning = false;

function getTodayWib() {
    return dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD');
}

function getCategoryPrefix(category) {
    switch (String(category || '').toUpperCase()) {
        case 'LAPORAN_HARIAN': return 'SUP';
        case 'SOP': return 'SOP';
        case 'ATURAN': return 'ATR';
        case 'SURAT': return 'SRT';
        default: return 'DOK';
    }
}

async function generateItemCode(prismaClient, category, outputDate = getTodayWib()) {
    const prefix = getCategoryPrefix(category);
    const compactDate = outputDate.replace(/-/g, '');
    const codePrefix = `AIO/${prefix}/${compactDate}-`;

    const existing = await prismaClient.aiOfficeItem.findMany({
        where: { code: { startsWith: codePrefix } },
        select: { code: true }
    });

    let maxSeq = 0;
    for (const row of existing) {
        const tail = row.code.slice(codePrefix.length);
        const parsed = parseInt(tail, 10);
        if (!Number.isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
    }

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `${codePrefix}${nextSeq}`;
}

async function getOrCreateConfig(prismaClient = defaultPrisma) {
    let config = await prismaClient.aiOfficeConfig.findUnique({
        where: { id: 1 }
    });

    if (!config) {
        config = await prismaClient.aiOfficeConfig.create({
            data: {
                id: 1,
                isEnabled: true,
                supervisorName: 'Staf Supervisi AI',
                adminStaffName: 'Staf Administrasi AI',
                dailyScheduleHour: 7,
                dailyScheduleMinute: 30,
                eveningScheduleHour: 16,
                maxDailyDrafts: 2,
                sopGeneralFormat: DEFAULT_SOP_GENERAL_FORMAT,
                policyGuidelines: DEFAULT_POLICY_GUIDELINES
            }
        });
    }

    return config;
}

async function safeCount(fn, fallback = 0) {
    try {
        return await fn();
    } catch {
        return fallback;
    }
}

async function safeFindMany(fn, fallback = []) {
    try {
        return await fn();
    } catch {
        return fallback;
    }
}

async function collectOperationalSnapshot(prismaClient = defaultPrisma) {
    const now = new Date();
    const todayStart = dayjs().tz('Asia/Jakarta').startOf('day').toDate();
    const sevenDaysAgo = dayjs().tz('Asia/Jakarta').subtract(7, 'day').startOf('day').toDate();

    const [
        totalAssets,
        assetsMinorDamage,
        assetsHeavyDamage,
        pendingAssetLoans,
        borrowedAssetLoans,
        overdueAssetLoans,
        openMaintenances,
        urgentMaintenances,
        openMaintenanceList,
        activeVehicles,
        inactiveVehicles,
        pendingVehicleServices,
        inProgressVehicleServices,
        todayVehicleChecklists,
        recentNeedRepairChecklists,
        activeVehicleBookings,
        activeWorkshopOrders,
        activeWorkshopList,
        openProcurements,
        warehouseStocks,
        existingRules,
        existingAiItems
    ] = await Promise.all([
        safeCount(() => prismaClient.asset.count()),
        safeCount(() => prismaClient.asset.count({ where: { condition: 'RUSAK_RINGAN' } })),
        safeCount(() => prismaClient.asset.count({ where: { condition: 'RUSAK_BERAT' } })),
        safeCount(() => prismaClient.assetLoan.count({ where: { status: 'PENDING' } })),
        safeCount(() => prismaClient.assetLoan.count({ where: { status: 'BORROWED' } })),
        safeCount(() => prismaClient.assetLoan.count({ where: { status: 'BORROWED', expectedReturnDate: { lt: now } } })),
        safeCount(() => prismaClient.maintenance.count({ where: { status: { notIn: ['COMPLETED', 'REJECTED'] } } })),
        safeCount(() => prismaClient.maintenance.count({ where: { status: { notIn: ['COMPLETED', 'REJECTED'] }, urgency: { in: ['URGENT', 'EMERGENCY'] } } })),
        safeFindMany(() => prismaClient.maintenance.findMany({
            where: { status: { notIn: ['COMPLETED', 'REJECTED'] } },
            select: { code: true, title: true, urgency: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 5
        })),
        safeCount(() => prismaClient.vehicle.count({ where: { status: 'ACTIVE' } })),
        safeCount(() => prismaClient.vehicle.count({ where: { status: 'INACTIVE' } })),
        safeCount(() => prismaClient.vehicleService.count({ where: { status: 'PENDING' } })),
        safeCount(() => prismaClient.vehicleService.count({ where: { status: 'IN_PROGRESS' } })),
        safeCount(() => prismaClient.vehicleChecklist.count({ where: { createdAt: { gte: todayStart } } })),
        safeCount(() => prismaClient.vehicleChecklist.count({ where: { status: 'PERLU PERBAIKAN', createdAt: { gte: sevenDaysAgo } } })),
        safeCount(() => prismaClient.vehicleBooking.count({ where: { status: { in: ['PENDING', 'APPROVED', 'BERLANGSUNG'] } } })),
        safeCount(() => prismaClient.workshopOrder.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } })),
        safeFindMany(() => prismaClient.workshopOrder.findMany({
            where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            select: { code: true, title: true, status: true, priority: true },
            orderBy: { createdAt: 'desc' },
            take: 5
        })),
        safeCount(() => prismaClient.procurement.count({ where: { status: { in: ['SUBMITTED', 'VALIDATED', 'APPROVED', 'PROCESS'] } } })),
        safeFindMany(() => prismaClient.warehouseItem.findMany({ select: { name: true, stock: true, minStock: true } })),
        safeFindMany(() => prismaClient.sarprasRule.findMany({ select: { title: true, category: true } })),
        safeFindMany(() => prismaClient.aiOfficeItem.findMany({
            where: { status: { not: 'REJECTED' } },
            select: { title: true, category: true, status: true }
        }))
    ]);

    const lowStockItems = (warehouseStocks || []).filter(item => (item.stock || 0) <= (item.minStock || 5));

    return {
        capturedAt: dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm WIB'),
        outputDate: getTodayWib(),
        assets: {
            total: totalAssets,
            rusakRingan: assetsMinorDamage,
            rusakBerat: assetsHeavyDamage,
            loansPending: pendingAssetLoans,
            loansBorrowed: borrowedAssetLoans,
            loansOverdue: overdueAssetLoans
        },
        maintenance: {
            openCount: openMaintenances,
            urgentCount: urgentMaintenances,
            recentOpen: openMaintenanceList
        },
        vehicles: {
            active: activeVehicles,
            inactive: inactiveVehicles,
            servicePending: pendingVehicleServices,
            serviceInProgress: inProgressVehicleServices,
            checklistsToday: todayVehicleChecklists,
            checklistsNeedRepairLast7d: recentNeedRepairChecklists,
            activeBookings: activeVehicleBookings
        },
        workshop: {
            activeOrders: activeWorkshopOrders,
            recentActive: activeWorkshopList
        },
        procurement: {
            openCount: openProcurements
        },
        warehouse: {
            totalItems: (warehouseStocks || []).length,
            lowStockCount: lowStockItems.length,
            lowStockSample: lowStockItems.slice(0, 5).map(i => `${i.name} (stok ${i.stock}/min ${i.minStock})`)
        },
        existingGovernanceTitles: [
            ...(existingRules || []).map(r => r.title),
            ...(existingAiItems || []).map(i => i.title)
        ].filter(Boolean)
    };
}

function buildFallbackSupervisorReport(snapshot, config) {
    const a = snapshot.assets;
    const m = snapshot.maintenance;
    const v = snapshot.vehicles;
    const w = snapshot.workshop;
    const wh = snapshot.warehouse;

    const recentMaintLines = (m.recentOpen || []).length > 0
        ? m.recentOpen.map(item => `- [${item.code}] ${item.title} (${item.urgency} / ${item.status})`).join('\n')
        : '- Tidak ada tiket pemeliharaan aset yang terbuka saat ini.';

    const recentWorkshopLines = (w.recentActive || []).length > 0
        ? w.recentActive.map(item => `- [${item.code}] ${item.title} (${item.priority} / ${item.status})`).join('\n')
        : '- Tidak ada pekerjaan workshop aktif saat ini.';

    return [
        `# LAPORAN SUPERVISI HARIAN BIDANG SARANA`,
        ``,
        `**Kepada Yth:** Kepala Bidang Sarana Yayasan Dar el-Iman`,
        `**Dari:** ${config.supervisorName}`,
        `**Tanggal:** ${snapshot.outputDate} (${snapshot.capturedAt})`,
        ``,
        `## 1. Ringkasan Eksekutif`,
        `Assalamu'alaikum warahmatullahi wabarakatuh. Berikut adalah laporan pengawasan operasional harian Bidang Sarana berdasarkan data langsung dari sistem Manajemen Aset.`,
        `Saat ini tercatat **${a.total} aset terdaftar** (${a.rusakRingan} rusak ringan, ${a.rusakBerat} rusak berat), **${m.openCount} tiket pemeliharaan terbuka** (${m.urgentCount} mendesak), **${v.active} kendaraan aktif**, **${w.activeOrders} order Workshop Unit 21**, serta **${snapshot.procurement.openCount} pengadaan berjalan**.`,
        ``,
        `## 2. Statistik Operasional Hari Ini`,
        `- **Aset & Peminjaman:** Total ${a.total} aset | ${a.rusakRingan} rusak ringan | ${a.rusakBerat} rusak berat | ${a.loansPending} pinjaman menunggu ACC | ${a.loansBorrowed} sedang dipinjam (${a.loansOverdue} melewati batas waktu).`,
        `- **Pemeliharaan Gedung & Aset:** ${m.openCount} tiket aktif (${m.urgentCount} berstatus URGENT/EMERGENCY).`,
        `- **Armada Kendaraan:** ${v.active} aktif, ${v.inactive} non-aktif | ${v.activeBookings} booking aktif | ${v.servicePending} servis menunggu ACC, ${v.serviceInProgress} sedang di bengkel | ${v.checklistsToday} ceklis masuk hari ini (${v.checklistsNeedRepairLast7d} temuan perlu perbaikan 7 hari terakhir).`,
        `- **Workshop Unit 21:** ${w.activeOrders} pekerjaan belum selesai.`,
        `- **Pengadaan & Gudang:** ${snapshot.procurement.openCount} pengadaan proses | ${wh.lowStockCount} dari ${wh.totalItems} item gudang berada di batas stok minimum.`,
        ``,
        `## 3. Sorotan Temuan & Prioritas Pengawasan`,
        `### Tiket Pemeliharaan Aset Aktif:`,
        recentMaintLines,
        ``,
        `### Antrean Pekerjaan Workshop Unit 21:`,
        recentWorkshopLines,
        ``,
        `### Item Gudang Stok Menipis:`,
        wh.lowStockSample.length > 0 ? wh.lowStockSample.map(s => `- ${s}`).join('\n') : '- Seluruh stok gudang masih di atas batas minimum.',
        ``,
        `## 4. Rekomendasi Tindak Lanjut Lapangan`,
        `1. Tindak lanjuti **${a.loansOverdue} peminjaman aset terlambat** dan **${a.loansPending} permohonan menunggu persetujuan**.`,
        `2. Prioritaskan penyelesaian **${m.urgentCount} pemeliharaan urgent** serta review **${v.servicePending} pengajuan servis kendaraan**.`,
        `3. Evaluasi **${v.checklistsNeedRepairLast7d} temuan ceklis perlu perbaikan** dalam 7 hari terakhir bersama PIC Armada sebelum membuat request bengkel bila diperlukan.`,
        `4. Lakukan restock untuk **${wh.lowStockCount} item gudang** yang mencapai stok minimum.`,
        ``,
        `_Catatan: Disusun otomatis dalam mode ringkasan deterministik terverifikasi (internal Kantor AI)._`
    ].join('\n');
}

async function runSupervisorShift({
    prisma = defaultPrisma,
    trigger = 'MANUAL',
    actor = null,
    force = false
} = {}) {
    const config = await getOrCreateConfig(prisma);
    const outputDate = getTodayWib();

    if (!force) {
        const existingToday = await prisma.aiOfficeItem.findFirst({
            where: {
                category: 'LAPORAN_HARIAN',
                staffRole: 'SUPERVISI',
                outputDate
            },
            orderBy: { createdAt: 'desc' }
        });

        if (existingToday) {
            return { skipped: true, item: existingToday, reason: 'Laporan supervisi hari ini sudah tersedia.' };
        }
    }

    const snapshot = await collectOperationalSnapshot(prisma);
    let content = '';
    let usedFallback = false;
    let aiError = null;

    const prompt = `Anda adalah ${config.supervisorName} di Kantor AI Bidang Sarana Yayasan Dar el-Iman.
Tugas Anda menyusun **Laporan Supervisi Harian kepada Kepala Bidang Sarana** berdasarkan data operasional NYATA berikut (DILARANG keras mengarang atau mengubah angka di luar data JSON ini):

DATA REAL DATABASE (${snapshot.capturedAt}):
${JSON.stringify({
    outputDate: snapshot.outputDate,
    assets: snapshot.assets,
    maintenance: snapshot.maintenance,
    vehicles: snapshot.vehicles,
    workshop: snapshot.workshop,
    procurement: snapshot.procurement,
    warehouse: snapshot.warehouse
}, null, 2)}

ATURAN PENULISAN:
${config.policyGuidelines || DEFAULT_POLICY_GUIDELINES}

FORMAT LAPORAN (Markdown rapi, profesional, ringkas dan siap dibaca pimpinan di lapangan):
1. Judul & Header Resmi (Kepada Yth: Kepala Bidang Sarana, Dari: ${config.supervisorName}, Tanggal: ${outputDate})
2. Ringkasan Eksekutif (kondisi umum hari ini dalam 1-2 paragraf)
3. Statistik Operasional Terverifikasi (poin per bidang sesuai angka persis dari JSON)
4. Sorotan Temuan & Risiko Prioritas (aset rusak, keterlambatan pinjaman, pemeliharaan urgent, servis kendaraan, stok menipis, workshop aktif)
5. Rekomendasi Tindak Lanjut Konkret untuk Kepala Bidang Sarana hari ini
6. Saran Usulan SOP / Aturan baru bila terlihat ada celah operasional.`;

    try {
        const res = await aiService.generateContentWithFallback(prompt);
        content = res?.response?.text?.()?.trim() || '';
        if (!content) throw new Error('Respons AI kosong');
    } catch (err) {
        usedFallback = true;
        aiError = err.message;
        content = buildFallbackSupervisorReport(snapshot, config);
    }

    const code = await generateItemCode(prisma, 'LAPORAN_HARIAN', outputDate);
    const item = await prisma.aiOfficeItem.create({
        data: {
            code,
            staffRole: 'SUPERVISI',
            category: 'LAPORAN_HARIAN',
            domain: 'Umum',
            title: `Laporan Supervisi Harian Bidang Sarana — ${dayjs(outputDate).format('DD MMM YYYY')}`,
            rationale: 'Output harian wajib Staf Supervisi AI berdasarkan pantauan data operasional sistem.',
            brief: `Pantauan aset (${snapshot.assets.total}), maintenance terbuka (${snapshot.maintenance.openCount}), kendaraan aktif (${snapshot.vehicles.active}), workshop aktif (${snapshot.workshop.activeOrders}).`,
            priority: (snapshot.maintenance.urgentCount > 0 || snapshot.assets.loansOverdue > 0) ? 'HIGH' : 'NORMAL',
            status: 'DRAFT_READY',
            content,
            metricsSnapshot: JSON.stringify(snapshot),
            outputDate,
            triggeredBy: trigger,
            createdById: actor?.id || null,
            createdByName: actor?.name || config.supervisorName
        }
    });

    await prisma.aiOfficeConfig.update({
        where: { id: 1 },
        data: { lastSupervisorRunAt: new Date() }
    });

    await prisma.aiOfficeRunLog.create({
        data: {
            staffRole: 'SUPERVISI',
            trigger,
            status: usedFallback ? 'PARTIAL' : 'SUCCESS',
            summary: `Menerbitkan laporan supervisi harian ${item.code}${usedFallback ? ' (fallback terstruktur)' : ''}.`,
            itemsCreated: 1,
            itemsDrafted: 1,
            errorMessage: aiError
        }
    });

    return { skipped: false, usedFallback, item };
}

function parseJsonArrayFromText(rawText) {
    const cleaned = String(rawText || '')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        throw new Error('Output AI tidak memuat array JSON yang valid');
    }
    const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
    if (!Array.isArray(parsed)) throw new Error('Hasil parse bukan array');
    return parsed;
}

function normalizeProposalCategory(rawCat, fallbackCategory = 'SOP') {
    const upper = String(rawCat || '').toUpperCase().trim();
    if (['SOP', 'ATURAN', 'SURAT', 'LAINNYA'].includes(upper)) return upper;
    if (upper.includes('ATURAN') || upper.includes('KEBIJAKAN') || upper.includes('TATA TERTIB')) return 'ATURAN';
    if (upper.includes('SURAT') || upper.includes('EDARAN')) return 'SURAT';
    if (upper.includes('SOP')) return 'SOP';
    return fallbackCategory === 'ALL' ? 'SOP' : fallbackCategory;
}

function normalizePriority(rawPrio) {
    const upper = String(rawPrio || '').toUpperCase().trim();
    if (['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(upper)) return upper;
    return 'NORMAL';
}

async function proposeAdminBacklog({
    prisma = defaultPrisma,
    trigger = 'MANUAL',
    count = 4,
    focusTopic = '',
    category = 'ALL',
    actor = null
} = {}) {
    const config = await getOrCreateConfig(prisma);
    const snapshot = await collectOperationalSnapshot(prisma);
    const outputDate = getTodayWib();
    const safeCountVal = Math.max(1, Math.min(8, parseInt(count, 10) || 4));
    const existingSet = new Set((snapshot.existingGovernanceTitles || []).map(t => t.toLowerCase().trim()));

    let proposals = [];
    let usedFallback = false;
    let aiError = null;

    const categoryInstruction = category && category !== 'ALL'
        ? `Semua usulan harus berkategori "${category}".`
        : 'Campurkan kategori secara proporsional sesuai kebutuhan: "SOP", "ATURAN", "SURAT", atau "LAINNYA".';

    const topicInstruction = focusTopic && focusTopic.trim()
        ? `FOKUS UTAMA PERMINTAAN PIMPINAN: "${focusTopic.trim()}". Prioritaskan judul yang relevan dengan topik ini.`
        : 'Pilih kebutuhan paling mendesak di Bidang Sarana berdasarkan data kondisi lapangan saat ini.';

    const prompt = `Anda adalah ${config.adminStaffName} yang membantu Kepala Bidang Sarana Yayasan Dar el-Iman menyusun daftar usulan SOP, aturan, dan surat administrasi sarpras.
Berdasarkan kondisi operasional terkini, susun tepat ${safeCountVal} usulan dokumen baru yang BELUM ADA.

KONTEKS SISTEM & DATA TERKINI:
- Aset: ${snapshot.assets.total} total (${snapshot.assets.rusakBerat} rusak berat), ${snapshot.assets.loansOverdue} pinjaman terlambat.
- Pemeliharaan: ${snapshot.maintenance.openCount} terbuka (${snapshot.maintenance.urgentCount} urgent).
- Kendaraan: ${snapshot.vehicles.active} aktif, ${snapshot.vehicles.checklistsNeedRepairLast7d} temuan ceklis 7 hari terakhir, ${snapshot.vehicles.servicePending} servis pending.
- Workshop Unit 21: ${snapshot.workshop.activeOrders} pekerjaan aktif (kayu/besi).
- Gudang & Pengadaan: ${snapshot.procurement.openCount} pengadaan berjalan, ${snapshot.warehouse.lowStockCount} item stok minimum.

JUDUL YANG SUDAH ADA (DILARANG DUPLIKAT):
${snapshot.existingGovernanceTitles.slice(0, 40).map(t => `- ${t}`).join('\n') || '- (Belum ada)'}

ATURAN:
- ${categoryInstruction}
- ${topicInstruction}
- Jangan menulis isi dokumen lengkapnya dulu; cukup buat DAFTAR USULAN (title, category, domain, priority, rationale, brief) untuk di-ACC Kepala Bidang Sarana.
- Kembalikan HANYA JSON array valid tanpa teks tambahan di luar JSON, format:
[
  {
    "title": "Judul Dokumen",
    "category": "SOP",
    "domain": "Aset | Kendaraan | Pemeliharaan | Workshop | Gudang | Pengadaan | CCTV | Personalia | Umum",
    "priority": "NORMAL | HIGH | URGENT",
    "rationale": "Alasan singkat mengapa Bidang Sarana membutuhkan dokumen ini",
    "brief": "Arahan ruang lingkup & poin-poin inti yang akan ditulis jika sudah di-ACC"
  }
]`;

    try {
        const res = await aiService.generateContentWithFallback(prompt);
        const rawText = res?.response?.text?.() || '';
        const parsed = parseJsonArrayFromText(rawText);
        proposals = parsed.filter(p => p && p.title && !existingSet.has(String(p.title).toLowerCase().trim()));
    } catch (err) {
        usedFallback = true;
        aiError = err.message;
    }

    if (proposals.length === 0) {
        usedFallback = true;
        const targetCat = category && category !== 'ALL' ? category : null;
        const candidates = CURATED_ADMIN_PROPOSALS.filter(item => {
            if (targetCat && item.category !== targetCat) return false;
            return !existingSet.has(item.title.toLowerCase().trim());
        });

        proposals = (candidates.length > 0 ? candidates : CURATED_ADMIN_PROPOSALS)
            .filter(item => !existingSet.has(item.title.toLowerCase().trim()))
            .slice(0, safeCountVal);

        if (proposals.length === 0 && focusTopic) {
            proposals = [{
                title: `${category !== 'ALL' ? category : 'SOP'} ${focusTopic.trim()}`,
                category: category !== 'ALL' ? category : 'SOP',
                domain: 'Umum',
                priority: 'HIGH',
                rationale: 'Usulan khusus sesuai kebutuhan pimpinan Bidang Sarana.',
                brief: `Susun dokumen resmi mengenai ${focusTopic.trim()} sesuai alur Bidang Sarana.`
            }];
        }
    }

    const createdItems = [];
    for (const p of proposals.slice(0, safeCountVal)) {
        const cleanTitle = String(p.title || '').trim();
        if (!cleanTitle || existingSet.has(cleanTitle.toLowerCase())) continue;
        existingSet.add(cleanTitle.toLowerCase());

        const itemCategory = normalizeProposalCategory(p.category, category);
        const code = await generateItemCode(prisma, itemCategory, outputDate);

        const created = await prisma.aiOfficeItem.create({
            data: {
                code,
                staffRole: 'ADMINISTRASI',
                category: itemCategory,
                domain: p.domain ? String(p.domain).slice(0, 60) : 'Umum',
                title: cleanTitle.slice(0, 240),
                rationale: p.rationale ? String(p.rationale) : 'Kebutuhan tata kelola operasional Bidang Sarana.',
                brief: p.brief ? String(p.brief) : null,
                priority: normalizePriority(p.priority),
                status: 'PROPOSED',
                outputDate,
                triggeredBy: trigger,
                createdById: actor?.id || null,
                createdByName: actor?.name || config.adminStaffName
            }
        });
        createdItems.push(created);
    }

    await prisma.aiOfficeConfig.update({
        where: { id: 1 },
        data: { lastAdminRunAt: new Date() }
    });

    await prisma.aiOfficeRunLog.create({
        data: {
            staffRole: 'ADMINISTRASI',
            trigger,
            status: usedFallback ? 'PARTIAL' : 'SUCCESS',
            summary: `Mengajukan ${createdItems.length} daftar usulan dokumen (menunggu ACC pimpinan)${usedFallback ? ' [mode kurasi cadangan]' : ''}.`,
            itemsCreated: createdItems.length,
            itemsDrafted: 0,
            errorMessage: aiError
        }
    });

    return { usedFallback, items: createdItems };
}

function buildFallbackDraftDocument(item, config) {
    const today = getTodayWib();
    if (item.category === 'SOP') {
        const baseTemplate = (config.sopGeneralFormat || DEFAULT_SOP_GENERAL_FORMAT)
            .replace('[Diisi otomatis / sesuai nomor arsip Kantor AI]', item.code)
            .replace('[Judul Jelas & Operasional]', item.title)
            .replace('[Tanggal / Rev. 01]', `${today} / Rev. 01`);

        return [
            baseTemplate,
            '',
            '---',
            '## Catatan Penyesuaian Khusus Bidang Sarana',
            `- **Bidang Terkait:** ${item.domain || 'Umum'}`,
            `- **Latar Belakang / Kebutuhan:** ${item.rationale || '-'}`,
            `- **Ruang Lingkup Instruksi:** ${item.brief || 'Mengikuti alur operasional standar aplikasi Manajemen Aset Bidang Sarana.'}`,
            '',
            '_Draft ini disusun sebagai kerangka siap tinjau dari format SOP umum Kantor AI. Gunakan fitur "Revisi dengan AI" atau edit langsung untuk penyempurnaan akhir._'
        ].join('\n');
    }

    return [
        `# ${item.title.toUpperCase()}`,
        ``,
        `- **Kode Arsip Kantor AI:** ${item.code}`,
        `- **Kategori:** ${item.category}`,
        `- **Bidang:** ${item.domain || 'Umum'}`,
        `- **Tanggal Penyusunan:** ${today}`,
        `- **Penyusun:** ${config.adminStaffName}`,
        ``,
        `## 1. Latar Belakang`,
        item.rationale || 'Disusun untuk mendukung ketertiban administrasi dan operasional Bidang Sarana Yayasan Dar el-Iman.',
        ``,
        `## 2. Pokok Ketentuan / Isi Dokumen`,
        item.brief || 'Mengatur hak, kewajiban, mekanisme koordinasi, dan pelaporan unit terkait kepada Kepala Bidang Sarana.',
        ``,
        `## 3. Penanggung Jawab & Tindak Lanjut`,
        `- Kepala Bidang Sarana selaku pengarah dan pengambil keputusan akhir.`,
        `- Admin Aset / Penanggung Jawab Unit selaku pelaksana pencatatan dan pengawasan di sistem.`,
        ``,
        `## 4. Penutup`,
        `Dokumen ini merupakan draft internal Kantor AI untuk ditinjau Kepala Bidang Sarana sebelum diterbitkan secara resmi.`,
        ``,
        `_Disusun dalam mode template cadangan terstruktur._`
    ].join('\n');
}

async function draftApprovedItem({
    prisma = defaultPrisma,
    itemId,
    trigger = 'MANUAL',
    actor = null
} = {}) {
    const id = parseInt(itemId, 10);
    if (Number.isNaN(id)) {
        const err = new Error('ID dokumen tidak valid.');
        err.statusCode = 400;
        throw err;
    }

    const item = await prisma.aiOfficeItem.findUnique({ where: { id } });
    if (!item) {
        const err = new Error('Dokumen Kantor AI tidak ditemukan.');
        err.statusCode = 404;
        throw err;
    }

    if (!['APPROVED_FOR_DRAFT', 'DRAFT_READY'].includes(item.status)) {
        const err = new Error('Usulan harus di-ACC terlebih dahulu sebelum disusun draft.');
        err.statusCode = 400;
        throw err;
    }

    const config = await getOrCreateConfig(prisma);
    await prisma.aiOfficeItem.update({
        where: { id },
        data: { status: 'DRAFTING' }
    });

    const snapshot = await collectOperationalSnapshot(prisma);
    let content = '';
    let usedFallback = false;
    let aiError = null;

    const sopInstructions = item.category === 'SOP'
        ? `WAJIB mengikuti dan mengembangkan FORMAT SOP UMUM dari pimpinan di bawah ini menjadi SOP yang sangat operasional, lengkap, detail, dan siap pakai:\n\n${config.sopGeneralFormat || DEFAULT_SOP_GENERAL_FORMAT}`
        : `Susun dokumen resmi kategori "${item.category}" secara lengkap, terstruktur (Header/Nomor Arsip ${item.code}, Dasar Pertimbangan, Pasal/Poin Ketentuan lengkap, Pihak Terkait, Mekanisme Pelaksanaan, Sanksi/Evaluasi, dan Penutup).`;

    const prompt = `Anda adalah ${config.adminStaffName} di Kantor AI Bidang Sarana Yayasan Dar el-Iman.
Kepala Bidang Sarana telah MENYETUJUI (ACC) penyusunan draft dokumen berikut:

- Kode Dokumen Kantor AI: ${item.code}
- Kategori: ${item.category}
- Bidang: ${item.domain || 'Umum'}
- Judul: ${item.title}
- Latar Belakang / Kebutuhan: ${item.rationale || '-'}
- Arahan Khusus / Brief Pimpinan: ${item.brief || '-'}
- Catatan Revisi (jika ada): ${item.revisionNotes || '-'}

KONTEKS KONDISI NYATA BIDANG SARANA SAAT INI:
- Total aset ${snapshot.assets.total}, pinjaman pending ${snapshot.assets.loansPending}, overdue ${snapshot.assets.loansOverdue}
- Maintenance terbuka ${snapshot.maintenance.openCount}, kendaraan aktif ${snapshot.vehicles.active}, servis pending ${snapshot.vehicles.servicePending}
- Workshop Unit 21 aktif ${snapshot.workshop.activeOrders}, pengadaan berjalan ${snapshot.procurement.openCount}, gudang stok menipis ${snapshot.warehouse.lowStockCount}

ATURAN PENULISAN:
${config.policyGuidelines || DEFAULT_POLICY_GUIDELINES}

${sopInstructions}

Kembalikan naskah dokumen lengkap dalam format Markdown yang bersih dan terstruktur rapi (siap dibaca dan diekspor ke PDF).`;

    try {
        const res = await aiService.generateContentWithFallback(prompt);
        content = res?.response?.text?.()?.trim() || '';
        if (!content) throw new Error('Respons AI kosong saat menyusun draft');
    } catch (err) {
        usedFallback = true;
        aiError = err.message;
        content = buildFallbackDraftDocument(item, config);
    }

    const updated = await prisma.aiOfficeItem.update({
        where: { id },
        data: {
            content,
            status: 'DRAFT_READY',
            triggeredBy: trigger
        }
    });

    await prisma.aiOfficeConfig.update({
        where: { id: 1 },
        data: { lastAdminRunAt: new Date() }
    });

    await prisma.aiOfficeRunLog.create({
        data: {
            staffRole: 'ADMINISTRASI',
            trigger,
            status: usedFallback ? 'PARTIAL' : 'SUCCESS',
            summary: `Menyusun draft lengkap ${updated.code} (${updated.title})${usedFallback ? ' [template fallback]' : ''}.`,
            itemsCreated: 0,
            itemsDrafted: 1,
            errorMessage: aiError
        }
    });

    return { usedFallback, item: updated };
}

async function reviseDraftItem({
    prisma = defaultPrisma,
    itemId,
    instruction,
    actor = null
} = {}) {
    const id = parseInt(itemId, 10);
    if (Number.isNaN(id)) {
        const err = new Error('ID dokumen tidak valid.');
        err.statusCode = 400;
        throw err;
    }
    if (!instruction || !String(instruction).trim()) {
        const err = new Error('Instruksi revisi wajib diisi.');
        err.statusCode = 400;
        throw err;
    }

    const item = await prisma.aiOfficeItem.findUnique({ where: { id } });
    if (!item) {
        const err = new Error('Dokumen tidak ditemukan.');
        err.statusCode = 404;
        throw err;
    }

    const config = await getOrCreateConfig(prisma);
    const cleanInstruction = String(instruction).trim();
    let updatedContent = '';
    let usedFallback = false;
    let aiError = null;

    const prompt = `Anda adalah ${item.staffRole === 'SUPERVISI' ? config.supervisorName : config.adminStaffName} di Kantor AI Bidang Sarana Yayasan Dar el-Iman.
Perbarui/revisi dokumen berikut sesuai instruksi pimpinan tanpa menghilangkan struktur penting yang sudah ada.

JUDUL: ${item.title}
KATEGORI: ${item.category}
${item.category === 'SOP' ? `ACUAN FORMAT SOP UMUM:\n${config.sopGeneralFormat}\n` : ''}
ISI DOKUMEN SAAT INI:
${item.content || '(Kosong)'}

INSTRUKSI REVISI DARI PIMPINAN (${actor?.name || 'Kepala Bidang Sarana'}):
"${cleanInstruction}"

Kembalikan seluruh isi dokumen hasil revisi secara lengkap dalam format Markdown yang rapi.`;

    try {
        const res = await aiService.generateContentWithFallback(prompt);
        updatedContent = res?.response?.text?.()?.trim() || '';
        if (!updatedContent) throw new Error('Respons AI kosong saat revisi');
    } catch (err) {
        usedFallback = true;
        aiError = err.message;
        updatedContent = `${item.content || buildFallbackDraftDocument(item, config)}\n\n---\n## Catatan Tambahan / Revisi (${dayjs().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm')})\n- ${cleanInstruction}`;
    }

    const updated = await prisma.aiOfficeItem.update({
        where: { id },
        data: {
            content: updatedContent,
            revisionNotes: cleanInstruction,
            status: item.status === 'FINALIZED' ? 'FINALIZED' : 'DRAFT_READY'
        }
    });

    await prisma.aiOfficeRunLog.create({
        data: {
            staffRole: item.staffRole,
            trigger: 'MANUAL',
            status: usedFallback ? 'PARTIAL' : 'SUCCESS',
            summary: `Merevisi ${updated.code} sesuai arahan: "${cleanInstruction.slice(0, 100)}"${usedFallback ? ' [catatan fallback]' : ''}.`,
            itemsCreated: 0,
            itemsDrafted: 1,
            errorMessage: aiError
        }
    });

    return { usedFallback, item: updated };
}

async function runDailyOfficeRoutine({
    prisma = defaultPrisma,
    trigger = 'SCHEDULER',
    force = false
} = {}) {
    if (!force && process.env.USE_LOCAL_STORAGE === 'true') {
        return { skipped: true, reason: 'USE_LOCAL_STORAGE=true' };
    }

    if (isRoutineRunning) {
        return { skipped: true, reason: 'Shift Kantor AI sedang berjalan.' };
    }

    isRoutineRunning = true;
    try {
        const config = await getOrCreateConfig(prisma);
        if (!force && !config.isEnabled) {
            return { skipped: true, reason: 'Otomasi Kantor AI sedang dinonaktifkan.' };
        }

        const today = getTodayWib();
        const supervisorResult = await runSupervisorShift({ prisma, trigger, force });

        let draftedCount = 0;
        const draftedItems = [];
        const maxDrafts = Math.max(1, Math.min(5, config.maxDailyDrafts || 2));

        const approvedQueue = await prisma.aiOfficeItem.findMany({
            where: {
                staffRole: 'ADMINISTRASI',
                status: 'APPROVED_FOR_DRAFT'
            },
            orderBy: [
                { approvedAt: 'asc' },
                { createdAt: 'asc' }
            ],
            take: maxDrafts
        });

        for (const queueItem of approvedQueue) {
            try {
                const draftRes = await draftApprovedItem({ prisma, itemId: queueItem.id, trigger });
                draftedCount += 1;
                draftedItems.push(draftRes.item);
            } catch (err) {
                console.error(`[AiOffice] Gagal draft item #${queueItem.id}:`, err.message);
            }
        }

        const [adminTodayCount, proposedCount] = await Promise.all([
            prisma.aiOfficeItem.count({
                where: {
                    staffRole: 'ADMINISTRASI',
                    outputDate: today
                }
            }),
            prisma.aiOfficeItem.count({
                where: {
                    staffRole: 'ADMINISTRASI',
                    status: 'PROPOSED'
                }
            })
        ]);

        let proposedResult = { items: [] };
        if (force || (adminTodayCount === 0 && draftedCount === 0 && proposedCount < 8)) {
            proposedResult = await proposeAdminBacklog({
                prisma,
                trigger,
                count: 3
            });
        }

        return {
            skipped: false,
            outputDate: today,
            supervisorCreated: !supervisorResult.skipped,
            draftedCount,
            proposedCreated: proposedResult.items?.length || 0
        };
    } finally {
        isRoutineRunning = false;
    }
}

module.exports = {
    DEFAULT_SOP_GENERAL_FORMAT,
    DEFAULT_POLICY_GUIDELINES,
    CURATED_ADMIN_PROPOSALS,
    getTodayWib,
    generateItemCode,
    getOrCreateConfig,
    collectOperationalSnapshot,
    runSupervisorShift,
    proposeAdminBacklog,
    draftApprovedItem,
    reviseDraftItem,
    runDailyOfficeRoutine
};
