import { useState, useEffect } from 'react';
import { BookOpen, Search, Calendar, User, Info, AlertCircle, CheckCircle, XCircle, Clock, ArrowRightLeft, Building2 } from 'lucide-react';
import api from '../lib/axios';

const LoanList = () => {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('ACTIVE'); // ACTIVE (PENDING/BORROWED), HISTORY (RETURNED/REJECTED)
    const [reviewModal, setReviewModal] = useState({ isOpen: false, data: null, status: '', reason: '' });
    const [addModal, setAddModal] = useState({
        isOpen: false,
        purpose: '',
        expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    const [cart, setCart] = useState([]); // List of selected assets
    const [targetUnitId, setTargetUnitId] = useState('');
    const [units, setUnits] = useState([]);
    const [assets, setAssets] = useState([]);
    const [assetSearch, setAssetSearch] = useState('');

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isAdminUnit = user.role === 'ADMIN_UNIT';

    useEffect(() => {
        fetchLoans();
    }, [activeTab]);

    useEffect(() => {
        if (addModal.isOpen) {
            fetchAvailableAssets(assetSearch);
            fetchUnits();
        }
    }, [assetSearch, addModal.isOpen]);

    const fetchUnits = async () => {
        try {
            const res = await api.get('/master/units');
            setUnits(res.data);
        } catch (error) {
            console.error('Fetch units error:', error);
        }
    };

    const fetchAvailableAssets = async (query = '') => {
        try {
            const res = await api.get(`/assets?limit=50&search=${query}&condition=BAIK&isLendable=true`);
            const assetData = res.data.data || res.data;
            setAssets(Array.isArray(assetData) ? assetData : []);
        } catch (error) {
            console.error('Fetch assets error:', error);
        }
    };

    const fetchLoans = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/loans');
            let data = res.data;

            if (activeTab === 'ACTIVE') {
                data = data.filter(l => l.status === 'PENDING' || l.status === 'BORROWED' || l.status === 'APPROVED');
            } else {
                data = data.filter(l => l.status === 'RETURNED' || l.status === 'REJECTED');
            }

            setLoans(data);
        } catch (error) {
            console.error('Fetch loans error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestLoan = async () => {
        try {
            if (cart.length === 0 || !addModal.purpose || !targetUnitId) {
                alert('Pilih setidaknya satu aset, unit tujuan, dan masukkan tujuan peminjaman');
                return;
            }
            setLoading(true);
            await api.post('/api/loans/request', {
                assetIds: cart.map(a => a.id),
                purpose: addModal.purpose,
                expectedReturnDate: addModal.expectedReturnDate,
                targetUnitId: parseInt(targetUnitId)
            });
            alert('Permohonan peminjaman berhasil diajukan');
            setAddModal({ isOpen: false, purpose: '', expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] });
            setCart([]);
            setTargetUnitId('');
            setAssetSearch('');
            fetchLoans();
        } catch (error) {
            alert('Gagal mengajukan: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async () => {
        try {
            setLoading(true);
            await api.post(`/api/loans/${reviewModal.data.id}/review`, {
                status: reviewModal.status,
                rejectionReason: reviewModal.reason
            });
            alert(`Peminjaman berhasil ${reviewModal.status === 'APPROVED' ? 'disetujui' : 'ditolak'}`);
            setReviewModal({ isOpen: false, data: null, status: '', reason: '' });
            fetchLoans();
        } catch (error) {
            alert('Gagal memproses: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleReturn = async (loanId) => {
        if (!window.confirm('Aset sudah dikembalikan?')) return;
        try {
            setLoading(true);
            await api.post(`/api/loans/${loanId}/return`);
            alert('Aset berhasil ditandai sebagai kembali');
            fetchLoans();
        } catch (error) {
            alert('Gagal memproses pengembalian: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const filteredLoans = Array.isArray(loans) ? loans.filter(l =>
        l.asset?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.borrower?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    // Helper to check if current user can approve
    const canApprove = (loan) => {
        if (isSuperAdmin) return true;
        // Check if user is Sarpras Unit (ADMIN_UNIT) for the asset's unit
        return isAdminUnit && user.unitId === loan.asset.unitId;
    };

    return (
        <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ArrowRightLeft className="text-blue-600" /> Peminjaman Aset
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Monitoring peminjaman dan pengembalian aset inventaris
                    </p>
                </div>
                <button
                    onClick={() => setAddModal(prev => ({ ...prev, isOpen: true }))}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                    <BookOpen size={18} /> Pinjam Aset
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('ACTIVE')}
                    className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'ACTIVE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Daftar Aktif (Dipinjam)
                </button>
                <button
                    onClick={() => setActiveTab('HISTORY')}
                    className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Riwayat Selesai
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center gap-3">
                    <Search className="text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari aset atau peminjam..."
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
                                <th className="px-6 py-4">Peminjam</th>
                                <th className="px-6 py-4">Tujuan (Unit)</th>
                                <th className="px-6 py-4">Waktu</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">Memuat data...</td>
                                </tr>
                            ) : filteredLoans.length > 0 ? filteredLoans.map(l => (
                                <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-800">{l.asset?.name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{l.asset?.code}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px]">
                                                {l.borrower?.name?.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-700">{l.borrower?.name}</div>
                                                <div className="text-[10px] text-slate-400 uppercase tracking-tight">{l.purpose}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[11px]">
                                                <Building2 size={12} /> {l.targetUnit?.name || 'Unit Internal'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 italic max-w-[150px] truncate">{l.purpose}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-[11px] text-slate-600">
                                                <Calendar size={12} className="text-blue-500" />
                                                <span>Pinjam: {l.borrowDate ? new Date(l.borrowDate).toLocaleDateString('id-ID') : '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-600">
                                                <Clock size={12} className="text-amber-500" />
                                                <span>Batas: {new Date(l.expectedReturnDate).toLocaleDateString('id-ID')}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {l.status === 'PENDING' && <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">MENUNGGU</span>}
                                        {l.status === 'BORROWED' && <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">DIPINJAM</span>}
                                        {l.status === 'RETURNED' && <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">KEMBALI</span>}
                                        {l.status === 'REJECTED' && (
                                            <div className="flex flex-col">
                                                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold w-fit">DITOLAK</span>
                                                <span className="text-[9px] text-red-400 mt-1 italic">{l.rejectionReason}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            {l.status === 'PENDING' && canApprove(l) && (
                                                <>
                                                    <button
                                                        onClick={() => setReviewModal({ isOpen: true, data: l, status: 'APPROVED', reason: '' })}
                                                        className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-all active:scale-90"
                                                        title="Setujui"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => setReviewModal({ isOpen: true, data: l, status: 'REJECTED', reason: '' })}
                                                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all active:scale-90"
                                                        title="Tolak"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                </>
                                            )}
                                            {l.status === 'BORROWED' && (isSuperAdmin || l.borrowerId === user.id) && (
                                                <button
                                                    onClick={() => handleReturn(l.id)}
                                                    className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all text-[10px] font-bold"
                                                >
                                                    KEMBALIKAN
                                                </button>
                                            )}
                                            <button className="p-1.5 text-slate-400 hover:text-slate-600">
                                                <Info size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2 opacity-60">
                                            <AlertCircle size={32} />
                                            <p className="font-medium">Tidak ada peminjaman</p>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                            {reviewModal.status === 'APPROVED' ? 'Setujui Peminjaman' : 'Tolak Peminjaman'}
                        </h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Anda akan {reviewModal.status === 'APPROVED' ? 'menyetujui' : 'menolak'} peminjaman aset <strong>{reviewModal.data.asset.name}</strong> oleh <strong>{reviewModal.data.borrower.name}</strong>.
                        </p>

                        {reviewModal.status === 'REJECTED' && (
                            <div className="space-y-2 mb-6 text-slate-800">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alasan Penolakan</label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                    rows={3}
                                    placeholder="..."
                                    value={reviewModal.reason}
                                    onChange={(e) => setReviewModal(prev => ({ ...prev, reason: e.target.value }))}
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => setReviewModal({ isOpen: false, data: null, status: '', reason: '' })}
                                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold outline-none"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleReview}
                                disabled={loading || (reviewModal.status === 'REJECTED' && !reviewModal.reason)}
                                className={`px-5 py-2.5 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 ${reviewModal.status === 'APPROVED' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                            >
                                {loading ? 'Memproses...' : (reviewModal.status === 'APPROVED' ? 'Setujui' : 'Tolak')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Loan Modal */}
            {addModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 text-slate-800">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3 text-blue-600">
                                <ArrowRightLeft size={28} />
                                <h3 className="text-2xl font-black tracking-tight">Pinjam Aset</h3>
                            </div>
                            <button onClick={() => setAddModal(prev => ({ ...prev, isOpen: false }))} className="text-slate-300 hover:text-slate-500 transition-colors"><XCircle size={28} /></button>
                        </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Unit Tujuan (Lokasi Penggunaan)</label>
                                    <select
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:border-blue-500 outline-none"
                                        value={targetUnitId}
                                        onChange={(e) => setTargetUnitId(e.target.value)}
                                    >
                                        <option value="">Pilih Unit Tujuan...</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Pilih Aset (Kondisi Baik)</label>
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                                                placeholder="Cari aset..."
                                                value={assetSearch}
                                                onChange={(e) => setAssetSearch(e.target.value)}
                                            />
                                        </div>
                                        {assetSearch && assets.length > 0 && (
                                            <div className="max-h-40 overflow-y-auto border-2 border-slate-100 rounded-2xl bg-white p-2 space-y-1 shadow-lg absolute z-10 w-[calc(100%-4rem)] custom-scrollbar">
                                                {assets.map(a => (
                                                    <button
                                                        key={a.id}
                                                        onClick={() => {
                                                            addToCart(a);
                                                            setAssetSearch('');
                                                        }}
                                                        className="w-full text-left px-4 py-3 rounded-xl transition-all hover:bg-blue-50 text-slate-700 border border-transparent hover:border-blue-200"
                                                    >
                                                        <div className="font-bold text-sm">{a.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{a.code} • {a.unit?.name}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {cart.length > 0 && (
                                    <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Daftar Peminjaman ({cart.length})</label>
                                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                            {cart.map(item => (
                                                <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                                                    <div>
                                                        <div className="font-bold text-xs text-slate-800">{item.name}</div>
                                                        <div className="text-[9px] text-slate-400 font-mono">{item.code}</div>
                                                    </div>
                                                    <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                                                        <XCircle size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Rencana Pengembalian</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:border-blue-500 outline-none"
                                        value={addModal.expectedReturnDate}
                                        onChange={(e) => setAddModal(prev => ({ ...prev, expectedReturnDate: e.target.value }))}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Alasan / Keperluan</label>
                                    <textarea
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-blue-500 outline-none"
                                        rows={2}
                                        placeholder="Contoh: Digunakan untuk kegiatan outbound..."
                                        value={addModal.purpose}
                                        onChange={(e) => setAddModal(prev => ({ ...prev, purpose: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => {
                                    setAddModal(prev => ({ ...prev, isOpen: false }));
                                    setCart([]);
                                    setTargetUnitId('');
                                }}
                                className="px-6 py-3 text-slate-500 hover:text-slate-700 font-bold"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleRequestLoan}
                                disabled={loading || cart.length === 0 || !addModal.purpose || !targetUnitId}
                                className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? 'Memproses...' : 'Kirim Permohonan'}
                            </button>
                        </div>
                    </div>
                </div >
            )}
        </div >
    );
};

export default LoanList;
