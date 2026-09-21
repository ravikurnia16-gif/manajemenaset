import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ClipboardCheck, ArrowLeft, Scan, Search, MapPin, 
    ShieldCheck, AlertTriangle, HelpCircle, Save, X, Camera,
    CheckCircle2, AlertCircle, Info, RefreshCcw, Plus,
    Printer, Upload, Image as ImageIcon, ExternalLink,
    CheckCheck, FileText, Check, Eye
} from 'lucide-react';
import { Html5Qrcode } from "html5-qrcode";
import ExcelJS from 'exceljs';
import api from '../lib/axios';

/* ── jsPDF + autoTable CDN loader ── */
function loadJsPDF() {
    return new Promise((resolve) => {
        if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = () => {
            const s2 = document.createElement('script');
            s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
            s2.onload = () => resolve(window.jspdf.jsPDF);
            document.head.appendChild(s2);
        };
        document.head.appendChild(s);
    });
}

// Helper Components
const ChevronRight = ({className, size}) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

const AuditSessionDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('PENDING'); // PENDING, FOUND, MISSING
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [roomFilter, setRoomFilter] = useState('');
    const [allRooms, setAllRooms] = useState([]);
    
    // Scanner State (Camera QR)
    const [showScanner, setShowScanner] = useState(false);
    
    // Verification Form State
    const [selectedItem, setSelectedItem] = useState(null);
    const [form, setForm] = useState({
        condition: 'BAIK',
        note: '',
        status: 'FOUND',
        foundLocationId: '',
        image: ''
    });
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
    const fileInputRef = useRef(null);

    // Finalize Modal State
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [autoMarkMissing, setAutoMarkMissing] = useState(true);
    const [finalizing, setFinalizing] = useState(false);
    
    // Unexpected Item Form
    const [showUnexpectedModal, setShowUnexpectedModal] = useState(false);
    const [unexpectedForm, setUnexpectedForm] = useState({ itemName: '', note: '' });

    // Toast notification state
    const [toastMessage, setToastMessage] = useState(null);
    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    const fetchSession = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/audit/${id}`);
            setSession(res.data);
            const roomsRes = await api.get('/master/rooms');
            setAllRooms(roomsRes.data || []);
        } catch (e) { 
            console.error('Error fetching audit session:', e); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { 
        fetchSession(); 
    }, [id]);

    // ── Physical Barcode Gun Scanner Listener (USB / Bluetooth) ──
    useEffect(() => {
        let buffer = '';
        let lastKeyTime = Date.now();

        const handleKeyDown = (e) => {
            // Ignore if user is actively typing in a form input or textarea
            const targetTag = e.target?.tagName?.toLowerCase();
            if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
                return;
            }

            const currentTime = Date.now();
            if (currentTime - lastKeyTime > 150) {
                buffer = ''; // timeout: reset buffer
            }
            lastKeyTime = currentTime;

            if (e.key === 'Enter') {
                if (buffer.length >= 3 && session?.items) {
                    const scannedCode = buffer.trim();
                    const item = session.items.find(i => 
                        i.asset.code?.toLowerCase() === scannedCode.toLowerCase()
                    );
                    if (item) {
                        setSelectedItem(item);
                        setForm({ 
                            condition: item.foundCondition || item.asset.condition || 'BAIK', 
                            note: item.notes || '', 
                            status: 'FOUND',
                            foundLocationId: item.foundLocationId || item.asset.roomId || '',
                            image: item.image || ''
                        });
                        showToast(`Scanner terdeteksi: ${item.asset.name} (${item.asset.code})`);
                    } else {
                        showToast(`Kode "${scannedCode}" tidak ditemukan dalam sesi ini.`);
                    }
                }
                buffer = '';
            } else if (e.key.length === 1) {
                buffer += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [session]);

    // ── Camera Scanner ──
    useEffect(() => {
        let html5QrCode;
        if (showScanner) {
            html5QrCode = new Html5Qrcode("reader");
            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 250 }
            };

            const startScanner = async () => {
                try {
                    await html5QrCode.start(
                        { facingMode: "environment" }, 
                        config, 
                        (decodedText) => {
                            handleScan(decodedText);
                        }
                    );
                } catch (err) {
                    console.error("Scanner start error:", err);
                    alert("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
                    setShowScanner(false);
                }
            };

            startScanner();

            return () => {
                if (html5QrCode && html5QrCode.isScanning) {
                    html5QrCode.stop().catch(err => console.error("Scanner stop error:", err));
                }
            };
        }
    }, [showScanner]);

    const handleScan = async (code) => {
        const item = session.items.find(i => i.asset.code === code);
        if (!item) {
            alert('Aset dengan kode ' + code + ' tidak terdaftar dalam sesi audit ini.');
            return;
        }
        setSelectedItem(item);
        setForm({ 
            condition: item.foundCondition || item.asset.condition || 'BAIK', 
            note: item.notes || '', 
            status: 'FOUND',
            foundLocationId: item.foundLocationId || item.asset.roomId || '',
            image: item.image || ''
        });
        setShowScanner(false);
    };

    // ── Photo Upload to MinIO with Sharp Compression ──
    const handlePhotoFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validasi tipe file
        if (!file.type.startsWith('image/')) {
            alert('Silakan pilih file gambar (JPG, PNG, WebP).');
            return;
        }

        const formData = new FormData();
        formData.append('photo', file);

        try {
            setUploadingPhoto(true);
            const res = await api.post('/audit/upload-photo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Result is compressed and saved to MinIO, returning proxy URL /api/media/audit/...
            setForm(prev => ({ ...prev, image: res.data.url }));
            showToast('Foto berhasil dikompres & disimpan ke MinIO');
        } catch (err) {
            console.error('Photo upload error:', err);
            alert(err.response?.data?.error || 'Gagal mengunggah foto ke MinIO');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        try {
            await api.post('/audit/verify', {
                sessionId: id,
                assetCode: selectedItem.asset.code,
                status: form.status,
                condition: form.condition,
                note: form.note,
                foundLocationId: form.foundLocationId,
                image: form.image
            });
            setSelectedItem(null);
            fetchSession();
            showToast('Hasil verifikasi aset berhasil disimpan');
        } catch (e) { 
            alert(e.response?.data?.error || 'Gagal memverifikasi aset'); 
        }
    };

    // ── Bulk Approve Reconcile (Setujui Semua yang Ditemukan) ──
    const handleBulkApproveFound = async () => {
        const foundCount = session.items.filter(i => i.status === 'FOUND').length;
        if (foundCount === 0) {
            alert('Belum ada aset berstatus ADA / DITEMUKAN untuk disetujui.');
            return;
        }
        if (!confirm(`Setujui seluruh ${foundCount} aset yang berstatus DITEMUKAN untuk sinkronisasi ke database master?`)) {
            return;
        }
        try {
            await api.post('/audit/bulk-approve-reconcile', {
                sessionId: id,
                approved: true
            });
            fetchSession();
            showToast(`Berhasil menyetujui ${foundCount} aset untuk rekonsiliasi`);
        } catch (e) {
            alert(e.response?.data?.error || 'Gagal menyetujui aset secara masal');
        }
    };

    // ── Finalize Audit Session ──
    const executeFinalize = async () => {
        try {
            setFinalizing(true);
            const res = await api.post(`/audit/${id}/finalize`, {
                autoMarkMissing: stats.pending > 0 ? autoMarkMissing : false
            });
            setShowFinalizeModal(false);
            fetchSession();
            showToast(res.data?.message || 'Audit berhasil difinalisasi!');
        } catch (e) { 
            alert(e.response?.data?.error || 'Gagal finalisasi audit'); 
        } finally {
            setFinalizing(false);
        }
    };

    const handleBulkAction = async (status) => {
        if (!selectedIds.length) return;
        if (!confirm(`Tandai ${selectedIds.length} aset terpilih sebagai ${status === 'FOUND' ? 'ADA' : 'HILANG'}?`)) return;
        try {
            await api.post('/audit/bulk-verify', {
                sessionId: id,
                itemIds: selectedIds,
                status
            });
            setSelectedIds([]);
            fetchSession();
            showToast(`${selectedIds.length} aset berhasil diperbarui`);
        } catch (e) { 
            alert('Gagal memproses masal'); 
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredItems.length && selectedIds.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredItems.map(i => i.id));
        }
    };

    const handleApprove = async (itemId, approved) => {
        try {
            await api.post('/audit/approve-item', { id: itemId, approved });
            fetchSession();
        } catch (e) { 
            alert('Gagal memproses persetujuan'); 
        }
    };

    const handleAddUnexpected = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/audit/${id}/unexpected`, unexpectedForm);
            setUnexpectedForm({ itemName: '', note: '' });
            setShowUnexpectedModal(false);
            fetchSession();
            showToast('Aset temuan baru berhasil dicatat');
        } catch (e) { 
            alert(e.response?.data?.error || 'Gagal mencatat temuan'); 
        }
    };

    // ── Export to Excel ──
    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Stock Opname');

        const titleStyle = { font: { bold: true, size: 14 } };
        const headerStyle = { 
            font: { bold: true, color: { argb: 'FFFFFF' } }, 
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } }, 
            alignment: { horizontal: 'center' } 
        };

        worksheet.addRow(['BERITA ACARA HASIL PEMERIKSAAN FISIK ASET (STOCK OPNAME)']).style = titleStyle;
        worksheet.addRow(['BIDANG SARANA - YAYASAN DAR EL-IMAN']);
        worksheet.addRow(['Nama Sesi:', session.title]);
        worksheet.addRow(['Tanggal Audit:', new Date(session.createdAt).toLocaleDateString('id-ID')]);
        worksheet.addRow(['Auditor / Pembuat:', session.creator?.name || 'Admin']);
        worksheet.addRow(['Status Sesi:', session.status]);
        worksheet.addRow([]);

        // Narrative Summary
        const narrativeRow = worksheet.addRow([generateNarrative()]);
        worksheet.mergeCells(`A${narrativeRow.number}:K${narrativeRow.number}`);
        narrativeRow.height = 70;
        narrativeRow.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
        narrativeRow.getCell(1).font = { italic: true };
        worksheet.addRow([]);

        const unexpectedList = getUnexpectedItems();
        if (unexpectedList.length > 0) {
            const unexpHeader = worksheet.addRow(['DAFTAR ASET TEMUAN (BELUM TERDAFTAR DI SISTEM)']);
            unexpHeader.font = { bold: true };
            worksheet.addRow(['No', 'Nama Barang Temuan', 'Catatan / Lokasi Ditemukan', 'Waktu Tercatat']);
            unexpectedList.forEach((item, idx) => {
                worksheet.addRow([
                    idx + 1,
                    item.name,
                    item.note || '-',
                    new Date(item.date).toLocaleString('id-ID')
                ]);
            });
            worksheet.addRow([]);
        }

        const headers = ['No', 'Kode Aset', 'Nama Barang', 'Kategori', 'Lokasi Terdaftar', 'Lokasi Temuan', 'Kondisi Akhir', 'Status Audit', 'Foto Fisik', 'Catatan', 'Auditor'];
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => { cell.style = headerStyle; });

        session.items.forEach((item, idx) => {
            const rowData = [
                idx + 1,
                item.asset.code,
                item.asset.name,
                item.asset.category?.name || '-',
                item.originalLocation || '-',
                item.foundLocationId ? (allRooms.find(r => r.id === item.foundLocationId)?.name || '-') : (item.asset.room?.name || '-'),
                item.foundCondition || item.asset.condition,
                item.status === 'FOUND' ? 'ADA / DITEMUKAN' : item.status === 'MISSING' ? 'HILANG' : 'BELUM DIPERIKSA',
                item.image ? 'Ada Foto (MinIO)' : 'Tidak Ada',
                item.notes || '-',
                item.auditor?.name || '-'
            ];
            const row = worksheet.addRow(rowData);
            if (item.status === 'FOUND') row.getCell(8).font = { color: { argb: '059669' }, bold: true };
            if (item.status === 'MISSING') row.getCell(8).font = { color: { argb: 'DC2626' }, bold: true };
        });

        worksheet.columns.forEach(column => { column.width = 20; });
        worksheet.getColumn(1).width = 6;
        worksheet.getColumn(3).width = 32;
        worksheet.getColumn(10).width = 30;

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `Berita_Acara_Audit_${session.title.replace(/\s+/g, '_')}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    // ── Export to PDF with Strict KOP Surat (Yayasan Dar El-Iman - Tanpa Padang) ──
    const exportToPDF = async () => {
        try {
            showToast('Menyiapkan dokumen Berita Acara PDF...');
            const jsPDF = await loadJsPDF();
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const dateNowStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            const auditDateStr = new Date(session.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            // 1. KOP SURAT RESMI (Strict: YAYASAN DAR EL-IMAN tanpa kata "Padang" pada nama lembaga)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(30, 41, 59); // slate-800
            doc.text('BIDANG SARANA', pageW / 2, 16, { align: 'center' });

            doc.setFontSize(15);
            doc.setTextColor(5, 150, 105); // emerald-600
            doc.text('YAYASAN DAR EL-IMAN', pageW / 2, 23, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text('Jl. Gunuang Juaro, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat', pageW / 2, 28, { align: 'center' });

            // Double Horizontal Line (Kop Separator)
            doc.setDrawColor(5, 150, 105);
            doc.setLineWidth(0.8);
            doc.line(14, 32, pageW - 14, 32);
            doc.setDrawColor(148, 163, 184);
            doc.setLineWidth(0.2);
            doc.line(14, 33, pageW - 14, 33);

            // 2. DOCUMENT TITLE
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11.5);
            doc.setTextColor(15, 23, 42); // slate-900
            doc.text('BERITA ACARA HASIL PEMERIKSAAN FISIK ASET (STOCK OPNAME)', pageW / 2, 42, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            const docNumber = `BA-SO/${String(session.id).padStart(4, '0')}/SARANA/${new Date(session.createdAt).getFullYear()}`;
            doc.text(`Nomor Dokumen: ${docNumber}`, pageW / 2, 47, { align: 'center' });

            // 3. METADATA BOX
            const roomNames = Array.from(new Set(session.items.map(i => i.originalLocation || i.asset.room?.name || '-'))).join(', ');
            const damagedCount = session.items.filter(i => i.foundCondition && i.foundCondition !== 'BAIK').length;
            const misplacedCount = session.items.filter(i => i.status === 'FOUND' && i.foundLocationId && i.foundLocationId !== i.asset.roomId).length;
            const unexpectedList = getUnexpectedItems();

            const metaRows = [
                [{ content: 'Nama Sesi Audit', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } }, `: ${session.title}`,
                 { content: 'Tanggal Pemeriksaan', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } }, `: ${auditDateStr}`],
                [{ content: 'Auditor Pelaksana', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } }, `: ${session.creator?.name || 'Admin Sarana'}`,
                 { content: 'Status Sesi', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } }, `: ${session.status === 'OPEN' ? 'BERJALAN' : 'SELESAI (CLOSED)'}`],
                [{ content: 'Cakupan Lokasi', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } }, `: ${roomNames || '-'}`,
                 { content: 'Tingkat Penyelesaian', styles: { fontStyle: 'bold', textColor: [71, 85, 105] } }, `: ${progress}% (${stats.found + stats.missing} dari ${stats.total} aset)`]
            ];

            doc.autoTable({
                startY: 52,
                margin: { left: 14, right: 14 },
                theme: 'plain',
                styles: { fontSize: 8, cellPadding: 1.5, textColor: [30, 41, 59] },
                columnStyles: { 0: { width: 35 }, 1: { width: 60 }, 2: { width: 35 }, 3: { width: 55 } },
                body: metaRows
            });

            // 4. STATISTICAL SUMMARY HIGHLIGHT
            const statY = doc.lastAutoTable.finalY + 3;
            doc.autoTable({
                startY: statY,
                margin: { left: 14, right: 14 },
                theme: 'grid',
                head: [['Total Aset', 'Ditemukan (Ada)', 'Kondisi Baik', 'Rusak (Ringan/Berat)', 'Salah Ruangan', 'Hilang', 'Temuan Baru']],
                headStyles: {
                    fillColor: [241, 245, 249],
                    textColor: [51, 65, 85],
                    fontSize: 7.5,
                    fontStyle: 'bold',
                    halign: 'center',
                    lineWidth: 0.1,
                    lineColor: [203, 213, 225]
                },
                body: [[
                    stats.total,
                    stats.found,
                    session.items.filter(i => i.foundCondition === 'BAIK' || (!i.foundCondition && i.asset.condition === 'BAIK')).length,
                    damagedCount,
                    misplacedCount,
                    stats.missing,
                    unexpectedList.length
                ]],
                bodyStyles: {
                    halign: 'center',
                    fontSize: 9,
                    fontStyle: 'bold',
                    textColor: [15, 23, 42],
                    lineWidth: 0.1,
                    lineColor: [203, 213, 225]
                }
            });

            // 5. NARRATIVE TEXT
            const narrativeY = doc.lastAutoTable.finalY + 4;
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            const narrativeText = generateNarrative();
            const splitNarrative = doc.splitTextToSize(narrativeText, pageW - 28);
            doc.text(splitNarrative, 14, narrativeY);

            // 6. DETAILED FINDINGS TABLE (Special Attention: Misplaced, Damaged, Missing)
            const tableY = narrativeY + (splitNarrative.length * 3.8) + 4;
            
            // Prioritaskan aset yang memiliki catatan khusus (Rusak, Salah Ruangan, Hilang)
            const priorityItems = session.items.filter(i => 
                i.status === 'MISSING' || 
                (i.foundCondition && i.foundCondition !== 'BAIK') ||
                (i.status === 'FOUND' && i.foundLocationId && i.foundLocationId !== i.asset.roomId)
            );

            // Jika tidak ada temuan khusus sama sekali, sertakan 15 aset pertama
            const itemsForReport = priorityItems.length > 0 ? priorityItems : session.items.slice(0, 25);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(priorityItems.length > 0 
                ? 'Daftar Temuan Khusus & Aset Memerlukan Tindak Lanjut:' 
                : 'Ringkasan Pemeriksaan Fisik Barang:', 
                14, tableY
            );

            const tableRows = itemsForReport.map((item, idx) => {
                const foundRoomName = item.foundLocationId 
                    ? (allRooms.find(r => r.id === item.foundLocationId)?.name || '-')
                    : (item.asset.room?.name || '-');
                const isMisplaced = item.status === 'FOUND' && item.foundLocationId && item.foundLocationId !== item.asset.roomId;
                
                let statusLabel = item.status === 'FOUND' ? 'ADA' : item.status === 'MISSING' ? 'HILANG' : 'BELUM';
                if (isMisplaced) statusLabel += ' (MISPLACED)';

                return [
                    idx + 1,
                    item.asset.code,
                    item.asset.name,
                    item.originalLocation || '-',
                    foundRoomName,
                    item.foundCondition || item.asset.condition,
                    statusLabel,
                    item.notes || '-'
                ];
            });

            doc.autoTable({
                startY: tableY + 2,
                margin: { left: 14, right: 14 },
                theme: 'striped',
                head: [['No', 'Kode', 'Nama Barang', 'Lokasi Terdaftar', 'Lokasi Fisik', 'Kondisi', 'Status', 'Catatan']],
                headStyles: {
                    fillColor: [5, 150, 105],
                    textColor: [255, 255, 255],
                    fontSize: 7.5,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                body: tableRows,
                bodyStyles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
                columnStyles: {
                    0: { width: 8, halign: 'center' },
                    1: { width: 22, fontStyle: 'bold' },
                    2: { width: 38 },
                    3: { width: 25 },
                    4: { width: 25 },
                    5: { width: 22, halign: 'center' },
                    6: { width: 24, halign: 'center' },
                    7: { width: 28 }
                },
                didParseCell: function (data) {
                    if (data.section === 'body') {
                        if (data.row.cells[6]?.text?.[0]?.includes('HILANG')) {
                            data.cell.styles.textColor = [220, 38, 38]; // red
                            data.cell.styles.fontStyle = 'bold';
                        } else if (data.row.cells[6]?.text?.[0]?.includes('ADA')) {
                            data.cell.styles.textColor = [5, 150, 105]; // emerald
                        }
                    }
                }
            });

            // 7. UNEXPECTED ITEMS TABLE (IF ANY)
            if (unexpectedList.length > 0) {
                const unexpY = doc.lastAutoTable.finalY + 4;
                if (unexpY < pageH - 50) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9);
                    doc.setTextColor(180, 83, 9); // amber-700
                    doc.text('Daftar Barang Temuan Baru di Lapangan (Belum Terdata di Sistem):', 14, unexpY);

                    doc.autoTable({
                        startY: unexpY + 2,
                        margin: { left: 14, right: 14 },
                        theme: 'striped',
                        head: [['No', 'Nama Barang Temuan', 'Catatan & Lokasi Fisik Ditemukan', 'Waktu Tercatat']],
                        headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
                        body: unexpectedList.map((u, i) => [i + 1, u.name, u.note || '-', new Date(u.date).toLocaleString('id-ID')]),
                        bodyStyles: { fontSize: 7.5, cellPadding: 1.8 }
                    });
                }
            }

            // 8. DUAL SIGNATURE BLOCK (Auditor Pelaksana & Kepala Bidang Sarana)
            let sigY = doc.lastAutoTable.finalY + 12;
            if (sigY > pageH - 45) {
                doc.addPage();
                sigY = 25;
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            doc.text(`Padang, ${dateNowStr}`, pageW - 65, sigY);

            const sigTitleY = sigY + 5;
            // Auditor (Kiri)
            doc.setFont('helvetica', 'bold');
            doc.text('Auditor Pelaksana,', 25, sigTitleY);
            // Kabid Sarana (Kanan)
            doc.text('Mengetahui,', pageW - 65, sigTitleY);
            doc.text('Kepala Bidang Sarana,', pageW - 65, sigTitleY + 4);

            // Lines & Names
            const nameY = sigTitleY + 24;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`( ${session.creator?.name || 'Auditor Inventaris'} )`, 25, nameY);
            doc.text('( ..................................................... )', pageW - 65, nameY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text('Tim Stock Opname Sarpras', 25, nameY + 4);
            doc.text('Bidang Sarana Yayasan Dar El-Iman', pageW - 65, nameY + 4);

            // Footer Page Numbering
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Halaman ${i} dari ${pageCount}  |  Dokumen Resmi Berita Acara Stock Opname Yayasan Dar El-Iman`,
                    pageW / 2, pageH - 7, { align: 'center' }
                );
            }

            doc.save(`Berita_Acara_Audit_${session.title.replace(/\s+/g, '_')}.pdf`);
            showToast('Dokumen Berita Acara PDF berhasil diunduh');
        } catch (err) {
            console.error('PDF generation error:', err);
            alert('Gagal membuat Berita Acara PDF: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen space-y-3 bg-slate-50">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-bold">Memuat lembar audit...</p>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="p-20 text-center space-y-4">
                <p className="text-slate-500 font-bold">Data sesi audit tidak ditemukan</p>
                <button onClick={() => navigate('/aset/audit')} className="text-xs text-emerald-600 font-bold underline">
                    Kembali ke Daftar Sesi
                </button>
            </div>
        );
    }

    const stats = {
        total: session.items.length,
        found: session.items.filter(i => i.status === 'FOUND').length,
        missing: session.items.filter(i => i.status === 'MISSING').length,
        pending: session.items.filter(i => i.status === 'PENDING').length,
    };

    const progress = stats.total > 0 ? Math.round(((stats.found + stats.missing) / stats.total) * 100) : 0;
    const approvedCount = session.items.filter(i => i.reconcileApproved).length;

    const getUnexpectedItems = () => {
        if (!session || !session.unexpectedItems) return [];
        try {
            return typeof session.unexpectedItems === 'string' 
                ? JSON.parse(session.unexpectedItems) 
                : session.unexpectedItems;
        } catch { return []; }
    };

    const generateNarrative = () => {
        if (!session) return '';
        const found = stats.found;
        const missing = stats.missing;
        const total = stats.total;
        const damaged = session.items.filter(i => i.foundCondition && i.foundCondition !== 'BAIK').length;
        const dateStr = new Date(session.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const unexpectedList = getUnexpectedItems();
        let narrative = `Berdasarkan hasil audit fisik (Stock Opname) "${session.title}" yang dilaksanakan pada tanggal ${dateStr}, telah dilakukan pemeriksaan terhadap total ${total} unit aset. Dari hasil pemeriksaan tersebut, sebanyak ${found} unit aset berhasil ditemukan, di mana ${damaged} unit di antaranya tercatat dalam kondisi membutuhkan perhatian (rusak ringan/berat). Terdapat ${missing} unit aset yang dinyatakan hilang atau tidak ditemukan di lokasi. Seluruh hasil temuan lapangan ini divalidasi dan disinkronkan ke dalam database utama Manajemen Aset untuk menjaga akurasi data inventaris Yayasan Dar El-Iman.`;
        
        if (unexpectedList.length > 0) {
            const itemNames = unexpectedList.map(u => u.name).join(', ');
            narrative += ` Selain itu, auditor juga mencatat adanya ${unexpectedList.length} barang temuan baru di lapangan yang sebelumnya belum terdata di sistem, antara lain: ${itemNames}.`;
        }
        
        return narrative;
    };

    const filteredItems = session.items.filter(i => {
        const matchesTab = i.status === activeTab;
        const matchesSearch = i.asset.name.toLowerCase().includes(search.toLowerCase()) || 
                              i.asset.code.toLowerCase().includes(search.toLowerCase());
        const matchesRoom = !roomFilter || i.asset.roomId === parseInt(roomFilter);
        return matchesTab && matchesSearch && matchesRoom;
    });

    const sessionRoomsMap = new Map();
    session.items.forEach(i => {
        if (i.asset.room) sessionRoomsMap.set(i.asset.room.id, i.asset.room);
    });
    const sessionRooms = Array.from(sessionRoomsMap.values());

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50 space-y-8 pb-32">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-6 right-6 z-[99] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4">
                    <CheckCircle2 className="text-emerald-400" size={18} />
                    <span className="text-xs font-bold">{toastMessage}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/aset/audit')} 
                        className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-900 line-clamp-1">{session.title}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                session.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                            }`}>
                                {session.status === 'OPEN' ? 'BERJALAN' : 'SELESAI'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold flex items-center gap-2 mt-0.5">
                            <MapPin size={12} className="text-slate-400" /> 
                            {sessionRooms.map(r => r.name).join(', ') || 'Cakupan Ruangan'}
                        </p>
                    </div>
                </div>

                {/* Actions Top Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    {/* Lapor Temuan */}
                    {session.status === 'OPEN' && (
                        <button 
                            onClick={() => setShowUnexpectedModal(true)}
                            className="flex items-center justify-center gap-2 bg-amber-100 text-amber-800 hover:bg-amber-200 px-4 py-2.5 rounded-2xl font-black shadow-sm transition-all text-xs"
                        >
                            <Plus size={16} /> Lapor Temuan
                        </button>
                    )}

                    {/* Setujui Semua yang Ditemukan (Bulk Reconcile Approval) */}
                    {session.status === 'OPEN' && stats.found > 0 && (
                        <button 
                            onClick={handleBulkApproveFound}
                            className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-2xl font-black transition-all text-xs"
                            title="Setujui seluruh aset yang ditemukan agar siap disinkronkan ke master data"
                        >
                            <CheckCheck size={16} className="text-emerald-600" /> Setujui Semua Ada ({stats.found})
                        </button>
                    )}

                    {/* Ekspor Excel */}
                    <button 
                        onClick={exportToExcel}
                        className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-2xl font-bold shadow-sm transition-all text-xs"
                    >
                        <RefreshCcw size={15} /> Excel
                    </button>

                    {/* Cetak Berita Acara PDF */}
                    <button 
                        onClick={exportToPDF}
                        className="flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-900 text-white px-5 py-2.5 rounded-2xl font-black shadow-sm transition-all text-xs"
                        title="Cetak Berita Acara PDF Resmi (Kop Yayasan Dar El-Iman)"
                    >
                        <Printer size={16} /> Berita Acara PDF
                    </button>

                    {/* Tombol Scanner Kamera */}
                    {session.status === 'OPEN' && (
                        <button 
                            onClick={() => setShowScanner(true)}
                            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-black shadow-lg shadow-emerald-200 hover:scale-105 transition-all text-xs"
                        >
                            <Scan size={16} /> SCAN QR
                        </button>
                    )}

                    {/* Tombol Finalisasi */}
                    {session.status === 'OPEN' && (
                        <button 
                            onClick={() => setShowFinalizeModal(true)}
                            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-2xl font-black shadow-lg transition-all text-xs"
                        >
                            <ShieldCheck size={16} /> FINALISASI ({approvedCount} DISETUJUI)
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Barcode Scanner Notice */}
            {session.status === 'OPEN' && (
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-emerald-800">
                    <div className="flex items-center gap-2 font-bold">
                        <Scan size={16} className="text-emerald-600 animate-pulse" />
                        <span>Barcode Gun Scanner Aktif:</span>
                        <span className="font-normal text-emerald-700">Tembakkan scanner fisik ke kode/barcode aset kapan saja di halaman ini.</span>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-emerald-200/60 px-2 py-0.5 rounded text-emerald-900">
                        Plug & Play
                    </span>
                </div>
            )}

            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cakupan</p>
                    <p className="text-2xl font-black text-slate-800">{stats.total} <span className="text-xs text-slate-400 font-bold">Barang</span></p>
                </div>
                <div className="bg-emerald-50 p-5 rounded-[28px] border border-emerald-100 shadow-sm space-y-1">
                    <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest">Ditemukan (Ada)</p>
                    <p className="text-2xl font-black text-emerald-700">{stats.found} <span className="text-xs text-emerald-600 font-bold">Aset</span></p>
                </div>
                <div className="bg-red-50 p-5 rounded-[28px] border border-red-100 shadow-sm space-y-1">
                    <p className="text-[10px] font-black text-red-600/70 uppercase tracking-widest">Hilang</p>
                    <p className="text-2xl font-black text-red-700">{stats.missing} <span className="text-xs text-red-600 font-bold">Aset</span></p>
                </div>
                <div className="bg-amber-50 p-5 rounded-[28px] border border-amber-100 shadow-sm space-y-1">
                    <p className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest">Penyelesaian</p>
                    <p className="text-2xl font-black text-amber-700">{progress}% <span className="text-xs text-amber-600 font-bold">({stats.pending} tersisa)</span></p>
                </div>
            </div>

            {/* Narrative Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[32px] p-7 text-white shadow-2xl space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><ClipboardCheck size={140} /></div>
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                    <Info size={15} /> Ringkasan Analisis Laporan Resmi
                </div>
                <p className="text-xs leading-relaxed font-medium relative z-10 max-w-3xl text-slate-200 italic">
                    "{generateNarrative()}"
                </p>
                <div className="pt-2 flex gap-3 relative z-10">
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(generateNarrative());
                            showToast('Narasi laporan berhasil disalin ke clipboard');
                        }}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold transition-all text-white"
                    >
                        Salin Narasi
                    </button>
                    <button 
                        onClick={exportToPDF}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[10px] font-black transition-all text-white flex items-center gap-1.5"
                    >
                        <Printer size={12} /> Unduh Berita Acara PDF
                    </button>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex bg-slate-200/60 p-1 rounded-2xl w-full max-w-md">
                        {['PENDING', 'FOUND', 'MISSING'].map(t => (
                            <button
                                key={t}
                                onClick={() => { setActiveTab(t); setSelectedIds([]); }}
                                className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                                    activeTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {t === 'PENDING' ? 'BELUM' : t === 'FOUND' ? 'ADA' : 'HILANG'} 
                                <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">
                                    {stats[t.toLowerCase()]}
                                </span>
                            </button>
                        ))}
                    </div>
                    {session.status === 'OPEN' && filteredItems.length > 0 && (
                        <button 
                            onClick={toggleSelectAll}
                            className="text-xs font-black text-emerald-700 px-6 py-3 bg-emerald-50 hover:bg-emerald-100 rounded-2xl transition-all flex items-center justify-center gap-2"
                        >
                            <ClipboardCheck size={16} />
                            {selectedIds.length === filteredItems.length ? 'Batal Pilih Semua' : 'Pilih Semua di Tab Ini'}
                        </button>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-4 max-w-4xl">
                    <div className="relative group flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            placeholder="Cari nama barang atau kode inventaris..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all shadow-sm"
                        />
                    </div>
                    <select
                        value={roomFilter}
                        onChange={e => setRoomFilter(e.target.value)}
                        className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-emerald-100 transition-all shadow-sm"
                    >
                        <option value="">Semua Ruangan</option>
                        {sessionRooms.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Item List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map(item => (
                    <div 
                        key={item.id} 
                        className={`bg-white p-5 rounded-3xl border flex items-center gap-4 group transition-all relative ${
                            selectedIds.includes(item.id) 
                                ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-lg' 
                                : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        {session.status === 'OPEN' && (
                            <input 
                                type="checkbox"
                                checked={selectedIds.includes(item.id)}
                                onChange={(e) => {
                                    if (e.target.checked) setSelectedIds([...selectedIds, item.id]);
                                    else setSelectedIds(selectedIds.filter(id => id !== item.id));
                                }}
                                className="w-5 h-5 rounded-lg border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                        )}
                        <div 
                            onClick={() => {
                                if (session.status === 'OPEN') {
                                    setSelectedItem(item);
                                    setForm({
                                        condition: item.foundCondition || item.asset.condition || 'BAIK',
                                        note: item.notes || '',
                                        status: item.status === 'PENDING' ? 'FOUND' : item.status,
                                        foundLocationId: item.foundLocationId || item.asset.roomId || '',
                                        image: item.image || ''
                                    });
                                }
                            }}
                            className="flex-1 flex items-center gap-4 cursor-pointer min-w-0"
                        >
                            {/* Icon status or photo thumbnail */}
                            <div className="relative">
                                {item.image ? (
                                    <div 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewPhotoUrl(item.image);
                                        }}
                                        className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative group/thumb cursor-pointer shadow-sm"
                                        title="Klik untuk melihat foto fisik"
                                    >
                                        <img src={item.image} alt={item.asset.name} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                            <Eye size={16} className="text-white" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`p-3 rounded-2xl ${
                                        item.status === 'FOUND' 
                                            ? 'bg-emerald-50 text-emerald-600' 
                                            : item.status === 'MISSING' 
                                                ? 'bg-red-50 text-red-600' 
                                                : 'bg-slate-50 text-slate-400'
                                    }`}>
                                        {item.status === 'FOUND' ? <CheckCircle2 size={24} /> : item.status === 'MISSING' ? <AlertCircle size={24} /> : <Info size={24} />}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-black text-slate-800 line-clamp-1">{item.asset.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.asset.code}</p>
                                    {item.status === 'FOUND' && item.foundLocationId && item.foundLocationId !== item.asset.roomId && (
                                        <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-black uppercase">
                                            MISPLACED
                                        </span>
                                    )}
                                    {item.image && (
                                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5">
                                            <Camera size={10} /> Foto
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-1 truncate">
                                    <MapPin size={11} /> {item.originalLocation || item.asset.room?.name || 'Unknown Room'}
                                </p>
                            </div>
                            
                            {/* Reconcile Approval Action */}
                            {session.status === 'OPEN' && item.status === 'FOUND' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleApprove(item.id, !item.reconcileApproved);
                                    }}
                                    className={`p-2.5 rounded-xl border transition-all ${
                                        item.reconcileApproved 
                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                                            : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-500'
                                    }`}
                                    title={item.reconcileApproved ? "Sudah disetujui untuk rekonsiliasi" : "Setujui perubahan data"}
                                >
                                    <ShieldCheck size={18} />
                                </button>
                            )}
                            <ChevronRight className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" size={20} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Unexpected Items Section */}
            {getUnexpectedItems().length > 0 && (
                <div className="space-y-4 pt-8 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <AlertCircle className="text-amber-500" size={20} />
                            Daftar Aset Temuan (Belum Terdata di Sistem)
                        </h3>
                        <span className="text-xs text-slate-400 font-bold">
                            {getUnexpectedItems().length} Temuan Lapangan
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {getUnexpectedItems().map((u, i) => (
                            <div key={i} className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-200 hover:-translate-y-1 transition-transform space-y-3">
                                <div className="flex items-start justify-between">
                                    <h4 className="font-bold text-slate-800 text-sm">{u.name}</h4>
                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">BARU</span>
                                </div>
                                <p className="text-xs text-slate-500 italic">{u.note || 'Tidak ada catatan lokasi'}</p>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    <p className="text-[10px] text-slate-400">{new Date(u.date).toLocaleString('id-ID')}</p>
                                    <button
                                        onClick={() => {
                                            navigate(`/aset?action=new&name=${encodeURIComponent(u.name)}&notes=${encodeURIComponent(u.note || '')}`);
                                        }}
                                        className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline"
                                    >
                                        Daftarkan Aset <ExternalLink size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bulk Action Bar for Selected Checkboxes */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[55] w-[90%] max-w-2xl bg-slate-900 text-white p-4 rounded-[32px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-20">
                    <div className="flex items-center gap-4 pl-4">
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center font-black text-lg">
                            {selectedIds.length}
                        </div>
                        <div>
                            <p className="text-sm font-black">Aset Terpilih</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Update status masal</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button 
                            onClick={() => handleBulkAction('FOUND')}
                            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-2xl text-xs font-black shadow-lg shadow-emerald-900/20 transition-all"
                        >
                            TANDAI ADA
                        </button>
                        <button 
                            onClick={() => handleBulkAction('MISSING')}
                            className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl text-xs font-black shadow-lg shadow-red-900/20 transition-all"
                        >
                            TANDAI HILANG
                        </button>
                        <button 
                            onClick={() => setSelectedIds([])}
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Verification Drawer / Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-t-[40px] md:rounded-[40px] shadow-2xl p-6 md:p-8 space-y-6 animate-in slide-in-from-bottom-10 max-h-[92vh] overflow-y-auto">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-slate-900">{selectedItem.asset.name}</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedItem.asset.code}</p>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Status & Kondisi */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Status Keberadaan</p>
                                <div className="flex gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => setForm({...form, status: 'FOUND'})} 
                                        className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                                            form.status === 'FOUND' 
                                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
                                                : 'bg-white text-slate-400 border border-slate-200'
                                        }`}
                                    >
                                        ADA
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setForm({...form, status: 'MISSING'})} 
                                        className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                                            form.status === 'MISSING' 
                                                ? 'bg-red-600 text-white shadow-lg shadow-red-200' 
                                                : 'bg-white text-slate-400 border border-slate-200'
                                        }`}
                                    >
                                        HILANG
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Kondisi Fisik</p>
                                <select 
                                    disabled={form.status === 'MISSING'}
                                    value={form.condition}
                                    onChange={e => setForm({...form, condition: e.target.value})}
                                    className="w-full bg-white border border-slate-200 rounded-xl text-xs font-black p-2 outline-none disabled:opacity-50"
                                >
                                    <option value="BAIK">BAIK</option>
                                    <option value="RUSAK_RINGAN">RUSAK RINGAN</option>
                                    <option value="RUSAK_BERAT">RUSAK BERAT</option>
                                </select>
                            </div>
                        </div>

                        {/* Lokasi Fisik Ditemukan */}
                        <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Lokasi Ditemukan</p>
                            <select 
                                disabled={form.status === 'MISSING'}
                                value={form.foundLocationId}
                                onChange={e => setForm({...form, foundLocationId: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-xl text-xs font-black p-3 outline-none disabled:opacity-50"
                            >
                                <option value="">-- Pilih Ruangan --</option>
                                {allRooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.building || 'Gedung Utama'})</option>
                                ))}
                            </select>
                            {form.foundLocationId && parseInt(form.foundLocationId) !== selectedItem.asset.roomId && (
                                <p className="text-[10px] text-purple-600 font-bold flex items-center gap-1">
                                    <AlertTriangle size={12} /> Barang seharusnya berada di: {selectedItem.asset.room?.name || 'Lokasi Asli'}
                                </p>
                            )}
                        </div>

                        {/* Foto Fisik Aset (MinIO Upload & Compression) */}
                        <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    Foto Bukti Fisik Aset
                                </p>
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    Tersimpan di MinIO (Auto Kompres)
                                </span>
                            </div>

                            {form.image ? (
                                <div className="space-y-2">
                                    <div className="relative w-full h-36 bg-slate-200 rounded-2xl overflow-hidden border border-slate-200 group">
                                        <img src={form.image} alt="Bukti Fisik" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewPhotoUrl(form.image)}
                                                className="p-2 bg-white text-slate-900 rounded-xl font-bold text-xs flex items-center gap-1 shadow"
                                            >
                                                <Eye size={14} /> Lihat
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setForm({ ...form, image: '' })}
                                                className="p-2 bg-red-600 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow"
                                            >
                                                <X size={14} /> Hapus
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 text-center">
                                        Foto berhasil dioptimasi dan disimpan ke storage MinIO.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <input 
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handlePhotoFileChange}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        disabled={uploadingPhoto}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl flex flex-col items-center justify-center gap-2 bg-white text-slate-600 hover:text-emerald-700 transition-all cursor-pointer"
                                    >
                                        {uploadingPhoto ? (
                                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                                                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                                Mengompres & Mengunggah ke MinIO...
                                            </div>
                                        ) : (
                                            <>
                                                <Camera size={22} className="text-emerald-600" />
                                                <span className="text-xs font-bold">Ambil Foto Kamera / Pilih File</span>
                                                <span className="text-[10px] text-slate-400">Gambar akan otomatis dikompres via Sharp & disimpan di MinIO</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Catatan Audit */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catatan Audit</label>
                            <textarea 
                                value={form.note}
                                onChange={e => setForm({...form, note: e.target.value})}
                                placeholder="Contoh: Barang ditemukan di sudut ruangan, baut kendor, tombol power macet..."
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:ring-4 focus:ring-emerald-100 transition-all resize-none italic"
                                rows={3}
                            />
                        </div>

                        {/* Tombol Simpan */}
                        <button 
                            type="button"
                            onClick={handleVerify}
                            disabled={uploadingPhoto}
                            className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-emerald-200 hover:scale-[1.01] active:scale-95 transition-all text-xs"
                        >
                            <Save size={18} /> SIMPAN HASIL VERIFIKASI
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Finalisasi Audit Fleksibel */}
            {showFinalizeModal && (
                <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl space-y-6 animate-in zoom-in-95">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                            <ShieldCheck size={28} />
                        </div>

                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-slate-900">Finalisasi Sesi Audit</h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Rekonsiliasi akan memperbarui data master aset sesuai hasil verifikasi lapangan yang telah disetujui.
                            </p>
                        </div>

                        {/* Status Check Warning */}
                        {stats.pending > 0 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-amber-900">
                                            Masih Ada {stats.pending} Aset Belum Diperiksa!
                                        </p>
                                        <p className="text-[11px] text-amber-800 leading-relaxed">
                                            Terdapat barang yang belum diperiksa fisiknya di ruangan.
                                        </p>
                                    </div>
                                </div>

                                <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-xl border border-amber-200 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={autoMarkMissing}
                                        onChange={(e) => setAutoMarkMissing(e.target.checked)}
                                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-[11px] font-bold text-slate-700">
                                        Tandai {stats.pending} sisa aset sebagai "HILANG" otomatis
                                    </span>
                                </label>
                            </div>
                        ) : (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                                <CheckCircle2 size={20} className="text-emerald-600" />
                                <p className="text-xs font-bold text-emerald-800">
                                    Seluruh {stats.total} aset telah diverifikasi (100% Selesai).
                                </p>
                            </div>
                        )}

                        <div className="bg-slate-50 p-4 rounded-2xl text-xs space-y-1.5 text-slate-600">
                            <div className="flex justify-between font-bold">
                                <span>Aset disetujui untuk disinkronkan:</span>
                                <span className="text-emerald-700">{approvedCount} Aset</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>Aset dinyatakan hilang:</span>
                                <span className="text-red-600">{stats.missing + (stats.pending > 0 && autoMarkMissing ? stats.pending : 0)} Aset</span>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowFinalizeModal(false)}
                                className="flex-1 py-3.5 rounded-2xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 text-xs transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                disabled={finalizing}
                                onClick={executeFinalize}
                                className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs shadow-xl transition-all"
                            >
                                {finalizing ? 'Memproses...' : 'Tutup & Finalisasi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Lightbox Modal */}
            {previewPhotoUrl && (
                <div 
                    onClick={() => setPreviewPhotoUrl(null)}
                    className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-in fade-in"
                >
                    <div className="max-w-2xl max-h-[85vh] relative rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <img src={previewPhotoUrl} alt="Preview Foto Fisik" className="max-w-full max-h-[80vh] object-contain rounded-2xl" />
                        <button 
                            onClick={() => setPreviewPhotoUrl(null)}
                            className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Scanner View Camera */}
            {showScanner && (
                <div className="fixed inset-0 z-[70] bg-slate-900 flex flex-col p-6 space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-600 rounded-2xl shadow"><Scan size={20} /></div>
                            <div>
                                <h3 className="font-black text-sm">Arahkan Kamera ke QR Code Aset</h3>
                                <p className="text-[11px] text-white/50">Deteksi otomatis kode aset</p>
                            </div>
                        </div>
                        <button onClick={() => setShowScanner(false)} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="flex-1 rounded-[36px] overflow-hidden border-4 border-emerald-500/50 bg-black relative">
                        <div id="reader" className="w-full h-full"></div>
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-64 h-64 border-2 border-emerald-400 rounded-3xl opacity-60 animate-pulse"></div>
                        </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl backdrop-blur-md text-white text-center space-y-1">
                        <p className="text-xs font-bold">Scanning for Inventory Items...</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">Sesi ID: {id}</p>
                    </div>
                </div>
            )}

            {/* Unexpected Item Modal */}
            {showUnexpectedModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <form onSubmit={handleAddUnexpected} className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl space-y-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-slate-900">Catat Aset Temuan</h2>
                                <p className="text-xs text-slate-500 font-medium">Barang fisik ditemukan di lapangan namun belum tercatat di sistem</p>
                            </div>
                            <button type="button" onClick={() => setShowUnexpectedModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Barang *</label>
                                <input
                                    required
                                    value={unexpectedForm.itemName}
                                    onChange={e => setUnexpectedForm({...unexpectedForm, itemName: e.target.value})}
                                    placeholder="Contoh: Meja Lipat Krisbow, Kipas Dinding..."
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi / Catatan Temuan</label>
                                <textarea
                                    value={unexpectedForm.note}
                                    onChange={e => setUnexpectedForm({...unexpectedForm, note: e.target.value})}
                                    placeholder="Contoh: Ditemukan di pojok ruangan Lab Komputer Lantai 2..."
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-emerald-100 transition-all resize-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setShowUnexpectedModal(false)} className="flex-1 py-3.5 rounded-2xl font-bold text-slate-400 hover:text-slate-600 text-xs">
                                Batal
                            </button>
                            <button type="submit" className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black shadow-lg shadow-amber-200 text-xs transition-all">
                                Simpan Temuan
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AuditSessionDetail;

