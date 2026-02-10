import { useState, useRef, useEffect } from 'react';
import { Download, Upload, Plus, Search, Filter, Edit, Trash2, Building2, MapPin, Printer, QrCode } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { LabelPrint, BatchLabelPrint } from '../components/LabelPrint';
import { useReactToPrint } from 'react-to-print';
import api from '../lib/axios';

const AssetList = () => {
    const navigate = useNavigate();
    const [units, setUnits] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const [currentUser] = useState(JSON.parse(localStorage.getItem('user')) || {});
    const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(currentUser.role);

    // Filter Logic
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUnit, setSelectedUnit] = useState(isGlobalAdmin ? '' : (currentUser.unitId?.toString() || ''));
    const [selectedRoom, setSelectedRoom] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Fetch Data from Backend
    const fetchData = async () => {
        try {
            setLoading(true);
            const [respAssets, respUnits, respRooms] = await Promise.all([
                api.get('/assets').catch(err => { throw new Error(`Data Aset: ${err.message}`); }),
                api.get('/master/units').catch(err => { throw new Error(`Data Unit: ${err.message}`); }),
                api.get('/master/rooms').catch(err => { throw new Error(`Data Ruangan: ${err.message}`); })
            ]);
            setAssets(respAssets.data);
            setUnits(respUnits.data);
            setRooms(respRooms.data);
        } catch (error) {
            console.error('Fetch error:', error);
            if (!error.message.includes('401') && !error.message.includes('403')) {
                alert('Gagal mengambil data dari server. Error: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Force selection if not global admin
        if (!isGlobalAdmin && currentUser.unitId) {
            setSelectedUnit(currentUser.unitId.toString());
        }
    }, [currentUser]);

    // Print Handling
    const [printAsset, setPrintAsset] = useState(null);
    const printRef = useRef();
    const batchPrintRef = useRef();

    const handlePrintSingle = useReactToPrint({
        contentRef: printRef,
        onAfterPrint: () => setPrintAsset(null),
    });

    const handleBatchPrint = useReactToPrint({
        contentRef: batchPrintRef,
    });

    const openPrintModal = (asset) => {
        setPrintAsset(asset);
        setTimeout(() => handlePrintSingle(), 100);
    };

    // Filter Logic
    const filteredAssets = assets.filter(a => {
        const name = a.name || '';
        const code = a.code || '';
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesUnit = selectedUnit ? a.unitId === parseInt(selectedUnit) : true;
        const matchesRoom = selectedRoom ? a.roomId === parseInt(selectedRoom) : true;

        return matchesSearch && matchesUnit && matchesRoom;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
    const paginatedAssets = filteredAssets.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedUnit, selectedRoom, itemsPerPage]);

    const availableRooms = selectedUnit
        ? rooms.filter(r => r.unitId === parseInt(selectedUnit))
        : rooms;

    const handleTemplateDownload = () => {
        const headers = [[
            'Nama Aset', 'Merek Aset', 'Vendor Aset', 'Umur Ekonomis Aset(hari)', 'Umur Ekonomis Aset(bulan)', 'Umur Ekonomis Aset(tahun)',
            'Kondisi Aset', 'Sumber Dana Aset', 'Ruangan Aset', 'Unit Aset', 'Kategori', 'Tanggal Transaksi Masuk (yyyy-mm-dd)',
            'Jenis Transaksi Masuk', 'Bukti Transaksi Masuk', 'Harga Perolehan', 'NIK/NIY Pihak Kedua', 'Apakah Pihak Kedua Karyawan? (ya/tidak)',
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

    const handleExport = () => {
        const now = new Date();
        const exportData = filteredAssets.map((a, index) => {
            const purchaseDate = new Date(a.purchaseDate);
            const monthsElapsed = Math.max(0, (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth()));
            const totalMonths = (a.usefulLife || 5) * 12;
            const monthlyDepreciation = Math.round(a.price / totalMonths);
            const accumulatedDepreciation = Math.min(a.price, monthlyDepreciation * monthsElapsed);
            const bookValue = Math.max(0, a.price - accumulatedDepreciation);

            // Days calculation (rough estimation for display)
            const msPerDay = 24 * 60 * 60 * 1000;
            const daysElapsed = Math.max(0, Math.floor((now - purchaseDate) / msPerDay));

            return {
                'No': index + 1,
                'Kode': a.code,
                'Nama': a.name,
                'Merek': a.brand || '-',
                'Vendor': a.vendor?.name || '-',
                'Tanggal Perolehan': a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('id-ID') : '-',
                'Status Perolehan': 'Beli Baru', // Placeholder
                'Harga Perolehan': a.price,
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
                'Tanggal PHPP': '-',
                'Hari Penyusutan Sebelum PHPP': '-',
                'Nilai Penyusutan Saat PHPP': '-',
                'Nilai Buku Saat PHPP': '-',
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
        XLSX.writeFile(wb, `Laporan_Aset_Terkini_${new Date().toISOString().split('T')[0]}.xlsx`);
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

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Daftar Aset</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 text-sm">Monitor aset per unit dan ruangan</p>
                        {selectedIds.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-semibold hover:bg-red-100 transition-colors animate-in zoom-in-95 duration-200 border border-red-100"
                            >
                                <Trash2 size={12} /> Hapus {selectedIds.length} Item
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={handleBatchPrint} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 flex items-center gap-2 shadow-sm">
                        <Printer size={16} /> Batch Print QR
                    </button>
                    <button onClick={handleTemplateDownload} className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors">
                        Download Template
                    </button>
                    <button onClick={handleExport} className="px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2">
                        <Download size={16} /> Export
                    </button>
                    <label className="px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                        <Upload size={16} /> Import
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImport} />
                    </label>
                    <Link to="/aset/input" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200">
                        <Plus size={16} /> Tambah Item
                    </Link>
                </div>
            </div>

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

                    <div className="md:col-span-3 relative">
                        <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none"><Building2 size={16} /></div>
                        <select
                            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                            value={selectedUnit}
                            disabled={!isGlobalAdmin}
                            onChange={e => { setSelectedUnit(e.target.value); setSelectedRoom(''); }}
                        >
                            <option value="">Semua Unit / Divisi</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        {!isGlobalAdmin && <div className="text-[10px] text-blue-600 mt-1 font-semibold ml-1">Unit Terkunci (Role-based)</div>}
                    </div>

                    <div className="md:col-span-3 relative">
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
                                <th className="px-6 py-4">Harga</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                                        Memuat data...
                                    </td>
                                </tr>
                            ) : paginatedAssets.length > 0 ? paginatedAssets.map((asset) => (
                                <tr key={asset.id} className={`hover:bg-slate-50/80 transition-colors group ${selectedIds.includes(asset.id) ? 'bg-blue-50/30' : ''}`}>
                                    <td className="px-6 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedIds.includes(asset.id)}
                                            onChange={() => handleToggleSelect(asset.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-blue-600 font-mono tracking-tight">{asset.code}</td>
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
                                    <td className="px-6 py-4 text-slate-600">Rp {(asset.price || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openPrintModal(asset)} className="p-1 hover:bg-slate-800 hover:text-white text-slate-500 rounded transition-colors" title="Cetak Label QR"><QrCode size={16} /></button>
                                            <button onClick={() => navigate(`/aset/edit/${asset.id}`)} className="p-1 hover:bg-blue-50 text-blue-600 rounded" title="Edit"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(asset.id)} className="p-1 hover:bg-red-50 text-red-500 rounded" title="Hapus"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
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
                                {[10, 25, 50, 100].map(limit => (
                                    <option key={limit} value={limit}>{limit}</option>
                                ))}
                            </select>
                        </div>
                        <span>Menampilkan {paginatedAssets.length} dari {filteredAssets.length} data</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 border border-slate-200 bg-white rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Sebelumnya
                        </button>
                        <div className="flex items-center gap-1">
                            <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md font-medium border border-blue-100">
                                {currentPage}
                            </span>
                            <span className="text-slate-400 mx-1">dari</span>
                            <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-md">
                                {totalPages || 1}
                            </span>
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1.5 border border-slate-200 bg-white rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Berikutnya
                        </button>
                    </div>
                </div>
            </div>

            {/* Hidden Print Components */}
            <div className="hidden">
                {printAsset && <LabelPrint ref={printRef} asset={printAsset} />}
                <BatchLabelPrint ref={batchPrintRef} assets={filteredAssets} />
            </div>
        </div>
    );
};

export default AssetList;
