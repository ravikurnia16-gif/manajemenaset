import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Car, Calendar, Gauge, CheckCircle2, AlertCircle, ClipboardList, Trash2, ArrowLeft } from 'lucide-react';
import api from '../lib/axios';

const VehicleWeeklyReport = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [vehicle, setVehicle] = useState(null);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        weekStartDate: '',
        weekEndDate: '',
        startOdometer: '',
        endOdometer: '',
        conditionEngine: 'BAIK',
        conditionBody: 'BAIK',
        conditionInterior: 'BAIK',
        isClean: true,
        notes: ''
    });

    useEffect(() => {
        fetchVehicleAndReports();
    }, [id]);

    const fetchVehicleAndReports = async () => {
        try {
            setLoading(true);
            const [vRes, rRes, draftRes] = await Promise.all([
                api.get(`/vehicles/${id}`),
                api.get(`/vehicles/${id}/reports/weekly`),
                api.get(`/vehicles/${id}/reports/weekly/draft`)
            ]);
            setVehicle(vRes.data);
            setReports(rRes.data);

            // Pre-fill dates and odometer from draft
            setForm(prev => ({
                ...prev,
                startOdometer: draftRes.data.startOdometer,
                endOdometer: draftRes.data.endOdometer,
                weekStartDate: draftRes.data.weekStartDate,
                weekEndDate: draftRes.data.weekEndDate
            }));
        } catch (error) {
            console.error('Failed to fetch data:', error);
            alert('Gagal mengambil data kendaraan');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.weekStartDate || !form.weekEndDate || form.endOdometer === '') {
            return alert('Harap isi semua field utama');
        }

        try {
            setSubmitting(true);
            await api.post('/vehicles/reports/weekly', {
                ...form,
                vehicleId: id
            });
            alert('Laporan mingguan berhasil disimpan');
            fetchVehicleAndReports();
            setForm({
                ...form,
                notes: ''
            });
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan laporan');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Memuat data...</div>;
    if (!vehicle) return <div className="p-10 text-center text-red-500">Kendaraan tidak ditemukan</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            <button
                onClick={() => navigate('/kendaraan/data')}
                className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium transition-colors"
            >
                <ArrowLeft size={18} /> Kembali ke Daftar Kendaraan
            </button>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <Car size={32} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">{vehicle.name}</h1>
                        <p className="text-slate-500 font-mono text-sm uppercase">{vehicle.plateNumber}</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Status Kendaraan</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${vehicle.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {vehicle.status === 'ACTIVE' ? 'Aktif' : 'Non-Aktif'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Input */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm sticky top-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <ClipboardList className="text-blue-600" size={20} /> Input Laporan Baru
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Periode (Sabtu - Jumat)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        readOnly
                                        className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-sm cursor-not-allowed"
                                        value={form.weekStartDate}
                                        onChange={e => setForm({ ...form, weekStartDate: e.target.value })}
                                    />
                                    <input
                                        type="date"
                                        readOnly
                                        className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-sm cursor-not-allowed"
                                        value={form.weekEndDate}
                                        onChange={e => setForm({ ...form, weekEndDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase text-nowrap">KM Awal</label>
                                    <input
                                        type="number"
                                        readOnly
                                        className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-sm cursor-not-allowed"
                                        value={form.startOdometer}
                                        onChange={e => setForm({ ...form, startOdometer: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase text-nowrap">KM Akhir</label>
                                    <input
                                        type="number"
                                        readOnly
                                        className="w-full p-2 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-sm cursor-not-allowed font-bold"
                                        value={form.endOdometer}
                                        onChange={e => setForm({ ...form, endOdometer: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Kondisi Mesin</label>
                                <select
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.conditionEngine}
                                    onChange={e => setForm({ ...form, conditionEngine: e.target.value })}
                                >
                                    <option value="BAIK">Baik</option>
                                    <option value="PERLU_PERBAIKAN">Perlu Perbaikan</option>
                                    <option value="RUSAK">Rusak</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Kondisi Body</label>
                                <select
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.conditionBody}
                                    onChange={e => setForm({ ...form, conditionBody: e.target.value })}
                                >
                                    <option value="BAIK">Baik</option>
                                    <option value="LECET">Lecet</option>
                                    <option value="PENYOK">Penyok / Rusak</option>
                                </select>
                            </div>

                            <div className="space-y-4 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={form.isClean}
                                        onChange={e => setForm({ ...form, isClean: e.target.checked })}
                                    />
                                    <span className="text-sm text-slate-600 group-hover:text-blue-600 transition-colors">Unit Bersih & Terawat</span>
                                </label>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Catatan</label>
                                <textarea
                                    rows={3}
                                    placeholder="Keluhan atau catatan lainnya..."
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50 mt-4"
                            >
                                {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* History List */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="text-blue-600" size={20} /> Riwayat Laporan Mingguan
                            </h2>
                            <span className="text-xs text-slate-400 font-bold uppercase">{reports.length} Laporan</span>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {reports.length === 0 ? (
                                <div className="p-20 text-center text-slate-400 italic">Belum ada laporan mingguan.</div>
                            ) : (
                                reports.map(report => (
                                    <div key={report.id} className="p-6 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-700">Minggu Ke- </span>
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">
                                                        {new Date(report.weekStartDate).toLocaleDateString('id-ID')} - {new Date(report.weekEndDate).toLocaleDateString('id-ID')}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-medium">Dilaporkan oleh: {report.user?.name || 'User'}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                            <div className="bg-white p-3 rounded-xl border border-slate-100">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">
                                                    <Gauge size={10} /> Odometer
                                                </p>
                                                <p className="text-sm font-bold text-slate-800">{report.startOdometer} - {report.endOdometer} km</p>
                                                <span className="text-[10px] text-blue-500 font-medium">+{(report.endOdometer - report.startOdometer).toLocaleString()} km seminggu</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-100">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Mesin</p>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full ${report.conditionEngine === 'BAIK' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                    <p className="text-xs font-bold text-slate-700">{report.conditionEngine}</p>
                                                </div>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-100">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Body</p>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full ${report.conditionBody === 'BAIK' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                    <p className="text-xs font-bold text-slate-700">{report.conditionBody}</p>
                                                </div>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-100">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 text-nowrap">Kebersihan</p>
                                                <div className="flex items-center gap-1.5">
                                                    {report.isClean ?
                                                        <CheckCircle2 size={14} className="text-green-500" /> :
                                                        <AlertCircle size={14} className="text-red-400" />
                                                    }
                                                    <p className="text-xs font-bold text-slate-700">{report.isClean ? 'Bersih' : 'Kurang Bersih'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {report.notes && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Catatan:</p>
                                                <p className="text-xs text-slate-600 leading-relaxed italic">"{report.notes}"</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleWeeklyReport;
