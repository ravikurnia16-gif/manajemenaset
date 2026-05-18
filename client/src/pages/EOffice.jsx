import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/axios';
import { ArrowLeft, CheckCircle, XCircle, UserPlus, PlayCircle, Wrench, Sparkles, AlertTriangle, Info, Plus, Loader2, ClipboardList, UserCheck, HardHat, Cog, CheckCircle2, Trash2, LayoutDashboard, Inbox, Send, FileText, Tag, Archive, X, ArrowRight, ShieldCheck, Search, ChevronRight, Download, FileSignature, Filter, MoreVertical, Eye, Printer, Trash, Clock, QrCode, AlertCircle, Paperclip, Edit2, Calendar, Save, MessageSquare, Phone, Users } from 'lucide-react';
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
    if (type === 'datetime') return `${dd} ${BULAN[mm]} ${yyyy} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (type === 'input') return `${yyyy}-${String(mm + 1).padStart(2, '0')}-${dd}`;
    return `${dd} ${BULAN[mm]} ${yyyy}`;
};

const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white p-3 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4">
        <div className={`p-2 sm:p-3 rounded-xl bg-${color}-50`}>{icon}</div>
        <div>
            <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</div>
            <div className="text-lg sm:text-2xl font-black text-slate-800">{value}</div>
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

const getPaymentStatus = (doc) => {
    if (doc.type !== 'INVOICE') return null;
    try {
        const parsed = JSON.parse(doc.content || '{}');
        return parsed.paymentStatus || 'UNPAID';
    } catch (e) {
        return 'UNPAID';
    }
};

const DashboardView = ({ stats, navigate, setViewingDoc }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
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

const LampiranPreview = ({ doc }) => {
    let content = {};
    try { content = JSON.parse(doc.content || '{}'); } catch (e) { }
    const hasText = content.lampiranText && content.lampiranText.trim();

    const photoUrls = (doc.fileUrl || '').split(',').filter(url => url.trim());
    const hasPhoto = photoUrls.some(url =>
        url.toLowerCase().endsWith('.jpg') ||
        url.toLowerCase().endsWith('.jpeg') ||
        url.toLowerCase().endsWith('.png') ||
        url.toLowerCase().endsWith('.webp')
    );

    if (!hasText && !hasPhoto) return null;

    return (
        <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Paperclip size={14} /> Lampiran Dokumen
            </div>
            {hasText && (
                <div className="bg-slate-50 p-4 rounded-xl mb-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Teks Lampiran</div>
                    <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{content.lampiranText}</div>
                </div>
            )}
            {hasPhoto && (
                <div className="space-y-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Foto / Gambar Lampiran</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {photoUrls.map((url, idx) => {
                            const isImage = url.toLowerCase().endsWith('.jpg') ||
                                url.toLowerCase().endsWith('.jpeg') ||
                                url.toLowerCase().endsWith('.png') ||
                                url.toLowerCase().endsWith('.webp');
                            if (!isImage) return null;
                            return (
                                <div key={idx} className="rounded-xl overflow-hidden border border-slate-100 shadow-sm bg-white p-2">
                                    <img
                                        src={url.startsWith('http') || url.startsWith('/') ? url : `/api/media/${url}`}
                                        alt={`Lampiran ${idx + 1}`}
                                        className="w-full h-auto max-h-[400px] object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(url.startsWith('http') || url.startsWith('/') ? url : `/api/media/${url}`, '_blank')}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const ListView = ({
    loading,
    filteredDocs,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    showCategoryFilter,
    setViewingDoc,
    setEditingDoc,
    setIsFormOpen,
    isSuperAdmin,
    handleDelete,
    handleSendWA,
    sendingWA,
    handleTogglePaymentStatus,
    setSendDocWATarget
}) => (
    <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari subjek, nomor..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-semibold text-slate-800"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {showCategoryFilter && (
                    <div className="relative shrink-0">
                        <select
                            className="pl-3 pr-8 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-sm font-bold text-slate-700 appearance-none cursor-pointer hover:border-slate-300 transition-all min-w-[160px]"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="">📁 Semua Kategori</option>
                            <option value="Tugas">📋 Tugas</option>
                            <option value="Keputusan">⚖️ Keputusan</option>
                            <option value="Pemberitahuan">📢 Pemberitahuan</option>
                            <option value="BAST">📦 BAST</option>
                            <option value="Pesanan">🛒 Pesanan</option>
                            <option value="Edaran">📄 Edaran</option>
                            <option value="Umum">🏢 Umum</option>
                            <option value="Berita Acara Kunjungan">🚗 Kunjungan</option>
                            <option value="Lainnya">📎 Lainnya</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <Filter size={14} />
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                    ) : filteredDocs.length === 0 ? (
                        <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 italic">Tidak ada dokumen ditemukan</td></tr>
                    ) : filteredDocs.map(doc => (
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
                            <td className="px-6 py-4 text-slate-600 font-medium">{formatDate(doc.date)}</td>
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
                                {doc.category === 'Pesanan' && (() => {
                                    try {
                                        const pc = JSON.parse(doc.content || '{}');
                                        const cd = Array.isArray(pc) ? {} : pc;
                                        const os = cd.orderStatus || 'PENDING';
                                        const dl = cd.deadline || '';
                                        const colors = { PENDING: 'bg-amber-100 text-amber-700', PROCESSING: 'bg-blue-100 text-blue-700', COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700' };
                                        return (
                                            <div className="mt-1 flex flex-col gap-0.5">
                                                <span className={`px-2 py-0.5 ${colors[os] || colors.PENDING} rounded-full text-[10px] font-black uppercase tracking-widest w-fit`}>{os}</span>
                                                {dl && <span className="text-[9px] font-bold text-slate-400">DL: {dl}</span>}
                                            </div>
                                        );
                                    } catch (e) { return null; }
                                })()}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => setViewingDoc(doc)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Lihat Detail"><Eye size={18} /></button>
                                    {doc.type === 'SURAT_MASUK' ? (
                                        doc.fileUrl ? (
                                            <button
                                                onClick={() => {
                                                    const firstFile = doc.fileUrl.split(',')[0];
                                                    window.open(firstFile.startsWith('http') || firstFile.startsWith('/') ? firstFile : `/api/media/${firstFile}`, '_blank');
                                                }}
                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all inline-block"
                                                title="Lihat File"
                                            >
                                                <Download size={18} />
                                            </button>
                                        ) : null
                                    ) : (
                                        <button onClick={() => window.open(`/api/office-documents/${doc.id}/pdf?token=${localStorage.getItem('token')}`, '_blank')} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Cetak PDF"><Printer size={18} /></button>
                                    )}
                                    {doc.type === 'INVOICE' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleSendWA(doc.id); }}
                                            disabled={sendingWA === doc.id}
                                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                            title="Kirim WA Invoice"
                                        >
                                            {sendingWA === doc.id ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSendDocWATarget(doc); }}
                                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                        title="Kirim Surat via WA"
                                    >
                                        <MessageSquare size={18} />
                                    </button>
                                    {(doc.type === 'INVOICE' || doc.category === 'Invoice') && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleTogglePaymentStatus(doc.id, getPaymentStatus(doc)); }}
                                            className={`p-2 rounded-lg transition-all ${getPaymentStatus(doc) === 'PAID' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                            title={getPaymentStatus(doc) === 'PAID' ? 'Tandai Belum Lunas' : 'Tandai Lunas'}
                                        >
                                            {getPaymentStatus(doc) === 'PAID' ? <XCircle size={18} /> : <CheckCircle size={18} />}
                                        </button>
                                    )}
                                    {(doc.status === 'DRAFT' || doc.status === 'REJECTED' || doc.status === 'PENDING_APPROVAL') && (
                                        <button onClick={() => { setEditingDoc(doc); setIsFormOpen(true); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Edit"><Edit2 size={18} /></button>
                                    )}
                                    {isSuperAdmin && (
                                        <button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Hapus"><Trash2 size={18} /></button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden space-y-3">
            {loading ? (
                <div className="p-8 text-center text-slate-400 italic bg-white rounded-xl border">Memuat data...</div>
            ) : filteredDocs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic bg-white rounded-xl border">Tidak ada dokumen</div>
            ) : filteredDocs.map(doc => (
                <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm" onClick={() => setViewingDoc(doc)}>
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${doc.type === 'SURAT_MASUK' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {doc.type === 'SURAT_MASUK' ? <Inbox size={16} /> : <Send size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 text-sm line-clamp-2">{doc.subject}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{doc.number || 'Draft'} • {formatDate(doc.date)}</div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <StatusBadge status={doc.status} />
                                {doc.category && <span className="text-[10px] text-slate-400 font-medium">{doc.category}</span>}
                                {doc.type === 'INVOICE' && (
                                    getPaymentStatus(doc) === 'PAID'
                                        ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[9px] font-black">LUNAS</span>
                                        : <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-black">BELUM LUNAS</span>
                                )}
                                {doc.category === 'Pesanan' && (() => {
                                    try {
                                        const pc = JSON.parse(doc.content || '{}');
                                        const cd = Array.isArray(pc) ? {} : pc;
                                        const os = cd.orderStatus || 'PENDING';
                                        const dl = cd.deadline || '';
                                        const colors = { PENDING: 'bg-amber-100 text-amber-700', PROCESSING: 'bg-blue-100 text-blue-700', COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700' };
                                        return (
                                            <>
                                                <span className={`px-2 py-0.5 ${colors[os] || colors.PENDING} rounded-full text-[9px] font-black`}>{os}</span>
                                                {dl && <span className="text-[8px] font-bold text-slate-400">DL: {dl}</span>}
                                            </>
                                        );
                                    } catch (e) { return null; }
                                })()}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                            {doc.type === 'SURAT_MASUK' ? (
                                doc.fileUrl && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const firstFile = doc.fileUrl.split(',')[0];
                                            window.open(firstFile.startsWith('http') || firstFile.startsWith('/') ? firstFile : `/api/media/${firstFile}`, '_blank');
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg"
                                    >
                                        <Download size={14} />
                                    </button>
                                )
                            ) : (
                                <button onClick={(e) => { e.stopPropagation(); window.open(`/api/office-documents/${doc.id}/pdf?token=${localStorage.getItem('token')}`, '_blank'); }} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"><Printer size={14} /></button>
                            )}
                            {doc.type === 'INVOICE' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleSendWA(doc.id); }}
                                    disabled={sendingWA === doc.id}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg"
                                >
                                    {sendingWA === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); setSendDocWATarget(doc); }}
                                className="p-1.5 text-slate-400 hover:text-green-600 rounded-lg"
                                title="Kirim via WA"
                            >
                                <MessageSquare size={14} />
                            </button>
                            {(doc.status === 'DRAFT' || doc.status === 'REJECTED' || doc.status === 'PENDING_APPROVAL') && (
                                <button onClick={(e) => { e.stopPropagation(); setEditingDoc(doc); setIsFormOpen(true); }} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg"><Edit2 size={14} /></button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const InfoGroup = ({ label, value, icon, full }) => {
    return (
        <div className={full ? 'col-span-full' : ''}>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                {icon} {label}
            </div>
            <div className="text-slate-800 font-bold leading-relaxed">{value || '-'}</div>
        </div>
    );
};

const ViewModal = ({ viewingDoc, setViewingDoc, localStorage, api, formatDate, handleSendWA, sendingWA, handleTogglePaymentStatus, setSendDocWATarget, handleSubmitForApproval, setSignatureRequest, isKabidSarpras }) => {
    if (!viewingDoc) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
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

                <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
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
                                    <div className="col-span-full pt-4 space-y-2">
                                        {viewingDoc.fileUrl.split(',').filter(u => u.trim()).map((url, idx, arr) => (
                                            <a
                                                key={idx}
                                                href={url.startsWith('http') || url.startsWith('/') ? url : `/api/media/${url}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-3 rounded-xl font-bold hover:bg-emerald-100 transition-colors"
                                            >
                                                <Download size={18} /> {arr.length > 1 ? `Unduh / Lihat File ${idx + 1}` : 'Unduh / Lihat File Surat Masuk'}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {viewingDoc.status === 'SIGNED' && (
                        <div className="flex flex-col gap-4">
                            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-6">
                                <div className="p-4 bg-white rounded-xl shadow-sm border border-emerald-100 shrink-0">
                                    <QrCode size={48} className="text-emerald-600" />
                                </div>
                                <div>
                                    <div className="font-black text-emerald-900 text-lg">Dokumen Terverifikasi</div>
                                    <div className="text-emerald-700 text-sm font-medium leading-relaxed">
                                        Ditandatangani oleh <span className="font-bold underline">{viewingDoc.signedBy?.name}</span> pada {formatDate(viewingDoc.signedAt, 'datetime')}.
                                    </div>
                                    <button
                                        onClick={() => window.open(`/api/office-documents/${viewingDoc.id}/tte-asset?token=${localStorage.getItem('token')}`, '_blank')}
                                        className="mt-2 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
                                    >
                                        <Download size={14} /> Unduh Gambar TTE (QR Code) untuk Ms. Word
                                    </button>
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
                            <div className="space-y-4">
                                {/* Lokasi */}
                                {(() => {
                                    try {
                                        const content = JSON.parse(viewingDoc.content || '{}');
                                        if (content.location) {
                                            return (
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                                        <Tag size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lokasi Penyerahan (Bertempat di)</div>
                                                        <div className="text-sm font-bold text-slate-800">{content.location}</div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    } catch (e) { }
                                    return null;
                                })()}

                                {/* Pihak 1 & Pihak 2 */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 relative">
                                        <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Pihak Pertama</div>
                                        <div className="text-sm font-bold text-slate-800">{viewingDoc.party1Name || '-'}</div>
                                        <div className="text-[11px] text-slate-500">{viewingDoc.party1Title || ''}</div>
                                        {viewingDoc.party1Org && <div className="text-[11px] font-medium text-slate-600 mt-1">{viewingDoc.party1Org}</div>}

                                        {viewingDoc.party1SignedAt && (
                                            <div className="mt-3 pt-3 border-t border-blue-200/50 flex items-center gap-2 text-[10px] font-bold text-blue-700">
                                                <ShieldCheck size={14} /> Tanda Tangan Digital OK
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 relative">
                                        <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Pihak Kedua</div>
                                        <div className="text-sm font-bold text-slate-800">{viewingDoc.party2Name || '-'}</div>
                                        <div className="text-[11px] text-slate-500">{viewingDoc.party2Title || ''}</div>
                                        {viewingDoc.party2Org && <div className="text-[11px] font-medium text-slate-600 mt-1">{viewingDoc.party2Org}</div>}

                                        {viewingDoc.party2SignedAt && (
                                            <div className="mt-3 pt-3 border-t border-emerald-200/50 flex items-center gap-2 text-[10px] font-bold text-emerald-700">
                                                <CheckCircle2 size={14} /> Telah Ditandatangani
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Items Table */}
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead className="bg-slate-50 text-slate-600 font-bold">
                                            <tr>
                                                <th className="p-3 border-b border-slate-200">Jenis Barang</th>
                                                <th className="p-3 border-b border-slate-200">Spesifikasi/SN</th>
                                                <th className="p-3 border-b border-slate-200 w-24">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                try {
                                                    const content = JSON.parse(viewingDoc.content || '{}');
                                                    const items = Array.isArray(content) ? content : (content.items || []);
                                                    if (items.length === 0) return <tr><td colSpan="3" className="p-4 text-center text-slate-400 italic">Tidak ada rincian barang</td></tr>;

                                                    return items.map((item, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-3 border-b border-slate-100 font-medium">{item.name}</td>
                                                            <td className="p-3 border-b border-slate-100 text-xs text-slate-500">{item.spec || '-'}</td>
                                                            <td className="p-3 border-b border-slate-100">{item.qty} {item.unit || ''}</td>
                                                        </tr>
                                                    ));
                                                } catch (e) {
                                                    return <tr><td colSpan="3" className="p-4 text-center text-slate-400 italic">Format data tidak valid</td></tr>;
                                                }
                                            })()}
                                        </tbody>
                                    </table>
                                    <LampiranPreview doc={viewingDoc} />
                                </div>
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
                                                            {items.map((item, i) => {
                                                                const price = parseFloat(item.price) || 0;
                                                                const total = (parseFloat(item.qty) || 0) * price;
                                                                return (
                                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                                        <td className="p-3 border-b border-slate-100 font-medium">
                                                                            {item.name}
                                                                            {item.spec && <div className="text-[10px] text-slate-400 font-normal">{item.spec}</div>}
                                                                        </td>
                                                                        <td className="p-3 border-b border-slate-100 font-bold">{item.qty} {item.unit}</td>
                                                                        <td className="p-3 border-b border-slate-100 text-right font-black text-blue-700">
                                                                            {price > 0 ? (
                                                                                new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total)
                                                                            ) : (
                                                                                <span className="text-slate-400 italic font-medium">Menyusul</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            <tr className="bg-blue-50/30">
                                                                <td colSpan="2" className="p-3 text-right font-bold text-slate-500 uppercase tracking-widest text-[10px]">Total Tagihan</td>
                                                                <td className="p-3 text-right font-black text-blue-800 text-sm">
                                                                    {items.some(it => !(parseFloat(it.price) > 0)) ? (
                                                                        <span className="text-slate-400 italic">Menyusul</span>
                                                                    ) : (
                                                                        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total)
                                                                    )}
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
                                                <LampiranPreview doc={viewingDoc} />
                                            </div>
                                        );
                                    } catch (e) {
                                        return <p className="text-red-500 italic">Gagal memuat rincian invoice</p>;
                                    }
                                })()}
                            </div>
                        ) : viewingDoc.category === 'Pesanan' ? (
                            <div className="space-y-6">
                                <div className="text-center border-y border-slate-100 py-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Pesanan Perihal</div>
                                    <div className="text-sm font-black text-slate-900 leading-relaxed max-w-md mx-auto">{viewingDoc.subject}</div>
                                </div>
                                {/* Deadline & Order Status Inline Edit */}
                                {(() => {
                                    try {
                                        const parsedContent = JSON.parse(viewingDoc.content || '{}');
                                        const contentData = Array.isArray(parsedContent) ? { items: parsedContent } : parsedContent;
                                        const curDeadline = contentData.deadline || '';
                                        const curOrderStatus = contentData.orderStatus || 'PENDING';
                                        const statusColors = {
                                            PENDING: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', selectBorder: 'border-amber-200' },
                                            PROCESSING: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', selectBorder: 'border-blue-200' },
                                            COMPLETED: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-600', selectBorder: 'border-green-200' },
                                            CANCELLED: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-600', selectBorder: 'border-red-200' }
                                        };
                                        const sc = statusColors[curOrderStatus] || statusColors.PENDING;
                                        return (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Deadline Selesai</span>
                                                    <input
                                                        type="date"
                                                        className="bg-transparent border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-red-600 outline-none w-full focus:ring-2 focus:ring-red-200 transition-all"
                                                        defaultValue={curDeadline}
                                                        onBlur={async (e) => {
                                                            if (e.target.value !== curDeadline) {
                                                                try {
                                                                    const res = await api.patch(`/office-documents/${viewingDoc.id}/order-status`, { orderStatus: curOrderStatus, deadline: e.target.value });
                                                                    alert(res.data.message);
                                                                    setViewingDoc(res.data.doc);
                                                                } catch (err) {
                                                                    alert('Gagal memperbarui deadline: ' + (err.response?.data?.error || err.message));
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className={`p-4 rounded-xl border flex flex-col justify-between ${sc.bg} ${sc.border}`}>
                                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status Pesanan (Progress)</span>
                                                    <select
                                                        className={`bg-white border rounded-lg px-2 py-1.5 text-xs font-bold outline-none cursor-pointer w-full ${sc.text} ${sc.selectBorder} focus:ring-2 transition-all`}
                                                        defaultValue={curOrderStatus}
                                                        onChange={async (e) => {
                                                            try {
                                                                const res = await api.patch(`/office-documents/${viewingDoc.id}/order-status`, { orderStatus: e.target.value, deadline: curDeadline });
                                                                alert(res.data.message);
                                                                setViewingDoc(res.data.doc);
                                                            } catch (err) {
                                                                alert('Gagal memperbarui status: ' + (err.response?.data?.error || err.message));
                                                            }
                                                        }}
                                                    >
                                                        <option value="PENDING">🟡 PENDING (Menunggu)</option>
                                                        <option value="PROCESSING">🔵 PROCESSING (Proses)</option>
                                                        <option value="COMPLETED">🟢 COMPLETED (Selesai)</option>
                                                        <option value="CANCELLED">🔴 CANCELLED (Batal)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        );
                                    } catch (e) { return null; }
                                })()}
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase">
                                            <tr>
                                                <th className="p-3 border-b border-slate-200">Nama Barang</th>
                                                <th className="p-3 border-b border-slate-200">Spek</th>
                                                <th className="p-3 border-b border-slate-200 w-16">Qty</th>
                                                <th className="p-3 border-b border-slate-200 w-24 text-right">Harga</th>
                                                <th className="p-3 border-b border-slate-200 w-24 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                try {
                                                    const parsed = JSON.parse(viewingDoc.content || '{}');
                                                    const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
                                                    const hasUnknownPrice = items.some(it => !(parseFloat(it.price) > 0));
                                                    const grandTotal = items.reduce((acc, curr) => acc + ((parseFloat(curr.qty) || 0) * (parseFloat(curr.price) || 0)), 0);

                                                    return (
                                                        <>
                                                            {items.map((item, i) => {
                                                                const price = parseFloat(item.price) || 0;
                                                                const total = (parseFloat(item.qty) || 0) * price;
                                                                return (
                                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                                        <td className="p-3 border-b border-slate-100 font-bold text-slate-800">{item.name}</td>
                                                                        <td className="p-3 border-b border-slate-100 text-slate-500">{item.spec || '-'}</td>
                                                                        <td className="p-3 border-b border-slate-100 font-black text-blue-600">{item.qty} {item.unit}</td>
                                                                        <td className="p-3 border-b border-slate-100 text-right font-bold text-slate-700">
                                                                            {price > 0 ? (
                                                                                new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price)
                                                                            ) : (
                                                                                <span className="text-slate-400 italic font-medium">Menyusul</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3 border-b border-slate-100 text-right font-black text-blue-700">
                                                                            {price > 0 ? (
                                                                                new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total)
                                                                            ) : (
                                                                                <span className="text-slate-400 italic font-medium">Menyusul</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            <tr className="bg-slate-50/50 font-black">
                                                                <td colSpan="4" className="p-3 text-right text-slate-500 uppercase tracking-widest text-[10px]">Total Perkiraan</td>
                                                                <td className="p-3 text-right text-blue-800 text-sm">
                                                                    {hasUnknownPrice ? (
                                                                        <span className="text-slate-400 italic">Menyusul</span>
                                                                    ) : (
                                                                        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(grandTotal)
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        </>
                                                    );
                                                } catch (e) { return null; }
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                                <LampiranPreview doc={viewingDoc} />
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
                                                        <div className="text-xs text-slate-600 leading-relaxed pl-7 text-justify">{data.background || '-'}</div>
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
                                                                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">{i + 1}.</div>
                                                                            <div className="text-xs text-slate-700 leading-relaxed text-justify">{pt.text}</div>
                                                                        </div>
                                                                        {pt.subs && pt.subs.filter(s => s).length > 0 && (
                                                                            <div className="ml-8 mt-1 space-y-1">
                                                                                {pt.subs.filter(s => s).map((s, j) => (
                                                                                    <div key={j} className="flex gap-2 items-start">
                                                                                        <div className="text-[9px] font-bold text-slate-300 mt-0.5">{String.fromCharCode(97 + j)}.</div>
                                                                                        <div className="text-[11px] text-slate-500 leading-relaxed text-justify">{s}</div>
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
                                                <LampiranPreview doc={viewingDoc} />
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
                                                                <span className="leading-relaxed text-justify">{item}</span>
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
                                                                <span className="leading-relaxed text-justify">{item}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                <div>
                                                    <div className="font-black text-blue-700 uppercase text-[10px] tracking-widest mb-2 text-center">MEMUTUSKAN:</div>
                                                    <div className="space-y-4">
                                                        {(data.menetapkan || []).map((item, idx) => (
                                                            <div key={idx}>
                                                                <div className="font-black text-slate-900 uppercase text-[9px] mb-1">{item.label}:</div>
                                                                <div className="text-slate-700 leading-relaxed text-justify pl-4">{item.text}</div>
                                                                {item.subs && item.subs.length > 0 && (
                                                                    <div className="pl-8 mt-1 space-y-1">
                                                                        {item.subs.map((sub, sIdx) => (
                                                                            <div key={sIdx} className="flex gap-2">
                                                                                <span className="font-bold text-slate-500 shrink-0">{String.fromCharCode(97 + sIdx)}.</span>
                                                                                <span className="text-slate-700 leading-relaxed text-justify">{sub}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <LampiranPreview doc={viewingDoc} />
                                            </div>
                                        );
                                    } catch (e) {
                                        return <p className="text-red-500 italic">Gagal memuat rincian keputusan</p>;
                                    }
                                })()}
                            </div>
                        ) : viewingDoc.category === 'Berita Acara Kunjungan' ? (
                            <div className="space-y-6">
                                {(() => {
                                    try {
                                        const data = JSON.parse(viewingDoc.content || '{}');
                                        return (
                                            <div className="space-y-6">
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                                    <div className="flex items-start gap-3">
                                                        <Calendar className="text-slate-400 mt-1" size={16} />
                                                        <div>
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Waktu Kunjungan</div>
                                                            <div className="text-sm font-bold text-slate-800">{formatDate(data.date, 'full')}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <Tag className="text-slate-400 mt-1" size={16} />
                                                        <div>
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tujuan Kunjungan</div>
                                                            <div className="text-sm font-bold text-slate-800">{data.purpose}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start gap-3">
                                                        <Search className="text-slate-400 mt-1" size={16} />
                                                        <div>
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lokasi</div>
                                                            <div className="text-sm font-bold text-slate-800">{data.locationName}</div>
                                                            <div className="text-xs text-slate-500">{data.locationAddress}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <div>
                                                        <div className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-2">Aktivitas Kegiatan</div>
                                                        <div className="space-y-2 pl-2">
                                                            {data.activities && data.activities.map((act, i) => (
                                                                <div key={i} className="flex gap-3 text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                    <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center text-[10px] font-bold text-emerald-600 shrink-0">{i + 1}</div>
                                                                    <div className="leading-relaxed">{act}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2">Hasil & Kesimpulan</div>
                                                        <div className="grid grid-cols-1 gap-3 pl-2">
                                                            {data.results && Array.isArray(data.results) ? data.results.map((res, i) => (
                                                                <div key={i} className="bg-white/50 p-3 rounded-xl border border-slate-100">
                                                                    <div className="font-black text-slate-900 text-[11px] uppercase mb-2 flex items-center gap-2">
                                                                        <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                                                                        {res.title || '-'}
                                                                    </div>
                                                                    <ul className="space-y-1 pl-3">
                                                                        {res.items && res.items.map((it, j) => (
                                                                            <li key={j} className="text-slate-600 text-[11px] flex gap-2">
                                                                                <span className="text-emerald-400">•</span>
                                                                                <span>{it}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )) : <div className="whitespace-pre-wrap leading-relaxed">{data.results || '-'}</div>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <LampiranPreview doc={viewingDoc} />
                                            </div>
                                        );
                                    } catch (e) {
                                        return <p className="text-red-500 italic">Gagal memuat rincian kunjungan</p>;
                                    }
                                })()}
                            </div>
                        ) : viewingDoc.category === 'Lainnya' || (viewingDoc.content && typeof viewingDoc.content === 'string' && viewingDoc.content.includes('"isManual":true')) ? (
                            <div className="p-6 bg-violet-50 rounded-2xl border border-violet-100">
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <FileText size={24} />
                                    </div>
                                    <h3 className="text-lg font-black text-violet-900 mb-1">Penyusunan Manual (Ms. Word)</h3>
                                    <p className="text-sm font-medium text-violet-700">Konten dokumen dikelola secara manual di luar sistem.</p>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-violet-100 shadow-sm space-y-3 text-sm font-medium text-slate-700">
                                    <div className="flex justify-between border-b border-slate-100 pb-3">
                                        <span className="text-slate-500">Nomor Surat:</span>
                                        <span className="font-bold font-mono">{viewingDoc.number || '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 pb-3">
                                        <span className="text-slate-500">Status File Final:</span>
                                        <span className="font-bold">{viewingDoc.fileUrl ? '✅ File Tersedia' : '❌ File Belum Diunggah'}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 text-center pt-2">
                                        {viewingDoc.fileUrl
                                            ? 'Klik "Lihat Dokumen Final" di bawah untuk melihat file.'
                                            : 'Silakan unggah file final PDF Anda di bawah ini.'}
                                    </p>
                                    {viewingDoc.status === 'SIGNED' && (
                                        <div className="pt-4 border-t border-slate-100">
                                            <input
                                                type="file"
                                                id="upload-final-file"
                                                className="hidden"
                                                accept=".pdf,application/pdf"
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    try {
                                                        const fd = new FormData();
                                                        fd.append('files', file);
                                                        await api.put(`/office-documents/${viewingDoc.id}/final-file`, fd, {
                                                            headers: { 'Content-Type': 'multipart/form-data' }
                                                        });
                                                        alert('File final berhasil diunggah!');
                                                        window.location.reload();
                                                    } catch (err) {
                                                        alert('Gagal mengunggah file: ' + (err.response?.data?.error || err.message));
                                                    }
                                                }}
                                            />
                                            <label
                                                htmlFor="upload-final-file"
                                                className="w-full px-4 py-2 bg-violet-100 text-violet-700 hover:bg-violet-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                                            >
                                                <FileText size={16} /> {viewingDoc.fileUrl ? 'Perbarui File Final' : 'Unggah File Final PDF'}
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (viewingDoc.category !== 'Lainnya' && viewingDoc.status === 'SIGNED' && viewingDoc.fileUrl && (viewingDoc.fileUrl.toLowerCase().endsWith('.pdf'))) ? (
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center gap-4 text-center">
                                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900">File Final Tersedia</h3>
                                    <p className="text-sm text-slate-500">Gunakan tombol "Lihat Dokumen Final" untuk membuka file.</p>
                                </div>
                                <button
                                    onClick={() => document.getElementById('upload-final-file-alt')?.click()}
                                    className="text-xs font-bold text-blue-600 hover:underline"
                                >
                                    Ganti File Final?
                                </button>
                                <input
                                    type="file"
                                    id="upload-final-file-alt"
                                    className="hidden"
                                    accept=".pdf,application/pdf"
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        try {
                                            const fd = new FormData();
                                            fd.append('files', file);
                                            await api.put(`/office-documents/${viewingDoc.id}/final-file`, fd, {
                                                headers: { 'Content-Type': 'multipart/form-data' }
                                            });
                                            alert('File final berhasil diperbarui!');
                                            window.location.reload();
                                        } catch (err) {
                                            alert('Gagal mengunggah: ' + (err.response?.data?.error || err.message));
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                                {viewingDoc.content || '(Tanpa isi)'}
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {viewingDoc.type !== 'SURAT_MASUK' && (
                            <button
                                onClick={() => window.open(`/api/office-documents/${viewingDoc.id}/pdf?token=${localStorage.getItem('token')}`, '_blank')}
                                className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                            >
                                <Printer size={18} /> {viewingDoc.category === 'Lainnya' ? 'Lihat Dokumen Final' : 'Cetak PDF'}
                            </button>
                        )}
                        {(viewingDoc.category === 'Lainnya' || viewingDoc.status === 'SIGNED') && (
                            <>
                                <input
                                    type="file"
                                    id="global-upload-final-file"
                                    className="hidden"
                                    accept=".pdf,application/pdf"
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        try {
                                            const fd = new FormData();
                                            fd.append('files', file);
                                            await api.put(`/office-documents/${viewingDoc.id}/final-file`, fd, {
                                                headers: { 'Content-Type': 'multipart/form-data' }
                                            });
                                            alert('File final berhasil diunggah!');
                                            window.location.reload();
                                        } catch (err) {
                                            alert('Gagal mengunggah file: ' + (err.response?.data?.error || err.message));
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => document.getElementById('global-upload-final-file')?.click()}
                                    className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-violet-700 transition-all shadow-lg shadow-violet-900/20"
                                >
                                    <Paperclip size={18} /> {viewingDoc.fileUrl ? 'Update File Final' : 'Unggah File Final'}
                                </button>
                            </>
                        )}
                        {viewingDoc.type === 'INVOICE' && (
                            <button
                                onClick={() => handleSendWA(viewingDoc.id)}
                                disabled={sendingWA === viewingDoc.id}
                                className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                            >
                                {sendingWA === viewingDoc.id ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Kirim Notifikasi WA
                            </button>
                        )}
                        <button
                            onClick={() => setSendDocWATarget(viewingDoc)}
                            className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-900/20"
                        >
                            <MessageSquare size={18} /> Kirim via WA
                        </button>
                        {(viewingDoc.type === 'INVOICE' || viewingDoc.category === 'Invoice') && (
                            <button
                                onClick={() => handleTogglePaymentStatus(viewingDoc.id, getPaymentStatus(viewingDoc))}
                                className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${getPaymentStatus(viewingDoc) === 'PAID'
                                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                            >
                                {getPaymentStatus(viewingDoc) === 'PAID' ? <XCircle size={18} /> : <CheckCircle size={18} />}
                                {getPaymentStatus(viewingDoc) === 'PAID' ? 'Tandai Belum Lunas' : 'Tandai Lunas'}
                            </button>
                        )}
                        {viewingDoc.type !== 'SURAT_MASUK' && viewingDoc.status === 'DRAFT' && (
                            <button
                                onClick={() => {
                                    const isManual = viewingDoc.content && typeof viewingDoc.content === 'string' && viewingDoc.content.includes('"isManual":true');
                                    handleSubmitForApproval(viewingDoc.id, isManual);
                                }}
                                className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
                            >
                                <FileSignature size={18} /> Ajukan TTE
                            </button>
                        )}
                        {viewingDoc.status === 'PENDING_APPROVAL' && isKabidSarpras && (
                            <>
                                <button
                                    onClick={() => setSignatureRequest({ doc: viewingDoc, party: null })}
                                    className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20"
                                >
                                    <ShieldCheck size={18} /> Tanda Tangani
                                </button>
                                <button
                                    onClick={async () => {
                                        const reason = prompt('Alasan penolakan:');
                                        if (!reason) return;
                                        try {
                                            await api.post(`/office-documents/${viewingDoc.id}/reject`, { rejectionReason: reason });
                                            alert('Dokumen ditolak.');
                                            setViewingDoc(null);
                                        } catch (err) {
                                            alert('Gagal menolak: ' + (err.response?.data?.error || err.message));
                                        }
                                    }}
                                    className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-red-100 text-red-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-200 transition-all"
                                >
                                    <XCircle size={18} /> Tolak
                                </button>
                            </>
                        )}
                        {/* TTD Pihak Ke 2 for BAST */}
                        {(['BAST', 'MOU'].includes(viewingDoc.type) || (viewingDoc.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang', 'BAST'].includes(viewingDoc.category))) && viewingDoc.status === 'SIGNED' && !viewingDoc.party2SignedAt && !viewingDoc.party2Signature && (
                            <button
                                onClick={() => setSignatureRequest({ doc: viewingDoc, party: 'party2' })}
                                className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20"
                            >
                                <UserCheck size={18} /> TTD Pihak Ke-2
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SendDocWAModal = ({ doc, isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('internal');
    const [internalUsers, setInternalUsers] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [externalTargets, setExternalTargets] = useState([{ name: '', phone: '' }]);
    const [customMessage, setCustomMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [searchUser, setSearchUser] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchInternalUsers();
            setSelectedUserIds([]);
            setExternalTargets([{ name: '', phone: '' }]);
            setCustomMessage('');
            setSearchUser('');
        }
    }, [isOpen]);

    const fetchInternalUsers = async () => {
        try {
            const res = await api.get('/office-documents/internal-users');
            setInternalUsers(res.data);
        } catch (err) {
            console.error('Failed to load internal users:', err);
        }
    };

    const toggleUser = (userId) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleSend = async () => {
        const targets = [];
        if (activeTab === 'internal') {
            selectedUserIds.forEach(uid => targets.push({ type: 'internal', userId: uid }));
        } else {
            externalTargets.forEach(t => {
                if (t.phone.trim()) targets.push({ type: 'external', name: t.name.trim(), phone: t.phone.trim() });
            });
        }
        if (targets.length === 0) {
            alert('Pilih minimal satu penerima!');
            return;
        }
        setSending(true);
        try {
            const res = await api.post(`/office-documents/${doc.id}/send-doc-wa`, { targets, customMessage: customMessage.trim() || undefined });
            alert(res.data.message);
            onClose();
        } catch (err) {
            alert('Gagal mengirim: ' + (err.response?.data?.error || err.message));
        } finally {
            setSending(false);
        }
    };

    const filteredUsers = internalUsers.filter(u =>
        u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
        (u.position || '').toLowerCase().includes(searchUser.toLowerCase())
    );

    if (!isOpen || !doc) return null;

    const docTypeLabels = { 'SURAT_MASUK': 'Surat Masuk', 'SURAT_KELUAR': 'Surat Keluar', 'SURAT_PESANAN': 'Surat Pesanan', 'INVOICE': 'Invoice', 'BAST': 'Berita Acara', 'MOU': 'MOU', 'LAINNYA': 'Dokumen' };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200 max-h-[95vh] sm:max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-green-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200">
                                <MessageSquare size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 text-lg leading-none">Kirim via WhatsApp</h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium">{docTypeLabels[doc.type] || doc.category} • {doc.subject?.substring(0, 40)}{doc.subject?.length > 40 ? '...' : ''}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={22} /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('internal')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${activeTab === 'internal' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        <Users size={16} /> Internal
                    </button>
                    <button
                        onClick={() => setActiveTab('external')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${activeTab === 'external' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        <Phone size={16} /> Eksternal
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeTab === 'internal' ? (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Cari nama atau jabatan..."
                                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                    value={searchUser}
                                    onChange={(e) => setSearchUser(e.target.value)}
                                />
                            </div>
                            {selectedUserIds.length > 0 && (
                                <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                                    {selectedUserIds.length} penerima dipilih
                                </div>
                            )}
                            <div className="space-y-1.5 max-h-[35vh] overflow-y-auto">
                                {filteredUsers.length === 0 ? (
                                    <div className="text-center text-slate-400 text-sm italic py-6">
                                        {internalUsers.length === 0 ? 'Memuat...' : 'Tidak ditemukan'}
                                    </div>
                                ) : filteredUsers.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => toggleUser(u.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${selectedUserIds.includes(u.id)
                                            ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200'
                                            : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                                            }`}
                                    >
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${selectedUserIds.includes(u.id) ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {selectedUserIds.includes(u.id) ? <CheckCircle2 size={18} /> : u.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 text-sm truncate">{u.name}</div>
                                            <div className="text-[10px] text-slate-400 font-medium truncate">{u.position || u.role}</div>
                                        </div>
                                        <div className="text-[10px] text-slate-300 font-mono shrink-0">{u.phone?.slice(-4)}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Penerima Eksternal</div>
                            {externalTargets.map((t, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                    <div className="flex-1 space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Nama penerima"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                            value={t.name}
                                            onChange={(e) => {
                                                const upd = [...externalTargets];
                                                upd[idx].name = e.target.value;
                                                setExternalTargets(upd);
                                            }}
                                        />
                                        <input
                                            type="tel"
                                            placeholder="No. WhatsApp (mis: 08123456789)"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono"
                                            value={t.phone}
                                            onChange={(e) => {
                                                const upd = [...externalTargets];
                                                upd[idx].phone = e.target.value;
                                                setExternalTargets(upd);
                                            }}
                                        />
                                    </div>
                                    {externalTargets.length > 1 && (
                                        <button
                                            onClick={() => setExternalTargets(externalTargets.filter((_, i) => i !== idx))}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors mt-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                onClick={() => setExternalTargets([...externalTargets, { name: '', phone: '' }])}
                                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-1.5"
                            >
                                <Plus size={14} /> Tambah Penerima
                            </button>
                        </div>
                    )}

                    {/* Custom Message */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Pesan Tambahan (opsional)</label>
                        <textarea
                            placeholder="Tuliskan pesan tambahan jika diperlukan..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                            rows={2}
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-all">
                        Batal
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {sending ? 'Mengirim...' : 'Kirim WhatsApp'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const EOffice = () => {
    const { tab = 'dashboard' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState(null);
    const [viewingDoc, setViewingDoc] = useState(null);
    const [signatureRequest, setSignatureRequest] = useState(null);
    const [submitApprovalData, setSubmitApprovalData] = useState(null);
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [sendingWA, setSendingWA] = useState(null);
    const [sendDocWATarget, setSendDocWATarget] = useState(null);

    const user = JSON.parse(localStorage.getItem('user'));
    const isKabidSarpras = user?.role === 'KABID_SARPRAS' || user?.role === 'KEPALA_BIDANG' || user?.role === 'SUPER_ADMIN';
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    useEffect(() => {
        fetchStats();
        fetchDocuments();
        setCategoryFilter(''); // Reset category filter on tab switch

        if (location.state?.autoCreate) {
            const s = location.state;
            setEditingDoc({
                ...s,
                receivedDate: formatDate(new Date(), 'input'),
            });
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
            } else if (tab === 'manajemen-dokumen') {
                params.type = 'LAINNYA';
                params.categories = 'SOP,Peraturan,Surat Edaran';
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





    const filteredDocs = (documents || []).filter(doc => {
        if (!doc) return false;
        const matchesSearch = (doc.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (doc.number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (doc.senderName || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !categoryFilter || doc.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });



    const handleDelete = async (id) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus dokumen ini secara permanen?')) {
            return;
        }
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
        if (!window.confirm(msg)) {
            return;
        }

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
        if (!window.confirm('Kirim notifikasi tagihan ke nomor WhatsApp penerima?')) {
            return;
        }
        try {
            const res = await api.post(`/office-documents/${id}/send-wa`);
            alert(res.data.message);
        } catch (err) {
            alert('Gagal mengirim WA: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleSubmitForApproval = async (id, isManual) => {
        if (isManual) {
            setSubmitApprovalData({ id });
            return;
        }
        if (!window.confirm('Ajukan dokumen ini untuk ditandatangani oleh pimpinan?')) {
            return;
        }
        await executeSubmitApproval(id);
    };

    const executeSubmitApproval = async (id, category = null) => {
        try {
            if (category) {
                await api.put(`/office-documents/${id}`, { category });
            }
            await api.post(`/office-documents/${id}/submit`);
            alert('Berhasil diajukan!');
            setViewingDoc(null);
            setSubmitApprovalData(null);
            fetchDocuments();
            fetchStats();
        } catch (err) {
            alert('Gagal mengajukan: ' + (err.response?.data?.error || err.message));
        }
    };

    // --- Content Area Rendering ---

    const renderContent = () => {
        if (tab === 'dashboard') return (
            <DashboardView 
                stats={stats} 
                navigate={navigate} 
                setViewingDoc={setViewingDoc} 
            />
        );
        return (
            <ListView 
                loading={loading}
                filteredDocs={filteredDocs}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                showCategoryFilter={tab === 'surat-keluar'}
                setViewingDoc={setViewingDoc}
                setEditingDoc={setEditingDoc}
                setIsFormOpen={setIsFormOpen}
                isSuperAdmin={isSuperAdmin}
                handleDelete={handleDelete}
                handleSendWA={handleSendWA}
                sendingWA={sendingWA}
                handleTogglePaymentStatus={handleTogglePaymentStatus}
                setSendDocWATarget={setSendDocWATarget}
            />
        );
    };

    return (
        <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-8 bg-slate-50 min-h-screen">
            {/* Header Area */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3">
                        <FileSignature className="text-blue-600" size={24} /> E-Office
                    </h1>
                    <p className="text-slate-500 font-medium text-xs sm:text-base hidden sm:block">Manajemen Dokumen & Tanda Tangan Elektronik</p>
                </div>
                <button
                    onClick={() => setIsTypeModalOpen(true)}
                    className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center gap-1.5 sm:gap-2 shrink-0"
                >
                    <Plus size={16} /> <span className="hidden sm:inline">Buat Dokumen</span><span className="sm:hidden">Buat</span>
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-x-auto max-w-full" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={14} /> },
                    { id: 'surat-masuk', label: 'Masuk', icon: <Inbox size={14} /> },
                    { id: 'surat-keluar', label: 'Keluar', icon: <Send size={14} /> },
                    { id: 'manajemen-dokumen', label: 'Dokumen', icon: <Archive size={14} /> },
                    { id: 'invoice', label: 'Invoice', icon: <FileText size={14} /> },
                    { id: 'lainnya', label: 'Lainnya', icon: <Tag size={14} /> },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => navigate(`/e-office/${t.id}`)}
                        className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${tab === t.id
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
            <ViewModal 
                viewingDoc={viewingDoc} 
                setViewingDoc={setViewingDoc} 
                localStorage={localStorage} 
                api={api} 
                formatDate={formatDate} 
                handleSendWA={handleSendWA}
                sendingWA={sendingWA}
                handleTogglePaymentStatus={handleTogglePaymentStatus}
                setSendDocWATarget={setSendDocWATarget}
                handleSubmitForApproval={handleSubmitForApproval}
                setSignatureRequest={setSignatureRequest}
                isKabidSarpras={isKabidSarpras}
            />
            <SendDocWAModal
                doc={sendDocWATarget}
                isOpen={!!sendDocWATarget}
                onClose={() => setSendDocWATarget(null)}
            />
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
                onSuccess={(updatedDoc) => {
                    fetchDocuments();
                    fetchStats();
                    if (updatedDoc) setViewingDoc(updatedDoc);
                }}
            />
            <TypeSelectionModal
                isOpen={isTypeModalOpen}
                onClose={() => setIsTypeModalOpen(false)}
                onSelect={(type) => {
                    setIsTypeModalOpen(false);
                    if (type === 'MANAJEMEN_DOKUMEN') {
                        setEditingDoc({ type: 'LAINNYA', category: 'SOP', _isManagement: true });
                    } else {
                        setEditingDoc({ type });
                    }
                    setIsFormOpen(true);
                }}
            />

            {submitApprovalData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 text-center animate-in zoom-in duration-200">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileSignature size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Pilih Kategori Surat</h3>
                        <p className="text-sm text-slate-500 mb-6">Untuk penomoran otomatis, silakan pilih kategori dokumen manual Anda:</p>
                        
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {['Tugas', 'Keputusan', 'Pemberitahuan', 'BAST', 'Pesanan', 'Edaran', 'Umum', 'Berita Acara Kunjungan', 'Lainnya'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => executeSubmitApproval(submitApprovalData.id, c)}
                                    className="px-4 py-3 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all"
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                        
                        <button onClick={() => setSubmitApprovalData(null)} className="px-6 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">Batal</button>
                    </div>
                </div>
            )}
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
        party1Title: 'Bidang Sarana dan Prasarana',
        party1Org: 'Yayasan Dar el-Iman',
        party1Address: 'Gunuang Juaro',
        party2Name: '',
        party2Title: '',
        party2Org: '',
        party2Address: '',
        location: 'Padang',
    });
    const [files, setFiles] = useState([]);
    const [isMultipart, setIsMultipart] = useState(false);
    const [recipientType, setRecipientType] = useState('external');
    const [recipientsData, setRecipientsData] = useState({
        isMultiple: false,
        mode: 'LIST', // LIST or MASSAL
        list: [{ name: '', title: '', address: '' }]
    });
    const [bastItems, setBastItems] = useState([]);
    const [purchasingItems, setPurchasingItems] = useState([]);
    const [priceDetermined, setPriceDetermined] = useState(true);
    const [deadline, setDeadline] = useState('');
    const [orderStatus, setOrderStatus] = useState('PENDING');
    const [staffList, setStaffList] = useState([]);
    const [lampiranText, setLampiranText] = useState('');
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
    const [umumData, setUmumData] = useState({ subCategory: '', body: '' });
    const [lainnyaData, setLainnyaData] = useState({ title: '', body: '' });
    const [kunjunganData, setKunjunganData] = useState({
        date: formatDate(new Date(), 'input'),
        purpose: '',
        locationName: '',
        locationAddress: '',
        activities: [''],
        results: [{ title: '', items: [''] }]
    });
    const [extractingDocx, setExtractingDocx] = useState(false);
    const [keputusanData, setKeputusanData] = useState({
        menimbang: [''],
        mengingat: [''],
        menetapkan: [{ label: 'PERTAMA', text: '', subs: [] }, { label: 'KEDUA', text: '', subs: [] }],
        tembusan: ['']
    });
    const [pemberitahuanData, setPemberitahuanData] = useState({
        pembukaan: '',
        points: [''],
        penutup: ''
    });

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
            if (doc.id) {
                setFormData({
                    ...doc,
                    receivedDate: doc.receivedDate ? formatDate(doc.receivedDate, 'input') : '',
                });
            } else {
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

            if (doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    if (parsed.recipientsData) {
                        setRecipientsData(parsed.recipientsData);
                    }
                    setLampiranText(parsed.lampiranText || '');
                } catch (e) { }
            } else {
                setLampiranText('');
            }

            if ((doc.type === 'BAST' || ['Serah Terima Barang', 'BAST'].includes(doc.category)) && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    setBastItems(Array.isArray(parsed) ? parsed : (parsed.items || []));
                    if (parsed.location) {
                        setFormData(prev => ({ ...prev, location: parsed.location }));
                    }
                } catch (e) {
                    console.error('Failed to parse BAST content JSON', e);
                }
            }
            if (doc.category === 'Pesanan' && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    setPurchasingItems(Array.isArray(parsed) ? parsed : (parsed.items || []));
                    setPriceDetermined(parsed.priceDetermined !== undefined ? parsed.priceDetermined : true);
                    setDeadline(parsed.deadline || '');
                    setOrderStatus(parsed.orderStatus || 'PENDING');
                } catch (e) {
                    console.error('Failed to parse Purchasing content JSON', e);
                }
            }
            if ((doc.type === 'INVOICE' || doc.category === 'Invoice') && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    if (parsed.items) {
                        setPurchasingItems(Array.isArray(parsed.items) ? parsed.items : []);
                        setInvoiceData({
                            bankName: parsed.bankInfo?.bankName || '',
                            bankAccountName: parsed.bankInfo?.bankAccountName || '',
                            bankAccountNumber: parsed.bankInfo?.bankAccountNumber || '',
                            dueDate: parsed.dueDate || formatDate(new Date(), 'input'),
                            notes: parsed.notes || '',
                            paymentStatus: parsed.paymentStatus || 'UNPAID'
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
                    setTaskData({
                        basisList: Array.isArray(parsed.basisList) ? parsed.basisList : (parsed.basis ? [parsed.basis] : ['']),
                        personnelList: Array.isArray(parsed.personnelList) ? parsed.personnelList : (parsed.personnel ? [{ name: parsed.personnel, position: '', nip: '' }] : [{ name: '', position: '', nip: '' }]),
                        purposeList: Array.isArray(parsed.purposeList) ? parsed.purposeList : (parsed.purpose ? [parsed.purpose] : ['']),
                        dateStart: parsed.dateStart || (parsed.date ? formatDate(parsed.date, 'input') : formatDate(new Date(), 'input')),
                        dateEnd: parsed.dateEnd || parsed.dateStart || formatDate(new Date(), 'input'),
                        timeRange: parsed.timeRange || '08.00 s.d Selesai',
                        location: parsed.location || '',
                        carbonCopy: Array.isArray(parsed.carbonCopy) ? parsed.carbonCopy : ['']
                    });
                } catch (e) {
                    console.error('Failed to parse Task content JSON', e);
                }
            }
            if (doc.category === 'Edaran' && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    let pts = Array.isArray(parsed.points) ? parsed.points : [];
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
                    const parsed = JSON.parse(doc.content);
                    setKeputusanData(prev => ({
                        ...prev,
                        ...parsed,
                        menimbang: Array.isArray(parsed.menimbang) ? parsed.menimbang : (prev.menimbang || ['']),
                        mengingat: Array.isArray(parsed.mengingat) ? parsed.mengingat : (prev.mengingat || ['']),
                        menetapkan: Array.isArray(parsed.menetapkan) ? parsed.menetapkan : (prev.menetapkan || []),
                        tembusan: Array.isArray(parsed.tembusan) ? parsed.tembusan : (prev.tembusan || [])
                    }));
                } catch (e) {
                    console.error('Failed to parse Keputusan content JSON', e);
                }
            }
            if (doc.category === 'Pemberitahuan' && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    setPemberitahuanData(prev => ({
                        ...prev,
                        ...parsed,
                        points: Array.isArray(parsed.points) ? parsed.points : (prev.points || [''])
                    }));
                } catch (e) {
                    console.error('Failed to parse Pemberitahuan content JSON', e);
                }
            }
            if (doc.category === 'Umum' && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    setUmumData({
                        subCategory: parsed.subCategory || '',
                        body: parsed.body || ''
                    });
                } catch (e) {
                    console.error('Failed to parse Umum content JSON', e);
                }
            }
            if (doc.category === 'Lainnya' && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    setLainnyaData({
                        title: parsed.title || '',
                        body: parsed.body || ''
                    });
                } catch (e) {
                    console.error('Failed to parse Lainnya content JSON', e);
                }
            }
            if (doc.category === 'Berita Acara Kunjungan' && doc.content) {
                try {
                    const parsed = JSON.parse(doc.content);
                    setKunjunganData({
                        date: parsed.date || formatDate(new Date(), 'input'),
                        purpose: parsed.purpose || '',
                        locationName: parsed.locationName || '',
                        locationAddress: parsed.locationAddress || '',
                        activities: Array.isArray(parsed.activities) ? parsed.activities : (parsed.activities ? [parsed.activities] : ['']),
                        results: Array.isArray(parsed.results) ? parsed.results : (parsed.results ? [{ title: 'Hasil', items: [parsed.results] }] : [{ title: '', items: [''] }])
                    });
                } catch (e) {
                    console.error('Failed to parse Berita Acara Kunjungan content JSON', e);
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
                location: '',
            });
            setBastItems([{ name: '', qty: '', condition: 'Baik' }]);
            setPurchasingItems([{ name: '', spec: '', qty: '', unit: 'Pcs', price: '', total: 0 }]);
            setDeadline('');
            setOrderStatus('PENDING');
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
            setKunjunganData({
                date: formatDate(new Date(), 'input'),
                purpose: '',
                locationName: '',
                locationAddress: '',
                activities: [''],
                results: [{ title: '', items: [''] }]
            });
        }
    }, [doc, defaultType, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let payload;
            let config = {};

            let contentObj = {};
            if (formData.type === 'BAST' || (formData.type === 'SURAT_KELUAR' && ['Serah Terima Barang', 'BAST'].includes(formData.category))) {
                contentObj = { items: bastItems, location: formData.location };
            } else if (formData.category === 'Pesanan') {
                contentObj = { items: purchasingItems, priceDetermined, deadline, orderStatus };
            } else if (formData.type === 'INVOICE' || formData.category === 'Invoice') {
                contentObj = { items: purchasingItems, bankInfo: invoiceData, dueDate: invoiceData.dueDate, notes: invoiceData.notes, paymentStatus: invoiceData.paymentStatus };
            } else if (formData.type === 'SURAT_KELUAR' && formData.category === 'Tugas') {
                contentObj = { ...taskData };
            } else if (formData.category === 'Edaran') {
                contentObj = { ...edaranData };
            } else if (formData.category === 'Keputusan') {
                contentObj = { ...keputusanData };
            } else if (formData.category === 'Pemberitahuan') {
                contentObj = { ...pemberitahuanData };
            } else if (formData.category === 'Umum') {
                contentObj = { ...umumData };
            } else if (formData.category === 'Lainnya') {
                contentObj = { ...lainnyaData };
            } else if (formData.category === 'Berita Acara Kunjungan') {
                contentObj = { ...kunjunganData };
            } else {
                // Default for plain letters
                contentObj = { text: formData.content };
            }

            contentObj.recipientsData = recipientsData;
            contentObj.lampiranText = lampiranText;
            const contentJson = JSON.stringify(contentObj);

            // Always use FormData since all backend routes use handleBulkUpload (multer) middleware
            payload = new FormData();
            for (const key in formData) {
                if (formData[key] !== null && formData[key] !== undefined) {
                    payload.append(key, formData[key]);
                }
            }
            payload.set('content', contentJson);
            if (files.length > 0) {
                files.forEach(f => payload.append('files', f));
            }
            config = { headers: { 'Content-Type': 'multipart/form-data' } };

            if (doc && doc.id) {
                await api.put(`/office-documents/${doc.id}`, payload, config);
            } else {
                const endpoint = formData.type === 'SURAT_MASUK' ? '/office-documents/incoming' : '/office-documents/outgoing';
                await api.post(endpoint, payload, config);
            }
            onSuccess();
            onClose();

            if (!doc || !doc.id) {
                if (formData.type === 'SURAT_MASUK') {
                    navigate('/e-office/surat-masuk');
                } else if (formData.type === 'INVOICE') {
                    navigate('/e-office/invoice');
                } else if (formData.type === 'LAINNYA') {
                    if (['SOP', 'Peraturan', 'Surat Edaran'].includes(formData.category)) {
                        navigate('/e-office/manajemen-dokumen');
                    } else {
                        navigate('/e-office/lainnya');
                    }
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
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

                    <div className="p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 overflow-y-auto flex-1">
                        {formData.type === 'SURAT_KELUAR' && (
                            <div className="col-span-full space-y-4 mb-2">
                                <div className="bg-violet-50 p-4 rounded-2xl border border-violet-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-violet-600 text-white rounded-lg">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-slate-900">Gunakan Microsoft Word (Manual)?</div>
                                            <div className="text-[10px] text-violet-600 font-bold uppercase tracking-wider">Aktifkan jika surat disusun manual di Word</div>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.isManual}
                                            onChange={(e) => setFormData({ ...formData, isManual: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                                    </label>
                                </div>

                                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                                    <label className="text-xs font-black text-blue-600 uppercase tracking-widest mb-3 block">1. Pilih Kategori Surat Keluar</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {['Tugas', 'Keputusan', 'Pemberitahuan', 'BAST', 'Pesanan', 'Edaran', 'Umum', 'Berita Acara Kunjungan', 'Lainnya'].map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, category: c })}
                                            className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all text-center ${formData.category === c
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'
                                                }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {formData.type === 'LAINNYA' && (['SOP', 'Peraturan', 'Surat Edaran'].includes(formData.category) || formData._isManagement) && (
                            <div className="col-span-full bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mb-2">
                                <label className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 block">1. Pilih Kategori Dokumen Internal</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {['SOP', 'Peraturan', 'Surat Edaran', 'Lainnya'].map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, category: c })}
                                            className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all text-center ${formData.category === c
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'
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

                        {!formData.isManual && formData.category === 'Umum' && (
                            <div className="col-span-full animate-in slide-in-from-left duration-300">
                                <label className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2 block">Jenis Surat (Header)</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/30 outline-none font-bold"
                                    value={umumData.subCategory}
                                    onChange={(e) => setUmumData({ ...umumData, subCategory: e.target.value.toUpperCase() })}
                                    placeholder="Contoh: SURAT KETERANGAN / SURAT PEMBERITAHUAN"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">* Teks ini akan menjadi judul di tengah surat</p>
                            </div>
                        )}

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

                        {formData.isManual && (
                            <div className="col-span-full p-8 bg-violet-50/30 rounded-2xl border border-dashed border-violet-200 text-center space-y-3">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                                    <FileText className="text-violet-500" size={24} />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Penyusunan Manual Aktif</h4>
                                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                                        Anda hanya perlu mengisi **Perihal** dan **Kategori** untuk mendapatkan nomor surat. 
                                        Setelah surat disetujui, Anda dapat mendownload QR Code TTE untuk ditempel di Word.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!formData.isManual && formData.category === 'Pesanan' && (
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
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Deadline Selesai</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold text-red-600"
                                        value={deadline}
                                        onChange={(e) => setDeadline(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Status Pesanan</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold text-slate-800"
                                        value={orderStatus}
                                        onChange={(e) => setOrderStatus(e.target.value)}
                                    >
                                        <option value="PENDING">PENDING (Menunggu)</option>
                                        <option value="PROCESSING">PROCESSING (Dalam Proses)</option>
                                        <option value="COMPLETED">COMPLETED (Selesai)</option>
                                        <option value="CANCELLED">CANCELLED (Batal)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {!formData.isManual && formData.type === 'INVOICE' && (
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
                            </div>
                        )}

                        {!formData.isManual && formData.type === 'SURAT_KELUAR' && !['Pesanan', 'BAST', 'Berita Acara', 'Serah Terima Barang', 'Berita Acara Kunjungan', 'Tugas', 'Keputusan', 'Pemberitahuan'].includes(formData.category) && (
                            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                <label className="col-span-full text-xs font-black text-slate-600 uppercase tracking-widest block mb-2">3. Tujuan / Penerima Surat</label>

                                <div className="col-span-full mb-2">
                                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-all">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500"
                                            checked={recipientsData.isMultiple}
                                            onChange={(e) => setRecipientsData({ ...recipientsData, isMultiple: e.target.checked })}
                                        />
                                        <div>
                                            <div className="text-sm font-black text-slate-900">Banyak Tujuan / Surat Massal?</div>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Aktifkan untuk mengirim ke lebih dari satu penerima</div>
                                        </div>
                                    </label>
                                </div>

                                {recipientsData.isMultiple ? (
                                    <div className="col-span-full space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                                            <div>
                                                <div className="text-xs font-black text-blue-700 uppercase tracking-widest mb-1">Pilih Mode Penerima</div>
                                                <div className="text-[10px] text-blue-600/70 font-medium">Massal akan membuat 1 halaman per orang</div>
                                            </div>
                                            <div className="flex bg-white rounded-lg p-1 border border-blue-200">
                                                <button
                                                    type="button"
                                                    onClick={() => setRecipientsData({ ...recipientsData, mode: 'LIST' })}
                                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${recipientsData.mode === 'LIST' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    Daftar (List)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRecipientsData({ ...recipientsData, mode: 'MASSAL' })}
                                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${recipientsData.mode === 'MASSAL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    Massal (Merge)
                                                </button>
                                            </div>
                                        </div>

                                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                            <table className="w-full text-left border-collapse text-[11px]">
                                                <thead className="bg-slate-50 font-black text-slate-600 uppercase tracking-tighter">
                                                    <tr>
                                                        <th className="p-3 border-b border-slate-200">Nama Penerima</th>
                                                        <th className="p-3 border-b border-slate-200">Jabatan / Unit</th>
                                                        <th className="p-3 border-b border-slate-200">Alamat / Di Tempat</th>
                                                        <th className="p-3 border-b border-slate-200 w-10 text-center"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(recipientsData.list || []).map((r, idx) => (
                                                        <tr key={idx}>
                                                            <td className="p-2 border-b border-slate-100">
                                                                <input required value={r.name} onChange={(e) => { const newList = [...recipientsData.list]; newList[idx].name = e.target.value; setRecipientsData({ ...recipientsData, list: newList }); }} className="w-full px-2 py-1.5 rounded border border-slate-200 outline-none font-bold" placeholder="Nama..." />
                                                            </td>
                                                            <td className="p-2 border-b border-slate-100">
                                                                <input value={r.title} onChange={(e) => { const newList = [...recipientsData.list]; newList[idx].title = e.target.value; setRecipientsData({ ...recipientsData, list: newList }); }} className="w-full px-2 py-1.5 rounded border border-slate-200 outline-none" placeholder="Jabatan..." />
                                                            </td>
                                                            <td className="p-2 border-b border-slate-100">
                                                                <input value={r.address} onChange={(e) => { const newList = [...recipientsData.list]; newList[idx].address = e.target.value; setRecipientsData({ ...recipientsData, list: newList }); }} className="w-full px-2 py-1.5 rounded border border-slate-200 outline-none" placeholder="Alamat..." />
                                                            </td>
                                                            <td className="p-2 border-b border-slate-100 text-center">
                                                                <button type="button" onClick={() => { if (recipientsData.list.length > 1) { const newList = recipientsData.list.filter((_, i) => i !== idx); setRecipientsData({ ...recipientsData, list: newList }); } }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <button
                                                type="button"
                                                onClick={() => setRecipientsData({ ...recipientsData, list: [...recipientsData.list, { name: '', title: '', address: '' }] })}
                                                className="w-full py-3 bg-slate-50 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus size={14} /> Tambah Penerima Lain
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Kepada Yth (Jabatan / Nama)</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                                value={formData.party2Name}
                                                onChange={(e) => setFormData({ ...formData, party2Name: e.target.value })}
                                                placeholder="Contoh: Seluruh Staff Sarpras"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Jabatan / Instansi</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                                value={formData.party2Title}
                                                onChange={(e) => setFormData({ ...formData, party2Title: e.target.value })}
                                                placeholder="Contoh: Staff Sarpras"
                                            />
                                        </div>
                                        <div className="col-span-full">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Alamat / Di Tempat</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                                                value={formData.party2Address}
                                                onChange={(e) => setFormData({ ...formData, party2Address: e.target.value })}
                                                placeholder="Contoh: Di Tempat"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {(['BAST', 'MOU'].includes(formData.type) || ['Berita Acara', 'Serah Terima Barang', 'BAST'].includes(formData.category)) && (
                            <div className="col-span-full">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Daftar Barang Serah Terima</label>
                                    <button type="button" onClick={() => setBastItems([...bastItems, { name: '', spec: '', qty: '', condition: 'Baik' }])} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700">
                                        <Plus size={14} /> Tambah Barang
                                    </button>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                                            <tr>
                                                <th className="p-3 border-b border-slate-200">Jenis Barang</th>
                                                <th className="p-3 border-b border-slate-200">Spesifikasi/SN</th>
                                                <th className="p-3 border-b border-slate-200 w-24">Kuantitas</th>
                                                <th className="p-3 border-b border-slate-200 w-40">Kondisi</th>
                                                <th className="p-3 border-b border-slate-200 w-16 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(bastItems || []).map((item, index) => (
                                                <tr key={index}>
                                                    <td className="p-2 border-b border-slate-100">
                                                        <input required value={item.name} onChange={(e) => { const newI = [...bastItems]; newI[index].name = e.target.value; setBastItems(newI); }} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none" placeholder="Nama barang..." />
                                                    </td>
                                                    <td className="p-2 border-b border-slate-100">
                                                        <input value={item.spec || ''} onChange={(e) => { const newI = [...bastItems]; newI[index].spec = e.target.value; setBastItems(newI); }} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none" placeholder="Spesifikasi/SN..." />
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
                                    <div className="flex items-center gap-4">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Daftar Barang / Jasa</label>
                                        {formData.category === 'Pesanan' && (
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <div className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={priceDetermined}
                                                        onChange={(e) => setPriceDetermined(e.target.checked)}
                                                    />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tentukan Harga</span>
                                            </label>
                                        )}
                                    </div>
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
                                                {(priceDetermined || formData.type === 'INVOICE') && (
                                                    <>
                                                        <th className="p-3 border-b border-slate-200 w-32">Harga Satuan</th>
                                                        <th className="p-3 border-b border-slate-200 w-32">Total</th>
                                                    </>
                                                )}
                                                <th className="p-3 border-b border-slate-200 w-10 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(purchasingItems || []).map((item, index) => (
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
                                                    {(priceDetermined || formData.type === 'INVOICE') && (
                                                        <>
                                                            <td className="p-2 border-b border-slate-100">
                                                                <input type="number" value={item.price} onChange={(e) => {
                                                                    const newI = [...purchasingItems];
                                                                    newI[index].price = e.target.value;
                                                                    newI[index].total = (parseFloat(newI[index].qty) || 0) * (parseFloat(e.target.value) || 0);
                                                                    setPurchasingItems(newI);
                                                                }} className="w-full px-2 py-1.5 rounded border border-slate-200 outline-none font-bold" placeholder="0" />
                                                            </td>
                                                            <td className="p-2 border-b border-slate-100 font-black text-blue-700">
                                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.total || 0)}
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="p-2 border-b border-slate-100 text-center">
                                                        <button type="button" onClick={() => setPurchasingItems(purchasingItems.filter((_, i) => i !== index))} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(priceDetermined || formData.type === 'INVOICE') && (
                                                <tr className="bg-slate-50 font-black">
                                                    <td colSpan={formData.type === 'INVOICE' || priceDetermined ? 4 : 3} className="p-3 text-right text-slate-500 uppercase tracking-widest text-[10px]">Total Keseluruhan</td>
                                                    <td className="p-3 text-blue-800 text-sm">
                                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format((purchasingItems || []).reduce((acc, curr) => acc + (curr.total || 0), 0))}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            )}
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
                                                onChange={(e) => setFormData({ ...formData, party2Name: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Tempat</label>
                                            <input
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                                                placeholder="Contoh: Di Padang / Tempat"
                                                value={formData.party2Address}
                                                onChange={(e) => setFormData({ ...formData, party2Address: e.target.value })}
                                            />
                                        </div>
                                        <div className="pt-4 border-t border-slate-100">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">1. Latar Belakang</label>
                                            <textarea
                                                rows={4}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm leading-relaxed"
                                                placeholder="Tuliskan alasan/latar belakang surat edaran ini..."
                                                value={edaranData.background}
                                                onChange={(e) => setEdaranData({ ...edaranData, background: e.target.value })}
                                            />
                                        </div>
                                        <div className="pt-4 border-t border-slate-100">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">2. Ketentuan / Isi Edaran</label>
                                                <button type="button" onClick={() => setEdaranData({ ...edaranData, points: [...edaranData.points, { text: '', subs: [''] }] })} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                                    <Plus size={12} /> Tambah Poin
                                                </button>
                                            </div>
                                            <div className="space-y-4">
                                                {(edaranData.points || []).map((point, idx) => (
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
                                                                    setEdaranData({ ...edaranData, points: newPoints });
                                                                }}
                                                            />
                                                            {edaranData.points.length > 1 && (
                                                                <button type="button" onClick={() => setEdaranData({ ...edaranData, points: edaranData.points.filter((_, i) => i !== idx) })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
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
                                                                    setEdaranData({ ...edaranData, points: newPoints });
                                                                }} className="text-[9px] font-bold text-blue-500 flex items-center gap-0.5">
                                                                    <Plus size={10} /> Sub
                                                                </button>
                                                            </div>
                                                            {(point.subs || []).map((sub, sIdx) => (
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
                                                                            setEdaranData({ ...edaranData, points: newPoints });
                                                                        }}
                                                                    />
                                                                    {(point.subs || []).length > 1 && (
                                                                        <button type="button" onClick={() => {
                                                                            const newPoints = [...edaranData.points];
                                                                            newPoints[idx] = { ...newPoints[idx], subs: newPoints[idx].subs.filter((_, i) => i !== sIdx) };
                                                                            setEdaranData({ ...edaranData, points: newPoints });
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

                        {!formData.isManual && formData.category === 'Keputusan' && (
                            <div className="col-span-full space-y-6 bg-amber-50/30 p-6 rounded-2xl border border-amber-100">
                                <label className="text-xs font-black text-amber-700 uppercase tracking-widest block mb-2">3. Struktur Surat Keputusan</label>

                                {/* Menimbang */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Menimbang (Alasan)</label>
                                        <button type="button" onClick={() => setKeputusanData({ ...keputusanData, menimbang: [...keputusanData.menimbang, ''] })} className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase">
                                            <Plus size={12} /> Tambah
                                        </button>
                                    </div>
                                    {(keputusanData.menimbang || []).map((item, idx) => (
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
                                                    setKeputusanData({ ...keputusanData, menimbang: newList });
                                                }}
                                            />
                                            {keputusanData.menimbang.length > 1 && (
                                                <button type="button" onClick={() => setKeputusanData({ ...keputusanData, menimbang: keputusanData.menimbang.filter((_, i) => i !== idx) })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
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
                                        <button type="button" onClick={() => setKeputusanData({ ...keputusanData, mengingat: [...keputusanData.mengingat, ''] })} className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase">
                                            <Plus size={12} /> Tambah
                                        </button>
                                    </div>
                                    {(keputusanData.mengingat || []).map((item, idx) => (
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
                                                    setKeputusanData({ ...keputusanData, mengingat: newList });
                                                }}
                                            />
                                            {keputusanData.mengingat.length > 1 && (
                                                <button type="button" onClick={() => setKeputusanData({ ...keputusanData, mengingat: keputusanData.mengingat.filter((_, i) => i !== idx) })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
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
                                            setKeputusanData({ ...keputusanData, menetapkan: [...keputusanData.menetapkan, { label: nextLabel, text: '', subs: [] }] });
                                        }} className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase">
                                            <Plus size={12} /> Tambah Diktum
                                        </button>
                                    </div>
                                    {(keputusanData.menetapkan || []).map((item, idx) => (
                                        <div key={idx} className="bg-white/50 rounded-xl p-3 border border-amber-50 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <input
                                                    className="bg-transparent border-none outline-none text-[10px] font-black text-amber-600 uppercase tracking-widest w-24"
                                                    value={item.label}
                                                    onChange={(e) => {
                                                        const newList = [...keputusanData.menetapkan];
                                                        newList[idx].label = e.target.value;
                                                        setKeputusanData({ ...keputusanData, menetapkan: newList });
                                                    }}
                                                />
                                                {keputusanData.menetapkan.length > 1 && (
                                                    <button type="button" onClick={() => setKeputusanData({ ...keputusanData, menetapkan: keputusanData.menetapkan.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600">
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
                                                    setKeputusanData({ ...keputusanData, menetapkan: newList });
                                                }}
                                            />
                                            {/* Sub-dictums */}
                                            <div className="ml-6 space-y-2 pt-2 border-t border-slate-100">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sub-Diktum</span>
                                                    <button type="button" onClick={() => {
                                                        const newList = [...keputusanData.menetapkan];
                                                        newList[idx].subs = [...(newList[idx].subs || []), ''];
                                                        setKeputusanData({ ...keputusanData, menetapkan: newList });
                                                    }} className="text-[9px] font-bold text-blue-500 flex items-center gap-0.5">
                                                        <Plus size={10} /> Sub
                                                    </button>
                                                </div>
                                                {(item.subs || []).map((sub, sIdx) => (
                                                    <div key={sIdx} className="flex gap-2">
                                                        <div className="w-6 h-6 rounded bg-slate-50 flex items-center justify-center text-[9px] font-bold text-slate-400 shrink-0">{String.fromCharCode(97 + sIdx)}</div>
                                                        <input
                                                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-100 outline-none text-xs"
                                                            placeholder={`Sub-diktum ${String.fromCharCode(97 + sIdx)}...`}
                                                            value={sub}
                                                            onChange={(e) => {
                                                                const newList = [...keputusanData.menetapkan];
                                                                const newSubs = [...(newList[idx].subs || [])];
                                                                newSubs[sIdx] = e.target.value;
                                                                newList[idx].subs = newSubs;
                                                                setKeputusanData({ ...keputusanData, menetapkan: newList });
                                                            }}
                                                        />
                                                        <button type="button" onClick={() => {
                                                            const newList = [...keputusanData.menetapkan];
                                                            newList[idx].subs = newList[idx].subs.filter((_, i) => i !== sIdx);
                                                            setKeputusanData({ ...keputusanData, menetapkan: newList });
                                                        }} className="p-1 text-red-400 hover:bg-red-50 rounded shrink-0">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Tembusan */}
                                <div className="space-y-3 pt-4 border-t border-amber-100/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tembusan</label>
                                        <button type="button" onClick={() => setKeputusanData({ ...keputusanData, tembusan: [...keputusanData.tembusan, ''] })} className="text-[10px] font-black text-blue-600 flex items-center gap-1 uppercase">
                                            <Plus size={12} /> Tambah
                                        </button>
                                    </div>
                                    {(keputusanData.tembusan || []).map((item, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input
                                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                placeholder="Contoh: Ketua Yayasan..."
                                                value={item}
                                                onChange={(e) => {
                                                    const newList = [...keputusanData.tembusan];
                                                    newList[idx] = e.target.value;
                                                    setKeputusanData({ ...keputusanData, tembusan: newList });
                                                }}
                                            />
                                            {keputusanData.tembusan.length > 1 && (
                                                <button type="button" onClick={() => setKeputusanData({ ...keputusanData, tembusan: keputusanData.tembusan.filter((_, i) => i !== idx) })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!formData.isManual && formData.category === 'Pemberitahuan' && (
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
                                            onChange={(e) => setFormData({ ...formData, party2Name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Tempat</label>
                                        <input
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                                            placeholder="di Tempat"
                                            value={formData.party2Address}
                                            onChange={(e) => setFormData({ ...formData, party2Address: e.target.value })}
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
                                        onChange={(e) => setPemberitahuanData({ ...pemberitahuanData, pembukaan: e.target.value })}
                                    />
                                </div>

                                {/* Poin-poin */}
                                <div className="pt-4 border-t border-green-100/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Poin-poin Penting</label>
                                        <button type="button" onClick={() => setPemberitahuanData({ ...pemberitahuanData, points: [...(pemberitahuanData.points || []), ''] })} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                            <Plus size={12} /> Tambah Poin
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {(pemberitahuanData.points || []).map((point, idx) => (
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
                                                        setPemberitahuanData({ ...pemberitahuanData, points: newPoints });
                                                    }}
                                                />
                                                {pemberitahuanData.points.length > 1 && (
                                                    <button type="button" onClick={() => setPemberitahuanData({ ...pemberitahuanData, points: pemberitahuanData.points.filter((_, i) => i !== idx) })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
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
                                        onChange={(e) => setPemberitahuanData({ ...pemberitahuanData, penutup: e.target.value })}
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
                                        <button type="button" onClick={() => setTaskData({ ...taskData, basisList: [...taskData.basisList, ''] })} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                            <Plus size={12} /> Tambah Dasar
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {(taskData.basisList || []).map((item, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input
                                                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
                                                    placeholder={`Dasar hukum/surat ${idx + 1}...`}
                                                    value={item}
                                                    onChange={(e) => {
                                                        const newList = [...taskData.basisList];
                                                        newList[idx] = e.target.value;
                                                        setTaskData({ ...taskData, basisList: newList });
                                                    }}
                                                />
                                                {taskData.basisList.length > 1 && (
                                                    <button type="button" onClick={() => setTaskData({ ...taskData, basisList: taskData.basisList.filter((_, i) => i !== idx) })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
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
                                        <button type="button" onClick={() => setTaskData({ ...taskData, personnelList: [...taskData.personnelList, { name: '', position: '', nip: '' }] })} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
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
                                                {(taskData.personnelList || []).map((p, idx) => (
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
                                                                        setTaskData({ ...taskData, personnelList: nl });
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
                                                            <input className="w-full px-2 py-1.5 border-none outline-none focus:bg-blue-50 rounded text-slate-500" placeholder="Jabatan..." value={p.position} onChange={(e) => { const nl = [...taskData.personnelList]; nl[idx].position = e.target.value; setTaskData({ ...taskData, personnelList: nl }); }} />
                                                        </td>
                                                        <td className="px-2 py-1 border-b">
                                                            <input className="w-full px-2 py-1.5 border-none outline-none focus:bg-blue-50 rounded text-slate-500" placeholder="NIY..." value={p.nip} onChange={(e) => { const nl = [...taskData.personnelList]; nl[idx].nip = e.target.value; setTaskData({ ...taskData, personnelList: nl }); }} />
                                                        </td>
                                                        <td className="px-2 py-1 border-b text-center">
                                                            {taskData.personnelList.length > 1 && (
                                                                <button type="button" onClick={() => setTaskData({ ...taskData, personnelList: taskData.personnelList.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600"><X size={14} /></button>
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
                                        <button type="button" onClick={() => setTaskData({ ...taskData, purposeList: [...taskData.purposeList, ''] })} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
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
                                                        setTaskData({ ...taskData, purposeList: newList });
                                                    }}
                                                />
                                                {taskData.purposeList.length > 1 && (
                                                    <button type="button" onClick={() => setTaskData({ ...taskData, purposeList: taskData.purposeList.filter((_, i) => i !== idx) })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
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
                                        <input type="date" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm" value={taskData.dateStart} onChange={(e) => setTaskData({ ...taskData, dateStart: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tgl. Selesai</label>
                                        <input type="date" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm" value={taskData.dateEnd} onChange={(e) => setTaskData({ ...taskData, dateEnd: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Keterangan Waktu</label>
                                        <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm" placeholder="Contoh: 08.00 s.d Selesai" value={taskData.timeRange} onChange={(e) => setTaskData({ ...taskData, timeRange: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tempat / Lokasi</label>
                                        <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm" placeholder="Lokasi penugasan..." value={taskData.location} onChange={(e) => setTaskData({ ...taskData, location: e.target.value })} />
                                    </div>
                                </div>

                                {/* 5. Tembusan */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Tembusan (Opsional)</label>
                                        <button type="button" onClick={() => setTaskData({ ...taskData, carbonCopy: [...taskData.carbonCopy, ''] })} className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
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
                                                        setTaskData({ ...taskData, carbonCopy: newList });
                                                    }}
                                                />
                                                {taskData.carbonCopy.length > 1 && (
                                                    <button type="button" onClick={() => setTaskData({ ...taskData, carbonCopy: taskData.carbonCopy.filter((_, i) => i !== idx) })} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
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
                                    multiple
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => setFiles(Array.from(e.target.files))}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    required={!doc?.fileUrl}
                                />
                                <div className="mt-3 flex flex-wrap gap-4">
                                    {files.filter(f => f.type.startsWith('image/')).map((f, idx) => (
                                        <div key={idx} className="relative inline-block rounded-xl overflow-hidden border border-slate-200">
                                            <img src={URL.createObjectURL(f)} alt="Preview" className="h-40 object-contain bg-slate-50 rounded-xl" />
                                        </div>
                                    ))}
                                    {files.length === 0 && formData.fileUrl && formData.fileUrl.split(',').filter(u => u.trim() !== '' && u.match(/\.(jpeg|jpg|gif|png|webp)$/i)).map((u, idx) => (
                                        <div key={`existing-${idx}`} className="relative inline-block rounded-xl overflow-hidden border border-slate-200">
                                            <img src={u} alt="Preview" className="h-40 object-contain bg-slate-50 rounded-xl" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {formData.type !== 'SURAT_MASUK' && !['Berita Acara', 'Serah Terima Barang', 'BAST', 'Pesanan', 'Tugas', 'Edaran', 'Keputusan', 'Pemberitahuan', 'Umum', 'Berita Acara Kunjungan', 'Lainnya'].includes(formData.category) && !['BAST', 'MOU'].includes(formData.type) && (
                            <div className="col-span-full">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Isi Dokumen / Pesan (Opsional)</label>
                                <textarea
                                    rows={6}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-medium leading-relaxed"
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder={formData.type === 'INVOICE' ? 'Opsional: catatan tambahan untuk invoice...' : 'Opsional: Tuliskan isi surat atau keterangan tambahan di sini...'}
                                />
                            </div>
                        )}

                        {formData.category === 'Lainnya' && (
                            <div className="col-span-full animate-in zoom-in duration-300 space-y-6">
                                <div className="bg-violet-50/50 p-6 rounded-2xl border border-violet-100">
                                    <label className="text-xs font-black text-violet-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-violet-600"></div>
                                        3. Nomor Surat & Instruksi
                                    </label>
                                    <div className="bg-white p-4 rounded-xl border border-violet-200 mb-4">
                                        <p className="text-sm font-bold text-slate-700 mb-1">Nomor Surat Anda:</p>
                                        {formData.number ? (
                                            <div className="text-lg font-black text-violet-700 tracking-wider font-mono bg-violet-50 p-3 rounded-lg inline-block border border-violet-100">
                                                {formData.number}
                                            </div>
                                        ) : (
                                            <div className="text-sm font-medium text-amber-600 bg-amber-50 p-3 rounded-lg inline-block border border-amber-100">
                                                (Nomor akan muncul setelah Anda menekan tombol "Simpan Draft" di bawah)
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2 text-sm font-medium text-slate-600">
                                        <p className="font-bold text-violet-700">Langkah-langkah:</p>
                                        <ol className="list-decimal pl-5 space-y-1">
                                            <li>Simpan dokumen ini sebagai <span className="font-bold">Draft</span> untuk mendapatkan Nomor Surat.</li>
                                            <li>Ketik dokumen final Anda di Microsoft Word, dan masukkan Nomor Surat di atas ke dalam dokumen Anda.</li>
                                            <li>Ajukan dokumen ini ke Kabid. Setelah disetujui, Anda dapat <span className="font-bold">Mengunduh QR Code TTE</span>.</li>
                                            <li>Tempelkan gambar QR Code TTE tersebut ke dalam file Word Anda.</li>
                                            <li>Simpan file Word Anda sebagai PDF, lalu <span className="font-bold">Unggah PDF Final</span> tersebut ke sistem ini melalui form upload di bawah ini.</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        )}

                        {formData.category === 'Berita Acara Kunjungan' && (
                            <div className="col-span-full animate-in zoom-in duration-300 space-y-6">
                                <label className="text-xs font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                                    3. Rincian Kunjungan
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Tanggal Kunjungan</label>
                                        <input
                                            type="date"
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                                            value={kunjunganData.date}
                                            onChange={(e) => setKunjunganData({ ...kunjunganData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Tujuan Kunjungan</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                                            placeholder="Contoh: Survei Lokasi Pembangunan"
                                            value={kunjunganData.purpose}
                                            onChange={(e) => setKunjunganData({ ...kunjunganData, purpose: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Nama Tempat/Instansi</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                                            placeholder="Contoh: Proyek Gedung A"
                                            value={kunjunganData.locationName}
                                            onChange={(e) => setKunjunganData({ ...kunjunganData, locationName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Alamat Lengkap Lokasi</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold"
                                            placeholder="Contoh: Jl. Sudirman No. 12"
                                            value={kunjunganData.locationAddress}
                                            onChange={(e) => setKunjunganData({ ...kunjunganData, locationAddress: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">II. Uraian Kegiatan (Poin-poin)</label>
                                            <button 
                                                type="button" 
                                                onClick={() => setKunjunganData({ ...kunjunganData, activities: [...kunjunganData.activities, ''] })}
                                                className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline"
                                            >
                                                <Plus size={14} /> Tambah Poin
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            {kunjunganData.activities.map((act, idx) => (
                                                <div key={idx} className="flex gap-3">
                                                    <div className="w-8 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-400 shrink-0">{idx + 1}</div>
                                                    <textarea
                                                        rows={2}
                                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-medium leading-relaxed focus:border-blue-400 transition-all"
                                                        placeholder={`Tuliskan kegiatan ke-${idx + 1}...`}
                                                        value={act}
                                                        onChange={(e) => {
                                                            const newAct = [...kunjunganData.activities];
                                                            newAct[idx] = e.target.value;
                                                            setKunjunganData({ ...kunjunganData, activities: newAct });
                                                        }}
                                                        required
                                                    />
                                                    <button 
                                                        type="button" 
                                                        disabled={kunjunganData.activities.length === 1}
                                                        onClick={() => {
                                                            const newAct = kunjunganData.activities.filter((_, i) => i !== idx);
                                                            setKunjunganData({ ...kunjunganData, activities: newAct });
                                                        }}
                                                        className="p-2 text-red-400 hover:bg-red-50 rounded-xl h-10 flex items-center justify-center shrink-0 disabled:opacity-0"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">III. Hasil & Catatan Kunjungan (Kategori & Poin)</label>
                                            <button 
                                                type="button" 
                                                onClick={() => setKunjunganData({ ...kunjunganData, results: [...kunjunganData.results, { title: '', items: [''] }] })}
                                                className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline"
                                            >
                                                <Plus size={14} /> Tambah Judul Item
                                            </button>
                                        </div>
                                        <div className="space-y-6">
                                            {kunjunganData.results.map((res, resIdx) => (
                                                <div key={resIdx} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                                                    <div className="flex gap-4">
                                                        <div className="flex-1">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Judul Item / Kategori Hasil</label>
                                                            <input
                                                                type="text"
                                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-bold bg-slate-50/50"
                                                                placeholder="Misal: Kondisi Bangunan, Kelengkapan Dokumen..."
                                                                value={res.title}
                                                                onChange={(e) => {
                                                                    const newRes = [...kunjunganData.results];
                                                                    newRes[resIdx].title = e.target.value;
                                                                    setKunjunganData({ ...kunjunganData, results: newRes });
                                                                }}
                                                                required
                                                            />
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            disabled={kunjunganData.results.length === 1}
                                                            onClick={() => {
                                                                const newRes = kunjunganData.results.filter((_, i) => i !== resIdx);
                                                                setKunjunganData({ ...kunjunganData, results: newRes });
                                                            }}
                                                            className="mt-5 p-2 text-red-400 hover:bg-red-50 rounded-xl h-10 disabled:opacity-0"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="pl-6 border-l-2 border-slate-100 space-y-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Sub Item / Catatan Detil</label>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => {
                                                                    const newRes = [...kunjunganData.results];
                                                                    newRes[resIdx].items.push('');
                                                                    setKunjunganData({ ...kunjunganData, results: newRes });
                                                                }}
                                                                className="text-[9px] font-bold text-emerald-600 flex items-center gap-1 hover:underline"
                                                            >
                                                                <Plus size={12} /> Tambah Sub Item
                                                            </button>
                                                        </div>
                                                        {res.items.map((item, itemIdx) => (
                                                            <div key={itemIdx} className="flex gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-4 shrink-0"></div>
                                                                <textarea
                                                                    rows={1}
                                                                    className="w-full px-3 py-2 rounded-lg border border-slate-100 outline-none text-sm font-medium focus:border-emerald-300 transition-all bg-slate-50/30"
                                                                    placeholder="Tuliskan catatan detail..."
                                                                    value={item}
                                                                    onChange={(e) => {
                                                                        const newRes = [...kunjunganData.results];
                                                                        newRes[resIdx].items[itemIdx] = e.target.value;
                                                                        setKunjunganData({ ...kunjunganData, results: newRes });
                                                                    }}
                                                                    required
                                                                />
                                                                <button 
                                                                    type="button" 
                                                                    disabled={res.items.length === 1}
                                                                    onClick={() => {
                                                                        const newRes = [...kunjunganData.results];
                                                                        newRes[resIdx].items = newRes[resIdx].items.filter((_, i) => i !== itemIdx);
                                                                        setKunjunganData({ ...kunjunganData, results: newRes });
                                                                    }}
                                                                    className="p-1.5 text-red-300 hover:text-red-500 disabled:opacity-0"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!formData.isManual && formData.category === 'Umum' && (
                            <div className="col-span-full animate-in zoom-in duration-300">
                                <label className="text-xs font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                                    3. Isi Inti Surat
                                </label>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 opacity-60">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Pembukaan (Otomatis):</div>
                                    <p className="text-[11px] font-medium text-slate-600 leading-relaxed italic">
                                        "Segala puji bagi Allah Subhaanahu wa ta'aala yang senantiasa melimpahkan nikmat dan hidayah-Nya kepada kita semua. Shalawat dan salam atas Nabi Muhammad Shalallaahu 'alaihi wa sallam. Kami mendo'akan semoga Bapak/Ibu selalu berada dalam lindungan Allah Subhaanahu wa ta'aala, Amin."
                                    </p>
                                </div>
                                <textarea
                                    rows={10}
                                    className="w-full px-5 py-4 rounded-2xl border-2 border-blue-100 focus:border-blue-500 focus:ring-0 outline-none font-medium leading-relaxed text-sm shadow-sm"
                                    value={umumData.body}
                                    onChange={(e) => setUmumData({ ...umumData, body: e.target.value })}
                                    placeholder="Opsional: Tuliskan inti surat di sini (tanpa perlu salam pembuka/penutup)..."
                                />
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4 opacity-60">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Penutup (Otomatis):</div>
                                    <p className="text-[11px] font-medium text-slate-600 leading-relaxed italic">
                                        "Demikianlah surat ini kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih. Jazakumullahu khairan."
                                    </p>
                                </div>
                            </div>
                        )}

                        {formData.type !== 'SURAT_MASUK' && (
                            <div className="col-span-full p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-300">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-4">
                                    {formData.category === 'Lainnya' ? '4. Upload File Final (Wajib untuk Lainnya, PDF)' : '4. Lampiran Dokumen (Opsional)'}
                                </label>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Teks Lampiran (Jika ada rincian tambahan)</label>
                                        <textarea
                                            rows={3}
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm font-medium"
                                            placeholder="Misal: Rincian jadwal kegiatan, Daftar peserta tambahan, dll..."
                                            value={lampiranText}
                                            onChange={(e) => setLampiranText(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Foto / Dokumen Pendukung (Format: JPG, PNG, PDF)</label>
                                            <div className="relative group">
                                                <input
                                                    type="file"
                                                    multiple
                                                    id="lampiran-file"
                                                    className="hidden"
                                                    accept="image/*,.pdf"
                                                    onChange={(e) => setFiles(Array.from(e.target.files))}
                                                />
                                                <label
                                                    htmlFor="lampiran-file"
                                                    className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                                                >
                                                    <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600">
                                                        <Paperclip size={18} />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-600 truncate max-w-[200px] sm:max-w-full">
                                                        {files.length > 0 ? `${files.length} file dipilih` : (formData.fileUrl ? 'File sudah ada (klik untuk ganti)' : 'Pilih file lampiran...')}
                                                    </span>
                                                </label>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-4">
                                                {files.filter(f => f.type.startsWith('image/')).map((f, idx) => (
                                                    <div key={idx} className="relative inline-block rounded-xl overflow-hidden border border-slate-200">
                                                        <img src={URL.createObjectURL(f)} alt="Preview Lampiran" className="h-40 object-contain bg-slate-50 rounded-xl" />
                                                    </div>
                                                ))}
                                                {files.length === 0 && formData.fileUrl && formData.fileUrl.split(',').filter(u => u.trim() !== '' && u.match(/\.(jpeg|jpg|gif|png|webp)$/i)).map((u, idx) => (
                                                    <div key={`existing-${idx}`} className="relative inline-block rounded-xl overflow-hidden border border-slate-200">
                                                        <img src={u} alt="Preview Lampiran" className="h-40 object-contain bg-slate-50 rounded-xl" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {(files.length > 0 || formData.fileUrl) && (
                                            <button
                                                type="button"
                                                onClick={() => { setFiles([]); setFormData({ ...formData, fileUrl: '' }); }}
                                                className="mt-5 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Hapus Lampiran"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        )}
                                    </div>
                                    {(files.length > 0 || formData.fileUrl) && (
                                        <p className="text-[10px] font-medium text-slate-400 italic">
                                            * Lampiran foto/dokumen akan ditampilkan pada halaman terpisah di akhir surat.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {(['BAST', 'MOU'].includes(formData.type) || (formData.type === 'SURAT_KELUAR' && ['Berita Acara', 'Serah Terima Barang', 'BAST'].includes(formData.category))) && (
                            <div className="col-span-full space-y-6 pt-4 border-t border-slate-100">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Lokasi / Tempat Serah Terima (Bertempat di)</label>
                                        <input
                                            placeholder="Contoh: Komplek Islamic Center, Surau Gadang..."
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 transition-all text-sm font-medium"
                                            value={formData.location || ''}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                        <input
                                            placeholder="Nama Perusahaan/Institusi Pihak 1"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                            value={formData.party1Org || ''}
                                            onChange={(e) => setFormData({ ...formData, party1Org: e.target.value })}
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
                                        <input
                                            placeholder="Nama Perusahaan/Institusi Pihak 2"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                                            value={formData.party2Org || ''}
                                            onChange={(e) => setFormData({ ...formData, party2Org: e.target.value })}
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
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-all">
                            Batal
                        </button>
                        <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
                            <Save size={18} /> {doc ? 'Simpan Perubahan' : 'Simpan Sebagai Draft'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SignatureModal = ({ signatureRequest, onClose, onSuccess }) => {
    const { doc, party } = signatureRequest || {};
    const [approvalNote, setApprovalNote] = useState('');

    if (!doc) return null;

    const handleSign = async (dataUrl = null) => {
        try {
            const signatureData = dataUrl;

            let res;
            if (party) {
                // Multi-party sign
                res = await api.post(`/office-documents/${doc.id}/sign-party`, {
                    party,
                    signatureData,
                    name: party === 'party1' ? doc.party1Name : doc.party2Name,
                    title: party === 'party1' ? doc.party1Title : doc.party2Title,
                    org: party === 'party1' ? doc.party1Org : doc.party2Org,
                    address: party === 'party1' ? doc.party1Address : doc.party2Address,
                });
            } else {
                // Kabid Approval sign
                res = await api.post(`/office-documents/${doc.id}/approve`, {
                    signatureData,
                    approvalNote
                });
            }

            alert('Dokumen berhasil ditandatangani!');
            onSuccess(res.data);
            onClose();
        } catch (err) {
            alert('Gagal tanda tangan: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
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
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
            id: 'MANAJEMEN_DOKUMEN', label: 'Manajemen Dokumen', icon: <Archive size={24} />,
            desc: 'SOP, Peraturan, Surat Edaran, dll', color: 'indigo'
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
