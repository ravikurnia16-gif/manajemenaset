import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/axios';
import { 
    FileText, Inbox, Send, Plus, Search, Filter, 
    MoreVertical, CheckCircle2, XCircle, Clock, 
    FileSignature, Download, Eye, Trash2, Printer,
    Calendar, User, Tag, ArrowRight, ShieldCheck,
    AlertCircle, Save, X, Edit2, QrCode, LayoutDashboard
} from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const formatDate = (dateStr, type = 'short') => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = d.getMonth();
    const yyyy = d.getFullYear();
    if (type === 'full') return `${dd} ${BULAN_FULL[mm]} ${yyyy}`;
    if (type === 'datetime') return `${dd} ${BULAN[mm]} ${yyyy} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    if (type === 'input') return `${yyyy}-${String(mm+1).padStart(2,'0')}-${dd}`;
    return `${dd} ${BULAN[mm]} ${yyyy}`;
};

const EOffice = () => {
    const { tab = 'dashboard' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState(null);
    const [viewingDoc, setViewingDoc] = useState(null);
    const [signatureRequest, setSignatureRequest] = useState(null);
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [sendingWA, setSendingWA] = useState(null);

    const user = JSON.parse(localStorage.getItem('user'));
    const isKabidSarpras = user?.role === 'KABID_SARPRAS' || user?.role === 'SUPER_ADMIN';
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    useEffect(() => {
        fetchStats();
        fetchDocuments();
        
        if (location.state?.autoCreate) {
            const s = location.state;
            setFormData(prev => ({
                ...prev,
                type: s.type || 'SURAT_KELUAR',
                category: s.category || 'BAST',
                subject: s.subject || '',
                party1Name: s.party1Name || '',
                party1Title: s.party1Title || '',
                party2Name: s.party2Name || '',
                party2Title: s.party2Title || '',
            }));
            if (s.bastItems) setBastItems(s.bastItems);
            setIsFormOpen(true);
            // Clear state so it doesn't reopen on refresh
            window.history.replaceState({}, document.title);
        }
    }, [tab, location.state]);

    const fetchStats = async () => {
        try {
            const res = await api.get('/office-documents/stats');
            setStats(res.data);
        } catch (err) {
            console.error('Fetch stats error:', err);
        }
    };

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            let endpoint = '/office-documents/outgoing';
            let params = {};

            if (tab === 'surat-masuk') {
                endpoint = '/office-documents/incoming';
            } else if (tab === 'invoice') {
                params.type = 'INVOICE';
            } else if (tab === 'lainnya') {
                params.type = 'LAINNYA';
            } else if (tab === 'surat-keluar') {
                // Return only standard outgoing types, excluding invoice/lainnya
                params.typeGroup = 'OUTGOING_STANDARD';
            } else {
                // Dashboard: fetch everything for recent documents
                params.limit = 10;
            }

            const res = await api.get(endpoint, { params });
            setDocuments(res.data.documents || []);
        } catch (err) {
            console.error('Fetch documents error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendWA = async (id) => {
        try {
            setSendingWA(id);
            const res = await api.post(`/office-documents/${id}/send-wa`);
            alert(res.data.message || 'Notifikasi WhatsApp sedang dikirim!');
        } catch (err) {
            console.error('Send WA error:', err);
            alert(err.response?.data?.error || 'Gagal mengirim notifikasi');
        } finally {
            setSendingWA(null);
        }
    };

    // --- Helper Components ---

    const StatCard = ({ title, value, icon, color }) => (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-${color}-50`}>{icon}</div>
            <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</div>
                <div className="text-2xl font-black text-slate-800">{value}</div>
            </div>
        </div>
    );

    const StatusBadge = ({ status }) => {
        const configs = {
            'DRAFT': { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Draft' },
            'PENDING_APPROVAL': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Menunggu TTE' },
            'SIGNED': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ditandatangani' },
            'APPROVED': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Disetujui' },
            'REJECTED': { bg: 'bg-red-100', text: 'text-red-700', label: 'Ditolak' },
        };
        const c = configs[status] || configs['DRAFT'];
        return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>{c.label}</span>;
    };

    // --- Sub-components for Views ---

    const DashboardView = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="Surat Masuk" value={stats?.totalIncoming || 0} icon={<Inbox className="text-blue-500" size={22} />} color="blue" />
                <StatCard title="Surat Keluar" value={stats?.totalOutgoing || 0} icon={<Send className="text-emerald-500" size={22} />} color="emerald" />
                <StatCard title="Invoice" value={stats?.totalInvoices || 0} icon={<FileText className="text-amber-500" size={22} />} color="amber" />
                <StatCard title="Menunggu TTE" value={stats?.pendingApproval || 0} icon={<Clock className="text-rose-500" size={22} />} color="rose" />
                <StatCard title="Signed Bulan Ini" value={stats?.signedThisMonth || 0} icon={<CheckCircle2 className="text-indigo-500" size={22} />} color="indigo" />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock size={18} className="text-blue-500" /> Dokumen Terbaru</h3>
                    <button onClick={() => navigate('/e-office/surat-keluar')} className="text-xs font-semibold text-blue-600 hover:underline">Lihat Semua</button>
                </div>
                <div className="divide-y divide-slate-100">
                    {stats?.recentDocuments?.length > 0 ? stats.recentDocuments.map(doc => (
                        <div key={doc.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer" onClick={() => setViewingDoc(doc)}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${doc.type === 'SURAT_MASUK' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    {doc.type === 'SURAT_MASUK' ? <Inbox size={18} /> : <Send size={18} />}
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-800 text-sm">{doc.subject}</div>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                        <span>{doc.number || 'Draft'}</span><span>•</span><span>{formatDate(doc.date)}</span>
                                    </div>
                                </div>
                            </div>
                            <StatusBadge status={doc.status} />
                        </div>
                    )) : (
                        <div className="p-8 text-center text-slate-400 text-sm italic">Belum ada dokumen</div>
                    )}
                </div>
            </div>
        </div>
    );

    const getPaymentStatus = (doc) => {
        if (doc.type !== 'INVOICE') return null;
        try {
            const parsed = JSON.parse(doc.content || '{}');
            return parsed.paymentStatus || 'UNPAID';
        } catch (e) {
            return 'UNPAID';
        }
    };

    const ListView = () => (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Cari subjek, nomor, atau pengirim..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50">
                        <Filter size={18} /> Filter
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-bold text-slate-700">Dokumen</th>
                            <th className="px-6 py-4 font-bold text-slate-700">Kategori</th>
                            <th className="px-6 py-4 font-bold text-slate-700">Tanggal</th>
                            <th className="px-6 py-4 font-bold text-slate-700">Status</th>
                            <th className="px-6 py-4 font-bold text-slate-700 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 italic">Memuat data...</td></tr>
                        ) : documents.length === 0 ? (
                            <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 italic">Tidak ada dokumen ditemukan</td></tr>
                        ) : (
                            documents.filter(doc => 
                                (doc.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (doc.number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (doc.senderName || '').toLowerCase().includes(searchQuery.toLowerCase())
                            ).map(doc => (
                                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${doc.type === 'SURAT_MASUK' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                {doc.type === 'SURAT_MASUK' ? <Inbox size={18} /> : <Send size={18} />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 line-clamp-1">{doc.subject}</div>
                                                <div className="text-[11px] text-slate-500 font-medium">
                                                    {doc.number || 'Draft'} {doc.senderName && `• Dari: ${doc.senderName}`}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                            <Tag size={14} className="text-slate-400" />
                                            {doc.category || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-medium">
                                        {formatDate(doc.date)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={doc.status} />
                                        {doc.type === 'INVOICE' && (
                                            <div className="mt-1">
                                                {getPaymentStatus(doc) === 'PAID' ? (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest">LUNAS</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">BELUM LUNAS</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => setViewingDoc(doc)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Lihat Detail"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            {doc.type === 'SURAT_MASUK' ? (
                                                doc.fileUrl ? (
                                                    <a 
                                                        href={doc.fileUrl} target="_blank" rel="noreferrer"
                                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all inline-block"
                                                        title="Lihat File Surat"
                                                    >
                                                        <Download size={18} />
                                                    </a>
                                                ) : null
                                            ) : (
                                                <button 
                                                    onClick={() => window.open(`/api/office-documents/${doc.id}/pdf?token=${localStorage.getItem('token')}`, '_blank')}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Cetak PDF"
                                                >
                                                    <Printer size={18} />
                                                </button>
                                            )}
                                            {(doc.status === 'DRAFT' || doc.status === 'REJECTED') && (
                                                <button 
                                                    onClick={() => { setEditingDoc(doc); setIsFormOpen(true); }}
                                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                            )}
                                            {isSuperAdmin && (
                                                <button 
                                                    onClick={() => handleDelete(doc.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Hapus Dokumen"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const ViewModal = () => {
        if (!viewingDoc) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 text-white rounded-lg">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 leading-none">Detail Dokumen</h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium">{viewingDoc.number || 'DRAFT'}</p>
                            </div>
                        </div>
                        <button onClick={() => setViewingDoc(null)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <InfoGroup label="Subjek / Perihal" value={viewingDoc.subject} icon={<Tag size={16} />} full />
                            <InfoGroup label="Kategori" value={viewingDoc.category} />
                            <InfoGroup label="Prioritas" value={viewingDoc.priority} />
                            <InfoGroup label="Tanggal Dokumen" value={formatDate(viewingDoc.date, 'full')} />
                            <InfoGroup label="Penulis / Pembuat" value={viewingDoc.author?.name} />
                            
                            {viewingDoc.type === 'SURAT_MASUK' && (
                                <>
                                    <InfoGroup label="Pengirim" value={viewingDoc.senderName} />
                                    <InfoGroup label="Instansi Pengirim" value={viewingDoc.senderOrg} />
                                    <InfoGroup label="No. Surat Referensi" value={viewingDoc.referenceNumber} />
                                    <InfoGroup label="Tanggal Diterima" value={viewingDoc.receivedDate ? formatDate(viewingDoc.receivedDate, 'full') : '-'} />
                                    {viewingDoc.fileUrl && (
                                        <div className="col-span-full pt-4">
                                            <a href={viewingDoc.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-3 rounded-xl font-bold hover:bg-emerald-100 transition-colors">
                                                <Download size={18} /> Unduh / Lihat File Surat Masuk
                                            </a>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {viewingDoc.status === 'SIGNED' && (
                            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-6">
                                <div className="p-4 bg-white rounded-xl shadow-sm border border-emerald-100 shrink-0">
                                    <QrCode size={48} className="text-emerald-600" />
                                </div>
                                <div>
                                    <div className="font-black text-emerald-900 text-lg">Dokumen Terverifikasi</div>
                                    <div className="text-emerald-700 text-sm font-medium leading-relaxed">
                                        Ditandatangani oleh <span className="font-bold underline">{viewingDoc.signedBy?.name}</span> pada {formatDate(viewingDoc.signedAt, 'datetime')}.
                                    </div>
                                </div>
                            </div>
                        )}

                        {viewingDoc.status === 'REJECTED' && (
                            <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4">
                                <AlertCircle className="text-red-500 shrink-0" size={24} />
                                <div>
                                    <div className="font-black text-red-900">Dokumen Ditolak</div>
                                    <div className="text-red-700 text-sm font-medium">Alasan: {viewingDoc.rejectionReason || '-'}</div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Isi Dokumen / Rincian</label>
                            {['BAST', 'SURAT_KELUAR'].includes(viewingDoc.type) && ['Berita Acara', 'Serah Terima Barang', 'BAST'].includes(viewingDoc.category) ? (
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead className="bg-slate-50 text-slate-600 font-bold">
                                            <tr>
                                                <th className="p-3 border-b border-slate-200">Jenis Barang</th>
                                                <th className="p-3 border-b border-slate-200 w-24">Qty</th>
                                                <th className="p-3 border-b border-slate-200 w-32">Kondisi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                try {
                                                    const items = JSON.parse(viewingDoc.content || '[]');
                                                    return items.map((item, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-3 border-b border-slate-100 font-medium">{item.name}</td>
                                                            <td className="p-3 border-b border-slate-100">{item.qty}</td>
                                                            <td className="p-3 border-b border-slate-100">
                                                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                                                                    item.condition === 'Baik' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                    {item.condition}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ));
                                                } catch(e) {
                                                    return <tr><td colSpan="3" className="p-4 text-center text-slate-400 italic">Format data tidak valid</td></tr>;
                                                }
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (viewingDoc.type === 'INVOICE' || viewingDoc.category === 'Invoice') ? (
                                <div className="space-y-6">
                                    {(() => {
                                        try {
                                            const data = JSON.parse(viewingDoc.content || '{}');
                                            const items = data.items || [];
                                            const total = items.reduce((acc, curr) => acc + (curr.total || 0), 0);
                                            return (
                                                <div className="space-y-6">
                                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                        <table className="w-full text-left border-collapse text-xs">
                                                            <thead className="bg-slate-50 text-slate-600 font-bold uppercase">
                                                                <tr>
                                                                    <th className="p-3 border-b border-slate-200">Barang / Jasa</th>
                                                                    <th className="p-3 border-b border-slate-200 w-16">Qty</th>
                                                                    <th className="p-3 border-b border-slate-200 w-32 text-right">Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {items.map((item, i) => (
                                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                                        <td className="p-3 border-b border-slate-100 font-medium">
                                                                            {item.name}
                                                                            {item.spec && <div className="text-[10px] text-slate-400 font-normal">{item.spec}</div>}
                                                                        </td>
                                                                        <td className="p-3 border-b border-slate-100 font-bold">{item.qty} {item.unit}</td>
                                                                        <td className="p-3 border-b border-slate-100 text-right font-black text-blue-700">
                                                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.total || 0)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                <tr className="bg-blue-50/30">
                                                                    <td colSpan="2" className="p-3 text-right font-bold text-slate-500 uppercase tracking-widest text-[10px]">Total Tagihan</td>
                                                                    <td className="p-3 text-right font-black text-blue-800 text-sm">
                                                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total)}
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Informasi Pembayaran</span>
                                                            <div className="space-y-1">
                                                                <div className="text-sm font-bold text-slate-800">{data.bankInfo?.bankName || '-'}</div>
                                                                <div className="text-xs font-medium text-slate-500">{data.bankInfo?.bankAccountNumber || '-'} a.n {data.bankInfo?.bankAccountName || '-'}</div>
                                                            </div>
                                                        </div>
                                                        <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                                                            <span className="block text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Jatuh Tempo</span>
                                                            <div className="text-sm font-black text-amber-900">{data.dueDate ? formatDate(data.dueDate, 'full') : '-'}</div>
                                                        </div>
                                                    </div>

                                                    {data.notes && (
                                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 italic text-sm text-slate-600">
                                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest not-italic mb-1">Catatan Tambahan</span>
                                                            {data.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        } catch (e) {
                                            return <p className="text-red-500 italic">Gagal memuat rincian invoice</p>;
                                        }
                                    })()}
                                </div>
                            ) : viewingDoc.category === 'Edaran' ? (
                                <div className="space-y-6">
                                    {(() => {
                                        try {
                                            const data = JSON.parse(viewingDoc.content || '{}');
                                            return (
                                                <div className="space-y-6">
                                                    <div className="text-center border-y border-slate-100 py-4 mb-4">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tentang</div>
                                                        <div className="text-sm font-black text-slate-900 uppercase leading-relaxed max-w-md mx-auto">{viewingDoc.subject}</div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 pb-6 border-b border-slate-100">
                                                        <div>
                                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kepada Yth.</span>
                                                            <div className="text-xs font-bold text-slate-800">{viewingDoc.party2Name}</div>
                                                        </div>
                                                        <div>
                                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tempat</span>
                                                            <div className="text-xs font-bold text-slate-800">{viewingDoc.party2Address}</div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div>
                                                            <div className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                <span className="w-5 h-5 rounded bg-amber-100 flex items-center justify-center text-[10px]">1</span> Latar Belakang
                                                            </div>
                                                            <div className="text-xs text-slate-600 leading-relaxed pl-7">{data.background || '-'}</div>
                                                        </div>

                                                        <div>
                                                            <div className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                <span className="w-5 h-5 rounded bg-amber-100 flex items-center justify-center text-[10px]">2</span> Ketentuan
                                                            </div>
                                                            <div className="space-y-3 pl-7">
                                                                {(data.points || []).map((p, i) => {
                                                                    const pt = typeof p === 'string' ? { text: p, subs: [] } : p;
                                                                    return (
                                                                        <div key={i}>
                                                                            <div className="flex gap-3 items-start">
                                                                                <div className="text-[10px] font-bold text-slate-400 mt-0.5">{i+1}.</div>
                                                                                <div className="text-xs text-slate-700 leading-relaxed">{pt.text}</div>
                                                                            </div>
                                                                            {pt.subs && pt.subs.filter(s => s).length > 0 && (
                                                                                <div className="ml-8 mt-1 space-y-1">
                                                                                    {pt.subs.filter(s => s).map((s, j) => (
                                                                                        <div key={j} className="flex gap-2 items-start">
                                                                                            <div className="text-[9px] font-bold text-slate-300 mt-0.5">{String.fromCharCode(97+j)}.</div>
                                                                                            <div className="text-[11px] text-slate-500 leading-relaxed">{s}</div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        } catch (e) {
                                            return <p className="text-red-500 italic">Gagal memuat rincian edaran</p>;
                                        }
                                    })()}
                                </div>
                            ) : viewingDoc.category === 'Keputusan' ? (
                                    <div className="space-y-6">
                                        {(() => {
                                            try {
                                                const data = JSON.parse(viewingDoc.content || '{}');
                                                return (
                                                    <div className="space-y-6 text-xs">
                                                        <div className="text-center border-y border-slate-100 py-4 mb-4">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Keputusan Tentang</div>
                                                            <div className="text-sm font-black text-slate-900 uppercase leading-relaxed max-w-md mx-auto">{viewingDoc.subject}</div>
                                                        </div>

                                                        <div>
                                                            <div className="font-black text-amber-700 uppercase text-[10px] tracking-widest mb-2">Menimbang:</div>
                                                            <ul className="space-y-1.5 pl-4">
                                                                {(data.menimbang || []).map((item, idx) => (
                                                                    <li key={idx} className="text-slate-700 flex gap-2">
                                                                        <span className="font-bold text-amber-500">{String.fromCharCode(97 + idx)}.</span>
                                                                        <span className="leading-relaxed">{item}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>

                                                        <div>
                                                            <div className="font-black text-amber-700 uppercase text-[10px] tracking-widest mb-2">Mengingat:</div>
                                                            <ul className="space-y-1.5 pl-4">
                                                                {(data.mengingat || []).map((item, idx) => (
                                                                    <li key={idx} className="text-slate-700 flex gap-2">
                                                                        <span className="font-bold text-amber-500">{idx + 1}.</span>
                                                                        <span className="leading-relaxed">{item}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>

                                                        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                                                            <div className="text-center font-black text-slate-900 mb-4 tracking-widest">MEMUTUSKAN</div>
                                                            <div className="space-y-4">
                                                                {(data.menetapkan || []).map((item, idx) => (
                                                                    <div key={idx}>
                                                                        <div className="font-black text-amber-700 uppercase text-[9px] mb-1">{item.label}:</div>
                                                                        <div className="text-slate-800 leading-relaxed font-medium">{item.text}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {data.tembusan && data.tembusan.filter(t => t).length > 0 && (
                                                            <div className="pt-4 border-t border-slate-100">
                                                                <div className="font-black text-slate-400 uppercase text-[9px] mb-2">Tembusan:</div>
                                                                <ul className="space-y-1 pl-4">
                                                                    {data.tembusan.filter(t => t).map((item, idx) => (
                                                                        <li key={idx} className="text-slate-500 italic flex gap-2">
                                                                            <span>-</span> {item}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            } catch (e) { return <p className="text-red-500">Error parsing content</p>; }
                                        })()}
                                    </div>
                            ) : viewingDoc.category === 'Pemberitahuan' ? (
                                <div className="space-y-5">
                                    {(() => {
                                        try {
                                            const data = JSON.parse(viewingDoc.content || '{}');
                                            return (
                                                <div className="space-y-5 text-xs">
                                                    <div className="text-center border-y border-slate-100 py-4">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Pemberitahuan Perihal</div>
                                                        <div className="text-sm font-black text-slate-900 leading-relaxed max-w-md mx-auto">{viewingDoc.subject}</div>
                                                    </div>
                                                    <div className="italic text-slate-500 text-[11px]">Assalamu'alaikum Warahmatullahi Wabarakatuh,</div>
                                                    <div className="text-slate-700 leading-relaxed">
                                                        <div className="mb-2">Dengan hormat,</div>
                                                        <div className="mb-4 text-justify">Segala puji bagi Allah <span className="italic">Subhaanahu wa ta'aala</span> yang senantiasa melimpahkan nikmat dan hidayah-Nya kepada kita semua. Shalawat dan salam atas Nabi Muhammad <span className="italic">Shalallaahu 'alaihi wa sallam</span>. Kami mendo'akan semoga Bapak/Ibu selalu berada dalam lindungan Allah <span className="italic">Subhaanahu wa ta'aala</span>, Amin.</div>
                                                        {data.pembukaan}
                                                    </div>
                                                    {data.points && data.points.filter(p => p).length > 0 && (
                                                        <div>
                                                            <div className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-2">Poin-poin Penting</div>
                                                            <ul className="space-y-1.5 pl-4">
                                                                {data.points.filter(p => p).map((item, idx) => (
                                                                    <li key={idx} className="text-slate-700 flex gap-2">
                                                                        <span className="font-bold text-green-500">{idx + 1}.</span>
                                                                        <span className="leading-relaxed">{item}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {data.penutup && <div className="text-slate-700 leading-relaxed">{data.penutup}</div>}
                                                    <div className="italic text-slate-500 text-[11px]">Wassalamu'alaikum Warahmatullahi Wabarakatuh.</div>
                                                </div>
                                            );
                                        } catch (e) { return <p className="text-red-500">Error parsing content</p>; }
                                    })()}
                                </div>
                            ) : viewingDoc.category === 'Tugas' ? (
                                <div className="space-y-6 bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                                    {(() => {
                                        try {
                                            const task = JSON.parse(viewingDoc.content || '{}');
                                            return (
                                                <div className="grid grid-cols-1 gap-6 text-sm">
                                                    <div>
                                                        <span className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Dasar Penugasan</span>
                                                        <ul className="space-y-1.5">
                                                            {(task.basisList || (task.basis ? [task.basis] : [])).map((b, i) => (
                                                                <li key={i} className="text-slate-800 font-medium leading-relaxed flex gap-2">
                                                                    <span className="text-blue-400 font-bold">{i + 1}.</span> {b}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Menugaskan Kepada</span>
                                                        <div className="space-y-3">
                                                            {(task.personnelList || (task.personnel ? [{ name: task.personnel }] : [])).map((p, i) => (
                                                                <div key={i} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-blue-100/50 shadow-sm">
                                                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</div>
                                                                    <div>
                                                                        <div className="text-slate-900 font-bold">{p.name || '-'}</div>
                                                                        <div className="text-[11px] text-slate-500 font-medium">
                                                                            {p.position || 'Staff'} {p.nip ? `• NIY: ${p.nip}` : ''}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Untuk (Maksud & Tujuan)</span>
                                                        <ul className="space-y-1.5">
                                                            {(task.purposeList || (task.purpose ? [task.purpose] : [])).map((p, i) => (
                                                                <li key={i} className="text-slate-800 font-medium leading-relaxed flex gap-2">
                                                                    <span className="text-blue-400 font-bold">•</span> {p}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-blue-100">
                                                        <div>
                                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Waktu Pelaksanaan</span>
                                                            <p className="text-slate-800 font-bold flex items-center gap-2">
                                                                <Calendar size={14} className="text-blue-500" />
                                                                {task.dateStart ? formatDate(task.dateStart) : '-'}
                                                                {task.dateEnd && task.dateEnd !== task.dateStart ? ` s.d ${formatDate(task.dateEnd)}` : ''}
                                                            </p>
                                                            {task.timeRange && <p className="text-[11px] text-slate-500 mt-1 ml-5 font-medium">{task.timeRange}</p>}
                                                        </div>
                                                        <div>
                                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tempat / Lokasi</span>
                                                            <p className="text-slate-800 font-bold flex items-center gap-2">
                                                                <Tag size={14} className="text-blue-500" />
                                                                {task.location || '-'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {task.carbonCopy && task.carbonCopy.length > 0 && task.carbonCopy[0] && (
                                                        <div className="pt-4 border-t border-blue-100">
                                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tembusan</span>
                                                            <div className="text-[11px] text-slate-500 space-y-1">
                                                                {task.carbonCopy.map((c, i) => <div key={i}>{i+1}. {c}</div>)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        } catch (e) {
                                            return <p className="text-red-500 italic">Gagal memuat rincian tugas</p>;
                                        }
                                    })()}
                                </div>
                            ) : (
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                                    {viewingDoc.content || '(Tanpa isi)'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => window.open(`/api/office-documents/${viewingDoc.id}/pdf?token=${localStorage.getItem('token')}`, '_blank')}
                                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                            >
                                <Printer size={18} /> Cetak PDF
                            </button>
                            {(viewingDoc.type === 'INVOICE' || viewingDoc.category === 'Invoice') && (
                                <button 
                                    onClick={() => handleSendWA(viewingDoc.id)}
                                    disabled={sendingWA === viewingDoc.id}
                                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                >
                                    <Send size={18} /> {sendingWA === viewingDoc.id ? 'Mengirim...' : 'Kirim WA'}
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {viewingDoc.status === 'DRAFT' && (
                                <button 
                                    onClick={() => handleSubmitForApproval(viewingDoc.id)}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                                >
                                    <Send size={18} /> Ajukan Persetujuan
                                </button>
                            )}
                            
                            {/* Multi-party signing: Pihak 2 (Pad) button */}
                            {(['BAST', 'MOU'].includes(viewingDoc.type) || (viewingDoc.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang', 'BAST'].includes(viewingDoc.category))) && (
                                <>
                                    {!viewingDoc.party2Signature && (
                                        <button 
                                            onClick={() => setSignatureRequest({ doc: viewingDoc, party: 'party2' })}
                                            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                                        >
                                            <FileSignature size={18} /> TTD Pihak 2 (Pad)
                                        </button>
                                    )}
                                </>
                            )}

                            {/* Pihak 1 = Approval Kepala Bidang (TTE) */}
                            {viewingDoc.status === 'PENDING_APPROVAL' && isKabidSarpras && (
                                <button 
                                    onClick={() => { setViewingDoc(null); setSignatureRequest({ doc: viewingDoc }); }}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                                >
                                    <FileSignature size={18} /> Tandatangani Kepala Bidang
                                </button>
                            )}
                            
                            {viewingDoc.type === 'INVOICE' && (
                                <button 
                                    onClick={() => handleTogglePaymentStatus(viewingDoc.id, getPaymentStatus(viewingDoc))}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg ${
                                        getPaymentStatus(viewingDoc) === 'PAID' 
                                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 shadow-amber-600/10' 
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
                                    }`}
                                >
                                    <CheckCircle2 size={18} /> {getPaymentStatus(viewingDoc) === 'PAID' ? 'Set Belum Lunas' : 'Tandai Lunas'}
                                </button>
                            )}

                            {viewingDoc.type === 'INVOICE' && (
                                <button 
                                    onClick={() => handleSendInvoiceWA(viewingDoc.id)}
                                    className="px-5 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-100 transition-all shadow-lg shadow-blue-600/5"
                                >
                                    <Send size={18} /> Kirim Notif WA
                                </button>
                            )}

                            {isSuperAdmin && (
                                <button 
                                    onClick={() => handleDelete(viewingDoc.id)}
                                    className="px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-rose-100 transition-all"
                                >
                                    <Trash2 size={18} /> Hapus Dokumen
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const InfoGroup = ({ label, value, icon, full }) => (
        <div className={full ? 'col-span-full' : ''}>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                {icon} {label}
            </div>
            <div className="text-slate-800 font-bold leading-relaxed">{value || '-'}</div>
        </div>
    );

    const handleDelete = async (id) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus dokumen ini secara permanen?')) return;
        try {
            await api.delete(`/office-documents/${id}`);
            alert('Dokumen berhasil dihapus');
            setViewingDoc(null);
            fetchDocuments();
            fetchStats();
        } catch (err) {
            alert('Gagal menghapus: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleTogglePaymentStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'PAID' ? 'UNPAID' : 'PAID';
        const msg = newStatus === 'PAID' ? 'Tandai invoice ini sebagai LUNAS?' : 'Tandai invoice ini sebagai BELUM LUNAS?';
        if (!window.confirm(msg)) return;

        try {
            const res = await api.patch(`/office-documents/${id}/payment-status`, { status: newStatus });
            alert(res.data.message);
            setViewingDoc(res.data.doc);
            fetchDocuments();
        } catch (err) {
            alert('Gagal mengubah status: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleSendInvoiceWA = async (id) => {
        if (!window.confirm('Kirim notifikasi tagihan ke nomor WhatsApp penerima?')) return;
        try {
            const res = await api.post(`/office-documents/${id}/send-wa`);
            alert(res.data.message);
        } catch (err) {
            alert('Gagal mengirim WA: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleSubmitForApproval = async (id) => {
        if (!window.confirm('Ajukan dokumen ini untuk ditandatangani oleh pimpinan?')) return;
        try {
            await api.post(`/office-documents/${id}/submit`);
            alert('Berhasil diajukan!');
            setViewingDoc(null);
            fetchDocuments();
            fetchStats();
        } catch (err) {
            alert('Gagal mengajukan: ' + (err.response?.data?.error || err.message));
        }
    };

    // --- Content Area Rendering ---

    const renderContent = () => {
        if (tab === 'dashboard') return <DashboardView />;
        return <ListView />;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <FileSignature className="text-blue-600" size={32} /> E-Office
                    </h1>
                    <p className="text-slate-500 font-medium">Manajemen Dokumen & Tanda Tangan Elektronik</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsTypeModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} /> Buat Dokumen Baru
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit overflow-x-auto max-w-full no-scrollbar">
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
                    { id: 'surat-masuk', label: 'Surat Masuk', icon: <Inbox size={16} /> },
                    { id: 'surat-keluar', label: 'Surat Keluar', icon: <Send size={16} /> },
                    { id: 'invoice', label: 'Invoice', icon: <FileText size={16} /> },
                    { id: 'lainnya', label: 'Lainnya', icon: <Tag size={16} /> },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => navigate(`/e-office/${t.id}`)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            tab === t.id 
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                                : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            {renderContent()}

            {/* Modals */}
            <ViewModal />
            <FormModal 
                isOpen={isFormOpen} 
                onClose={() => { setIsFormOpen(false); setEditingDoc(null); }} 
                doc={editingDoc}
                onSuccess={() => { fetchDocuments(); fetchStats(); }}
                defaultType={tab === 'surat-masuk' ? 'SURAT_MASUK' : 'SURAT_KELUAR'}
            />
            <SignatureModal 
                signatureRequest={signatureRequest} 
                onClose={() => setSignatureRequest(null)} 
                onSuccess={() => { fetchDocuments(); fetchStats(); }}
            />
            <TypeSelectionModal 
                isOpen={isTypeModalOpen}
                onClose={() => setIsTypeModalOpen(false)}
                onSelect={(type) => {
                    setIsTypeModalOpen(false);
                    setEditingDoc({ type });
                    setIsFormOpen(true);
                }}
            />
        </div>
    );
};

const FormModal = ({ isOpen, onClose, doc, onSuccess, defaultType }) => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        type: defaultType,
        subject: '',
        content: '',
        category: 'Pemberitahuan',
        priority: 'BIASA',
        senderName: '',
        senderOrg: '',
        referenceNumber: '',
        receivedDate: formatDate(new Date(), 'input'),
        party1Name: 'Ravi Kurnia',
        party1Title: 'Kepala Bidang Sarpras',
        party1Org: 'Yayasan Dar el-Iman',
        party1Address: 'Komplek Islamic Center, Surau Gadang, Kec. Nanggalo, Kota Padang',
        party2Name: '',
        party2Title: '',
        party2Org: '',
        party2Address: '',
    });
    const [file, setFile] = useState(null);
    const [bastItems, setBastItems] = useState([{ name: '', qty: '', condition: 'Baik' }]);
    const [purchasingItems, setPurchasingItems] = useState([{ name: '', spec: '', qty: '', unit: 'Pcs', price: '', total: 0 }]);
    const [staffList, setStaffList] = useState([]);
    const [taskData, setTaskData] = useState({
        basisList: [''],
        personnelList: [{ name: '', position: '', nip: '' }],
        purposeList: [''],
        dateStart: formatDate(new Date(), 'input'),
        dateEnd: formatDate(new Date(), 'input'),
        timeRange: '08.00 s.d Selesai',
        location: '',
        carbonCopy: ['']
    });
    const [invoiceData, setInvoiceData] = useState({
        bankName: '',
        bankAccountName: '',
        bankAccountNumber: '',
        dueDate: formatDate(new Date(), 'input'),
        notes: '',
        paymentStatus: 'UNPAID'
    });
    const [edaranData, setEdaranData] = useState({
        background: '',
        points: [{ text: '', subs: [''] }],
    });
    const [keputusanData, setKeputusanData] = useState({
        menimbang: [''],
        mengingat: [''],
        menetapkan: [{ label: 'PERTAMA', text: '' }, { label: 'KEDUA', text: '' }],
        tembusan: ['']
    });
    const [pemberitahuanData, setPemberitahuanData] = useState({
        pembukaan: '',
        points: [''],
        penutup: ''
    });
    const [recipientType, setRecipientType] = useState('external');

    useEffect(() => {
        if (isOpen) {
            if (formData.category === 'Tugas') {
                fetchStaff('/users/staff');
            } else if (formData.type === 'INVOICE') {
                fetchStaff('/users/unit-admins');
            }
        }
    }, [isOpen, formData.category, formData.type]);

    const fetchStaff = async (endpoint = '/users/staff') => {
        try {
            const res = await api.get(endpoint);
            setStaffList(res.data);
        } catch (err) {
            console.error('Failed to fetch staff:', err);
        }
    };

    useEffect(() => {
        if (doc) {
            // If it's an existing document (has ID)
            if (doc.id) {
                setFormData({
                    ...doc,
                    receivedDate: doc.receivedDate ? formatDate(doc.receivedDate, 'input') : '',
                });
            } else {
                // If it's a new document with just a type selected
                const overrides = {};
                if (doc.type === 'INVOICE') {
                    overrides.category = 'Invoice';
                    overrides.party1Name = 'Bidang Sarana dan Prasarana';
                    overrides.party1Title = 'Kepala Bidang Sarpras';
                    overrides.party1Org = 'Yayasan Dar el-Iman';
                }
                setFormData(prev => ({
                    ...prev,
                    ...doc,
                    ...overrides,
                    receivedDate: formatDate(new Date(), 'input'),
                }));
            }

            if (doc.type === 'BAST' && doc.content) {
                try {
                    setBastItems(JSON.parse(doc.content));
                } catch (e) {
                    console.error('Failed to parse BAST content JSON', e);
                }
            }
            if (doc.category === 'Pesanan' && doc.content) {
                try {
                    setPurchasingItems(JSON.parse(doc.content));
                } catch (e) {
                    console.error('Failed to parse Purchasing content JSON', e);
                }
            }
            if ((doc.type === 'INVOICE' || doc.category === 'Invoice') && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    if (parsed.items) {
                        setPurchasingItems(parsed.items);
                        setInvoiceData({
                            bankName: parsed.bankInfo?.bankName || '',
                            bankAccountName: parsed.bankInfo?.bankAccountName || '',
                            bankAccountNumber: parsed.bankInfo?.bankAccountNumber || '',
                            dueDate: parsed.dueDate || formatDate(new Date(), 'input'),
                            notes: parsed.notes || ''
                        });
                    } else if (Array.isArray(parsed)) {
                        setPurchasingItems(parsed);
                    }
                } catch (e) {
                    console.error('Failed to parse Invoice content JSON', e);
                }
            }
            if (doc.category === 'Tugas' && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    // Migration / Normalization
                    setTaskData({
                        basisList: parsed.basisList || (parsed.basis ? [parsed.basis] : ['']),
                        personnelList: parsed.personnelList || (parsed.personnel ? [{ name: parsed.personnel, position: '', nip: '' }] : [{ name: '', position: '', nip: '' }]),
                        purposeList: parsed.purposeList || (parsed.purpose ? [parsed.purpose] : ['']),
                        dateStart: parsed.dateStart || (parsed.date ? formatDate(parsed.date, 'input') : formatDate(new Date(), 'input')),
                        dateEnd: parsed.dateEnd || parsed.dateStart || formatDate(new Date(), 'input'),
                        timeRange: parsed.timeRange || '08.00 s.d Selesai',
                        location: parsed.location || '',
                        carbonCopy: parsed.carbonCopy || ['']
                    });
                } catch (e) {
                    console.error('Failed to parse Task content JSON', e);
                }
            }
            if (doc.category === 'Edaran' && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    let pts = parsed.points || [];
                    if (pts.length > 0 && typeof pts[0] === 'string') {
                        pts = pts.map(p => ({ text: p, subs: [''] }));
                    }
                    setEdaranData({
                        background: parsed.background || '',
                        points: pts.length > 0 ? pts : [{ text: '', subs: [''] }],
                    });
                } catch (e) {
                    console.error('Failed to parse Edaran content JSON', e);
                }
            }
            if (doc.category === 'Keputusan' && doc.content) {
                try {
                    setKeputusanData(JSON.parse(doc.content));
                } catch (e) {
                    console.error('Failed to parse Keputusan content JSON', e);
                }
            }
            if (doc.category === 'Pemberitahuan' && doc.content) {
                try {
                    setPemberitahuanData(JSON.parse(doc.content));
                } catch (e) {
                    console.error('Failed to parse Pemberitahuan content JSON', e);
                }
            }
        } else {
            setFormData({
                type: defaultType,
                subject: '',
                content: '',
                category: 'Undangan',
                priority: 'BIASA',
                senderName: '',
                senderOrg: '',
                referenceNumber: '',
                receivedDate: formatDate(new Date(), 'input'),
                party1Name: 'Ravi Kurnia',
                party1Title: 'Kepala Bidang Sarpras',
                party1Org: 'Yayasan Dar el-Iman',
                party1Address: 'Komplek Islamic Center, Surau Gadang, Kec. Nanggalo, Kota Padang',
                party2Name: '',
                party2Title: '',
                party2Org: '',
                party2Address: '',
            });
            setBastItems([{ name: '', qty: '', condition: 'Baik' }]);
            setPurchasingItems([{ name: '', spec: '', qty: '', unit: 'Pcs', price: '', total: 0 }]);
            setTaskData({
                basisList: [''],
                personnelList: [{ name: '', position: '', nip: '' }],
                purposeList: [''],
                dateStart: formatDate(new Date(), 'input'),
                dateEnd: formatDate(new Date(), 'input'),
                timeRange: '08.00 s.d Selesai',
                location: '',
                carbonCopy: ['']
            });
        }
    }, [doc, defaultType, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const isMultipart = formData.type === 'SURAT_MASUK';
            let payload = formData;
            let config = {};

            if (isMultipart) {
                payload = new FormData();
                for (const key in formData) {
                    if (formData[key] !== null && formData[key] !== undefined) {
                        payload.append(key, formData[key]);
                    }
                }
                if (file) {
                    payload.append('file', file);
                }
                config = { headers: { 'Content-Type': 'multipart/form-data' } };
            } else if (formData.type === 'BAST' || (formData.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang', 'BAST'].includes(formData.category))) {
                payload = { ...formData, content: JSON.stringify(bastItems) };
            } else if (formData.category === 'Pesanan') {
                payload = { ...formData, type: 'SURAT_PESANAN', content: JSON.stringify(purchasingItems) };
            } else if (formData.type === 'INVOICE' || formData.category === 'Invoice') {
                payload = { ...formData, content: JSON.stringify({ items: purchasingItems, bankInfo: invoiceData, dueDate: invoiceData.dueDate, notes: invoiceData.notes }) };
            } else if (formData.type === 'SURAT_KELUAR' && formData.category === 'Tugas') {
                payload = { ...formData, content: JSON.stringify(taskData) };
            } else if (formData.category === 'Edaran') {
                payload = { ...formData, content: JSON.stringify(edaranData) };
            } else if (formData.category === 'Keputusan') {
                payload = { ...formData, content: JSON.stringify(keputusanData) };
            } else if (formData.category === 'Pemberitahuan') {
                payload = { ...formData, content: JSON.stringify(pemberitahuanData) };
            }

            if (doc && doc.id) {
                await api.put(`/office-documents/${doc.id}`, payload, config);
            } else {
                await api.post(isMultipart ? '/office-documents/incoming' : '/office-documents/outgoing', payload, config);
            }
            onSuccess();
            onClose();
            
            // Auto-navigate to the correct tab for NEW documents
            if (!doc || !doc.id) {
                if (formData.type === 'SURAT_MASUK') {
                    navigate('/e-office/surat-masuk');
                } else if (formData.type === 'INVOICE') {
                    navigate('/e-office/invoice');
                } else if (formData.type === 'LAINNYA') {
                    navigate('/e-office/lainnya');
                } else {
                    navigate('/e-office/surat-keluar');
                }
            }
            
            alert('Dokumen berhasil disimpan!');
        } catch (err) {
            alert('Gagal menyimpan: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 text-white rounded-lg">
                                <Plus size={20} />
                            </div>
                            <h3 className="font-black text-slate-900">{doc ? 'Edit' : 'Buat'} {formData.type?.replace('_', ' ')}</h3>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[75vh]">
                        {/* Remove Jenis Dokumen selection row as requested */}

                        {formData.type === 'SURAT_KELUAR' && (
                            <div className="col-span-full bg-blue-50/50 p-6 rounded-2xl border border-blue-100 mb-2">
                                <label className="text-xs font-black text-blue-600 uppercase tracking-widest mb-3 block">1. Pilih Kategori Surat Keluar</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {['Tugas', 'Keputusan', 'Pemberitahuan', 'BAST', 'Pesanan', 'Edaran', 'Lainnya'].map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, category: c })}
                                            className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all text-center ${
                                                formData.category === c 
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'
                                            }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="col-span-full">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">{formData.type === 'SURAT_KELUAR' ? '2. ' : ''}Perihal / Subjek Surat</label>
                            <input 
                                required
                                type="text"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                placeholder="Contoh: Undangan Rapat Koordinasi Sarpras"
                            />
                        </div>

                        {formData.type === 'SURAT_MASUK' ? (
                            <>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Nama Pengirim</label>
                                    <input 
                                        required
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                        value={formData.senderName}
                                        onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Instansi Pengirim</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                        value={formData.senderOrg}
                                        onChange={(e) => setFormData({ ...formData, senderOrg: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">No. Surat Referensi</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                        value={formData.referenceNumber}
                                        onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Tanggal Diterima</label>
                                    <input 
                                        required
                                        type="date"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                        value={formData.receivedDate}
                                        onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {formData.category !== 'Tugas' && (
                                    <div>
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Prioritas</label>
                                        <select 
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                            value={formData.priority}
                                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        >
                                            <option value="BIASA">Biasa</option>
                                            <option value="SEGERA">Segera</option>
                                            <option value="SANGAT_SEGERA">Sangat Segera</option>
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        {formData.category === 'Pesanan' && (
                            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                                <label className="col-span-full text-xs font-black text-emerald-600 uppercase tracking-widest block mb-2">3. Informasi Vendor / Penerima Pesanan</label>
                                <div className="col-span-full">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Kepada Yth (Jabatan / Nama)</label>
                                    <input 
                                        required
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                        value={formData.party2Name}
                                        onChange={(e) => setFormData({ ...formData, party2Name: e.target.value })}
                                        placeholder="Contoh: Pimpinan CV. Maju Jaya"
                                    />
                                </div>
                                <div className="col-span-full">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Alamat Vendor</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                        value={formData.party2Address}
                                        onChange={(e) => setFormData({ ...formData, party2Address: e.target.value })}
                                        placeholder="Alamat lengkap vendor..."
                                    />
                                </div>
                            </div>
                        )}

                        {formData.type === 'INVOICE' && (
                            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50/50 p-6 rounded-2xl border border-amber-100">
                                <div className="col-span-full flex items-center justify-between">
                                    <label className="text-xs font-black text-amber-600 uppercase tracking-widest block">3. Informasi Penagihan (Bill To)</label>
                                    <div className="flex bg-white rounded-lg p-1 border border-amber-200">
                                        <button 
                                            type="button"
                                            onClick={() => setRecipientType('internal')}
                                            className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${recipientType === 'internal' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Internal
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setRecipientType('external')}
                                            className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${recipientType === 'external' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Eksternal
                                        </button>
                                    </div>
                                </div>

                                {recipientType === 'internal' ? (
                                    <div className="col-span-full">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Pilih Admin Unit / Staff</label>
                                        <select 
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                            value={formData.party2Name}
                                            onChange={(e) => {
                                                const selected = staffList.find(s => s.name === e.target.value);
                                                setFormData({ 
                                                    ...formData, 
                                                    party2Name: e.target.value,
                                                    party2Org: selected?.unit?.name || '',
                                                    party2Address: selected?.unit?.address || '',
                                                    party2Title: selected?.phone || ''
                                                });
                                            }}
                                        >
                                            <option value="">-- Pilih Penerima --</option>
                                            {staffList.map(s => (
                                                <option key={s.id} value={s.name}>{s.name} - {s.unit?.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <>
                                        <div className="col-span-full">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Nama / Instansi Eksternal</label>
                                            <input 
                                                required
                                                type="text"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                                value={formData.party2Name}
                                                onChange={(e) => setFormData({ ...formData, party2Name: e.target.value })}
                                                placeholder="Contoh: Pimpinan CV. Maju Jaya"
                                            />
                                        </div>
                                        <div className="col-span-full">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Nomor HP / WhatsApp</label>
                                            <input 
                                                type="text"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                                value={formData.party2Title}
                                                onChange={(e) => setFormData({ ...formData, party2Title: e.target.value })}
                                                placeholder="0812-xxxx-xxxx"
                                            />
                                        </div>
                                    </>
                                )}
                                <div className="col-span-full">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Alamat Penerima</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                        value={formData.party2Address}
                                        onChange={(e) => setFormData({ ...formData, party2Address: e.target.value })}
                                        placeholder="Alamat lengkap penerima..."
                                    />
                                </div>
                            </div>
                        )}

                        {(['BAST', 'MOU'].includes(formData.type) || ['Berita Acara', 'Serah Terima Barang', 'BAST'].includes(formData.category)) && (
                            <div className="col-span-full">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Daftar Barang Serah Terima</label>
                                    <button type="button" onClick={() => setBastItems([...bastItems, { name: '', qty: '', condition: 'Baik' }])} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700">
                                        <Plus size={14} /> Tambah Barang
                                    </button>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                                            <tr>
                                                <th className="p-3 border-b border-slate-200">Jenis Barang</th>
                                                <th className="p-3 border-b border-slate-200 w-24">Kuantitas</th>
                                                <th className="p-3 border-b border-slate-200 w-40">Kondisi</th>
                                                <th className="p-3 border-b border-slate-200 w-16 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bastItems.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="p-2 border-b border-slate-100">
                                                        <input required value={item.name} onChange={(e) => { const newI = [...bastItems]; newI[index].name = e.target.value; setBastItems(newI); }} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none" placeholder="Nama barang..." />
                                                    </td>
                                                    <td className="p-2 border-b border-slate-100">
                                                        <input required type="number" value={item.qty} onChange={(e) => { const newI = [...bastItems]; newI[index].qty = e.target.value; setBastItems(newI); }} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none" />
                                                    </td>
                                                    <td className="p-2 border-b border-slate-100">
                                                        <select value={item.condition} onChange={(e) => { const newI = [...bastItems]; newI[index].condition = e.target.value; setBastItems(newI); }} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none">
                                                            <option>Baik</option>
                                                            <option>Rusak Ringan</option>
                                                            <option>Rusak Berat</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-2 border-b border-slate-100 text-center">
                                                        <button type="button" onClick={() => setBastItems(bastItems.filter((_, i) => i !== index))} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {(formData.category === 'Pesanan' || formData.type === 'INVOICE') && (
                            <div className="col-span-full">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Daftar Barang / Jasa</label>
                                    <button type="button" onClick={() => setPurchasingItems([...purchasingItems, { name: '', spec: '', qty: '', unit: 'Pcs', price: '', total: 0 }])} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700">
                                        <Plus size={14} /> Tambah Baris
                                    </button>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
                                            <tr>
                                                <th className="p-3 border-b border-slate-200">Nama Barang & Spesifikasi</th>
                                                <th className="p-3 border-b border-slate-200 w-16">Qty</th>
                                                <th className="p-3 border-b border-slate-200 w-20">Satuan</th>
                                                <th className="p-3 border-b border-slate-200 w-32">Harga Satuan</th>
                                                <th className="p-3 border-b border-slate-200 w-32">Total</th>
                                                <th className="p-3 border-b border-slate-200 w-10 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {purchasingItems.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="p-2 border-b border-slate-100">
                                                        <input required value={item.name} onChange={(e) => { const newI = [...purchasingItems]; newI[index].name = e.target.value; setPurchasingItems(newI); }} className="w-full px-2 py-1.5 rounded border border-slate-200 outline-none font-bold" placeholder="Nama barang..." />
                                                        <textarea value={item.spec} onChange={(e) => { const newI = [...purchasingItems]; newI[index].spec = e.target.value; setPurchasingItems(newI); }} className="w-full mt-1 px-2 py-1 rounded border border-slate-200 outline-none text-[11px]" placeholder="Spesifikasi..." rows="2" />
                                                    </td>
                                                    <td className="p-2 border-b border-slate-100">
                                                        <input required type="number" value={item.qty} onChange={(e) => { 
                                                            const newI = [...purchasingItems]; 
                                                            newI[index].qty = e.target.value; 
                                                            newI[index].total = (parseFloat(e.target.value) || 0) * (parseFloat(newI[index].price) || 0);
                                                            setPurchasingItems(newI); 
                                                        }} className="w-full px-2 py-1.5 rounded border border-slate-200 outline-none" />
                                                    </td>
                                                    <td className="p-2 border-b border-slate-100">
                                                        <input required value={item.unit} onChange={(e) => { const newI = [...purchasingItems]; newI[index].unit = e.target.value; setPurchasingItems(newI); }} className="w-full px-2 py-1.5 rounded border border-slate-200 outline-none" placeholder="Pcs" />
                                                    </td>
                                                    <td className="p-2 border-b border-slate-100">
                                                        <input required type="number" value={item.price} onChange={(e) => { 
                                                            const newI = [...purchasingItems]; 
                                                            newI[index].price = e.target.value; 
                                                            newI[index].total = (parseFloat(newI[index].qty) || 0) * (parseFloat(e.target.value) || 0);
                                                            setPurchasingItems(newI); 
                                                        }} className="w-full px-2 py-1.5 rounded border border-slate-200 outline-none font-bold" placeholder="0" />
                                                    </td>
                                                    <td className="p-2 border-b border-slate-100 font-black text-blue-700">
                                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.total || 0)}
                                                    </td>
                                                    <td className="p-2 border-b border-slate-100 text-center">
                                                        <button type="button" onClick={() => setPurchasingItems(purchasingItems.filter((_, i) => i !== index))} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-slate-50 font-black">
                                                <td colSpan="4" className="p-3 text-right text-slate-500 uppercase tracking-widest text-[10px]">Total Keseluruhan</td>
                                                <td className="p-3 text-blue-800 text-sm">
                                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(purchasingItems.reduce((acc, curr) => acc + (curr.total || 0), 0))}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {formData.type === 'INVOICE' && (
                            <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-200">
                                <label className="col-span-full text-xs font-black text-blue-600 uppercase tracking-widest block mb-2">4. Informasi Pembayaran (Bank)</label>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Nama Bank</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                        value={invoiceData.bankName}
                                        onChange={(e) => setInvoiceData({ ...invoiceData, bankName: e.target.value })}
                                        placeholder="Contoh: Bank Nagari / BSI"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Nomor Rekening</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                        value={invoiceData.bankAccountNumber}
                                        onChange={(e) => setInvoiceData({ ...invoiceData, bankAccountNumber: e.target.value })}
                                        placeholder="0123-4567-89"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Nama Pemilik Rekening</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                        value={invoiceData.bankAccountName}
                                        onChange={(e) => setInvoiceData({ ...invoiceData, bankAccountName: e.target.value })}
                                        placeholder="Nama Lengkap"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Jatuh Tempo</label>
                                    <input 
                                        required
                                        type="date"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold text-red-600"
                                        value={invoiceData.dueDate}
                                        onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Status Pembayaran</label>
                                    <select 
                                        className={`w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold ${invoiceData.paymentStatus === 'PAID' ? 'text-green-600' : 'text-amber-600'}`}
                                        value={invoiceData.paymentStatus}
                                        onChange={(e) => setInvoiceData({ ...invoiceData, paymentStatus: e.target.value })}
                                    >
                                        <option value="UNPAID">🔴 BELUM LUNAS</option>
                                        <option value="PAID">🟢 LUNAS</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Catatan Tambahan</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium"
                                        value={invoiceData.notes}
                                        onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
                                        placeholder="Misal: Pembayaran harap menyertakan nomor invoice"
                                    />
                                </div>
                            </div>
                        )}

                        {formData.category === 'Edaran' && (
                            <div className="col-span-full space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-200">
                                <div>
                                    <label className="text-xs font-black text-amber-600 uppercase tracking-widest block mb-2">3. Struktur Surat Edaran</label>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Yth. (Kepada)</label>
                                            <input 
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                                                placeholder="Contoh: Seluruh Staff Sarpras / Unit Kerja"
                                                value={formData.party2Name}
                                                onChange={(e) => setFormData({...formData, party2Name: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Tempat</label>
                                            <input 
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                                                placeholder="Contoh: Di Padang / Tempat"
                                                value={formData.party2Address}
                                                onChange={(e) => setFormData({...formData, party2Address: e.target.value})}
                                            />
                                        </div>
                                        <div className="pt-4 border-t border-slate-100">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">1. Latar Belakang</label>
                                            <textarea 
                                                rows={4}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm leading-relaxed"
                                                placeholder="Tuliskan alasan/latar belakang surat edaran ini..."
                                                value={edaranData.background}
                                                onChange={(e) => setEdaranData({...edaranData, background: e.target.value})}
                                            />
                                        </div>
                                        <div className="pt-4 border-t border-slate-100">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">2. Ketentuan / Isi Edaran</label>
                                                <button type="button" onClick={() => setEdaranData({...edaranData, points: [...edaranData.points, { text: '', subs: [''] }]})} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                                    <Plus size={12} /> Tambah Poin
                                                </button>
                                            </div>
                                            <div className="space-y-4">
                                                {edaranData.points.map((point, idx) => (
                                                    <div key={idx} className="bg-white rounded-xl border border-slate-100 p-3 space-y-2">
                                                        <div className="flex gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600 shrink-0">{idx + 1}</div>
                                                            <textarea 
                                                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                                placeholder={`Ketentuan poin ${idx + 1}...`}
                                                                rows={2}
                                                                value={point.text}
                                                                onChange={(e) => {
                                                                    const newPoints = [...edaranData.points];
                                                                    newPoints[idx] = { ...newPoints[idx], text: e.target.value };
                                                                    setEdaranData({...edaranData, points: newPoints});
                                                                }}
                                                            />
                                                            {edaranData.points.length > 1 && (
                                                                <button type="button" onClick={() => setEdaranData({...edaranData, points: edaranData.points.filter((_, i) => i !== idx)})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {/* Sub-points */}
                                                        <div className="ml-10 space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sub-ketentuan</span>
                                                                <button type="button" onClick={() => {
                                                                    const newPoints = [...edaranData.points];
                                                                    newPoints[idx] = { ...newPoints[idx], subs: [...(newPoints[idx].subs || []), ''] };
                                                                    setEdaranData({...edaranData, points: newPoints});
                                                                }} className="text-[9px] font-bold text-blue-500 flex items-center gap-0.5">
                                                                    <Plus size={10} /> Sub
                                                                </button>
                                                            </div>
                                                            {(point.subs || ['']).map((sub, sIdx) => (
                                                                <div key={sIdx} className="flex gap-2">
                                                                    <div className="w-6 h-6 rounded bg-slate-50 flex items-center justify-center text-[9px] font-bold text-slate-400 shrink-0">{String.fromCharCode(97 + sIdx)}</div>
                                                                    <input
                                                                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-100 outline-none text-xs"
                                                                        placeholder={`Sub-poin ${String.fromCharCode(97 + sIdx)}...`}
                                                                        value={sub}
                                                                        onChange={(e) => {
                                                                            const newPoints = [...edaranData.points];
                                                                            const newSubs = [...(newPoints[idx].subs || [])];
                                                                            newSubs[sIdx] = e.target.value;
                                                                            newPoints[idx] = { ...newPoints[idx], subs: newSubs };
                                                                            setEdaranData({...edaranData, points: newPoints});
                                                                        }}
                                                                    />
                                                                    {(point.subs || []).length > 1 && (
                                                                        <button type="button" onClick={() => {
                                                                            const newPoints = [...edaranData.points];
                                                                            newPoints[idx] = { ...newPoints[idx], subs: newPoints[idx].subs.filter((_, i) => i !== sIdx) };
                                                                            setEdaranData({...edaranData, points: newPoints});
                                                                        }} className="p-1 text-red-400 hover:bg-red-50 rounded shrink-0">
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {formData.category === 'Keputusan' && (
                            <div className="col-span-full space-y-6 bg-amber-50/30 p-6 rounded-2xl border border-amber-100">
                                <label className="text-xs font-black text-amber-700 uppercase tracking-widest block mb-2">3. Struktur Surat Keputusan</label>
                                
                                {/* Menimbang */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Menimbang (Alasan)</label>
                                        <button type="button" onClick={() => setKeputusanData({...keputusanData, menimbang: [...keputusanData.menimbang, '']})} className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase">
                                            <Plus size={12} /> Tambah
                                        </button>
                                    </div>
                                    {keputusanData.menimbang.map((item, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <div className="w-8 h-8 rounded bg-white border border-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-600 shrink-0">{String.fromCharCode(97 + idx)}</div>
                                            <textarea 
                                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                placeholder="Bahwa dalam rangka..."
                                                rows={2}
                                                value={item}
                                                onChange={(e) => {
                                                    const newList = [...keputusanData.menimbang];
                                                    newList[idx] = e.target.value;
                                                    setKeputusanData({...keputusanData, menimbang: newList});
                                                }}
                                            />
                                            {keputusanData.menimbang.length > 1 && (
                                                <button type="button" onClick={() => setKeputusanData({...keputusanData, menimbang: keputusanData.menimbang.filter((_, i) => i !== idx)})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Mengingat */}
                                <div className="space-y-3 pt-4 border-t border-amber-100/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mengingat (Dasar Hukum)</label>
                                        <button type="button" onClick={() => setKeputusanData({...keputusanData, mengingat: [...keputusanData.mengingat, '']})} className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase">
                                            <Plus size={12} /> Tambah
                                        </button>
                                    </div>
                                    {keputusanData.mengingat.map((item, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <div className="w-8 h-8 rounded bg-white border border-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-600 shrink-0">{idx + 1}</div>
                                            <textarea 
                                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                placeholder="Anggaran Dasar Yayasan..."
                                                rows={2}
                                                value={item}
                                                onChange={(e) => {
                                                    const newList = [...keputusanData.mengingat];
                                                    newList[idx] = e.target.value;
                                                    setKeputusanData({...keputusanData, mengingat: newList});
                                                }}
                                            />
                                            {keputusanData.mengingat.length > 1 && (
                                                <button type="button" onClick={() => setKeputusanData({...keputusanData, mengingat: keputusanData.mengingat.filter((_, i) => i !== idx)})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Menetapkan */}
                                <div className="space-y-3 pt-4 border-t border-amber-100/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Menetapkan (Diktum)</label>
                                        <button type="button" onClick={() => {
                                            const dictums = ["PERTAMA", "KEDUA", "KETIGA", "KEEMPAT", "KELIMA", "KEENAM", "KETUJUH", "KEDELAPAN", "KESEMBILAN", "KESEPULUH"];
                                            const nextLabel = dictums[keputusanData.menetapkan.length] || `POIN ${keputusanData.menetapkan.length + 1}`;
                                            setKeputusanData({...keputusanData, menetapkan: [...keputusanData.menetapkan, { label: nextLabel, text: '' }]});
                                        }} className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase">
                                            <Plus size={12} /> Tambah Diktum
                                        </button>
                                    </div>
                                    {keputusanData.menetapkan.map((item, idx) => (
                                        <div key={idx} className="bg-white/50 rounded-xl p-3 border border-amber-50 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <input 
                                                    className="bg-transparent border-none outline-none text-[10px] font-black text-amber-600 uppercase tracking-widest w-24"
                                                    value={item.label}
                                                    onChange={(e) => {
                                                        const newList = [...keputusanData.menetapkan];
                                                        newList[idx].label = e.target.value;
                                                        setKeputusanData({...keputusanData, menetapkan: newList});
                                                    }}
                                                />
                                                {keputusanData.menetapkan.length > 1 && (
                                                    <button type="button" onClick={() => setKeputusanData({...keputusanData, menetapkan: keputusanData.menetapkan.filter((_, i) => i !== idx)})} className="text-red-400 hover:text-red-600">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <textarea 
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                placeholder="Isi penetapan..."
                                                rows={3}
                                                value={item.text}
                                                onChange={(e) => {
                                                    const newList = [...keputusanData.menetapkan];
                                                    newList[idx].text = e.target.value;
                                                    setKeputusanData({...keputusanData, menetapkan: newList});
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Tembusan */}
                                <div className="space-y-3 pt-4 border-t border-amber-100/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tembusan</label>
                                        <button type="button" onClick={() => setKeputusanData({...keputusanData, tembusan: [...keputusanData.tembusan, '']})} className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase">
                                            <Plus size={12} /> Tambah
                                        </button>
                                    </div>
                                    {keputusanData.tembusan.map((item, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input 
                                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                placeholder="Contoh: Ketua Yayasan..."
                                                value={item}
                                                onChange={(e) => {
                                                    const newList = [...keputusanData.tembusan];
                                                    newList[idx] = e.target.value;
                                                    setKeputusanData({...keputusanData, tembusan: newList});
                                                }}
                                            />
                                            {keputusanData.tembusan.length > 1 && (
                                                <button type="button" onClick={() => setKeputusanData({...keputusanData, tembusan: keputusanData.tembusan.filter((_, i) => i !== idx)})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {formData.category === 'Pemberitahuan' && (
                            <div className="col-span-full space-y-6 bg-green-50/30 p-6 rounded-2xl border border-green-100">
                                <label className="text-xs font-black text-green-700 uppercase tracking-widest block mb-2">3. Isi Surat Pemberitahuan</label>

                                {/* Kepada */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Yth. (Kepada)</label>
                                        <input
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                                            placeholder="Contoh: Seluruh Staff Yayasan"
                                            value={formData.party2Name}
                                            onChange={(e) => setFormData({...formData, party2Name: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Tempat</label>
                                        <input
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                                            placeholder="di Tempat"
                                            value={formData.party2Address}
                                            onChange={(e) => setFormData({...formData, party2Address: e.target.value})}
                                        />
                                    </div>
                                </div>

                                {/* Pembukaan */}
                                <div className="pt-4 border-t border-green-100/50">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Paragraf Pembukaan</label>
                                    <textarea
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm leading-relaxed"
                                        placeholder="Melalui surat ini, kami Bidang Sarana dan Prasarana ingin memberitahukan kepada seluruh pihak terkait mengenai..."
                                        value={pemberitahuanData.pembukaan}
                                        onChange={(e) => setPemberitahuanData({...pemberitahuanData, pembukaan: e.target.value})}
                                    />
                                </div>

                                {/* Poin-poin */}
                                <div className="pt-4 border-t border-green-100/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Poin-poin Penting</label>
                                        <button type="button" onClick={() => setPemberitahuanData({...pemberitahuanData, points: [...pemberitahuanData.points, '']})} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                            <Plus size={12} /> Tambah Poin
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {pemberitahuanData.points.map((point, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center text-[10px] font-bold text-green-600 shrink-0">{idx + 1}</div>
                                                <textarea
                                                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                    placeholder={`Poin penting ${idx + 1}...`}
                                                    rows={2}
                                                    value={point}
                                                    onChange={(e) => {
                                                        const newPoints = [...pemberitahuanData.points];
                                                        newPoints[idx] = e.target.value;
                                                        setPemberitahuanData({...pemberitahuanData, points: newPoints});
                                                    }}
                                                />
                                                {pemberitahuanData.points.length > 1 && (
                                                    <button type="button" onClick={() => setPemberitahuanData({...pemberitahuanData, points: pemberitahuanData.points.filter((_, i) => i !== idx)})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Penutup */}
                                <div className="pt-4 border-t border-green-100/50">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Paragraf Penutup</label>
                                    <textarea
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm leading-relaxed"
                                        placeholder="Demikian pemberitahuan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan Jazaakumullahu Khayran."
                                        value={pemberitahuanData.penutup}
                                        onChange={(e) => setPemberitahuanData({...pemberitahuanData, penutup: e.target.value})}
                                    />
                                </div>
                            </div>
                        )}

                        {formData.category === 'Tugas' && (
                            <div className="col-span-full space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-200">
                                {/* 1. Dasar Penugasan */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-black text-blue-600 uppercase tracking-widest block">Dasar Penugasan</label>
                                        <button type="button" onClick={() => setTaskData({...taskData, basisList: [...taskData.basisList, '']})} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                            <Plus size={12} /> Tambah Dasar
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {taskData.basisList.map((item, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input 
                                                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                    placeholder={`Dasar hukum/surat ${idx + 1}...`}
                                                    value={item}
                                                    onChange={(e) => {
                                                        const newList = [...taskData.basisList];
                                                        newList[idx] = e.target.value;
                                                        setTaskData({...taskData, basisList: newList});
                                                    }}
                                                />
                                                {taskData.basisList.length > 1 && (
                                                    <button type="button" onClick={() => setTaskData({...taskData, basisList: taskData.basisList.filter((_, i) => i !== idx)})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 2. Menugaskan Kepada (Tabel) */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-black text-blue-600 uppercase tracking-widest block">Menugaskan Kepada</label>
                                        <button type="button" onClick={() => setTaskData({...taskData, personnelList: [...taskData.personnelList, { name: '', position: '', nip: '' }]})} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                            <Plus size={12} /> Tambah Pegawai
                                        </button>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase">
                                                <tr>
                                                    <th className="px-4 py-2 border-b">Nama Pegawai</th>
                                                    <th className="px-4 py-2 border-b">Jabatan</th>
                                                    <th className="px-4 py-2 border-b w-32">NIY</th>
                                                    <th className="px-4 py-2 border-b w-12 text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {taskData.personnelList.map((p, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-2 py-1 border-b">
                                                            <div className="relative group">
                                                                <input 
                                                                    required 
                                                                    className="w-full px-2 py-1.5 border-none outline-none focus:bg-blue-50 rounded" 
                                                                    placeholder="Nama atau pilih staff..." 
                                                                    list={`staff-list-${idx}`}
                                                                    value={p.name} 
                                                                    onChange={(e) => { 
                                                                        const val = e.target.value;
                                                                        const found = staffList.find(s => s.name === val);
                                                                        const nl = [...taskData.personnelList]; 
                                                                        nl[idx].name = val;
                                                                        if (found) {
                                                                            nl[idx].position = found.position;
                                                                            nl[idx].nip = found.username; // NIY
                                                                        }
                                                                        setTaskData({...taskData, personnelList: nl}); 
                                                                    }} 
                                                                />
                                                                <datalist id={`staff-list-${idx}`}>
                                                                    {staffList.map(s => (
                                                                        <option key={s.id} value={s.name}>{s.position}</option>
                                                                    ))}
                                                                </datalist>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1 border-b">
                                                            <input className="w-full px-2 py-1.5 border-none outline-none focus:bg-blue-50 rounded text-slate-500" placeholder="Jabatan..." value={p.position} onChange={(e) => { const nl = [...taskData.personnelList]; nl[idx].position = e.target.value; setTaskData({...taskData, personnelList: nl}); }} />
                                                        </td>
                                                        <td className="px-2 py-1 border-b">
                                                            <input className="w-full px-2 py-1.5 border-none outline-none focus:bg-blue-50 rounded text-slate-500" placeholder="NIY..." value={p.nip} onChange={(e) => { const nl = [...taskData.personnelList]; nl[idx].nip = e.target.value; setTaskData({...taskData, personnelList: nl}); }} />
                                                        </td>
                                                        <td className="px-2 py-1 border-b text-center">
                                                            {taskData.personnelList.length > 1 && (
                                                                <button type="button" onClick={() => setTaskData({...taskData, personnelList: taskData.personnelList.filter((_, i) => i !== idx)})} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 3. Untuk (Maksud & Tujuan) */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-black text-blue-600 uppercase tracking-widest block">Untuk (Maksud & Tujuan)</label>
                                        <button type="button" onClick={() => setTaskData({...taskData, purposeList: [...taskData.purposeList, '']})} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                            <Plus size={12} /> Tambah Poin
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {taskData.purposeList.map((item, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <textarea 
                                                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                    placeholder={`Tujuan ke-${idx + 1}...`}
                                                    rows={1}
                                                    value={item}
                                                    onChange={(e) => {
                                                        const newList = [...taskData.purposeList];
                                                        newList[idx] = e.target.value;
                                                        setTaskData({...taskData, purposeList: newList});
                                                    }}
                                                />
                                                {taskData.purposeList.length > 1 && (
                                                    <button type="button" onClick={() => setTaskData({...taskData, purposeList: taskData.purposeList.filter((_, i) => i !== idx)})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 4. Waktu & Tempat */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tgl. Mulai</label>
                                        <input type="date" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm" value={taskData.dateStart} onChange={(e) => setTaskData({...taskData, dateStart: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tgl. Selesai</label>
                                        <input type="date" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm" value={taskData.dateEnd} onChange={(e) => setTaskData({...taskData, dateEnd: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Keterangan Waktu</label>
                                        <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm" placeholder="Contoh: 08.00 s.d Selesai" value={taskData.timeRange} onChange={(e) => setTaskData({...taskData, timeRange: e.target.value})} />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tempat / Lokasi</label>
                                        <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm" placeholder="Lokasi penugasan..." value={taskData.location} onChange={(e) => setTaskData({...taskData, location: e.target.value})} />
                                    </div>
                                </div>

                                {/* 5. Tembusan */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Tembusan (Opsional)</label>
                                        <button type="button" onClick={() => setTaskData({...taskData, carbonCopy: [...taskData.carbonCopy, '']})} className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                                            <Plus size={12} /> Tambah Tembusan
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {taskData.carbonCopy.map((item, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input 
                                                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                    placeholder="Contoh: Arsip..."
                                                    value={item}
                                                    onChange={(e) => {
                                                        const newList = [...taskData.carbonCopy];
                                                        newList[idx] = e.target.value;
                                                        setTaskData({...taskData, carbonCopy: newList});
                                                    }}
                                                />
                                                {taskData.carbonCopy.length > 1 && (
                                                    <button type="button" onClick={() => setTaskData({...taskData, carbonCopy: taskData.carbonCopy.filter((_, i) => i !== idx)})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {formData.type === 'SURAT_MASUK' && (
                            <div className="col-span-full">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Upload File Surat Masuk (PDF/Gambar)</label>
                                <input 
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    required={!doc?.fileUrl}
                                />
                            </div>
                        )}

                        {formData.type !== 'SURAT_MASUK' && !['Berita Acara', 'Serah Terima Barang', 'Pesanan', 'Tugas'].includes(formData.category) && !['BAST', 'MOU'].includes(formData.type) && (
                            <div className="col-span-full">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Isi Dokumen / Pesan</label>
                                <textarea 
                                    required={formData.type !== 'INVOICE'}
                                    rows={6}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-medium leading-relaxed"
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder={formData.type === 'INVOICE' ? 'Opsional: catatan tambahan untuk invoice...' : 'Tuliskan isi surat secara lengkap di sini...'}
                                />
                            </div>
                        )}

                        {(['BAST', 'MOU'].includes(formData.type) || (formData.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang'].includes(formData.category))) && (
                            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                                <div className="space-y-4">
                                    <div className="text-xs font-black text-blue-600 uppercase tracking-widest">Pihak Pertama (Internal)</div>
                                    <input 
                                        placeholder="Nama Pihak 1"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                        value={formData.party1Name}
                                        onChange={(e) => setFormData({ ...formData, party1Name: e.target.value })}
                                    />
                                    <input 
                                        placeholder="Jabatan Pihak 1"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                        value={formData.party1Title}
                                        onChange={(e) => setFormData({ ...formData, party1Title: e.target.value })}
                                    />
                                    <textarea 
                                        placeholder="Alamat Pihak 1"
                                        rows={2}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                        value={formData.party1Address || ''}
                                        onChange={(e) => setFormData({ ...formData, party1Address: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div className="text-xs font-black text-emerald-600 uppercase tracking-widest">Pihak Kedua (Eksternal)</div>
                                    <input 
                                        placeholder="Nama Pihak 2"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                        value={formData.party2Name}
                                        onChange={(e) => setFormData({ ...formData, party2Name: e.target.value })}
                                    />
                                    <input 
                                        placeholder="Jabatan Pihak 2"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                        value={formData.party2Title}
                                        onChange={(e) => setFormData({ ...formData, party2Title: e.target.value })}
                                    />
                                    <textarea 
                                        placeholder="Alamat Pihak 2"
                                        rows={2}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                        value={formData.party2Address || ''}
                                        onChange={(e) => setFormData({ ...formData, party2Address: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-all">
                            Batal
                        </button>
                        <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
                            <Save size={18} /> Simpan Sebagai Draft
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SignatureModal = ({ signatureRequest, onClose, onSuccess }) => {
    const { doc, party } = signatureRequest || {};
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [approvalNote, setApprovalNote] = useState('');

    useEffect(() => {
        if (!doc || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, [doc, party]);

    if (!doc) return null;

    const startDrawing = (e) => {
        setIsDrawing(true);
        const { offsetX, offsetY } = e.nativeEvent;
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = e.nativeEvent;
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
    };

    const stopDrawing = () => setIsDrawing(false);

    const clearCanvas = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSign = async (dataUrl = null) => {
        try {
            const signatureData = dataUrl;
            
            if (party) {
                // Multi-party sign
                await api.post(`/office-documents/${doc.id}/sign-party`, {
                    party,
                    signatureData,
                    name: party === 'party1' ? doc.party1Name : doc.party2Name,
                    title: party === 'party1' ? doc.party1Title : doc.party2Title,
                    org: party === 'party1' ? doc.party1Org : doc.party2Org,
                    address: party === 'party1' ? doc.party1Address : doc.party2Address,
                });
            } else {
                // Kabid Approval sign
                await api.post(`/office-documents/${doc.id}/approve`, {
                    signatureData,
                    approvalNote
                });
            }
            
            alert('Dokumen berhasil ditandatangani!');
            onSuccess();
            onClose();
        } catch (err) {
            alert('Gagal tanda tangan: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
                <div className="p-8 text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                        <FileSignature size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">Konfirmasi Tanda Tangan</h3>
                    <p className="text-slate-500 font-medium px-8 text-sm">Anda akan menandatangani dokumen <span className="font-bold text-slate-800">"{doc.subject}"</span></p>
                </div>

                <div className="px-8 pb-8 space-y-6">
                    {party === 'party2' ? (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <SignaturePad 
                                title={`Tanda Tangan Pihak Kedua (Penerima)`}
                                onCancel={onClose}
                                onSave={(dataUrl) => handleSign(dataUrl)}
                            />
                            <p className="mt-4 text-[10px] text-center text-slate-400 font-medium leading-relaxed">
                                Pihak Kedua menandatangani secara manual pada Signature Pad ini.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center text-center space-y-3">
                                <ShieldCheck className="text-emerald-600" size={40} />
                                <div>
                                    <div className="text-emerald-800 font-black uppercase tracking-widest text-[10px] mb-1">Otentikasi Digital (TTE)</div>
                                    <p className="text-emerald-700 text-sm font-medium">
                                        {party === 'party1' 
                                            ? 'Pihak Pertama (Internal) akan menandatangani secara elektronik (TTE/QR Code).' 
                                            : 'Sistem akan menyematkan Tanda Tangan Elektronik (QR Code) resmi atas nama Anda.'
                                        }
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Catatan Persetujuan (Opsional)</label>
                                <textarea 
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium text-sm"
                                    placeholder="Tambahkan instruksi atau catatan jika ada..."
                                    value={approvalNote}
                                    onChange={(e) => setApprovalNote(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <button onClick={onClose} className="px-6 py-4 rounded-2xl font-black text-slate-500 hover:bg-slate-100 transition-all uppercase tracking-widest text-xs">
                                    Batal
                                </button>
                                <button onClick={() => handleSign()} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs">
                                    {party === 'party1' ? 'Tandatangani (TTE)' : 'Setujui & Terbitkan TTE'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const TabButton = ({ active, label, icon, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`}
    >
        {icon} {label}
    </button>
);

const TypeSelectionModal = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;

    const types = [
        { 
            id: 'SURAT_MASUK', label: 'Surat Masuk', icon: <Inbox size={24} />, 
            desc: 'Dokumen yang diterima dari luar instansi', color: 'blue' 
        },
        { 
            id: 'SURAT_KELUAR', label: 'Surat Keluar', icon: <Send size={24} />, 
            desc: 'Surat Tugas, Edaran, Keputusan, BAST, dll', color: 'emerald'
        },
        { 
            id: 'INVOICE', label: 'Invoice / Tagihan', icon: <FileText size={24} />, 
            desc: 'Dokumen penagihan atau bukti pembayaran', color: 'amber' 
        },
        { 
            id: 'LAINNYA', label: 'Dokumen Lainnya', icon: <Tag size={24} />, 
            desc: 'Dokumen pendukung lainnya', color: 'slate' 
        },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-black text-slate-900 leading-none text-xl">Pilih Tipe Dokumen</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {types.map(t => (
                        <button 
                            key={t.id}
                            onClick={() => onSelect(t.id)}
                            className="group text-left p-6 rounded-2xl border-2 border-slate-100 bg-slate-50/50 hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-start"
                        >
                            <div className={`p-3 rounded-xl bg-${t.color}-50 text-${t.color}-600 mb-4 group-hover:scale-110 transition-transform`}>{t.icon}</div>
                            <div className="font-black text-slate-900 text-lg leading-tight">{t.label}</div>
                            <div className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">{t.desc}</div>
                            
                            <div className="mt-6 flex items-center gap-2 text-blue-600 text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                                Pilih Tipe Ini <ArrowRight size={14} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EOffice;
