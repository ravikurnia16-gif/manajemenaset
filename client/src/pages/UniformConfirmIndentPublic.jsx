import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { PackageX, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function UniformConfirmIndentPublic() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [confirmations, setConfirmations] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        api.get(`/uniforms/sales/${id}`)
            .then(res => {
                setInvoice(res.data);
                // Pre-fill confirmations
                const initialConf = {};
                res.data.items?.forEach(item => {
                    if (item.status === 'TIDAK_TERSEDIA') {
                        initialConf[item.id] = ''; // '' | 'INDENT' | 'BATAL'
                    }
                });
                setConfirmations(initialConf);
            })
            .catch(err => setError(err.response?.data?.error || 'Pesanan tidak ditemukan'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleActionChange = (itemId, action) => {
        setConfirmations(prev => ({ ...prev, [itemId]: action }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Cek apakah ada yang belum dipilih
        const unselected = Object.values(confirmations).some(val => val === '');
        if (unselected) {
            alert('Mohon pilih aksi (Lanjut Indent / Batal) untuk semua barang yang kosong.');
            return;
        }

        const payload = Object.entries(confirmations).map(([itemId, action]) => ({
            itemId: parseInt(itemId),
            action
        }));

        setSubmitting(true);
        try {
            await api.post(`/uniforms/public/sales/${id}/confirm-indent`, { confirmations: payload });
            setSuccess(true);
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan konfirmasi');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 text-center font-bold text-slate-500">Memuat Data...</div>;
    if (error || !invoice) return <div className="p-10 text-center font-bold text-red-500">{error}</div>;

    const itemsKosong = invoice.items?.filter(item => item.status === 'TIDAK_TERSEDIA') || [];

    if (success || itemsKosong.length === 0) {
        return (
            <div className="min-h-screen bg-slate-100 p-4 md:p-8 flex items-center justify-center">
                <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center">
                    <div className="inline-flex items-center justify-center p-4 bg-green-100 text-green-600 rounded-full mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 mb-2">Terima Kasih!</h1>
                    <p className="text-slate-500 mb-6">
                        Konfirmasi Anda telah kami terima. Silakan cek invoice terbaru Anda untuk melihat rincian pembaruan.
                    </p>
                    <button
                        onClick={() => navigate(`/public/invoice-seragam/${id}`)}
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
                    >
                        Lihat Invoice
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
            <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-100">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                            <AlertCircle size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">Konfirmasi Barang Kosong</h1>
                            <p className="text-slate-500">Invoice: {invoice.code}</p>
                        </div>
                    </div>
                    <p className="text-slate-600 mt-4 leading-relaxed">
                        Halo <b>{invoice.customerName || invoice.studentName}</b>, mohon maaf saat ini ada barang pesanan Anda yang sedang kosong/habis stok. 
                        Silakan pilih apakah Anda bersedia menunggu (Indent) atau membatalkan pesanan untuk barang tersebut.
                    </p>
                </div>

                <div className="p-6 md:p-8 bg-slate-50">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {itemsKosong.map(item => (
                            <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">{item.itemName}</h3>
                                        <div className="text-slate-500 text-sm mt-1">
                                            Ukuran: {item.size} &bull; Qty: {item.qty} pcs
                                        </div>
                                        <div className="text-blue-600 font-bold mt-1">
                                            Rp {item.totalPrice.toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                    <div className="bg-rose-100 text-rose-700 px-3 py-1 rounded-lg text-xs font-bold uppercase">
                                        KOSONG
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleActionChange(item.id, 'INDENT')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold ${
                                            confirmations[item.id] === 'INDENT'
                                                ? 'bg-blue-50 border-blue-600 text-blue-700'
                                                : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'
                                        }`}
                                    >
                                        <CheckCircle size={18} />
                                        <span>Lanjut Indent</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleActionChange(item.id, 'BATAL')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold ${
                                            confirmations[item.id] === 'BATAL'
                                                ? 'bg-rose-50 border-rose-600 text-rose-700'
                                                : 'bg-white border-slate-200 text-slate-500 hover:border-rose-300'
                                        }`}
                                    >
                                        <XCircle size={18} />
                                        <span>Batalkan Barang</span>
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="pt-4 border-t border-slate-200">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50 disabled:grayscale"
                            >
                                {submitting ? 'Menyimpan...' : 'Simpan Konfirmasi'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
