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
    const user = JSON.parse(localStorage.getItem('user'));
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role);

    useEffect(() => {
        fetchDetail();
    }, [id]);

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
                vendorId: item.vendorId
            });
            alert('Data barang berhasil disimpan!');
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
                    <p className="text-sm font-bold text-slate-700 mt-1">{req.title || '-'}</p>
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

            {/* ITEM DETAILS & VENDOR SELECTION */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FileText size={18} /> Detail Barang & Vendor
                </h3>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                            <tr>
                                <th className="px-4 py-2 min-w-[200px]">Barang</th>
                                <th className="px-4 py-2 min-w-[150px]">Spek & Qty</th>
                                {['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) && (
                                    <>
                                        <th className="px-4 py-2 min-w-[150px]">Merk/Type</th>
                                        <th className="px-4 py-2 min-w-[100px]">Umur (Thn)</th>
                                        <th className="px-4 py-2 min-w-[150px]">Dana & Harga Akhir</th>
                                        {isAdmin && <th className="px-4 py-2 text-right">Aksi</th>}
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y text-slate-700">
                            {req.items.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="px-4 py-3 align-top">
                                        <div className="font-bold text-slate-800">{item.name}</div>
                                        <div className="text-xs text-slate-500 mt-1">Est: Rp {item.estPrice?.toLocaleString('id-ID')}</div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="text-xs bg-slate-100 p-1 rounded mb-1">{item.spec || '-'}</div>
                                        <div className="font-bold">{item.qty} {item.unit}</div>
                                    </td>

                                    {['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) ? (
                                        <>
                                            <td className="px-4 py-3 align-top">
                                                {req.status === 'COMPLETED' ? (
                                                    <span>{item.brand || '-'}</span>
                                                ) : isAdmin ? (
                                                    <input
                                                        className="w-full border p-1 rounded text-xs mb-1"
                                                        placeholder="Merk/Type"
                                                        value={item.brand}
                                                        onChange={e => handleItemChange(index, 'brand', e.target.value)}
                                                    />
                                                ) : <span>{item.brand || '-'}</span>}
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
                                                    <span className="text-[10px] text-slate-400">Fix:</span>
                                                    {isAdmin && req.status !== 'COMPLETED' ? (
                                                        <input
                                                            type="number"
                                                            className="border p-1 rounded text-xs w-24"
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
                                                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700"
                                                    >
                                                        Simpan
                                                    </button>
                                                </td>
                                            )}
                                        </>
                                    ) : null}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BAST & Execution */}
            {['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status) && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 max-w-2xl">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CheckCircle size={18} /> Eksekusi & BAST
                    </h3>

                    {req.status === 'COMPLETED' ? (
                        <div className="bg-green-50 p-4 rounded-lg text-center">
                            <CheckCircle size={40} className="mx-auto text-green-500 mb-2" />
                            <h4 className="font-bold text-green-700">Pengadaan Selesai</h4>
                            <p className="text-xs text-green-600">BAST Tanggal: {new Date(req.bastDate).toLocaleDateString('id-ID')}</p>
                            {req.type === 'ASSET' && <p className="text-[10px] mt-2 text-slate-500">(Aset sudah otomatis masuk database dengan detail yang diinput)</p>}
                        </div>
                    ) : isAdmin ? (
                        <div className="space-y-4">
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Pastikan Anda sudah melengkapi data <b>Merk, Umur Manfaat, dan Harga Akhir</b> di tabel di atas sebelum menyelesaikan proses ini.
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
        </div>
    );
};

export default ProcurementDetail;
