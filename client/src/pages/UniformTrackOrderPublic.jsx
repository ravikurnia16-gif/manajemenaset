import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Package, Phone } from 'lucide-react';
import api from '../lib/axios';

export default function UniformTrackOrderPublic() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ code: '', phone: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [orderData, setOrderData] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setOrderData(null);

        try {
            const res = await api.get('/uniforms/public/track-order', {
                params: { code: form.code, phone: form.phone }
            });
            setOrderData(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Gagal melacak pesanan. Periksa kembali Kode Referensi dan Nomor HP Anda.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch(status) {
            case 'PENDING': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md text-xs font-bold">MENUNGGU</span>;
            case 'SEDIA': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold">SEDIA</span>;
            case 'DIAMBIL': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold">DIAMBIL</span>;
            case 'TIDAK_TERSEDIA': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold">KOSONG</span>;
            case 'INDENT': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-bold">INDENT</span>;
            case 'BATAL': return <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-xs font-bold">BATAL</span>;
            default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold">{status}</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans flex flex-col items-center justify-center">
            {!orderData ? (
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
            ) : (
                <div className="max-w-2xl w-full bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Status Pesanan</h2>
                            <p className="text-sm font-medium text-slate-500 mt-1">{orderData.code}</p>
                        </div>
                        <button 
                            onClick={() => setOrderData(null)}
                            className="text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Cari Lainnya
                        </button>
                    </div>

                    <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-700 mb-4">Rincian Barang</h3>
                        <div className="space-y-3">
                            {orderData.type === 'SPMB' || orderData.type === 'UNIT_ORDER' ? (
                                <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100">
                                    <div>
                                        <div className="font-bold text-slate-800">{orderData.package?.name || 'Paket Seragam'}</div>
                                        <div className="text-xs text-slate-500">Status pesanan paket sedang diproses admin.</div>
                                    </div>
                                    {getStatusBadge(orderData.status)}
                                </div>
                            ) : (
                                orderData.items?.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{item.itemName}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">Ukuran: {item.size} &bull; Qty: {item.qty}</div>
                                        </div>
                                        <div>
                                            {getStatusBadge(item.status)}
                                        </div>
                                    </div>
                                ))
                            )}
                            {orderData.note && orderData.note.includes('[NAMADADA') && (() => {
                                const matches = [...orderData.note.matchAll(/\[(NAMADADA(?:_PUTIH|_COKLAT)?):(\d+):(\d+)(?::([A-Z_]+))?\]/g)];
                                return matches.map((match, idx) => {
                                    const type = match[1];
                                    const qty = parseInt(match[2]);
                                    const status = match[4] || 'PENDING';
                                    let name = 'Nama Dada (Bordir)';
                                    if (type === 'NAMADADA_PUTIH') name += ' - Putih';
                                    if (type === 'NAMADADA_COKLAT') name += ' - Coklat';

                                    return (
                                        <div key={`nd-${idx}`} className="flex justify-between items-center p-3 bg-blue-50/40 rounded-lg border border-blue-100 shadow-sm">
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">{name}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">Tambahan Atribut &bull; Qty: {qty} pcs</div>
                                            </div>
                                            <div>
                                                {getStatusBadge(status)}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-8 pt-6 border-t border-slate-100">
                        <button 
                            onClick={() => navigate(`/public/invoice-seragam/${orderData.id}`)}
                            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-center"
                        >
                            Lihat Invoice Lengkap
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
