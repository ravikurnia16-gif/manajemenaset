import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, FileText, Upload, DollarSign, Store, ArrowLeft } from 'lucide-react';
import api from '../lib/axios';

const ProcurementDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [req, setReq] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bastDate, setBastDate] = useState('');
    const [vendors, setVendors] = useState([]);

    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role);

    useEffect(() => {
        fetchDetail();
        fetchVendors();
    }, [id]);

    const fetchVendors = async () => {
        try {
            const res = await api.get('/master/vendors');
            setVendors(res.data);
        } catch (error) {
            console.error('Failed to fetch vendors');
        }
    };

    const fetchDetail = async () => {
        try {
            const res = await api.get(`/procurements/${id}`);
            // Initialize items with defaults if missing
            const data = res.data;
            data.items = data.items.map(item => ({
                ...item,
                brand: item.brand || '',
                usefulLife: item.usefulLife || (data.type === 'ASSET' ? 4 : 0),
                finalPrice: item.finalPrice || item.estPrice,
                fundingSource: item.fundingSource || 'Mandiri',
                vendorId: item.vendorId || ''
            }));
            setReq(data);
        } catch (error) {
            alert('Gagal mengambil data');
        } finally {
            setLoading(false);
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

    const handleSaveItem = async (item) => {
        try {
            await api.put(`/procurements/items/${item.id}`, {
                fundingSource: item.fundingSource,
                brand: item.brand,
                usefulLife: item.usefulLife,
                finalPrice: item.finalPrice,
                vendorId: item.vendorId === 'OTHER' ? null : item.vendorId,
                newVendorName: item.vendorId === 'OTHER' ? item.newVendorName : null
            });
            alert('Data barang berhasil disimpan!');
            fetchDetail();
            fetchVendors(); // Refresh vendor list just in case new one was added
        } catch (error) {
            alert('Gagal menyimpan detail barang');
        }
    };

    const handleBAST = async () => {
        if (!bastDate) return alert('Pilih tanggal BAST');
        if (!confirm('Proses ini akan menyelesaikan pengadaan dan otomatis mencatat aset. Pastikan Detail Barang seperti Vendor, Merk, dll sudah diisi. Lanjut?')) return;

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

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20 animate-in fade-in">
            <button onClick={() => navigate('/procurements')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600">
                <ArrowLeft size={16} /> Kembali ke List
            </button>

            {/* STEPPERUI */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
                <div className="flex justify-between relative">
                    {/* Progress Bar Background */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-0 -translate-y-1/2 rounded" />

                    {/* Step 1: Verifikasi */}
                    <div className={`relative z-10 flex flex-col items-center gap-2 ${['SUBMITTED', 'APPROVED', 'PROCESS', 'COMPLETED', 'REJECTED'].includes(req.status) ? 'opacity-100' : 'opacity-50'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) ? 'bg-green-600 text-white' :
                            req.status === 'REJECTED' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            }`}>
                            1
                        </div>
                        <span className="text-xs font-bold text-slate-700">Verifikasi Info</span>
                    </div>

                    {/* Step 2: Vendor Selection */}
                    <div className={`relative z-10 flex flex-col items-center gap-2 ${['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) ? 'opacity-100' : 'opacity-50'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${req.status === 'COMPLETED' ? 'bg-green-600 text-white' :
                            ['APPROVED', 'PROCESS'].includes(req.status) ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-200 text-slate-500'
                            }`}>
                            2
                        </div>
                        <span className="text-xs font-bold text-slate-700">Pilih Vendor & Harga</span>
                    </div>

                    {/* Step 3: BAST */}
                    <div className={`relative z-10 flex flex-col items-center gap-2 ${req.status === 'COMPLETED' ? 'opacity-100' : 'opacity-50'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${req.status === 'COMPLETED' ? 'bg-green-600 text-white shadow-lg shadow-green-500/30' : 'bg-slate-200 text-slate-500'
                            }`}>
                            3
                        </div>
                        <span className="text-xs font-bold text-slate-700">Eksekusi & BAST</span>
                    </div>
                </div>
            </div>

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
                            <h1 className="text-2xl font-bold text-slate-800">{req.code}</h1>
                            <span className={`px-2 py-1 rounded text-xs font-bold border ${req.type === 'ASSET' ? 'border-purple-200 text-purple-600 bg-purple-50' : 'border-orange-200 text-orange-600 bg-orange-50'
                                }`}>{req.type}</span>
                        </div>
                        <p className="text-slate-500 text-sm">Unit: <b>{req.unit?.name}</b> • Pemohon: {req.user?.username}</p>
                        <p className="text-sm font-bold text-slate-700 mt-1">{req.title || '-'}</p>
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

            {/* STAGE 2: VENDOR SELECTION & PRICING */}
            {['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Store size={18} /> Tahap 2: Finalisasi Vendor & Harga
                        </h3>
                        {req.status === 'APPROVED' && isAdmin && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded font-bold">Silakan lengkapi vendor & harga per item</span>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                                <tr>
                                    <th className="px-4 py-2 min-w-[200px]">Barang</th>
                                    <th className="px-4 py-2 min-w-[150px]">Spek & Qty</th>
                                    <th className="px-4 py-2 min-w-[200px]">Vendor & Merk</th>
                                    <th className="px-4 py-2 min-w-[100px]">Umur (Thn)</th>
                                    <th className="px-4 py-2 min-w-[150px]">Dana & Harga Akhir</th>
                                    {isAdmin && <th className="px-4 py-2 text-right">Aksi</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y text-slate-700">
                                {req.items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 align-top">
                                            <div className="font-bold text-slate-800">{item.name}</div>
                                            <div className="text-xs text-slate-500 mt-1">Est: Rp {item.estPrice?.toLocaleString('id-ID')}</div>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="text-xs bg-slate-100 p-1 rounded mb-1">{item.spec || '-'}</div>
                                            <div className="font-bold">{item.qty} {item.unit}</div>
                                        </td>
                                        <td className="px-4 py-3 align-top text-xs">
                                            <div className="mb-2">
                                                <label className="block text-[10px] text-slate-400 mb-1 font-bold">PILIH VENDOR</label>
                                                {isAdmin && req.status !== 'COMPLETED' ? (
                                                    <>
                                                        <select
                                                            className="w-full border p-1 rounded mb-1 bg-white focus:ring-2 focus:ring-blue-200 outline-none text-xs"
                                                            value={item.vendorId || ''}
                                                            onChange={e => handleItemChange(index, 'vendorId', e.target.value)}
                                                        >
                                                            <option value="">- Pilih Vendor -</option>
                                                            {vendors.map(v => (
                                                                <option key={v.id} value={v.id}>{v.name}</option>
                                                            ))}
                                                            <option value="OTHER" className="font-bold text-blue-600 bg-blue-50">+ Lainnya (Input Manual)</option>
                                                        </select>
                                                        {item.vendorId === 'OTHER' && (
                                                            <input
                                                                className="w-full border p-1 rounded mb-1 bg-yellow-50 focus:ring-2 focus:ring-yellow-200 outline-none text-xs placeholder:text-slate-400 animate-in fade-in"
                                                                placeholder="Ketik Nama Vendor Baru..."
                                                                value={item.newVendorName || ''}
                                                                onChange={e => handleItemChange(index, 'newVendorName', e.target.value)}
                                                                autoFocus
                                                            />
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="font-bold block">{vendors.find(v => v.id === item.vendorId)?.name || '-'}</span>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-1">Merk/Type</label>
                                                {req.status === 'COMPLETED' ? (
                                                    <span>{item.brand || '-'}</span>
                                                ) : isAdmin ? (
                                                    <input
                                                        className="w-full border p-1 rounded"
                                                        placeholder="Merk/Type"
                                                        value={item.brand}
                                                        onChange={e => handleItemChange(index, 'brand', e.target.value)}
                                                    />
                                                ) : <span>{item.brand || '-'}</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            {req.status === 'COMPLETED' ? (
                                                <span>{item.usefulLife} Tahun</span>
                                            ) : isAdmin ? (
                                                <input
                                                    type="number"
                                                    className="w-16 border p-1 rounded text-xs"
                                                    value={item.usefulLife}
                                                    onChange={e => handleItemChange(index, 'usefulLife', e.target.value)}
                                                />
                                            ) : <span>{item.usefulLife} Tahun</span>}
                                        </td>
                                        <td className="px-4 py-3 align-top space-y-1">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-400">Dana:</span>
                                                {isAdmin && req.status !== 'COMPLETED' ? (
                                                    <input
                                                        className="border p-1 rounded text-xs w-24"
                                                        value={item.fundingSource}
                                                        onChange={e => handleItemChange(index, 'fundingSource', e.target.value)}
                                                    />
                                                ) : <span className="text-xs font-bold">{item.fundingSource}</span>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-400">Fix Rp:</span>
                                                {isAdmin && req.status !== 'COMPLETED' ? (
                                                    <input
                                                        type="number"
                                                        className="border p-1 rounded text-xs w-24 font-bold"
                                                        value={item.finalPrice}
                                                        onChange={e => handleItemChange(index, 'finalPrice', e.target.value)}
                                                    />
                                                ) : <span className="text-xs font-bold">Rp {item.finalPrice?.toLocaleString('id-ID')}</span>}
                                            </div>
                                        </td>
                                        {isAdmin && req.status !== 'COMPLETED' && (
                                            <td className="px-4 py-3 text-right align-top">
                                                <button
                                                    onClick={() => handleSaveItem(item)}
                                                    className="bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-900 shadow-lg shadow-slate-200"
                                                >
                                                    Simpan
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* STAGE 3: EXECUTION & BAST */}
            {['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 max-w-2xl animate-in slide-in-from-bottom-4">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CheckCircle size={18} /> Tahap 3: Eksekusi & BAST
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
                                <p>Pastikan seluruh data <b>Vendor, Merk, dan Harga Akhir</b> pada Tahap 2 sudah diisi dan disimpan sebelum memproses BAST.</p>
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
                            <p>Menunggu proses pengadaan oleh Admin & Vendor...</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProcurementDetail;
