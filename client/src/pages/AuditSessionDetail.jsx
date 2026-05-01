import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ClipboardCheck, ArrowLeft, Scan, Search, MapPin, 
    ShieldCheck, AlertTriangle, HelpCircle, Save, X, Camera,
    CheckCircle2, AlertCircle, Info, RefreshCcw
} from 'lucide-react';
import { Html5QrcodeScanner } from "html5-qrcode";
import ExcelJS from 'exceljs';
import api from '../lib/axios';

// Helper Components (Defined at top to avoid hoisting issues)
const ChevronRight = ({className, size}) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

const AuditSessionDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('PENDING'); // PENDING, FOUND, MISSING
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [roomFilter, setRoomFilter] = useState('');
    const [allRooms, setAllRooms] = useState([]);
    
    // Scanner State
    const [showScanner, setShowScanner] = useState(false);
    const [scannerLoading, setScannerLoading] = useState(false);
    
    // Verification Form
    const [selectedItem, setSelectedItem] = useState(null);
    const [form, setForm] = useState({
        condition: 'BAIK',
        note: '',
        status: 'FOUND'
    });

    const fetchSession = async () => {
        try {
            setLoading(true);
            setSession(res.data);
            const roomsRes = await api.get('/master/rooms');
            setAllRooms(roomsRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchSession(); }, [id]);

    // Handle Scanner
    useEffect(() => {
        if (showScanner) {
            const scanner = new Html5QrcodeScanner("reader", { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                rememberLastUsedCamera: true
            }, false);

            scanner.render(onScanSuccess, onScanError);
            return () => scanner.clear();
        }
    }, [showScanner]);

    function onScanSuccess(decodedText) {
        // decodedText is the Asset Code
        handleScan(decodedText);
    }

    function onScanError(err) { /* quiet error */ }

    const handleScan = async (code) => {
        const item = session.items.find(i => i.asset.code === code);
        if (!item) {
            alert('Aset dengan kode ' + code + ' tidak terdaftar dalam sesi audit ini.');
            return;
        }
        setSelectedItem(item);
        setForm({ 
            condition: item.asset.condition || 'BAIK', 
            note: '', 
            status: 'FOUND',
            foundLocationId: item.asset.roomId
        });
        setShowScanner(false);
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        try {
            await api.post('/audit/verify', {
                sessionId: id,
                assetCode: selectedItem.asset.code,
                status: form.status,
                condition: form.condition,
                note: form.note
            });
            setSelectedItem(null);
            fetchSession();
        } catch (e) { alert(e.response?.data?.error || 'Gagal memverifikasi'); }
    };

    const handleFinalize = async () => {
        if (!confirm('Finalisasi audit? Seluruh aset yang "Ditemukan" akan diperbarui kondisinya di database utama.')) return;
        try {
            await api.post(`/audit/${id}/finalize`);
            fetchSession();
            alert('Audit berhasil difinalisasi!');
        } catch (e) { alert(e.response?.data?.error || 'Gagal finalisasi'); }
    };

    const handleBulkAction = async (status) => {
        if (!selectedIds.length) return;
        if (!confirm(`Tandai ${selectedIds.length} aset sebagai ${status === 'FOUND' ? 'ADA' : 'HILANG'}?`)) return;
        try {
            await api.post('/audit/bulk-verify', {
                sessionId: id,
                itemIds: selectedIds,
                status
            });
            setSelectedIds([]);
            fetchSession();
        } catch (e) { alert('Gagal memproses masal'); }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredItems.length && selectedIds.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredItems.map(i => i.id));
        }
    };

    const handleApprove = async (itemId, approved) => {
        try {
            await api.post('/audit/approve-item', { id: itemId, approved });
            fetchSession();
        } catch (e) { alert('Gagal memproses persetujuan'); }
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Audit');

        // Styles
        const titleStyle = { font: { bold: true, size: 14 } };
        const headerStyle = { font: { bold: true, color: { argb: 'FFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '10B981' } }, alignment: { horizontal: 'center' } };

        // Title
        worksheet.addRow(['BERITA ACARA HASIL AUDIT ASET (STOCK OPNAME)']).style = titleStyle;
        worksheet.addRow(['Nama Sesi:', session.title]);
        worksheet.addRow(['Tanggal Audit:', new Date(session.createdAt).toLocaleDateString('id-ID')]);
        worksheet.addRow(['Dibuat Oleh:', session.creator?.name]);
        worksheet.addRow(['Status Sesi:', session.status]);
        worksheet.addRow([]); // Gap

        // Narrative Summary
        const narrativeRow = worksheet.addRow([generateNarrative()]);
        worksheet.mergeCells(`A${narrativeRow.number}:K${narrativeRow.number}`);
        narrativeRow.height = 60;
        narrativeRow.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
        narrativeRow.getCell(1).font = { italic: true };
        worksheet.addRow([]); // Gap

        // Headers
        const headers = ['No', 'Kode Aset', 'Nama Barang', 'Kategori', 'Lokasi Asli', 'Lokasi Temuan', 'Kondisi Akhir', 'Status Audit', 'Catatan', 'Auditor', 'Waktu Verifikasi'];
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => { cell.style = headerStyle; });

        // Data
        session.items.forEach((item, idx) => {
            const rowData = [
                idx + 1,
                item.asset.code,
                item.asset.name,
                item.asset.category?.name,
                item.originalLocation,
                item.asset.room?.name || '-',
                item.foundCondition || item.asset.condition,
                item.status === 'FOUND' ? 'DITEMUKAN' : item.status === 'MISSING' ? 'HILANG' : 'BELUM DIAUDIT',
                item.notes || '-',
                item.auditor?.name || '-',
                item.verifiedAt ? new Date(item.verifiedAt).toLocaleString('id-ID') : '-'
            ];
            const row = worksheet.addRow(rowData);
            
            // Conditional Styling for Status
            if (item.status === 'FOUND') row.getCell(8).font = { color: { argb: '059669' }, bold: true };
            if (item.status === 'MISSING') row.getCell(8).font = { color: { argb: 'DC2626' }, bold: true };
        });

        // Column widths
        worksheet.columns.forEach(column => { column.width = 20; });
        worksheet.getColumn(1).width = 5;
        worksheet.getColumn(3).width = 30;
        worksheet.getColumn(9).width = 30;

        // Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `Laporan_Audit_${session.title.replace(/\s+/g, '_')}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div></div>;
    if (!session) return <div className="p-20 text-center">Data tidak ditemukan</div>;

    const stats = {
        total: session.items.length,
        found: session.items.filter(i => i.status === 'FOUND').length,
        missing: session.items.filter(i => i.status === 'MISSING').length,
        pending: session.items.filter(i => i.status === 'PENDING').length,
    };

    const progress = Math.round(((stats.found + stats.missing) / stats.total) * 100);

    const generateNarrative = () => {
        if (!session) return '';
        const found = stats.found;
        const missing = stats.missing;
        const total = stats.total;
        const damaged = session.items.filter(i => i.foundCondition && i.foundCondition !== 'BAIK').length;
        const dateStr = new Date(session.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        
        return `Berdasarkan hasil audit fisik (Stock Opname) "${session.title}" yang dilaksanakan pada tanggal ${dateStr}, telah dilakukan pemeriksaan terhadap total ${total} unit aset. Dari hasil pemeriksaan tersebut, sebanyak ${found} unit aset berhasil ditemukan, di mana ${damaged} unit di antaranya tercatat dalam kondisi membutuhkan perhatian (rusak ringan/berat). Terdapat ${missing} unit aset yang dinyatakan hilang atau tidak ditemukan di lokasi. Seluruh hasil temuan lapangan ini telah divalidasi dan disinkronkan ke dalam database utama Manajemen Aset untuk menjaga akurasi data inventaris.`;
    };

    const filteredItems = session.items.filter(i => {
        const matchesTab = i.status === activeTab;
        const matchesSearch = i.asset.name.toLowerCase().includes(search.toLowerCase()) || i.asset.code.toLowerCase().includes(search.toLowerCase());
        const matchesRoom = !roomFilter || i.asset.roomId === parseInt(roomFilter);
        return matchesTab && matchesSearch && matchesRoom;
    });

    const sessionRooms = Array.from(new Set(session.items.map(i => i.asset.room))).filter(Boolean);

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50 space-y-8 pb-32">
            {/* Sticky Mobile Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/aset/audit')} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-500">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 line-clamp-1">{session.title}</h1>
                        <p className="text-xs text-slate-500 font-bold flex items-center gap-2">
                            <MapPin size={12} /> {session.items[0]?.originalLocation || 'Multiple Locations'}
                        </p>
                    </div>
                </div>
                {session.status === 'OPEN' && (
                    <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={exportToExcel}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold shadow-sm hover:bg-slate-50 transition-all"
                        >
                            <RefreshCcw size={18} /> Ekspor Excel
                        </button>
                        <button 
                            onClick={() => setShowScanner(true)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-emerald-100 hover:scale-105 transition-all"
                        >
                            <Scan size={20} /> SCAN QR
                        </button>
                        {progress === 100 && (
                            <button 
                                onClick={handleFinalize}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all"
                            >
                                <ShieldCheck size={20} /> FINALISASI ({session.items.filter(i => i.reconcileApproved).length} DISETUJUI)
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cakupan</p>
                    <p className="text-2xl font-black text-slate-800">{stats.total}</p>
                </div>
                <div className="bg-emerald-50 p-5 rounded-[28px] border border-emerald-100 shadow-sm space-y-1">
                    <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">Ditemukan</p>
                    <p className="text-2xl font-black text-emerald-700">{stats.found}</p>
                </div>
                <div className="bg-red-50 p-5 rounded-[28px] border border-red-100 shadow-sm space-y-1">
                    <p className="text-[10px] font-black text-red-600/60 uppercase tracking-widest">Hilang</p>
                    <p className="text-2xl font-black text-red-700">{stats.missing}</p>
                </div>
                <div className="bg-amber-50 p-5 rounded-[28px] border border-amber-100 shadow-sm space-y-1">
                    <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest">Progress</p>
                    <p className="text-2xl font-black text-amber-700">{progress}%</p>
                </div>
            </div>

            {/* Narrative Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[32px] p-8 text-white shadow-2xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10"><ClipboardCheck size={120} /></div>
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                    <Info size={14} /> Ringkasan Laporan Otomatis
                </div>
                <p className="text-sm leading-relaxed font-medium relative z-10 max-w-3xl text-slate-200 italic">
                    "{generateNarrative()}"
                </p>
                <div className="pt-4 flex gap-3 relative z-10">
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(generateNarrative());
                            alert('Narasi berhasil disalin ke clipboard!');
                        }}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold transition-all"
                    >
                        Salin Narasi
                    </button>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex bg-slate-200/50 p-1 rounded-2xl w-full max-w-md">
                        {['PENDING', 'FOUND', 'MISSING'].map(t => (
                            <button
                                key={t}
                                onClick={() => { setActiveTab(t); setSelectedIds([]); }}
                                className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${activeTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {t === 'PENDING' ? 'BELUM' : t === 'FOUND' ? 'ADA' : 'HILANG'} 
                                <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">{stats[t.toLowerCase()]}</span>
                            </button>
                        ))}
                    </div>
                    {session.status === 'OPEN' && filteredItems.length > 0 && (
                        <button 
                            onClick={toggleSelectAll}
                            className="text-xs font-black text-emerald-600 px-6 py-3 bg-emerald-50 hover:bg-emerald-100 rounded-2xl transition-all flex items-center justify-center gap-2"
                        >
                            <ClipboardCheck size={16} />
                            {selectedIds.length === filteredItems.length ? 'Batal Pilih Semua' : 'Pilih Semua di Tab Ini'}
                        </button>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-4 max-w-4xl">
                    <div className="relative group flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            placeholder="Cari nama barang atau kode..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all shadow-sm"
                        />
                    </div>
                    <select
                        value={roomFilter}
                        onChange={e => setRoomFilter(e.target.value)}
                        className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-100 transition-all shadow-sm"
                    >
                        <option value="">Semua Ruangan</option>
                        {sessionRooms.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Item List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map(item => (
                    <div 
                        key={item.id} 
                        className={`bg-white p-5 rounded-3xl border flex items-center gap-4 group transition-all relative ${selectedIds.includes(item.id) ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-lg' : 'border-slate-200'}`}
                    >
                        {session.status === 'OPEN' && (
                            <input 
                                type="checkbox"
                                checked={selectedIds.includes(item.id)}
                                onChange={(e) => {
                                    if (e.target.checked) setSelectedIds([...selectedIds, item.id]);
                                    else setSelectedIds(selectedIds.filter(id => id !== item.id));
                                }}
                                className="w-5 h-5 rounded-lg border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                        )}
                        <div 
                            onClick={() => session.status === 'OPEN' && setSelectedItem(item)}
                            className="flex-1 flex items-center gap-4 cursor-pointer"
                        >
                            <div className={`p-3 rounded-2xl ${item.status === 'FOUND' ? 'bg-emerald-50 text-emerald-600' : item.status === 'MISSING' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                                {item.status === 'FOUND' ? <CheckCircle2 size={24} /> : item.status === 'MISSING' ? <AlertCircle size={24} /> : <Info size={24} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-black text-slate-800 line-clamp-1">{item.asset.name}</h4>
                                <div className="flex items-center gap-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.asset.code}</p>
                                    {item.status === 'FOUND' && item.foundLocationId && item.foundLocationId !== item.asset.roomId && (
                                        <span className="text-[9px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-black uppercase">MISPLACED</span>
                                    )}
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                                    <MapPin size={10} /> {item.asset.room?.name}
                                </p>
                            </div>
                            
                            {/* Approval Action for Misplaced / Found Items */}
                            {session.status === 'OPEN' && item.status === 'FOUND' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleApprove(item.id, !item.reconcileApproved);
                                    }}
                                    className={`p-2 rounded-xl border transition-all ${item.reconcileApproved ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-500'}`}
                                    title={item.reconcileApproved ? "Sudah Disetujui" : "Setujui Perubahan Data"}
                                >
                                    <ShieldCheck size={18} />
                                </button>
                            )}
                            <ChevronRight className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" size={20} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[55] w-[90%] max-w-2xl bg-slate-900 text-white p-4 rounded-[32px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-20">
                    <div className="flex items-center gap-4 pl-4">
                        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center font-black text-lg">
                            {selectedIds.length}
                        </div>
                        <div>
                            <p className="text-sm font-black">Aset Terpilih</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Update status masal</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button 
                            onClick={() => handleBulkAction('FOUND')}
                            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-2xl text-xs font-black shadow-lg shadow-emerald-900/20 transition-all"
                        >
                            TANDAI ADA
                        </button>
                        <button 
                            onClick={() => handleBulkAction('MISSING')}
                            className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 px-6 py-3 rounded-2xl text-xs font-black shadow-lg shadow-red-900/20 transition-all"
                        >
                            TANDAI HILANG
                        </button>
                        <button 
                            onClick={() => setSelectedIds([])}
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Verification Drawer / Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-t-[40px] md:rounded-[40px] shadow-2xl p-8 space-y-8 animate-in slide-in-from-bottom-10">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-slate-900">{selectedItem.asset.name}</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedItem.asset.code}</p>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20} /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Status Sekarang</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setForm({...form, status: 'FOUND'})} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${form.status === 'FOUND' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-white text-slate-400'}`}>ADA</button>
                                    <button onClick={() => setForm({...form, status: 'MISSING'})} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${form.status === 'MISSING' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'bg-white text-slate-400'}`}>HILANG</button>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Kondisi Fisik</p>
                                <select 
                                    disabled={form.status === 'MISSING'}
                                    value={form.condition}
                                    onChange={e => setForm({...form, condition: e.target.value})}
                                    className="w-full bg-white border-none rounded-xl text-xs font-black p-2 outline-none disabled:opacity-50"
                                >
                                    <option value="BAIK">BAIK</option>
                                    <option value="RUSAK_RINGAN">RUSAK RINGAN</option>
                                    <option value="RUSAK_BERAT">RUSAK BERAT</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Lokasi Ditemukan</p>
                            <select 
                                disabled={form.status === 'MISSING'}
                                value={form.foundLocationId}
                                onChange={e => setForm({...form, foundLocationId: e.target.value})}
                                className="w-full bg-white border-none rounded-xl text-xs font-black p-3 outline-none disabled:opacity-50"
                            >
                                {allRooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.building})</option>
                                ))}
                            </select>
                            {form.foundLocationId && parseInt(form.foundLocationId) !== selectedItem.asset.roomId && (
                                <p className="text-[10px] text-purple-600 font-bold flex items-center gap-1">
                                    <AlertTriangle size={12} /> Barang seharusnya ada di: {selectedItem.asset.room?.name}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catatan Audit</label>
                            <textarea 
                                value={form.note}
                                onChange={e => setForm({...form, note: e.target.value})}
                                placeholder="Contoh: Barang ditemukan di bawah meja, LCD bergaris..."
                                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-emerald-100 transition-all resize-none italic"
                                rows={3}
                            />
                        </div>

                        <button 
                            onClick={handleVerify}
                            className="w-full flex items-center justify-center gap-3 bg-emerald-600 text-white py-5 rounded-[28px] font-black shadow-xl shadow-emerald-100 hover:scale-[1.02] transition-all"
                        >
                            <Save size={20} /> SIMPAN HASIL VERIFIKASI
                        </button>
                    </div>
                </div>
            )}

            {/* Scanner View */}
            {showScanner && (
                <div className="fixed inset-0 z-[70] bg-slate-900 flex flex-col p-6 space-y-6">
                    <div className="flex justify-between items-center text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-600 rounded-lg"><Scan size={20} /></div>
                            <h3 className="font-bold">Arahkan ke QR Code Aset</h3>
                        </div>
                        <button onClick={() => setShowScanner(false)} className="p-2 bg-white/10 rounded-full"><X size={20} /></button>
                    </div>
                    
                    <div className="flex-1 rounded-[40px] overflow-hidden border-4 border-emerald-500/50 bg-black relative">
                        <div id="reader" className="w-full h-full"></div>
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-64 h-64 border-2 border-emerald-400 rounded-3xl opacity-50 animate-pulse"></div>
                        </div>
                    </div>

                    <div className="p-6 bg-white/5 rounded-3xl backdrop-blur-md text-white text-center space-y-2">
                        <p className="text-sm font-bold">Scanning for Inventory...</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">Audit ID: {id}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditSessionDetail;
