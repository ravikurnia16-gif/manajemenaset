import React, { useRef, useState, useEffect } from 'react';
import { PenTool, RotateCcw, Save, X } from 'lucide-react';

const SignatureCanvas = ({ onSave, onClose, initialSignature }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (initialSignature) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                setHasDrawn(true);
            };
            img.src = initialSignature;
        }
    }, []);

    const getPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDraw = (e) => {
        e.preventDefault();
        setIsDrawing(true);
        const ctx = canvasRef.current.getContext('2d');
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const ctx = canvasRef.current.getContext('2d');
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        setHasDrawn(true);
    };

    const stopDraw = () => setIsDrawing(false);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const handleSave = () => {
        if (!hasDrawn) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onSave(dataUrl);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><PenTool size={18} /></div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Tanda Tangan Elektronik</h3>
                            <p className="text-[10px] font-medium text-slate-400">Gambar tanda tangan Anda di area bawah</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
                </div>
                <div className="p-6">
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden bg-white mb-4">
                        <canvas
                            ref={canvasRef}
                            className="w-full cursor-crosshair touch-none"
                            style={{ height: '200px' }}
                            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                        />
                    </div>
                    <div className="flex justify-between">
                        <button onClick={clearCanvas} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl flex items-center gap-2 transition-colors">
                            <RotateCcw size={14} /> Hapus & Ulang
                        </button>
                        <button onClick={handleSave} disabled={!hasDrawn}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-200">
                            <Save size={14} /> Simpan Tanda Tangan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignatureCanvas;
