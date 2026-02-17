import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Plus, Trash2, Box, Info, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { cn } from '../lib/utils';

const FloorPlan = () => {
    const [markers, setMarkers] = useState([
        { id: 1, x: 25, y: 35, name: 'Printer HP LaserJet', code: 'AST.IT.001', status: 'BAIK' },
        { id: 2, x: 45, y: 60, name: 'PC Lab Komputer 12', code: 'AST.IT.045', status: 'RUSAK' },
        { id: 3, x: 70, y: 20, name: 'AC Daikin 2PK', code: 'AST.ME.012', status: 'BAIK' },
    ]);
    const [selectedMarker, setSelectedMarker] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const containerRef = useRef(null);

    const handleImageClick = (e) => {
        if (!isAdding) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const newMarker = {
            id: Date.now(),
            x,
            y,
            name: 'Aset Baru',
            code: 'AST-TEMP',
            status: 'BAIK'
        };

        setMarkers([...markers, newMarker]);
        setIsAdding(false);
        setSelectedMarker(newMarker);
    };

    const deleteMarker = (id) => {
        setMarkers(markers.filter(m => m.id !== id));
        setSelectedMarker(null);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden">
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">DENAH LOKASI ASET</h1>
                    <p className="text-sm text-slate-500 font-medium">Visualisasi posisi aset secara real-time di area gedung.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-lg active:scale-95",
                            isAdding ? "bg-red-500 text-white shadow-red-200" : "bg-blue-600 text-white shadow-blue-200"
                        )}
                    >
                        {isAdding ? <><MapPin size={18} />Klik pada Denah...</> : <><Plus size={18} />Tambah Pin Aset</>}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0">
                {/* Main Interactive Map Area */}
                <div className="flex-1 bg-slate-900 rounded-3xl relative overflow-hidden shadow-2xl border-4 border-slate-800">
                    {/* CSS Blueprint Grid */}
                    <div
                        ref={containerRef}
                        onClick={handleImageClick}
                        className={cn(
                            "absolute inset-0 cursor-crosshair transition-all duration-300",
                            isAdding && "ring-4 ring-blue-500 ring-inset bg-blue-500/5"
                        )}
                        style={{
                            backgroundImage: `
                                linear-gradient(rgba(30, 41, 59, 1) 2px, transparent 2px),
                                linear-gradient(90deg, rgba(30, 41, 59, 1) 2px, transparent 2px),
                                linear-gradient(rgba(51, 65, 85, 0.3) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(51, 65, 85, 0.3) 1px, transparent 1px)
                            `,
                            backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
                            backgroundColor: '#0f172a'
                        }}
                    >
                        {/* Simulated Room Outlines */}
                        <div className="absolute top-[10%] left-[10%] w-[25%] h-[30%] border-2 border-blue-500/40 bg-blue-500/5 rounded-lg flex items-center justify-center">
                            <span className="text-blue-500/40 font-black text-xs uppercase tracking-widest rotate-12">Kantor Utama</span>
                        </div>
                        <div className="absolute top-[50%] left-[10%] w-[25%] h-[40%] border-2 border-emerald-500/40 bg-emerald-500/5 rounded-lg flex items-center justify-center">
                            <span className="text-emerald-500/40 font-black text-xs uppercase tracking-widest rotate-12">Lab Komputer</span>
                        </div>
                        <div className="absolute top-[10%] left-[45%] w-[45%] h-[40%] border-2 border-amber-500/40 bg-amber-500/5 rounded-lg flex items-center justify-center">
                            <span className="text-amber-500/40 font-black text-xs uppercase tracking-widest rotate-12">Gudang Logistik</span>
                        </div>
                        <div className="absolute top-[60%] left-[45%] w-[45%] h-[30%] border-2 border-slate-500/40 bg-slate-500/5 rounded-lg flex items-center justify-center">
                            <span className="text-slate-500/40 font-black text-xs uppercase tracking-widest rotate-12">Area Koridor</span>
                        </div>

                        {/* Pins */}
                        {markers.map((marker) => (
                            <button
                                key={marker.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMarker(marker);
                                }}
                                className={cn(
                                    "absolute -translate-x-1/2 -translate-y-full transition-all hover:scale-125 z-10",
                                    selectedMarker?.id === marker.id ? "scale-125" : "scale-100"
                                )}
                                style={{ top: `${marker.y}%`, left: `${marker.x}%` }}
                            >
                                <div className="relative group">
                                    <MapPin
                                        size={32}
                                        fill={marker.status === 'BAIK' ? '#3b82f6' : '#ef4444'}
                                        className={cn(
                                            "drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]",
                                            marker.status === 'RUSAK' && "drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                        )}
                                    />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700 shadow-xl">
                                        {marker.name}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Overlay Controls */}
                    <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                        <button className="p-2 bg-slate-800/80 backdrop-blur-md text-white rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors shadow-xl">
                            <ZoomIn size={20} />
                        </button>
                        <button className="p-2 bg-slate-800/80 backdrop-blur-md text-white rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors shadow-xl">
                            <ZoomOut size={20} />
                        </button>
                        <button className="p-2 bg-slate-800/80 backdrop-blur-md text-white rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors shadow-xl">
                            <Maximize size={20} />
                        </button>
                    </div>

                    {isAdding && (
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-blue-600/90 backdrop-blur-md text-white px-6 py-2 rounded-full font-bold text-sm shadow-2xl animate-bounce">
                            Mode Tambah: Klik area pada denah untuk meletakkan pin aset
                        </div>
                    )}
                </div>

                {/* Sidebar Info Panel */}
                <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-y-auto custom-scrollbar flex flex-col">
                    {selectedMarker ? (
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="font-black text-lg text-slate-800 leading-tight">Detail Aset LOKASI</h3>
                                <button
                                    onClick={() => deleteMarker(selectedMarker.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="aspect-video bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200">
                                    <Box size={40} className="text-slate-300" />
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">Nama Aset</label>
                                        <p className="text-sm font-bold text-slate-700">{selectedMarker.name}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">Kode Aset</label>
                                        <p className="text-sm font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">{selectedMarker.code}</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">Status</label>
                                            <span className={cn(
                                                "px-2 py-1 rounded-md text-[10px] font-black uppercase",
                                                selectedMarker.status === 'BAIK' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                            )}>
                                                {selectedMarker.status}
                                            </span>
                                        </div>
                                        <div className="flex-1 text-right">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">Koordinat</label>
                                            <p className="text-[10px] font-bold text-slate-500">X: {markerToFixed(selectedMarker.x)}%, Y: {markerToFixed(selectedMarker.y)}%</p>
                                        </div>
                                    </div>
                                </div>

                                <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg">
                                    Lihat Riwayat Audit <Info size={16} />
                                </button>

                                <p className="text-[10px] text-center text-slate-400 font-medium italic">
                                    *Data koordinat disimpan secara presisi relatif terhadap skala peta.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center h-full flex flex-col items-center justify-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 text-slate-300">
                                <Info size={32} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-400 uppercase text-xs tracking-widest mb-1">Pilih Penanda</h4>
                                <p className="text-xs text-slate-400 leading-relaxed">Klik salah satu penanda (pin) pada denah untuk melihat informasi aset di lokasi tersebut.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const markerToFixed = (val) => Number(val).toFixed(2);

export default FloorPlan;
