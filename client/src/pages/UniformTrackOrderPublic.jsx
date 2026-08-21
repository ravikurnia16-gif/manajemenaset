import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Package, Phone } from 'lucide-react';
import api from '../lib/axios';

export default function UniformTrackOrderPublic() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ code: '', phone: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await api.get('/uniforms/public/track-order', {
                params: { code: form.code, phone: form.phone }
            });
            // If found, redirect to invoice page
            navigate(`/public/invoice-seragam/${res.data.id}`);
        } catch (err) {
            setError(err.response?.data?.error || 'Gagal melacak pesanan. Periksa kembali Kode Referensi dan Nomor HP Anda.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans flex items-center justify-center">
            <div className="max-w-md w-full bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border border-slate-100">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-4 bg-blue-100 text-blue-600 rounded-full mb-4">
                        <Search size={32} />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800">Cek Pesanan</h1>
                    <p className="text-slate-500 mt-2">Masukkan Kode Referensi dan Nomor HP untuk melihat status pesanan seragam Anda.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm font-medium border border-rose-100">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <Package size={14} /> Kode Referensi
                        </label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="Misal: INV/SRG/2026/001" 
                            value={form.code}
                            onChange={(e) => setForm({ ...form, code: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <Phone size={14} /> Nomor HP (WA)
                        </label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="Nomor yang digunakan saat memesan" 
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !form.code || !form.phone}
                        className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                    >
                        {loading ? 'Mencari...' : <><Search size={20} /> Lacak Pesanan</>}
                    </button>
                </form>

                <div className="mt-8 text-center text-xs text-slate-400 font-medium">
                    Jika Anda lupa Kode Referensi, silakan cek notifikasi WhatsApp dari Admin atau cek pesanan Anda saat melakukan pembelian.
                </div>
            </div>
        </div>
    );
}
