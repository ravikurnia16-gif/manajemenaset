import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Loader2, 
    Maximize2, 
    CheckCircle, 
    CheckCircle2, 
    FileText, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    ExternalLink 
} from 'lucide-react';
import { getMediaUrl } from '../../../lib/media';

export default function MaintenanceMediaGallery({
    report,
    isAdmin,
    currentUserId,
    onAddMedia,
    uploadingMedia = false
}) {
    const [lightbox, setLightbox] = useState({ show: false, items: [], index: 0 });

    const generalMedia = report.media 
        ? report.media.filter(m => !m.isReceipt && !m.isCompletion) 
        : (report.photo ? [{ url: report.photo, type: 'IMAGE', title: 'Foto Kerusakan' }] : []);
    const receiptMedia = report.media ? report.media.filter(m => m.isReceipt) : [];
    const completionMedia = report.media ? report.media.filter(m => m.isCompletion) : [];

    const openLightbox = (items, startIndex = 0) => {
        if (!items || items.length === 0) return;
        setLightbox({
            show: true,
            items: items.map(item => typeof item === 'string' ? { url: item, type: 'IMAGE', title: 'Media' } : item),
            index: startIndex
        });
    };

    const handleLightboxNext = () => {
        setLightbox(prev => ({
            ...prev,
            index: (prev.index + 1) % prev.items.length
        }));
    };

    const handleLightboxPrev = () => {
        setLightbox(prev => ({
            ...prev,
            index: (prev.index - 1 + prev.items.length) % prev.items.length
        }));
    };

    // Keyboard support for Lightbox
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!lightbox.show) return;
            if (e.key === 'Escape') setLightbox(prev => ({ ...prev, show: false }));
            if (e.key === 'ArrowRight') handleLightboxNext();
            if (e.key === 'ArrowLeft') handleLightboxPrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightbox]);

    return (
        <div className="space-y-4">
            {/* Description & Initial Damage Media */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Deskripsi Masalah / Keluhan
                    </h3>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                        {report.description}
                    </p>
                </div>

                {/* Media Bukti Kerusakan Awal */}
                <div className="pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Media Bukti & Dokumentasi Kerusakan
                        </h3>
                        {(isAdmin || report.userId === currentUserId) && (
                            <label className={`cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${uploadingMedia ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                {uploadingMedia ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                {uploadingMedia ? 'Mengunggah...' : 'Upload Tambahan'}
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*,video/*"
                                    onChange={onAddMedia}
                                    disabled={uploadingMedia}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>

                    {generalMedia.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {generalMedia.map((item, idx) => {
                                const isVideo = item.type === 'VIDEO';
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => openLightbox(generalMedia, idx)}
                                        className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group cursor-pointer shadow-2xs hover:shadow-md transition-all"
                                    >
                                        {isVideo ? (
                                            <video
                                                src={getMediaUrl(item.url)}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <img
                                                src={getMediaUrl(item.url)}
                                                alt={`Bukti ${idx + 1}`}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                            <Maximize2 size={20} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                            Tidak ada foto/video bukti kerusakan yang dilampirkan.
                        </div>
                    )}
                </div>
            </div>

            {/* Foto Bukti Selesai */}
            {completionMedia.length > 0 && (
                <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-5 space-y-3">
                    <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" /> Foto Penyelesaian Pekerjaan
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                        {completionMedia.map((item, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => openLightbox(completionMedia, idx)}
                                className="relative aspect-square rounded-2xl overflow-hidden border border-emerald-200 bg-white group cursor-pointer shadow-2xs hover:shadow-md transition-all"
                            >
                                <img
                                    src={getMediaUrl(item.url)}
                                    alt={`Selesai ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Maximize2 size={20} />
                                </div>
                                <div className="absolute top-2 right-2 p-1 bg-emerald-600 text-white rounded-full shadow-md">
                                    <CheckCircle size={12} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Nota Pembayaran */}
            {receiptMedia.length > 0 && (
                <div className="bg-blue-50/60 rounded-2xl border border-blue-200 p-5 space-y-3">
                    <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={16} className="text-blue-600" /> Nota & Kuitansi Pembayaran
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                        {receiptMedia.map((item, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => openLightbox(receiptMedia, idx)}
                                className="relative aspect-square rounded-2xl overflow-hidden border border-blue-200 bg-white group cursor-pointer shadow-2xs hover:shadow-md transition-all"
                            >
                                <img
                                    src={getMediaUrl(item.url)}
                                    alt={`Nota ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Maximize2 size={20} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* In-App Lightbox Modal */}
            {lightbox.show && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200" 
                    onClick={() => setLightbox(prev => ({ ...prev, show: false }))}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                        {/* Lightbox Controls */}
                        <div className="absolute -top-12 right-0 flex items-center gap-3 text-white">
                            <span className="text-xs font-mono font-semibold bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-xs">
                                {lightbox.index + 1} / {lightbox.items.length}
                            </span>
                            <a 
                                href={getMediaUrl(lightbox.items[lightbox.index]?.url || lightbox.items[lightbox.index])} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                title="Buka Tab Baru"
                            >
                                <ExternalLink size={18} />
                            </a>
                            <button onClick={() => setLightbox(prev => ({ ...prev, show: false }))} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                                <X size={22} />
                            </button>
                        </div>

                        {/* Media Display */}
                        <div className="flex items-center justify-center max-h-[75vh] max-w-[85vw] overflow-hidden rounded-2xl bg-black/40 shadow-2xl">
                            {lightbox.items[lightbox.index]?.type === 'VIDEO' ? (
                                <video
                                    src={getMediaUrl(lightbox.items[lightbox.index]?.url || lightbox.items[lightbox.index])}
                                    controls
                                    autoPlay
                                    className="max-h-[75vh] max-w-[85vw] rounded-2xl"
                                />
                            ) : (
                                <img
                                    src={getMediaUrl(lightbox.items[lightbox.index]?.url || lightbox.items[lightbox.index])}
                                    alt="Lightbox Media"
                                    className="max-h-[75vh] max-w-[85vw] object-contain rounded-2xl select-none"
                                />
                            )}
                        </div>

                        {/* Prev / Next Arrows */}
                        {lightbox.items.length > 1 && (
                            <>
                                <button
                                    onClick={handleLightboxPrev}
                                    className="absolute -left-12 top-1/2 -translate-y-1/2 p-3 text-white bg-white/10 hover:bg-white/25 rounded-full transition-all backdrop-blur-xs shadow-lg"
                                    title="Sebelumnya (←)"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <button
                                    onClick={handleLightboxNext}
                                    className="absolute -right-12 top-1/2 -translate-y-1/2 p-3 text-white bg-white/10 hover:bg-white/25 rounded-full transition-all backdrop-blur-xs shadow-lg"
                                    title="Selanjutnya (→)"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
