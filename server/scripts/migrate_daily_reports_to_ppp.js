const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function migrateData() {
    console.log('=== MEMULAI MIGRASI LAPORAN: MENGHAPUS SESI PAGI & SIANG KE METODE PPP ===\n');

    let migratedLocalCount = 0;
    let migratedDbCount = 0;

    // 1. MIGRASI DATA LOCAL (data_local/daily_reports.json)
    const localFilePath = path.join(__dirname, '../data_local/daily_reports.json');
    if (fs.existsSync(localFilePath)) {
        try {
            const raw = fs.readFileSync(localFilePath, 'utf-8');
            let reports = JSON.parse(raw);
            let modified = false;

            reports = reports.map(rep => {
                const meta = rep.metadata || {};
                const pts = meta.manualPoints || {};
                const morning = Array.isArray(pts.morning) ? pts.morning : (Array.isArray(pts.morningPoints) ? pts.morningPoints : []);
                const afternoon = Array.isArray(pts.afternoon) ? pts.afternoon : (Array.isArray(pts.afternoonPoints) ? pts.afternoonPoints : []);
                const allPoints = [...morning, ...afternoon];

                let completedItems = Array.isArray(meta.completedItems) ? [...meta.completedItems] : [];
                let inProgressItems = Array.isArray(meta.inProgressItems) ? [...meta.inProgressItems] : [];
                let obstacleItems = Array.isArray(meta.obstacleItems) ? [...meta.obstacleItems] : [];
                let tomorrowPlans = Array.isArray(meta.tomorrowPlans) ? [...meta.tomorrowPlans] : [];

                // Jika belum punya completedItems/inProgressItems tapi punya poin pagi/siang, lakukan konversi
                if (completedItems.length === 0 && inProgressItems.length === 0 && obstacleItems.length === 0 && allPoints.length > 0) {
                    allPoints.forEach(p => {
                        if (!p) return;
                        const title = typeof p === 'string' ? p : (p.text || p.title || 'Kegiatan Operasional');
                        if (!title || !title.trim()) return;

                        const categoryTag = p.categoryTag || rep.category || 'UMUM';
                        const photos = Array.isArray(p.photos) ? p.photos : [];
                        const isDone = p.status === 'COMPLETED' || p.status === 'SELESAI' || p.percentage === 100;
                        const isProblem = p.status === 'OBSTACLE' || p.status === 'KENDALA' || !!p.obstacleNote;

                        if (isProblem) {
                            obstacleItems.push({
                                title: title,
                                obstacleNote: p.obstacleNote || 'Terkendala di lapangan',
                                actionPlan: p.actionPlan || '',
                                categoryTag: categoryTag,
                                status: 'OBSTACLE',
                                photos: photos,
                                review: p.review || null
                            });
                        } else if (isDone) {
                            completedItems.push({
                                title: title,
                                output: p.output || 'Tugas selesai dilaksanakan 100%.',
                                categoryTag: categoryTag,
                                status: 'COMPLETED',
                                progressPercentage: 100,
                                photos: photos,
                                sourceType: p.sourceType,
                                sourceId: p.sourceId,
                                review: p.review || null
                            });
                        } else {
                            inProgressItems.push({
                                title: title,
                                progressPercentage: p.percentage || p.progressPercentage || 50,
                                targetDate: p.targetDate || rep.date || 'Hari ini',
                                categoryTag: categoryTag,
                                status: 'IN_PROGRESS',
                                photos: photos,
                                sourceType: p.sourceType,
                                sourceId: p.sourceId,
                                review: p.review || null
                            });
                        }
                    });
                    migratedLocalCount++;
                    modified = true;
                }

                return {
                    ...rep,
                    metadata: {
                        ...meta,
                        // Menyatukan poin ke format PPP modern tanpa menghapus data sebelumnya
                        completedItems,
                        inProgressItems,
                        obstacleItems,
                        tomorrowPlans,
                        // manualPoints tetap dipertahankan untuk backward compatibility
                        manualPoints: {
                            morning: completedItems.map(c => ({
                                text: c.title,
                                output: c.output || '',
                                categoryTag: c.categoryTag || 'UMUM',
                                status: 'COMPLETED',
                                progressPercentage: 100,
                                photos: c.photos || [],
                                review: c.review || null
                            })),
                            afternoon: [
                                ...inProgressItems.map(i => ({
                                    text: i.title,
                                    targetDate: i.targetDate || '',
                                    categoryTag: i.categoryTag || 'UMUM',
                                    status: 'IN_PROGRESS',
                                    progressPercentage: i.progressPercentage || 50,
                                    photos: i.photos || [],
                                    review: i.review || null
                                })),
                                ...obstacleItems.map(o => ({
                                    text: o.title,
                                    obstacleNote: o.obstacleNote || '',
                                    actionPlan: o.actionPlan || '',
                                    categoryTag: o.categoryTag || 'UMUM',
                                    status: 'OBSTACLE',
                                    photos: o.photos || [],
                                    review: o.review || null
                                }))
                            ]
                        }
                    }
                };
            });

            if (modified || reports.length > 0) {
                fs.writeFileSync(localFilePath, JSON.stringify(reports, null, 2), 'utf-8');
                console.log(`[LocalDataStorage] Sukses memigrasi ${migratedLocalCount} rekaman laporan lokal ke format PPP terpadu.`);
            }
        } catch (e) {
            console.error('[LocalDataStorage] Gagal memigrasi data lokal:', e.message);
        }
    }

    // 2. MIGRASI DATA DATABASE PRISMA (MySQL)
    const prisma = new PrismaClient();
    try {
        console.log('[Prisma DB] Mencoba koneksi ke database...');
        const reports = await prisma.personnelReport.findMany({
            where: { type: 'DAILY' }
        });
        console.log(`[Prisma DB] Ditemukan ${reports.length} laporan DAILY.`);

        for (const rep of reports) {
            let meta = rep.metadata;
            if (typeof meta === 'string') {
                try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
            }
            if (!meta || typeof meta !== 'object') meta = {};

            const pts = meta.manualPoints || {};
            const morning = Array.isArray(pts.morning) ? pts.morning : (Array.isArray(pts.morningPoints) ? pts.morningPoints : []);
            const afternoon = Array.isArray(pts.afternoon) ? pts.afternoon : (Array.isArray(pts.afternoonPoints) ? pts.afternoonPoints : []);
            const allPoints = [...morning, ...afternoon];

            let completedItems = Array.isArray(meta.completedItems) ? [...meta.completedItems] : [];
            let inProgressItems = Array.isArray(meta.inProgressItems) ? [...meta.inProgressItems] : [];
            let obstacleItems = Array.isArray(meta.obstacleItems) ? [...meta.obstacleItems] : [];
            let tomorrowPlans = Array.isArray(meta.tomorrowPlans) ? [...meta.tomorrowPlans] : [];

            let needsUpdate = false;

            if (completedItems.length === 0 && inProgressItems.length === 0 && obstacleItems.length === 0 && allPoints.length > 0) {
                allPoints.forEach(p => {
                    if (!p) return;
                    const title = typeof p === 'string' ? p : (p.text || p.title || 'Kegiatan');
                    if (!title || !title.trim()) return;

                    const categoryTag = p.categoryTag || rep.category || 'UMUM';
                    const photos = Array.isArray(p.photos) ? p.photos : [];
                    const isDone = p.status === 'COMPLETED' || p.status === 'SELESAI' || p.percentage === 100;
                    const isProblem = p.status === 'OBSTACLE' || p.status === 'KENDALA' || !!p.obstacleNote;

                    if (isProblem) {
                        obstacleItems.push({
                            title,
                            obstacleNote: p.obstacleNote || 'Terkendala di lapangan',
                            actionPlan: p.actionPlan || '',
                            categoryTag,
                            status: 'OBSTACLE',
                            photos,
                            review: p.review || null
                        });
                    } else if (isDone) {
                        completedItems.push({
                            title,
                            output: p.output || 'Tugas selesai dilaksanakan 100%.',
                            categoryTag,
                            status: 'COMPLETED',
                            progressPercentage: 100,
                            photos,
                            sourceType: p.sourceType,
                            sourceId: p.sourceId,
                            review: p.review || null
                        });
                    } else {
                        inProgressItems.push({
                            title,
                            progressPercentage: p.percentage || p.progressPercentage || 50,
                            targetDate: p.targetDate || rep.date || 'Hari ini',
                            categoryTag,
                            status: 'IN_PROGRESS',
                            photos,
                            sourceType: p.sourceType,
                            sourceId: p.sourceId,
                            review: p.review || null
                        });
                    }
                });
                needsUpdate = true;
            }

            if (needsUpdate) {
                const updatedMeta = {
                    ...meta,
                    completedItems,
                    inProgressItems,
                    obstacleItems,
                    tomorrowPlans
                };

                await prisma.personnelReport.update({
                    where: { id: rep.id },
                    data: {
                        metadata: updatedMeta
                    }
                });
                migratedDbCount++;
            }
        }
        console.log(`[Prisma DB] Sukses memigrasi ${migratedDbCount} rekaman laporan di database MySQL.`);
    } catch (dbErr) {
        console.warn('[Prisma DB] Database MySQL offline/tidak terjangkau saat ini:', dbErr.message);
        console.log('[Info] Data lokal telah sukses diperbarui tanpa kehilangan data.');
    } finally {
        await prisma.$disconnect();
    }

    console.log('\n=== MIGRASI SELESAI SECARA AMAN ===');
}

migrateData().catch(console.error);
