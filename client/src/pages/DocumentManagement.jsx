import React, { useState, useEffect, useRef } from 'react';
import { 
    FileText, FileSignature, Inbox, Send, Search, Plus, 
    Filter, MoreVertical, QrCode, CheckCircle2, Clock,
    FilePlus, PenTool, ExternalLink, X, Save, Mail
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/axios';
import { useReactToPrint } from 'react-to-print';
import QRCode from 'react-qr-code';
import SignatureCanvas from '../components/eoffice/SignatureCanvas';
import DocumentPrintView from '../components/eoffice/DocumentPrintView';
import IncomingMailTab from '../components/eoffice/IncomingMailTab';

const Badge = ({ children, className }) => (
    <span className={cn("px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5 w-fit shrink-0", className)}>
        {children}
    </span>
);

const DocumentManagement = () => {
    const navigate = useNavigate();
    const { tab } = useParams();
    const activeTab = tab ? tab.toUpperCase() : 'INBOX';
    
    const [searchQuery, setSearchQuery] = useState('');
    const [documents, setDocuments] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [newDocForm, setNewDocForm] = useState({ title: '', content: '', type: 'NOTA_DINAS', urgency: 'NORMAL', destination: '', isManualCode: false, manualCode: '', unitId: '', version: 1, reviewDate: '' });
    const [approvers, setApprovers] = useState({ parafId: '', signId: '' });
    const [units, setUnits] = useState([]);
    const [approvers, setApprovers] = useState({ parafId: '', signId: '' });
    const [currentUser, setCurrentUser] = useState(null);
    const [showSignCanvas, setShowSignCanvas] = useState(false);
    const [signingDocId, setSigningDocId] = useState(null);
    const [settings, setSettings] = useState(null);
    
    const printRef = useRef();
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: selectedDoc?.code ? `Dokumen_${selectedDoc.code.replace(/\//g, '_')}` : 'Dokumen',
    });

    const fetchUsersAndProfile = async () => {
        try {
            const [usersRes, profileRes, settingsRes, unitsRes] = await Promise.all([
                api.get('/users'),
                api.get('/users/profile'),
                api.get('/settings').catch(() => ({ data: null })),
                api.get('/units').catch(() => ({ data: [] }))
            ]);
            setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
            setCurrentUser(profileRes.data);
            if (settingsRes.data) setSettings(settingsRes.data);
            if (unitsRes.data) setUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
        } catch (err) { console.error(err); }
    };

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await api.get('/documents');
            // Assuming res.data returns an array of documents
            let allDocs = Array.isArray(res.data) ? res.data : [];
            
            // Tab filtering logic
            if (activeTab === 'INBOX') {
                allDocs = allDocs.filter(d => ['WAITING_PARAF', 'WAITING_SIGN'].includes(d.status));
            } else if (activeTab === 'DRAFT') {
                allDocs = allDocs.filter(d => d.status === 'DRAFT');
            } else if (activeTab === 'SENT') {
                allDocs = allDocs.filter(d => !['DRAFT'].includes(d.status));
            } else if (activeTab === 'ARCHIVE') {
                allDocs = allDocs.filter(d => d.status === 'SIGNED');
            }
            
            setDocuments(allDocs);
        } catch (err) {
            console.error(err);
            // Ignore failure silently to allow UI fallback or alert user
             setDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
        if (users.length === 0) fetchUsersAndProfile();
    }, [activeTab]);

    const templates = {
        'NOTA_DINAS': `[Tulis latar belakang masalah di sini]\n\n[Sampaikan inti Nota Dinas atau permohonan]\n\nDemikian Nota Dinas ini kami sampaikan, atas perhatian Bapak/Ibu diucapkan terima kasih.`,
        'SURAT_TUGAS': `Memerintahkan Kepada:\nNama: [Nama Staf]\nJabatan: [Jabatan Staf]\n\nUntuk melaksanakan tugas:\n1. [Deskripsi Tugas Pertama]\n2. [Deskripsi Tugas Kedua]\n\nWaktu: \nTempat: \n\nDemikian Surat Tugas ini diberikan untuk dilaksanakan dengan penuh tanggung jawab.`,
        'SURAT_KEPUTUSAN': `Menimbang:\na. Bahwa untuk kelancaran kegiatan... \nb. Bahwa berdasarkan pertimbangan huruf a... \n\nMengingat:\n1. Standar Operasional Prosedur Sarpras...\n2. Aturan Yayasan... \n\nMEMUTUSKAN\nMenetapkan: [Nama Keputusan]\nPertama: [Isi Diktum Pertama]\nKedua: Keputusan ini berlaku sejak tanggal ditetapkan.`,
        'SURAT_EDARAN': `Assalamu’alaikum Warahmatullahi Wabarakatuh.\nDengan hormat,\n\nSehubungan dengan adanya kebijakan perbaikan aset berkala, kami memohon kepada Bapak/Ibu untuk:\n1. Mematikan AC saat usai bekerja.\n2. Mengunci ruangan rapat.\n\nDemikian Surat Edaran ini kami sampaikan agar dapat dipedomani. Atas perhatian dan kerja samanya kami ucapkan terima kasih.\n\nWassalamu’alaikum Warahmatullahi Wabarakatuh.`,
        'BAST': `Pada hari ini, tanggal [Pilih/Ketik Tanggal], kami yang bertanda tangan di bawah ini:\n\nNama: [Nama Penyerah]\nJabatan: [Jabatan]\nSelanjutnya disebut PIHAK PERTAMA\n\nNama: [Nama Penerima]\nJabatan: [Jabatan]\nSelanjutnya disebut PIHAK KEDUA\n\nPIHAK PERTAMA menyerahkan kepada PIHAK KEDUA berupa:\n1. [Nama Barang/Aset] sejumlah [Qty]\n\nDemikian Berita Acara ini dibuat untuk disahkan sesuai prosedur yang berlaku.`
    };

    const handleTypeChange = (e) => {
        const type = e.target.value;
        const autoContent = templates[type] || '';
        setNewDocForm({...newDocForm, type, content: autoContent});
    };

    const handleCreateDocument = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...newDocForm,
                approverIds: [parseInt(approvers.parafId), parseInt(approvers.signId)].filter(id => !isNaN(id))
            };
            // Category mapping for simple implementation
            payload.categoryId = newDocForm.type === 'SOP' ? 3 : (newDocForm.type === 'BAST' ? 2 : 1);
            
            await api.post('/documents', payload);
            setShowCreateModal(false);
            setNewDocForm({ title: '', content: '', type: 'NOTA_DINAS', urgency: 'NORMAL', destination: '', isManualCode: false, manualCode: '', unitId: '', version: 1, reviewDate: '' });
            setApprovers({ parafId: '', signId: '' });
            fetchDocuments();
            alert("Draft Dokumen Berhasil Dibuat");
        } catch(err) {
            alert(err.response?.data?.error || "Gagal membuat dokumen. Pastikan DB sinkron.");
        }
    };

    const handleAction = async (actionId, docId, extraData) => {
        try {
            await api.post(`/documents/${docId}/${actionId}`, extraData || {});
            setSelectedDoc(null);
            fetchDocuments();
            alert("Aksi berhasil dieksekusi!");
        } catch (err) {
            alert(err.response?.data?.error || "Gagal mengeksekusi aksi.");
        }
    };

    const handleSignWithCanvas = (docId) => {
        setSigningDocId(docId);
        setShowSignCanvas(true);
    };

    const handleSignatureSaved = async (signatureData) => {
        setShowSignCanvas(false);
        if (signingDocId) {
            await handleAction('approve', signingDocId, { signature: signatureData });
            setSigningDocId(null);
        }
    };

    const tabs = [
        { id: 'INBOX', label: 'Kotak Masuk', icon: Inbox },
        { id: 'DRAFT', label: 'Draf Saya', icon: FileText },
        { id: 'SENT', label: 'Terkirim', icon: Send },
        { id: 'SURAT-MASUK', label: 'Surat Masuk', icon: Mail },
        { id: 'ARCHIVE', label: 'Arsip & Validasi', icon: QrCode },
    ];

    const getStatusStyle = (status) => {
        switch(status) {
            case 'DRAFT': return { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Draf', icon: FileText };
            case 'WAITING_PARAF': return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Menunggu Paraf', icon: Clock };
            case 'WAITING_SIGN': return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Menunggu TTE', icon: PenTool };
            case 'SIGNED': return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Telah Ditandatangani', icon: QrCode };
            default: return { bg: 'bg-slate-100', text: 'text-slate-700', label: status, icon: FileText };
        }
    };

    const handleValidateQR = () => {
        // Feature coming soon
        alert('Fitur Validasi Scanner QR akan membuka kamera device Anda. Membutuhkan setup HTTPS.');
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
            {/* Header Section */}
            <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 rounded-3xl p-8 mb-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-2xl -ml-10 -mb-10"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                                <FileSignature size={24} className="text-blue-300" />
                            </div>
                            <Badge className="bg-blue-500/30 text-blue-200 border border-blue-400/30">E-Office & TNDE</Badge>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Manajemen Dokumen</h1>
                        <p className="text-blue-200/80 font-medium max-w-xl text-sm leading-relaxed">
                            Pusat tata naskah dinas elektronik terintegrasi. Buat, lacak, paraf, dan tandatangani dokumen secara digital dengan validasi QR Code.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleValidateQR} className="px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all text-white flex items-center gap-2 active:scale-95">
                            <QrCode size={16} /> Validasi Surat
                        </button>
                        <button onClick={() => setShowCreateModal(true)} className="px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 shadow-lg shadow-blue-500/30 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all text-white flex items-center gap-2 active:scale-95 border border-blue-400/50">
                            <FilePlus size={16} /> Buat Surat
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-4xl mx-auto">
                {/* Surat Masuk Tab */}
                {activeTab === 'SURAT-MASUK' ? (
                    <IncomingMailTab />
                ) : (
                <div>
                    {/* Toolbar */}
                    <div className="bg-white rounded-2xl p-2 pl-4 flex flex-col sm:flex-row items-center justify-between mb-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 gap-4">
                        <div className="flex-1 flex items-center gap-3 w-full">
                            <Search className="text-slate-300" size={18} />
                            <input 
                                type="text"
                                placeholder="Cari nomor surat, perihal, atau pengirim..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none text-sm font-semibold text-slate-700 placeholder:text-slate-300 placeholder:font-medium focus:ring-0 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2 pr-2">
                            <button className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors">
                                <Filter size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Documents List */}
                    {loading ? (
                        <div className="py-20 text-center">
                            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-sm font-medium text-slate-400">Memuat Dokumen...</p>
                        </div>
                    ) : documents.length === 0 ? (
                         <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <Inbox size={48} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-700">Belum ada dokumen</h3>
                            <p className="text-sm font-medium text-slate-400 mt-1">Tidak ada entri di tab ini.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {documents.map((doc) => {
                                const config = getStatusStyle(doc.status);
                                const StatusIcon = config.icon;
                                
                                return (
                                    <div key={doc.id} onClick={() => setSelectedDoc(doc)} className="group bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-indigo-100 transition-all cursor-pointer">
                                        <div className="flex flex-col md:flex-row gap-5 items-start md:items-center">
                                            
                                            {/* Icon & Type */}
                                            <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 group-hover:text-indigo-600 text-slate-400 transition-colors">
                                                <FileText size={24} strokeWidth={1.5} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                    <Badge className={config.bg + " " + config.text}>
                                                        <StatusIcon size={10} /> {config.label}
                                                    </Badge>
                                                    <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{doc.type.replace('_', ' ')}</span>
                                                    {doc.urgency === 'HIGH' && (
                                                        <span className="text-[10px] font-black text-rose-500 tracking-widest uppercase bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 animate-pulse">URGENT</span>
                                                    )}
                                                </div>
                                                
                                                <h3 className="text-base font-bold text-slate-800 mb-1 truncate group-hover:text-indigo-700 transition-colors">{doc.title}</h3>
                                                
                                                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] font-semibold text-slate-500">
                                                    <span className="flex items-center gap-1.5"><QrCode size={12} className="text-slate-300" /> {doc.code}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">Dari: {doc.senderName || 'Sistem'}</span>
                                                </div>
                                            </div>

                                            {/* Meta & Actions */}
                                            <div className="flex items-center md:flex-col md:items-end w-full md:w-auto mt-4 md:mt-0 justify-between">
                                                <div className="text-right">
                                                    <p className="text-xs font-bold text-slate-700">{new Date(doc.createdAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{new Date(doc.createdAt).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p>
                                                </div>
                                                <button className="md:mt-4 p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                                                    <ExternalLink size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* CREATE DRAFT MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><FilePlus size={20} /></div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Buat Surat Baru</h3>
                                    <p className="text-xs font-medium text-slate-400">Konsep naskah dinas akan disimpan sebagai Draf.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                            <form id="docForm" onSubmit={handleCreateDocument} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Jenis Surat</label>
                                        <select 
                                            value={newDocForm.type}
                                            onChange={handleTypeChange}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none"
                                            required
                                        >
                                            <option value="NOTA_DINAS">Nota Dinas</option>
                                            <option value="SURAT_TUGAS">Surat Tugas</option>
                                            <option value="SURAT_KEPUTUSAN">Surat Keputusan</option>
                                            <option value="SURAT_EDARAN">Surat Edaran</option>
                                            <option value="BAST">Berita Acara (BAST)</option>
                                            <option value="SOP">Standar Operasional Prosedur (SOP)</option>
                                            <option value="SURAT_KELUAR">Surat Keluar</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Urgensi</label>
                                        <select 
                                            value={newDocForm.urgency}
                                            onChange={e => setNewDocForm({...newDocForm, urgency: e.target.value})}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none"
                                            required
                                        >
                                            <option value="NORMAL">Normal / Biasa</option>
                                            <option value="HIGH">Tinggi / Penting</option>
                                            <option value="URGENT">Sangat Segera (Urgent)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Unit Pendidikan</label>
                                        <select 
                                            value={newDocForm.unitId}
                                            onChange={e => setNewDocForm({...newDocForm, unitId: e.target.value})}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none"
                                        >
                                            <option value="">-- Pilih Unit (Opsional) --</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tujuan Surat</label>
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Contoh: Kepala Yayasan / Vendor A"
                                            value={newDocForm.destination}
                                            onChange={e => setNewDocForm({...newDocForm, destination: e.target.value})}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none"
                                            required
                                        />
                                    </div>
                                </div>
                                {newDocForm.type === 'SOP' && (
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Versi SOP</label>
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={newDocForm.version}
                                                onChange={e => setNewDocForm({...newDocForm, version: parseInt(e.target.value) || 1})}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tanggal Review (Batas Berlaku)</label>
                                            <input 
                                                type="date" 
                                                value={newDocForm.reviewDate}
                                                onChange={e => setNewDocForm({...newDocForm, reviewDate: e.target.value})}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none"
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 justify-between">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Nomor Surat</label>
                                            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 cursor-pointer">
                                                <input type="checkbox" checked={newDocForm.isManualCode} onChange={(e) => setNewDocForm({...newDocForm, isManualCode: e.target.checked})} className="rounded text-indigo-500 focus:ring-indigo-500" />
                                                MANUAL
                                            </label>
                                        </div>
                                        {newDocForm.isManualCode ? (
                                            <input 
                                                type="text" 
                                                placeholder="Ketik Nomor Custom..."
                                                value={newDocForm.manualCode}
                                                onChange={e => setNewDocForm({...newDocForm, manualCode: e.target.value})}
                                                className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-sm font-semibold text-indigo-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none"
                                                required
                                            />
                                        ) : (
                                            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400">
                                                Dihasilkan Otomatis
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">1. Pilih Pemaraf (Opsional)</label>
                                        <select 
                                            value={approvers.parafId}
                                            onChange={e => setApprovers({...approvers, parafId: e.target.value})}
                                            className="w-full bg-white border border-amber-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-100 focus:border-amber-400 transition-all outline-none"
                                        >
                                            <option value="">-- Lewati Tahap Paraf --</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{u.name} - {u.role}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">2. Pilih Penandatangan (Opsional)</label>
                                        <select 
                                            value={approvers.signId}
                                            onChange={e => setApprovers({...approvers, signId: e.target.value})}
                                            className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 transition-all outline-none"
                                        >
                                            <option value="">-- Lewati / Langsung Eksekusi --</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{u.name} - {u.role}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Perihal (Title)</label>
                                    <input 
                                        type="text" 
                                        placeholder="Tuliskan perihal surat dengan padat dan jelas..."
                                        value={newDocForm.title}
                                        onChange={e => setNewDocForm({...newDocForm, title: e.target.value})}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Isi Konten Dokumen (Draft)</label>
                                    <textarea 
                                        rows="8"
                                        placeholder="Ketik isi draf dokumen di sini..."
                                        value={newDocForm.content}
                                        onChange={e => setNewDocForm({...newDocForm, content: e.target.value})}
                                        className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none resize-none leading-relaxed"
                                        required
                                    ></textarea>
                                </div>
                            </form>
                        </div>
                        
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                            <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                                Batal
                            </button>
                            <button type="submit" form="docForm" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95">
                                <Save size={16} /> Simpan sebagai Draf
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {selectedDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><FileText size={20} /></div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Detail Dokumen</h3>
                                    <p className="text-xs font-medium text-slate-400">{selectedDoc.code}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDoc(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-6">
                            <div className="flex flex-wrap gap-2">
                                <Badge className="bg-slate-200/50 text-slate-600 border border-slate-300/30">{selectedDoc.type.replace('_', ' ')}</Badge>
                                <Badge className={getStatusStyle(selectedDoc.status).bg + " " + getStatusStyle(selectedDoc.status).text}>{getStatusStyle(selectedDoc.status).label}</Badge>
                                {selectedDoc.urgency === 'HIGH' && <Badge className="bg-rose-100 text-rose-600">URGENT</Badge>}
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-slate-800 mb-2">{selectedDoc.title}</h2>
                                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 bg-white p-3 rounded-xl border border-slate-100">
                                    <span>Tujuan: <span className="text-slate-700">{selectedDoc.destination || '-'}</span></span>
                                    <span>Dibuat oleh: <span className="text-slate-700">{selectedDoc.senderName}</span></span>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 p-5 min-h-[200px]">
                                <pre className="text-sm font-medium text-slate-700 whitespace-pre-wrap font-sans">{selectedDoc.content}</pre>
                            </div>
                        </div>
                        
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-between items-center gap-3">
                            <div className="flex gap-2">
                                {selectedDoc.status === 'DRAFT' && currentUser && selectedDoc.creatorId === currentUser.id && (
                                    <button onClick={() => handleAction('submit', selectedDoc.id)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 flex items-center gap-2 transition-all active:scale-95">
                                        <Send size={16} /> Ajukan / Sahkan
                                    </button>
                                )}
                                
                                {['WAITING_PARAF', 'WAITING_SIGN'].includes(selectedDoc.status) && selectedDoc.approvals && currentUser && (
                                    selectedDoc.approvals.some(a => a.userId === currentUser.id && a.status === 'PENDING') && (
                                        <>
                                            <button onClick={() => handleSignWithCanvas(selectedDoc.id)} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95">
                                                <PenTool size={16} /> {selectedDoc.status === 'WAITING_PARAF' ? 'Berikan Paraf' : 'Tanda Tangani (TTE)'}
                                            </button>
                                            <button onClick={() => handleAction('reject', selectedDoc.id)} className="px-5 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95">
                                                <X size={16} /> Tolak Dokumen
                                            </button>
                                        </>
                                    )
                                )}

                                {selectedDoc.status === 'SIGNED' && (
                                    <button onClick={handlePrint} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95">
                                        <QrCode size={16} /> Cetak (Dengan QR Barcode)
                                    </button>
                                )}
                            </div>
                            
                            <button onClick={() => setSelectedDoc(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* SIGNATURE CANVAS */}
            {showSignCanvas && (
                <SignatureCanvas
                    onSave={handleSignatureSaved}
                    onClose={() => { setShowSignCanvas(false); setSigningDocId(null); }}
                />
            )}

            {/* HIDDEN PRINT COMPONENT */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, zIndex: -1 }}>
                <DocumentPrintView ref={printRef} doc={selectedDoc} settings={settings} />
            </div>
        </div>
    );
};

export default DocumentManagement;
