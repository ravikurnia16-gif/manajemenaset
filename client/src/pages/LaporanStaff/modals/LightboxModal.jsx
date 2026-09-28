import React from 'react';
import { X } from 'lucide-react';
import { getMediaUrl } from '../../../lib/media';

export default function LightboxModal({ photoUrl, onClose }) {
    if (!photoUrl) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
            onClick={onClose}
        >
            <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <img 
                    src={getMediaUrl(photoUrl)} 
                    alt="Bukti Resolusi Penuh" 
                    className="max-w-full max-h-[85vh] object-contain rounded-2xl" 
                />
                <button 
                    onClick={onClose}
                    className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all cursor-pointer"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
}
