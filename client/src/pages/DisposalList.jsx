import { useState, useEffect } from 'react';
import { Trash2, Search, Calendar, User, Info, AlertCircle, CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import api from '../lib/axios';

const DisposalList = () => {
    const [disposals, setDisposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('PENDING'); // PENDING, FINALIZED (APPROVED/REJECTED), PELELANGAN
    const [reviewModal, setReviewModal] = useState({ isOpen: false, data: null, status: '', reason: '' });
    const [addModal, setAddModal] = useState({ isOpen: false, assetId: '', reason: '', method: 'DIMUSNAHKAN', notes: '', disposalDate: new Date().toISOString().split('T')[0] });
    const [assets, setAssets] = useState([]); // Assets from server
    const [assetSearch, setAssetSearch] = useState(''); // Display/Input value
    const [assetSearchTerm, setAssetSearchTerm] = useState(''); // Debounced term for API
    
    // Pelelangan States
    const [auctions, setAuctions] = useState([]);
    const [bidModal, setBidModal] = useState({ isOpen: false, auction: null, bidPrice: '', notes: '' });
    const [winnerModal, setWinnerModal] = useState({ isOpen: false, auction: null });

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(user.role);
    const canPropose = isAdmin || user.role === 'KEPALA_BIDANG' || user.role === 'ADMIN_UNIT';

    useEffect(() => {
        fetchDisposals();
    }, [activeTab]);

    // Debounce asset search
    useEffect(() => {
        if (!addModal.isOpen) return;
        const timer = setTimeout(() => {
            setAssetSearchTerm(assetSearch);
        }, 500);
        return () => clearTimeout(timer);
    }, [assetSearch, addModal.isOpen]);

    useEffect(() => {
        if (canPropose && addModal.isOpen) {
            fetchAvailableAssets(assetSearchTerm);
        }
    }, [assetSearchTerm, canPropose, addModal.isOpen]);

    const fetchAvailableAssets = async (query = '') => {
        try {
            // Fetch assets with search query and limit. 
            // We search for assets that are NOT disposed.
            const res = await api.get(`/assets?limit=50&search=${query}`);
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
            setAssetSearch('');
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
            if (activeTab === 'PELELANGAN') {
                const res = await api.get('/disposals/auctions');
                setAuctions(res.data);
            } else {
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
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleBidSubmit = async () => {
        try {
            setLoading(true);
            await api.post(`/disposals/auctions/${bidModal.auction.id}/bids`, {
                bidPrice: parseFloat(bidModal.bidPrice),
                notes: bidModal.notes
            });
            alert('Penawaran berhasil diajukan');
            setBidModal({ isOpen: false, auction: null, bidPrice: '', notes: '' });
            fetchDisposals();
        } catch (error) {
            alert('Gagal mengajukan penawaran: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSetWinner = async (bidId) => {
        if (!confirm('Anda yakin ingin memilih penawar ini sebagai pemenang? Keputusan ini tidak dapat dibatalkan.')) return;
        try {
            setLoading(true);
            await api.patch(`/disposals/auctions/bids/${bidId}/win`);
            alert('Pemenang berhasil ditetapkan');
            setWinnerModal({ isOpen: false, auction: null });
            fetchDisposals();
        } catch (error) {
            alert('Gagal menetapkan pemenang: ' + (error.response?.data?.error || error.message));
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

    const filteredAuctions = Array.isArray(auctions) ? auctions.filter(a =>
        a.asset?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.asset?.code?.toLowerCase().includes(searchTerm.toLowerCase())
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
                        onClick={() => {
                            setAssetSearch('');
                            setAddModal(prev => ({ ...prev, isOpen: true }));
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
                    >
                        <Trash2 size={18} /> Tambah Usulan
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-slate-200 hide-scrollbar">
                <button
                    onClick={() => setActiveTab('PENDING')}
                    className={`px-6 py-3 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${activeTab === 'PENDING' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Daftar Usulan (Pending)
                </button>
                <button
                    onClick={() => setActiveTab('FINALIZED')}
                    className={`px-6 py-3 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${activeTab === 'FINALIZED' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Riwayat Penghapusan
                </button>
                <button
                    onClick={() => setActiveTab('PELELANGAN')}
                    className={`px-6 py-3 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${activeTab === 'PELELANGAN' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Pelelangan Aset
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

                {activeTab === 'PELELANGAN' ? (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loading ? (
                            <div className="col-span-full py-12 text-center text-slate-400">Memuat data pelelangan...</div>
                        ) : filteredAuctions.length > 0 ? filteredAuctions.map(auction => (
                            <div key={auction.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col">
                                {auction.asset?.image ? (
                                    <img src={auction.asset.image} alt={auction.asset.name} className="w-full h-48 object-cover border-b border-slate-100" />
                                ) : (
                                    <div className="w-full h-48 bg-slate-100 flex flex-col items-center justify-center text-slate-400 border-b border-slate-100">
                                        <Info size={32} className="mb-2 opacity-50" />
                                        <span className="text-xs font-medium">Tidak ada foto</span>
                                    </div>
                                )}
                                <div className="p-4 flex-1 flex flex-col">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="font-bold text-slate-800 line-clamp-1">{auction.asset?.name}</h3>
                                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{auction.asset?.code}</p>
                                        </div>
                                        {auction.winnerId ? (
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold whitespace-nowrap">SELESAI</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold whitespace-nowrap">DIBUKA</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mb-4 line-clamp-2 flex-1">{auction.reason}</p>
                                    
                                    <div className="flex items-center justify-between text-xs mb-4">
                                        <div className="flex flex-col">
                                            <span className="text-slate-400 mb-0.5">Penawar Tertinggi</span>
                                            <span className="font-bold text-slate-700">
                                                {auction.winnerId 
                                                    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(auction.finalPrice)
                                                    : (auction.bids?.length > 0 
                                                        ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(auction.bids[0].bidPrice)
                                                        : 'Belum ada')
                                                }
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-slate-400 mb-0.5">Total Penawar</span>
                                            <span className="font-bold text-slate-700">{auction.bids?.length || 0} orang</span>
                                        </div>
                                    </div>

                                    {auction.winnerId ? (
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-auto">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Pemenang</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                    {auction.winner?.name?.charAt(0) || auction.winner?.username?.charAt(0)}
                                                </div>
                                                <span className="text-sm font-semibold text-slate-700">{auction.winner?.name || auction.winner?.username}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 mt-auto">
                                            <button
                                                onClick={() => setBidModal({ isOpen: true, auction, bidPrice: '', notes: '' })}
                                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
                                            >
                                                Ajukan Harga
                                            </button>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => setWinnerModal({ isOpen: true, auction })}
                                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                                                >
                                                    Lihat Penawar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full py-12 text-center text-slate-400">
                                <div className="flex flex-col items-center gap-2 opacity-60">
                                    <AlertCircle size={32} />
                                    <p className="font-medium">Tidak ada aset yang sedang dilelang</p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
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
                )}
            </div>

            {/* Bid Modal */}
            {bidModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-slate-800">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-800">Ajukan Pembelian</h3>
                            <button onClick={() => setBidModal({ isOpen: false, auction: null, bidPrice: '', notes: '' })} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-6">
                            <p className="text-xs text-blue-800 font-medium">Aset: <strong>{bidModal.auction?.asset?.name}</strong></p>
                            <p className="text-[10px] font-mono text-blue-600/70">{bidModal.auction?.asset?.code}</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Harga Penawaran (Rp)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Contoh: 150000"
                                    value={bidModal.bidPrice}
                                    onChange={(e) => setBidModal({ ...bidModal, bidPrice: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Catatan / Kontak</label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={2}
                                    placeholder="Nomor WA yang bisa dihubungi..."
                                    value={bidModal.notes}
                                    onChange={(e) => setBidModal({ ...bidModal, notes: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setBidModal({ isOpen: false, auction: null, bidPrice: '', notes: '' })}
                                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleBidSubmit}
                                disabled={loading || !bidModal.bidPrice}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? 'Menyimpan...' : 'Kirim Harga'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Winner Modal */}
            {winnerModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-slate-800">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Daftar Penawaran</h3>
                                <p className="text-sm text-slate-500 mt-1">Pilih pemenang untuk <strong>{winnerModal.auction?.asset?.name}</strong></p>
                            </div>
                            <button onClick={() => setWinnerModal({ isOpen: false, auction: null })} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 border border-slate-100 rounded-xl">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">Nama Penawar</th>
                                        <th className="px-4 py-3 text-right">Harga</th>
                                        <th className="px-4 py-3">Catatan</th>
                                        <th className="px-4 py-3 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {winnerModal.auction?.bids?.length > 0 ? winnerModal.auction.bids.map(bid => (
                                        <tr key={bid.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                {bid.user?.name || bid.user?.username}
                                                <div className="text-[10px] text-slate-400 mt-0.5">{new Date(bid.createdAt).toLocaleString('id-ID')}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-600">
                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(bid.bidPrice)}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {bid.notes || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleSetWinner(bid.id)}
                                                    disabled={loading}
                                                    className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Pilih Pemenang
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="4" className="px-4 py-8 text-center text-slate-400">Belum ada penawaran</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

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
                            <button onClick={() => {
                                setAssetSearch('');
                                setAddModal(prev => ({ ...prev, isOpen: false }));
                            }} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pilih Aset</label>

                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Cari nama atau kode aset..."
                                            value={assetSearch}
                                            onChange={(e) => setAssetSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50 p-1 space-y-1">
                                        {assets
                                            .filter(a => a.condition !== 'DISPOSED')
                                            .filter(a =>
                                                a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
                                                a.code.toLowerCase().includes(assetSearch.toLowerCase())
                                            )
                                            .map(a => (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setAddModal(prev => ({ ...prev, assetId: a.id }));
                                                        setAssetSearch(`${a.code} - ${a.name}`);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${addModal.assetId === a.id ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-blue-50 text-slate-700'}`}
                                                >
                                                    <div className="font-bold truncate">{a.name}</div>
                                                    <div className={`text-[10px] ${addModal.assetId === a.id ? 'text-blue-100' : 'text-slate-400'} font-mono uppercase`}>
                                                        {a.code} • {a.unit?.name || 'No Unit'} • {a.room?.name || 'No Room'}
                                                    </div>
                                                </button>
                                            ))}
                                        {assets.filter(a => a.condition !== 'DISPOSED' && (a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.code.toLowerCase().includes(assetSearch.toLowerCase()))).length === 0 && (
                                            <div className="p-4 text-center text-xs text-slate-400">Aset tidak ditemukan</div>
                                        )}
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 italic">*Pilih aset dari daftar di atas</p>
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
                                onClick={() => {
                                    setAssetSearch('');
                                    setAddModal(prev => ({ ...prev, isOpen: false }));
                                }}
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
