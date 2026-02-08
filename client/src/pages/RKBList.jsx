import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Calendar, Upload, Download, FileSpreadsheet } from 'lucide-react';
import api from '../lib/axios';
import * as XLSX from 'xlsx';

const RKBList = () => {
    const [rkbs, setRKBs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ fiscalYear: new Date().getFullYear(), unitId: '' });

    // Import State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState([]);
    const [importConfig, setImportConfig] = useState({ fiscalYear: new Date().getFullYear(), unitId: '' });
    const fileInputRef = useRef(null);

    // Create State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRKB, setNewRKB] = useState({ fiscalYear: new Date().getFullYear(), unitId: '' });

    const [units, setUnits] = useState([]);

    useEffect(() => {
        fetchRKBs();
        fetchUnits();
    }, [filter.fiscalYear, filter.unitId]);

    const fetchUnits = async () => {
        try {
            const res = await api.get('/master/units');
            setUnits(res.data);
        } catch (error) {
            console.error("Failed fetch units", error);
        }
    }

    const fetchRKBs = async () => {
        try {
            const params = new URLSearchParams(filter).toString();
            const res = await api.get(`/rkb?${params}`);
            setRKBs(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- CREATE NEW (MANUAL) ---
    const handleCreateNew = async (e) => {
        e.preventDefault();
        try {
            await api.post('/rkb', newRKB);
            alert('RKB Berhasil dibuat! Silakan klik "Lihat Detail" untuk menambah item.');
            setShowCreateModal(false);
            fetchRKBs();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal membuat RKB');
        }
    };

    // --- TEMPLATE & EXPORT ---
    const handleDownloadTemplate = () => {
        const template = [
            {
                "Nama Barang": "Laptop Core i5",
                "Spesifikasi": "RAM 16GB SSD 512GB",
                "Jumlah": 5,
                "Satuan": "Unit",
                "Estimasi Harga Satuan": 10000000,
                "Kategori (ASSET/NON_ASSET)": "ASSET",
                "Prioritas (HIGH/MEDIUM/LOW)": "HIGH",
                "Bulan Perencanaan (1-12)": 1
            }
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template RKB");
        XLSX.writeFile(wb, "Template_RKB.xlsx");
    };

    const handleExportData = () => {
        if (rkbs.length === 0) return alert('Tidak ada data untuk diexport');

        const exportData = [];
        rkbs.forEach(rkb => {
            rkb.items.forEach(item => {
                exportData.push({
                    "Tahun": rkb.fiscalYear,
                    "Unit": rkb.unit?.name,
                    "Status": rkb.status,
                    "Nama Barang": item.name,
                    "Spesifikasi": item.spec,
                    "Jumlah": item.qty,
                    "Satuan": item.unit,
                    "Harga Satuan": item.estPrice,
                    "Total Estimasi": item.qty * item.estPrice,
                    "Kategori": item.category,
                    "Bulan": item.month || 1
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data RKB");
        XLSX.writeFile(wb, `Export_RKB_${filter.fiscalYear}.xlsx`);
    };

    // --- IMPORT LOGIC ---
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            const formatted = data.map(row => ({
                name: row["Nama Barang"],
                spec: row["Spesifikasi"],
                qty: row["Jumlah"],
                unit: row["Satuan"],
                estPrice: row["Estimasi Harga Satuan"],
                category: row["Kategori (ASSET/NON_ASSET)"],
                priority: row["Prioritas (HIGH/MEDIUM/LOW)"],
                month: row["Bulan Perencanaan (1-12)"]
            }));
            setImportData(formatted);
        };
        reader.readAsBinaryString(file);
    };

    const submitImport = async () => {
        if (importData.length === 0) return alert('Data kosong / File belum diload');
        if (!importConfig.unitId) return alert('Pilih Unit Tujuan');

        try {
            await api.post('/rkb/import', {
                fiscalYear: importConfig.fiscalYear,
                unitId: importConfig.unitId,
                items: importData
            });
            alert('Import Berhasil!');
            setShowImportModal(false);
            setImportData([]);
            fetchRKBs();
        } catch (error) {
            alert('Gagal Import: ' + (error.response?.data?.error || error.message));
        }
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Rencana Kebutuhan Barang (RKB)</h1>
                    <p className="text-slate-500 text-sm">Perencanaan anggaran tahunan per unit kerja</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowImportModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                        <Upload size={18} /> Import Excel
                    </button>
                    <button onClick={handleExportData} className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                        <Download size={18} /> Export Data
                    </button>
                    <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                        <Plus size={18} /> Buat Baru
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <Calendar size={16} className="text-slate-400" />
                <select
                    className="border-none bg-slate-50 rounded-lg px-3 py-1.5 text-sm focus:ring-0 font-semibold"
                    value={filter.fiscalYear}
                    onChange={e => setFilter({ ...filter, fiscalYear: e.target.value })}
                >
                    <option value="2024">TA 2024</option>
                    <option value="2025">TA 2025</option>
                    <option value="2026">TA 2026</option>
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rkbs.map(rkb => (
                    <div key={rkb.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{rkb.unit?.name}</h3>
                                <div className="text-xs text-slate-500 font-mono mt-1">TA {rkb.fiscalYear}</div>
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${rkb.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                                }`}>{rkb.status}</span>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Total Budget</span>
                                <span className="font-bold text-slate-700">Rp {Number(rkb.totalBudget).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Jumlah Item</span>
                                <span className="font-bold text-slate-700">{rkb.items?.length || 0} Item</span>
                            </div>
                        </div>

                        const navigate = useNavigate();

                        // ... (inside return)
                        <button onClick={() => navigate(`/rkb/${rkb.id}`)} className="w-full py-2 border border-blue-200 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 flex justify-center items-center gap-2">
                            <Eye size={16} /> Lihat Detail/Input Item
                        </button>
                    </div>
                ))}
            </div>

            {/* Modal Import */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
                    <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <FileSpreadsheet className="text-green-600" /> Import RKB via Excel
                        </h2>

                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 mb-4">
                                <p className="font-bold mb-1">Langkah-langkah:</p>
                                <ol className="list-decimal pl-4 space-y-1">
                                    <li>Download Template Excel terlebih dahulu.</li>
                                    <li>Isi data barang sesuai kolom (Termasuk BULAN).</li>
                                    <li>Upload file Excel yang sudah diisi.</li>
                                </ol>
                                <button onClick={handleDownloadTemplate} className="mt-3 text-xs bg-white border border-blue-200 px-3 py-1 rounded font-bold hover:bg-blue-100">
                                    ⬇️ Download Template
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Tahun Anggaran</label>
                                    <select
                                        className="w-full border p-2 rounded text-sm"
                                        value={importConfig.fiscalYear}
                                        onChange={e => setImportConfig({ ...importConfig, fiscalYear: e.target.value })}
                                    >
                                        <option value="2024">2024</option>
                                        <option value="2025">2025</option>
                                        <option value="2026">2026</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Unit Tujuan</label>
                                    <select
                                        className="w-full border p-2 rounded text-sm"
                                        value={importConfig.unitId}
                                        onChange={e => setImportConfig({ ...importConfig, unitId: e.target.value })}
                                    >
                                        <option value="">-- Pilih Unit --</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                                    <span className="text-sm font-bold text-slate-600">Klik untuk Upload File Excel</span>
                                    <p className="text-xs text-slate-400 mt-1">{importData.length > 0 ? `${importData.length} baris data ditemukan` : 'Belum ada file dipilih'}</p>
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg">Batal</button>
                            <button onClick={submitImport} className="px-4 py-2 bg-green-600 text-white font-bold text-sm rounded-lg hover:bg-green-700 shadow-lg shadow-green-600/20">
                                Proses Import
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Create New (Manual) */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
                    <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Buat RKB Baru</h2>
                        <form onSubmit={handleCreateNew} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Tahun Anggaran</label>
                                <select
                                    className="w-full border p-2 rounded text-sm"
                                    value={newRKB.fiscalYear}
                                    onChange={e => setNewRKB({ ...newRKB, fiscalYear: e.target.value })}
                                >
                                    <option value="2024">2024</option>
                                    <option value="2025">2025</option>
                                    <option value="2026">2026</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Unit Tujuan</label>
                                <select
                                    className="w-full border p-2 rounded text-sm"
                                    value={newRKB.unitId}
                                    onChange={e => setNewRKB({ ...newRKB, unitId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Pilih Unit --</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg">Batal</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RKBList;
