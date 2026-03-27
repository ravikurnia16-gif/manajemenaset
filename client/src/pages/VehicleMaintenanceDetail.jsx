import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, Calendar, Car, Gauge, DollarSign, Info, MapPin } from 'lucide-react';
import api from '../lib/axios';

const VehicleMaintenanceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [log, setLog] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLog();
    }, [id]);

    const fetchLog = async () => {
        try {
            const res = await api.get(`/vehicles/maintenance/${id}`);
            setLog(res.data);
        } catch (error) {
            console.error('Failed to fetch maintenance log:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    if (!log) return (
        <div className="p-8 text-center text-slate-500">
            Log tidak ditemukan.
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in slide-in-from-bottom-4">
            <button
                onClick={() => navigate('/kendaraan/pemeliharaan')}
                className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors"
            >
                <ArrowLeft size={16} /> Kembali ke Riwayat
            </button>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Header */}
                <div className="bg-slate-50 p-8 border-b border-slate-100">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex gap-4 items-center">
                            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                                <Wrench size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Rincian Pemeliharaan</h1>
                                <p className="text-slate-500 font-medium">Log ID: #{log.id.toString().padStart(5, '0')}</p>
                            </div>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase ${log.category === 'ROUTINE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {log.category === 'ROUTINE' ? 'Rutin' : 'Non-Rutin'}
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Vehicle Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Car size={16} className="text-blue-500" /> Informasi Kendaraan
                            </h3>
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <p className="text-xl font-black text-slate-800">{log.vehicle?.name}</p>
                                <p className="text-sm font-mono text-blue-600 font-bold uppercase tracking-widest">{log.vehicle?.plateNumber}</p>
                                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Merk</p>
                                        <p className="text-sm font-bold text-slate-700">{log.vehicle?.brand}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Tipe</p>
                                        <p className="text-sm font-bold text-slate-700">{log.vehicle?.type}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Calendar size={16} className="text-green-500" /> Waktu & Biaya
                            </h3>
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500">Tanggal Servis</span>
                                    <span className="text-sm font-bold text-slate-800">{new Date(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                </div>
                                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                                    <span className="text-sm text-slate-500 font-bold">Total Biaya</span>
                                    <span className="text-xl font-black text-blue-600">Rp {log.cost.toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Service Details */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Info size={16} className="text-purple-500" /> Rincian Perbaikan
                        </h3>
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Tipe Layanan</p>
                                    <p className="font-bold text-slate-800">{log.type}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Gauge size={12} /> Kilometer</p>
                                    <p className="font-bold text-slate-800">{log.odometer?.toLocaleString()} km</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><MapPin size={12} /> Bengkel/Lokasi</p>
                                    <p className="font-bold text-slate-800">{log.workshop || '-'}</p>
                                </div>
                            </div>

                            {log.category === 'ROUTINE' && (
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    <p className="text-[10px] text-blue-600 uppercase font-bold mb-1">Target Servis Berikutnya</p>
                                    <p className="text-lg font-black text-blue-700">{log.nextServiceOdometer?.toLocaleString()} km</p>
                                    <p className="text-[10px] text-blue-500 italic mt-1">* Estimasi service kembali setelah {(log.nextServiceOdometer - log.odometer).toLocaleString()} km</p>
                                </div>
                            )}

                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Deskripsi / Catatan Tambahan</p>
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700 whitespace-pre-wrap italic leading-relaxed">
                                    {log.description || 'Tidak ada catatan tambahan.'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Proof Image if exists */}
                    {log.proofFile && (
                        <div className="space-y-4 pt-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Bukti / Nota</h3>
                            <div className="bg-slate-100 p-2 rounded-2xl border border-slate-200 inline-block overflow-hidden max-w-full">
                                <img
                                    src={log.proofFile}
                                    alt="Bukti Servis"
                                    className="rounded-xl max-h-[500px] object-contain hover:scale-105 transition-transform duration-500"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="bg-slate-50 p-6 flex justify-end gap-3">
                    <button
                        onClick={() => navigate(`/kendaraan/pemeliharaan/edit/${log.id}`)}
                        className="px-6 py-2.5 bg-white text-blue-600 border border-blue-100 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-sm"
                    >
                        Edit Data
                    </button>
                    <button
                        onClick={() => navigate('/kendaraan/pemeliharaan')}
                        className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VehicleMaintenanceDetail;
