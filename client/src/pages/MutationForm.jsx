import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Save, Box, MapPin, MessageSquare, AlertCircle, Building2, X } from 'lucide-react';
import api from '../lib/axios';

const MutationForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedIds = searchParams.get('ids')?.split(',') || (searchParams.get('assetId') ? [searchParams.get('assetId')] : []);

    const [assets, setAssets] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        assetIds: preselectedIds,
        type: 'INTERNAL', // INTERNAL | EXTERNAL
        toUnitId: '',
        toRoomId: '',
        reason: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [assetRes, roomRes, unitRes] = await Promise.all([
                api.get('/assets', { params: { limit: 10000 } }), // Fetch more for selection if needed
                api.get('/master/rooms'),
                api.get('/master/units')
            ]);
            setAssets(assetRes.data.data || assetRes.data);
            setRooms(roomRes.data);
            setUnits(unitRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.assetIds.length === 0) return alert('Pilih minimal satu aset');
        if (!form.toRoomId) return alert('Pilih ruangan tujuan');
        if (form.type === 'EXTERNAL' && !form.toUnitId) return alert('Pilih unit tujuan untuk mutasi antar unit');

        setSubmitting(true);
        try {
            await api.post('/assets/movements/request', {
                ...form,
                assetIds: form.assetIds.map(id => parseInt(id))
            });
            alert(`${form.assetIds.length} permintaan mutasi berhasil dikirim dan menunggu persetujuan.`);
            navigate('/mutasi');
        } catch (error) {
            alert('Gagal mengirim permintaan: ' + (error.response?.data?.error || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    const toggleAsset = (id) => {
        const idStr = id.toString();
        setForm(prev => ({
            ...prev,
            assetIds: prev.assetIds.includes(idStr)
                ? prev.assetIds.filter(i => i !== idStr)
                : [...prev.assetIds, idStr]
        }));
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div></div>;

    const selectedAssetsData = assets.filter(a => form.assetIds.includes(a.id.toString()));

    // Logic for internal rooms: must be in the same unit
    // For bulk, let's assume assets are from the same unit if it's INTERNAL
    // Or just show all rooms if it's too complex. For now, let's pick unit from first asset.
    const referenceAsset = selectedAssetsData[0];

    // Filter Logic
    let filteredRooms = [];
    if (form.type === 'INTERNAL' && referenceAsset) {
        filteredRooms = rooms.filter(r => r.unitId === referenceAsset.unitId);
    } else if (form.type === 'EXTERNAL' && form.toUnitId) {
        filteredRooms = rooms.filter(r => r.unitId === parseInt(form.toUnitId));
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Ajukan Mutasi Aset ({form.assetIds.length})</h1>
                        <p className="text-sm text-slate-500">Pindahkan aset terpilih ke lokasi atau ruangan baru.</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-8">
                    {/* Selected Assets List */}
                    <div className="space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <Box size={14} className="text-blue-500" /> Aset Terpilih
                        </label>

                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {selectedAssetsData.length > 0 ? (
                                selectedAssetsData.map(a => (
                                    <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[10px] font-black border border-slate-200 shadow-sm text-blue-600">
                                                {a.code.split('.').pop()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 leading-none mb-1">{a.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{a.code} &bull; {a.unit?.name}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleAsset(a.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                                    <p className="text-slate-400 text-sm font-medium italic">Tidak ada aset terpilih.</p>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/aset')}
                                        className="mt-2 text-blue-600 text-xs font-bold hover:underline"
                                    >
                                        Kembali ke daftar aset
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Dropdown to add more assets could go here, but starting with IDs from AssetList is enough */}
                    </div>

                    <div className="h-px bg-slate-100"></div>

                    {/* Mutation Type */}
                    <div className="space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <ArrowLeftRight size={14} className="text-purple-500" /> Jenis Mutasi
                        </label>
                        <div className="flex gap-4">
                            <label className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${form.type === 'INTERNAL' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" name="type" className="text-blue-600" checked={form.type === 'INTERNAL'} onChange={() => setForm({ ...form, type: 'INTERNAL', toUnitId: '', toRoomId: '' })} />
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">Internal Unit</div>
                                        <div className="text-xs text-slate-500">Pindah ruangan dalam satu unit</div>
                                    </div>
                                </div>
                            </label>
                            <label className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${form.type === 'EXTERNAL' ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" name="type" className="text-orange-600" checked={form.type === 'EXTERNAL'} onChange={() => setForm({ ...form, type: 'EXTERNAL', toUnitId: '', toRoomId: '' })} />
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">Antar Unit</div>
                                        <div className="text-xs text-slate-500">Pindah ke Unit/Divisi lain</div>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Target Unit (If External) */}
                    {form.type === 'EXTERNAL' && (
                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <Building2 size={14} className="text-orange-500" /> Unit Tujuan
                            </label>
                            <select
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-medium bg-orange-50/10"
                                value={form.toUnitId}
                                onChange={(e) => setForm({ ...form, toUnitId: e.target.value, toRoomId: '' })}
                                required
                            >
                                <option value="">-- Pilih Unit Tujuan --</option>
                                {units.filter(u => !referenceAsset || u.id !== referenceAsset.unitId).map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Target Location */}
                    <div className="space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <MapPin size={14} className="text-orange-500" /> Ruangan Tujuan {form.type === 'INTERNAL' ? '(Internal)' : '(Di Unit Baru)'}
                        </label>
                        <select
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-medium"
                            value={form.toRoomId}
                            onChange={(e) => setForm({ ...form, toRoomId: e.target.value })}
                            required
                            disabled={!referenceAsset || (form.type === 'EXTERNAL' && !form.toUnitId)}
                        >
                            <option value="">
                                {!referenceAsset
                                    ? '-- Pilih Aset Terlebih Dahulu --'
                                    : (form.type === 'EXTERNAL' && !form.toUnitId)
                                        ? '-- Pilih Unit Tujuan Terlebih Dahulu --'
                                        : '-- Pilih Ruangan Tujuan --'}
                            </option>
                            {filteredRooms.map(r => (
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
                        disabled={submitting || form.assetIds.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20 text-lg"
                    >
                        {submitting ? <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div> : <><Save size={20} /> Kirim {form.assetIds.length} Pengajuan</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default MutationForm;
