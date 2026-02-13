import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    Package, Calendar, Tag, DollarSign,
    Home, Building2, MapPin, Info,
    TrendingDown, Hourglass, CheckCircle2
} from 'lucide-react';
import axios from 'axios';

const PublicAssetView = () => {
    const { id } = useParams();
    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAsset = async () => {
            try {
                // Robust API Base Detection:
                // 1. If we're on port 5173 (Vite dev), we need to hit port 3000 (Node dev).
                // 2. Otherwise, we use relative paths (works for Production/Docker/Proxied setups).
                let apiPath = `/api/assets/public/${id}`;

                if (window.location.port === '5173') {
                    const devBase = `${window.location.protocol}//${window.location.hostname}:3000`;
                    apiPath = `${devBase}${apiPath}`;
                }

                const response = await axios.get(apiPath);
                setAsset(response.data);
            } catch (err) {
                console.error('Fetch error:', err);
                setError(err.response?.data?.error || 'Aset tidak ditemukan atau terjadi kesalahan server.');
            } finally {
                setLoading(false);
            }
        };

        fetchAsset();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-500 font-medium">Memuat data aset...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-sm bg-white p-8 rounded-2xl shadow-xl border border-red-100">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Info size={32} />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Ups! Terjadi Kesalahan</h1>
                    <p className="text-slate-500 text-sm mb-6">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all"
                    >
                        Coba Lagi
                    </button>
                </div>
            </div>
        );
    }

    const DetailItem = ({ icon: Icon, label, value, color = "blue", suffix = "" }) => (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-4">
            <div className={`p-2 bg-${color}-50 text-${color}-600 rounded-lg shrink-0`}>
                <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-slate-700 font-bold break-words leading-tight">
                    {value || '-'} {suffix}
                </p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">
            {/* Header / Brand */}
            <div className="bg-white px-6 py-8 border-b border-slate-200">
                <div className="max-w-md mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <Package size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 leading-none">Rincian Aset</h1>
                        <p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-1">Sistem Manajemen Aset</p>
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto p-4 space-y-4 -mt-4">
                {/* Primary Info Card */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 border border-slate-100 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Package size={120} />
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                            {asset.code}
                        </span>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                            <CheckCircle2 size={10} /> {asset.condition}
                        </span>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-1 leading-tight">{asset.name}</h2>
                    <p className="text-slate-500 font-medium mb-6">{asset.brand} &bull; {asset.category}</p>

                    <div className="grid grid-cols-1 gap-3">
                        <DetailItem icon={Calendar} label="Tanggal Perolehan" value={new Date(asset.purchaseDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} />
                        <DetailItem icon={Building2} label="Vendor / Pemasok" value={asset.vendor} color="indigo" />
                        <DetailItem icon={Tag} label="Sumber Dana" value={asset.sourceOfFunds} color="emerald" />
                    </div>
                </div>

                {/* Financial Info Section */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                        <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                            <TrendingDown size={18} className="text-orange-500" />
                            Status Ekonomi
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-slate-50 pb-3">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Harga Perolehan</span>
                                <span className="text-slate-400 font-bold shrink-0">Rp {asset.price?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Nilai Buku Saat Ini</span>
                                <span className="text-blue-600 text-xl font-black shrink-0">Rp {asset.bookValue?.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-600 p-6 rounded-3xl shadow-lg text-white">
                        <h3 className="text-sm font-black text-indigo-100 mb-4 flex items-center gap-2">
                            <Hourglass size={18} />
                            Sisa Umur Manfaat
                        </h3>
                        <p className="text-3xl font-black mb-1">{asset.remainingLife.text}</p>
                        <p className="text-xs text-indigo-200 font-medium tracking-wide">Berdasarkan perhitungan penyusutan garis lurus</p>
                    </div>
                </div>

                {/* Location Card */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                    <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                        <MapPin size={18} className="text-red-500" />
                        Lokasi Aset
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Unit / Bidang</p>
                            <p className="font-bold text-slate-700 leading-tight">{asset.unit}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Ruangan</p>
                            <p className="font-bold text-slate-700 leading-tight">{asset.room}</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Gedung</p>
                        <p className="font-bold text-slate-700">{asset.building || 'Utama'}</p>
                    </div>
                </div>

                {/* Footer Footer */}
                <div className="pt-8 text-center px-6">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-4">Aset Terdaftar Padang, Sumatera Barat</p>
                    <div className="flex items-center justify-center gap-2 text-slate-300">
                        <div className="w-8 h-px bg-slate-200"></div>
                        <Info size={14} />
                        <div className="w-8 h-px bg-slate-200"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicAssetView;
