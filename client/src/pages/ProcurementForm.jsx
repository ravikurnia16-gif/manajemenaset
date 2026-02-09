import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Upload, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx'; // Import XLSX
import api from '../lib/axios';

const ProcurementForm = () => {
    const navigate = useNavigate();
    const [header, setHeader] = useState({ title: '', type: 'ASSET', rkbId: '' });
    const [fundingSources, setFundingSources] = useState(['Yayasan', 'Hibah', 'Wakaf', 'Mandiri']);
    const [items, setItems] = useState([
        { name: '', spec: '', qty: 1, unit: 'unit', estPrice: 0, fundingSource: 'Yayasan' }
    ]);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        api.get('/assets/funding-sources')
            .then(res => {
                if (Array.isArray(res.data)) {
                    // Merge defaults with API data, convert to Set to remove duplicates
                    const defaults = ['Yayasan', 'Hibah', 'Wakaf'];
                    const uniqueSources = [...new Set([...defaults, ...res.data])];
                    setFundingSources(uniqueSources);
                } else {
                    setFundingSources(['Yayasan', 'Hibah', 'Wakaf', 'Mandiri']);
                }
            })
            .catch(err => {
                console.error("Failed to fetch funding sources:", err);
                setFundingSources(['Mandiri']);
            });
    }, []);

    const handleItemChange = (index, field, value) => {
        setItems(prevItems => prevItems.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ));
    };

    const addItem = () => {
        setItems([...items, { name: '', spec: '', qty: 1, unit: 'unit', estPrice: 0, fundingSource: 'Yayasan' }]);
    };

    const removeItem = (index) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    // Handle File Import for Items
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            // Map Excel columns to Item format (Flexible support)
            const importedItems = data.map(row => ({
                name: row['Mq'] || row['Nama Barang'] || row['Nama'] || '',
                spec: row['Spesifikasi'] || row['Spec'] || '',
                qty: parseInt(row['Jumlah'] || row['Qty'] || 1) || 1,
                unit: row['Satuan'] || row['Unit'] || 'Pcs',
                estPrice: parseFloat(row['Harga'] || row['Estimasi Harga'] || 0) || 0,
                fundingSource: row['Sumber Dana'] || row['Funding'] || 'Mandiri'
            })).filter(item => item.name); // Filter empty rows

            if (importedItems.length > 0) {
                // Confirm overwrite or append? Let's overwrite for simplicity or valid usecase
                if (confirm(`Ditemukan ${importedItems.length} item. Timpa daftar barang saat ini?`)) {
                    setItems(importedItems);
                } else {
                    setItems([...items, ...importedItems]);
                }
            } else {
                alert('Tidak ada data valid ditemukan di file Excel.');
            }
            e.target.value = null; // Reset input
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplate = () => {
        const template = [
            { "Nama Barang": "Laptop", "Spesifikasi": "RAM 8GB", "Jumlah": 1, "Satuan": "Unit", "Estimasi Harga": 5000000, "Sumber Dana": "Mandiri" }
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Template_Request.xlsx");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!header.title) return alert('Mohon isi Judul Pengajuan');

        if (!confirm('Kirim pengajuan ini?')) return;
        setLoading(true);
        try {
            await api.post('/procurements', { ...header, items });
            alert('Pengajuan berhasil dikirim!');
            navigate('/procurements');
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal mengirim');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in slide-in-from-bottom-4">
            <button onClick={() => navigate('/procurements')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600">
                <ArrowLeft size={16} /> Batal & Kembali
            </button>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Buat Request Baru</h1>
                        <p className="text-slate-500 text-sm">Ajukan permintaan pengadaan barang aset atau kebutuhan operasional.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Header Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Judul Pengajuan (Wajib)</label>
                            <input
                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700"
                                placeholder="Contoh: Pengadaan Laptop Baru untuk Divisi IT"
                                value={header.title}
                                onChange={e => setHeader({ ...header, title: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Jenis Pengadaan</label>
                            <select
                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={header.type}
                                onChange={e => setHeader({ ...header, type: e.target.value })}
                            >
                                <option value="ASSET">Aset (Barang Modal/Investasi)</option>
                                <option value="NON_ASSET">Non-Aset (Habis Pakai)</option>
                            </select>
                        </div>
                    </div>

                    {/* Items Section */}
                    <div>
                        <div className="flex justify-between items-end mb-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <div>
                                <h3 className="text-lg font-bold text-blue-900">Daftar Barang</h3>
                                <p className="text-xs text-blue-600">List barang yang akan diajukan.</p>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                />
                                <button type="button" onClick={handleDownloadTemplate} className="flex items-center gap-1 text-slate-500 hover:text-blue-600 text-xs font-bold px-3 py-2 border rounded-lg bg-white">
                                    <Download size={14} /> Template
                                </button>
                                <button type="button" onClick={() => fileInputRef.current.click()} className="flex items-center gap-1 text-green-600 hover:text-green-700 text-xs font-bold px-3 py-2 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100">
                                    <FileSpreadsheet size={14} /> Import Excel
                                </button>
                                <button type="button" onClick={addItem} className="flex items-center gap-1 text-white bg-blue-600 hover:bg-blue-700 text-xs font-bold px-3 py-2 rounded-lg shadow-sm">
                                    <Plus size={14} /> Tambah Manual
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-4 items-start p-4 border border-slate-200 rounded-xl bg-white hover:border-blue-300 transition-colors group">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-xs mt-1">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nama Barang</label>
                                                <input
                                                    placeholder="Contoh: Laptop Dell XPS"
                                                    className="border border-slate-300 p-2 rounded text-sm font-semibold w-full focus:border-blue-500 outline-none"
                                                    value={item.name}
                                                    onChange={e => handleItemChange(index, 'name', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Spesifikasi</label>
                                                <input
                                                    placeholder="Contoh: RAM 16GB, SSD 512GB"
                                                    className="border border-slate-300 p-2 rounded text-sm w-full focus:border-blue-500 outline-none"
                                                    value={item.spec}
                                                    onChange={e => handleItemChange(index, 'spec', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-4">
                                            <div className="col-span-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Jumlah</label>
                                                <input
                                                    type="number" placeholder="1"
                                                    className="border border-slate-300 p-2 rounded text-sm w-full focus:border-blue-500 outline-none"
                                                    value={item.qty}
                                                    onChange={e => handleItemChange(index, 'qty', e.target.value)}
                                                    required
                                                    min="1"
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Satuan</label>
                                                <input
                                                    placeholder="Pcs/Unit"
                                                    className="border border-slate-300 p-2 rounded text-sm w-full focus:border-blue-500 outline-none"
                                                    value={item.unit}
                                                    onChange={e => handleItemChange(index, 'unit', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Est. Harga (Rp)</label>
                                                <input
                                                    type="number" placeholder="0"
                                                    className="border border-slate-300 p-2 rounded text-sm w-full focus:border-blue-500 outline-none"
                                                    value={item.estPrice}
                                                    onChange={e => handleItemChange(index, 'estPrice', e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Sumber Dana</label>
                                                <select
                                                    className="border border-slate-300 p-2 rounded text-sm w-full focus:border-blue-500 outline-none bg-white"
                                                    value={item.fundingSource}
                                                    onChange={e => handleItemChange(index, 'fundingSource', e.target.value)}
                                                >
                                                    {fundingSources.map((fs, idx) => (
                                                        <option key={idx} value={fs}>{fs}</option>
                                                    ))}
                                                </select>
                                                {/* Datalist moved outside loop */}
                                            </div>
                                        </div>
                                    </div>
                                    {items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(index)} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/procurements')}
                            className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-1 flex items-center gap-2"
                        >
                            {loading ? 'Mengirim...' : 'Kirim Request'} <Upload size={18} />
                        </button>
                    </div>
                    {/* Shared Datalist for Funding Sources */}
                    <datalist id="funding-options">
                        {Array.isArray(fundingSources) && fundingSources.map((src, i) => (
                            <option key={i} value={src} />
                        ))}
                    </datalist>
                </form>
            </div>
        </div>
    );
};

export default ProcurementForm;
