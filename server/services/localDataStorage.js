const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const isoWeek = require('dayjs/plugin/isoWeek');
dayjs.extend(isoWeek);

const DATA_DIR = path.join(__dirname, '../data_local');

// Pastikan folder data_local selalu ada
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const getFilePath = (filename) => path.join(DATA_DIR, filename);

const readJson = (filename, defaultVal = []) => {
    const filePath = getFilePath(filename);
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), 'utf-8');
            return defaultVal;
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.warn(`[LocalDataStorage] Gagal membaca ${filename}, menggunakan default:`, err.message);
        return defaultVal;
    }
};

const writeJson = (filename, data) => {
    const filePath = getFilePath(filename);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error(`[LocalDataStorage] Gagal menulis ${filename}:`, err);
        return false;
    }
};

// Data Staf Default untuk dropdown & daftar staf Sarpras di Localhost
const DEFAULT_STAFF = [
    { id: 1, name: 'Ravi Kurnia (Kabid Sarana)', username: 'kabid', role: 'KABID_SARPRAS', position: 'Kepala Bidang Sarana', phone: '081234567890' },
    { id: 2, name: 'Staff Teknisi Lapangan', username: 'teknisi', role: 'USER', position: 'Staff Teknisi', phone: '081234567891' },
    { id: 3, name: 'Admin Sarana & Aset', username: 'admin_aset', role: 'ADMIN_ASET', position: 'Staff Manajemen Aset', phone: '081234567892' },
    { id: 4, name: 'Super Administrator (IT)', username: 'superadmin', role: 'SUPER_ADMIN', position: 'Kepala Bidang IT', phone: '081234567893' },
    { id: 5, name: 'Admin Unit Sekolah', username: 'admin_unit', role: 'ADMIN_UNIT', position: 'Tata Usaha Unit', phone: '081234567894' },
    { id: 6, name: 'Staff Gudang & Logistik', username: 'gudang', role: 'USER', position: 'Staff Gudang dan Logistik', phone: '081234567895' },
    { id: 7, name: 'Staff Teknisi Listrik & AC', username: 'teknisi_ac', role: 'USER', position: 'Staff Teknisi Listrik dan AC', phone: '081234567896' }
];

// Data Awal Rencana Kerja (Jika belum pernah disimpan)
const DEFAULT_PLANS = [
    {
        id: 101,
        userId: 1,
        type: 'WEEKLY',
        category: 'ASET',
        content: 'Rencana Umum: Modernisasi & Sensus Aset Sarpras 2026',
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
            isPlan: true,
            isProject: true,
            planType: 'PROJECT',
            projectId: null,
            title: 'Modernisasi & Sensus Aset Sarpras 2026',
            targetOutput: '100% Seluruh aset terlabel QR Code & terekap di sistem',
            position: 'Kepala Bidang Sarana',
            categoryTag: 'ASET',
            priority: 'TINGGI',
            startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
            endDate: dayjs().add(1, 'month').format('YYYY-MM-DD'),
            status: 'PENDING',
            percentage: 33,
            items: [
                { activity: 'Pencetakan label stiker QR code aset baru', targetDate: dayjs().add(3, 'day').format('YYYY-MM-DD'), status: 'SELESAI', percentage: 100 },
                { activity: 'Sensus & penempelan label di seluruh ruangan unit', targetDate: dayjs().add(10, 'day').format('YYYY-MM-DD'), status: 'PENDING', percentage: 0 },
                { activity: 'Rekonsiliasi data inventaris fisik dengan sistem', targetDate: dayjs().add(20, 'day').format('YYYY-MM-DD'), status: 'PENDING', percentage: 0 }
            ]
        }
    },
    {
        id: 102,
        userId: 3,
        type: 'WEEKLY',
        category: 'ASET',
        content: 'Rencana Mingguan: Verifikasi Data Inventaris & Labelisasi',
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
            isPlan: true,
            isProject: false,
            planType: 'WEEKLY',
            projectId: 101,
            title: 'Verifikasi Data Inventaris & Labelisasi',
            targetOutput: 'Penyelesaian labelisasi unit gedung utama',
            position: 'Staff Manajemen Aset',
            categoryTag: 'ASET',
            priority: 'SEDANG',
            startDate: dayjs().startOf('isoWeek').format('YYYY-MM-DD'),
            endDate: dayjs().startOf('isoWeek').add(5, 'day').format('YYYY-MM-DD'),
            status: 'PENDING',
            percentage: 50,
            items: [
                { activity: 'Pengecekan fisik aset gedung kantor utama', targetDate: dayjs().add(2, 'day').format('YYYY-MM-DD'), status: 'SELESAI', percentage: 100 },
                { activity: 'Update status aset rusak ringan di sistem', targetDate: dayjs().add(4, 'day').format('YYYY-MM-DD'), status: 'PENDING', percentage: 0 }
            ]
        }
    },
    {
        id: 105,
        userId: 2,
        type: 'WEEKLY',
        category: 'FASILITAS',
        content: 'Rencana Mingguan: Perawatan Sanitasi & Utilitas Gedung',
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
            isPlan: true,
            isProject: false,
            planType: 'WEEKLY',
            title: 'Perawatan Sanitasi & Utilitas Gedung Sekolah',
            targetOutput: 'Nol kebocoran dan seluruh sanitasi berfungsi 100%',
            position: 'Staff Teknisi Lapangan',
            categoryTag: 'FASILITAS',
            priority: 'SEDANG',
            startDate: dayjs().startOf('isoWeek').format('YYYY-MM-DD'),
            endDate: dayjs().startOf('isoWeek').add(5, 'day').format('YYYY-MM-DD'),
            status: 'PENDING',
            percentage: 50,
            items: [
                { activity: 'Perbaikan kran wudhu dan pipa air lantai 1 & 2', targetDate: dayjs().add(2, 'day').format('YYYY-MM-DD'), status: 'SELESAI', percentage: 100 },
                { activity: 'Inspeksi engsel pintu kelas dan kunci jendela', targetDate: dayjs().add(4, 'day').format('YYYY-MM-DD'), status: 'PENDING', percentage: 0 }
            ]
        }
    },
    {
        id: 106,
        userId: 7,
        type: 'WEEKLY',
        category: 'FASILITAS',
        content: 'Rencana Mingguan: Perawatan Preventif AC & Kelistrikan',
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
            isPlan: true,
            isProject: false,
            planType: 'WEEKLY',
            title: 'Perawatan Preventif AC & Kelistrikan Gedung',
            targetOutput: '15 Unit AC dingin optimal & genset siap operasional',
            position: 'Staff Teknisi Listrik dan AC',
            categoryTag: 'FASILITAS',
            priority: 'TINGGI',
            startDate: dayjs().startOf('isoWeek').format('YYYY-MM-DD'),
            endDate: dayjs().startOf('isoWeek').add(5, 'day').format('YYYY-MM-DD'),
            status: 'PENDING',
            percentage: 50,
            items: [
                { activity: 'Cuci filter dan perawatan berkala AC Gedung Kantor', targetDate: dayjs().add(1, 'day').format('YYYY-MM-DD'), status: 'SELESAI', percentage: 100 },
                { activity: 'Pengecekan panel otomatisasi genset cadangan', targetDate: dayjs().add(5, 'day').format('YYYY-MM-DD'), status: 'PENDING', percentage: 0 }
            ]
        }
    }
];

// OKR Default
const DEFAULT_OKRS = [
    {
        id: 'obj-1',
        title: 'Keandalan Sarana, Prasarana & Tanggap Darurat Fasilitas',
        category: 'FASILITAS',
        targetPeriod: 'Kuartal Berjalan',
        overallScore: 92,
        keyResults: [
            { id: 'kr-1-1', title: 'Respon Cepat Keluhan Kerusakan Sarana (SLA < 2 Jam)', target: 2.0, actual: 1.4, unit: 'Jam', score: 95 },
            { id: 'kr-1-2', title: 'Tingkat Penyelesaian Tiket Perbaikan Fasilitas', target: 95, actual: 91, unit: '%', score: 90 }
        ]
    },
    {
        id: 'obj-2',
        title: 'Kesiapan Operasional & Keselamatan Armada Kendaraan Dinas',
        category: 'KENDARAAN',
        targetPeriod: 'Kuartal Berjalan',
        overallScore: 100,
        keyResults: [
            { id: 'kr-2-1', title: 'Zero Incident Kendaraan Mogok / Rusak saat Operasional', target: 0, actual: 0, unit: 'Kasus', score: 100 },
            { id: 'kr-2-2', title: 'Kepatuhan Servis Berkala & Ganti Oli Tepat Waktu', target: 100, actual: 100, unit: '%', score: 100 }
        ]
    },
    {
        id: 'obj-3',
        title: 'Disiplin Eksekusi Penugasan & Efektivitas Pelaporan Lapangan',
        category: 'MANAJEMEN',
        targetPeriod: 'Kuartal Berjalan',
        overallScore: 88,
        keyResults: [
            { id: 'kr-3-1', title: 'Tingkat Penyelesaian Penugasan Kabid Tepat Waktu', target: 85, actual: 82, unit: '%', score: 86 },
            { id: 'kr-3-2', title: 'Kepatuhan dan Ketertiban Pengisian Laporan Harian Staf', target: 90, actual: 88, unit: '%', score: 90 }
        ]
    }
];

class LocalDataStorage {
    constructor() {
        if (!fs.existsSync(getFilePath('staff_users.json'))) {
            writeJson('staff_users.json', DEFAULT_STAFF);
        }
        const curPlans = readJson('staff_plans.json', []);
        if (!fs.existsSync(getFilePath('staff_plans.json')) || curPlans.length === 0) {
            writeJson('staff_plans.json', DEFAULT_PLANS);
        }
        const curReports = readJson('daily_reports.json', []);
        if (!fs.existsSync(getFilePath('daily_reports.json')) || curReports.length === 0) {
            writeJson('daily_reports.json', this.generateDefaultDailyReports());
        }
        if (!fs.existsSync(getFilePath('okrs.json'))) {
            writeJson('okrs.json', DEFAULT_OKRS);
        }
        const curAssignments = readJson('assignments.json', []);
        if (!fs.existsSync(getFilePath('assignments.json')) || curAssignments.length === 0) {
            writeJson('assignments.json', this.generateDefaultAssignments());
        }
    }

    generateDefaultDailyReports(targetDate) {
        const today = targetDate || dayjs().format('YYYY-MM-DD');
        return [
            {
                id: 1001,
                userId: 3, // Admin Sarana & Aset
                type: 'DAILY',
                category: 'ASET',
                content: 'Laporan harian sensus dan verifikasi aset sarana prasarana',
                date: today,
                metadata: {
                    manualPoints: {
                        morning: [
                            {
                                text: 'Verifikasi fisik dan penempelan barcode QR Code aset inventaris gedung utama',
                                categoryTag: 'ASET',
                                sourceType: 'PLAN',
                                isRoutine: false,
                                percentage: 100,
                                status: 'SELESAI',
                                output: '45 unit meja, kursi, dan lemari arsip selesai diverifikasi & terlabel QR Code'
                            }
                        ],
                        afternoon: [
                            {
                                text: 'Perekaman dan update data aset rusak ringan ke dalam sistem manajemen inventaris',
                                categoryTag: 'ASET',
                                sourceType: 'PLAN',
                                isRoutine: false,
                                percentage: 60,
                                status: 'PROSES',
                                targetDate: today
                            },
                            {
                                text: 'Pencetakan ulang label barcode untuk aset perangkat IT lab komputer',
                                categoryTag: 'ASET',
                                sourceType: 'INCIDENTAL',
                                isRoutine: false,
                                percentage: 30,
                                status: 'KENDALA',
                                obstacleNote: 'Kertas stiker label thermal 40x30mm habis, menunggu distribusi tambahan'
                            }
                        ]
                    },
                    tomorrowPlans: [
                        { title: 'Sensus lanjutan inventaris perangkat IT di Lab Komputer Lantai 2', categoryTag: 'ASET' }
                    ]
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 1002,
                userId: 2, // Staff Teknisi Lapangan
                type: 'DAILY',
                category: 'FASILITAS',
                content: 'Laporan perbaikan pipa air dan pengecekan pintu kelas',
                date: today,
                metadata: {
                    manualPoints: {
                        morning: [
                            {
                                text: 'Perbaikan instalasi saluran pipa air & kran wudhu gedung ibadah utama',
                                categoryTag: 'FASILITAS',
                                sourceType: 'PLAN',
                                isRoutine: false,
                                percentage: 100,
                                status: 'SELESAI',
                                output: 'Saluran air lancar, 2 kran bocor telah diganti baru'
                            }
                        ],
                        afternoon: [
                            {
                                text: 'Pemeriksaan dan perbaikan engsel pintu ruang kelas lantai 1',
                                categoryTag: 'FASILITAS',
                                sourceType: 'PLAN',
                                isRoutine: false,
                                percentage: 70,
                                status: 'PROSES',
                                targetDate: today
                            }
                        ]
                    },
                    tomorrowPlans: [
                        { title: 'Pengecekan rutin tandon air dan pompa submersible', categoryTag: 'FASILITAS' }
                    ]
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 1003,
                userId: 7, // Staff Teknisi Listrik & AC
                type: 'DAILY',
                category: 'FASILITAS',
                content: 'Laporan pemeliharaan AC dan kelistrikan',
                date: today,
                metadata: {
                    manualPoints: {
                        morning: [
                            {
                                text: 'Pembersihan filter dan cuci unit AC di Ruang Kantor Pimpinan & Guru',
                                categoryTag: 'FASILITAS',
                                sourceType: 'PLAN',
                                isRoutine: true,
                                percentage: 100,
                                status: 'SELESAI',
                                output: '4 Unit AC bersih dan berfungsi dingin optimal'
                            }
                        ],
                        afternoon: [
                            {
                                text: 'Pengecekan panel distribusi daya listrik dan pengujian genset otomatis',
                                categoryTag: 'FASILITAS',
                                sourceType: 'INCIDENTAL',
                                isRoutine: false,
                                percentage: 40,
                                status: 'KENDALA',
                                obstacleNote: 'Aki starter genset cadangan drop tegangan (perlu penggantian aki)'
                            }
                        ]
                    },
                    tomorrowPlans: [
                        { title: 'Penggantian aki genset dan running test beban penuh', categoryTag: 'FASILITAS' }
                    ]
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 1004,
                userId: 6, // Staff Gudang & Logistik
                type: 'DAILY',
                category: 'LOGISTIK',
                content: 'Laporan penerimaan dan pencatatan barang inventaris logistik',
                date: today,
                metadata: {
                    manualPoints: {
                        morning: [
                            {
                                text: 'Penerimaan dan pencatatan barang logistik masuk (ATK dan perlengkapan sarpras)',
                                categoryTag: 'LOGISTIK',
                                sourceType: 'PLAN',
                                isRoutine: true,
                                percentage: 100,
                                status: 'SELESAI',
                                output: 'Seluruh surat jalan terverifikasi dan stok terinput di aplikasi'
                            }
                        ]
                    }
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
    }

    generateDefaultAssignments() {
        return [
            {
                id: 201,
                title: 'Audit & Sensus Fisik Aset Inventaris Gedung Utama',
                description: 'Lakukan verifikasi menyeluruh seluruh aset inventaris di gedung utama dan pastikan label QR Code terpasang rapi.',
                assigneeId: 3, // Admin Sarana & Aset
                assignerId: 1, // Kabid Sarana
                startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
                dueDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
                priority: 'TINGGI',
                status: 'IN_PROGRESS',
                progressPercentage: 66,
                category: 'ASET',
                targetOutput: '100% Seluruh aset terlabel QR Code & terekap di sistem',
                items: [
                    {
                        activity: 'Pencetakan 200 label stiker QR code aset baru',
                        targetDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
                        percentage: 100,
                        status: 'COMPLETED',
                        isDone: true
                    },
                    {
                        activity: 'Sensus fisik & penempelan label barcode di Gedung Kantor Utama',
                        targetDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
                        percentage: 100,
                        status: 'COMPLETED',
                        isDone: true
                    },
                    {
                        activity: 'Rekonsiliasi data inventaris fisik dengan sistem database',
                        targetDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
                        percentage: 0,
                        status: 'PENDING',
                        isDone: false
                    }
                ],
                notes: 'Penugasan resmi sensus kuartal berjalan',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 202,
                title: 'Perbaikan Sanitasi dan Pengecekan Berkala Fasilitas Gedung',
                description: 'Pemeriksaan dan perbaikan rutin seluruh fasilitas perpipaan, kran, dan kunci ruangan.',
                assigneeId: 2, // Staff Teknisi Lapangan
                assignerId: 1, // Kabid Sarana
                startDate: dayjs().startOf('isoWeek').format('YYYY-MM-DD'),
                dueDate: dayjs().endOf('isoWeek').format('YYYY-MM-DD'),
                priority: 'SEDANG',
                status: 'IN_PROGRESS',
                progressPercentage: 50,
                category: 'FASILITAS',
                targetOutput: 'Fasilitas sanitasi dan instalasi air gedung berfungsi optimal',
                items: [
                    {
                        activity: 'Perbaikan keran dan pipa air bocor di lantai 1 & 2',
                        targetDate: dayjs().add(2, 'day').format('YYYY-MM-DD'),
                        percentage: 100,
                        status: 'COMPLETED',
                        isDone: true
                    },
                    {
                        activity: 'Pengecekan berkala pompa distribusi air toren',
                        targetDate: dayjs().add(4, 'day').format('YYYY-MM-DD'),
                        percentage: 0,
                        status: 'PENDING',
                        isDone: false
                    }
                ],
                notes: 'Pemeliharaan fasilitas rutin',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 203,
                title: 'Servis Berkala & Pembersihan Unit AC Split',
                description: 'Perawatan rutin AC ruang kantor dan ruang kelas demi kenyamanan operasional.',
                assigneeId: 7, // Staff Teknisi Listrik & AC
                assignerId: 1, // Kabid Sarana
                startDate: dayjs().startOf('isoWeek').format('YYYY-MM-DD'),
                dueDate: dayjs().add(6, 'day').format('YYYY-MM-DD'),
                priority: 'TINGGI',
                status: 'IN_PROGRESS',
                progressPercentage: 33,
                category: 'FASILITAS',
                targetOutput: '15 Unit AC bersih dan berfungsi dingin optimal (18-20°C)',
                items: [
                    {
                        activity: 'Pembersihan evaporator & filter AC Ruang Guru',
                        targetDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
                        percentage: 100,
                        status: 'COMPLETED',
                        isDone: true
                    },
                    {
                        activity: 'Pengecekan tekanan freon dan drainase air AC Gedung Utama',
                        targetDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
                        percentage: 0,
                        status: 'PENDING',
                        isDone: false
                    },
                    {
                        activity: 'Pengujian panel beban listrik otomatis genset',
                        targetDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
                        percentage: 0,
                        status: 'PENDING',
                        isDone: false
                    }
                ],
                notes: 'Perawatan preventif AC',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
    }

    getStaffUsers() {
        return readJson('staff_users.json', DEFAULT_STAFF);
    }

    getAllPlans() {
        let plans = readJson('staff_plans.json', []);
        if (!plans || plans.length === 0) {
            plans = DEFAULT_PLANS;
            writeJson('staff_plans.json', plans);
        }
        return plans;
    }

    getStaffPlansAndAssignments(currentUserId = null, isManager = true) {
        let staffList = this.getStaffUsers();
        if (!isManager && currentUserId) {
            staffList = staffList.filter(s => s.id === parseInt(currentUserId, 10));
        }
        const allPlans = this.getAllPlans();
        let assignments = readJson('assignments.json', []);
        if (!assignments || assignments.length === 0) {
            assignments = this.generateDefaultAssignments();
            writeJson('assignments.json', assignments);
        }
        const activePlans = allPlans.filter(p => p.metadata && p.metadata.isPlan);

        const allActiveProjects = [];
        const allActiveWeeklyPlans = [];

        const staff = staffList.map(st => {
            const userPlans = activePlans.filter(p => p.userId === st.id);
            const userAssignments = assignments.filter(a => a.assigneeId === st.id).map(a => ({
                id: a.id,
                title: a.title,
                description: a.description,
                targetOutput: a.targetOutput || '',
                items: Array.isArray(a.items) ? a.items : [],
                category: a.category,
                priority: a.priority,
                status: a.status,
                dueDate: a.dueDate,
                progressPercentage: a.progressPercentage || 0,
                isOverdue: a.status !== 'COMPLETED' && a.dueDate && new Date(a.dueDate) < new Date(),
                notes: a.notes || null,
                isFromPlan: !!(a.planId || (a.notes && a.notes.includes('Ditugaskan dari Rencana Kerja'))),
                createdAt: a.createdAt
            }));

            const mappedPlans = userPlans.map(p => {
                const meta = p.metadata || {};
                const isProject = !!meta.isProject || meta.planType === 'PROJECT';
                const items = Array.isArray(meta.items) ? meta.items : [];
                const avgPct = meta.percentage !== undefined ? meta.percentage : 
                    (items.length > 0 ? Math.round(items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / items.length) : 0);

                const planObj = {
                    id: p.id,
                    userId: p.userId,
                    user: { id: st.id, name: st.name, position: st.position },
                    title: meta.title || 'Rencana Kerja',
                    targetOutput: meta.targetOutput || '',
                    category: meta.categoryTag || p.category || 'UMUM',
                    categoryTag: meta.categoryTag || p.category || 'UMUM',
                    priority: meta.priority || 'SEDANG',
                    startDate: meta.startDate || p.date,
                    endDate: meta.endDate || null,
                    status: meta.status || (avgPct === 100 ? 'SELESAI' : 'PENDING'),
                    percentage: avgPct,
                    avgPct,
                    isDone: avgPct === 100 || meta.status === 'SELESAI',
                    items,
                    isProject,
                    planType: meta.planType || (isProject ? 'PROJECT' : 'WEEKLY'),
                    projectId: meta.projectId || null,
                    content: p.content,
                    createdAt: p.createdAt,
                    updatedAt: p.updatedAt
                };

                if (isProject) {
                    allActiveProjects.push(planObj);
                } else {
                    allActiveWeeklyPlans.push(planObj);
                }

                return planObj;
            });

            const myProjects = mappedPlans.filter(p => p.isProject);
            const myWeeklyPlans = mappedPlans.filter(p => !p.isProject);

            return {
                id: st.id,
                name: st.name,
                username: st.username,
                position: st.position,
                role: st.role,
                phone: st.phone,
                plans: mappedPlans,
                projects: myProjects,
                weeklyPlans: myWeeklyPlans,
                assignments: userAssignments,
                stats: {
                    totalPlans: mappedPlans.length,
                    activePlansCount: mappedPlans.filter(p => !p.isDone).length,
                    totalProjects: myProjects.length,
                    activeProjectsCount: myProjects.filter(p => !p.isDone).length,
                    totalAssignments: userAssignments.length,
                    activeAssignmentsCount: userAssignments.filter(a => a.status !== 'COMPLETED').length,
                    overdueAssignmentsCount: userAssignments.filter(a => a.isOverdue).length
                }
            };
        });

        return {
            success: true,
            totalStaff: staff.length,
            staff,
            projects: allActiveProjects,
            weeklyPlans: allActiveWeeklyPlans,
            isLocalOffline: true
        };
    }

    saveStaffPlan(payload, targetUserId, planId = null) {
        const plans = this.getAllPlans();
        const staffList = this.getStaffUsers();
        const user = staffList.find(s => s.id === parseInt(targetUserId, 10)) || staffList[0];

        let targetPlan = null;
        if (planId) {
            const idx = plans.findIndex(p => p.id === parseInt(planId, 10));
            if (idx !== -1) {
                plans[idx] = {
                    ...plans[idx],
                    ...payload,
                    userId: parseInt(targetUserId, 10),
                    updatedAt: new Date().toISOString()
                };
                targetPlan = plans[idx];
            }
        }

        if (!targetPlan) {
            const newId = plans.length > 0 ? Math.max(...plans.map(p => p.id || 0)) + 1 : 1;
            targetPlan = {
                id: newId,
                userId: parseInt(targetUserId, 10),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...payload
            };
            plans.unshift(targetPlan);
        }

        writeJson('staff_plans.json', plans);
        console.log(`[LocalDataStorage] Tersimpan ke data_local/staff_plans.json (ID: ${targetPlan.id})`);
        return targetPlan;
    }

    updatePlanItemStatus(planId, itemIndex, percentage, status) {
        const plans = this.getAllPlans();
        const plan = plans.find(p => p.id === parseInt(planId, 10));
        if (!plan || !plan.metadata || !Array.isArray(plan.metadata.items)) {
            return null;
        }

        const idx = parseInt(itemIndex, 10);
        if (plan.metadata.items[idx]) {
            plan.metadata.items[idx].percentage = parseInt(percentage, 10);
            plan.metadata.items[idx].status = status || (parseInt(percentage, 10) === 100 ? 'SELESAI' : (parseInt(percentage, 10) > 0 ? 'DALAM_PROSES' : 'PENDING'));

            const items = plan.metadata.items;
            const avg = items.length > 0 ? Math.round(items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / items.length) : 0;
            plan.metadata.percentage = avg;
            plan.metadata.status = avg === 100 ? 'SELESAI' : 'PENDING';
            plan.updatedAt = new Date().toISOString();

            writeJson('staff_plans.json', plans);
            console.log(`[LocalDataStorage] Update progres butir #${idx + 1} rencana #${planId} ke ${percentage}%`);
        }

        return plan;
    }

    deleteStaffPlan(planId) {
        let plans = this.getAllPlans();
        const initialLen = plans.length;
        plans = plans.filter(p => p.id !== parseInt(planId, 10));
        writeJson('staff_plans.json', plans);
        console.log(`[LocalDataStorage] Dihapus rencana #${planId} dari data_local/staff_plans.json`);
        return plans.length < initialLen;
    }

    createAssignment(assignmentData) {
        const assignments = readJson('assignments.json', []);
        const newId = assignments.length > 0 ? Math.max(...assignments.map(a => a.id || 0)) + 1 : 1;
        const staffList = this.getStaffUsers();
        const assignee = staffList.find(s => s.id === parseInt(assignmentData.assigneeId, 10));

        const newAssignment = {
            id: newId,
            ...assignmentData,
            assigneeId: parseInt(assignmentData.assigneeId, 10),
            assignee: assignee ? { id: assignee.id, name: assignee.name, phone: assignee.phone } : null,
            targetOutput: assignmentData.targetOutput || '',
            items: Array.isArray(assignmentData.items) ? assignmentData.items : [],
            status: 'PENDING',
            progressPercentage: 0,
            createdAt: new Date().toISOString()
        };
        assignments.unshift(newAssignment);
        writeJson('assignments.json', assignments);

        if (assignmentData.planId) {
            const plans = this.getAllPlans();
            const plan = plans.find(p => p.id === parseInt(assignmentData.planId, 10));
            if (plan && plan.metadata) {
                if (assignmentData.planItemIndex !== undefined && plan.metadata.items?.[assignmentData.planItemIndex]) {
                    plan.metadata.items[assignmentData.planItemIndex].assigned = true;
                    plan.metadata.items[assignmentData.planItemIndex].assignmentId = newId;
                } else {
                    plan.metadata.assigned = true;
                    plan.metadata.assignmentId = newId;
                }
                writeJson('staff_plans.json', plans);
            }
        }
        return newAssignment;
    }

    updateAssignmentItemStatus(assignmentId, itemIndex, percentage, status) {
        const assignments = readJson('assignments.json', []);
        const assignment = assignments.find(a => a.id === parseInt(assignmentId, 10));
        if (!assignment) return null;

        if (!Array.isArray(assignment.items)) assignment.items = [];
        const idx = parseInt(itemIndex, 10);
        const newPct = parseInt(percentage, 10);
        if (assignment.items[idx]) {
            assignment.items[idx].percentage = newPct;
            assignment.items[idx].status = status || (newPct === 100 ? 'COMPLETED' : (newPct > 0 ? 'IN_PROGRESS' : 'PENDING'));
            assignment.items[idx].isDone = newPct === 100;
        }

        const avg = assignment.items.length > 0
            ? Math.round(assignment.items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / assignment.items.length)
            : newPct;
        assignment.progressPercentage = avg;
        assignment.status = avg === 100 ? 'COMPLETED' : (avg > 0 ? 'IN_PROGRESS' : 'PENDING');
        assignment.updatedAt = new Date().toISOString();

        writeJson('assignments.json', assignments);
        console.log(`[LocalDataStorage] Update progres butir #${idx + 1} penugasan #${assignmentId} ke ${newPct}%`);

        if (assignment.planId) {
            this.updatePlanItemStatus(assignment.planId, assignment.planItemIndex, newPct, newPct === 100 ? 'SELESAI' : 'PENDING');
        }

        return assignment;
    }

    getDailyPpp(targetDate, currentUserId = null, isManager = true) {
        let reports = readJson('daily_reports.json', []);
        if (!reports || reports.length === 0) {
            reports = this.generateDefaultDailyReports(targetDate);
            writeJson('daily_reports.json', reports);
        }
        const filterDate = targetDate || dayjs().format('YYYY-MM-DD');

        const hasDateReports = reports.some(r => r.date && r.date.startsWith(filterDate));
        if (!hasDateReports && filterDate === dayjs().format('YYYY-MM-DD')) {
            const todayDefaults = this.generateDefaultDailyReports(filterDate);
            reports = [...todayDefaults, ...reports];
            writeJson('daily_reports.json', reports);
        }

        if (!isManager && currentUserId) {
            reports = reports.filter(r => r.userId === parseInt(currentUserId, 10));
        }
        const staffList = this.getStaffUsers();

        const filtered = reports.filter(r => !filterDate || (r.date && r.date.startsWith(filterDate)));

        const progressItems = [];
        const planItems = [];
        const problemItems = [];

        filtered.forEach(rep => {
            const meta = rep.metadata || {};
            const staff = staffList.find(s => s.id === rep.userId) || { id: rep.userId, name: 'Staf' };
            const pts = meta.manualPoints || {};
            const allPts = [
                ...(Array.isArray(pts.morning) ? pts.morning : []),
                ...(Array.isArray(pts.afternoon) ? pts.afternoon : [])
            ];

            allPts.forEach(p => {
                if (!p || typeof p !== 'object') return;
                const baseItem = {
                    source: 'STAFF_REPORT',
                    reportId: rep.id,
                    userId: rep.userId,
                    user: staff,
                    categoryTag: p.categoryTag || rep.category || 'UMUM',
                    title: p.text || 'Dokumentasi Kegiatan',
                    isPlanned: p.sourceType === 'PLAN' || !!p.isRoutine,
                    progressPercentage: p.percentage || (p.status === 'SELESAI' ? 100 : 50),
                    photos: Array.isArray(p.photos) ? p.photos : [],
                    status: p.status || 'SELESAI'
                };

                if (p.status === 'SELESAI' || p.percentage === 100) {
                    progressItems.push({ ...baseItem, output: p.output || 'Tuntas' });
                } else if (p.status === 'KENDALA' || p.obstacleNote) {
                    problemItems.push({ ...baseItem, obstacleNote: p.obstacleNote || 'Kendala lapangan' });
                } else {
                    planItems.push({ ...baseItem, targetDate: p.targetDate || 'Hari ini' });
                }
            });

            if (Array.isArray(meta.tomorrowPlans)) {
                meta.tomorrowPlans.forEach(tp => {
                    if (tp && tp.title) {
                        planItems.push({
                            source: 'TOMORROW_PLAN',
                            reportId: rep.id,
                            userId: rep.userId,
                            user: staff,
                            categoryTag: tp.categoryTag || 'UMUM',
                            title: tp.title,
                            targetDate: 'Hari Berikutnya',
                            isPlanned: true,
                            progressPercentage: 0,
                            photos: [],
                            status: 'IN_PROGRESS'
                        });
                    }
                });
            }
        });

        const totalItems = progressItems.length + planItems.length;
        const plannedItemsCount = progressItems.filter(i => i.isPlanned).length + planItems.filter(i => i.isPlanned).length;
        const plannedRatio = totalItems > 0 ? Math.round((plannedItemsCount / totalItems) * 100) : 100;

        return {
            success: true,
            date: filterDate,
            summary: {
                totalCompleted: progressItems.length,
                totalInProgress: planItems.length,
                totalProblems: problemItems.length,
                plannedRatio,
                unplannedRatio: 100 - plannedRatio
            },
            ppp: {
                progress: progressItems,
                plans: planItems,
                problems: problemItems
            },
            localReports: filtered,
            isLocalOffline: true
        };
    }

    saveDailyReport(reportData, userId) {
        const reports = readJson('daily_reports.json', []);
        const newReport = {
            id: Date.now(),
            userId: parseInt(userId, 10) || 1,
            type: 'DAILY',
            category: reportData.category || 'UMUM',
            content: reportData.content || '',
            date: reportData.date || dayjs().format('YYYY-MM-DD'),
            metadata: {
                manualPoints: reportData.metadata?.manualPoints || reportData.manualPoints || {},
                tomorrowPlans: reportData.metadata?.tomorrowPlans || reportData.tomorrowPlans || [],
                lastSubmittedAt: new Date().toISOString()
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        reports.unshift(newReport);
        writeJson('daily_reports.json', reports);
        console.log(`[LocalDataStorage] Tersimpan laporan harian PPP ke data_local/daily_reports.json`);
        return newReport;
    }

    getOkrs() {
        return readJson('okrs.json', DEFAULT_OKRS);
    }

    saveOkrs(okrData) {
        writeJson('okrs.json', okrData);
        console.log(`[LocalDataStorage] Tersimpan OKR ke data_local/okrs.json`);
        return okrData;
    }

    getMbeRadar(period = {}) {
        const plans = this.getAllPlans();
        const staffList = this.getStaffUsers();

        let onSchedule = 0;
        let delayed = 0;
        let done = 0;

        plans.forEach(p => {
            const items = p.metadata?.items || [];
            items.forEach(it => {
                if (it.percentage === 100 || it.status === 'SELESAI') {
                    done++;
                } else if (it.targetDate && dayjs(it.targetDate).isBefore(dayjs(), 'day')) {
                    delayed++;
                } else {
                    onSchedule++;
                }
            });
        });

        return {
            period: {
                startDate: period.startDate || dayjs().startOf('month').format('YYYY-MM-DD'),
                endDate: period.endDate || dayjs().endOf('month').format('YYYY-MM-DD')
            },
            summary: {
                totalStaff: staffList.length,
                totalPlans: plans.length,
                onSchedule,
                delayed,
                done,
                anomalyCount: delayed
            },
            anomalies: [],
            isLocalOffline: true
        };
    }

    getWeeklyPdca(period = {}, currentUserId = null, isManager = true) {
        let plans = this.getAllPlans();
        if (!isManager && currentUserId) {
            plans = plans.filter(p => p.userId === parseInt(currentUserId, 10));
        }
        const completedPlans = plans.filter(p => p.metadata?.percentage === 100 || p.metadata?.status === 'SELESAI');
        const planCompletionRate = plans.length > 0 ? Math.round((completedPlans.length / plans.length) * 100) : 100;

        return {
            period: {
                startDate: period.startDate || dayjs().startOf('isoWeek').format('YYYY-MM-DD'),
                endDate: period.endDate || dayjs().startOf('isoWeek').add(5, 'day').format('YYYY-MM-DD')
            },
            summary: {
                planCompletionRate,
                overallCompletionRate: planCompletionRate,
                plannedPercentage: 85,
                incidentalPercentage: 15,
                avgSlaHours: 1.2,
                totalObstacles: 0
            },
            pdca: {
                plan: {
                    title: 'Daftar Rencana Kerja & Sasaran Mingguan',
                    totalPlans: plans.length,
                    activePlans: plans.map(p => ({
                        id: p.id,
                        title: p.metadata?.title || 'Rencana Staf',
                        category: p.metadata?.categoryTag || 'UMUM',
                        priority: p.metadata?.priority || 'SEDANG',
                        percentage: p.metadata?.percentage || 0
                    }))
                },
                do: {
                    title: 'Eksekusi & Aktivitas Selesai',
                    totalCompleted: completedPlans.length
                },
                check: {
                    title: 'Evaluasi & Gap Analysis',
                    planCompletionRate,
                    overallCompletionRate: planCompletionRate,
                    plannedPercentage: 85,
                    incidentalPercentage: 15,
                    avgSlaHours: 1.2,
                    totalObstacles: 0,
                    obstacleCategories: {},
                    delayedTasks: []
                },
                act: {
                    title: 'Tindak Lanjut & Rekomendasi Pimpinan (Kaizen)',
                    recommendations: ['Pertahankan kinerja dan koordinasi tim di lapangan.'],
                    kaizenActions: []
                }
            },
            isLocalOffline: true
        };
    }
}

module.exports = new LocalDataStorage();
