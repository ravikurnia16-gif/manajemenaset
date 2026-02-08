import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, FileText, Upload, DollarSign, Store, ArrowLeft } from 'lucide-react';
import api from '../lib/axios';

const ProcurementDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [req, setReq] = useState(null);
    const [loading, setLoading] = useState(true);
    const [vendorForm, setVendorForm] = useState({ vendorName: '', price: '', isWinner: false });
    const [bastDate, setBastDate] = useState('');
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role);

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        try {
            const res = await api.get(`/procurements/${id}`);
            setReq(res.data);
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

    const handleAddVendor = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/procurements/${id}/offers`, vendorForm);
            setVendorForm({ vendorName: '', price: '', isWinner: false });
            fetchDetail();
        } catch (error) {
            alert(error.response?.data?.error);
        }
    };

    const handleBAST = async () => {
        if (!bastDate) return alert('Pilih tanggal BAST');
        if (!confirm('Proses ini akan menyelesaikan pengadaan dan otomatis mencatat aset (jika tipe Aset). Lanjut?')) return;

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
        <div className="space-y-6 max-w-5xl mx-auto pb-20 animate-in fade-in">
            <button onClick={() => navigate('/procurements')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600">
                <ArrowLeft size={16} /> Kembali ke List
            </button>

            {/* Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-slate-800">{req.code}</h1>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${req.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                                req.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                                    req.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'
                            }`}>{req.status}</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${req.type === 'ASSET' ? 'border-purple-200 text-purple-600 bg-purple-50' : 'border-orange-200 text-orange-600 bg-orange-50'
                            }`}>{req.type}</span>
                    </div>
                    <p className="text-slate-500 text-sm">Unit: <b>{req.unit?.name}</b> • Pemohon: {req.user?.username} • Tgl: {new Date(req.createdAt).toLocaleDateString('id-ID')}</p>
                </div>

                {isAdmin && req.status === 'SUBMITTED' && (
                    <div className="flex gap-2">
                        <button onClick={() => {
                            const reason = prompt('Alasan Penolakan:');
                            if (reason) handleStatus('REJECTED', '', reason);
                        }} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-bold text-sm">Tolak</button>
                        <button onClick={() => handleStatus('APPROVED')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-sm">Validasi & Setujui</button>
                    </div>
                )}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left: Items List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <FileText size={18} /> Daftar Barang Diminta
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                                    <tr>
                                        <th className="px-4 py-2">Nama Barang</th>
                                        <th className="px-4 py-2">Spesifikasi</th>
                                        <th className="px-4 py-2 text-center">Qty</th>
                                        <th className="px-4 py-2 text-right">Est. Harga</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-slate-700">
                                    {req.items.map(item => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-3 font-medium">{item.name}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs max-w-xs">{item.spec}</td>
                                            <td className="px-4 py-3 text-center">{item.qty} {item.unit}</td>
                                            <td className="px-4 py-3 text-right">Rp {item.estPrice?.toLocaleString('id-ID')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Vendor Selection (Only if Approved) */}
                    {['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Store size={18} /> Pemilihan Vendor
                            </h3>

                            {isAdmin && req.status !== 'COMPLETED' && (
                                <form onSubmit={handleAddVendor} className="flex gap-2 items-end mb-6 bg-slate-50 p-4 rounded-lg">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500">Nama Vendor</label>
                                        <input className="w-full border p-2 rounded text-sm" value={vendorForm.vendorName} onChange={e => setVendorForm({ ...vendorForm, vendorName: e.target.value })} required />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-xs font-bold text-slate-500">Harga Penawaran</label>
                                        <input type="number" className="w-full border p-2 rounded text-sm" value={vendorForm.price} onChange={e => setVendorForm({ ...vendorForm, price: e.target.value })} required />
                                    </div>
                                    <div className="flex flex-col items-center px-2">
                                        <label className="text-xs font-bold text-slate-500">Pemenang?</label>
                                        <input type="checkbox" className="mt-2 h-4 w-4" checked={vendorForm.isWinner} onChange={e => setVendorForm({ ...vendorForm, isWinner: e.target.checked })} />
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold">Tambah</button>
                                </form>
                            )}

                            <div className="space-y-3">
                                {req.offers.length === 0 ? <p className="text-slate-400 text-sm italic">Belum ada penawaran vendor</p> :
                                    req.offers.map(offer => (
                                        <div key={offer.id} className={`flex justify-between items-center p-3 rounded-lg border ${offer.isWinner ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                            <div>
                                                <div className="font-bold text-slate-700">{offer.vendorName}</div>
                                                <div className="text-xs text-slate-500">Ditambahkan: {new Date(offer.createdAt).toLocaleDateString('id-ID')}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono font-bold text-slate-700">Rp {offer.price?.toLocaleString('id-ID')}</div>
                                                {offer.isWinner && <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold">WINNER</span>}
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Actions / Timeline */}
                <div className="space-y-6">
                    {/* BAST Section (Final Step) */}
                    {['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <CheckCircle size={18} /> Eksekusi & BAST
                            </h3>

                            {req.status === 'COMPLETED' ? (
                                <div className="bg-green-50 p-4 rounded-lg text-center">
                                    <CheckCircle size={40} className="mx-auto text-green-500 mb-2" />
                                    <h4 className="font-bold text-green-700">Pengadaan Selesai</h4>
                                    <p className="text-xs text-green-600">BAST Tanggal: {new Date(req.bastDate).toLocaleDateString('id-ID')}</p>
                                    {req.type === 'ASSET' && <p className="text-[10px] mt-2 text-slate-500">(Aset sudah otomatis masuk database)</p>}
                                </div>
                            ) : isAdmin ? (
                                <div className="space-y-4">
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Setelah barang diterima dan sesuai, upload BAST dan selesaikan pengadaan.
                                        Jika tipe <b>ASET</b>, sistem akan otomatis membuat data aset baru.
                                    </p>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Tanggal Terima (BAST)</label>
                                        <input type="date" value={bastDate} onChange={e => setBastDate(e.target.value)} className="w-full border p-2 rounded text-sm mt-1" />
                                    </div>
                                    <button onClick={handleBAST} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg font-bold text-sm shadow-lg shadow-blue-900/10">
                                        Selesai & Proses BAST
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center text-slate-500 text-sm py-4 bg-slate-50 rounded">
                                    Menunggu proses admin...
                                </div>
                            )}
                        </div>
                    )}

                    {/* Rejection Info */}
                    {req.status === 'REJECTED' && (
                        <div className="bg-red-50 p-6 rounded-xl border border-red-100">
                            <h3 className="font-bold text-red-700 mb-2">Ditolak</h3>
                            <p className="text-sm text-red-600">{req.rejectionReason || 'Tidak ada alasan.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProcurementDetail;
