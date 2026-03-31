import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Wrench } from 'lucide-react';
import axios from 'axios';

const QuickComplete = () => {
    const { token } = useParams();
    const [actionTaken, setActionTaken] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('idle'); // 'idle', 'success', 'error'
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Using relative /api path for production compatibility
            await axios.put(`/api/maintenance/quick-complete/${token}`, {
                actionTaken
            });
            setStatus('success');
        } catch (err) {
            console.error(err);
            setStatus('error');
            setErrorMsg(err.response?.data?.error || 'Gagal memperbarui laporan.');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 w-full max-w-sm text-center space-y-6 animate-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 animate-bounce">
                        <CheckCircle size={48} />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Tugas Selesai!</h1>
                        <p className="text-slate-500 text-sm">Terima kasih atas kerja kerasnya. Data telah diperbarui di sistem Manajemen Aset.</p>
                    </div>
                    <p className="text-[10px] text-slate-300 uppercase font-black tracking-widest pt-4 border-t">Sudah Terkonfirmasi</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
                {/* Header Style */}
                <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-6 text-white text-center">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <Wrench size={24} />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight uppercase tracking-widest">Konfirmasi Perbaikan</h2>
                    <p className="text-blue-100 text-xs mt-1">Selesaikan tugas tanpa login</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {status === 'error' && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm animate-in slide-in-from-top-2">
                            <AlertCircle size={20} className="shrink-0" />
                            <p className="font-semibold">{errorMsg}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700">Tindakan Perbaikan *</label>
                        <textarea
                            value={actionTaken}
                            onChange={(e) => setActionTaken(e.target.value)}
                            placeholder="Jelaskan apa yang sudah diperbaiki (misal: Ganti bohlam, pembersihan filter AC, dll)"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none min-h-[120px]"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 rounded-2xl font-black text-white shadow-xl shadow-blue-500/30 transition-all active:scale-95 ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {loading ? 'MEMPROSES...' : 'KONFIRMASI SELESAI'}
                    </button>

                    <p className="text-center text-[10px] text-slate-400 italic">
                        *Laporan ini akan langsung ditutup setelah dikonfirmasi.
                    </p>
                </form>
            </div>
            
            <div className="mt-8 text-center text-slate-400">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Manajemen Aset & Sarpras</p>
            </div>
        </div>
    );
};

export default QuickComplete;
