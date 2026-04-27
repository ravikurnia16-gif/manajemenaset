import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/axios';
import { 
    ShieldCheck, AlertCircle, FileText, Calendar, 
    User, CheckCircle2, XCircle, Info, ChevronRight,
    MapPin, Building2, Clock
} from 'lucide-react';

const PublicVerify = () => {
    const { uuid } = useParams();
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchVerification();
    }, [uuid]);

    const fetchVerification = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/office-documents/verify/${uuid}`);
            setResult(res.data);
        } catch (err) {
            console.error('Verification error:', err);
            setError(err.response?.data?.error || 'Gagal memverifikasi dokumen');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-500 font-bold animate-pulse">Memverifikasi Dokumen...</p>
                </div>
            </div>
        );
    }

    const doc = result?.document;
    const isValid = result?.valid;

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
                <div className="max-w-xl mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h1 className="font-black text-slate-900 leading-none">Verifikasi E-Office</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sistem Manajemen Aset & Dokumen Digital</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6 max-w-xl mx-auto w-full space-y-6">
                {/* Status Card */}
                <div className={`p-8 rounded-3xl border-2 flex flex-col items-center text-center space-y-4 shadow-xl transition-all ${
                    isValid 
                    ? 'bg-emerald-50 border-emerald-200 shadow-emerald-100' 
                    : 'bg-red-50 border-red-200 shadow-red-100'
                }`}>
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-2 ${
                        isValid ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-red-500 text-white shadow-lg shadow-red-200'
                    }`}>
                        {isValid ? <CheckCircle2 size={48} /> : <XCircle size={48} />}
                    </div>
                    <div>
                        <h2 className={`text-2xl font-black leading-tight ${isValid ? 'text-emerald-900' : 'text-red-900'}`}>
                            {isValid ? 'Dokumen Valid & Sah' : 'Dokumen Belum Sah'}
                        </h2>
                        <p className={`text-sm font-medium mt-1 ${isValid ? 'text-emerald-700' : 'text-red-700'}`}>
                            {isValid 
                                ? 'Tanda Tangan Elektronik terverifikasi secara resmi oleh sistem.' 
                                : 'Dokumen ini mungkin masih dalam draf atau telah dibatalkan.'
                            }
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 text-sm font-bold shadow-sm">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                {doc && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                            <div className="flex items-center gap-2 text-blue-600 mb-2">
                                <FileText size={18} />
                                <span className="text-xs font-black uppercase tracking-widest">Informasi Dokumen</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900">{doc.subject}</h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                    {doc.type?.replace('_', ' ')}
                                </span>
                                <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                    {doc.number || 'Belum Bernomor'}
                                </span>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <Calendar size={12} /> Tanggal Terbit
                                    </label>
                                    <p className="text-sm font-bold text-slate-800">
                                        {new Date(doc.signedAt || doc.createdAt).toLocaleDateString('id-ID', { 
                                            day: 'numeric', month: 'long', year: 'numeric' 
                                        })}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <Info size={12} /> Kategori
                                    </label>
                                    <p className="text-sm font-bold text-slate-800">{doc.category || '-'}</p>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Pihak Pertama</div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-slate-900">{doc.party1Name || '-'}</p>
                                        <p className="text-xs font-bold text-slate-500">{doc.party1Title || '-'}</p>
                                        {doc.party1SignedAt && (
                                            <div className="flex items-center gap-1.5 text-emerald-600 mt-2">
                                                <CheckCircle2 size={14} />
                                                <span className="text-[10px] font-black uppercase">Ditandatangani</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Pihak Kedua</div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-slate-900">{doc.party2Name || '-'}</p>
                                        <p className="text-xs font-bold text-slate-500">{doc.party2Title || '-'}</p>
                                        {doc.party2SignedAt && (
                                            <div className="flex items-center gap-1.5 text-emerald-600 mt-2">
                                                <CheckCircle2 size={14} />
                                                <span className="text-[10px] font-black uppercase">Ditandatangani</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-900 text-slate-400 text-center relative overflow-hidden group">
                            <p className="text-[10px] font-bold tracking-widest uppercase mb-1">Kode Verifikasi (UUID)</p>
                            <p className="text-[11px] font-mono break-all">{doc.uuid}</p>
                            
                            {isValid && (
                                <div className="mt-4 pt-4 border-t border-slate-800">
                                    <a 
                                        href={`${api.defaults.baseURL}/office-documents/verify/${doc.uuid}/pdf`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-900"
                                    >
                                        <FileText size={16} /> Download PDF Resmi
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-10 text-center space-y-4">
                <div className="flex items-center justify-center gap-4 text-slate-300">
                    <Building2 size={20} />
                    <div className="h-6 w-px bg-slate-200"></div>
                    <User size={20} />
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
                    © 2026 Sarana & Prasarana. Seluruh hak cipta dilindungi undang-undang.
                </p>
            </div>
        </div>
    );
};

export default PublicVerify;
