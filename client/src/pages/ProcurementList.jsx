import { useNavigate } from 'react-router-dom';
import { Plus, Eye, ShoppingCart, Filter } from 'lucide-react';
import api from '../lib/axios';

const ProcurementList = () => {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ status: '', type: '' });

    useEffect(() => {
        fetchRequests();
    }, [filter]);

    const fetchRequests = async () => {
        try {
            const params = new URLSearchParams(filter).toString();
            const res = await api.get(`/procurements?${params}`);
            setRequests(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pengadaan Barang & Jasa</h1>
                    <p className="text-slate-500 text-sm">Daftar permintaan pengadaan aset dan non-aset</p>
                </div>
                <button
                    onClick={() => navigate('/procurements/new')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                >
                    <Plus size={18} /> Buat Pengajuan
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <Filter size={16} className="text-slate-400" />
                <select
                    className="border-none bg-slate-50 rounded-lg px-3 py-1.5 text-sm focus:ring-0"
                    value={filter.status}
                    onChange={e => setFilter({ ...filter, status: e.target.value })}
                >
                    <option value="">Semua Status</option>
                    <option value="SUBMITTED">Menunggu Validasi</option>
                    <option value="APPROVED">Disetujui</option>
                    <option value="PROCESS">Diproses Vendor</option>
                    <option value="COMPLETED">Selesai</option>
                </select>
                <select
                    className="border-none bg-slate-50 rounded-lg px-3 py-1.5 text-sm focus:ring-0"
                    value={filter.type}
                    onChange={e => setFilter({ ...filter, type: e.target.value })}
                >
                    <option value="">Semua Jenis</option>
                    <option value="ASSET">Aset (Barang Modal)</option>
                    <option value="NON_ASSET">Non-Aset (Habis Pakai)</option>
                </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Kode Request</th>
                            <th className="px-6 py-4">Unit Kerja</th>
                            <th className="px-6 py-4">Jenis</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Tanggal</th>
                            <th className="px-6 py-4 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-8">Memuat data...</td></tr>
                        ) : requests.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-8 text-slate-500">Belum ada pengajuan.</td></tr>
                        ) : (
                            requests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-2">
                                        <ShoppingCart size={16} className="text-blue-500" />
                                        {req.code}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-700">{req.unit?.name}</div>
                                        <div className="text-[10px] text-slate-400">Oleh: {req.user?.username}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${req.type === 'ASSET' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'
                                            }`}>
                                            {req.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${req.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                                            req.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                                                req.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                                    'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {new Date(req.createdAt).toLocaleDateString('id-ID')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => navigate(`/procurements/${req.id}`)}
                                            className="text-blue-600 hover:text-blue-800 font-medium text-xs flex items-center gap-1 justify-end ml-auto"
                                        >
                                            <Eye size={14} /> Detail / Validasi
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProcurementList;
