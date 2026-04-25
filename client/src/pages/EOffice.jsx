import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { 
    FileText, Inbox, Send, Plus, Search, Filter, 
    MoreVertical, CheckCircle2, XCircle, Clock, 
    FileSignature, Download, Eye, Trash2, Printer,
    Calendar, User, Tag, ArrowRight, ShieldCheck,
    AlertCircle, Save, X, Edit2, QrCode
} from 'lucide-react';
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
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState(null);
    const [viewingDoc, setViewingDoc] = useState(null);
    const [signatureModal, setSignatureModal] = useState(false);

    const user = JSON.parse(localStorage.getItem('user'));
    const isKabidSarpras = user?.role === 'KABID_SARPRAS' || user?.role === 'SUPER_ADMIN';

    useEffect(() => {
        fetchStats();
        fetchDocuments();
    }, [tab]);

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
            const endpoint = tab === 'surat-masuk' ? '/office-documents/incoming' : '/office-documents/outgoing';
            const res = await api.get(endpoint);
            setDocuments(res.data.documents || []);
        } catch (err) {
            console.error('Fetch documents error:', err);
        } finally {
            setLoading(false);
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Surat Masuk" value={stats?.totalIncoming || 0} icon={<Inbox className="text-blue-500" size={22} />} color="blue" />
                <StatCard title="Surat Keluar" value={stats?.totalOutgoing || 0} icon={<Send className="text-emerald-500" size={22} />} color="emerald" />
                <StatCard title="Menunggu TTE" value={stats?.pendingApproval || 0} icon={<Clock className="text-amber-500" size={22} />} color="amber" />
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
                                doc.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                doc.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                doc.senderName?.toLowerCase().includes(searchQuery.toLowerCase())
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
                                            <button 
                                                onClick={() => window.open(`/api/office-documents/${doc.id}/pdf`, '_blank')}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Cetak PDF"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            {(doc.status === 'DRAFT' || doc.status === 'REJECTED') && (
                                                <button 
                                                    onClick={() => { setEditingDoc(doc); setIsFormOpen(true); }}
                                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={18} />
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
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => window.open(`/api/office-documents/${viewingDoc.id}/pdf`, '_blank')}
                                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                            >
                                <Printer size={18} /> Cetak PDF
                            </button>
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
                            {viewingDoc.status === 'PENDING_APPROVAL' && isKabidSarpras && (
                                <button 
                                    onClick={() => { setViewingDoc(null); setSignatureModal(viewingDoc); }}
                                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                                >
                                    <FileSignature size={18} /> Tandatangani
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
                        onClick={() => { setEditingDoc(null); setIsFormOpen(true); }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} /> Buat Dokumen Baru
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-xl w-fit">
                <TabButton 
                    active={tab === 'dashboard'} 
                    label="Dashboard" 
                    icon={<LayoutDashboard size={16} />} 
                    onClick={() => navigate('/e-office/dashboard')} 
                />
                <TabButton 
                    active={tab === 'surat-masuk'} 
                    label="Surat Masuk" 
                    icon={<Inbox size={16} />} 
                    onClick={() => navigate('/e-office/surat-masuk')} 
                />
                <TabButton 
                    active={tab === 'surat-keluar'} 
                    label="Surat Keluar" 
                    icon={<Send size={16} />} 
                    onClick={() => navigate('/e-office/surat-keluar')} 
                />
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
                doc={signatureModal} 
                onClose={() => setSignatureModal(false)} 
                onSuccess={() => { fetchDocuments(); fetchStats(); }}
            />
        </div>
    );
};

const FormModal = ({ isOpen, onClose, doc, onSuccess, defaultType }) => {
    const [formData, setFormData] = useState({
        type: defaultType,
        subject: '',
        content: '',
        category: 'Undangan',
        priority: 'BIASA',
        senderName: '',
        senderOrg: '',
        referenceNumber: '',
        receivedDate: formatDate(new Date(), 'input'),
        party1Name: 'Yayasan Daarul Ilmi',
        party1Title: 'Kepala Bidang Sarpras',
        party2Name: '',
        party2Title: '',
    });

    useEffect(() => {
        if (doc) {
            setFormData({
                ...doc,
                receivedDate: doc.receivedDate ? formatDate(doc.receivedDate, 'input') : '',
            });
        } else {
            setFormData(prev => ({ ...prev, type: defaultType }));
        }
    }, [doc, defaultType, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (doc) {
                await api.put(`/office-documents/${doc.id}`, formData);
            } else {
                await api.post(formData.type === 'SURAT_MASUK' ? '/office-documents/incoming' : '/office-documents/outgoing', formData);
            }
            onSuccess();
            onClose();
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
                            <h3 className="font-black text-slate-900">{doc ? 'Edit Dokumen' : 'Buat Dokumen Baru'}</h3>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[75vh]">
                        <div className="col-span-full">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Jenis Dokumen</label>
                            <div className="flex items-center gap-2">
                                {['SURAT_KELUAR', 'SURAT_MASUK', 'BAST', 'MOU'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: t })}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                                            formData.type === t 
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'
                                        }`}
                                    >
                                        {t.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="col-span-full">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Perihal / Subjek Surat</label>
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
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Kategori Surat</label>
                                    <select 
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {['Undangan', 'Tugas', 'Keputusan', 'Keterangan', 'Pemberitahuan', 'Berita Acara', 'Lainnya'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
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
                            </>
                        )}

                        <div className="col-span-full">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Isi Dokumen / Pesan</label>
                            <textarea 
                                required
                                rows={6}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-medium leading-relaxed"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder="Tuliskan isi surat secara lengkap di sini..."
                            />
                        </div>

                        {['BAST', 'MOU'].includes(formData.type) && (
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

const SignatureModal = ({ doc, onClose, onSuccess }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [approvalNote, setApprovalNote] = useState('');

    useEffect(() => {
        if (!doc) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, [doc]);

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
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSign = async () => {
        try {
            const signatureData = canvasRef.current.toDataURL('image/png');
            await api.post(`/office-documents/${doc.id}/approve`, {
                signatureData,
                approvalNote
            });
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
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Goreskan Tanda Tangan</label>
                            <button onClick={clearCanvas} className="text-[10px] font-black text-blue-600 uppercase hover:underline">Hapus</button>
                        </div>
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 overflow-hidden cursor-crosshair">
                            <canvas 
                                ref={canvasRef}
                                width={448}
                                height={200}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                className="w-full"
                            />
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
                        <button onClick={handleSign} className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs">
                            Setujui & TTE
                        </button>
                    </div>
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

const LayoutDashboard = ({ size }) => <FileText size={size} />; // Placeholder as it was not imported correctly

export default EOffice;
