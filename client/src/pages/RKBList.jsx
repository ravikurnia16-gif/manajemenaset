import { useState, useEffect } from 'react';
import { Plus, Eye, CheckCircle, FileText, Calendar } from 'lucide-react';
import api from '../lib/axios';

const RKBList = () => {
    const [rkbs, setRkbs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newRKB, setNewRKB] = useState({ fiscalYear: new Date().getFullYear(), unitId: '' });
    const [units, setUnits] = useState([]);
    const currentUser = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        fetchRKBs();
        if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN_ASET') {
            fetchUnits();
        } else {
            setNewRKB(prev => ({ ...prev, unitId: currentUser.unitId }));
        }
    }, []);

    const fetchRKBs = async () => {
        try {
            const res = await api.get('/rkb');
            setRkbs(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUnits = async () => {
        try {
            const res = await api.get('/master/units');
            setUnits(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/rkb', newRKB);
            alert('RKB Berhasil dibuat!');
            setShowModal(false);
            fetchRKBs();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal membuat RKB');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Rencana Kebutuhan Barang (RKB)</h1>
                    <p className="text-slate-500 text-sm">Perencanaan anggaran dan pengadaan tahunan</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                >
                    <Plus size={18} /> Buat RKB Baru
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Tahun Anggaran</th>
                            <th className="px-6 py-4">Unit Kerja</th>
                            <th className="px-6 py-4">Total Item</th>
                            <th className="px-6 py-4">Total Anggaran</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-8">Memuat data...</td></tr>
                        ) : rkbs.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-8 text-slate-500">Belum ada RKB dibuat.</td></tr>
                        ) : (
                            rkbs.map(rkb => (
                                <tr key={rkb.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-2">
                                        <Calendar size={16} className="text-blue-500" />
                                        {rkb.fiscalYear}
                                    </td>
                                    <td className="px-6 py-4">{rkb.unit?.name}</td>
                                    <td className="px-6 py-4">{rkb.items?.length || 0}</td>
                                    <td className="px-6 py-4 font-mono font-medium text-blue-600">
                                        Rp {rkb.totalBudget?.toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${rkb.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                                                rkb.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-slate-100 text-slate-500'
                                            }`}>
                                            {rkb.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-blue-600 hover:text-blue-800 font-medium text-xs flex items-center gap-1 justify-end ml-auto">
                                            <Eye size={14} /> Detail
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Create */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                        <h2 className="text-lg font-bold mb-4">Buat RKB Baru</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tahun Anggaran</label>
                                <input
                                    type="number"
                                    required
                                    value={newRKB.fiscalYear}
                                    onChange={e => setNewRKB({ ...newRKB, fiscalYear: e.target.value })}
                                    className="w-full border p-2 rounded-lg"
                                />
                            </div>
                            {(currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN_ASET') && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit Kerja</label>
                                    <select
                                        required
                                        value={newRKB.unitId}
                                        onChange={e => setNewRKB({ ...newRKB, unitId: e.target.value })}
                                        className="w-full border p-2 rounded-lg"
                                    >
                                        <option value="">-- Pilih Unit --</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Batal</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-lg">Buat RKB</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RKBList;
