import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Upload, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx'; // Import XLSX for reading
import ExcelJS from 'exceljs'; // Import ExcelJS for writing with validation
import api from '../lib/axios';

const ProcurementForm = () => {
    const navigate = useNavigate();
    const [header, setHeader] = useState({ title: '', rkbId: '' });
    const [fundingSources, setFundingSources] = useState(['Yayasan', 'Hibah', 'Wakaf', 'Mandiri']);
    const [items, setItems] = useState([
        { name: '', spec: '', qty: 1, unit: 'unit', estPrice: 0, fundingSource: 'Yayasan', type: 'ASSET' }
    ]);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        api.get('/assets/funding-sources')
            .then(res => {
                if (Array.isArray(res.data)) {
                    // Merge defaults with API data, convert to Set to remove duplicates
                    const defaults = ['Yayasan', 'Hibah', 'Wakaf', 'BOS', 'Cashback', 'Lainnya'];
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
        setItems([...items, { name: '', spec: '', qty: 1, unit: 'unit', estPrice: 0, fundingSource: 'Yayasan', type: 'ASSET' }]);
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
            const errors = [];
            const importedItems = data.map((row, index) => {
                const rowNum = index + 2; // Header is row 1
                const name = row['Mq'] || row['Nama Barang'] || row['Nama'] || '';
                const qty = parseInt(row['Jumlah'] || row['Qty'] || 0);
                const unit = row['Satuan'] || row['Unit'] || '';

                if (!name) errors.push(`Baris ${rowNum}: Nama Barang wajib diisi.`);
                if (!qty || qty <= 0) errors.push(`Baris ${rowNum}: Jumlah harus lebih dari 0.`);
                if (!unit) errors.push(`Baris ${rowNum}: Satuan wajib diisi (Pcs/Unit/dll).`);

                const rawType = row['Jenis'] || row['Type'] || 'Aset';
                const type = (rawType.toLowerCase().includes('non')) ? 'NON_ASSET' : 'ASSET';

                return {
                    name,
                    spec: row['Spesifikasi'] || row['Spec'] || '-',
                    qty,
                    unit,
                    estPrice: parseFloat(row['Harga'] || row['Estimasi Harga'] || 0) || 0,
                    fundingSource: row['Sumber Dana'] || row['Funding'] || 'Mandiri',
                    type
                };
            });

            if (errors.length > 0) {
                alert(`Import Gagal! Mohon lengkapi data berikut di Excel:\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? '\n...dan ' + (errors.length - 10) + ' error lainnya' : ''}`);
                e.target.value = null;
                return;
            }

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

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');

        worksheet.columns = [
            { header: 'Nama Barang', key: 'name', width: 25 },
            { header: 'Spesifikasi', key: 'spec', width: 30 },
            { header: 'Jumlah', key: 'qty', width: 10 },
            { header: 'Satuan', key: 'unit', width: 10 },
            { header: 'Estimasi Harga', key: 'estPrice', width: 15 },
            { header: 'Sumber Dana', key: 'fundingSource', width: 15 },
            { header: 'Jenis', key: 'type', width: 15 }
        ];

        // Style the header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add sample data
        worksheet.addRow({ name: 'Laptop', spec: 'RAM 16GB', qty: 1, unit: 'Unit', estPrice: 15000000, fundingSource: 'Mandiri', type: 'Aset' });
        worksheet.addRow({ name: 'Kertas A4', spec: '70gr', qty: 10, unit: 'Rim', estPrice: 55000, fundingSource: 'Mandiri', type: 'Non-Aset' });

        // Add data validation for "Jenis" column (Column G)
        for (let i = 2; i <= 100; i++) {
            worksheet.getCell(`G${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"Aset,Non-Aset"'],
                showErrorMessage: true,
                errorStyle: 'stop',
                errorTitle: 'Input Tidak Valid',
                error: 'Mohon pilih kategori yang sesuai: Aset atau Non-Aset'
            };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Template_Request_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
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
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-20 px-2 sm:px-0 animate-in slide-in-from-bottom-4">
            <button onClick={() => navigate('/procurements')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600">
                <ArrowLeft size={16} /> Batal & Kembali
            </button>

            <div className="bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-slate-100">
                <div className="mb-4 sm:mb-6">
                    <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Buat Request Baru</h1>
                    <p className="text-slate-500 text-xs sm:text-sm">Ajukan permintaan pengadaan barang aset atau kebutuhan operasional.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Header Section */}
                    <div className="bg-slate-50 p-3 sm:p-6 rounded-xl border border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Judul Pengajuan (Wajib)</label>
                        <input
                            className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700"
                            placeholder="Contoh: Pengadaan Alat TIK untuk Unit IT"
                            value={header.title}
                            onChange={e => setHeader({ ...header, title: e.target.value })}
                            required
                        />
                    </div>

                    {/* Items Section */}
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-4 bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-100">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-blue-900">Daftar Barang</h3>
                                <p className="text-xs text-blue-600">List barang yang akan diajukan.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                />
                                <button type="button" onClick={handleDownloadTemplate} className="flex items-center gap-1 text-slate-500 hover:text-blue-600 text-xs font-bold px-3 py-2 border rounded-lg bg-white flex-1 sm:flex-none justify-center">
                                    <Download size={14} /> Template
                                </button>
                                <button type="button" onClick={() => fileInputRef.current.click()} className="flex items-center gap-1 text-green-600 hover:text-green-700 text-xs font-bold px-3 py-2 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 flex-1 sm:flex-none justify-center">
                                    <FileSpreadsheet size={14} /> Import
                                </button>
                                <button type="button" onClick={addItem} className="flex items-center gap-1 text-white bg-blue-600 hover:bg-blue-700 text-xs font-bold px-3 py-2 rounded-lg shadow-sm flex-1 sm:flex-none justify-center">
                                    <Plus size={14} /> Tambah
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-2 sm:gap-4 items-start p-3 sm:p-4 border border-slate-200 rounded-xl bg-white hover:border-blue-300 transition-colors group">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-xs mt-1">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nama Barang</label>
                                                <input
                                                    placeholder="Contoh: Laptop Dell XPS"
                                                    className="border border-slate-300 p-2 rounded text-sm font-semibold w-full focus:border-blue-500 outline-none"
                                                    value={item.name}
                                                    onChange={e => handleItemChange(index, 'name', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Spesifikasi</label>
                                                <input
                                                    placeholder="Contoh: RAM 16GB, SSD 512GB"
                                                    className="border border-slate-300 p-2 rounded text-sm w-full focus:border-blue-500 outline-none"
                                                    value={item.spec}
                                                    onChange={e => handleItemChange(index, 'spec', e.target.value)}
                                                />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Jenis</label>
                                                <select
                                                    className="border border-slate-300 p-2 rounded text-sm w-full focus:border-blue-500 outline-none bg-white font-bold text-blue-800"
                                                    value={item.type}
                                                    onChange={e => handleItemChange(index, 'type', e.target.value)}
                                                >
                                                    <option value="ASSET">Aset</option>
                                                    <option value="NON_ASSET">Non-Aset</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
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

                    <div className="pt-4 sm:pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
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
