import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, FileText, QrCode } from 'lucide-react';
import axios from 'axios'; // Not using api interceptor because this is a public page

const DocumentPublicVerify = () => {
    const { hash } = useParams();
    const [status, setStatus] = useState('loading'); // loading, valid, invalid
    const [doc, setDoc] = useState(null);

    useEffect(() => {
        const verifyDocument = async () => {
            try {
                // Adjust URL based on actual API URL in production
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
                const res = await axios.get(`${apiUrl}/documents/verify/${hash}`);
                
                if (res.data.valid) {
                    setDoc(res.data.document);
                    setStatus('valid');
                } else {
                    setStatus('invalid');
                }
            } catch (err) {
                console.error(err);
                setStatus('invalid');
            }
        };

        if (hash) {
            verifyDocument();
        } else {
            setStatus('invalid');
        }
    }, [hash]);

    if (status === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-6"></div>
                <p className="text-slate-600 font-semibold animate-pulse">Memverifikasi Keaslian Dokumen...</p>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-rose-100 max-w-md w-full text-center">
                    <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle size={48} className="text-rose-500" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 mb-3">Dokumen Tidak Valid</h1>
                    <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                        Maaf, dokumen ini tidak ditemukan dalam sistem kami atau QR Code tidak valid/telah dicabut.
                    </p>
                    <button onClick={() => window.location.href = '/'} className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors w-full">
                        Kembali ke Beranda
                    </button>
                </div>
            </div>
        );
    }

    // Identify final signer (usually the last approval step)
    const finalSigner = doc.approvals && doc.approvals.length > 0 
        ? doc.approvals[doc.approvals.length - 1].user 
        : doc.creator;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 md:p-6">
            <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-indigo-900/5 border border-slate-100 max-w-lg w-full relative overflow-hidden">
                {/* Decorative header */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500"></div>
                
                <div className="text-center mb-8 pt-4">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
                        <CheckCircle2 size={40} className="text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Dokumen Sah & Valid</h1>
                    <p className="text-sm font-medium text-emerald-600 mt-2 bg-emerald-50 py-1.5 px-4 rounded-full inline-flex items-center gap-2">
                        <QrCode size={14} /> Terverifikasi Sistem E-Office
                    </p>
                </div>

                <div className="space-y-5">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nomor Dokumen</p>
                        <p className="font-bold text-slate-800 text-lg">{doc.code}</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Perihal / Judul</p>
                        <p className="font-bold text-slate-800 leading-snug">{doc.title}</p>
                        <div className="mt-2 inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-xs font-bold text-slate-500">
                            <FileText size={12} /> {doc.type.replace('_', ' ')}
                        </div>
                    </div>

                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Informasi Penandatangan</p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg">
                                {finalSigner.name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{finalSigner.name}</p>
                                <p className="text-xs font-semibold text-slate-500">{finalSigner.position || 'N/A'} • NIP. {finalSigner.nip || '-'}</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-indigo-100/50 flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-400">Waktu Pengesahan:</span>
                            <span className="font-black text-indigo-700">
                                {new Date(doc.updatedAt).toLocaleDateString('id-ID', {
                                    day: 'numeric', month: 'long', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                    <p className="text-xs font-medium text-slate-400">
                        Dokumen ini diterbitkan oleh Bidang Sarpras dan keasliannya dapat dipertanggungjawabkan secara digital.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DocumentPublicVerify;
