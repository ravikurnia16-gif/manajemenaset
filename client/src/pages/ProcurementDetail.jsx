import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, FileText, Upload, DollarSign, Store, ArrowLeft, Plus, Trash2, ShoppingCart, UserCheck, Camera, Image } from 'lucide-react';
import api from '../lib/axios';
import SearchableSelect from '../components/SearchableSelect';

const ProcurementDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [req, setReq] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bastDate, setBastDate] = useState('');
    const [vendors, setVendors] = useState([]);
    const [users, setUsers] = useState([]);
    const [handoverPhoto, setHandoverPhoto] = useState(null);

    // View Management (Split Pages)
    const [activeTab, setActiveTab] = useState(1); // 1: Verifikasi, 2: Penugasan, 3: Vendor, 4: Finalisasi, 5: BAST/Handover

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'ADMIN_UNIT', 'KEPALA_BIDANG'].includes(user?.role);

    // Check if current user is assigned to ANY item in this procurement
    const isAssignedToAny = req?.items?.some(item => item.assignedToId === user?.id) || false;
    // Check if current user is assigned to a SPECIFIC item
    const isAssignedToItem = (item) => item.assignedToId === user?.id;
    // Combined: can act on this procurement (admin OR assigned)
    const canAct = isAdmin || isAssignedToAny;

    useEffect(() => {
        fetchDetail();
        fetchVendors();
        fetchUsers();
    }, [id]);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data.map(u => ({
                id: u.id,
                name: u.name || u.username
            })));
            console.log('--- USER DEBUG ---');
            console.log('Total users from API:', res.data.length);
            console.log('Total users in state:', res.data.length);
            console.log('User roles present:', [...new Set(res.data.map(u => u.role))]);
            console.log('Full User Data:', res.data);
            console.log('--- END DEBUG ---');
        } catch (error) {
            console.error(error);
            alert('Gagal mengambil daftar pengguna. Periksa koneksi database.');
        }
    };

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
                    needComparison: item.needComparison !== false, // Default true
                    assignedTo: item.assignedTo || '',
                    assignedToId: item.assignedToId || null
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
                needComparison: item.needComparison,
                assignedTo: item.assignedTo,
                assignedToId: item.assignedToId
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
            await api.post(`/procurements/${id}/bast`, {
                bastDate,
                bastFile: handoverPhoto // Send the Base64 photo
            });
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
                <div className="flex border-b border-slate-100 flex-wrap">
                    {[
                        { step: 1, label: 'Verifikasi', status: ['SUBMITTED'] },
                        { step: 2, label: 'Penugasan', status: ['APPROVED'] },
                        { step: 3, label: 'Vendor Pembanding', status: ['APPROVED'] },
                        { step: 4, label: 'Finalisasi', status: ['PROCESS'] },
                        { step: 5, label: 'Serah Terima', status: ['PROCESS', 'COMPLETED'] },
                    ].map((s, i) => {
                        const isDone = (s.step === 1 && req.status !== 'SUBMITTED') ||
                            (s.step === 2 && ['VALIDATED', 'APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status)) || // Note: Status logic might need refinement
                            (s.step === 3 && ['PROCESS', 'COMPLETED'].includes(req.status)) ||
                            (s.step === 4 && ['PROCESS', 'COMPLETED'].includes(req.status)) ||
                            (s.step === 5 && req.status === 'COMPLETED');

                        // Disable logic
                        let isDisabled = false;
                        if (s.step === 2 && req.status === 'SUBMITTED') isDisabled = true;
                        if (s.step === 3 && req.status === 'SUBMITTED') isDisabled = true;
                        if (s.step === 4 && ['SUBMITTED', 'APPROVED'].includes(req.status)) isDisabled = true;
                        if (s.step === 5 && ['SUBMITTED', 'APPROVED'].includes(req.status)) isDisabled = true;

                        return (
                            <button
                                key={s.step}
                                onClick={async () => {
                                    if (isDisabled) return;

                                    // If moving from Penugasan (tab 2) to subsequent tabs
                                    if (activeTab === 2 && s.step > 2) {
                                        const missing = req.items.find(item => !item.assignedToId);
                                        if (missing) {
                                            return alert(`Harap pilih petugas untuk item: ${missing.name}`);
                                        }
                                        setLoading(true);
                                        try {
                                            for (const item of req.items) {
                                                await handleSaveItem(item, true);
                                            }
                                        } catch (e) {
                                            setLoading(false);
                                            return alert('Gagal simpan otomatis.');
                                        }
                                        setLoading(false);
                                    }

                                    setActiveTab(s.step);
                                }}
                                className={`flex-1 min-w-[120px] py-4 text-xs font-bold flex flex-col items-center gap-1 border-b-2 transition-colors ${activeTab === s.step ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'} ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                                disabled={isDisabled}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${isDone ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                    {isDone ? '✓' : s.step}
                                </div>
                                {s.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="min-h-[400px]">
                {/* === STAGE 1: VERIFIKASI === */}
                {activeTab === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-left-4 fade-in">
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
                                    <button onClick={() => {
                                        handleStatus('APPROVED');
                                        setActiveTab(2);
                                    }} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm">
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

                            {req.status !== 'SUBMITTED' && (
                                <div className="mt-4 p-4 bg-green-50 text-green-700 border border-green-100 rounded-lg text-sm font-medium flex items-center gap-2">
                                    <CheckCircle size={16} /> Request telah diverifikasi dan disetujui.
                                </div>
                            )}
                        </div>

                        {/* RINGKASAN ITEMS */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <ShoppingCart size={18} /> Detail Barang yang Diajukan
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                                        <tr>
                                            <th className="p-3 rounded-l-lg w-10 text-center">No</th>
                                            <th className="p-3">Nama Barang</th>
                                            <th className="p-3">Spesifikasi</th>
                                            <th className="p-3 text-center">Jumlah</th>
                                            <th className="p-3">Satuan</th>
                                            <th className="p-3 text-right">Est. Harga</th>
                                            <th className="p-3 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {req.items.map((item, i) => (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="p-3 text-center text-slate-400 font-mono">{i + 1}</td>
                                                <td className="p-3 font-bold text-slate-800">{item.name}</td>
                                                <td className="p-3 text-slate-600 text-xs">{item.spec || '-'}</td>
                                                <td className="p-3 text-center font-bold">{item.qty}</td>
                                                <td className="p-3 text-slate-600">{item.unit}</td>
                                                <td className="p-3 text-right font-mono">Rp {(item.estPrice || 0).toLocaleString('id-ID')}</td>
                                                <td className="p-3 text-right font-mono font-bold">Rp {((item.qty || 0) * (item.estPrice || 0)).toLocaleString('id-ID')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                {/* === STAGE 2: PENUGASAN INTERNAL === */}
                {activeTab === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <UserCheck size={18} /> Tahap 2: Penugasan Internal
                                </h3>
                                {isAdmin && ['APPROVED', 'PROCESS'].includes(req.status) && (
                                    <button
                                        onClick={async () => {
                                            const missing = req.items.find(item => !item.assignedToId);
                                            if (missing) {
                                                return alert(`Harap pilih petugas untuk item: ${missing.name}`);
                                            }
                                            // Auto-save all items
                                            setLoading(true);
                                            try {
                                                for (const item of req.items) {
                                                    await handleSaveItem(item, true);
                                                }
                                                setActiveTab(3);
                                            } catch (error) {
                                                alert('Gagal menyimpan penugasan. Periksa koneksi.');
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm"
                                    >
                                        Lanjut ke Pemilihan Vendor &rsaquo;
                                    </button>
                                )}
                            </div>

                            <p className="text-xs text-slate-500 mb-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                                <b>Catatan:</b> Silakan tentukan staf (Akun Sistem) yang akan bertanggung jawab mengelola setiap item pengadaan ini.
                            </p>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                                        <tr>
                                            <th className="p-3 rounded-l-lg w-10 text-center">No</th>
                                            <th className="p-3">Item</th>
                                            <th className="p-3 rounded-r-lg">Ditugaskan Kepada (Akun Sistem)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {req.items.map((item, index) => (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="p-3 text-center text-slate-400 font-mono">{index + 1}</td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-700">{item.name}</div>
                                                    <div className="text-xs text-slate-500">{item.spec}</div>
                                                </td>
                                                <td className="p-3">
                                                    <select
                                                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                                                        value={item.assignedToId || ''}
                                                        disabled={req.status === 'COMPLETED' || !isAdmin}
                                                        onChange={(e) => {
                                                            const selectedId = e.target.value ? parseInt(e.target.value) : null;
                                                            const selectedUser = users.find(u => u.id === selectedId);
                                                            handleItemChange(index, 'assignedToId', selectedId);
                                                            handleItemChange(index, 'assignedTo', selectedUser?.name || '');
                                                        }}
                                                    >
                                                        <option value="">-- Pilih Pengguna --</option>
                                                        {users.map(u => (
                                                            <option key={u.id} value={u.id}>{u.name}</option>
                                                        ))}
                                                    </select>
                                                    {users.length === 0 && (
                                                        <p className="text-xs text-red-500 mt-1">⚠ Daftar pengguna kosong. Periksa koneksi database.</p>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* === STAGE 3: VENDOR PEMBANDING === */}
                {activeTab === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Store size={18} /> Tahap 3: Pemilihan Vendor Pembanding
                                </h3>
                                {req.status === 'APPROVED' && (isAdmin || isAssignedToAny) && (
                                    <button onClick={() => {
                                        handleStatus('PROCESS', 'Melanjutkan ke Tahap Finalisasi');
                                        setActiveTab(4);
                                    }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm">
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
                                                <p className="text-xs text-slate-500">{item.spec} • {item.qty} {item.unit}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                {(isAdmin || isAssignedToItem(item)) && req.status === 'APPROVED' && (
                                                    <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border border-slate-300">
                                                        <input
                                                            type="checkbox"
                                                            id={`needComp-${item.id}`}
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                            checked={item.needComparison}
                                                            onChange={e => {
                                                                handleItemChange(index, 'needComparison', e.target.checked);
                                                                handleSaveItem({ ...item, needComparison: e.target.checked }, true);
                                                            }}
                                                        />
                                                        <label htmlFor={`needComp-${item.id}`} className="text-xs font-bold text-slate-600 cursor-pointer">Perlu Perbandingan?</label>
                                                    </div>
                                                )}

                                                {(isAdmin || isAssignedToItem(item)) && req.status === 'APPROVED' && item.needComparison && (
                                                    <button onClick={() => {
                                                        const newComparisons = [...(item.comparisonVendors || [])];
                                                        newComparisons.push({ name: '', price: 0, notes: '' });
                                                        handleItemChange(index, 'comparisonVendors', newComparisons);
                                                        handleSaveItem({ ...item, comparisonVendors: newComparisons }, true);
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
                                                        {(isAdmin || isAssignedToItem(item)) && req.status === 'APPROVED' && (
                                                            <button onClick={() => {
                                                                const newComparisons = item.comparisonVendors.filter((_, i) => i !== cvIndex);
                                                                handleItemChange(index, 'comparisonVendors', newComparisons);
                                                                handleSaveItem({ ...item, comparisonVendors: newComparisons }, true);
                                                            }} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                                        )}
                                                        <div className="space-y-2 text-xs">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-400 mb-1">VENDOR</label>
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
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-400 mb-1">HARGA</label>
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
                    </div>
                )}
                {/* === STAGE 4: FINALISASI === */}
                {activeTab === 4 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <DollarSign size={18} /> Tahap 4: Finalisasi Harga & Vendor
                                </h3>
                                {(isAdmin || isAssignedToAny) && req.status === 'PROCESS' && (
                                    <button onClick={() => setActiveTab(5)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm">
                                        Lanjut ke Serah Terima &rsaquo;
                                    </button>
                                )}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                                        <tr>
                                            <th className="p-3 rounded-l-lg">Item</th>
                                            <th className="p-3">Vendor Terpilih</th>
                                            <th className="p-3">Harga Final</th>
                                            <th className="p-3">Brand</th>
                                            {req.type === 'ASSET' && <th className="p-3">Umur</th>}
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
                                                        disabled={req.status === 'COMPLETED' || !(isAdmin || isAssignedToItem(item))}
                                                    >
                                                        <option value="">- Pilih Vendor -</option>
                                                        {item.needComparison && (item.comparisonVendors || []).map((cv, i) => (
                                                            <option key={`cv-${i}`} value={`CV-${cv.name}`}>{cv.name} (Kandidat)</option>
                                                        ))}
                                                        <option disabled>──────────</option>
                                                        {vendors.map(v => (
                                                            <option key={v.id} value={v.id}>{v.name}</option>
                                                        ))}
                                                        <option value="OTHER">+ Vendor Baru</option>
                                                    </select>
                                                    {item.vendorId === 'OTHER' && (
                                                        <input
                                                            className="mt-1 w-full border border-slate-300 rounded p-1.5 text-xs focus:border-blue-500 outline-none"
                                                            placeholder="Nama Vendor Baru..."
                                                            value={item.newVendorName || ''}
                                                            onChange={e => handleItemChange(index, 'newVendorName', e.target.value)}
                                                        />
                                                    )}
                                                </td>
                                                <td className="p-3 w-32">
                                                    <input
                                                        type="number"
                                                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:border-blue-500 outline-none"
                                                        value={item.finalPrice || ''}
                                                        onChange={e => handleItemChange(index, 'finalPrice', e.target.value)}
                                                        disabled={req.status === 'COMPLETED' || !(isAdmin || isAssignedToItem(item))}
                                                    />
                                                </td>
                                                <td className="p-3 w-32">
                                                    <input
                                                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:border-blue-500 outline-none"
                                                        placeholder="Merk"
                                                        value={item.brand || ''}
                                                        onChange={e => handleItemChange(index, 'brand', e.target.value)}
                                                        disabled={req.status === 'COMPLETED' || !(isAdmin || isAssignedToItem(item))}
                                                    />
                                                </td>
                                                {req.type === 'ASSET' && (
                                                    <td className="p-3 w-20">
                                                        <input
                                                            type="number"
                                                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:border-blue-500 outline-none"
                                                            value={item.usefulLife || 4}
                                                            onChange={e => handleItemChange(index, 'usefulLife', e.target.value)}
                                                            disabled={req.status === 'COMPLETED' || !(isAdmin || isAssignedToItem(item))}
                                                        />
                                                    </td>
                                                )}
                                                <td className="p-3 w-32">
                                                    <select
                                                        className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white focus:border-blue-500 outline-none"
                                                        value={item.fundingSource || 'Mandiri'}
                                                        onChange={e => handleItemChange(index, 'fundingSource', e.target.value)}
                                                        disabled={req.status === 'COMPLETED' || !(isAdmin || isAssignedToItem(item))}
                                                    >
                                                        <option value="Yayasan">Yayasan</option>
                                                        <option value="Hibah">Hibah</option>
                                                        <option value="Wakaf">Wakaf</option>
                                                        <option value="Mandiri">Mandiri</option>
                                                    </select>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {(isAdmin || isAssignedToItem(item)) && req.status === 'PROCESS' && (
                                                        <button onClick={() => handleSaveItem(item)} className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-xs font-bold shadow-sm">
                                                            Simpan
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* === STAGE 5: SERAH TERIMA === */}
                {activeTab === 5 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Camera size={18} /> Tahap 5: Berita Acara & Bukti Serah Terima
                            </h3>

                            {req.status !== 'COMPLETED' ? (
                                <div className="max-w-xl mx-auto space-y-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-slate-700">Tanggal Serah Terima</label>
                                        <input
                                            type="date"
                                            className="w-full border border-slate-300 rounded-lg p-3 focus:border-blue-500 outline-none shadow-sm"
                                            value={bastDate}
                                            onChange={e => setBastDate(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-slate-700">Foto Bukti Serah Terima</label>
                                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative overflow-hidden group">
                                            {handoverPhoto ? (
                                                <div className="relative w-full">
                                                    <img src={handoverPhoto} alt="Bukti" className="max-h-64 mx-auto rounded-lg shadow-md" />
                                                    <button onClick={(e) => { e.stopPropagation(); setHandoverPhoto(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600">
                                                        <XCircle size={20} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <Camera className="mx-auto text-slate-300 mb-2" size={48} />
                                                    <p className="text-slate-400 text-sm">Klik untuk upload foto</p>
                                                </div>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={e => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => setHandoverPhoto(reader.result);
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleBAST}
                                        disabled={!bastDate}
                                        className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg ${!bastDate ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20'}`}
                                    >
                                        Selesaikan Pengadaan & Buat Aset
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-green-50 p-8 rounded-xl border border-green-100 text-center">
                                        <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                                        <h4 className="text-xl font-bold text-green-800">Pengadaan Selesai</h4>
                                        <p className="text-green-600">Terima kasih, pengadaan ini telah berhasil diselesaikan.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <h4 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Info Serah Terima</h4>
                                            <div className="space-y-2 text-sm text-slate-700">
                                                <div className="flex justify-between">
                                                    <span>Tanggal BAST:</span>
                                                    <span className="font-bold">{new Date(req.bastDate).toLocaleDateString('id-ID')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Status:</span>
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">COMPLETED</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <h4 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Bukti Foto</h4>
                                            {req.bastFile ? (
                                                <img src={req.bastFile} alt="Bukti BAST" className="w-full h-32 object-cover rounded-lg shadow-sm border border-slate-200" />
                                            ) : (
                                                <div className="h-32 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 italic text-xs">
                                                    Tidak ada foto bukti.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProcurementDetail;

