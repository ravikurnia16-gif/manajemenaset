import { useState, useRef } from 'react';
import { Download, Upload, Plus, Search, Filter, Edit, Trash2, Building2, MapPin, Printer, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { LabelPrint, BatchLabelPrint } from '../components/LabelPrint';
import { useReactToPrint } from 'react-to-print';

const AssetList = () => {
    // Mock Master Data
    const units = [
        { id: 1, name: 'IT Department' },
        { id: 2, name: 'Human Resources' },
        { id: 3, name: 'Finance' },
        { id: 4, name: 'General Affairs' }
    ];

    const rooms = [
        { id: 1, unitId: 1, name: 'R. Server Lt.1' },
        { id: 2, unitId: 1, name: 'R. Dev Team' },
        { id: 3, unitId: 2, name: 'R. Meeting HR' },
        { id: 4, unitId: 3, name: 'R. Arsip Keuangan' },
        { id: 5, unitId: 4, name: 'Lobby Utama' }
    ];

    // Mock Assets (Updated structure with unitId and roomId)
    const [assets, setAssets] = useState([
        { id: 1, code: 'AST-KMP-2025-0001', name: 'MacBook Pro M3', category: 'Elektronik', unit: 'IT Department', unitId: 1, location: 'R. Server Lt.1', roomId: 1, condition: 'BAIK', price: 25000000 },
        { id: 2, code: 'AST-FRN-2025-0002', name: 'Meja Kerja Staff', category: 'Furniture', unit: 'Human Resources', unitId: 2, location: 'R. Meeting HR', roomId: 3, condition: 'BAIK', price: 1500000 },
        { id: 3, code: 'AST-KMP-2024-0010', name: 'Monitor LG 24"', category: 'Elektronik', unit: 'IT Department', unitId: 1, location: 'R. Dev Team', roomId: 2, condition: 'RUSAK_RINGAN', price: 2000000 },
        { id: 4, code: 'AST-KEND-2023-005', name: 'Mobil Operasional', category: 'Kendaraan', unit: 'General Affairs', unitId: 4, location: 'Lobby Utama', roomId: 5, condition: 'BAIK', price: 250000000 },
    ]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('');
    const [selectedRoom, setSelectedRoom] = useState('');

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
        // Small delay to allow render before print triggers
        setTimeout(() => handlePrintSingle(), 100);
    };

    // Filter Logic
    const filteredAssets = assets.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesUnit = selectedUnit ? a.unitId === parseInt(selectedUnit) : true;
        const matchesRoom = selectedRoom ? a.roomId === parseInt(selectedRoom) : true;

        return matchesSearch && matchesUnit && matchesRoom;
    });

    // Derived State for Room Dropdown (Dependent on Unit)
    const availableRooms = selectedUnit
        ? rooms.filter(r => r.unitId === parseInt(selectedUnit))
        : rooms;

    const handleTemplateDownload = () => {
        const headers = [[
            'Nama Aset', 'Merek Aset', 'Vendor Aset',
            'Umur Ekonomis Aset(hari)', 'Umur Ekonomis Aset(bulan)', 'Umur Ekonomis Aset(tahun)',
            'Kondisi Aset', 'Sumber Dana Aset', 'Ruangan Aset', 'Unit Aset', 'Kategori',
            'Tanggal Transaksi Masuk (yyyy-mm-dd)', 'Jenis Transaksi Masuk', 'Bukti Transaksi Masuk',
            'Harga Perolehan', 'NIK/NIY Pihak Kedua', 'Apakah Pihak Kedua Karyawan? (ya/tidak)',
            'Nama Pihak Kedua (hanya digunakan kalau pihak kedua baru)', 'Alamat Pihak Kedua (hanya digunakan kalau pihak kedua baru)',
            'Tanggal Transaksi Keluar (yyyy-mm-dd)', 'Jenis Transaksi Keluar', 'Bukti Transaksi Keluar', 'Harga Jual',
            'NIK/NIY Pihak Kedua (Keluar)', 'Apakah Pihak Kedua Karyawan? (Keluar)',
            'Nama Pihak Kedua (Keluar)', 'Alamat Pihak Kedua (Keluar)'
        ]];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wscols = headers[0].map(() => ({ wch: 20 }));
        ws['!cols'] = wscols;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template Custom");
        XLSX.writeFile(wb, "Template_Aset_Lengkap.xlsx");
    };

    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(filteredAssets);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Aset");
        XLSX.writeFile(wb, "Data_Aset_Export.xlsx");
    };

    const handleImport = (e) => {
        alert("Fitur Import akan disesuaikan dengan Unit/Ruangan yang ada di database.");
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Daftar Aset</h1>
                    <p className="text-slate-500 text-sm">Monitor aset per unit dan ruangan (Item-Level Tracking)</p>
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
                            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                            value={selectedUnit}
                            onChange={e => { setSelectedUnit(e.target.value); setSelectedRoom(''); }}
                        >
                            <option value="">Semua Unit / Divisi</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
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
                        <button onClick={() => { setSearchTerm(''); setSelectedUnit(''); setSelectedRoom(''); }} className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50 flex justify-center items-center gap-2 text-sm">
                            <Filter size={16} /> Reset
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr>
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
                            {filteredAssets.length > 0 ? filteredAssets.map((asset) => (
                                <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-blue-600 font-mono tracking-tight">{asset.code}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        {asset.name}
                                        <div className="text-xs text-slate-400 font-normal">{asset.category}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                                            {asset.unit}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{asset.location}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${asset.condition === 'BAIK' ? 'bg-emerald-100 text-emerald-700' :
                                            asset.condition === 'RUSAK_RINGAN' ? 'bg-orange-100 text-orange-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {asset.condition.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">Rp {asset.price.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openPrintModal(asset)} className="p-1 hover:bg-slate-800 hover:text-white text-slate-500 rounded transition-colors" title="Cetak Label QR"><QrCode size={16} /></button>
                                            <button className="p-1 hover:bg-blue-50 text-blue-600 rounded" title="Edit"><Edit size={16} /></button>
                                            <button className="p-1 hover:bg-red-50 text-red-500 rounded" title="Hapus"><Trash2 size={16} /></button>
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

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500">
                    <span>Menampilkan {filteredAssets.length} dari {assets.length} data</span>
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
