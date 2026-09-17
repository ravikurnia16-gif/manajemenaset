import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Check, X, Bookmark, RotateCcw, Trash2 } from 'lucide-react';

const SignaturePad = ({ onSave, onCancel, title = "Tanda Tangan", storageKey = "saved_user_signature" }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);
    const [rememberSignature, setRememberSignature] = useState(true);
    const [savedSig, setSavedSig] = useState(null);

    useEffect(() => {
        try {
            const existing = localStorage.getItem(storageKey);
            if (existing) {
                setSavedSig(existing);
            }
        } catch (e) {
            console.warn('LocalStorage error:', e);
        }
    }, [storageKey]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Setup canvas for high DPI
        const ratio = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        ctx.scale(ratio, ratio);
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#0f172a'; // Slate 900
    }, []);

    const startDrawing = (e) => {
        const { offsetX, offsetY } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        setIsDrawing(true);
        setIsEmpty(false);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const getCoordinates = (e) => {
        if (e.touches && e.touches[0]) {
            const rect = canvasRef.current.getBoundingClientRect();
            return {
                offsetX: e.touches[0].clientX - rect.left,
                offsetY: e.touches[0].clientY - rect.top
            };
        }
        return {
            offsetX: e.nativeEvent.offsetX,
            offsetY: e.nativeEvent.offsetY
        };
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
    };

    const loadSaved = () => {
        if (!savedSig) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw image on high DPI canvas
            ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
            setIsEmpty(false);
        };
        img.src = savedSig;
    };

    const deleteSaved = (e) => {
        e.stopPropagation();
        try {
            localStorage.removeItem(storageKey);
            setSavedSig(null);
        } catch (err) {}
    };

    const save = () => {
        if (isEmpty) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        if (rememberSignature) {
            try {
                localStorage.setItem(storageKey, dataUrl);
                setSavedSig(dataUrl);
            } catch (e) {
                console.warn('LocalStorage save error:', e);
            }
        }
        onSave(dataUrl);
    };

    return (
        <div className="flex flex-col gap-3 w-full max-w-md mx-auto bg-white p-5 rounded-2xl shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-base">{title}</h4>
                {onCancel && (
                    <button onClick={onCancel} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Saved Signature Quick Load Option */}
            {savedSig && (
                <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-800">
                        <Bookmark size={14} className="text-blue-600 shrink-0" />
                        <span>Ada tanda tangan tersimpan di perangkat ini</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={loadSaved}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1"
                        >
                            <RotateCcw size={12} /> Muat TTD
                        </button>
                        <button
                            type="button"
                            onClick={deleteSaved}
                            title="Hapus TTD tersimpan"
                            className="p-1 hover:bg-blue-100 text-rose-500 rounded-lg transition-colors"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>
            )}
            
            <div className="relative aspect-[3/2] w-full border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50 cursor-crosshair touch-none">
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full"
                />
                {isEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-slate-400 text-xs italic font-medium">Goreskan tanda tangan di sini</p>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-medium select-none">
                    <input
                        type="checkbox"
                        checked={rememberSignature}
                        onChange={(e) => setRememberSignature(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span>Ingat tanda tangan di perangkat ini</span>
                </label>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
                <button
                    onClick={clear}
                    type="button"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all"
                >
                    <Eraser size={14} /> Bersihkan
                </button>
                <button
                    onClick={save}
                    type="button"
                    disabled={isEmpty}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs transition-all shadow-md ${
                        isEmpty 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                    }`}
                >
                    <Check size={14} /> Gunakan TTD
                </button>
            </div>
        </div>
    );
};

export default SignaturePad;
