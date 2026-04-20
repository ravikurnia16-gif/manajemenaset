import React, { useState } from 'react';
import { 
    FileText, FileSignature, Inbox, Send, Search, Plus, 
    Filter, MoreVertical, QrCode, CheckCircle2, Clock, 
    FilePlus, PenTool, ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate, useParams } from 'react-router-dom';

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

    // Dummy data to showcase the premium UI
    const documents = [
        { id: 1, code: '800/012/SARPRAS/2026', title: 'Nota Dinas Pengajuan Perbaikan AC Ruang Rapat', type: 'Nota Dinas', status: 'WAITING_PARAF', sender: 'Budi Santoso', date: '20 Okt 2026', time: '09:30', urgency: 'HIGH' },
        { id: 2, code: '800/013/UMUM/2026', title: 'Surat Tugas Pengecekan Kendaraan Dinas Luar Kota', type: 'Surat Tugas', status: 'WAITING_SIGN', sender: 'Admin Unit', date: '19 Okt 2026', time: '14:15', urgency: 'MEDIUM' },
        { id: 3, code: '000/004/SARPRAS/2026', title: 'SK Penetapan Tim Inventarisasi Aset', type: 'Surat Keputusan', status: 'SIGNED', sender: 'Kepala Bidang', date: '18 Okt 2026', time: '11:00', urgency: 'LOW' }
    ];

    const getStatusStyle = (status) => {
        switch(status) {
            case 'WAITING_PARAF': return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Menunggu Paraf', icon: Clock };
            case 'WAITING_SIGN': return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Menunggu TTE', icon: PenTool };
            case 'SIGNED': return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Telah Ditandatangani', icon: QrCode };
            default: return { bg: 'bg-slate-100', text: 'text-slate-700', label: status, icon: FileText };
        }
    };

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
                            Pusat tata naskah dinas elektronik terintegrasi. Buat, lacak, paraf, dan tandatangani dokumen secara digital dengan validasi QR Code bersertifikat.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button className="px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all text-white flex items-center gap-2 active:scale-95">
                            <QrCode size={16} /> Validasi Surat
                        </button>
                        <button className="px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 shadow-lg shadow-blue-500/30 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all text-white flex items-center gap-2 active:scale-95 border border-blue-400/50">
                            <FilePlus size={16} /> Buat Surat
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-4xl mx-auto">
                {/* List Area */}
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
                    <div className="space-y-4">
                        {documents.map((doc) => {
                            const config = getStatusStyle(doc.status);
                            const StatusIcon = config.icon;
                            
                            return (
                                <div key={doc.id} className="group bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-indigo-100 transition-all cursor-pointer">
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
                                                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{doc.type}</span>
                                                {doc.urgency === 'HIGH' && (
                                                    <span className="text-[10px] font-black text-rose-500 tracking-widest uppercase bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 animate-pulse">URGENT</span>
                                                )}
                                            </div>
                                            
                                            <h3 className="text-base font-bold text-slate-800 mb-1 truncate group-hover:text-indigo-700 transition-colors">{doc.title}</h3>
                                            
                                            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] font-semibold text-slate-500">
                                                <span className="flex items-center gap-1.5"><QrCode size={12} className="text-slate-300" /> {doc.code}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">Dari: {doc.sender}</span>
                                            </div>
                                        </div>

                                        {/* Meta & Actions */}
                                        <div className="flex items-center md:flex-col md:items-end w-full md:w-auto mt-4 md:mt-0 justify-between">
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-slate-700">{doc.date}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{doc.time}</p>
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
                </div>
            </div>
        </div>
    );
};

export default DocumentManagement;
