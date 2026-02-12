import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Save, Box, MapPin, MessageSquare, AlertCircle } from 'lucide-react';
import api from '../lib/axios';

const MutationForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedAssetId = searchParams.get('assetId');

    const [assets, setAssets] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        assetId: preselectedAssetId || '',
        toRoomId: '',
        reason: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [assetRes, roomRes] = await Promise.all([
                api.get('/assets'),
                api.get('/master/rooms')
            ]);
            // assets might be paginated, check structure
            setAssets(assetRes.data.data || assetRes.data);
            setRooms(roomRes.data);

            if (preselectedAssetId) {
                setForm(prev => ({ ...prev, assetId: preselectedAssetId }));
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.assetId || !form.toRoomId) return alert('Pilih aset dan ruangan tujuan');

        setSubmitting(true);
        try {
            await api.post('/assets/movements/request', form);
            alert('Permintaan mutasi berhasil dikirim dan menunggu persetujuan.');
            navigate('/mutasi');
        } catch (error) {
            alert('Gagal mengirim permintaan: ' + (error.response?.data?.error || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div></div>;

    const selectedAsset = assets.find(a => a.id === parseInt(form.assetId));

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Ajukan Mutasi Aset</h1>
                        <p className="text-sm text-slate-500">Pindahkan aset ke lokasi atau ruangan baru.</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-8">
                    {/* Asset Selection */}
                    <div className="space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <Box size={14} className="text-blue-500" /> Pilih Aset
                        </label>
                        <select
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-slate-50/50"
                            value={form.assetId}
                            onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                            required
                        >
                            <option value="">-- Pilih Aset --</option>
                            {assets.map(a => (
                                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                        </select>
                        {selectedAsset && (
                            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                                <AlertCircle size={16} className="text-blue-500 mt-0.5" />
                                <div className="text-xs text-blue-700">
                                    <p className="font-bold mb-1 underline">Lokasi Saat Ini:</p>
                                    <p className="font-medium">{selectedAsset.room?.name || 'Lokasi tidak terdefinisi'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* Target Location */}
                    <div className="space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <MapPin size={14} className="text-orange-500" /> Ruangan Tujuan
                        </label>
                        <select
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-medium"
                            value={form.toRoomId}
                            onChange={(e) => setForm({ ...form, toRoomId: e.target.value })}
                            required
                        >
                            <option value="">-- Pilih Ruangan Tujuan --</option>
                            {rooms.map(r => (
                                <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                            ))}
                        </select>
                    </div>

                    {/* Reason */}
                    <div className="space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <MessageSquare size={14} className="text-green-500" /> Alasan Mutasi
                        </label>
                        <textarea
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 min-h-[120px]"
                            placeholder="Contoh: Perpindahan staf, renovasi ruangan, dll..."
                            value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        ></textarea>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20 text-lg"
                    >
                        {submitting ? <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div> : <><Save size={20} /> Kirim Pengajuan</>}
                    </button>
                    <p className="text-center text-[10px] text-slate-400">
                        *Pengajuan akan diverifikasi oleh Admin/Kabid Sarpras sebelum data aset diperbarui.
                    </p>
                </div>
            </form>
        </div>
    );
};

export default MutationForm;
