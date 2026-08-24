import { useState } from 'react';
import { ShoppingBag, AlertTriangle, Clock, Search, ShieldCheck } from 'lucide-react';

const UniformOrderPage = () => {
    const [checkCode, setCheckCode] = useState('');
    const [checkResult, setCheckResult] = useState(null);
    const [showCheck, setShowCheck] = useState(false);
    const [searchQuery, setSearchQuery] = useState({ name: '', phone: '' });
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchMode, setSearchMode] = useState('code'); // 'code' | 'name'

    const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? 'http://localhost:5000' : '';

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-800">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-50 px-4 py-3.5 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <ShoppingBag size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-base sm:text-lg text-slate-800 leading-tight">Pemesanan Seragam</h1>
                        <p className="text-[10px] text-slate-400">Yayasan Dar el-Iman</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowCheck(!showCheck)} 
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3.5 py-2 rounded-xl hover:bg-indigo-100 transition shadow-sm"
                >
                    {showCheck ? 'Tutup Cek Pesanan' : 'Cek Status Pesanan'}
                </button>
            </div>

            {/* Check Pesanan Modal / Section */}
            {showCheck && (
                <div className="bg-white border-b border-indigo-100 p-4 sm:p-6 shadow-md animate-in slide-in-from-top-3">
                    <div className="max-w-md mx-auto space-y-4">
                        <div className="text-center">
                            <h3 className="font-bold text-slate-800 text-sm sm:text-base">Lacak Pesanan yang Sudah Dibuat</h3>
                            <p className="text-xs text-slate-500">Cek status pesanan yang telah dikirim sebelumnya</p>
                        </div>

                        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit mx-auto">
                            <button 
                                onClick={() => { setSearchMode('code'); setCheckResult(null); setSearchResults([]); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${searchMode === 'code' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-800'}`}
                            >
                                Cari Kode
                            </button>
                            <button 
                                onClick={() => { setSearchMode('name'); setCheckResult(null); setSearchResults([]); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${searchMode === 'name' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-800'}`}
                            >
                                Cari Nama & No HP
                            </button>
                        </div>

                        {searchMode === 'code' ? (
                            <div className="flex gap-2">
                                <input 
                                    value={checkCode} 
                                    onChange={e => setCheckCode(e.target.value.toUpperCase())} 
                                    placeholder="Contoh: SRG-2026-XXXX" 
                                    className="border border-slate-200 p-2.5 rounded-xl w-full text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                                />
                                <button 
                                    onClick={async () => {
                                        if (!checkCode) return alert('Silakan masukkan kode pesanan');
                                        setSearching(true);
                                        try {
                                            const res = await fetch(`${API_BASE}/api/uniform-order/check/${checkCode}`);
                                            const d = await res.json();
                                            if (!res.ok) throw new Error(d.error);
                                            setCheckResult(d);
                                        } catch (e) { 
                                            alert(e.message || 'Pesanan tidak ditemukan'); 
                                        } finally { 
                                            setSearching(false); 
                                        }
                                    }} 
                                    disabled={searching}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-xl text-xs font-bold disabled:opacity-50 transition shadow-sm"
                                >
                                    {searching ? '...' : 'Cari'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <input 
                                    value={searchQuery.name} 
                                    onChange={e => setSearchQuery({...searchQuery, name: e.target.value})} 
                                    placeholder="Nama Lengkap Siswa" 
                                    className="border border-slate-200 p-2.5 rounded-xl w-full text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                                />
                                <div className="flex gap-2">
                                    <input 
                                        value={searchQuery.phone} 
                                        onChange={e => setSearchQuery({...searchQuery, phone: e.target.value})} 
                                        placeholder="Nomor HP (WhatsApp)" 
                                        className="border border-slate-200 p-2.5 rounded-xl w-full text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                                    />
                                    <button 
                                        onClick={async () => {
                                            if (!searchQuery.name || !searchQuery.phone) return alert('Nama dan Nomor HP wajib diisi');
                                            setSearching(true);
                                            try {
                                                const res = await fetch(`${API_BASE}/api/uniform-order/search-public?name=${encodeURIComponent(searchQuery.name)}&phone=${encodeURIComponent(searchQuery.phone)}`);
                                                const d = await res.json();
                                                if (!res.ok) throw new Error(d.error);
                                                setSearchResults(d);
                                                if(d.length === 0) alert('Pesanan tidak ditemukan');
                                            } catch (e) { 
                                                alert(e.message || 'Gagal mencari pesanan'); 
                                            } finally { 
                                                setSearching(false); 
                                            }
                                        }} 
                                        disabled={searching}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl text-xs font-bold whitespace-nowrap disabled:opacity-50 transition shadow-sm"
                                    >
                                        {searching ? '...' : 'Cari Pesanan'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {(checkResult || searchResults.length > 0) && (
                            <div className="space-y-3 max-h-[280px] overflow-auto pt-2">
                                {(checkResult ? [checkResult] : searchResults).map(res => (
                                    <div key={res.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-sm shadow-sm space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div className="font-mono font-bold text-indigo-600">{res.code}</div>
                                            <div className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                                res.status === 'READY' ? 'bg-green-100 text-green-700 border-green-200' :
                                                res.status === 'PICKED_UP' || res.status === 'DONE' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                                'bg-amber-100 text-amber-700 border-amber-200'
                                            }`}>
                                                {res.status}
                                            </div>
                                        </div>
                                        <div className="font-bold text-slate-800">{res.studentName}</div>
                                        <div className="text-xs text-slate-500">Tanggal: {new Date(res.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</div>
                                        
                                        <div className="text-[11px] bg-white p-3 rounded-xl whitespace-pre-wrap font-mono text-slate-600 border border-slate-200">
                                            {res.note?.includes('ITEM PESANAN:') ? res.note.split('ITEM PESANAN:')[1].trim() : (res.note || 'Detail item tidak tersedia')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Main Maintenance Screen Card */}
            <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
                <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-amber-100 overflow-hidden text-center space-y-0">
                    
                    {/* Top Decorative Banner */}
                    <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-8 text-white relative">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                            <AlertTriangle size={40} className="text-white" />
                        </div>
                        <span className="inline-block bg-amber-900/30 text-amber-100 text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full mb-2">
                            Pemberitahuan Sistem
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                            Layanan Sedang Pemeliharaan (Maintenance)
                        </h2>
                    </div>

                    {/* Content */}
                    <div className="p-6 sm:p-8 space-y-5 text-left text-slate-600 text-sm">
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 space-y-2">
                            <p className="font-bold text-xs text-amber-800">
                                Assalamu’alaikum Warahmatullahi Wabarakatuh,
                            </p>
                            <p className="text-xs leading-relaxed text-amber-950">
                                Mohon maaf atas ketidaknyamanannya. Formulir pemesanan seragam online melalui tautan ini saat ini <strong>dinonaktifkan sementara</strong> dalam rangka pemeliharaan dan migrasi server guna meningkatkan kualitas layanan.
                            </p>
                        </div>

                        <div className="flex items-center gap-3.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
                                <Clock size={22} />
                            </div>
                            <div className="text-xs space-y-0.5">
                                <p className="font-bold text-slate-800">Jadwal Pengaktifan Kembali:</p>
                                <p className="text-indigo-600 font-bold text-sm">InsyaAllah akan diaktifkan lagi pekan depan</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
                            <ShieldCheck size={18} className="shrink-0 text-emerald-600" />
                            <span>Pesanan yang sudah masuk sebelumnya tetap tercatat dengan aman di database.</span>
                        </div>

                        <p className="text-[11px] text-slate-400 italic text-center pt-2">
                            *Jazakumullahu khairan katsiran atas perhatian, pengertian, dan kerja sama Bapak/Ibu Wali Murid.
                        </p>

                        <div className="pt-2">
                            <button
                                onClick={() => setShowCheck(true)}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs sm:text-sm shadow-md"
                            >
                                <Search size={16} /> Cek Status Pesanan Saya Sebelumnya
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="text-center py-4 text-xs text-slate-400 border-t bg-white">
                © {new Date().getFullYear()} Sarpras Yayasan Dar el-Iman Padang
            </footer>
        </div>
    );
};

export default UniformOrderPage;
