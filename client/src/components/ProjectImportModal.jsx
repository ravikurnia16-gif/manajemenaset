import React, { useState, useRef, useEffect } from 'react';
import { 
    FileSpreadsheet, 
    Upload, 
    Download, 
    AlertCircle, 
    CheckCircle2, 
    X, 
    FileText, 
    Layers, 
    Package, 
    HelpCircle,
    Loader2,
    PlusCircle,
    FolderPlus,
    Building2,
    Calendar,
    Coins,
    UserCheck
} from 'lucide-react';
import api from '../lib/axios';
import * as XLSX from 'xlsx';

export const ProjectImportModal = ({
    isOpen,
    onClose,
    type = 'INVENTORY', // 'INVENTORY' | 'UNIFORM'
    onSuccess
}) => {
    if (!isOpen) return null;

    const currentUser = (() => {
        try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch (e) { return {}; }
    })();

    const isUniform = type === 'UNIFORM';
    const templateFileName = isUniform 
        ? 'Template_Daftar_Pesanan_Seragam.xlsx' 
        : 'Template_Daftar_Barang_Logistik.xlsx';

    const fileInputRef = useRef(null);
    const [mode, setMode] = useState('NEW_PROJECT'); // 'NEW_PROJECT' | 'EXISTING_PROJECT'
    const [existingProjects, setExistingProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [loadingProjects, setLoadingProjects] = useState(false);

    // Form fields for NEW_PROJECT
    const [projectFields, setProjectFields] = useState({
        title: '',
        year: new Date().getFullYear(),
        projectType: 'SELEKSI',
        budget: '',
        requestedByName: currentUser.name || (isUniform ? 'Staff Pengelola Seragam' : 'Staff Bagian Sarana'),
        targetDate: '',
        justification: ''
    });

    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [previewSummary, setPreviewSummary] = useState(null);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    // Fetch existing projects for attachment
    useEffect(() => {
        if (mode === 'EXISTING_PROJECT') {
            setLoadingProjects(true);
            const endpoint = isUniform ? '/uniforms/projects' : '/inventory/projects';
            api.get(endpoint)
                .then(res => {
                    const data = res.data || [];
                    // Prioritaskan proyek draft / pending
                    setExistingProjects(data);
                    if (data.length > 0 && !selectedProjectId) {
                        setSelectedProjectId(data[0].id);
                    }
                })
                .catch(err => {
                    console.error('Error fetching projects:', err);
                })
                .finally(() => setLoadingProjects(false));
        }
    }, [mode, isUniform]);

    const handleDownloadTemplate = async () => {
        setDownloadingTemplate(true);
        setErrorMsg('');
        try {
            const endpoint = isUniform 
                ? '/uniforms/projects/template' 
                : '/inventory/projects/template';
            
            const res = await api.get(endpoint, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', templateFileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download template error:', err);
            setErrorMsg('Gagal mengunduh template Excel. Silakan coba kembali.');
        } finally {
            setDownloadingTemplate(false);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setErrorMsg('');
        setResult(null);

        // Parse file locally for preview
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

                if (!data || data.length === 0) {
                    setErrorMsg('File Excel tidak memuat baris data barang pesanan.');
                    setPreviewData([]);
                    setPreviewSummary(null);
                    return;
                }

                let totalQuantity = 0;
                let validRows = 0;

                data.forEach(row => {
                    if (isUniform) {
                        const cat = row['Kategori *'] || row['Kategori'] || '';
                        const cloth = row['Jenis Pakaian *'] || row['Jenis Pakaian'] || row['Jenis pakaian'] || '';
                        const size = row['Ukuran (Sesuai Master Data) *'] || row['Ukuran *'] || row['Ukuran'] || '';
                        const qty = parseInt(row['Jumlah Pesanan *'] || row['Jumlah Pesanan'] || row['Jumlah'] || 0, 10);
                        if (cloth || cat || size) {
                            validRows++;
                            if (!isNaN(qty) && qty > 0) totalQuantity += qty;
                        }
                    } else {
                        const itemName = (
                            row['Nama Barang (Pilih dari Dropdown) *'] || 
                            row['Nama Barang (Pilih dari Dropdown)'] || 
                            row['Nama Barang *'] || 
                            row['Nama Barang'] || 
                            row['Kode / Nama Barang *'] || 
                            ''
                        ).toString().trim();
                        const qty = parseInt(row['Kuantitas *'] || row['Kuantitas'] || row['Jumlah'] || 0, 10);
                        if (itemName) {
                            validRows++;
                            if (!isNaN(qty) && qty > 0) totalQuantity += qty;
                        }
                    }
                });

                setPreviewData(data.slice(0, 6)); // 6 baris pertama
                setPreviewSummary({
                    totalRows: data.length,
                    validItems: validRows,
                    totalQuantity: totalQuantity
                });
            } catch (err) {
                console.error('Preview parse error:', err);
                setErrorMsg('Gagal membaca isi file Excel. Pastikan format file valid (.xlsx atau .xls).');
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleImportSubmit = async () => {
        if (!file) {
            setErrorMsg('Silakan pilih file Excel daftar barang pesanan terlebih dahulu.');
            return;
        }

        if (mode === 'NEW_PROJECT') {
            if (!projectFields.title.trim()) {
                setErrorMsg('Judul Proyek pengadaan wajib diisi.');
                return;
            }
            if (!projectFields.justification.trim()) {
                setErrorMsg('Latar belakang / alasan urgensi pengadaan wajib diisi untuk lembar persetujuan Kabid.');
                return;
            }
        } else if (mode === 'EXISTING_PROJECT') {
            if (!selectedProjectId) {
                setErrorMsg('Pilih proyek tujuan yang ingin ditambahkan barang pesanannya.');
                return;
            }
        }

        setImporting(true);
        setErrorMsg('');
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        if (mode === 'NEW_PROJECT') {
            formData.append('title', projectFields.title.trim());
            formData.append('year', projectFields.year);
            formData.append('projectType', projectFields.projectType);
            formData.append('budget', projectFields.budget || '0');
            formData.append('requestedByName', projectFields.requestedByName);
            formData.append('targetDate', projectFields.targetDate);
            formData.append('justification', projectFields.justification.trim());
        } else {
            formData.append('projectId', selectedProjectId);
        }

        try {
            const endpoint = isUniform 
                ? '/uniforms/projects/import' 
                : '/inventory/projects/import';

            const res = await api.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setResult(res.data);
            if (onSuccess) {
                onSuccess(res.data);
            }
        } catch (err) {
            console.error('Import error:', err);
            setErrorMsg(err.response?.data?.error || 'Terjadi kesalahan saat memproses import file Excel.');
        } finally {
            setImporting(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setPreviewData([]);
        setPreviewSummary(null);
        setResult(null);
        setErrorMsg('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${isUniform ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-base">
                                Import Daftar Barang Pesanan {isUniform ? 'Seragam' : 'Logistik'} (Excel)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Unggah daftar rincian barang pesanan sesuai format master data
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                    {/* Langkah 1: Unduh Format Template Resmi */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                <HelpCircle size={12} className={isUniform ? 'text-indigo-600' : 'text-blue-600'} /> Langkah 1: Format Master Data
                            </span>
                            <h4 className="text-sm font-bold text-slate-800">Unduh Format Daftar Barang Resmi</h4>
                            <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                                {isUniform ? (
                                    <span>Format kolom Excel: <b>Kategori, Jenis Pakaian, Unit, Gender, Ukuran</b> (sesuai Master Data), dan <b>Jumlah Pesanan</b>.</span>
                                ) : (
                                    <span>Format kolom Excel: <b>Nama Barang (Dropdown data validation)</b> dan <b>Kuantitas</b>.</span>
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            disabled={downloadingTemplate}
                            className={`shrink-0 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all ${isUniform ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'}`}
                        >
                            <Download size={14} />
                            {downloadingTemplate ? 'Mengunduh...' : 'Unduh Template Excel'}
                        </button>
                    </div>

                    {/* Langkah 2: Pilihan Target Proyek (Baru atau Proyek yang Ada) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                <FolderPlus size={12} className={isUniform ? 'text-indigo-600' : 'text-blue-600'} /> Langkah 2: Tujuan Proyek Pengadaan
                            </span>
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setMode('NEW_PROJECT')}
                                    className={`px-3 py-1 rounded-lg transition-all ${mode === 'NEW_PROJECT' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Buat Proyek Baru
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('EXISTING_PROJECT')}
                                    className={`px-3 py-1 rounded-lg transition-all ${mode === 'EXISTING_PROJECT' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Pilih Proyek yang Ada
                                </button>
                            </div>
                        </div>

                        {mode === 'NEW_PROJECT' ? (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Judul / Nama Proyek Pengadaan *</label>
                                    <input 
                                        type="text"
                                        required
                                        placeholder={isUniform ? "Contoh: Pengadaan Seragam Santri Baru TA 2026/2027" : "Contoh: Pengadaan Logistik & ATK Operasional 2026"}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 font-medium"
                                        value={projectFields.title}
                                        onChange={e => setProjectFields({ ...projectFields, title: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Tahun Anggaran</label>
                                        <input 
                                            type="number"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 text-center font-bold"
                                            value={projectFields.year}
                                            onChange={e => setProjectFields({ ...projectFields, year: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Pagu Anggaran (Rp)</label>
                                        <input 
                                            type="number"
                                            placeholder="Contoh: 25000000"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                                            value={projectFields.budget}
                                            onChange={e => setProjectFields({ ...projectFields, budget: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Target Tanggal</label>
                                        <input 
                                            type="date"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                                            value={projectFields.targetDate}
                                            onChange={e => setProjectFields({ ...projectFields, targetDate: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Unit Pemohon / PIC</label>
                                        <input 
                                            type="text"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                                            value={projectFields.requestedByName}
                                            onChange={e => setProjectFields({ ...projectFields, requestedByName: e.target.value })}
                                        />
                                    </div>
                                    {!isUniform && (
                                        <div>
                                            <label className="block font-bold text-slate-700 mb-1">Tipe Proyek</label>
                                            <select
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 font-medium"
                                                value={projectFields.projectType}
                                                onChange={e => setProjectFields({ ...projectFields, projectType: e.target.value })}
                                            >
                                                <option value="SELEKSI">Seleksi / Tender Terbuka</option>
                                                <option value="PENUNJUKAN_LANGSUNG">Penunjukan Langsung</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Latar Belakang & Alasan Urgensi (Untuk Lembar Persetujuan Kabid Sarana) *
                                    </label>
                                    <textarea 
                                        rows={2}
                                        required
                                        placeholder="Tuliskan tujuan dan urgensi kebutuhan pengadaan ini..."
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                                        value={projectFields.justification}
                                        onChange={e => setProjectFields({ ...projectFields, justification: e.target.value })}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                                <label className="block font-bold text-slate-700">Pilih Proyek Pengadaan yang Ada:</label>
                                {loadingProjects ? (
                                    <div className="flex items-center gap-2 text-slate-500 py-2">
                                        <Loader2 size={14} className="animate-spin" /> Memuat daftar proyek...
                                    </div>
                                ) : existingProjects.length > 0 ? (
                                    <select
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 font-medium"
                                        value={selectedProjectId}
                                        onChange={e => setSelectedProjectId(e.target.value)}
                                    >
                                        {existingProjects.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.title} (Tahun {p.year}) - Status: {p.status}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-slate-400 italic">Belum ada proyek pengadaan aktif. Silakan pilih "Buat Proyek Baru".</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Langkah 3: Upload File Excel */}
                    <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <Upload size={12} className={isUniform ? 'text-indigo-600' : 'text-blue-600'} /> Langkah 3: Unggah File Excel Daftar Barang Pesanan
                        </span>

                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${file ? (isUniform ? 'border-indigo-400 bg-indigo-50/30' : 'border-blue-400 bg-blue-50/30') : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/60'}`}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                accept=".xlsx, .xls, .csv" 
                                className="hidden" 
                            />
                            <div className={`w-12 h-12 mx-auto mb-2 rounded-2xl flex items-center justify-center ${isUniform ? 'bg-indigo-100/70 text-indigo-600' : 'bg-blue-100/70 text-blue-600'}`}>
                                <Upload size={22} />
                            </div>
                            {file ? (
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{file.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {(file.size / 1024).toFixed(1)} KB • Klik untuk mengganti file Excel
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <p className="font-bold text-slate-700 text-sm">
                                        Klik untuk memilih file Excel (.xlsx / .xls)
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Pastikan file hanya berisi daftar barang pesanan sesuai master data
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error Message */}
                    {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                            <AlertCircle size={15} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Summary & Preview Table */}
                    {previewSummary && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
                                        <FileText size={12} /> Total Baris
                                    </span>
                                    <p className="text-lg font-black text-slate-800 mt-0.5">{previewSummary.totalRows}</p>
                                </div>
                                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                                    <span className="text-[10px] uppercase font-bold text-blue-500 flex items-center justify-center gap-1">
                                        <Layers size={12} /> Item Terbaca
                                    </span>
                                    <p className="text-lg font-black text-blue-700 mt-0.5">{previewSummary.validItems}</p>
                                </div>
                                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                                    <span className="text-[10px] uppercase font-bold text-emerald-500 flex items-center justify-center gap-1">
                                        <Package size={12} /> Total Kuantitas
                                    </span>
                                    <p className="text-lg font-black text-emerald-700 mt-0.5">{previewSummary.totalQuantity}</p>
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 flex justify-between items-center">
                                    <span>Pratinjau Data Barang Pesanan (Maks 6 Baris Pertama):</span>
                                    <span className="text-slate-400 font-normal">Sesuai Format Master</span>
                                </div>
                                <div className="overflow-x-auto">
                                    {isUniform ? (
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                                                <tr>
                                                    <th className="p-2 w-8 text-center">No</th>
                                                    <th className="p-2">Kategori</th>
                                                    <th className="p-2">Jenis Pakaian</th>
                                                    <th className="p-2">Unit</th>
                                                    <th className="p-2">Gender</th>
                                                    <th className="p-2 text-center">Ukuran</th>
                                                    <th className="p-2 text-center">Jumlah Pesanan</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {previewData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                                                        <td className="p-2 font-medium text-slate-700">{row['Kategori *'] || row['Kategori'] || '-'}</td>
                                                        <td className="p-2 font-bold text-slate-800">{row['Jenis Pakaian *'] || row['Jenis Pakaian'] || row['Jenis pakaian'] || '-'}</td>
                                                        <td className="p-2 text-slate-600">{row['Unit *'] || row['Unit'] || '-'}</td>
                                                        <td className="p-2 text-slate-600">{row['Gender *'] || row['Gender'] || '-'}</td>
                                                        <td className="p-2 text-center font-bold text-indigo-700 bg-indigo-50/50">{row['Ukuran (Sesuai Master Data) *'] || row['Ukuran *'] || row['Ukuran'] || '-'}</td>
                                                        <td className="p-2 text-center font-bold text-blue-600">{row['Jumlah Pesanan *'] || row['Jumlah Pesanan'] || row['Jumlah'] || 0}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                                                <tr>
                                                    <th className="p-2 w-8 text-center">No</th>
                                                    <th className="p-2">Nama Barang (Dropdown Master Data)</th>
                                                    <th className="p-2 text-center w-28">Kuantitas</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {previewData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                                                        <td className="p-2 font-bold text-slate-800">
                                                            {row['Nama Barang (Pilih dari Dropdown) *'] || 
                                                             row['Nama Barang (Pilih dari Dropdown)'] || 
                                                             row['Nama Barang *'] || 
                                                             row['Nama Barang'] || 
                                                             row['Kode / Nama Barang *'] || '-'}
                                                        </td>
                                                        <td className="p-2 text-center font-bold text-blue-600">
                                                            {row['Kuantitas *'] || row['Kuantitas'] || row['Jumlah'] || 0}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Result Success Banner */}
                    {result && (
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
                            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                                <CheckCircle2 size={18} className="text-emerald-600" />
                                <span>{result.message || 'Import daftar barang pesanan berhasil diproses!'}</span>
                            </div>
                            <p className="text-emerald-700">
                                Total Item Pesanan: <b>{result.totalItemsCount || 0} barang</b> ({result.totalQuantity || 0} unit/pcs).
                                Proyek otomatis berstatus <b>Menunggu Persetujuan Kabid Sarana</b>.
                            </p>

                            {result.errors && result.errors.length > 0 && (
                                <div className="mt-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] space-y-1">
                                    <p className="font-bold">Catatan Peringatan ({result.errors.length} baris tidak cocok / dilewati):</p>
                                    <div className="max-h-24 overflow-y-auto space-y-0.5">
                                        {result.errors.map((err, i) => (
                                            <p key={i}>• {err}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={importing || !file}
                        className="px-3 py-1.5 rounded-xl font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 transition-colors disabled:opacity-40"
                    >
                        Reset Pilihan File
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                        >
                            {result ? 'Selesai & Tutup' : 'Batal'}
                        </button>

                        {!result && (
                            <button
                                type="button"
                                onClick={handleImportSubmit}
                                disabled={importing || !file}
                                className={`px-5 py-2 rounded-xl font-bold text-white flex items-center gap-2 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isUniform ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}
                            >
                                {importing ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        <span>Memproses Import...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={15} />
                                        <span>Mulai Import Barang Pesanan</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
