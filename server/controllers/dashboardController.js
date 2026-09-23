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
                        unitId: true,
                        unit: { select: { id: true, name: true } },
                        room: { select: { id: true, name: true } }
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
                unit: { select: { id: true, name: true } },
                user: { select: { name: true } },
                assets: { select: { id: true, name: true, code: true, unitId: true } }
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
                        unitId: true,
                        unit: { select: { id: true, name: true } },
                        room: { select: { id: true, name: true } }
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
                asset: { select: { id: true, name: true, code: true, unitId: true } },
                borrower: { select: { name: true } },
                unit: { select: { id: true, name: true } },
                targetUnit: { select: { id: true, name: true } }
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
                        unitId: true,
                        unit: { select: { id: true, name: true } },
                        room: { select: { id: true, name: true } }
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
            const unitMovements = movements.filter(m => m.asset?.unit?.id === u.id || m.asset?.unitId === u.id || m.toUnitId === u.id).length;
            const unitMaintenances = maintenances.filter(m => m.unit?.id === u.id || m.unitId === u.id || m.assets?.some(a => a.unitId === u.id)).length;
            const unitAudit = auditItems.filter(a => a.asset?.unit?.id === u.id || a.asset?.unitId === u.id).length;
            const unitLoans = loans.filter(l => l.unitId === u.id || l.targetUnitId === u.id || l.asset?.unitId === u.id).length;
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
                totalAssets,

                // Aliases for compatibility
                newAssets: unitNewAssets,
                movements: unitMovements,
                maintenance: unitMaintenances,
                audit: unitAudit,
                loans: unitLoans,
                disposals: unitDisposals,
                activeAssetsCount: totalAssets
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
        const userPos = (req.user?.position || '').toLowerCase();
        const userRole = req.user?.role || '';
        const isKabidSarana = userRole === 'KABID_SARPRAS' || userPos.includes('kepala bidang sarana') || userPos.includes('kabid sarpras');
        if (!isKabidSarana && !['SUPER_ADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Akses ditolak. Fitur Analisis AI khusus untuk Kepala Bidang Sarana.' });
        }

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

/**
 * Controller: Ringkasan AI untuk Laporan Berkala (Weekly/Date Filtered Asset Report)
 */
exports.getWeeklyReportAISummary = async (req, res) => {
    try {
        const { role, unitId: userUnitId } = req.user || {};
        const startDate = req.query?.startDate || req.body?.startDate;
        const endDate = req.query?.endDate || req.body?.endDate;
        const unitId = req.query?.unitId || req.body?.unitId;

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
            end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
        }

        // 2. Tentukan Filter Unit
        const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT', 'KABID_SARPRAS'].includes(role) || req.user?.position === 'Kepala Bidang Sarana';
        let targetUnitId = null;
        if (unitId && unitId !== 'all') {
            targetUnitId = parseInt(unitId);
        } else if (!isGlobalAdmin && userUnitId) {
            targetUnitId = userUnitId;
        }

        let allUnits = [];
        let newAssets = [];
        let movements = [];
        let maintenances = [];
        let auditItems = [];
        let loans = [];
        let disposals = [];
        let selectedUnitName = req.body?.unit || '';

        // 3. Cek apakah client sudah mengirimkan data rekapitulasi (untuk efisiensi maksimal)
        if (req.body?.summary && req.body?.statistics) {
            newAssets = req.body.details?.newAssets || [];
            movements = req.body.details?.movements || [];
            maintenances = req.body.details?.maintenances || [];
            auditItems = req.body.details?.auditItems || [];
            loans = req.body.details?.loans || [];
            disposals = req.body.details?.disposals || [];
            if (!selectedUnitName) {
                selectedUnitName = targetUnitId ? 'Unit Terpilih' : 'Seluruh Unit Lingkungan Yayasan';
            }
        } else {
            // Query Database jika payload belum disertakan
            const dbResults = await Promise.all([
                prisma.unit.findMany({ select: { id: true, name: true, code: true } }),
                prisma.asset.findMany({
                    where: {
                        createdAt: { gte: start, lte: end },
                        ...(targetUnitId ? { unitId: targetUnitId } : {})
                    },
                    select: { id: true, name: true, price: true, category: { select: { name: true } }, unit: { select: { name: true } } }
                }),
                prisma.movement.findMany({
                    where: {
                        date: { gte: start, lte: end },
                        ...(targetUnitId ? { OR: [{ asset: { unitId: targetUnitId } }, { toUnitId: targetUnitId }] } : {})
                    },
                    select: { id: true, toUnit: { select: { name: true } }, asset: { select: { name: true, unit: { select: { name: true } } } } }
                }),
                prisma.maintenance.findMany({
                    where: {
                        createdAt: { gte: start, lte: end },
                        ...(targetUnitId ? { unitId: targetUnitId } : {})
                    },
                    select: { id: true, title: true, status: true, cost: true, unit: { select: { name: true } } }
                }),
                prisma.auditItem.findMany({
                    where: {
                        verifiedAt: { gte: start, lte: end },
                        ...(targetUnitId ? { asset: { unitId: targetUnitId } } : {})
                    },
                    select: { id: true, status: true, foundCondition: true, asset: { select: { name: true, unit: { select: { name: true } } } } }
                }),
                prisma.assetLoan.findMany({
                    where: {
                        createdAt: { gte: start, lte: end },
                        ...(targetUnitId ? { unitId: targetUnitId } : {})
                    },
                    select: { id: true, status: true, targetUnit: { select: { name: true } }, asset: { select: { name: true } } }
                }),
                prisma.assetDisposal.findMany({
                    where: {
                        createdAt: { gte: start, lte: end },
                        ...(targetUnitId ? { asset: { unitId: targetUnitId } } : {})
                    },
                    select: { id: true, status: true, reason: true, asset: { select: { name: true, unit: { select: { name: true } } } } }
                })
            ]);

            allUnits = dbResults[0];
            newAssets = dbResults[1];
            movements = dbResults[2];
            maintenances = dbResults[3];
            auditItems = dbResults[4];
            loans = dbResults[5];
            disposals = dbResults[6];

            if (!selectedUnitName) {
                selectedUnitName = targetUnitId
                    ? (allUnits.find(u => u.id === targetUnitId)?.name || 'Unit Terpilih')
                    : 'Seluruh Unit Lingkungan Yayasan';
            }
        }

        const totalNewAssetsValue = req.body?.summary?.newAssetsValue ?? newAssets.reduce((sum, a) => sum + (a.price || 0), 0);
        const totalMaintenanceCost = req.body?.summary?.maintenanceCost ?? maintenances.reduce((sum, m) => sum + (m.cost || 0), 0);


        // Kategori barang baru
        const catCountMap = {};
        newAssets.forEach(a => {
            const cat = a.category?.name || 'Umum';
            catCountMap[cat] = (catCountMap[cat] || 0) + 1;
        });
        const topCategories = Object.entries(catCountMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([c, n]) => `${c} (${n} unit)`)
            .join(', ') || '-';

        // Nama barang baru teratas
        const assetNameMap = {};
        newAssets.forEach(a => {
            const nm = (a.name || '').trim();
            if (nm) assetNameMap[nm] = (assetNameMap[nm] || 0) + 1;
        });
        const topAssetNames = Object.entries(assetNameMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([nm, cnt]) => `${nm} (${cnt})`)
            .join(', ') || '-';

        // Maintenance stats
        const mtCompleted = maintenances.filter(m => m.status === 'COMPLETED').length;
        const mtInProgress = maintenances.filter(m => ['IN_PROGRESS', 'ASSIGNED'].includes(m.status)).length;
        const mtPending = maintenances.filter(m => ['SUBMITTED', 'APPROVED', 'VALIDATED'].includes(m.status)).length;
        const mtCompletionRate = maintenances.length > 0 ? Math.round((mtCompleted / maintenances.length) * 100) : 0;

        // Audit stats
        const auditFound = auditItems.filter(a => a.status === 'FOUND').length;
        const auditMissing = auditItems.filter(a => a.status === 'MISSING').length;
        const auditAccuracyRate = auditItems.length > 0 ? Math.round((auditFound / auditItems.length) * 100) : 0;

        // Loan stats
        const loansBorrowed = loans.filter(l => l.status === 'BORROWED').length;
        const loansReturned = loans.filter(l => l.status === 'RETURNED').length;

        // Unit aktif
        const unitActivityMap = {};
        allUnits.forEach(u => { unitActivityMap[u.name] = 0; });
        newAssets.forEach(a => { if (a.unit?.name) unitActivityMap[a.unit.name] = (unitActivityMap[a.unit.name] || 0) + 1; });
        movements.forEach(m => { if (m.toUnit?.name) unitActivityMap[m.toUnit.name] = (unitActivityMap[m.toUnit.name] || 0) + 1; });
        maintenances.forEach(m => { if (m.unit?.name) unitActivityMap[m.unit.name] = (unitActivityMap[m.unit.name] || 0) + 1; });
        
        const sortedUnits = Object.entries(unitActivityMap).sort((a, b) => b[1] - a[1]);
        const mostActiveUnit = sortedUnits.length > 0 && sortedUnits[0][1] > 0 ? `${sortedUnits[0][0]} (${sortedUnits[0][1]} aktivitas)` : '-';

        const daysDiff = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const totalOperationalEvents = newAssets.length + movements.length + maintenances.length + auditItems.length + loans.length + disposals.length;
        const avgDailyEvents = Number((totalOperationalEvents / daysDiff).toFixed(1));

        const formattedStart = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const formattedEnd = end.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const periodStr = `${formattedStart} s/d ${formattedEnd}`;

        let operationalStatus = 'OPTIMAL';
        let operationalStatusLabel = 'Operasional Berjalan Optimal';
        if (maintenances.length > 0 && mtCompletionRate < 60) {
            operationalStatus = 'PERLU_PERHATIAN';
            operationalStatusLabel = 'Perlu Perhatian Khusus pada Antrean Servis';
        } else if (auditItems.length > 0 && auditAccuracyRate < 80) {
            operationalStatus = 'PERLU_PERHATIAN';
            operationalStatusLabel = 'Terdapat Selisih Fisik pada Audit';
        } else if (maintenances.length > 0 && mtCompletionRate < 80) {
            operationalStatus = 'STABIL';
            operationalStatusLabel = 'Operasional Berjalan Cukup Stabil';
        }

        const prompt = `
Anda adalah Analis Senior Sistem Informasi Manajemen Aset & Fasilitas Yayasan Dar El-Iman Padang.
Tugas Anda adalah menyusun Ringkasan Eksekutif AI (AI Executive Summary) yang menggambarkan rangkuman seluruh kegiatan operasional dan dinamika manajemen aset pada rentang tanggal yang difilter.

INFORMASI LAPORAN:
- Periode Tanggal: ${periodStr} (${daysDiff} hari kalender)
- Satuan Kerja / Unit: ${selectedUnitName}

DATA AKTIVITAS MANAJEMEN ASET TERVERIFIKASI:
1. PENGADAAN & REGISTRASI ASET BARU:
   - Jumlah Barang Baru Masuk: ${newAssets.length} unit (Estimasi Nilai: Rp ${totalNewAssetsValue.toLocaleString('id-ID')})
   - Kategori Dominan: ${topCategories}
   - Barang Terbanyak: ${topAssetNames}
2. MUTASI & PERPINDAHAN:
   - Frekuensi Relokasi Sarana: ${movements.length} transaksi pemindahan antar ruangan/unit
3. PEMELIHARAAN & PERBAIKAN SARANA (MAINTENANCE):
   - Total Tiket Servis: ${maintenances.length} tiket (Total Biaya Servis: Rp ${totalMaintenanceCost.toLocaleString('id-ID')})
   - Selesai Diperbaiki: ${mtCompleted} tiket (${mtCompletionRate}%)
   - Sedang Dalam Pengerjaan: ${mtInProgress} tiket
   - Menunggu Tindakan / Draf: ${mtPending} tiket
4. AUDIT & CEK FISIK LAPANGAN:
   - Total Aset Diverifikasi: ${auditItems.length} item
   - Ditemukan Sesuai Kondisi: ${auditFound} item (${auditAccuracyRate}%)
   - Belum Ditemukan / Selisih: ${auditMissing} item
5. PEMINJAMAN SARANA (LOANS):
   - Total Transaksi Peminjaman: ${loans.length} sesi
   - Masih Aktif Dipinjam: ${loansBorrowed} item
   - Selesai & Dikembalikan: ${loansReturned} item
6. USULAN PENGHAPUSAN (DISPOSAL):
   - Total Aset Diajukan Penghapusan/Afkir: ${disposals.length} unit
7. INTENSITAS OPERASIONAL & SEBARAN UNIT:
   - Total Kejadian Operasional: ${totalOperationalEvents} aktivitas (Rata-rata: ${avgDailyEvents} transaksi/hari)
   - Unit Paling Aktif Beraktivitas: ${mostActiveUnit}

INSTRUKSI FORMAT OUTPUT:
Keluarkan HANYA JSON MURNI tanpa markdown tambahan (tanpa \`\`\`json \`\`\`) dengan format berikut:
{
  "narrativeSummary": "Paragraf naratif komprehensif (3-5 kalimat) yang merangkum dinamika operasional aset pada periode ${periodStr}. Sebutkan secara natural angka-angka utama mengenai pengadaan aset baru, progres pemeliharaan sarana, audit, serta pergerakan barang.",
  "operationalStatus": "${operationalStatus}",
  "operationalStatusLabel": "${operationalStatusLabel}",
  "keyHighlights": [
    "Sorotan utama 1 mengenai penambahan sarana/inventaris baru atau nilai perolehan",
    "Sorotan utama 2 mengenai performa dan penyelesaian servis sarpras serta biayanya",
    "Sorotan utama 3 mengenai ketertiban mutasi, peminjaman, atau hasil cek fisik audit",
    "Sorotan utama 4 mengenai unit kerja paling aktif atau usulan afkir"
  ],
  "operationalEvaluation": {
    "procurementNote": "Catatan singkat laju pengadaan barang",
    "maintenanceEfficiency": "Catatan singkat efisiensi penyelesaian perbaikan",
    "assetControl": "Catatan kontrol audit fisik dan peminjaman"
  },
  "strategicRecommendations": [
    "Rekomendasi taktis 1 untuk periode operasional berikutnya",
    "Rekomendasi taktis 2 untuk pencegahan atau pemeliharaan preventif",
    "Rekomendasi taktis 3 untuk penguatan administrasi dan verifikasi aset"
  ]
}
`;

        let aiResult = null;
        let source = 'gemini_ai';
        try {
            const rawResult = await aiService.generateContentWithFallback(prompt);
            const rawText = rawResult.response.text().trim();
            const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            aiResult = JSON.parse(cleanJson);
        } catch (aiErr) {
            console.warn('[Weekly Report AI Summary] Fallback triggered:', aiErr.message);
            source = 'rule_based';
            aiResult = {
                narrativeSummary: `Sepanjang periode ${periodStr}, aktivitas manajemen aset mencatatkan total ${totalOperationalEvents} peristiwa operasional dengan rata-rata ${avgDailyEvents} aktivitas per hari di ${selectedUnitName}. Sebanyak ${newAssets.length} unit aset baru telah teregistrasi ke dalam sistem. Pada aspek pemeliharaan, dari ${maintenances.length} tiket servis yang diajukan, ${mtCompleted} tiket (${mtCompletionRate}%) telah berhasil diselesaikan dengan total realisasi biaya Rp ${totalMaintenanceCost.toLocaleString('id-ID')}. Pada saat yang sama, kegiatan verifikasi fisik mencatatkan tingkat akurasi ${auditAccuracyRate}%, serta terpantau ${loansBorrowed} item aset masih dalam status aktif dipinjam.`,
                operationalStatus,
                operationalStatusLabel,
                keyHighlights: [
                    newAssets.length > 0 
                        ? `Registrasi ${newAssets.length} unit sarana baru (Kategori utama: ${topCategories}) dengan estimasi nilai perolehan Rp ${totalNewAssetsValue.toLocaleString('id-ID')}.`
                        : `Tidak terdapat penambahan unit aset baru yang terdata pada periode ini.`,
                    maintenances.length > 0
                        ? `Tingkat penyelesaian servis pemeliharaan mencapai ${mtCompletionRate}% (${mtCompleted} dari ${maintenances.length} tiket) dengan sisa ${mtInProgress + mtPending} tiket dalam penanganan.`
                        : `Tidak terdapat tiket perbaikan aktif yang tercatat pada rentang tanggal ini.`,
                    movements.length > 0 || loans.length > 0
                        ? `Aktivitas mobilitas mencakup ${movements.length} transaksi mutasi ruangan/unit dan ${loans.length} sesi peminjaman (${loansBorrowed} unit masih aktif dipinjam).`
                        : `Mobilitas aset terpantau stabil tanpa transaksi mutasi maupun peminjaman baru.`,
                    auditItems.length > 0
                        ? `Audit fisik memverifikasi ${auditItems.length} item dengan tingkat kesesuaian fisik mencapai ${auditAccuracyRate}%.`
                        : disposals.length > 0 
                            ? `Terdapat ${disposals.length} usulan penghapusan sarana rusak berat untuk ditindaklanjuti pimpinan.`
                            : `Satuan kerja paling aktif beraktivitas pada periode ini adalah ${mostActiveUnit}.`
                ],
                operationalEvaluation: {
                    procurementNote: newAssets.length > 0 ? `Pengadaan ${newAssets.length} unit sarana baru berjalan sesuai alur inventarisasi.` : `Fokus operasional pada optimalisasi aset yang ada tanpa pengadaan baru.`,
                    maintenanceEfficiency: mtCompletionRate >= 75 ? `Penyelesaian tiket pemeliharaan berlangsung cepat dan responsif (${mtCompletionRate}% tuntas).` : `Perlu akselerasi pengerjaan untuk ${mtInProgress + mtPending} tiket servis yang belum selesai.`,
                    assetControl: auditAccuracyRate >= 80 ? `Kontrol fisik dan tertib inventaris terpantau sangat baik.` : `Tingkatkan rekonsiliasi berkala untuk memastikan seluruh barang terdata di lokasi semestinya.`
                },
                strategicRecommendations: [
                    mtInProgress + mtPending > 0
                        ? `Prioritaskan penyelesaian ${mtInProgress + mtPending} tiket servis pemeliharaan yang masih dalam proses agar sarana dapat segera difungsikan kembali.`
                        : `Lakukan inspeksi pemeliharaan berkala (preventive maintenance) pada sarana vital yayasan.`,
                    loansBorrowed > 0
                        ? `Lakukan konfirmasi dan pemantauan pengembalian terhadap ${loansBorrowed} unit sarana yang saat ini berstatus aktif dipinjam.`
                        : `Pastikan seluruh berkas mutasi dan pencatatan penanggung jawab ruangan terus diperbarui.`,
                    disposals.length > 0
                        ? `Agendakan rapat validasi teknis untuk ${disposals.length} unit aset yang diusulkan afkir/penghapusan.`
                        : `Lanjutkan verifikasi audit fisik secara acak ke unit-unit kerja guna mempertahankan akurasi data inventaris.`
                ]
            };
        }

        res.json({
            success: true,
            source,
            period: {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                formattedPeriod: periodStr
            },
            unit: selectedUnitName,
            metrics: {
                totalOperationalEvents,
                avgDailyEvents,
                newAssetsCount: newAssets.length,
                totalNewAssetsValue,
                movementsCount: movements.length,
                maintenanceCount: maintenances.length,
                mtCompleted,
                mtCompletionRate,
                totalMaintenanceCost,
                auditCount: auditItems.length,
                auditAccuracyRate,
                loansCount: loans.length,
                loansBorrowed,
                disposalsCount: disposals.length,
                mostActiveUnit
            },
            data: aiResult
        });
    } catch (err) {
        console.error('Weekly Report AI Summary Controller Error:', err);
        res.status(500).json({ error: err.message });
    }
};


