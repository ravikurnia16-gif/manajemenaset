import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Check, X } from 'lucide-react';

const SignaturePad = ({ onSave, onCancel, title = "Tanda Tangan" }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Setup canvas for high DPI
        const ratio = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        ctx.scale(ratio, ratio);
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;
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

    const save = () => {
        if (isEmpty) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onSave(dataUrl);
    };

    return (
        <div className="flex flex-col gap-4 w-full max-w-md mx-auto bg-white p-4 rounded-2xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800">{title}</h4>
                <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                    <X size={20} />
                </button>
            </div>
            
            <div className="relative aspect-[3/2] w-full border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-slate-50 cursor-crosshair touch-none">
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
                        <p className="text-slate-400 text-sm italic font-medium">Goreskan tanda tangan di sini</p>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={clear}
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
                >
                    <Eraser size={16} /> Bersihkan
                </button>
                <button
                    onClick={save}
                    type="button"
                    disabled={isEmpty}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                        isEmpty 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                    }`}
                >
                    <Check size={16} /> Simpan TTD
                </button>
            </div>
        </div>
    );
};

export default SignaturePad;
