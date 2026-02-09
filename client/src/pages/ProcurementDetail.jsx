import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, FileText, Upload, DollarSign, Store, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import api from '../lib/axios';

const ProcurementDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [req, setReq] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bastDate, setBastDate] = useState('');
    const [vendors, setVendors] = useState([]);

    // View Management (Split Pages)
    const [activeTab, setActiveTab] = useState('DETAIL'); // 'DETAIL' (Stage 1&2), 'FINAL' (Stage 3), 'BAST' (Stage 4)

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user?.role);

    useEffect(() => {
        fetchDetail();
        fetchVendors();
    }, [id]);

    const fetchVendors = async () => {
        try {
            const res = await api.get('/master/vendors');
            setVendors(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchDetail = async () => {
        try {
            const res = await api.get(`/procurements/${id}`);
            const data = res.data;

            // Safe Parse JSON logic
            const safeJSONParse = (str) => {
                if (!str) return [];
                try {
                    const parsed = JSON.parse(str);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    console.error("JSON Parse Error on comparisonVendors:", e);
                    return [];
                }
            };

            if (data.items) {
                // Initialize defaults to prevent white screen
                data.items = data.items.map(item => ({
                    ...item,
                    brand: item.brand || '',
                    usefulLife: item.usefulLife || (data.type === 'ASSET' ? 4 : 0),
                    finalPrice: item.finalPrice || item.estPrice,
                    fundingSource: item.fundingSource || 'Mandiri',
                    vendorId: item.vendorId || '',
                    comparisonVendors: safeJSONParse(item.comparisonVendors),
                    needComparison: item.needComparison !== false // Default true
                }));
            } else {
                data.items = []; // Safety items array
            }
            setReq(data);
        } catch (error) {
            console.error(error);
            // Don't alert immediately on mount to avoid spam, show UI error
        } finally {
            setLoading(false);
        }
    };

    const handleSaveItem = async (item, silent = false) => {
        try {
            let payloadVendorId = item.vendorId;
            let payloadNewVendor = null;

            if (item.vendorId === 'OTHER') {
                payloadVendorId = null;
                payloadNewVendor = item.newVendorName;
            } else if (typeof item.vendorId === 'string' && item.vendorId.startsWith('CV-')) {
                payloadVendorId = null;
                payloadNewVendor = item.vendorId.replace('CV-', '');
            }

            await api.put(`/procurements/items/${item.id}`, {
                fundingSource: item.fundingSource,
                brand: item.brand,
                usefulLife: item.usefulLife,
                finalPrice: item.finalPrice,
                vendorId: payloadVendorId,
                newVendorName: payloadNewVendor,
                comparisonVendors: item.comparisonVendors,
                needComparison: item.needComparison
            });

            if (!silent) {
                alert('Data barang berhasil disimpan!');
                fetchDetail();
            } else {
                console.log('Auto-saved item:', item.id);
            }
        } catch (error) {
            console.error(error);
            if (!silent) alert('Gagal menyimpan detail barang');
        }
    };

    const handleStatus = async (newStatus, note = '', reason = '') => {
        if (!confirm('Apakah Anda yakin mengubah status?')) return;
        try {
            await api.put(`/procurements/${id}/status`, {
                status: newStatus,
                validationNote: note,
                rejectionReason: reason
            });
            fetchDetail();
        } catch (error) {
            alert(error.response?.data?.error);
        }
    };

    const handleItemChange = (index, field, value) => {
        const newReq = { ...req };
        newReq.items[index][field] = value;
        setReq(newReq);
    };

    const handleBAST = async () => {
        if (!bastDate) return alert('Pilih tanggal BAST');
        if (!confirm('Proses ini akan menyelesaikan pengadaan dan otomatis mencatat aset. Pastikan semua Detail Barang (Vendor, Merk, Harga Final, dll) sudah diisi dengan benar. Lanjut?')) return;

        try {
            await api.post(`/procurements/${id}/bast`, { bastDate });
            alert('Pengadaan Selesai!');
            fetchDetail();
        } catch (error) {
            alert(error.response?.data?.error);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!req) return <div className="p-8 text-center">Data not found</div>;

    // Helper to switch tabs automatically based on flow if needed, but manual is safer for edits.

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-in fade-in">
            <div className="flex items-center justify-between">
                <button onClick={() => navigate('/procurements')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600">
                    <ArrowLeft size={16} /> Kembali ke List
                </button>
                <div className="text-xs font-mono text-slate-400">{req.code}</div>
            </div>

            {/* STEPPER / NAVIGATION */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('DETAIL')}
                        className={`flex-1 py-4 text-sm font-bold flex flex-col items-center gap-1 border-b-2 transition-colors ${activeTab === 'DETAIL' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
                    >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>1-2</div>
                        Validasi & Pembanding
                    </button>
                    <button
                        onClick={() => setActiveTab('FINAL')}
                        className={`flex-1 py-4 text-sm font-bold flex flex-col items-center gap-1 border-b-2 transition-colors ${activeTab === 'FINAL'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                            : req.status === 'SUBMITTED'
                                ? 'border-transparent text-slate-300 cursor-not-allowed'
                                : 'border-transparent text-slate-500 hover:bg-slate-50'
                            }`}
                        disabled={req.status === 'SUBMITTED'}
                    >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${['PROCESS', 'COMPLETED'].includes(req.status) ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>3</div>
                        Finalisasi
                    </button>
                    <button
                        disabled={!['PROCESS', 'COMPLETED'].includes(req.status) || (req.status === 'PROCESS' && req.items.some(item =>
                            !item.vendorId ||
                            (item.vendorId === 'OTHER' && !item.newVendorName) ||
                            !item.finalPrice ||
                            !item.brand ||
                            !item.fundingSource
                        ))}
                        onClick={() => setActiveTab('BAST')}
                        className={`flex-1 py-4 text-sm font-bold flex flex-col items-center gap-1 border-b-2 transition-colors ${activeTab === 'BAST'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                            : (!['PROCESS', 'COMPLETED'].includes(req.status) || (req.status === 'PROCESS' && req.items.some(item => !item.vendorId || (item.vendorId === 'OTHER' && !item.newVendorName) || !item.finalPrice || !item.brand || !item.fundingSource)))
                                ? 'border-transparent text-slate-300 cursor-not-allowed'
                                : 'border-transparent text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${req.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>4</div>
                        BAST
                    </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="min-h-[400px]">
                {/* === TAB 1: DETAIL & COMPARISON === */}
                {activeTab === 'DETAIL' && (
                    <div className="space-y-6 animate-in slide-in-from-left-4 fade-in">
                        {/* STAGE 1: INFO & VALIDATION */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <FileText size={18} /> Tahap 1: Verifikasi Request
                                </h3>
                                {req.status === 'SUBMITTED' && (
                                    <div className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold animate-pulse">
                                        Menunggu Persetujuan
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-2xl font-bold text-slate-800">{req.title || '-'}</h1>
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${req.type === 'ASSET' ? 'border-purple-200 text-purple-600 bg-purple-50' : 'border-orange-200 text-orange-600 bg-orange-50'
                                            }`}>{req.type}</span>
                                    </div>
                                    <p className="text-slate-500 text-sm">Unit: <b>{req.unit?.name}</b> • Pemohon: {req.user?.username}</p>
                                </div>
                            </div>

                            {isAdmin && req.status === 'SUBMITTED' && (
                                <div className="bg-slate-50 p-4 rounded-lg flex gap-3 border border-slate-200 mt-4">
                                    <button onClick={() => handleStatus('APPROVED')} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm">
                                        <CheckCircle size={16} className="inline mr-2" /> Setujui Request
                                    </button>
                                    <button onClick={() => {
                                        const reason = prompt('Alasan Penolakan:');
                                        if (reason) handleStatus('REJECTED', '', reason);
                                    }} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold hover:bg-red-100">
                                        <XCircle size={16} className="inline mr-2" /> Tolak
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* STAGE 2: VENDOR COMPARISON */}
                        {['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) ? (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <Store size={18} /> Tahap 2: Pemilihan Vendor Pembanding
                                    </h3>
                                    {/* Action to Next Stage */}
                                    {req.status === 'APPROVED' && isAdmin && (
                                        <button onClick={() => {
                                            handleStatus('PROCESS', 'Melanjutkan ke Tahap Finalisasi');
                                            setActiveTab('FINAL');
                                        }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                                            Lanjut ke Finalisasi &rsaquo;
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    {req.items.map((item, index) => (
                                        <div key={item.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="font-bold text-slate-800">{item.name}</h4>
                                                    <p className="text-xs text-slate-500">{item.spec} • {item.qty} {item.unit} • Est: Rp {item.estPrice?.toLocaleString('id-ID')}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    {isAdmin && req.status === 'APPROVED' && (
                                                        <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border border-slate-300">
                                                            <input
                                                                type="checkbox"
                                                                id={`needComp-${item.id}`}
                                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                                checked={item.needComparison}
                                                                onChange={e => {
                                                                    const newItem = { ...item, needComparison: e.target.checked };
                                                                    handleItemChange(index, 'needComparison', e.target.checked);
                                                                    handleSaveItem(newItem, true);
                                                                }}
                                                            />
                                                            <label htmlFor={`needComp-${item.id}`} className="text-xs font-bold text-slate-600 cursor-pointer">Perlu Perbandingan?</label>
                                                        </div>
                                                    )}

                                                    {isAdmin && req.status === 'APPROVED' && item.needComparison && (
                                                        <button onClick={() => {
                                                            const newComparisons = [...(item.comparisonVendors || [])];
                                                            newComparisons.push({ name: '', price: 0, notes: '' });
                                                            handleItemChange(index, 'comparisonVendors', newComparisons);
                                                            const newItem = { ...item, comparisonVendors: newComparisons };
                                                            handleSaveItem(newItem, true);
                                                        }} className="text-xs flex items-center gap-1 bg-white border border-slate-300 px-2 py-1 rounded font-bold hover:bg-slate-100 text-slate-600">
                                                            <Plus size={12} /> Tambah Kandidat
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {item.needComparison ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {(item.comparisonVendors || []).map((cv, cvIndex) => (
                                                        <div key={cvIndex} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative group">
                                                            {isAdmin && req.status === 'APPROVED' && (
                                                                <button onClick={() => {
                                                                    const newComparisons = item.comparisonVendors.filter((_, i) => i !== cvIndex);
                                                                    handleItemChange(index, 'comparisonVendors', newComparisons);
                                                                    const newItem = { ...item, comparisonVendors: newComparisons };
                                                                    handleSaveItem(newItem, true);
                                                                }} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                                            )}
                                                            <div className="space-y-2 text-xs">
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">VENDOR</label>
                                                                    {isAdmin && req.status === 'APPROVED' ? (
                                                                        <input
                                                                            className="w-full border-b border-slate-200 focus:border-blue-500 outline-none pb-1 font-bold text-slate-700"
                                                                            value={cv.name}
                                                                            placeholder="Nama Vendor"
                                                                            onChange={e => {
                                                                                const newComparisons = [...item.comparisonVendors];
                                                                                newComparisons[cvIndex].name = e.target.value;
                                                                                handleItemChange(index, 'comparisonVendors', newComparisons);
                                                                            }}
                                                                            onBlur={() => handleSaveItem(item, true)}
                                                                        />
                                                                    ) : <span className="font-bold">{cv.name}</span>}
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">HARGA</label>
                                                                    {isAdmin && req.status === 'APPROVED' ? (
                                                                        <input
                                                                            type="number"
                                                                            className="w-full border-b border-slate-200 focus:border-blue-500 outline-none pb-1 font-mono"
                                                                            value={cv.price}
                                                                            placeholder="0"
                                                                            onChange={e => {
                                                                                const newComparisons = [...item.comparisonVendors];
                                                                                newComparisons[cvIndex].price = e.target.value;
                                                                                handleItemChange(index, 'comparisonVendors', newComparisons);
                                                                            }}
                                                                            onBlur={() => handleSaveItem(item, true)}
                                                                        />
                                                                    ) : <span>Rp {parseFloat(cv.price || 0).toLocaleString('id-ID')}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {item.comparisonVendors?.length === 0 && (
                                                        <div className="text-center text-xs text-slate-400 py-4 italic border border-dashed rounded bg-slate-50 col-span-full">
                                                            Belum ada kandidat vendor
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center text-xs text-slate-400 py-2 border border-dashed rounded bg-slate-50">
                                                    Perbandingan harga tidak diperlukan untuk item ini.
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-8 rounded-xl border border-dashed text-center text-slate-500">
                                Tahap Pemilihan Vendor akan terbuka setelah Request Disetujui.
                            </div>
                        )}
                    </div>
                )}

                {/* === TAB 2: FINAL SELECTION === */}
                {activeTab === 'FINAL' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                        {['PROCESS', 'COMPLETED'].includes(req.status) ? (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <DollarSign size={18} /> Tahap 3: Finalisasi Harga & Vendor
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                                            <tr>
                                                <th className="p-3 rounded-l-lg">Item</th>
                                                <th className="p-3">Vendor Terpilih</th>
                                                <th className="p-3">Harga Final</th>
                                                <th className="p-3">Merk/Brand</th>
                                                {req.type === 'ASSET' && <th className="p-3">Umur (Thn)</th>}
                                                <th className="p-3">Sumber Dana</th>
                                                <th className="p-3 rounded-r-lg text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {req.items.map((item, index) => (
                                                <tr key={item.id} className="group hover:bg-slate-50">
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-700">{item.name}</div>
                                                        <div className="text-xs text-slate-500">{item.spec}</div>
                                                    </td>
                                                    <td className="p-3 w-48">
                                                        <select
                                                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:border-blue-500 outline-none"
                                                            value={item.vendorId || ''}
                                                            onChange={e => handleItemChange(index, 'vendorId', e.target.value)}
                                                            disabled={req.status === 'COMPLETED' || !isAdmin}
                                                        >
                                                            <option value="">- Pilih Vendor -</option>
                                                            {item.needComparison && (item.comparisonVendors || []).map((cv, i) => (
                                                                <option key={`cv-${i}`} value={`CV-${cv.name}`}>{cv.name} (Kandidat)</option>
                                                            ))}
                                                            <option disabled>──────────</option>
                                                            {vendors.map(v => (
                                                                <option key={v.id} value={v.id}>{v.name}</option>
                                                            ))}
                                                            <option value="OTHER" className="font-bold text-blue-600 bg-blue-50">+ Vendor Baru / Lainnya</option>
                                                        </select>
                                                        {item.vendorId === 'OTHER' && (
                                                            <input
                                                                className="mt-1 w-full border border-slate-300 rounded p-1.5 text-xs focus:border-blue-500 outline-none"
                                                                placeholder="Ketik Nama Vendor..."
                                                                value={item.newVendorName || ''}
                                                                onChange={e => handleItemChange(index, 'newVendorName', e.target.value)}
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="p-3 w-32">
                                                        <input
                                                            type="number"
                                                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:border-blue-500 outline-none"
                                                            placeholder="0"
                                                            value={item.finalPrice || ''}
                                                            onChange={e => handleItemChange(index, 'finalPrice', e.target.value)}
                                                            disabled={req.status === 'COMPLETED' || !isAdmin}
                                                        />
                                                    </td>
                                                    <td className="p-3 w-32">
                                                        <input
                                                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:border-blue-500 outline-none"
                                                            placeholder="Merk/Tipe"
                                                            value={item.brand || ''}
                                                            onChange={e => handleItemChange(index, 'brand', e.target.value)}
                                                            disabled={req.status === 'COMPLETED' || !isAdmin}
                                                        />
                                                    </td>
                                                    {req.type === 'ASSET' && (
                                                        <td className="p-3 w-20">
                                                            <input
                                                                type="number"
                                                                className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:border-blue-500 outline-none"
                                                                placeholder="4"
                                                                value={item.usefulLife || 4}
                                                                onChange={e => handleItemChange(index, 'usefulLife', e.target.value)}
                                                                disabled={req.status === 'COMPLETED' || !isAdmin}
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="p-3 w-32">
                                                        <select
                                                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:border-blue-500 outline-none"
                                                            value={item.fundingSource || 'Mandiri'}
                                                            onChange={e => handleItemChange(index, 'fundingSource', e.target.value)}
                                                            disabled={req.status === 'COMPLETED' || !isAdmin}
                                                        >
                                                            <option value="Yayasan">Yayasan</option>
                                                            <option value="Hibah">Hibah</option>
                                                            <option value="Wakaf">Wakaf</option>
                                                            <option value="Mandiri">Mandiri</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {isAdmin && req.status === 'PROCESS' && (
                                                            <button
                                                                onClick={() => handleSaveItem(item)}
                                                                className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-xs font-bold shadow-sm"
                                                            >
                                                                Simpan
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {isAdmin && req.status === 'PROCESS' && (
                                    <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                                        <button
                                            onClick={() => {
                                                const invalidItems = req.items.filter(item =>
                                                    !item.vendorId ||
                                                    (item.vendorId === 'OTHER' && !item.newVendorName) ||
                                                    !item.finalPrice ||
                                                    !item.brand ||
                                                    !item.fundingSource
                                                );

                                                if (invalidItems.length > 0) {
                                                    alert(`Masih ada ${invalidItems.length} barang yang belum lengkap datanya (Vendor, Harga, Merk, Sumber Dana). Harap lengkapi semua baris.`);
                                                    return;
                                                }
                                                setActiveTab('BAST');
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                        >
                                            Lanjut ke BAST <CheckCircle size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-yellow-50 p-8 rounded-xl border border-yellow-100 text-center text-yellow-700">
                                Silakan selesaikan Tahap 2 (Pemilihan Vendor) terlebih dahulu.
                            </div>
                        )}
                    </div>
                )}

                {/* === TAB 3: BAST === */}
                {activeTab === 'BAST' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                        {['PROCESS', 'COMPLETED'].includes(req.status) ? (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 max-w-2xl mx-auto">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <CheckCircle size={18} /> Tahap 4: Eksekusi & BAST
                                </h3>

                                {req.status === 'COMPLETED' ? (
                                    <div className="bg-green-50 p-6 rounded-xl text-center border border-green-100">
                                        <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
                                        <h4 className="font-bold text-lg text-green-700">Pengadaan Selesai</h4>
                                        <p className="text-sm text-green-600 mb-2">BAST Tanggal: <b>{new Date(req.bastDate).toLocaleDateString('id-ID')}</b></p>
                                        {req.type === 'ASSET' && <p className="text-xs mt-2 text-slate-500 bg-white p-2 rounded border border-green-100 inline-block">✅ Aset telah tercatat otomatis di Database Aset</p>}
                                    </div>
                                ) : isAdmin ? (
                                    <div className="space-y-4">
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700 flex items-start gap-2">
                                            <Store size={14} className="mt-0.5" />
                                            <p>Pastikan Tahap 3 (Finalisasi) sudah selesai dan semua data Valid (Vendor, Harga, Brand) sebelum memproses BAST.</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500">Tanggal Terima Barang (BAST)</label>
                                            <input type="date" value={bastDate} onChange={e => setBastDate(e.target.value)} className="w-full border p-2 rounded text-sm mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <button onClick={handleBAST} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm shadow-xl shadow-blue-600/20 transition-all flex justify-center items-center gap-2">
                                            <CheckCircle size={18} /> Selesai & Proses BAST
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-500 text-sm py-8 bg-slate-50 rounded border border-slate-100">
                                        <p>Menunggu proses pengadaan selesai...</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-8 rounded-xl border border-dashed text-center text-slate-500">
                                Tahap BAST belum tersedia.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProcurementDetail;

