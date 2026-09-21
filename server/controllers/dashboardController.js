const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const predictiveService = require('../services/predictiveService');
const aiService = require('../services/aiService');

exports.getDashboardStats = async (req, res) => {
    try {
        const { role, unitId: userUnitId } = req.user;
        const { unitId: filterUnitId } = req.query;
        const now = new Date();
        let where = {
            condition: { not: 'DISPOSED' }
        };

        // 0. Fetch Units (for filter dropdown)
        const units = await prisma.unit.findMany({
            select: { id: true, name: true, code: true }
        });

        // Determine filtering logic
        const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT', 'KABID_SARPRAS'].includes(role) || req.user.position === 'Kepala Bidang Sarana';
        
        let allowedUnitIds = [userUnitId];
        const userUnit = await prisma.unit.findUnique({ where: { id: userUnitId } });
        if (userUnit && userUnit.name.startsWith('Kantor Yayasan -')) {
            const parentUnit = await prisma.unit.findFirst({ where: { name: 'Kantor Yayasan' } });
            if (parentUnit) allowedUnitIds.push(parentUnit.id);
        }

        if (!isGlobalAdmin) {
            where.unitId = { in: allowedUnitIds };
            if (filterUnitId && allowedUnitIds.includes(parseInt(filterUnitId))) {
                where.unitId = parseInt(filterUnitId);
            }
        } else if (filterUnitId) {
            where.unitId = parseInt(filterUnitId);
        }

        // 1. Fetch assets for value and condition calculations
        const allAssets = await prisma.asset.findMany({
            where,
            select: {
                id: true,
                price: true,
                purchaseDate: true,
                usefulLife: true,
                condition: true,
                category: { select: { name: true } }
            }
        });

        let totalBookValue = 0;
        let totalMarketValue = 0;
        let goodCount = 0;
        let lightDamagedCount = 0;
        let heavyDamagedCount = 0;

        allAssets.forEach((a) => {
            if (a.condition === 'BAIK') goodCount++;
            else if (a.condition === 'RUSAK_RINGAN') lightDamagedCount++;
            else if (a.condition === 'RUSAK_BERAT') heavyDamagedCount++;

            const purchaseDate = new Date(a.purchaseDate);
            const monthsElapsed = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
            const totalMonths = (a.usefulLife || 5) * 12;

            const monthlyDepreciation = (a.price || 0) / totalMonths;
            const accumulatedDepreciation = Math.min(a.price || 0, monthlyDepreciation * Math.max(0, monthsElapsed));
            const bookValue = Math.max(0, (a.price || 0) - accumulatedDepreciation);
            totalBookValue += bookValue;

            // Market Value calculation
            let nilaiKondisi = 1;
            if (a.condition === 'BAIK') nilaiKondisi = 1;
            else if (a.condition === 'RUSAK_RINGAN') nilaiKondisi = 0.5;
            else if (a.condition === 'RUSAK_BERAT') nilaiKondisi = 0.2;

            const nilaiKalkulasi = bookValue * nilaiKondisi;
            let persentaseKategori = 0.10;
            const kat = (a.category?.name || '').toLowerCase();
            if (kat.includes('elektronik')) persentaseKategori = 0.15;
            else if (kat.includes('kendaraan')) persentaseKategori = 0.20;
            else if (kat.includes('furniture') || kat.includes('furnitur') || kat.includes('inventaris') || kat.includes('operasional')) persentaseKategori = 0.10;

            const nilaiMinimum = (a.price || 0) * persentaseKategori;
            const marketValue = Math.max(nilaiKalkulasi, nilaiMinimum);
            totalMarketValue += marketValue;
        });

        // 2. Fetch other counts
        const [totalAssets, disposedCount] = await Promise.all([
            prisma.asset.count({ where }),
            prisma.asset.count({
                where: {
                    condition: 'DISPOSED',
                    ...(where.unitId ? { unitId: where.unitId } : {})
                }
            })
        ]);

        const damagedAssets = lightDamagedCount + heavyDamagedCount;

        // 3. Calculate Expired Assets (Habis Umur)
        const expiredAssetsCount = allAssets.filter(a => {
            const expiryDate = new Date(a.purchaseDate);
            expiryDate.setFullYear(expiryDate.getFullYear() + (a.usefulLife || 5));
            return expiryDate < now;
        }).length;

        // 4. Condition Composition Data for Charts
        const conditionData = [
            { name: 'Baik', value: goodCount, color: '#10b981' },
            { name: 'Rusak Ringan', value: lightDamagedCount, color: '#f59e0b' },
            { name: 'Rusak Berat', value: heavyDamagedCount, color: '#ef4444' }
        ];

        // 5. Category Composition (Pie Chart)
        const categories = await prisma.category.findMany({
            include: {
                assets: {
                    where,
                    select: { id: true }
                }
            }
        });
        const pieData = categories.map(c => ({
            name: c.name,
            value: c.assets.length
        })).filter(d => d.value > 0);

        // 6. Monthly Statistics (Last 6 Months)
        const chartData = [];
        const spendingData = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthName = date.toLocaleString('id-ID', { month: 'short' });
            const year = date.getFullYear();
            const month = date.getMonth();

            const startOfMonth = new Date(year, month, 1);
            const endOfMonth = new Date(year, month + 1, 0);

            const assetsInMonth = await prisma.asset.findMany({
                where: {
                    ...where,
                    purchaseDate: {
                        gte: startOfMonth,
                        lte: endOfMonth
                    }
                },
                select: { price: true }
            });

            const count = assetsInMonth.length;
            const totalSpent = assetsInMonth.reduce((sum, a) => sum + (a.price || 0), 0);

            chartData.push({ name: monthName, value: count });
            spendingData.push({ name: monthName, value: totalSpent });
        }

        // 7. Status Operations Data (5 Modules)
        // A. Maintenance Statuses
        const maintenanceStats = await prisma.maintenance.groupBy({
            by: ['status'],
            where: where.unitId ? { unitId: where.unitId } : {},
            _count: { _all: true }
        });
        const maintenanceData = maintenanceStats.map(s => ({
            name: s.status,
            value: s._count._all
        }));

        // B. Procurement Statuses
        const procurementStats = await prisma.procurement.groupBy({
            by: ['status'],
            where: where.unitId ? { unitId: where.unitId } : {},
            _count: { _all: true }
        });
        const procurementData = procurementStats.map(s => ({
            name: s.status,
            value: s._count._all
        }));

        // C. Movement Statuses
        const movementStats = await prisma.movement.groupBy({
            by: ['status'],
            where: where.unitId ? {
                OR: [
                    { asset: { unitId: where.unitId } },
                    { toUnitId: where.unitId }
                ]
            } : {},
            _count: { _all: true }
        });
        const movementData = movementStats.map(s => ({
            name: s.status,
            value: s._count._all
        }));

        // D. Asset Loan Statuses
        const loanStats = await prisma.assetLoan.groupBy({
            by: ['status'],
            where: where.unitId ? {
                OR: [
                    { unitId: where.unitId },
                    { targetUnitId: where.unitId }
                ]
            } : {},
            _count: { _all: true }
        });
        const loanData = loanStats.map(s => ({
            name: s.status,
            value: s._count._all
        }));

        // E. Asset Disposal Statuses
        const disposalStats = await prisma.assetDisposal.groupBy({
            by: ['status'],
            where: where.unitId ? {
                asset: { unitId: where.unitId }
            } : {},
            _count: { _all: true }
        });
        const disposalData = disposalStats.map(s => ({
            name: s.status,
            value: s._count._all
        }));

        // 8. Unit Statistics (Table Data) - Only useful if no specific unit filter is applied
        const unitStats = [];
        if (isGlobalAdmin) {
            const unitsWithAssets = await prisma.unit.findMany({
                include: {
                    assets: {
                        where: { condition: { not: 'DISPOSED' } },
                        select: { id: true, price: true, purchaseDate: true, usefulLife: true, condition: true, category: { select: { name: true } } }
                    }
                }
            });

            unitsWithAssets.forEach(u => {
                const totalAssetsUnit = u.assets.length;
                const damagedCount = u.assets.filter(a => ['RUSAK_RINGAN', 'RUSAK_BERAT'].includes(a.condition)).length;
                const goodCountUnit = u.assets.filter(a => a.condition === 'BAIK').length;

                let totalBookUnit = 0;
                let totalMarketUnit = 0;

                u.assets.forEach(a => {
                    const purchaseDate = new Date(a.purchaseDate);
                    const monthsElapsed = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
                    const totalMonths = (a.usefulLife || 5) * 12;
                    const monthlyDepreciation = (a.price || 0) / totalMonths;
                    const bookValue = Math.max(0, (a.price || 0) - Math.min(a.price || 0, monthlyDepreciation * Math.max(0, monthsElapsed)));
                    totalBookUnit += bookValue;

                    let nilaiKondisi = 1;
                    if (a.condition === 'BAIK') nilaiKondisi = 1;
                    else if (a.condition === 'RUSAK_RINGAN') nilaiKondisi = 0.5;
                    else if (a.condition === 'RUSAK_BERAT') nilaiKondisi = 0.2;

                    const nilaiKalkulasi = bookValue * nilaiKondisi;
                    let persentaseKategori = 0.10;
                    const kat = (a.category?.name || '').toLowerCase();
                    if (kat.includes('elektronik')) persentaseKategori = 0.15;
                    else if (kat.includes('kendaraan')) persentaseKategori = 0.20;
                    const nilaiMinimum = (a.price || 0) * persentaseKategori;
                    totalMarketUnit += Math.max(nilaiKalkulasi, nilaiMinimum);
                });

                unitStats.push({
                    id: u.id,
                    name: u.name,
                    code: u.code,
                    assetCount: totalAssetsUnit,
                    goodCount: goodCountUnit,
                    damagedCount: damagedCount,
                    totalValue: Math.round(totalBookUnit),
                    totalMarketValue: Math.round(totalMarketUnit)
                });
            });
            unitStats.sort((a, b) => b.assetCount - a.assetCount);
        }

        // 9. Predictive Maintenance (Due Soon)
        const dueSoonAssets = await predictiveService.getDueSoonAssets(14); // Next 14 days

        res.json({
            stats: {
                totalAssets,
                goodAssets: goodCount,
                lightDamagedAssets: lightDamagedCount,
                heavyDamagedAssets: heavyDamagedCount,
                disposedAssets: disposedCount,
                totalValue: Math.round(totalBookValue),
                totalBookValue: Math.round(totalBookValue),
                totalMarketValue: Math.round(totalMarketValue),
                damagedAssets,
                expiredAssets: expiredAssetsCount
            },
            conditionData,
            procurementData,
            maintenanceData,
            movementData,
            loanData,
            disposalData,
            pieData,
            chartData,
            spendingData,
            unitStats,
            dueSoonAssets,
            units: isGlobalAdmin ? units : []
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Controller: Laporan Mingguan & Operasional Manajemen Aset
 */
exports.getWeeklyAssetReport = async (req, res) => {
    try {
        const { role, unitId: userUnitId, id: userId } = req.user;
        const { startDate, endDate, unitId } = req.query;

        // 1. Tentukan Rentang Tanggal
        let start, end;
        if (startDate && endDate) {
            start = new Date(`${startDate}T00:00:00.000Z`);
            end = new Date(`${endDate}T23:59:59.999Z`);
        } else {
            const today = new Date();
            const day = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
            const diffToMonday = today.getDate() - (day === 0 ? 6 : day - 1);
            start = new Date(today.getFullYear(), today.getMonth(), diffToMonday, 0, 0, 0, 0);
            end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 4, 23, 59, 59, 999);
        }

        // 2. Tentukan Filter Unit
        const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT', 'KABID_SARPRAS'].includes(role) || req.user.position === 'Kepala Bidang Sarana';
        let targetUnitId = null;

        if (unitId && unitId !== 'all') {
            targetUnitId = parseInt(unitId);
        } else if (!isGlobalAdmin && userUnitId) {
            targetUnitId = userUnitId;
        }

        // 3. Query Aset Baru Masuk
        const newAssetWhere = {
            createdAt: { gte: start, lte: end }
        };
        if (targetUnitId) newAssetWhere.unitId = targetUnitId;

        const newAssets = await prisma.asset.findMany({
            where: newAssetWhere,
            include: {
                unit: { select: { id: true, name: true } },
                room: { select: { id: true, name: true } },
                category: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        const totalNewAssetsValue = newAssets.reduce((sum, a) => sum + (a.price || 0), 0);

        // 4. Query Mutasi Aset (Movements)
        const movementWhere = {
            date: { gte: start, lte: end }
        };
        if (targetUnitId) {
            movementWhere.OR = [
                { asset: { unitId: targetUnitId } },
                { toUnitId: targetUnitId }
            ];
        }

        const movements = await prisma.movement.findMany({
            where: movementWhere,
            include: {
                asset: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        unit: { select: { name: true } },
                        room: { select: { name: true } }
                    }
                },
                requester: { select: { name: true } },
                approver: { select: { name: true } }
            },
            orderBy: { date: 'desc' }
        });

        // 5. Query Pemeliharaan & Perbaikan
        const maintenanceWhere = {
            createdAt: { gte: start, lte: end }
        };
        if (targetUnitId) maintenanceWhere.unitId = targetUnitId;

        const maintenances = await prisma.maintenance.findMany({
            where: maintenanceWhere,
            include: {
                unit: { select: { name: true } },
                user: { select: { name: true } },
                assets: { select: { id: true, name: true, code: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        const totalMaintenanceCost = maintenances.reduce((sum, m) => sum + (m.cost || 0), 0);

        // 6. Query Audit & Verifikasi Fisik
        const auditWhere = {
            verifiedAt: { gte: start, lte: end }
        };
        if (targetUnitId) {
            auditWhere.asset = { unitId: targetUnitId };
        }

        const auditItems = await prisma.auditItem.findMany({
            where: auditWhere,
            include: {
                asset: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        unit: { select: { name: true } },
                        room: { select: { name: true } }
                    }
                },
                auditor: { select: { name: true } },
                session: { select: { title: true } }
            },
            orderBy: { verifiedAt: 'desc' }
        });

        // 7. Query Peminjaman Aset (Loans)
        const loanWhere = {
            createdAt: { gte: start, lte: end }
        };
        if (targetUnitId) loanWhere.unitId = targetUnitId;

        const loans = await prisma.assetLoan.findMany({
            where: loanWhere,
            include: {
                asset: { select: { id: true, name: true, code: true } },
                borrower: { select: { name: true } },
                unit: { select: { name: true } },
                targetUnit: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 8. Query Usulan Penghapusan (Disposals)
        const disposalWhere = {
            createdAt: { gte: start, lte: end }
        };
        if (targetUnitId) disposalWhere.asset = { unitId: targetUnitId };

        const disposals = await prisma.assetDisposal.findMany({
            where: disposalWhere,
            include: {
                asset: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        price: true,
                        unit: { select: { name: true } },
                        room: { select: { name: true } }
                    }
                },
                proposedBy: { select: { name: true } },
                reviewedBy: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 9. Query Info Penandatangan & Unit Assets Map
        const [kabidUser, currentUser, allUnits, unitAssetCounts] = await Promise.all([
            prisma.user.findFirst({
                where: {
                    OR: [
                        { position: { contains: 'Kepala Bidang Sarana' } },
                        { position: { contains: 'Kabid Sarpras' } },
                        { role: 'KABID_SARPRAS' }
                    ]
                },
                select: { id: true, name: true, nip: true, username: true, position: true }
            }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, name: true, nip: true, username: true, position: true }
            }),
            prisma.unit.findMany({
                select: { id: true, name: true, code: true }
            }),
            prisma.asset.groupBy({
                by: ['unitId'],
                where: { condition: { not: 'DISPOSED' } },
                _count: { _all: true }
            })
        ]);

        const unitAssetCountMap = {};
        unitAssetCounts.forEach(c => {
            if (c.unitId) unitAssetCountMap[c.unitId] = c._count._all;
        });

        const selectedUnitName = targetUnitId
            ? (allUnits.find(u => u.id === targetUnitId)?.name || 'Unit Terpilih')
            : 'Seluruh Unit Lingkungan Yayasan';

        // 10. Kalkulasi Ringkasan per Unit (Unit Summary)
        const unitsToReport = targetUnitId ? allUnits.filter(u => u.id === targetUnitId) : allUnits;
        const unitSummary = unitsToReport.map(u => {
            const unitNewAssets = newAssets.filter(a => a.unit?.id === u.id || a.unitId === u.id).length;
            const unitMovements = movements.filter(m => m.asset?.unit?.id === u.id || m.toUnitId === u.id).length;
            const unitMaintenances = maintenances.filter(m => m.unit?.id === u.id || m.unitId === u.id).length;
            const unitAudit = auditItems.filter(a => a.asset?.unit?.id === u.id || a.asset?.unitId === u.id).length;
            const unitLoans = loans.filter(l => l.unitId === u.id || l.targetUnitId === u.id).length;
            const unitDisposals = disposals.filter(d => d.asset?.unit?.id === u.id || d.asset?.unitId === u.id).length;
            const totalActivity = unitNewAssets + unitMovements + unitMaintenances + unitAudit + unitLoans + unitDisposals;
            const totalAssets = unitAssetCountMap[u.id] || 0;

            return {
                id: u.id,
                name: u.name,
                code: u.code,
                newAssetsCount: unitNewAssets,
                movementsCount: unitMovements,
                maintenancesCount: unitMaintenances,
                auditCount: unitAudit,
                loansCount: unitLoans,
                disposalsCount: unitDisposals,
                totalActivity,
                totalAssets
            };
        }).sort((a, b) => (b.totalActivity - a.totalActivity) || (b.totalAssets - a.totalAssets));

        // 11. Kalkulasi Analisis Statistik
        // A. Distribusi Kategori Barang Baru
        const catCountMap = {};
        newAssets.forEach(a => {
            const catName = a.category?.name || 'Umum';
            catCountMap[catName] = (catCountMap[catName] || 0) + 1;
        });
        const categoryDistribution = Object.entries(catCountMap).map(([name, count]) => ({
            name,
            count,
            percentage: newAssets.length > 0 ? Math.round((count / newAssets.length) * 100) : 0
        })).sort((a, b) => b.count - a.count);

        // B. Metrik Pemeliharaan (Maintenance)
        const mtCompleted = maintenances.filter(m => m.status === 'COMPLETED').length;
        const mtInProgress = maintenances.filter(m => ['IN_PROGRESS', 'ASSIGNED'].includes(m.status)).length;
        const mtPending = maintenances.filter(m => ['SUBMITTED', 'APPROVED', 'VALIDATED'].includes(m.status)).length;
        const mtRejected = maintenances.filter(m => m.status === 'REJECTED').length;
        const mtCompletionRate = maintenances.length > 0 ? Math.round((mtCompleted / maintenances.length) * 100) : 0;

        // C. Metrik Audit Fisik Lapangan
        const auditFound = auditItems.filter(a => a.status === 'FOUND').length;
        const auditMissing = auditItems.filter(a => a.status === 'MISSING').length;
        const auditAccuracyRate = auditItems.length > 0 ? Math.round((auditFound / auditItems.length) * 100) : 0;

        // D. Metrik Operasional Harian
        const daysDiff = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const totalOperationalEvents = newAssets.length + movements.length + maintenances.length + auditItems.length + loans.length + disposals.length;
        const avgDailyEvents = Number((totalOperationalEvents / daysDiff).toFixed(1));
        const mostActiveUnit = unitSummary.length > 0 && unitSummary[0].totalActivity > 0 ? unitSummary[0].name : '-';

        const statistics = {
            categoryDistribution,
            maintenance: {
                total: maintenances.length,
                completed: mtCompleted,
                inProgress: mtInProgress,
                pending: mtPending,
                rejected: mtRejected,
                completionRate: mtCompletionRate
            },
            audit: {
                total: auditItems.length,
                found: auditFound,
                missing: auditMissing,
                accuracyRate: auditAccuracyRate
            },
            operational: {
                daysCount: daysDiff,
                totalEvents: totalOperationalEvents,
                avgDailyEvents,
                mostActiveUnit
            },
            loans: {
                total: loans.length,
                borrowed: loans.filter(l => l.status === 'BORROWED').length,
                returned: loans.filter(l => l.status === 'RETURNED').length
            }
        };

        res.json({
            period: {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                formattedPeriod: `${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} s/d ${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
                formattedStart: start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
                formattedEnd: end.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            },
            unit: selectedUnitName,
            units: isGlobalAdmin ? allUnits : [],
            summary: {
                newAssetsCount: newAssets.length,
                newAssetsValue: totalNewAssetsValue,
                movementsCount: movements.length,
                maintenanceCount: maintenances.length,
                maintenanceCost: totalMaintenanceCost,
                auditCount: auditItems.length,
                loansCount: loans.length,
                disposalsCount: disposals.length
            },
            unitSummary,
            statistics,
            details: {
                newAssets,
                movements,
                maintenances,
                auditItems,
                loans,
                disposals
            },
            signers: {
                staff: {
                    name: currentUser?.name || 'Staff Manajemen Aset',
                    position: currentUser?.position || 'Staff Manajemen Aset',
                    niy: currentUser?.nip || currentUser?.username || '-'
                },
                kabid: {
                    name: kabidUser?.name || 'Ravi Kurnia',
                    position: kabidUser?.position || 'Kepala Bidang Sarana',
                    niy: kabidUser?.nip || kabidUser?.username || '-'
                }
            }
        });
    } catch (error) {
        console.error('Weekly Asset Report Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Controller: Executive AI Summary untuk Dashboard Manajemen Aset
 */
exports.getDashboardAISummary = async (req, res) => {
    try {
        const { unitId } = req.query;
        let where = { condition: { not: 'DISPOSED' } };
        if (unitId && unitId !== 'all') where.unitId = parseInt(unitId);

        // Fetch real-time data for AI synthesis
        const [
            allAssets,
            totalAssets,
            goodCount,
            lightDamaged,
            heavyDamaged,
            procurementStats,
            maintenanceStats,
            movementStats,
            loanStats,
            disposalStats
        ] = await Promise.all([
            prisma.asset.findMany({
                where,
                select: { price: true, purchaseDate: true, usefulLife: true, condition: true, category: { select: { name: true } } }
            }),
            prisma.asset.count({ where }),
            prisma.asset.count({ where: { ...where, condition: 'BAIK' } }),
            prisma.asset.count({ where: { ...where, condition: 'RUSAK_RINGAN' } }),
            prisma.asset.count({ where: { ...where, condition: 'RUSAK_BERAT' } }),
            prisma.procurement.groupBy({ by: ['status'], where: where.unitId ? { unitId: where.unitId } : {}, _count: { _all: true } }),
            prisma.maintenance.groupBy({ by: ['status'], where: where.unitId ? { unitId: where.unitId } : {}, _count: { _all: true } }),
            prisma.movement.groupBy({ by: ['status'], where: where.unitId ? { OR: [{ asset: { unitId: where.unitId } }, { toUnitId: where.unitId }] } : {}, _count: { _all: true } }),
            prisma.assetLoan.groupBy({ by: ['status'], where: where.unitId ? { OR: [{ unitId: where.unitId }, { targetUnitId: where.unitId }] } : {}, _count: { _all: true } }),
            prisma.assetDisposal.groupBy({ by: ['status'], where: where.unitId ? { asset: { unitId: where.unitId } } : {}, _count: { _all: true } })
        ]);

        const now = new Date();
        let totalBookValue = 0;
        let totalMarketValue = 0;

        allAssets.forEach(a => {
            const purchaseDate = new Date(a.purchaseDate);
            const monthsElapsed = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
            const totalMonths = (a.usefulLife || 5) * 12;
            const monthlyDep = (a.price || 0) / totalMonths;
            const bv = Math.max(0, (a.price || 0) - Math.min(a.price || 0, monthlyDep * Math.max(0, monthsElapsed)));
            totalBookValue += bv;

            let condFactor = a.condition === 'BAIK' ? 1 : (a.condition === 'RUSAK_RINGAN' ? 0.5 : 0.2);
            let catFloor = (a.category?.name || '').toLowerCase().includes('kendaraan') ? 0.2 : 0.1;
            totalMarketValue += Math.max(bv * condFactor, (a.price || 0) * catFloor);
        });

        // Top categories
        const catCounts = {};
        allAssets.forEach(a => {
            const c = a.category?.name || 'Umum';
            catCounts[c] = (catCounts[c] || 0) + 1;
        });
        const topCategories = Object.entries(catCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([cat, count]) => `${cat}: ${count} unit`)
            .join(', ');

        const procStr = procurementStats.map(s => `${s.status}: ${s._count._all}`).join(', ') || '0 data';
        const maintStr = maintenanceStats.map(s => `${s.status}: ${s._count._all}`).join(', ') || '0 data';
        const moveStr = movementStats.map(s => `${s.status}: ${s._count._all}`).join(', ') || '0 data';
        const loanStr = loanStats.map(s => `${s.status}: ${s._count._all}`).join(', ') || '0 data';
        const dispStr = disposalStats.map(s => `${s.status}: ${s._count._all}`).join(', ') || '0 data';

        const healthRatio = totalAssets > 0 ? Math.round((goodCount / totalAssets) * 100) : 100;
        const healthPredikat = healthRatio >= 85 ? 'Sangat Sehat & Prima' : (healthRatio >= 70 ? 'Cukup Baik' : 'Perlu Perhatian Khusus');

        const prompt = `
Anda adalah Analis Senior Sistem Informasi Manajemen Aset & Fasilitas Yayasan Dar El-Iman Padang.
Tugas Anda adalah menyusun Ringkasan Eksekutif (Executive Summary) Analisis Statistik Aset & Rekomendasi Tindakan Strategis untuk Kepala Bidang Sarana & Pimpinan Yayasan.

DATA SISTEM MANAJEMEN ASET TERKINI:
- Total Aset Terdaftar: ${totalAssets.toLocaleString('id-ID')} unit
- Kondisi Aset: ${goodCount.toLocaleString('id-ID')} Baik (${healthRatio}%), ${lightDamaged.toLocaleString('id-ID')} Rusak Ringan, ${heavyDamaged.toLocaleString('id-ID')} Rusak Berat
- Estimasi Nilai Buku: Rp ${Math.round(totalBookValue).toLocaleString('id-ID')}
- Estimasi Nilai Pasar: Rp ${Math.round(totalMarketValue).toLocaleString('id-ID')}
- Kategori Aset Terbanyak: ${topCategories || '-'}
- Status Pengadaan (Procurement): ${procStr}
- Status Pemeliharaan (Maintenance): ${maintStr}
- Status Mutasi Aset (Movements): ${moveStr}
- Status Peminjaman Aset (Loans): ${loanStr}
- Status Usulan Penghapusan (Disposals): ${dispStr}

INSTRUKSI FORMAT OUTPUT:
Keluarkan HANYA JSON MURNI tanpa markdown tambahan dengan skema:
{
  "summary": "Ringkasan eksekutif 2-3 kalimat mengenai kondisi fisik aset, efisiensi operasional sarpras, dan valuasi aset yayasan.",
  "healthScore": ${healthRatio},
  "healthCategory": "${healthPredikat}",
  "criticalFindings": [
    "Temuan penting 1 mengenai kondisi fisik aset atau beban servis",
    "Temuan penting 2 mengenai status pengadaan atau pergerakan/peminjaman",
    "Temuan penting 3 mengenai valuasi atau usulan penghapusan aset"
  ],
  "strategicRecommendations": [
    "Rekomendasi tindakan prioritas 1",
    "Rekomendasi tindakan prioritas 2",
    "Rekomendasi tindakan prioritas 3"
  ]
}
`;

        let aiResult = null;
        try {
            const rawResult = await aiService.generateContentWithFallback(prompt);
            const rawText = rawResult.response.text().trim();
            const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            aiResult = JSON.parse(cleanJson);
        } catch (aiErr) {
            console.warn('[Dashboard AI Summary] Fallback triggered:', aiErr.message);
            aiResult = {
                summary: `Total aset terdata sebanyak ${totalAssets.toLocaleString('id-ID')} unit dengan indeks kesehatan sarana sebesar ${healthRatio}%. Sebanyak ${goodCount.toLocaleString('id-ID')} aset dalam kondisi prima, ${lightDamaged.toLocaleString('id-ID')} rusak ringan, dan ${heavyDamaged.toLocaleString('id-ID')} berstatus rusak berat. Estimasi nilai buku saat ini tercatat Rp ${Math.round(totalBookValue).toLocaleString('id-ID')} dan nilai pasar Rp ${Math.round(totalMarketValue).toLocaleString('id-ID')}.`,
                healthScore: healthRatio,
                healthCategory: healthPredikat,
                criticalFindings: [
                    `${heavyDamaged.toLocaleString('id-ID')} unit aset berstatus Rusak Berat memerlukan peninjauan teknis mendesak untuk opsi servis besar atau pemrosesan ke tahap usulan penghapusan (disposal).`,
                    `${lightDamaged.toLocaleString('id-ID')} unit berstatus Rusak Ringan membutuhkan perawatan preventif agar tidak terdegradasi menjadi rusak berat.`,
                    `Aktivitas operasional terpantau dinamis dengan kategori aset dominan: ${topCategories || 'Inventaris Umum'}.`
                ],
                strategicRecommendations: [
                    "Prioritaskan penyelesaian tiket servis pemeliharaan aktif untuk menekan laju akumulasi aset rusak.",
                    "Percepat proses validasi dan persetujuan pada draf pengadaan (procurement) serta permohonan mutasi antar unit yang masih berstatus pending.",
                    "Lakukan rekonsiliasi dan verifikasi berkala pada aset yang berada dalam status peminjaman untuk menjamin kepastian lokasi fisik barang."
                ]
            };
        }

        res.json({
            success: true,
            data: aiResult,
            metrics: {
                totalAssets,
                goodCount,
                lightDamaged,
                heavyDamaged,
                totalBookValue: Math.round(totalBookValue),
                totalMarketValue: Math.round(totalMarketValue),
                healthRatio
            }
        });
    } catch (err) {
        console.error('Dashboard AI Summary Controller Error:', err);
        res.status(500).json({ error: err.message });
    }
};

