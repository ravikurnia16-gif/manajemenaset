const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage } = require('../services/whatsappService');
const { generateDocumentNumber } = require('../services/documentNumberingService');
const { generateVerificationQR } = require('../services/officePdfService');
const crypto = require('crypto');

// Get all maintenance logs
exports.getAllMaintenanceLogs = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        let where = {};

        const pos = (req.user?.position || '').toLowerCase();
        const isKabidSarpras = role === 'KABID_SARPRAS' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras');
        const isSarpras = role === 'KEPALA_BIDANG' || pos.includes('sarana dan prasarana') || pos.includes('manajemen aset') || isKabidSarpras;

        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role) && !isSarpras) {
            where = {
                vehicle: {
                    pics: {
                        some: { id: userId }
                    }
                }
            };
        }

        if (req.query.status) {
            if (req.query.status === 'REQUESTS') {
                where.status = { in: ['PENDING', 'APPROVED', 'IN_PROGRESS'] };
            } else if (req.query.status === 'COMPLETED') {
                where.status = 'COMPLETED';
            } else {
                where.status = req.query.status;
            }
        }

        const logs = await prisma.vehicleService.findMany({
            where,
            include: { 
                vehicle: true,
                requester: { select: { id: true, name: true, username: true, position: true, phone: true } },
                approvedBy: { select: { id: true, name: true, username: true, position: true } }
            },
            orderBy: { date: 'desc' }
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single maintenance log
exports.getMaintenanceLogById = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        const log = await prisma.vehicleService.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                vehicle: {
                    include: { pics: { select: { id: true } } }
                },
                requester: { select: { id: true, name: true, username: true, position: true, phone: true } },
                approvedBy: { select: { id: true, name: true, username: true, position: true } }
            }
        });

        if (!log) return res.status(404).json({ error: 'Log tidak ditemukan' });

        // Access Check
        const pos = (req.user?.position || '').toLowerCase();
        const isKabidSarpras = role === 'KABID_SARPRAS' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras');
        const isSarpras = role === 'KEPALA_BIDANG' || pos.includes('sarana dan prasarana') || pos.includes('manajemen aset') || isKabidSarpras;

        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role) && !isSarpras) {
            const isPic = log.vehicle.pics.some(p => p.id === userId);
            if (!isPic) return res.status(403).json({ error: 'Anda tidak memiliki akses ke log kendaraan ini.' });
        }

        res.json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create maintenance log (supports multi-item)
exports.createMaintenanceLog = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        const {
            vehicleId, date, category, type, description, cost, odometer,
            nextServiceOdometer, nextServiceDate, workshop, proofFile, items
        } = req.body;

        // 1. Mandatory Validation
        if (!date || !vehicleId || !category || !type || !cost) {
            return res.status(400).json({ error: 'Data wajib diisi: Tanggal, Kendaraan, Jenis (Rutin/Tidak), Tipe Perbaikan, dan Biaya.' });
        }

        // 2. PIC Validation
        const pos = (req.user?.position || '').toLowerCase();
        const isKabidSarpras = role === 'KABID_SARPRAS' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras');
        const isSarpras = role === 'KEPALA_BIDANG' || pos.includes('sarana dan prasarana') || pos.includes('manajemen aset') || isKabidSarpras;

        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role) && !isSarpras) {
            const vehicle = await prisma.vehicle.findUnique({
                where: { id: parseInt(vehicleId) },
                include: { pics: { select: { id: true } } }
            });
            const isPic = vehicle?.pics.some(p => p.id === userId);
            if (!isPic) return res.status(403).json({ error: 'Anda bukan PIC kendaraan ini.' });
        }

        const log = await prisma.vehicleService.create({
            data: {
                vehicleId: parseInt(vehicleId),
                date: new Date(date),
                category,
                type,
                description: description || '-',
                cost: parseFloat(cost),
                odometer: odometer ? parseInt(odometer) : null,
                nextServiceOdometer: nextServiceOdometer ? parseInt(nextServiceOdometer) : null,
                nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
                items: items || null,
                workshop,
                proofFile
            }
        });

        // 3. Update Vehicle Odometer if provided
        // NOTE: Di-comment agar tidak mempengaruhi km terakhir kendaraan
        /*
        if (odometer) {
            await prisma.vehicle.update({
                where: { id: parseInt(vehicleId) },
                data: { odometer: parseInt(odometer) }
            });
        }
        */

        // 4. Auto-update reminders for routine items
        if (items && Array.isArray(items)) {
            const routineItems = items.filter(item => item.isRoutine);
            for (const item of routineItems) {
                if (!item.name) continue;

                // Calculate targets
                const targetKm = (odometer && item.intervalKm)
                    ? parseInt(odometer) + parseInt(item.intervalKm)
                    : (item.nextKm ? parseInt(item.nextKm) : null);

                let targetDate = null;
                if (item.intervalMonths) {
                    targetDate = new Date(date);
                    targetDate.setMonth(targetDate.getMonth() + parseInt(item.intervalMonths));
                } else if (item.nextDate) {
                    targetDate = new Date(item.nextDate);
                }

                await prisma.vehicleMaintenanceReminder.upsert({
                    where: {
                        vehicleId_componentName: {
                            vehicleId: parseInt(vehicleId),
                            componentName: item.name
                        }
                    },
                    create: {
                        vehicleId: parseInt(vehicleId),
                        componentName: item.name,
                        lastServicedKm: odometer ? parseInt(odometer) : null,
                        lastServicedDate: new Date(date),
                        intervalKm: item.intervalKm ? parseInt(item.intervalKm) : null,
                        intervalMonths: item.intervalMonths ? parseInt(item.intervalMonths) : null,
                        targetKm,
                        targetDate,
                        lastCost: item.cost ? parseFloat(item.cost) : null,
                        status: 'OK'
                    },
                    update: {
                        lastServicedKm: odometer ? parseInt(odometer) : null,
                        lastServicedDate: new Date(date),
                        intervalKm: item.intervalKm ? parseInt(item.intervalKm) : null,
                        intervalMonths: item.intervalMonths ? parseInt(item.intervalMonths) : null,
                        targetKm,
                        targetDate,
                        lastCost: item.cost ? parseFloat(item.cost) : null,
                        status: 'OK'
                    }
                });
            }
        }

        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update maintenance log
exports.updateMaintenanceLog = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        const {
            date, category, type, description, cost, odometer, nextServiceOdometer, nextServiceDate, workshop, proofFile, items
        } = req.body;

        // Access Check
        const existingLog = await prisma.vehicleService.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { vehicle: { include: { pics: { select: { id: true } } } } }
        });

        if (!existingLog) return res.status(404).json({ error: 'Log tidak ditemukan' });

        const pos = (req.user?.position || '').toLowerCase();
        const isKabidSarpras = role === 'KABID_SARPRAS' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras');
        const isSarpras = role === 'KEPALA_BIDANG' || pos.includes('sarana dan prasarana') || pos.includes('manajemen aset') || isKabidSarpras;

        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role) && !isSarpras) {
            const isPic = existingLog.vehicle.pics.some(p => p.id === userId);
            if (!isPic) return res.status(403).json({ error: 'Anda tidak memiliki izin mengedit log kendaraan ini.' });
        }

        const updateDate = date ? new Date(date) : existingLog.date;
        const updateOdometer = odometer !== undefined ? (odometer ? parseInt(odometer) : null) : existingLog.odometer;

        const log = await prisma.vehicleService.update({
            where: { id: parseInt(req.params.id) },
            data: {
                date: date ? new Date(date) : undefined,
                category,
                type,
                description,
                cost: cost !== undefined ? parseFloat(cost) : undefined,
                odometer: odometer !== undefined ? (odometer ? parseInt(odometer) : null) : undefined,
                nextServiceOdometer: nextServiceOdometer !== undefined ? (nextServiceOdometer ? parseInt(nextServiceOdometer) : null) : undefined,
                nextServiceDate: nextServiceDate !== undefined ? (nextServiceDate ? new Date(nextServiceDate) : null) : undefined,
                workshop,
                proofFile,
                items: items !== undefined ? items : undefined
            }
        });

        // Auto-update reminders for routine items
        if (items && Array.isArray(items)) {
            const routineItems = items.filter(item => item.isRoutine || item.isRoutine === 'true');
            for (const item of routineItems) {
                if (!item.name) continue;

                // Calculate targets
                const targetKm = (updateOdometer && item.intervalKm)
                    ? parseInt(updateOdometer) + parseInt(item.intervalKm)
                    : (item.nextKm ? parseInt(item.nextKm) : null);

                let targetDate = null;
                if (item.intervalMonths) {
                    targetDate = new Date(updateDate);
                    targetDate.setMonth(targetDate.getMonth() + parseInt(item.intervalMonths));
                } else if (item.nextDate) {
                    targetDate = new Date(item.nextDate);
                }

                await prisma.vehicleMaintenanceReminder.upsert({
                    where: {
                        vehicleId_componentName: {
                            vehicleId: existingLog.vehicleId,
                            componentName: item.name
                        }
                    },
                    create: {
                        vehicleId: existingLog.vehicleId,
                        componentName: item.name,
                        lastServicedKm: updateOdometer,
                        lastServicedDate: updateDate,
                        intervalKm: item.intervalKm ? parseInt(item.intervalKm) : null,
                        intervalMonths: item.intervalMonths ? parseInt(item.intervalMonths) : null,
                        targetKm,
                        targetDate,
                        lastCost: item.cost ? parseFloat(item.cost) : null,
                        status: 'OK'
                    },
                    update: {
                        lastServicedKm: updateOdometer,
                        lastServicedDate: updateDate,
                        intervalKm: item.intervalKm ? parseInt(item.intervalKm) : null,
                        intervalMonths: item.intervalMonths ? parseInt(item.intervalMonths) : null,
                        targetKm,
                        targetDate,
                        lastCost: item.cost ? parseFloat(item.cost) : null,
                        status: 'OK'
                    }
                });
            }
        }

        res.json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete maintenance log
exports.deleteMaintenanceLog = async (req, res) => {
    try {
        const { id: userId, role } = req.user;

        // Access Check
        const existingLog = await prisma.vehicleService.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { vehicle: { include: { pics: { select: { id: true } } } } }
        });

        if (!existingLog) return res.status(404).json({ error: 'Log tidak ditemukan' });

        const pos = (req.user?.position || '').toLowerCase();
        const isKabidSarpras = role === 'KABID_SARPRAS' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras');
        const isSarpras = role === 'KEPALA_BIDANG' || pos.includes('sarana dan prasarana') || pos.includes('manajemen aset') || isKabidSarpras;

        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(role) && !isSarpras) {
            const isPic = existingLog.vehicle.pics.some(p => p.id === userId);
            if (!isPic) return res.status(403).json({ error: 'Anda tidak memiliki izin menghapus log kendaraan ini.' });
        }

        await prisma.vehicleService.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ message: 'Log pemeliharaan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ==================== WORKFLOW PENGAJUAN PEMELIHARAAN KENDARAAN ====================

/**
 * POST /api/vehicles/maintenance/request
 * Staff Kendaraan / Driver / PIC mengajukan pemeliharaan/servis kendaraan
 */
exports.createMaintenanceRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            vehicleId,
            category = 'ROUTINE',
            type = 'SERVICE_RUTIN',
            description,
            urgency = 'NORMAL',
            estimatedCost,
            odometer,
            workshop,
            items,
        } = req.body;

        if (!vehicleId || !description) {
            return res.status(400).json({ error: 'Kendaraan dan deskripsi/keluhan wajib diisi.' });
        }

        const vehicle = await prisma.vehicle.findUnique({
            where: { id: parseInt(vehicleId) },
            include: { pics: true }
        });
        if (!vehicle) {
            return res.status(404).json({ error: 'Kendaraan tidak ditemukan.' });
        }

        // Generate nomor kode pengajuan: PK/YYYY/SEQ
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear + 1, 0, 1);

        const countThisYear = await prisma.vehicleService.count({
            where: {
                createdAt: { gte: yearStart, lt: yearEnd },
                code: { not: null }
            }
        });
        const seq = String(countThisYear + 1).padStart(3, '0');
        const code = `PK/${currentYear}/${seq}`;

        let parsedItems = items;
        if (typeof items === 'string') {
            try { parsedItems = JSON.parse(items); } catch (e) { parsedItems = null; }
        }

        const complaintPhoto = req.fileUrl || req.body.complaintPhoto || null;

        const serviceRequest = await prisma.vehicleService.create({
            data: {
                code,
                vehicleId: parseInt(vehicleId),
                date: new Date(),
                category,
                type,
                description,
                urgency,
                status: 'PENDING',
                cost: 0,
                estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
                odometer: odometer ? parseInt(odometer) : (vehicle.odometer || null),
                workshop: workshop || null,
                items: parsedItems || null,
                complaintPhoto,
                requesterId: userId,
            },
            include: {
                vehicle: true,
                requester: { select: { id: true, name: true, username: true, position: true, phone: true } }
            }
        });

        // Kirim notifikasi WhatsApp ke Kepala Bidang Sarana
        (async () => {
            try {
                const kabidUsers = await prisma.user.findMany({
                    where: {
                        OR: [
                            { position: { contains: 'Kepala Bidang Sarana' } },
                            { position: { contains: 'Kabid Sarpras' } },
                            { role: 'SUPER_ADMIN' }
                        ],
                        phone: { not: null }
                    },
                    select: { phone: true, name: true }
                });

                const requesterName = serviceRequest.requester?.name || serviceRequest.requester?.username || 'Staff Kendaraan';
                const msg = `🚗 *PENGAJUAN PEMELIHARAAN KENDARAAN BARU*\n\n` +
                    `Kode: *${code}*\n` +
                    `Kendaraan: *${vehicle.name} (${vehicle.plateNumber})*\n` +
                    `Pengaju: *${requesterName}*\n` +
                    `Tipe: *${type}* (${category === 'ROUTINE' ? 'Rutin' : 'Insidentil/Perbaikan'})\n` +
                    `Urgensi: *${urgency}*\n` +
                    `Estimasi Biaya: *${estimatedCost ? 'Rp ' + parseFloat(estimatedCost).toLocaleString('id-ID') : '-'}*\n` +
                    `Keluhan: _${description}_\n\n` +
                    `Mohon untuk ditinjau dan disetujui melalui Aplikasi Manajemen Aset. Terima kasih.`;

                for (const kabid of kabidUsers) {
                    if (kabid.phone) {
                        await sendMessage(kabid.phone, msg);
                    }
                }
            } catch (notifyErr) {
                console.error('[Vehicle Service Request Notify Error]:', notifyErr.message);
            }
        })();

        res.status(201).json({
            message: 'Pengajuan pemeliharaan kendaraan berhasil dikirim dan menunggu persetujuan Kepala Bidang Sarana.',
            service: serviceRequest
        });
    } catch (error) {
        console.error('[createMaintenanceRequest Error]:', error);
        res.status(500).json({ error: error.message || 'Gagal membuat pengajuan pemeliharaan.' });
    }
};

/**
 * PUT /api/vehicles/maintenance/:id/approve
 * Kepala Bidang Sarana menyetujui pengajuan, membuat SPK E-Office, dan membubuhkan TTE
 */
exports.approveMaintenanceRequest = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { approvalNote, targetDate, approvedWorkshop } = req.body;

        // 1. Validasi Posisi: Kepala Bidang Sarana (atau Super Admin)
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, username: true, role: true, position: true, phone: true }
        });
        const userPosition = (currentUser?.position || '').toLowerCase();
        const isKabidSarana = userPosition.includes('kepala bidang sarana') || currentUser?.role === 'SUPER_ADMIN';

        if (!isKabidSarana) {
            return res.status(403).json({
                error: 'Hak akses ditolak: Hanya pengguna dengan jabatan Kepala Bidang Sarana yang berwenang menyetujui pengajuan pemeliharaan kendaraan.'
            });
        }

        const service = await prisma.vehicleService.findUnique({
            where: { id },
            include: {
                vehicle: true,
                requester: { select: { id: true, name: true, username: true, phone: true } }
            }
        });

        if (!service) {
            return res.status(404).json({ error: 'Data pengajuan pemeliharaan tidak ditemukan.' });
        }

        if (service.status !== 'PENDING') {
            return res.status(400).json({ error: `Pengajuan ini sudah berstatus ${service.status}.` });
        }

        // 2. Generate Nomor SPK Resmi E-Office & QR Code
        const spkNumber = await generateDocumentNumber('SPK', 'SURAT_KELUAR');
        const spkUuid = crypto.randomUUID();
        const spkQrCode = await generateVerificationQR(spkUuid);

        // 3. Simpan Dokumen SPK ke E-Office (OfficeDocument)
        const contentObj = {
            vehicleServiceId: service.id,
            vehicleCode: service.code,
            vehicleName: service.vehicle?.name,
            plateNumber: service.vehicle?.plateNumber,
            vehicleType: service.vehicle?.type,
            brand: service.vehicle?.brand,
            odometer: service.odometer,
            category: service.category,
            type: service.type,
            description: service.description,
            items: service.items,
            workshop: approvedWorkshop || service.workshop || 'Bengkel Rekanan Yayasan',
            approvalNote: approvalNote || null,
            targetDate: targetDate || null,
            requesterName: service.requester?.name || service.requester?.username,
            signedByName: currentUser.name || currentUser.username,
            signedByPosition: currentUser.position || 'Kepala Bidang Sarana',
            signedAt: new Date().toISOString()
        };

        await prisma.officeDocument.create({
            data: {
                uuid: spkUuid,
                type: 'SURAT_KELUAR',
                category: 'SPK',
                status: 'SIGNED',
                number: spkNumber,
                subject: `Surat Perintah Kerja (SPK) Servis Kendaraan - ${service.vehicle?.name} (${service.vehicle?.plateNumber})`,
                referenceNumber: service.code || `VS-${service.id}`,
                authorId: currentUser.id,
                signedById: currentUser.id,
                signedAt: new Date(),
                qrCodeData: spkQrCode,
                content: JSON.stringify(contentObj),
            }
        });

        // 4. Update status VehicleService menjadi APPROVED
        const updatedService = await prisma.vehicleService.update({
            where: { id },
            data: {
                status: 'APPROVED',
                approvedById: currentUser.id,
                approvedAt: new Date(),
                approvalNote: approvalNote || null,
                targetDate: targetDate ? new Date(targetDate) : null,
                workshop: approvedWorkshop || service.workshop,
                spkNumber,
                spkUuid,
                spkQrCode,
            },
            include: {
                vehicle: true,
                requester: { select: { id: true, name: true, username: true, phone: true } },
                approvedBy: { select: { id: true, name: true, username: true, position: true } }
            }
        });

        // 5. WhatsApp notification to requester
        (async () => {
            if (service.requester?.phone) {
                try {
                    const msg = `✅ *PENGAJUAN SERVIS KENDARAAN DISETUJUI*\n\n` +
                        `No. SPK: *${spkNumber}*\n` +
                        `Kendaraan: *${service.vehicle?.name} (${service.vehicle?.plateNumber})*\n` +
                        `Disetujui Oleh: *${currentUser.name || currentUser.username}*\n` +
                        `Bengkel: *${approvedWorkshop || service.workshop || '-'}*\n` +
                        (approvalNote ? `Catatan: _${approvalNote}_\n` : '') +
                        `\nSilakan cetak SPK Kendaraan dan bawa kendaraan ke bengkel untuk pengerjaan servis. Terima kasih.`;
                    await sendMessage(service.requester.phone, msg);
                } catch (e) {
                    console.error('Failed to send WA approval notification:', e.message);
                }
            }
        })();

        res.json({
            message: 'Pengajuan berhasil disetujui, SPK E-Office resmi dan TTE telah diterbitkan.',
            service: updatedService
        });
    } catch (error) {
        console.error('[approveMaintenanceRequest Error]:', error);
        res.status(500).json({ error: error.message || 'Gagal menyetujui pengajuan pemeliharaan.' });
    }
};

/**
 * PUT /api/vehicles/maintenance/:id/reject
 * Kepala Bidang Sarana menolak pengajuan
 */
exports.rejectMaintenanceRequest = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { rejectionReason } = req.body;

        if (!rejectionReason) {
            return res.status(400).json({ error: 'Alasan penolakan wajib diisi.' });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, username: true, role: true, position: true }
        });
        const userPosition = (currentUser?.position || '').toLowerCase();
        const isKabidSarana = userPosition.includes('kepala bidang sarana') || currentUser?.role === 'SUPER_ADMIN';

        if (!isKabidSarana) {
            return res.status(403).json({
                error: 'Hak akses ditolak: Hanya Kepala Bidang Sarana yang berwenang menolak pengajuan pemeliharaan kendaraan.'
            });
        }

        const service = await prisma.vehicleService.findUnique({
            where: { id },
            include: {
                vehicle: true,
                requester: { select: { id: true, name: true, username: true, phone: true } }
            }
        });

        if (!service) {
            return res.status(404).json({ error: 'Data pengajuan pemeliharaan tidak ditemukan.' });
        }

        const updatedService = await prisma.vehicleService.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason,
                approvedById: currentUser.id,
                approvedAt: new Date(),
            },
            include: {
                vehicle: true,
                requester: { select: { id: true, name: true, username: true, phone: true } },
                approvedBy: { select: { id: true, name: true, username: true, position: true } }
            }
        });

        // WhatsApp notification to requester
        (async () => {
            if (service.requester?.phone) {
                try {
                    const msg = `❌ *PENGAJUAN SERVIS KENDARAAN DITOLAK*\n\n` +
                        `Kendaraan: *${service.vehicle?.name} (${service.vehicle?.plateNumber})*\n` +
                        `Ditolak Oleh: *${currentUser.name || currentUser.username}*\n` +
                        `Alasan: _${rejectionReason}_\n\n` +
                        `Silakan koordinasi lebih lanjut dengan Bidang Sarana. Terima kasih.`;
                    await sendMessage(service.requester.phone, msg);
                } catch (e) {
                    console.error('Failed to send WA reject notification:', e.message);
                }
            }
        })();

        res.json({
            message: 'Pengajuan pemeliharaan kendaraan telah ditolak.',
            service: updatedService
        });
    } catch (error) {
        console.error('[rejectMaintenanceRequest Error]:', error);
        res.status(500).json({ error: error.message || 'Gagal menolak pengajuan pemeliharaan.' });
    }
};

/**
 * PUT /api/vehicles/maintenance/:id/start-progress
 * Staff memperbarui status bahwa armada masuk bengkel
 */
exports.startMaintenanceProgress = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { workshop } = req.body;

        const service = await prisma.vehicleService.findUnique({ where: { id } });
        if (!service) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

        if (service.status !== 'APPROVED') {
            return res.status(400).json({ error: 'Hanya pengajuan berstatus Disetujui (APPROVED) yang dapat dimulai pengerjaannya.' });
        }

        const updatedService = await prisma.vehicleService.update({
            where: { id },
            data: {
                status: 'IN_PROGRESS',
                workshop: workshop || service.workshop
            },
            include: {
                vehicle: true,
                requester: { select: { id: true, name: true, username: true } },
                approvedBy: { select: { id: true, name: true, username: true } }
            }
        });

        res.json({
            message: 'Status diperbarui: Kendaraan sedang dalam proses servis di bengkel.',
            service: updatedService
        });
    } catch (error) {
        console.error('[startMaintenanceProgress Error]:', error);
        res.status(500).json({ error: error.message || 'Gagal memperbarui status pengerjaan.' });
    }
};

/**
 * PUT /api/vehicles/maintenance/:id/complete
 * Menyelesaikan pemeliharaan: input biaya riil, foto nota, dan auto-update pengingat servis
 */
exports.completeMaintenanceService = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const {
            cost,
            workshop,
            odometer,
            items,
            nextServiceOdometer,
            nextServiceDate,
            date = new Date().toISOString()
        } = req.body;

        const service = await prisma.vehicleService.findUnique({
            where: { id },
            include: { vehicle: true }
        });
        if (!service) return res.status(404).json({ error: 'Data pemeliharaan tidak ditemukan.' });

        if (!cost || parseFloat(cost) <= 0) {
            return res.status(400).json({ error: 'Biaya aktual servis wajib diisi.' });
        }

        const proofFile = req.fileUrl || req.body.proofFile || service.proofFile;
        if (!proofFile) {
            return res.status(400).json({ error: 'Foto bukti nota / faktur bengkel wajib diunggah.' });
        }

        let parsedItems = items;
        if (typeof items === 'string') {
            try { parsedItems = JSON.parse(items); } catch (e) { parsedItems = service.items; }
        }

        const finalCost = parseFloat(cost);
        const serviceDate = new Date(date);
        const actualOdometer = odometer ? parseInt(odometer) : (service.odometer || service.vehicle?.odometer);

        const updatedService = await prisma.vehicleService.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                date: serviceDate,
                cost: finalCost,
                workshop: workshop || service.workshop || '-',
                odometer: actualOdometer,
                proofFile,
                items: parsedItems !== undefined ? parsedItems : service.items,
                nextServiceOdometer: nextServiceOdometer ? parseInt(nextServiceOdometer) : null,
                nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
            },
            include: {
                vehicle: true,
                requester: { select: { id: true, name: true, username: true } },
                approvedBy: { select: { id: true, name: true, username: true } }
            }
        });

        // Update odometer kendaraan jika KM aktual lebih tinggi
        if (actualOdometer && (!service.vehicle?.odometer || actualOdometer > service.vehicle.odometer)) {
            try {
                await prisma.vehicle.update({
                    where: { id: service.vehicleId },
                    data: { odometer: actualOdometer }
                });
            } catch (kmErr) {
                console.error('[Update Vehicle KM Error]:', kmErr);
            }
        }

        // Auto-update reminders untuk komponen rutin
        if (parsedItems && Array.isArray(parsedItems)) {
            const routineItems = parsedItems.filter(item => item.isRoutine || item.isRoutine === 'true');
            for (const item of routineItems) {
                if (!item.name) continue;

                const targetKm = (actualOdometer && item.intervalKm)
                    ? parseInt(actualOdometer) + parseInt(item.intervalKm)
                    : (item.nextKm ? parseInt(item.nextKm) : null);

                let targetDate = null;
                if (item.intervalMonths) {
                    targetDate = new Date(serviceDate);
                    targetDate.setMonth(targetDate.getMonth() + parseInt(item.intervalMonths));
                } else if (item.nextDate) {
                    targetDate = new Date(item.nextDate);
                }

                await prisma.vehicleMaintenanceReminder.upsert({
                    where: {
                        vehicleId_componentName: {
                            vehicleId: service.vehicleId,
                            componentName: item.name
                        }
                    },
                    create: {
                        vehicleId: service.vehicleId,
                        componentName: item.name,
                        lastServicedKm: actualOdometer,
                        lastServicedDate: serviceDate,
                        intervalKm: item.intervalKm ? parseInt(item.intervalKm) : null,
                        intervalMonths: item.intervalMonths ? parseInt(item.intervalMonths) : null,
                        targetKm,
                        targetDate,
                        lastCost: item.cost ? parseFloat(item.cost) : null,
                        status: 'OK'
                    },
                    update: {
                        lastServicedKm: actualOdometer,
                        lastServicedDate: serviceDate,
                        intervalKm: item.intervalKm ? parseInt(item.intervalKm) : null,
                        intervalMonths: item.intervalMonths ? parseInt(item.intervalMonths) : null,
                        targetKm,
                        targetDate,
                        lastCost: item.cost ? parseFloat(item.cost) : null,
                        status: 'OK'
                    }
                });
            }
        }

        res.json({
            message: 'Pemeliharaan kendaraan selesai dan berhasil dicatat ke riwayat log resmi.',
            service: updatedService
        });
    } catch (error) {
        console.error('[completeMaintenanceService Error]:', error);
        res.status(500).json({ error: error.message || 'Gagal menyelesaikan pemeliharaan kendaraan.' });
    }
};

/**
 * GET /api/vehicles/maintenance/:id/spk
 * Ambil data SPK Kendaraan untuk pratinjau dan cetak dokumen A4
 */
exports.getVehicleServiceSPK = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const service = await prisma.vehicleService.findUnique({
            where: { id },
            include: {
                vehicle: true,
                requester: { select: { id: true, name: true, username: true, position: true, phone: true } },
                approvedBy: { select: { id: true, name: true, username: true, position: true } }
            }
        });

        if (!service) {
            return res.status(404).json({ error: 'Data pemeliharaan kendaraan tidak ditemukan.' });
        }

        const officeDoc = await prisma.officeDocument.findFirst({
            where: {
                category: 'SPK',
                referenceNumber: service.code || `VS-${service.id}`
            },
            include: {
                signedBy: { select: { id: true, name: true, username: true, position: true } }
            }
        });

        res.json({
            service,
            spk: {
                number: service.spkNumber || officeDoc?.number,
                uuid: service.spkUuid || officeDoc?.uuid,
                qrCodeData: service.spkQrCode || officeDoc?.qrCodeData,
                isSigned: !!(service.approvedAt || officeDoc?.status === 'SIGNED'),
                signedAt: service.approvedAt || officeDoc?.signedAt,
                signedBy: service.approvedBy?.name || officeDoc?.signedBy?.name || 'Ravi Kurnia, S.T.',
                signedByPosition: service.approvedBy?.position || officeDoc?.signedBy?.position || 'Kepala Bidang Sarana',
            }
        });
    } catch (error) {
        console.error('[getVehicleServiceSPK Error]:', error);
        res.status(500).json({ error: error.message || 'Gagal memuat SPK kendaraan.' });
    }
};

/**
 * Hybrid Reminder Notification Checker
 * Reads from VehicleMaintenanceReminder table, calculates status,
 * and sends WhatsApp for WARNING/OVERDUE items.
 * Re-notifies every 4 days per vehicle.
 */
exports.checkHybridReminderNotifications = async () => {
    try {
        console.log('[Hybrid Reminder] Checking maintenance reminders...');
        const now = new Date();
        const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

        const vehicles = await prisma.vehicle.findMany({
            where: { status: 'ACTIVE' },
            include: { maintenanceReminders: true }
        });

        const alertVehicles = [];
        for (const vehicle of vehicles) {
            if (!vehicle.maintenanceReminders.length) continue;

            // 4-day cooldown
            if (vehicle.lastKmNotifiedAt) {
                const elapsed = now.getTime() - new Date(vehicle.lastKmNotifiedAt).getTime();
                if (elapsed < FOUR_DAYS_MS) continue;
            }

            const alerts = [];
            for (const r of vehicle.maintenanceReminders) {
                let status = 'OK';
                let detail = '';

                if (r.targetKm && vehicle.odometer) {
                    const kmRemaining = r.targetKm - vehicle.odometer;
                    if (kmRemaining <= 0) { status = 'OVERDUE'; detail += `KM lewat ${Math.abs(kmRemaining).toLocaleString()} km. `; }
                    else if (kmRemaining <= 500) { status = 'WARNING'; detail += `Sisa ${kmRemaining.toLocaleString()} km. `; }
                }

                if (r.targetDate) {
                    const diffDays = Math.ceil((new Date(r.targetDate) - now) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 0 && status !== 'OVERDUE') { status = 'OVERDUE'; detail += `Lewat ${Math.abs(diffDays)} hari.`; }
                    else if (diffDays <= 14 && status === 'OK') { status = 'WARNING'; detail += `Sisa ${diffDays} hari.`; }
                }

                if (status !== 'OK') {
                    alerts.push({ name: r.componentName, status, detail });
                }
            }

            if (alerts.length > 0) alertVehicles.push({ vehicle, alerts });
        }

        if (alertVehicles.length === 0) {
            console.log('[Hybrid Reminder] Semua kendaraan dalam kondisi OK.');
            return;
        }

        const recipients = await prisma.user.findMany({
            where: {
                OR: [
                    { position: 'Kepala Bidang Sarana' },
                    { position: 'Staff Kendaraan' }
                ],
                phone: { not: null }
            }
        });

        if (recipients.length === 0) return;

        let globalDelay = 0;
        for (const { vehicle, alerts } of alertVehicles) {
            const overdueItems = alerts.filter(a => a.status === 'OVERDUE');
            const warningItems = alerts.filter(a => a.status === 'WARNING');

            let itemList = '';
            if (overdueItems.length > 0) {
                itemList += `\n🔴 *OVERDUE (${overdueItems.length}):*\n`;
                overdueItems.forEach(a => { itemList += `  • ${a.name} — ${a.detail}\n`; });
            }
            if (warningItems.length > 0) {
                itemList += `\n🟡 *SEGERA (${warningItems.length}):*\n`;
                warningItems.forEach(a => { itemList += `  • ${a.name} — ${a.detail}\n`; });
            }

            const message = `🔧 *PENGINGAT PEMELIHARAAN KENDARAAN*\n\n` +
                `Kendaraan: *${vehicle.name} (${vehicle.plateNumber})*\n` +
                `KM Saat Ini: *${(vehicle.odometer || 0).toLocaleString()} km*\n` +
                itemList +
                `\nMohon segera dijadwalkan untuk service. Terima kasih.`;

            for (const person of recipients) {
                const randomGap = Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;
                globalDelay += randomGap;
                setTimeout(async () => {
                    try {
                        await sendMessage(person.phone, message);
                        console.log(`[Hybrid Reminder] Sent for ${vehicle.name} to ${person.name}`);
                    } catch (e) {
                        console.error(`[Hybrid Reminder] Failed: ${person.name}:`, e.message);
                    }
                }, globalDelay);
            }

            try {
                await prisma.vehicle.update({
                    where: { id: vehicle.id },
                    data: { lastKmNotifiedAt: now }
                });
            } catch (e) { }
        }

        console.log(`[Hybrid Reminder] Scheduled ${alertVehicles.length * recipients.length} notification(s).`);
    } catch (error) {
        console.error('[Hybrid Reminder] Error:', error.message);
    }
};

// Legacy aliases
exports.checkMaintenanceNotifications = exports.checkHybridReminderNotifications;
exports.checkKmServiceNotifications = exports.checkHybridReminderNotifications;
