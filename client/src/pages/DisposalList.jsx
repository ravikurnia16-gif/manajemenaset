import { useState, useEffect } from 'react';
import { Trash2, Search, Calendar, User, Info, AlertCircle, CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import api from '../lib/axios';

const DisposalList = () => {
    const [disposals, setDisposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('PENDING'); // PENDING, FINALIZED (APPROVED/REJECTED)
    const [reviewModal, setReviewModal] = useState({ isOpen: false, data: null, status: '', reason: '' });
    const [addModal, setAddModal] = useState({ isOpen: false, assetId: '', reason: '', method: 'DIMUSNAHKAN', notes: '', disposalDate: new Date().toISOString().split('T')[0] });
    const [assets, setAssets] = useState([]); // Assets available for proposal
    const [assetSearch, setAssetSearch] = useState('');

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN_ASET';
    const canPropose = isAdmin || user.role === 'KEPALA_BIDANG' || user.role === 'ADMIN_UNIT';

    useEffect(() => {
        fetchDisposals();
        if (canPropose) fetchAvailableAssets();
    }, [activeTab]);

    const fetchAvailableAssets = async () => {
        try {
            // Fetch assets that are not disposed. Limiting to 50 for selection or using search in real app.
            const res = await api.get('/assets?limit=100');
            // Assets are in res.data.data if using paginated API
            const assetData = res.data.data || res.data;
            setAssets(Array.isArray(assetData) ? assetData : []);
        } catch (error) {
            console.error('Fetch assets error:', error);
        }
    };

    const handleAddProposal = async () => {
        try {
            if (!addModal.assetId || !addModal.reason) {
                alert('Pilih aset dan isi alasan penghapusan');
                return;
            }
            setLoading(true);
            await api.post('/disposals', {
                assetId: addModal.assetId,
                reason: addModal.reason,
                method: addModal.method,
                notes: addModal.notes,
                disposalDate: addModal.disposalDate
            });
            alert('Usulan penghapusan berhasil diajukan');
            setAddModal({ isOpen: false, assetId: '', reason: '', method: 'DIMUSNAHKAN', notes: '', disposalDate: new Date().toISOString().split('T')[0] });
            fetchDisposals();
        } catch (error) {
            alert('Gagal mengajukan usulan: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchDisposals = async () => {
        try {
            setLoading(true);
            const statusFilter = activeTab === 'PENDING' ? 'PENDING' : '';
            const res = await api.get(`/disposals?status=${statusFilter}`);

            // If FINALIZED tab, filter only APPROVED/REJECTED locally if backend returns all for empty status
            let data = res.data;
            if (activeTab === 'FINALIZED') {
                data = data.filter(d => d.status === 'APPROVED' || d.status === 'REJECTED');
            } else {
                data = data.filter(d => d.status === 'PENDING');
            }

            setDisposals(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async () => {
        try {
            setLoading(true);
            await api.patch(`/disposals/${reviewModal.data.id}/review`, {
                status: reviewModal.status,
                rejectionReason: reviewModal.reason
            });
            alert(`Usulan berhasil ${reviewModal.status === 'APPROVED' ? 'disetujui' : 'ditolak'}`);
            setReviewModal({ isOpen: false, data: null, status: '', reason: '' });
            fetchDisposals();
        } catch (error) {
            alert('Gagal memproses usulan: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const filteredDisposals = Array.isArray(disposals) ? disposals.filter(d =>
        d.asset?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.asset?.code?.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    return (
        <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Trash2 className="text-red-600" /> Penghapusan Aset
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Kelola usulan dan riwayat penghapusan aset inventaris
                    </p>
                </div>
                {canPropose && (
                    <button
                        onClick={() => setAddModal(prev => ({ ...prev, isOpen: true }))}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
                    >
                        <Trash2 size={18} /> Tambah Usulan
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('PENDING')}
                    className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'PENDING' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Daftar Usulan (Pending)
                </button>
                <button
                    onClick={() => setActiveTab('FINALIZED')}
                    className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'FINALIZED' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Riwayat Penghapusan
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center gap-3">
                    <Search className="text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari aset..."
                        className="flex-1 bg-transparent border-none outline-none text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Aset</th>
                                <th className="px-6 py-4">{activeTab === 'PENDING' ? 'Tanggal Usulan' : 'Tanggal Proses'}</th>
                                <th className="px-6 py-4">Metode & Alasan</th>
                                <th className="px-6 py-4">Status & Otorisasi</th>
                                {isAdmin && activeTab === 'PENDING' && <th className="px-6 py-4 text-center">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">Memuat data...</td>
                                </tr>
                            ) : filteredDisposals.length > 0 ? filteredDisposals.map(d => (
                                <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-800">{d.asset?.name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono italic">{d.asset?.code}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Calendar size={14} className="text-slate-400" />
                                            {new Date(activeTab === 'PENDING' ? d.createdAt : (d.reviewedAt || d.disposalDate)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-tight">
                                                {d.method || 'LAINNYA'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-600 leading-relaxed font-medium">
                                            {d.reason}
                                        </div>
                                        {d.notes && (
                                            <div className="text-[10px] text-slate-400 mt-1 italic flex items-start gap-1">
                                                <Info size={10} className="mt-0.5 shrink-0" /> {d.notes}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="mb-2">
                                            {d.status === 'PENDING' && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">MENUNGGU</span>}
                                            {d.status === 'APPROVED' && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">DISETUJUI</span>}
                                            {d.status === 'REJECTED' && (
                                                <div className="space-y-1">
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">DITOLAK</span>
                                                    <p className="text-[9px] text-red-500 italic">{d.rejectionReason}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-[10px] text-slate-500">
                                                By: <span className="font-semibold">{d.proposedBy?.name || d.proposedBy?.username}</span>
                                            </div>
                                        </div>
                                        {d.reviewedBy && (
                                            <div className="text-[9px] text-slate-400 italic">
                                                Rev: {d.reviewedBy.name || d.reviewedBy.username}
                                            </div>
                                        )}
                                    </td>
                                    {isAdmin && activeTab === 'PENDING' && (
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => setReviewModal({ isOpen: true, data: d, status: 'APPROVED', reason: '' })}
                                                    className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                                    title="Setujui"
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setReviewModal({ isOpen: true, data: d, status: 'REJECTED', reason: '' })}
                                                    className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Tolak"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2 opacity-60">
                                            <AlertCircle size={32} />
                                            <p className="font-medium">Tidak ada data ditemukan</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Review Modal */}
            {reviewModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                            {reviewModal.status === 'APPROVED' ? 'Setujui Usulan' : 'Tolak Usulan'}
                        </h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Anda akan {reviewModal.status === 'APPROVED' ? 'menyetujui' : 'menolak'} penghapusan aset <strong>{reviewModal.data.asset.name}</strong>.
                        </p>

                        {reviewModal.status === 'REJECTED' && (
                            <div className="space-y-2 mb-6">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alasan Penolakan</label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                    rows={3}
                                    placeholder="Berikan alasan mengapa usulan ini ditolak..."
                                    value={reviewModal.reason}
                                    onChange={(e) => setReviewModal(prev => ({ ...prev, reason: e.target.value }))}
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setReviewModal({ isOpen: false, data: null, status: '', reason: '' })}
                                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleReview}
                                disabled={loading || (reviewModal.status === 'REJECTED' && !reviewModal.reason)}
                                className={`px-5 py-2.5 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 ${reviewModal.status === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {loading ? 'Memproses...' : (reviewModal.status === 'APPROVED' ? 'Ya, Setujui' : 'Ya, Tolak')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Proposal Modal */}
            {addModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-slate-800">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3 text-red-600">
                                <Trash2 size={24} />
                                <h3 className="text-xl font-bold">Usulkan Penghapusan</h3>
                            </div>
                            <button onClick={() => setAddModal(prev => ({ ...prev, isOpen: false }))} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pilih Aset</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={addModal.assetId}
                                    onChange={(e) => setAddModal(prev => ({ ...prev, assetId: e.target.value }))}
                                >
                                    <option value="">-- Pilih Aset dari Inventaris --</option>
                                    {assets.filter(a => a.condition !== 'DISPOSED').map(a => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.unit?.name || 'No Unit'})</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1 italic">*Hanya aset yang belum dihapus yang muncul di sini</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tanggal</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={addModal.disposalDate}
                                        onChange={(e) => setAddModal(prev => ({ ...prev, disposalDate: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Metode</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={addModal.method}
                                        onChange={(e) => setAddModal(prev => ({ ...prev, method: e.target.value }))}
                                    >
                                        <option value="DIMUSNAHKAN">DIMUSNAHKAN</option>
                                        <option value="DIJUAL">DIJUAL / LELANG</option>
                                        <option value="HIBAH">HIBAH / DONASI</option>
                                        <option value="HILANG">HILANG / DICURI</option>
                                        <option value="TUKAR_TAMBAH">TUKAR TAMBAH</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Alasan Penghapusan</label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={2}
                                    placeholder="Alasan mengapa aset ini perlu dihapus..."
                                    value={addModal.reason}
                                    onChange={(e) => setAddModal(prev => ({ ...prev, reason: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Catatan (Opsional)</label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={2}
                                    placeholder="..."
                                    value={addModal.notes}
                                    onChange={(e) => setAddModal(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setAddModal(prev => ({ ...prev, isOpen: false }))}
                                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleAddProposal}
                                disabled={loading || !addModal.assetId || !addModal.reason}
                                className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? 'Memproses...' : 'Kirim Usulan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DisposalList;
