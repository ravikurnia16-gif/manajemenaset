import { useState, useRef, useEffect } from 'react';
import { Download, Upload, Plus, Search, Filter, Edit, Trash2, Building2, MapPin, Printer, QrCode, CheckCircle, XCircle, AlertCircle, ArrowLeftRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { LabelPrint, BatchLabelPrint } from '../components/LabelPrint';
import { useReactToPrint } from 'react-to-print';
import api from '../lib/axios';

const AssetList = ({ validationMode = false }) => {
    const navigate = useNavigate();
    const [units, setUnits] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [settings, setSettings] = useState(null);

    // Action Modal State
    const [actionModal, setActionModal] = useState({ isOpen: false, type: null }); // type: 'export' | 'print'
    const [targetUnitId, setTargetUnitId] = useState('');
    const [printRange, setPrintRange] = useState({ start: '', end: '' });

    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPreparingPrint, setIsPreparingPrint] = useState(false);
    const [printLayout, setPrintLayout] = useState('2x4'); // Default 8 labels per page

    // Filter Logic
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);

    // Validation Feature State
    const [validationFilter, setValidationFilter] = useState(validationMode ? 'UNVERIFIED' : 'ALL'); // ALL, UNVERIFIED, VALIDATED, NEEDS_UPDATE
    const [validationModal, setValidationModal] = useState({
        isOpen: false,
        assetIds: [],
        currentStatus: 'VALIDATED', // Default action to Validated
        note: ''
    });
    const [disposalModal, setDisposalModal] = useState({
        isOpen: false,
        asset: null,
        reason: '',
        method: 'DIMUSNAHKAN',
        notes: '',
        disposalDate: new Date().toISOString().split('T')[0]
    });

    const [currentUser] = useState(JSON.parse(localStorage.getItem('user')) || {});
    const isGlobalAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN_ASET';
    const canProposeDisposal = isGlobalAdmin || currentUser.role === 'KEPALA_BIDANG' || currentUser.role === 'ADMIN_UNIT';

    const [selectedUnit, setSelectedUnit] = useState(isGlobalAdmin ? '' : (currentUser.unitId?.toString() || ''));
    const [selectedRoom, setSelectedRoom] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [totalItems, setTotalItems] = useState(0);

    // Fetch Data from Backend
    const fetchData = async () => {
        try {
            setLoading(true);

            // Build Query Params
            const params = {
                page: currentPage,
                limit: itemsPerPage,
                search: searchTerm,
                validationStatus: validationFilter,
                unitId: selectedUnit,
                roomId: selectedRoom
            };

            const [respAssets, respUnits, respRooms, respSettings] = await Promise.all([
                api.get('/assets', { params }).catch(err => { throw new Error(`Data Aset: ${err.message}`); }),
                api.get('/master/units').catch(err => { throw new Error(`Data Unit: ${err.message}`); }),
                api.get('/master/rooms').catch(err => { throw new Error(`Data Ruangan: ${err.message}`); }),
                api.get('/settings').catch(err => { console.warn("Failed to fetch settings"); return { data: null }; })
            ]);

            // Handle new response structure (data + pagination)
            if (respAssets.data && respAssets.data.pagination) {
                setAssets(Array.isArray(respAssets.data.data) ? respAssets.data.data : []);
                setTotalItems(respAssets.data.pagination.total || 0);
            } else {
                // Fallback for old API style (just in case)
                setAssets(Array.isArray(respAssets.data) ? respAssets.data : []);
                setTotalItems(Array.isArray(respAssets.data) ? respAssets.data.length : 0);
            }

            setUnits(respUnits.data);
            setRooms(respRooms.data);
            if (respSettings && respSettings.data) setSettings(respSettings.data);
        } catch (error) {
            console.error('Fetch error:', error);
            if (!error.message.includes('401') && !error.message.includes('403')) {
                console.warn('Gagal mengambil data dari server. Error: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1); // Reset to page 1 on search change
            fetchData();
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Triggers for filters/pagination
    useEffect(() => {
        fetchData();
        // Force selection if not global admin
        if (!isGlobalAdmin && currentUser.unitId) {
            setSelectedUnit(currentUser.unitId.toString());
        }
    }, [currentPage, itemsPerPage, validationFilter, selectedUnit, selectedRoom, currentUser]);

    // Ref for Print
    const [printAsset, setPrintAsset] = useState(null);
    const [batchPrintAssets, setBatchPrintAssets] = useState([]);
    const printRef = useRef();
    const batchPrintRef = useRef();

    const handlePrintSingle = useReactToPrint({
        contentRef: printRef,
        onAfterPrint: () => {
            setPrintAsset(null);
            setIsPreparingPrint(false);
        },
    });

    const handleBatchPrint = useReactToPrint({
        contentRef: batchPrintRef,
        onAfterPrint: () => {
            setBatchPrintAssets([]);
            setIsPreparingPrint(false);
        },
    });

    const openPrintModal = (asset) => {
        setIsPreparingPrint(true);
        setPrintAsset(asset);
        setTimeout(() => handlePrintSingle(), 500);
    };

    // -- REMOVED CLIENT-SIDE FILTERING LOGIC --
    // The 'assets' state now holds the CURRENT PAGE data only.
    const filteredAssets = assets; // Alias for compatibility with render

    const getTargetData = async () => {
        // For export/print purposes, we need to fetch ALL matching data, not just current page.
        // This is a simplified approach: fetch all with huge limit if needed, or handle specific export endpoint.
        // For now, let's just warn or try to fetch all.
        try {
            const params = {
                page: 1,
                limit: 10000, // Large limit for export
                search: searchTerm,
                validationStatus: validationFilter,
                unitId: targetUnitId === 'DATE_RANGE' ? '' : (targetUnitId || selectedUnit),
                roomId: selectedRoom,
                startDate: targetUnitId === 'DATE_RANGE' ? printRange.start : '',
                endDate: targetUnitId === 'DATE_RANGE' ? printRange.end : ''
            };
            const response = await api.get('/assets', { params });
            return response.data.data || response.data;
        } catch (e) {
            console.error("Failed to fetch target data for export", e);
            alert("Gagal mengambil data lengkap untuk export via API.");
            return [];
        }
    };

    const handleActionConfirmation = async () => {
        if (actionModal.type === 'export') {
            // Need to fetch data asynchronously now
            const data = await getTargetData();
            if (data.length === 0) { alert('Tidak ada data.'); return; }
            handleExport(data);
        } else if (actionModal.type === 'print') {
            const data = await getTargetData(); // Or just use selectedIds if available
            if (data.length === 0) { alert('Tidak ada data.'); return; }
            performBatchPrint(data);
        }
        setActionModal({ isOpen: false, type: null });
        // Reset specific unit if not needed anymore to avoid confusion
        if (targetUnitId === 'DATE_RANGE') {
            setTargetUnitId('');
            setPrintRange({ start: '', end: '' });
        }
    };

    const performBatchPrint = (data) => {
        setIsPreparingPrint(true);
        setBatchPrintAssets(data);
        setTimeout(() => {
            handleBatchPrint();
        }, 800); // Give enough time for rendering thousands of cards
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus aset ini?')) return;
        try {
            await api.delete(`/assets/${id}`);
            alert('Aset berhasil dihapus');
            fetchData();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Gagal menghapus aset: ' + (error.response?.data?.error || error.message));
        }
    };

    const openValidationModal = (ids = [], status = 'VALIDATED') => {
        setValidationModal({
            isOpen: true,
            assetIds: ids,
            currentStatus: status,
            note: ''
        });
    };

    const handleValidationSubmit = async () => {
        try {
            setLoading(true);
            const { assetIds, currentStatus, note } = validationModal;

            // Check if single or bulk
            if (assetIds.length === 1) {
                await api.post(`/assets/${assetIds[0]}/validate`, { status: currentStatus, note });
            } else {
                await api.post(`/assets/validate/bulk`, { ids: assetIds, status: currentStatus, note });
            }

            alert('Validasi berhasil disimpan!');
            setValidationModal({ isOpen: false, assetIds: [], currentStatus: 'VALIDATED', note: '' });
            setSelectedIds([]); // Clear selection if any
            fetchData();
        } catch (error) {
            console.error('Validation error:', error);
            alert('Gagal menyimpan validasi: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDisposalSubmit = async () => {
        try {
            setLoading(true);
            const { asset, assetIds, reason, method, notes, disposalDate } = disposalModal;

            const payload = {
                reason,
                method,
                notes,
                disposalDate
            };

            if (assetIds && assetIds.length > 0) {
                payload.assetIds = assetIds;
            } else if (asset) {
                payload.assetId = asset.id;
            }

            await api.post('/disposals', payload);

            alert(assetIds?.length > 1
                ? `${assetIds.length} Usulan penghapusan berhasil diajukan`
                : 'Usulan penghapusan berhasil diajukan dan sedang menunggu persetujuan');

            setDisposalModal({
                isOpen: false,
                asset: null,
                assetIds: [],
                reason: '',
                method: 'DIMUSNAHKAN',
                notes: '',
                disposalDate: new Date().toISOString().split('T')[0]
            });
            setSelectedIds([]); // Clear selection after bulk action
            fetchData();
        } catch (error) {
            console.error('Disposal error:', error);
            alert('Gagal memproses penghapusan: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Pagination Logic (Server Side)
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedAssets = assets; // Assets are already paginated from server

    // Reset to page 1 logic is handled in useEffect now

    const availableRooms = selectedUnit
        ? rooms.filter(r => r.unitId === parseInt(selectedUnit))
        : rooms;

    const handleTemplateDownload = () => {
        const headers = [[
            'Nama Aset', 'Merek Aset', 'Vendor Aset', 'Umur Ekonomis Aset(hari)', 'Umur Ekonomis Aset(bulan)', 'Umur Ekonomis Aset(tahun)',
            'Kondisi Aset', 'Sumber Dana Aset', 'Ruangan Aset', 'Unit Aset', 'Kategori', 'Tanggal Transaksi Masuk (yyyy-mm-dd)',
            'Jenis Transaksi Masuk', 'Bukti Transaksi Masuk', 'Harga Perolehan', 'PIC (Nama Manual)', 'NIK/NIY Pihak Kedua', 'Apakah Pihak Kedua Karyawan? (ya/tidak)',
            'Nama Pihak Kedua (hanya digunakan kalau pihak kedua baru)', 'Alamat Pihak Kedua (hanya digunakan kalau pihak kedua baru)',
            'Tanggal Transaksi Keluar (yyyy-mm-dd)', 'Jenis Transaksi Keluar', 'Bukti Transaksi Keluar', 'Harga Jual',
            'NIK/NIY Pihak Kedua', 'Apakah Pihak Kedua Karyawan? (ya/tidak)', 'Nama Pihak Kedua (hanya digunakan kalau pihak kedua baru)',
            'Alamat Pihak Kedua (hanya digunakan kalau pihak kedua baru)'
        ]];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wscols = headers[0].map(() => ({ wch: 25 }));
        ws['!cols'] = wscols;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template_Import");
        XLSX.writeFile(wb, "Template_Import_Aset.xlsx");
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, {
                type: 'array',
                cellDates: true
            });

            let jsonData = [];
            let sheetUsed = "";

            // Try to find the first sheet that actually has data
            for (const name of workbook.SheetNames) {
                const worksheet = workbook.Sheets[name];
                const temp = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                if (temp.length > 0) {
                    jsonData = temp;
                    sheetUsed = name;
                    break;
                }
            }

            if (jsonData.length === 0) {
                alert(`File dianggap kosong! \nJumlah Sheet: ${workbook.SheetNames.length} \nNama Sheet Pertama: ${workbook.SheetNames[0]} \n\nPastikan data Bapak tidak berada di sheet tersembunyi atau sheet kedua.`);
                return;
            }

            try {
                const response = await api.post('/assets/import', jsonData);
                alert(`Import Berhasil! \n${response.data.message}`);
                fetchData(); // Refresh list
            } catch (error) {
                console.error("Import error details:", error);
                const msg = error.response?.data?.error || error.message;
                alert("Gagal melakukan import data ke server: " + msg);
            } finally {
                // Reset file input so user can import the same/another file without refresh
                e.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleToggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(paginatedAssets.map(a => a.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedIds.length) return;
        if (!window.confirm(`Hapus ${selectedIds.length} aset terpilih?`)) return;

        try {
            setLoading(true);
            await api.delete('/assets/bulk', { data: { ids: selectedIds } });
            alert('Aset terpilih berhasil dihapus');
            setSelectedIds([]);
            fetchData();
        } catch (error) {
            console.error('Bulk delete error:', error);
            alert('Gagal menghapus aset: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (dataSource = filteredAssets) => {
        const now = new Date();
        const exportData = dataSource.map((a, index) => {
            const purchaseDate = new Date(a.purchaseDate);
            const monthsElapsed = Math.max(0, (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth()));
            const totalMonths = (a.usefulLife || 5) * 12;
            const monthlyDepreciation = Math.round(a.price / totalMonths);
            const accumulatedDepreciation = Math.min(a.price, monthlyDepreciation * monthsElapsed);
            const bookValue = Math.max(0, a.price - accumulatedDepreciation);
            const daysElapsed = Math.max(0, Math.floor((now - purchaseDate) / (24 * 60 * 60 * 1000)));

            return {
                'No': index + 1,
                'Kode': a.code,
                'Nama': a.name,
                'Merek': a.brand || '-',
                'Vendor': a.vendor?.name || '-',
                'Tanggal Perolehan': a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('id-ID') : '-',
                'Status Perolehan': 'Beli Baru',
                'Harga Perolehan': a.price,
                'PIC': a.picName || (a.pic?.name) || '-',
                'Kategori': a.category?.name || '-',
                'Sumber Dana': a.sourceOfFunds || 'Mandiri',
                'Kondisi': a.condition,
                'Nama Ruangan': a.room?.name || '-',
                'Lokasi': a.room?.building || '-',
                'Nama Unit/Bidang': a.unit?.name || '-',
                'Penjual/Penghibah': a.vendor?.name || '-',
                'Umur Ekonomis': a.usefulLife + ' Tahun',
                'Nilai Penyusutan per Bulan': monthlyDepreciation,
                'Jumlah Bulan Penyusutan': Math.min(monthsElapsed, totalMonths),
                'Jurnal Penyusutan (Bulanan)': `D: Beban Penyusutan / K: Akum. Penyusutan (${monthlyDepreciation})`,
                'Jumlah Nominal Penyusutan Terkini': accumulatedDepreciation,
                'Perkiraan Hari Penyusutan Terkini': daysElapsed,
                'Jumlah Hari Penyusutan Terkini': daysElapsed,
                'Nilai Buku': bookValue,
                'Status PHPP': '-',
                'No. Bukti PHPP': '-',
                'Nama Penerima/Pembeli': '-',
                'Unit Penerima/Pembeli': '-',
                'Harga Jual': 0,
                'Laba/Rugi Penjualan': 0
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data Aset & Penyusutan");
        XLSX.writeFile(wb, `Laporan_Aset_Unit_${targetUnitId || 'All'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Print Preparation Overlay */}
            {isPreparingPrint && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-xs ring-1 ring-slate-100">
                        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Menyiapkan Dokumen</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Sedang merender label QR...<br />
                            Mohon tunggu sebentar sampai dialog cetak muncul.
                        </p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                        {validationMode ? 'Validasi Aset' : 'Daftar Aset'}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 text-sm">
                            {validationMode ? 'Verifikasi dan validasi data aset' : 'Monitor aset per unit dan ruangan'}
                        </p>
                        {selectedIds.length > 0 && (
                            <div className="flex gap-2 animate-in zoom-in-95 duration-200">
                                <button
                                    onClick={() => openValidationModal(selectedIds, 'VALIDATED')}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-semibold hover:bg-green-100 transition-colors border border-green-100"
                                >
                                    <CheckCircle size={12} /> Validasi {selectedIds.length} Item
                                </button>
                                {canProposeDisposal && (
                                    <button
                                        onClick={() => setDisposalModal({
                                            isOpen: true,
                                            assetIds: selectedIds,
                                            reason: '',
                                            method: 'DIMUSNAHKAN',
                                            notes: '',
                                            disposalDate: new Date().toISOString().split('T')[0]
                                        })}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-semibold hover:bg-red-100 transition-colors border border-red-100"
                                    >
                                        <Trash2 size={12} /> Hapus {selectedIds.length} Item
                                    </button>
                                )}
                                <button
                                    onClick={() => navigate(`/mutasi/request?ids=${selectedIds.join(',')}`)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-bold shadow-sm shadow-blue-200"
                                >
                                    <ArrowLeftRight size={14} />
                                    Mutasi Masal
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-semibold hover:bg-red-100 transition-colors border border-red-100"
                                >
                                    <Trash2 size={12} /> Hapus {selectedIds.length} Item
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    {!validationMode && (
                        <>
                            <button onClick={() => navigate('/aset/input')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95">
                                <Plus size={18} /> Tambah Aset
                            </button>
                            <div className="flex gap-2 border-l border-slate-200 pl-3">
                                <button onClick={() => document.getElementById('importInput').click()} disabled={loading} className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all" title="Import Excel"><Download size={18} /> Import Data</button>
                                <input type="file" id="importInput" className="hidden" accept=".xlsx,.xls" onChange={handleImport} />
                                <button onClick={handleTemplateDownload} className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all" title="Download Template"><Download size={18} /> Template</button>
                            </div>
                        </>
                    )}
                    <div className="flex gap-2 border-l border-slate-200 pl-3">
                        <button onClick={() => setActionModal({ isOpen: true, type: 'export' })} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-lg shadow-green-200 transition-all hover:scale-105 active:scale-95" title="Export Excel"><Upload size={18} /> Export Data</button>
                        <button onClick={() => setActionModal({ isOpen: true, type: 'print' })} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95" title="Cetak Label QR"><QrCode size={18} /> Cetak QR</button>
                    </div>
                </div>
            </div>

            {/* Action Modal */}
            {actionModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-slate-800 text-left">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">
                            {actionModal.type === 'export' ? 'Export Data Aset' : 'Cetak QR Code Batch'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Pilih Lingkup Data</label>
                                <div className="space-y-2">
                                    {/* Option 1: Current filter */}
                                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                                        <input
                                            type="radio"
                                            name="scope"
                                            checked={targetUnitId === ''}
                                            onChange={() => setTargetUnitId('')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-800 text-sm">Sesuai Filter Tampilan</div>
                                            <div className="text-[10px] text-slate-500 italic">Data yang tampil di tabel saat ini ({filteredAssets.length} item)</div>
                                        </div>
                                    </label>

                                    {/* Option 2: Date Range */}
                                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                                        <input
                                            type="radio"
                                            name="scope"
                                            checked={targetUnitId === 'DATE_RANGE'}
                                            onChange={() => setTargetUnitId('DATE_RANGE')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-800 text-sm">Berdasarkan Rentang Tanggal</div>
                                            <div className="text-[10px] text-slate-500 mb-2 italic leading-tight">Aset berdasarkan tanggal perolehan/input</div>
                                            {targetUnitId === 'DATE_RANGE' && (
                                                <div className="grid grid-cols-2 gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Awal</label>
                                                        <input
                                                            type="date"
                                                            value={printRange.start}
                                                            onChange={(e) => setPrintRange(prev => ({ ...prev, start: e.target.value }))}
                                                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Akhir</label>
                                                        <input
                                                            type="date"
                                                            value={printRange.end}
                                                            onChange={(e) => setPrintRange(prev => ({ ...prev, end: e.target.value }))}
                                                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </label>

                                    {/* Option 3: Specific Unit */}
                                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                                        <input
                                            type="radio"
                                            name="scope"
                                            checked={targetUnitId !== '' && targetUnitId !== 'DATE_RANGE'}
                                            onChange={() => {
                                                if (units.length > 0) setTargetUnitId(units[0].id.toString());
                                            }}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-800 text-sm">Pilih Unit Tertentu</div>
                                            {targetUnitId !== '' && targetUnitId !== 'DATE_RANGE' && (
                                                <select
                                                    value={targetUnitId}
                                                    onChange={(e) => setTargetUnitId(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="mt-2 w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                                >
                                                    {units.map(u => (
                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Layout Selection */}
                        <div className="bg-slate-50 p-4 border-y border-slate-100 flex flex-col gap-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Layout Cetak (per halaman A4)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: '2x2', label: '4 Label (Besar)', desc: '2 x 2' },
                                    { id: '2x4', label: '8 Label (Standar)', desc: '2 x 4' },
                                    { id: '3x4', label: '12 Label (Sedang)', desc: '3 x 4' },
                                    { id: '3x7', label: '21 Label (Stiker)', desc: '3 x 7' },
                                    { id: '3x10', label: '30 Label (Kecil)', desc: '3 x 10' },
                                ].map((layout) => (
                                    <button
                                        key={layout.id}
                                        onClick={() => setPrintLayout(layout.id)}
                                        className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all ${printLayout === layout.id
                                            ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                    >
                                        <span className={`text-sm font-bold ${printLayout === layout.id ? 'text-blue-700' : 'text-slate-700'}`}>
                                            {layout.label}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-medium">Layout: {layout.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 pt-2 flex justify-end gap-3">
                            <button
                                onClick={() => setActionModal({ isOpen: false, type: null })}
                                className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleActionConfirmation}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                            >
                                {actionModal.type === 'export' ? 'Download Excel' : 'Cetak QR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Modal */}
            {
                validationModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-1">
                                Validasi Aset
                            </h3>
                            <p className="text-slate-500 text-sm mb-4">
                                Memproses validasi untuk <span className="font-bold text-blue-600">{validationModal.assetIds.length} aset</span> terpilih.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Status Validasi</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setValidationModal(prev => ({ ...prev, currentStatus: 'VALIDATED' }))}
                                            className={`p-2 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-1 ${validationModal.currentStatus === 'VALIDATED' ? 'bg-green-50 border-green-200 text-green-700 ring-2 ring-green-500 ring-offset-1' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            <CheckCircle size={20} className={validationModal.currentStatus === 'VALIDATED' ? 'text-green-600' : 'text-slate-400'} />
                                            Valid / Sah
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setValidationModal(prev => ({ ...prev, currentStatus: 'NEEDS_UPDATE' }))}
                                            className={`p-2 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-1 ${validationModal.currentStatus === 'NEEDS_UPDATE' ? 'bg-orange-50 border-orange-200 text-orange-700 ring-2 ring-orange-500 ring-offset-1' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            <AlertCircle size={20} className={validationModal.currentStatus === 'NEEDS_UPDATE' ? 'text-orange-600' : 'text-slate-400'} />
                                            Perlu Update
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setValidationModal(prev => ({ ...prev, currentStatus: 'REJECTED' }))}
                                            className={`p-2 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-1 ${validationModal.currentStatus === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-700 ring-2 ring-red-500 ring-offset-1' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            <XCircle size={20} className={validationModal.currentStatus === 'REJECTED' ? 'text-red-600' : 'text-slate-400'} />
                                            Ditolak
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Validasi</label>
                                    <textarea
                                        className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        rows={3}
                                        placeholder="Tuliskan catatan check fisik atau alasan penolakan..."
                                        value={validationModal.note}
                                        onChange={(e) => setValidationModal(prev => ({ ...prev, note: e.target.value }))}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setValidationModal({ isOpen: false, assetIds: [], currentStatus: 'VALIDATED', note: '' })}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleValidationSubmit}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2"
                                >
                                    <CheckCircle size={16} /> Simpan Validasi
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Advanced Filter Bar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4 relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Cari nama / kode aset..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="md:col-span-2 relative">
                        <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none"><Building2 size={16} /></div>
                        <select
                            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                            value={selectedUnit}
                            disabled={!isGlobalAdmin}
                            onChange={e => { setSelectedUnit(e.target.value); setSelectedRoom(''); }}
                        >
                            <option value="">Semua Unit</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>

                    <div className="md:col-span-2 relative">
                        <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none"><MapPin size={16} /></div>
                        <select
                            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                            value={selectedRoom}
                            onChange={e => setSelectedRoom(e.target.value)}
                            disabled={!selectedUnit && availableRooms.length === rooms.length}
                        >
                            <option value="">Semua Ruangan</option>
                            {availableRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>

                    <div className="md:col-span-2 relative">
                        {/* Validation Filter */}
                        <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none"><CheckCircle size={16} /></div>
                        <select
                            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                            value={validationFilter}
                            onChange={e => setValidationFilter(e.target.value)}
                        >
                            <option value="ALL">Status Validasi</option>
                            <option value="UNVERIFIED">Belum Valid (Unverified)</option>
                            <option value="VALIDATED">Sudah Valid (Validated)</option>
                            <option value="NEEDS_UPDATE">Perlu Perbaikan</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <button onClick={() => { setSearchTerm(''); if (isGlobalAdmin) setSelectedUnit(''); setSelectedRoom(''); }} className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50 flex justify-center items-center gap-2 text-sm">
                            <Filter size={16} /> Reset
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={paginatedAssets.length > 0 && selectedIds.length === paginatedAssets.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="px-6 py-4">Kode Aset</th>
                                <th className="px-6 py-4">Nama Item</th>
                                <th className="px-6 py-4">Unit / Divisi</th>
                                <th className="px-6 py-4">Lokasi (Ruang)</th>
                                <th className="px-6 py-4">Kondisi</th>
                                <th className="px-6 py-4 text-center">PIC</th>
                                <th className="px-6 py-4">Harga</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                                        Memuat data...
                                    </td>
                                </tr>
                            ) : (Array.isArray(paginatedAssets) && paginatedAssets.length > 0) ? paginatedAssets.map((asset) => (
                                <tr key={asset.id} className={`hover:bg-slate-50/80 transition-colors group ${selectedIds.includes(asset.id) ? 'bg-blue-50/30' : ''}`}>
                                    <td className="px-6 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedIds.includes(asset.id)}
                                            onChange={() => handleToggleSelect(asset.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-blue-600 font-mono tracking-tight">
                                        <Link to={`/aset/view/${asset.id}`} className="hover:underline">
                                            {asset.code}
                                        </Link>
                                        <div className="mt-1">
                                            {asset.validationStatus === 'VALIDATED' ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 border border-green-200 font-bold uppercase">
                                                    <CheckCircle size={10} /> Valid
                                                </span>
                                            ) : asset.validationStatus === 'NEEDS_UPDATE' ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700 border border-orange-200 font-bold uppercase">
                                                    <AlertCircle size={10} /> Cek Fisik
                                                </span>
                                            ) : asset.validationStatus === 'REJECTED' ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 border border-red-200 font-bold uppercase">
                                                    <XCircle size={10} /> Ditolak
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 border border-slate-200 font-bold uppercase">
                                                    Unverified
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        {asset.name}
                                        <div className="text-xs text-slate-400 font-normal">{asset.category?.name}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                                            {asset.unit?.name || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{asset.room?.name || '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${asset.condition === 'BAIK' ? 'bg-emerald-100 text-emerald-700' :
                                            asset.condition === 'RUSAK_RINGAN' ? 'bg-orange-100 text-orange-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {(asset.condition || 'BAIK').replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700">{asset.picName || (asset.pic?.name) || '-'}</span>
                                            {asset.pic && <span className="text-[10px] text-blue-500 font-medium uppercase">{asset.pic.username}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">Rp {(asset.price || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openValidationModal([asset.id], asset.validationStatus || 'VALIDATED')} className="p-1 hover:bg-green-50 text-green-600 rounded transition-colors" title="Validasi Aset"><CheckCircle size={16} /></button>
                                            <button onClick={() => openPrintModal(asset)} className="p-1 hover:bg-slate-800 hover:text-white text-slate-500 rounded transition-colors" title="Cetak Label QR"><QrCode size={16} /></button>
                                            <button onClick={() => navigate(`/mutasi/request?assetId=${asset.id}`)} className="p-1 hover:bg-orange-50 text-orange-600 rounded transition-colors" title="Ajukan Mutasi"><ArrowLeftRight size={16} /></button>
                                            {canProposeDisposal && (
                                                <button
                                                    onClick={() => setDisposalModal({
                                                        isOpen: true,
                                                        asset,
                                                        reason: '',
                                                        method: 'DIMUSNAHKAN',
                                                        notes: '',
                                                        disposalDate: new Date().toISOString().split('T')[0]
                                                    })}
                                                    className="p-1 hover:bg-red-50 text-red-600 rounded"
                                                    title="Usulkan Penghapusan"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            <button onClick={() => navigate(`/aset/edit/${asset.id}`)} className="p-1 hover:bg-blue-50 text-blue-600 rounded" title="Edit"><Edit size={16} /></button>
                                            {isGlobalAdmin && (
                                                <button onClick={() => handleDelete(asset.id)} className="p-1 hover:bg-slate-100 text-slate-400 rounded" title="Hapus Permanen (Database)">
                                                    <XCircle size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                                        Data tidak ditemukan untuk filter ini
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span>Tampilkan:</span>
                            <select
                                value={itemsPerPage}
                                onChange={e => setItemsPerPage(parseInt(e.target.value))}
                                className="bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {[10, 25, 50, 100, 500, 1000].map(limit => (
                                    <option key={limit} value={limit}>{limit}</option>
                                ))}
                            </select>
                        </div>
                        <span>Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} data</span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Sebelumnya
                        </button>
                        <span className="flex items-center px-2 bg-slate-100 rounded text-slate-600 font-medium">
                            Hal {currentPage} / {totalPages || 1}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Selanjutnya
                        </button>
                    </div>
                </div>
            </div>

            {/* Disposal Modal */}
            {
                disposalModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-slate-800">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3 mb-4 text-red-600">
                                <Trash2 size={24} />
                                <h3 className="text-xl font-bold">Usulan Penghapusan</h3>
                            </div>

                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg mb-6">
                                <p className="text-xs text-red-700 leading-relaxed font-medium">
                                    {disposalModal.assetIds && disposalModal.assetIds.length > 0 ? (
                                        <>Anda mengajukan <span className="font-bold underline">usulan penghapusan masal</span> untuk <span className="font-bold underline text-sm">{disposalModal.assetIds.length} aset</span> terpilih.</>
                                    ) : (
                                        <>Anda mengajukan <span className="font-bold underline">usulan</span> untuk menghapus <span className="font-bold underline">{disposalModal.asset?.name}</span> ({disposalModal.asset?.code}) dari inventaris aktif.</>
                                    )}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tanggal</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={disposalModal.disposalDate}
                                            onChange={e => setDisposalModal(prev => ({ ...prev, disposalDate: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Metode</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={disposalModal.method}
                                            onChange={e => setDisposalModal(prev => ({ ...prev, method: e.target.value }))}
                                        >
                                            <option value="DIMUSNAHKAN">DIMUSNAHKAN</option>
                                            <option value="DIJUAL">DIJUAL / LELANG</option>
                                            <option value="HIBAH">HIBAH / DONASI</option>
                                            <option value="HILANG">HILANG / DICURI</option>
                                            <option value="TUKAR_TAMBAH">TUKAR TAMBAH</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Alasan Penghapusan</label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        rows={2}
                                        placeholder="Contoh: Rusak parah, tidak bisa diperbaiki lagi..."
                                        value={disposalModal.reason}
                                        onChange={e => setDisposalModal(prev => ({ ...prev, reason: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Catatan Tambahan (Opsional)</label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        rows={2}
                                        placeholder="..."
                                        value={disposalModal.notes}
                                        onChange={e => setDisposalModal(prev => ({ ...prev, notes: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    onClick={() => setDisposalModal({ isOpen: false, asset: null, assetIds: [], reason: '', method: 'DIMUSNAHKAN', notes: '', disposalDate: '' })}
                                    className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleDisposalSubmit}
                                    disabled={!disposalModal.reason || loading}
                                    className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
                                >
                                    {loading ? 'Memproses...' : 'Kirim Usulan'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Hidden Print Components - Render only when needed to save memory */}
            {isPreparingPrint && (
                <div className="hidden">
                    {printAsset && <LabelPrint ref={printRef} asset={printAsset} institute={settings} />}
                    <BatchLabelPrint
                        ref={batchPrintRef}
                        assets={Array.isArray(batchPrintAssets) && batchPrintAssets.length > 0 ? batchPrintAssets : []}
                        institute={settings}
                        layout={printLayout}
                    />
                </div>
            )}
        </div >
    );
};

export default AssetList;
