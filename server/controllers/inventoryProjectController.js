const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateDocumentNumber } = require('../services/documentNumberingService');
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');

// ==========================================
// METADATA HELPER FOR APPROVAL & E-OFFICE
// ==========================================
function parseProjectMetadata(note) {
    if (!note) return { text: '', meta: {} };
    if (typeof note === 'string' && note.trim().startsWith('__META__::')) {
        try {
            const jsonPart = note.trim().substring('__META__::'.length);
            const parsed = JSON.parse(jsonPart);
            return { text: parsed.noteText || '', meta: parsed };
        } catch (e) {
            return { text: note, meta: {} };
        }
    }
    if (typeof note === 'string' && note.trim().startsWith('{') && note.trim().endsWith('}')) {
        try {
            const parsed = JSON.parse(note);
            return { text: parsed.text || parsed.noteText || '', meta: parsed };
        } catch (e) {}
    }
    return { text: note, meta: {} };
}

function serializeProjectMetadata(noteText, metaObj) {
    const payload = {
        noteText: noteText || '',
        ...metaObj
    };
    return '__META__::' + JSON.stringify(payload);
}

// ==========================================
// PROYEK LOGISTIK / GUDANG
// ==========================================

exports.getProjects = async (req, res) => {
    try {
        const projects = await prisma.invProject.findMany({
            include: {
                vendorSelections: {
                    include: { vendor: true }
                },
                mous: {
                    include: { vendor: true }
                },
                evaluations: {
                    include: { vendor: true }
                },
                projectItems: {
                    include: { item: { include: { category: true } } }
                }
            },
            orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
        });

        // Format and map fields for frontend compatibility with metadata
        const mapped = projects.map(p => {
            const { text, meta } = parseProjectMetadata(p.note);
            const approvalStatus = meta.approvalStatus || (p.status === 'MENUNGGU_PERSETUJUAN' ? 'PENDING' : 'APPROVED');

            return {
                ...p,
                title: p.title || p.name,
                name: p.name || p.title,
                note: text,
                approvalStatus,
                approvedById: meta.approvedById || null,
                approvedByName: meta.approvedByName || null,
                approvedAt: meta.approvedAt || null,
                approvalNote: meta.approvalNote || null,
                approvalSignature: meta.approvalSignature || null,
                requestedByName: meta.requestedByName || null,
                justification: meta.justification || '',
                targetDate: meta.targetDate || null,
                budget: p.budget || meta.budget || 0,
                projectType: p.type || meta.projectType || 'SELEKSI',
                poNumber: meta.poNumber || null,
                poDate: meta.poDate || null,
                poOfficeDocId: meta.poOfficeDocId || null,
                poVendorName: meta.poVendorName || null,
                bastNumber: meta.bastNumber || null,
                bastDate: meta.bastDate || null,
                bastOfficeDocId: meta.bastOfficeDocId || null,
                itemAdjustments: meta.itemAdjustments || [],
                originalTargetQuantity: meta.originalTargetQuantity || p.targetQuantity,
                selections: p.vendorSelections || []
            };
        });

        res.json(mapped);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
};

exports.createProject = async (req, res) => {
    try {
        const { name, title, year, type, projectType, budget, status, note, items, directVendorId, targetQuantity, justification, targetDate, requestedByName } = req.body;
        const projTitle = (title || name || 'Proyek Pengadaan Barang').toString().trim();
        const parsedYear = parseInt(year, 10) || new Date().getFullYear();
        const selectedType = projectType || type || 'SELEKSI';

        // Process project items
        const itemMap = new Map();
        if (Array.isArray(items)) {
            items.forEach(i => {
                const itId = parseInt(i.itemId || i.id, 10);
                const qty = parseInt(i.quantity, 10);
                if (itId && qty > 0) {
                    itemMap.set(itId, (itemMap.get(itId) || 0) + qty);
                }
            });
        }

        const projectItemsData = Array.from(itemMap.entries()).map(([itemId, quantity]) => ({
            itemId,
            quantity
        }));

        const totalQty = projectItemsData.reduce((acc, curr) => acc + curr.quantity, 0) || parseInt(targetQuantity || 0, 10);

        // Proyek baru otomatis membutuhkan persetujuan Kepala Bidang Sarana
        const initialStatus = status || 'MENUNGGU_PERSETUJUAN';
        const initialApprovalStatus = initialStatus === 'MENUNGGU_PERSETUJUAN' ? 'PENDING' : 'APPROVED';

        const meta = {
            approvalStatus: initialApprovalStatus,
            requestedByName: requestedByName || req.user?.name || 'Staff Gudang / Admin',
            justification: justification || '',
            targetDate: targetDate || null,
            budget: parseFloat(budget) || 0,
            projectType: selectedType
        };

        const serializedNote = serializeProjectMetadata(note, meta);

        const project = await prisma.$transaction(async (tx) => {
            const newProj = await tx.invProject.create({
                data: {
                    title: projTitle,
                    name: projTitle,
                    year: parsedYear,
                    type: selectedType,
                    budget: parseFloat(budget) || 0,
                    targetQuantity: totalQty,
                    status: initialStatus,
                    note: serializedNote,
                    projectItems: {
                        create: projectItemsData
                    }
                },
                include: {
                    projectItems: {
                        include: { item: true }
                    }
                }
            });

            if (selectedType === 'PENUNJUKAN_LANGSUNG' && directVendorId) {
                await tx.invVendorSelection.create({
                    data: {
                        projectId: newProj.id,
                        vendorId: parseInt(directVendorId, 10),
                        status: 'DIPILIH',
                        reason: 'Penunjukan Langsung'
                    }
                });
            }

            return newProj;
        });

        res.status(201).json({
            ...project,
            ...meta,
            note: note || ''
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Failed to create project' });
    }
};

exports.updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, title, year, type, projectType, budget, status, note, items, directVendorId, targetQuantity, justification, targetDate, requestedByName } = req.body;
        const projectId = parseInt(id, 10);
        const projTitle = (title || name || '').toString().trim();
        const parsedYear = year ? parseInt(year, 10) : undefined;
        const selectedType = projectType || type;

        const existingProj = await prisma.invProject.findUnique({ where: { id: projectId } });
        if (!existingProj) return res.status(404).json({ error: 'Proyek tidak ditemukan' });

        const { text, meta } = parseProjectMetadata(existingProj.note);

        const updatedMeta = {
            ...meta,
            ...(justification !== undefined ? { justification } : {}),
            ...(targetDate !== undefined ? { targetDate } : {}),
            ...(requestedByName !== undefined ? { requestedByName } : {}),
            ...(budget !== undefined ? { budget: parseFloat(budget) } : {}),
            ...(selectedType !== undefined ? { projectType: selectedType } : {})
        };

        const noteTextToSave = note !== undefined ? note : text;
        const serializedNote = serializeProjectMetadata(noteTextToSave, updatedMeta);

        const updated = await prisma.$transaction(async (tx) => {
            // Update items if provided
            if (Array.isArray(items)) {
                await tx.invProjectItem.deleteMany({ where: { projectId } });

                const itemMap = new Map();
                items.forEach(i => {
                    const itId = parseInt(i.itemId || i.id, 10);
                    const qty = parseInt(i.quantity, 10);
                    if (itId && qty > 0) {
                        itemMap.set(itId, (itemMap.get(itId) || 0) + qty);
                    }
                });

                const projectItemsData = Array.from(itemMap.entries()).map(([itemId, quantity]) => ({
                    projectId,
                    itemId,
                    quantity
                }));

                if (projectItemsData.length > 0) {
                    await tx.invProjectItem.createMany({
                        data: projectItemsData
                    });
                }
            }

            const dataToUpdate = {};
            if (projTitle) {
                dataToUpdate.title = projTitle;
                dataToUpdate.name = projTitle;
            }
            if (parsedYear) dataToUpdate.year = parsedYear;
            if (selectedType) dataToUpdate.type = selectedType;
            if (budget !== undefined) dataToUpdate.budget = parseFloat(budget);
            if (targetQuantity !== undefined) dataToUpdate.targetQuantity = parseInt(targetQuantity, 10);
            if (status) dataToUpdate.status = status;
            dataToUpdate.note = serializedNote;

            const proj = await tx.invProject.update({
                where: { id: projectId },
                data: dataToUpdate,
                include: {
                    projectItems: {
                        include: { item: true }
                    }
                }
            });

            if (selectedType === 'PENUNJUKAN_LANGSUNG' && directVendorId) {
                await tx.invVendorSelection.upsert({
                    where: {
                        projectId_vendorId: {
                            projectId,
                            vendorId: parseInt(directVendorId, 10)
                        }
                    },
                    create: {
                        projectId,
                        vendorId: parseInt(directVendorId, 10),
                        status: 'DIPILIH',
                        reason: 'Penunjukan Langsung'
                    },
                    update: {
                        status: 'DIPILIH',
                        reason: 'Penunjukan Langsung'
                    }
                });
            }

            return proj;
        });

        res.json({
            ...updated,
            ...updatedMeta,
            note: noteTextToSave
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Failed to update project' });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.invProject.delete({ where: { id: parseInt(id, 10) } });
        res.json({ message: 'Project deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
};

// --- PERSETUJUAN KEPALA BIDANG SARANA ---
exports.approveProject = async (req, res) => {
    try {
        const projectId = parseInt(req.params.id, 10);
        const { action, notes, signature, adjustedItems } = req.body; // action: 'APPROVE' | 'REJECT'

        // Auth check: KABID_SARPRAS or Kepala Bidang Sarana or SUPER_ADMIN
        const role = req.user?.role || '';
        const position = (req.user?.position || '').toLowerCase();
        const isAuthorized = role === 'SUPER_ADMIN' || 
                             role === 'KABID_SARPRAS' || 
                             role === 'KEPALA_BIDANG' || 
                             position.includes('kepala bidang sarana') || 
                             position.includes('kabid sarpras');

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Akses Ditolak: Hanya Kepala Bidang Sarana atau Super Admin yang berhak menyetujui proyek ini.' });
        }

        const project = await prisma.invProject.findUnique({
            where: { id: projectId },
            include: { projectItems: { include: { item: true } } }
        });
        if (!project) return res.status(404).json({ error: 'Proyek tidak ditemukan' });

        const { text, meta } = parseProjectMetadata(project.note);

        const isApprove = action === 'APPROVE';
        const newStatus = isApprove ? 'DISETUJUI' : 'DITOLAK';
        const newApprovalStatus = isApprove ? 'APPROVED' : 'REJECTED';

        const updatedMeta = {
            ...meta,
            approvalStatus: newApprovalStatus,
            approvedById: req.user?.id || null,
            approvedByName: req.user?.name || 'Ravi Kurnia, S.Pd.I',
            approvedAt: new Date().toISOString(),
            approvalNote: notes || '',
            approvalSignature: signature || meta.approvalSignature || null
        };

        // Jika disetujui dan ada penyesuaian/pengurangan jumlah item oleh Kepala Bidang
        let newTargetQty = project.targetQuantity;
        if (isApprove && Array.isArray(adjustedItems) && adjustedItems.length > 0) {
            const itemAdjustments = [];
            newTargetQty = 0;

            for (const pi of (project.projectItems || [])) {
                const adj = adjustedItems.find(a => (a.id && a.id === pi.id) || (a.itemId && a.itemId === pi.itemId));
                let qtyToSet = pi.quantity;
                if (adj && adj.quantity !== undefined) {
                    qtyToSet = Math.max(0, parseInt(adj.quantity, 10) || 0);
                }

                if (qtyToSet !== pi.quantity) {
                    itemAdjustments.push({
                        itemId: pi.itemId,
                        itemName: pi.item?.name || 'Barang',
                        originalQuantity: pi.quantity,
                        approvedQuantity: qtyToSet
                    });
                    await prisma.invProjectItem.update({
                        where: { id: pi.id },
                        data: { quantity: qtyToSet }
                    });
                }
                newTargetQty += qtyToSet;
            }

            if (itemAdjustments.length > 0) {
                updatedMeta.itemAdjustments = itemAdjustments;
                updatedMeta.originalTargetQuantity = meta.originalTargetQuantity || project.targetQuantity;
            }
        }

        const updated = await prisma.invProject.update({
            where: { id: projectId },
            data: {
                status: newStatus,
                targetQuantity: newTargetQty,
                note: serializeProjectMetadata(text, updatedMeta)
            },
            include: {
                projectItems: { include: { item: true } },
                vendorSelections: { include: { vendor: true } }
            }
        });

        res.json({
            message: isApprove ? 'Proyek berhasil disetujui (ACC) oleh Kepala Bidang Sarana' : 'Pengajuan proyek telah ditolak / dikembalikan dengan catatan',
            project: {
                ...updated,
                note: text,
                ...updatedMeta
            }
        });
    } catch (error) {
        console.error('Approve Project Error:', error);
        res.status(500).json({ error: error.message || 'Gagal memproses persetujuan proyek' });
    }
};

// --- PENERBITAN SURAT PESANAN (PO / SPK) KE VENDOR ---
exports.createPurchaseOrder = async (req, res) => {
    try {
        const projectId = parseInt(req.params.id, 10);
        const { vendorId, vendorName, vendorAddress, vendorPhone, deadline, items, notes } = req.body;

        const project = await prisma.invProject.findUnique({
            where: { id: projectId },
            include: {
                projectItems: { include: { item: { include: { category: true } } } },
                vendorSelections: { include: { vendor: true } }
            }
        });
        if (!project) return res.status(404).json({ error: 'Proyek tidak ditemukan' });

        const { text, meta } = parseProjectMetadata(project.note);

        // Harus berstatus disetujui terlebih dahulu
        if (project.status === 'MENUNGGU_PERSETUJUAN' || meta.approvalStatus === 'PENDING') {
            return res.status(400).json({ error: 'Surat Pesanan belum dapat diterbitkan karena proyek belum disetujui oleh Kepala Bidang Sarana.' });
        }

        // Generate official PO document number via documentNumberingService
        let poNumber = meta.poNumber;
        if (!poNumber) {
            try {
                poNumber = await generateDocumentNumber('Pesanan', 'SURAT_PESANAN');
            } catch (numErr) {
                console.error('Failed to generate document number:', numErr);
                poNumber = `001/PO/SRN/${new Date().getFullYear()}`;
            }
        }

        // Determine vendor details
        let resolvedVendorName = vendorName;
        let resolvedVendorAddress = vendorAddress || '';
        let resolvedVendorPhone = vendorPhone || '';

        if (!resolvedVendorName && vendorId) {
            const v = await prisma.invVendor.findUnique({ where: { id: parseInt(vendorId, 10) } });
            if (v) {
                resolvedVendorName = v.name;
                resolvedVendorAddress = v.address || '';
                resolvedVendorPhone = v.phone || '';
            }
        }
        if (!resolvedVendorName && project.vendorSelections?.length > 0) {
            const chosen = project.vendorSelections.find(s => s.status === 'DIPILIH') || project.vendorSelections[0];
            resolvedVendorName = chosen.vendor?.name;
            resolvedVendorAddress = chosen.vendor?.address || '';
            resolvedVendorPhone = chosen.vendor?.phone || '';
        }

        // Format items for PO (hanya item dengan kuantitas > 0 yang dipesan)
        const allItems = items && items.length > 0 ? items : project.projectItems;
        const rawItems = (allItems || []).filter(pi => {
            const q = parseInt(pi.quantity || pi.qty || 0, 10);
            return q > 0;
        });
        const poItems = rawItems.map((pi, idx) => ({
            no: idx + 1,
            name: pi.name || pi.item?.name || 'Barang Logistik',
            spec: pi.spec || pi.item?.code ? `${pi.item?.code} (${pi.item?.category?.name || 'Logistik'})` : (pi.item?.category?.name || '-'),
            qty: parseInt(pi.quantity || pi.qty || 0, 10),
            unit: pi.unit || pi.item?.unit || 'Pcs',
            price: parseFloat(pi.price || pi.unitPrice || 0)
        }));

        const grandTotal = poItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);

        const contentObj = {
            subCategory: 'SURAT PESANAN',
            items: poItems,
            deadline: deadline || meta.targetDate || '',
            totalAmount: grandTotal,
            priceDetermined: grandTotal > 0,
            note: notes || meta.justification || '',
            projectId: project.id,
            poNumber,
            orderDate: new Date().toISOString()
        };

        // Create or update OfficeDocument record in E-Office
        let officeDocId = meta.poOfficeDocId;
        try {
            if (officeDocId) {
                await prisma.officeDocument.update({
                    where: { id: officeDocId },
                    data: {
                        subject: `Surat Pesanan (PO) - ${project.title || project.name} (${resolvedVendorName || 'Vendor'})`,
                        number: poNumber,
                        party2Name: resolvedVendorName || 'Vendor Rekanan',
                        party2Address: resolvedVendorAddress,
                        content: JSON.stringify(contentObj)
                    }
                });
            } else {
                const newOfficeDoc = await prisma.officeDocument.create({
                    data: {
                        type: 'SURAT_KELUAR',
                        category: 'Pesanan',
                        subject: `Surat Pesanan (PO) - ${project.title || project.name} (${resolvedVendorName || 'Vendor'})`,
                        number: poNumber,
                        date: new Date(),
                        referenceNumber: `PRJ-LOG-${project.id}`,
                        authorId: req.user?.id || 1,
                        signedById: meta.approvedById || req.user?.id || 1,
                        status: 'SIGNED',
                        signedAt: meta.approvedAt ? new Date(meta.approvedAt) : new Date(),
                        party1Name: meta.approvedByName || 'Ravi Kurnia, S.Pd.I',
                        party1Title: 'Kepala Bidang Sarana',
                        party1Org: 'Bidang Sarana dan Prasarana',
                        party2Name: resolvedVendorName || 'Vendor Rekanan',
                        party2Title: 'Pihak Rekanan / Supplier',
                        party2Address: resolvedVendorAddress,
                        party2Org: resolvedVendorName || '',
                        content: JSON.stringify(contentObj)
                    }
                });

                if (newOfficeDoc.uuid) {
                    await prisma.officeDocument.update({
                        where: { id: newOfficeDoc.id },
                        data: { qrCodeData: newOfficeDoc.uuid }
                    });
                }
                officeDocId = newOfficeDoc.id;
            }
        } catch (docErr) {
            console.error('Failed to create/update office document for PO:', docErr);
        }

        const updatedMeta = {
            ...meta,
            poNumber,
            poDate: new Date().toISOString(),
            poOfficeDocId: officeDocId,
            poVendorName: resolvedVendorName || 'Vendor Rekanan',
            poVendorAddress: resolvedVendorAddress,
            poVendorPhone: resolvedVendorPhone,
            poGrandTotal: grandTotal,
            poDeadline: deadline || meta.targetDate || ''
        };

        // Update project status to BERJALAN
        const updatedProj = await prisma.invProject.update({
            where: { id: projectId },
            data: {
                status: 'BERJALAN',
                note: serializeProjectMetadata(text, updatedMeta)
            }
        });

        res.json({
            message: 'Surat Pesanan (PO) resmi berhasil diterbitkan dan tersinkron ke E-Office',
            poNumber,
            officeDocId,
            project: {
                ...updatedProj,
                note: text,
                ...updatedMeta
            }
        });
    } catch (error) {
        console.error('Create PO Error:', error);
        res.status(500).json({ error: error.message || 'Gagal menerbitkan Surat Pesanan' });
    }
};

// --- PENERIMAAN BARANG & BAST GUDANG ---
exports.receiveProjectGoods = async (req, res) => {
    try {
        const projectId = parseInt(req.params.id, 10);
        const { warehouseId, items, isFinal, conditionNotes, vendorName, receiverName } = req.body;

        if (!warehouseId) {
            return res.status(400).json({ error: 'Gudang penyimpanan wajib dipilih' });
        }

        const project = await prisma.invProject.findUnique({
            where: { id: projectId },
            include: {
                projectItems: { include: { item: { include: { category: true } } } },
                vendorSelections: { include: { vendor: true } }
            }
        });

        if (!project) throw new Error('Proyek tidak ditemukan');

        const { text, meta } = parseProjectMetadata(project.note);

        const year = new Date().getFullYear();
        const prefix = `TRX/INV/${year}/`;
        const existingTxs = await prisma.invStockTransaction.findMany({
            where: { code: { startsWith: prefix } },
            select: { code: true }
        });
        let maxSeq = 0;
        for (const t of existingTxs) {
            const parts = t.code.split('/');
            if (parts.length === 4) {
                const seq = parseInt(parts[3], 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
        }

        if (Array.isArray(items)) {
            for (const it of items) {
                const itemId = parseInt(it.itemId, 10);
                const quantity = parseInt(it.quantity, 10);

                if (itemId && quantity > 0) {
                    // 1. Update receivedQuantity di InvProjectItem
                    const pi = await prisma.invProjectItem.findUnique({
                        where: {
                            projectId_itemId: { projectId, itemId }
                        }
                    });

                    if (pi) {
                        await prisma.invProjectItem.update({
                            where: { id: pi.id },
                            data: { receivedQuantity: { increment: quantity } }
                        });
                    }

                    // 2. Increment stock di Gudang Logistik
                    await prisma.invStock.upsert({
                        where: {
                            itemId_warehouseId: {
                                itemId,
                                warehouseId: parseInt(warehouseId, 10)
                            }
                        },
                        create: {
                            itemId,
                            warehouseId: parseInt(warehouseId, 10),
                            quantity
                        },
                        update: {
                            quantity: { increment: quantity }
                        }
                    });

                    // 3. Catat Riwayat Transaksi Stok Masuk (IN)
                    maxSeq++;
                    const txCode = `${prefix}${maxSeq.toString().padStart(4, '0')}`;
                    await prisma.invStockTransaction.create({
                        data: {
                            code: txCode,
                            type: 'IN',
                            date: new Date(),
                            itemId,
                            warehouseId: parseInt(warehouseId, 10),
                            quantity,
                            note: `Penerimaan Barang Proyek: ${project.title || project.name} (${it.condition || 'Baik'})`,
                            createdById: req.user?.id || 1
                        }
                    });
                }
            }
        }

        // 4. Penerbitan Dokumen BAST Resmi & Sinkron ke E-Office
        let bastNumber = meta.bastNumber;
        let bastDocId = meta.bastOfficeDocId;

        try {
            if (!bastNumber) {
                bastNumber = await generateDocumentNumber('BAST', 'BAST');
            }

            const bastItems = (items || []).map(it => {
                const foundPi = project.projectItems.find(p => p.itemId === it.itemId);
                return {
                    name: foundPi?.item?.name || it.name || 'Barang Logistik',
                    spec: foundPi?.item?.code ? `${foundPi.item.code} (${foundPi.item?.category?.name || 'Logistik'})` : '-',
                    qty: it.quantity,
                    unit: foundPi?.item?.unit || 'Pcs',
                    condition: it.condition || 'Baik & Lengkap',
                    note: it.note || ''
                };
            });

            const resolvedVendor = vendorName || meta.poVendorName || 'Vendor Rekanan';
            const resolvedReceiver = receiverName || req.user?.name || 'Staff Gudang Logistik';

            const contentObj = {
                location: 'Gudang Logistik Yayasan Dar el-Iman',
                items: bastItems,
                projectTitle: project.title || project.name,
                projectId: project.id,
                conditionSummary: conditionNotes || 'Barang telah diperiksa fisik dalam kondisi baik dan lengkap sesuai Surat Pesanan.',
                pembukaan: `Pada hari ini, bertempat di Gudang Logistik Yayasan Dar el-Iman, telah dilaksanakan serah terima barang pengadaan logistik antara pihak-pihak terkait.`,
                penutup: 'Demikian Berita Acara Serah Terima (BAST) ini dibuat dan ditandatangani oleh para pihak dengan sadar dan tanpa paksaan dari pihak manapun.'
            };

            if (bastDocId) {
                await prisma.officeDocument.update({
                    where: { id: bastDocId },
                    data: {
                        party1Name: resolvedVendor,
                        party2Name: resolvedReceiver,
                        content: JSON.stringify(contentObj)
                    }
                });
            } else {
                const officeDoc = await prisma.officeDocument.create({
                    data: {
                        type: 'SURAT_KELUAR',
                        category: 'BAST',
                        subject: `Berita Acara Serah Terima (BAST) - ${project.title || project.name} (${resolvedVendor})`,
                        number: bastNumber,
                        date: new Date(),
                        referenceNumber: `BAST-LOG-${project.id}`,
                        authorId: req.user?.id || 1,
                        signedById: meta.approvedById || req.user?.id || 1,
                        status: 'SIGNED',
                        signedAt: new Date(),
                        party1Name: resolvedVendor,
                        party1Title: 'Penyedia Barang / Vendor',
                        party2Name: resolvedReceiver,
                        party2Title: 'Staff Bagian Gudang dan Logistik',
                        party2Org: 'Bidang Sarana',
                        content: JSON.stringify(contentObj)
                    }
                });

                if (officeDoc.uuid) {
                    await prisma.officeDocument.update({
                        where: { id: officeDoc.id },
                        data: { qrCodeData: officeDoc.uuid }
                    });
                }
                bastDocId = officeDoc.id;
            }
        } catch (bastErr) {
            console.error('Failed to generate BAST office document:', bastErr);
        }

        const updatedItems = await prisma.invProjectItem.findMany({ where: { projectId } });
        const allReceived = updatedItems.length > 0 && updatedItems.every(i => i.receivedQuantity >= i.quantity);

        const newProjectStatus = (isFinal || allReceived) ? 'SELESAI' : 'BERJALAN';

        const updatedMeta = {
            ...meta,
            bastNumber,
            bastDate: new Date().toISOString(),
            bastOfficeDocId: bastDocId
        };

        const updatedProj = await prisma.invProject.update({
            where: { id: projectId },
            data: {
                status: newProjectStatus,
                note: serializeProjectMetadata(text, updatedMeta)
            }
        });

        res.json({
            message: 'Barang proyek logistik berhasil diterima, stok gudang telah diupdate, dan BAST resmi telah terbit.',
            bastNumber,
            bastDocId,
            project: {
                ...updatedProj,
                note: text,
                ...updatedMeta
            }
        });
    } catch (error) {
        console.error('Receive Project Goods Error:', error);
        res.status(500).json({ error: error.message || 'Gagal mencatat penerimaan barang' });
    }
};

// ==========================================
// VENDOR SELECTIONS, MOUs, EVALUATIONS
// ==========================================

// --- SELEKSI VENDOR ---
exports.getVendorSelections = async (req, res) => {
    try {
        const { projectId, vendorId } = req.query;
        let whereClause = {};
        if (projectId) whereClause.projectId = parseInt(projectId);
        if (vendorId) whereClause.vendorId = parseInt(vendorId);

        const selections = await prisma.invVendorSelection.findMany({
            where: whereClause,
            include: { project: true, vendor: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(selections);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch vendor selections' });
    }
};

exports.createVendorSelection = async (req, res) => {
    try {
        const { projectId, vendorId, proposedPrice, status, reason } = req.body;
        let proposalFileUrl = req.body.proposalFileUrl || null;
        if (req.file) {
            proposalFileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const pId = parseInt(projectId, 10);
        const vId = parseInt(vendorId, 10);

        if (!pId || isNaN(pId)) {
            return res.status(400).json({ error: 'Proyek wajib dipilih' });
        }
        if (!vId || isNaN(vId)) {
            return res.status(400).json({ error: 'Vendor wajib dipilih' });
        }

        // Cek apakah sudah ada seleksi untuk project dan vendor ini (unique constraint)
        const existing = await prisma.invVendorSelection.findUnique({
            where: {
                projectId_vendorId: { projectId: pId, vendorId: vId }
            }
        });

        let selection;
        if (existing) {
            selection = await prisma.invVendorSelection.update({
                where: { id: existing.id },
                data: {
                    proposedPrice: proposedPrice !== undefined && proposedPrice !== '' ? parseFloat(proposedPrice) : existing.proposedPrice,
                    status: status || existing.status,
                    reason: reason !== undefined ? reason : existing.reason,
                    ...(proposalFileUrl ? { proposalFileUrl } : {})
                },
                include: { project: true, vendor: true }
            });
        } else {
            selection = await prisma.invVendorSelection.create({
                data: {
                    projectId: pId,
                    vendorId: vId,
                    proposedPrice: proposedPrice !== undefined && proposedPrice !== '' ? parseFloat(proposedPrice) : 0,
                    status: status || 'MENUNGGU',
                    reason: reason || null,
                    proposalFileUrl
                },
                include: { project: true, vendor: true }
            });
        }

        // Jika status DIPILIH (penunjukan vendor), update status proyek ke BERJALAN jika masih PERENCANAAN atau SELEKSI
        if (status === 'DIPILIH') {
            const proj = await prisma.invProject.findUnique({ where: { id: pId } });
            if (proj && (proj.status === 'PERENCANAAN' || proj.status === 'SELEKSI')) {
                await prisma.invProject.update({
                    where: { id: pId },
                    data: { status: 'BERJALAN' }
                });
            }
        }

        res.status(201).json(selection);
    } catch (error) {
        console.error('createVendorSelection error:', error);
        res.status(500).json({ error: error.message || 'Failed to create vendor selection' });
    }
};

exports.updateVendorSelection = async (req, res) => {
    try {
        const { id } = req.params;
        const { proposedPrice, status, reason } = req.body;
        let proposalFileUrl = req.body.proposalFileUrl;
        if (req.file) {
            proposalFileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const updateData = {};
        if (proposedPrice !== undefined && proposedPrice !== '') updateData.proposedPrice = parseFloat(proposedPrice);
        if (status) updateData.status = status;
        if (reason !== undefined) updateData.reason = reason;
        if (proposalFileUrl) updateData.proposalFileUrl = proposalFileUrl;

        const selection = await prisma.invVendorSelection.update({
            where: { id: parseInt(id, 10) },
            data: updateData,
            include: { project: true, vendor: true }
        });

        if (status === 'DIPILIH' && selection.projectId) {
            const proj = await prisma.invProject.findUnique({ where: { id: selection.projectId } });
            if (proj && (proj.status === 'PERENCANAAN' || proj.status === 'SELEKSI')) {
                await prisma.invProject.update({
                    where: { id: selection.projectId },
                    data: { status: 'BERJALAN' }
                });
            }
        }

        res.json(selection);
    } catch (error) {
        console.error('updateVendorSelection error:', error);
        res.status(500).json({ error: error.message || 'Failed to update vendor selection' });
    }
};

exports.deleteVendorSelection = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.invVendorSelection.delete({ where: { id: parseInt(id, 10) } });
        res.json({ message: 'Deleted' });
    } catch (error) {
        console.error('deleteVendorSelection error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete' });
    }
};

// --- MoU VENDOR ---
exports.getVendorMoUs = async (req, res) => {
    try {
        const { projectId, vendorId } = req.query;
        let whereClause = {};
        if (projectId) whereClause.projectId = parseInt(projectId, 10);
        if (vendorId) whereClause.vendorId = parseInt(vendorId, 10);

        const mous = await prisma.invVendorMoU.findMany({
            where: whereClause,
            include: { project: true, vendor: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(mous);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch MoUs' });
    }
};

exports.createVendorMoU = async (req, res) => {
    try {
        const { projectId, vendorId, mouNumber, startDate, endDate, status } = req.body;
        let fileUrl = req.body.fileUrl || null;
        if (req.file) {
            fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const pId = parseInt(projectId, 10);
        const vId = parseInt(vendorId, 10);

        if (!pId || isNaN(pId)) return res.status(400).json({ error: 'Proyek wajib dipilih' });
        if (!vId || isNaN(vId)) return res.status(400).json({ error: 'Vendor wajib dipilih' });
        if (!mouNumber) return res.status(400).json({ error: 'Nomor MoU wajib diisi' });

        const mou = await prisma.invVendorMoU.create({
            data: {
                projectId: pId,
                vendorId: vId,
                mouNumber,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : new Date(),
                status: status || 'DRAFT',
                fileUrl
            },
            include: { project: true, vendor: true }
        });
        res.status(201).json(mou);
    } catch (error) {
        console.error('createVendorMoU error:', error);
        res.status(500).json({ error: error.message || 'Failed to create MoU' });
    }
};

exports.updateVendorMoU = async (req, res) => {
    try {
        const { id } = req.params;
        const { mouNumber, startDate, endDate, status } = req.body;
        let fileUrl = req.body.fileUrl;
        if (req.file) {
            fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const data = {};
        if (mouNumber) data.mouNumber = mouNumber;
        if (startDate) data.startDate = new Date(startDate);
        if (endDate) data.endDate = new Date(endDate);
        if (status) data.status = status;
        if (fileUrl !== undefined) data.fileUrl = fileUrl;

        const mou = await prisma.invVendorMoU.update({
            where: { id: parseInt(id, 10) },
            data,
            include: { project: true, vendor: true }
        });
        res.json(mou);
    } catch (error) {
        console.error('updateVendorMoU error:', error);
        res.status(500).json({ error: error.message || 'Failed to update MoU' });
    }
};

exports.deleteVendorMoU = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.invVendorMoU.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete MoU' });
    }
};

// --- EVALUASI VENDOR ---
exports.getVendorEvaluations = async (req, res) => {
    try {
        const { projectId, vendorId } = req.query;
        let whereClause = {};
        if (projectId) whereClause.projectId = parseInt(projectId);
        if (vendorId) whereClause.vendorId = parseInt(vendorId);

        const evals = await prisma.invVendorEvaluation.findMany({
            where: whereClause,
            include: { project: true, vendor: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(evals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch evaluations' });
    }
};

exports.createVendorEvaluation = async (req, res) => {
    try {
        const { projectId, vendorId, rating, onTimeRate, rejectRate, notes } = req.body;
        const evalRecord = await prisma.invVendorEvaluation.create({
            data: {
                projectId: parseInt(projectId),
                vendorId: parseInt(vendorId),
                rating: parseFloat(rating) || 0,
                onTimeRate: parseFloat(onTimeRate) || 0,
                rejectRate: parseFloat(rejectRate) || 0,
                notes
            }
        });
        
        // Auto-update average rating vendor
        await updateVendorAverages(vendorId);

        res.status(201).json(evalRecord);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create evaluation' });
    }
};

exports.updateVendorEvaluation = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, onTimeRate, rejectRate, notes } = req.body;
        
        const evalRecord = await prisma.invVendorEvaluation.update({
            where: { id: parseInt(id) },
            data: {
                rating: parseFloat(rating),
                onTimeRate: parseFloat(onTimeRate),
                rejectRate: parseFloat(rejectRate),
                notes
            }
        });

        await updateVendorAverages(evalRecord.vendorId);

        res.json(evalRecord);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update evaluation' });
    }
};

exports.deleteVendorEvaluation = async (req, res) => {
    try {
        const { id } = req.params;
        const evalRecord = await prisma.invVendorEvaluation.findUnique({ where: { id: parseInt(id) } });
        await prisma.invVendorEvaluation.delete({ where: { id: parseInt(id) } });
        
        if (evalRecord) {
            await updateVendorAverages(evalRecord.vendorId);
        }

        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete evaluation' });
    }
};

async function updateVendorAverages(vendorId) {
    const evals = await prisma.invVendorEvaluation.findMany({ where: { vendorId: parseInt(vendorId) } });
    if (evals.length === 0) {
        await prisma.invVendor.update({
            where: { id: parseInt(vendorId) },
            data: { rating: 0, onTimeRate: 0, rejectRate: 0, totalOrders: 0 }
        });
        return;
    }

    const avgRating = evals.reduce((sum, e) => sum + e.rating, 0) / evals.length;
    const avgOnTime = evals.reduce((sum, e) => sum + e.onTimeRate, 0) / evals.length;
    const avgReject = evals.reduce((sum, e) => sum + e.rejectRate, 0) / evals.length;

    await prisma.invVendor.update({
        where: { id: parseInt(vendorId) },
        data: {
            rating: avgRating,
            onTimeRate: avgOnTime,
            rejectRate: avgReject,
            totalOrders: evals.length // Assumption: each project eval = 1 order
        }
    });
}

// ==========================================
// IMPORT & TEMPLATE PROYEK PENGADAAN (EXCEL)
// ==========================================

exports.downloadProjectTemplate = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        
        // Sheet 1: Daftar Barang Pesanan (Hanya daftar barang & kuantitas)
        const sheet = workbook.addWorksheet('Daftar_Barang_Pesanan');

        sheet.columns = [
            { header: 'Nama Barang (Pilih dari Dropdown) *', key: 'itemName', width: 45 },
            { header: 'Kuantitas *', key: 'quantity', width: 20 }
        ];

        // Style header Sheet 1
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E40AF' } // Blue-800
        };
        sheet.getRow(1).height = 28;
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Sheet 2: Master Barang (Untuk Referensi & Dropdown Excel)
        const masterSheet = workbook.addWorksheet('Master_Barang');
        masterSheet.columns = [
            { header: 'Nama Barang (Master Data)', key: 'name', width: 40 },
            { header: 'Kode Barang', key: 'code', width: 20 },
            { header: 'Kategori', key: 'category', width: 25 },
            { header: 'Satuan', key: 'unit', width: 15 }
        ];

        masterSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        masterSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF334155' } // Slate-700
        };

        // Ambil data barang dari master database
        const allItems = await prisma.invItem.findMany({
            select: { 
                id: true, 
                code: true, 
                name: true, 
                unit: true,
                category: { select: { name: true } }
            },
            orderBy: { name: 'asc' }
        });

        if (allItems.length > 0) {
            allItems.forEach(it => {
                masterSheet.addRow({
                    name: it.name,
                    code: it.code || '-',
                    category: it.category?.name || 'Umum',
                    unit: it.unit || 'Pcs'
                });
            });
        } else {
            // Fallback placeholder jika database kosong
            masterSheet.addRow({
                name: 'Kertas HVS A4 70gr',
                code: 'LOG-ATK-001',
                category: 'ATK',
                unit: 'Rim'
            });
            masterSheet.addRow({
                name: 'Spidol Whiteboard Hitam',
                code: 'LOG-ATK-002',
                category: 'ATK',
                unit: 'Pcs'
            });
        }

        const totalMasterRows = Math.max(allItems.length, 2);

        // Pasang Dropdown Data Validation pada Sheet 1 Kolom A (Nama Barang)
        for (let r = 2; r <= 500; r++) {
            const cellA = sheet.getCell(`A${r}`);
            cellA.dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`Master_Barang!$A$2:$A$${totalMasterRows + 1}`],
                showErrorMessage: true,
                errorTitle: 'Barang Tidak Valid',
                error: 'Harap pilih nama barang yang tersedia pada dropdown Master Data.'
            };

            const cellB = sheet.getCell(`B${r}`);
            cellB.dataValidation = {
                type: 'whole',
                operator: 'greaterThan',
                allowBlank: true,
                formulae: [0],
                showErrorMessage: true,
                errorTitle: 'Kuantitas Tidak Valid',
                error: 'Kuantitas pesanan harus berupa bilangan bulat lebih dari 0.'
            };
        }

        // Tambahkan baris contoh (Sample Data)
        if (allItems.length >= 2) {
            sheet.addRow({ itemName: allItems[0].name, quantity: 20 });
            sheet.addRow({ itemName: allItems[1].name, quantity: 50 });
        } else if (allItems.length === 1) {
            sheet.addRow({ itemName: allItems[0].name, quantity: 20 });
        } else {
            sheet.addRow({ itemName: 'Kertas HVS A4 70gr', quantity: 20 });
            sheet.addRow({ itemName: 'Spidol Whiteboard Hitam', quantity: 50 });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Template_Daftar_Barang_Logistik.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download Project Template Error:', error);
        res.status(500).json({ error: error.message || 'Gagal mendownload template daftar barang logistik' });
    }
};

exports.importProjects = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'File Excel belum dipilih' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

        if (!rawData || rawData.length === 0) {
            return res.status(400).json({ error: 'File Excel tidak memuat baris barang yang dapat dibaca' });
        }

        const allItems = await prisma.invItem.findMany({
            select: { id: true, code: true, name: true, unit: true, category: { select: { name: true } } }
        });

        const normalize = (str) => (str || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

        const itemMap = new Map();
        for (const it of allItems) {
            if (it.name) itemMap.set(normalize(it.name), it);
            if (it.code) itemMap.set(normalize(it.code), it);
        }

        const parseDate = (val) => {
            if (!val) return null;
            if (val instanceof Date) return val.toISOString();
            if (typeof val === 'number') {
                const d = new Date(Math.round((val - 25569) * 86400 * 1000));
                return !isNaN(d.getTime()) ? d.toISOString() : null;
            }
            const d = new Date(val);
            return !isNaN(d.getTime()) ? d.toISOString() : null;
        };

        const errors = [];
        const parsedItems = [];

        rawData.forEach((row, idx) => {
            const rowNum = idx + 2;

            // Ekstrak nama barang
            const itemNameRaw = (
                row['Nama Barang (Pilih dari Dropdown) *'] ||
                row['Nama Barang (Pilih dari Dropdown)'] ||
                row['Nama Barang *'] || 
                row['Nama Barang'] || 
                row['nama_barang'] || 
                row['Kode / Nama Barang *'] || 
                row['Kode / Nama Barang'] || 
                row['Barang'] || 
                row['itemName'] || 
                row['itemQuery'] || ''
            ).toString().trim();

            if (!itemNameRaw) {
                // Abaikan baris kosong tanpa nama barang
                return;
            }

            // Ekstrak kuantitas
            const qtyRaw = parseInt(
                row['Kuantitas *'] || 
                row['Kuantitas'] || 
                row['kuantitas'] || 
                row['Jumlah Target *'] || 
                row['Jumlah Target'] || 
                row['Jumlah Pesanan *'] ||
                row['Jumlah Pesanan'] ||
                row['Jumlah'] || 
                row['quantity'] || 
                row['qty'], 
                10
            );

            if (isNaN(qtyRaw) || qtyRaw <= 0) {
                errors.push(`Baris ${rowNum}: Kuantitas barang "${itemNameRaw}" tidak valid atau kurang dari 1.`);
                return;
            }

            const matchedItem = itemMap.get(normalize(itemNameRaw));
            if (!matchedItem) {
                errors.push(`Baris ${rowNum}: Barang "${itemNameRaw}" tidak sesuai dengan Master Data.`);
                return;
            }

            parsedItems.push({
                itemId: matchedItem.id,
                name: matchedItem.name,
                unit: matchedItem.unit || 'Pcs',
                quantity: qtyRaw
            });
        });

        if (parsedItems.length === 0) {
            return res.status(400).json({ 
                error: 'Tidak ada daftar barang pesanan valid yang dapat diproses.', 
                errors 
            });
        }

        // Gabungkan item yang sama (sum quantities)
        const aggregatedItemMap = new Map();
        parsedItems.forEach(it => {
            const current = aggregatedItemMap.get(it.itemId) || { itemId: it.itemId, quantity: 0, name: it.name, unit: it.unit };
            current.quantity += it.quantity;
            aggregatedItemMap.set(it.itemId, current);
        });

        const finalItems = Array.from(aggregatedItemMap.values());
        const totalQty = finalItems.reduce((sum, it) => sum + it.quantity, 0);

        // Cek apakah import ini untuk Proyek yang sudah ada (projectId) atau Proyek Baru
        const targetProjectId = parseInt(req.body.projectId || req.query.projectId, 10);

        if (targetProjectId) {
            // Tambahkan / gabungkan ke proyek yang sudah ada
            const existingProject = await prisma.invProject.findUnique({
                where: { id: targetProjectId },
                include: { projectItems: true }
            });

            if (!existingProject) {
                return res.status(404).json({ error: 'Proyek tujuan tidak ditemukan.' });
            }

            await prisma.$transaction(async (tx) => {
                for (const it of finalItems) {
                    const existingPI = existingProject.projectItems.find(pi => pi.itemId === it.itemId);
                    if (existingPI) {
                        await tx.invProjectItem.update({
                            where: { id: existingPI.id },
                            data: { quantity: existingPI.quantity + it.quantity }
                        });
                    } else {
                        await tx.invProjectItem.create({
                            data: {
                                projectId: targetProjectId,
                                itemId: it.itemId,
                                quantity: it.quantity
                            }
                        });
                    }
                }

                // Update total targetQuantity pada proyek
                const allCurrentItems = await tx.invProjectItem.findMany({
                    where: { projectId: targetProjectId }
                });
                const newTotal = allCurrentItems.reduce((acc, curr) => acc + curr.quantity, 0);
                await tx.invProject.update({
                    where: { id: targetProjectId },
                    data: { targetQuantity: newTotal }
                });
            });

            return res.json({
                message: `Berhasil menambahkan ${finalItems.length} jenis barang pesanan ke Proyek "${existingProject.title}".`,
                successCount: 1,
                totalItemsCount: finalItems.length,
                totalQuantity: totalQty,
                errorCount: errors.length,
                errors,
                project: existingProject
            });
        }

        // BUAT PROYEK BARU DENGAN DAFTAR BARANG IMPORT
        const title = (req.body.title || `Pengadaan Logistik - ${new Date().toLocaleDateString('id-ID')}`).trim();
        const year = parseInt(req.body.year, 10) || new Date().getFullYear();
        const type = (req.body.projectType || req.body.type || 'SELEKSI').toUpperCase() === 'PENUNJUKAN_LANGSUNG' ? 'PENUNJUKAN_LANGSUNG' : 'SELEKSI';
        const budget = parseFloat(req.body.budget) || 0;
        const requestedByName = (req.body.requestedByName || req.user?.name || 'Staff Bagian Sarana').trim();
        const targetDate = parseDate(req.body.targetDate);
        const justification = (req.body.justification || 'Usulan pengadaan barang logistik melalui import Excel').trim();
        const directVendorId = parseInt(req.body.directVendorId, 10) || null;

        const meta = {
            approvalStatus: 'PENDING',
            requestedByName,
            justification,
            targetDate,
            budget,
            projectType: type
        };

        const serializedNote = serializeProjectMetadata(justification, meta);

        let createdProject;
        await prisma.$transaction(async (tx) => {
            createdProject = await tx.invProject.create({
                data: {
                    title,
                    name: title,
                    year,
                    type,
                    budget,
                    targetQuantity: totalQty,
                    status: 'MENUNGGU_PERSETUJUAN',
                    note: serializedNote,
                    projectItems: {
                        create: finalItems.map(it => ({
                            itemId: it.itemId,
                            quantity: it.quantity
                        }))
                    }
                }
            });

            if (type === 'PENUNJUKAN_LANGSUNG' && directVendorId) {
                await tx.invVendorSelection.create({
                    data: {
                        projectId: createdProject.id,
                        vendorId: directVendorId,
                        status: 'DIPILIH',
                        reason: 'Penunjukan Langsung (Import Proyek)'
                    }
                });
            }
        });

        res.json({
            message: `Berhasil membuat proyek pengadaan baru "${createdProject.title}" dengan ${finalItems.length} item pesanan (${totalQty} total unit). Status: Menunggu Persetujuan Kabid Sarana.`,
            successCount: 1,
            totalItemsCount: finalItems.length,
            totalQuantity: totalQty,
            errorCount: errors.length,
            errors,
            project: createdProject
        });
    } catch (error) {
        console.error('Import Projects Error:', error);
        res.status(500).json({ error: error.message || 'Gagal memproses import daftar barang logistik' });
    }
};
