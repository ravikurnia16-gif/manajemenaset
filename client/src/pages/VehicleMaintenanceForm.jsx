import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Wrench, Save, Calendar, Car, Gauge, DollarSign, PenTool as Tool2 } from 'lucide-react';
import api from '../lib/axios';

const VehicleMaintenanceForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [vehicles, setVehicles] = useState([]);
    const [form, setForm] = useState({
        vehicleId: '',
        date: new Date().toISOString().split('T')[0],
        category: 'ROUTINE',
        type: 'Servis Berkala',
        description: '',
        cost: '',
        odometer: '',
        nextServiceOdometer: '',
        workshop: '',
        proofFile: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/vehicles?forMaintenance=true').then(res => setVehicles(res.data));
        if (isEdit) {
            api.get(`/vehicles/maintenance/${id}`).then(res => {
                const data = res.data;
                setForm({
                    ...data,
                    date: new Date(data.date).toISOString().split('T')[0]
                });
            });
        }
    }, [id]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Final Validation (Sync with Backend)
        if (!form.date || !form.vehicleId || !form.category || !form.type || !form.cost) {
            return alert('Harap isi semua field wajib!');
        }
        if (form.category === 'ROUTINE' && (!form.odometer || !form.nextServiceOdometer)) {
            return alert('Untuk servis rutin, KM saat ini dan KM berikutnya wajib diisi!');
        }

        setLoading(true);
        try {
            if (isEdit) {
                await api.put(`/vehicles/maintenance/${id}`, form);
            } else {
                await api.post('/vehicles/maintenance', form);
            }
            alert('Riwayat pemeliharaan berhasil disimpan');
            navigate('/kendaraan/pemeliharaan');
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20 animate-in slide-in-from-bottom-4">
            <button onClick={() => navigate('/kendaraan/pemeliharaan')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors">
                <ArrowLeft size={16} /> Batal & Kembali
            </button>

            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 italic">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                        <Wrench size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{isEdit ? 'Edit Log Pemeliharaan' : 'Catat Pemeliharaan Baru'}</h1>
                        <p className="text-slate-500 text-sm">Input rincian servis atau perbaikan kendaraan.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Vehicle Choice */}
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <Car size={14} className="text-blue-500" /> Pilih Kendaraan *
                            </label>
                            <select
                                required
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-slate-700"
                                value={form.vehicleId}
                                onChange={e => setForm({ ...form, vehicleId: e.target.value })}
                            >
                                <option value="">--- Pilih Armada ---</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                                ))}
                            </select>
                        </div>

                        {/* Date */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <Calendar size={14} className="text-green-500" /> Tanggal Service *
                            </label>
                            <input
                                type="date"
                                required
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700 font-mono"
                                value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Jenis Service *</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, category: 'ROUTINE' })}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.category === 'ROUTINE' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}
                                >
                                    Rutin
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, category: 'NON_ROUTINE' })}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.category === 'NON_ROUTINE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
                                >
                                    Tidak Rutin
                                </button>
                            </div>
                        </div>

                        {/* Type perbaikan */}
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <Tool2 size={14} className="text-purple-500" /> Jenis Perbaikan / Tipe *
                            </label>
                            <input
                                required
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700"
                                placeholder="Contoh: Ganti Oli, Servis Rem, Ganti Ban, Pajak Tahunan"
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value })}
                            />
                        </div>

                        {/* Biaya */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <DollarSign size={14} className="text-emerald-500" /> Biaya (Rp) *
                            </label>
                            <input
                                type="number"
                                required
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                                placeholder="0"
                                value={form.cost}
                                onChange={e => setForm({ ...form, cost: e.target.value })}
                            />
                        </div>

                        {/* Workshop */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Bengkel / Lokasi</label>
                            <input
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                placeholder="Nama Bengkel"
                                value={form.workshop}
                                onChange={e => setForm({ ...form, workshop: e.target.value })}
                            />
                        </div>

                        {/* Conditional Fields for ROUTINE */}
                        {form.category === 'ROUTINE' && (
                            <>
                                <div className="p-4 bg-green-50 rounded-xl border border-green-100 md:col-span-2 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-green-700 uppercase mb-2">
                                            <Gauge size={14} /> KM Saat Service *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full px-4 py-2.5 rounded-xl border border-green-200 focus:ring-2 focus:ring-green-500 outline-none font-bold text-slate-700"
                                            placeholder="50000"
                                            value={form.odometer}
                                            onChange={e => setForm({ ...form, odometer: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase mb-2">
                                            <Gauge size={14} /> KM Servis Berikutnya *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full px-4 py-2.5 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                                            placeholder="55000"
                                            value={form.nextServiceOdometer}
                                            onChange={e => setForm({ ...form, nextServiceOdometer: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Non Routine fields can just use regular odometer */}
                        {form.category === 'NON_ROUTINE' && (
                            <div className="md:col-span-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                    <Gauge size={14} /> Kilometer Saat Ini
                                </label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-bold"
                                    placeholder="Opsional"
                                    value={form.odometer}
                                    onChange={e => setForm({ ...form, odometer: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Keterangan / Detail Perbaikan</label>
                            <textarea
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 h-24 italic"
                                placeholder="Jelaskan detail perbaikan jika ada..."
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 ">
                        <button
                            type="button"
                            onClick={() => navigate('/kendaraan/pemeliharaan')}
                            className="px-8 py-3 rounded-xl font-bold text-slate-400 hover:text-slate-600 transition-all font-mono"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-orange-600 text-white px-10 py-3 rounded-xl font-black hover:bg-orange-700 shadow-xl shadow-orange-600/30 transition-all transform hover:-translate-y-1 flex items-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <><Save size={20} /> SIMPAN CATATAN PEMELIHARAAN</>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default VehicleMaintenanceForm;
