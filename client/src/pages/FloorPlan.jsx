import React, { useState, useRef } from 'react';
import { Square, MousePointer2, ZoomIn, ZoomOut, Maximize, Trash2, Info, ChevronDown, Move } from 'lucide-react';
import { cn } from '../lib/utils';

const FloorPlan = () => {
    // Regions/Areas
    const [regions] = useState([
        { id: 1, name: 'Gedung Pusat - Lantai 1' },
        { id: 2, name: 'Gedung Pusat - Lantai 2' },
        { id: 3, name: 'Asrama Putra - Area A' },
        { id: 4, name: 'Asrama Putri - Area B' },
    ]);
    const [selectedRegionId, setSelectedRegionId] = useState(1);

    // Layout Data (normally fetched per region)
    const [rooms, setRooms] = useState([
        { id: 'r1', x: 200, y: 200, w: 400, h: 300, name: 'Kantor Utama', color: 'blue', regionId: 1 },
        { id: 'r2', x: 200, y: 550, w: 400, h: 400, name: 'Lab Komputer', color: 'emerald', regionId: 1 },
        { id: 'r3', x: 650, y: 200, w: 500, h: 400, name: 'Gudang Logistik', color: 'amber', regionId: 1 },
    ]);

    // Viewport State
    const [scale, setScale] = useState(0.8);
    const [offset, setOffset] = useState({ x: 100, y: 100 });
    const [mode, setMode] = useState('SELECT'); // SELECT, PAN, DRAW_ROOM
    const [selectedRoomId, setSelectedRoomId] = useState(null);
    const [drawingRoom, setDrawingRoom] = useState(null);

    // Interaction Refs
    const containerRef = useRef(null);
    const isDragging = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    // Filter rooms by region
    const currentRooms = rooms.filter(r => r.regionId === selectedRegionId);
    const selectedRoom = rooms.find(r => r.id === selectedRoomId);

    const handleMouseDown = (e) => {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Coordinate in Canvas Space
        const canvasX = (mouseX - offset.x) / scale;
        const canvasY = (mouseY - offset.y) / scale;

        if (mode === 'PAN' || (mode === 'SELECT' && e.button === 1)) {
            isDragging.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        } else if (mode === 'DRAW_ROOM') {
            setDrawingRoom({ x: canvasX, y: canvasY, w: 0, h: 0 });
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging.current) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (drawingRoom && mode === 'DRAW_ROOM') {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const canvasX = (mouseX - offset.x) / scale;
            const canvasY = (mouseY - offset.y) / scale;

            setDrawingRoom(prev => ({
                ...prev,
                w: canvasX - prev.x,
                h: canvasY - prev.y
            }));
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;

        if (drawingRoom && Math.abs(drawingRoom.w) > 10 && Math.abs(drawingRoom.h) > 10) {
            const newRoom = {
                id: Date.now(),
                x: drawingRoom.w > 0 ? drawingRoom.x : drawingRoom.x + drawingRoom.w,
                y: drawingRoom.h > 0 ? drawingRoom.y : drawingRoom.y + drawingRoom.h,
                w: Math.abs(drawingRoom.w),
                h: Math.abs(drawingRoom.h),
                name: 'Ruangan Baru',
                color: 'slate',
                regionId: selectedRegionId
            };
            setRooms([...rooms, newRoom]);
            setSelectedRoomId(newRoom.id);
        }
        setDrawingRoom(null);
        if (mode === 'DRAW_ROOM') setMode('SELECT');
    };

    const handleWheel = (e) => {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(scale * delta, 0.2), 5);

        // Zoom to Mouse Position
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const canvasX = (mouseX - offset.x) / scale;
        const canvasY = (mouseY - offset.y) / scale;

        setOffset({
            x: mouseX - canvasX * newScale,
            y: mouseY - canvasY * newScale
        });
        setScale(newScale);
    };

    const resetView = () => {
        setScale(0.8);
        setOffset({ x: 100, y: 100 });
    };

    const deleteRoom = () => {
        if (!selectedRoomId) return;
        setRooms(rooms.filter(r => r.id !== selectedRoomId));
        setSelectedRoomId(null);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">DENAH DAERAH</h1>
                        <p className="text-sm text-slate-500 font-medium">Perancangan tata ruang per daerah/gedung.</p>
                    </div>

                    {/* Region Selector */}
                    <div className="relative group">
                        <select
                            value={selectedRegionId}
                            onChange={(e) => setSelectedRegionId(Number(e.target.value))}
                            className="appearance-none bg-white border-2 border-slate-100 rounded-2xl px-5 py-2.5 pr-12 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm cursor-pointer"
                        >
                            {regions.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                </div>

                <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setMode('SELECT')}
                        className={cn("p-2 rounded-xl transition-all", mode === 'SELECT' ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:bg-slate-50")}
                        title="Pilih / Edit"
                    >
                        <MousePointer2 size={20} />
                    </button>
                    <button
                        onClick={() => setMode('PAN')}
                        className={cn("p-2 rounded-xl transition-all", mode === 'PAN' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50")}
                        title="Geser (Move)"
                    >
                        <Move size={20} />
                    </button>
                    <button
                        onClick={() => setMode('DRAW_ROOM')}
                        className={cn("p-2 rounded-xl transition-all", mode === 'DRAW_ROOM' ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50")}
                        title="Buat Kotak Ruangan"
                    >
                        <Square size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0">
                {/* Canvas Container */}
                <div className="flex-1 bg-slate-900 rounded-3xl relative overflow-hidden shadow-2xl border-4 border-slate-800 select-none cursor-grab active:cursor-grabbing">
                    <div
                        ref={containerRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onWheel={handleWheel}
                        className="absolute inset-0 outline-none"
                    >
                        {/* Transformed World Space */}
                        <div
                            style={{
                                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                                transformOrigin: '0 0'
                            }}
                            className="absolute pointer-events-none"
                        >
                            {/* Infinite Grid Simulation */}
                            <div
                                className="absolute"
                                style={{
                                    width: '5000px',
                                    height: '5000px',
                                    left: '-2500px',
                                    top: '-2500px',
                                    backgroundImage: `
                                        linear-gradient(rgba(30, 41, 59, 1) 2px, transparent 2px),
                                        linear-gradient(90deg, rgba(30, 41, 59, 1) 2px, transparent 2px),
                                        linear-gradient(rgba(51, 65, 85, 0.3) 1px, transparent 1px),
                                        linear-gradient(90deg, rgba(51, 65, 85, 0.3) 1px, transparent 1px)
                                    `,
                                    backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
                                    backgroundColor: '#0f172a'
                                }}
                            />

                            {/* Origin Axis */}
                            <div className="absolute top-0 left-0 w-2 h-2 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2 z-50"></div>

                            {/* Rooms (Regions filtered) */}
                            {currentRooms.map(room => (
                                <div
                                    key={room.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedRoomId(room.id);
                                    }}
                                    className={cn(
                                        "absolute border-4 rounded-xl flex items-center justify-center transition-all cursor-pointer pointer-events-auto",
                                        selectedRoomId === room.id
                                            ? "ring-8 ring-white/20 border-white z-40 bg-white/5"
                                            : `border-${room.color || 'slate'}-500/50 bg-${room.color || 'slate'}-500/10 hover:bg-${room.color || 'slate'}-500/20`
                                    )}
                                    style={{
                                        left: room.x,
                                        top: room.y,
                                        width: room.w,
                                        height: room.h
                                    }}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="font-black text-xs uppercase tracking-[0.2em] text-white/50 text-center px-4">
                                            {room.name}
                                        </span>
                                        <div className="bg-white/10 px-3 py-1 rounded-full border border-white/10">
                                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none">
                                                {Math.round(room.w)} x {Math.round(room.h)} PX
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Drawing Room Feedback */}
                            {drawingRoom && (
                                <div
                                    className="absolute border-4 border-dashed border-blue-400 bg-blue-400/20 rounded-xl pointer-events-none"
                                    style={{
                                        left: drawingRoom.w > 0 ? drawingRoom.x : drawingRoom.x + drawingRoom.w,
                                        top: drawingRoom.h > 0 ? drawingRoom.y : drawingRoom.y + drawingRoom.h,
                                        width: Math.abs(drawingRoom.w),
                                        height: Math.abs(drawingRoom.h)
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Viewport UI Overlays */}
                    <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                        <button onClick={() => setScale(s => Math.min(s * 1.2, 5))} className="p-3 bg-slate-800/80 backdrop-blur-md text-white rounded-2xl border border-slate-700 hover:bg-slate-700 transition-all shadow-xl active:scale-95">
                            <ZoomIn size={22} />
                        </button>
                        <button onClick={() => setScale(s => Math.max(s * 0.8, 0.2))} className="p-3 bg-slate-800/80 backdrop-blur-md text-white rounded-2xl border border-slate-700 hover:bg-slate-700 transition-all shadow-xl active:scale-95">
                            <ZoomOut size={22} />
                        </button>
                        <button onClick={resetView} className="p-3 bg-slate-800/80 backdrop-blur-md text-white rounded-2xl border border-slate-700 hover:bg-slate-700 transition-all shadow-xl active:scale-95">
                            <Maximize size={22} />
                        </button>
                    </div>

                    <div className="absolute bottom-6 left-6 px-4 py-2 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Scale: {Math.round(scale * 100)}% | X: {Math.round(offset.x)} Y: {Math.round(offset.y)}
                    </div>

                    {mode === 'DRAW_ROOM' && (
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-emerald-600/90 backdrop-blur-md text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl animate-pulse">
                            Mode Rancang: Klik & Drag Untuk Membuat Ruangan
                        </div>
                    )}
                </div>

                {/* Right Panel / Room Info */}
                <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-y-auto custom-scrollbar flex flex-col">
                    {selectedRoom ? (
                        <div className="p-8">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight leading-none mb-1">DATA RUANGAN</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{regions.find(r => r.id === selectedRoom.regionId)?.name}</p>
                                </div>
                                <button onClick={deleteRoom} className="p-2.5 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 rounded-xl">
                                    <Trash2 size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nama Ruangan / Area</label>
                                    <input
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                                        value={selectedRoom.name}
                                        onChange={(e) => setRooms(rooms.map(r => r.id === selectedRoom.id ? { ...r, name: e.target.value } : r))}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Label Warna</label>
                                    <div className="flex flex-wrap gap-3">
                                        {['blue', 'emerald', 'amber', 'rose', 'indigo', 'slate'].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setRooms(rooms.map(r => r.id === selectedRoom.id ? { ...r, color } : r))}
                                                className={cn(
                                                    "w-10 h-10 rounded-2xl border-4 transition-all shadow-sm",
                                                    `bg-${color}-500`,
                                                    selectedRoom.color === color ? "border-slate-800 scale-110 shadow-lg" : "border-white hover:scale-105"
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4 mt-8">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lebar</p>
                                        <p className="font-mono text-xs font-bold text-slate-600">{Math.round(selectedRoom.w)} px</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tinggi</p>
                                        <p className="font-mono text-xs font-bold text-slate-600">{Math.round(selectedRoom.h)} px</p>
                                    </div>
                                    <div className="col-span-2 pt-2 border-t border-slate-200/50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Koordinat Pusat</p>
                                        <p className="font-mono text-[10px] font-bold text-slate-500">X: {Math.round(selectedRoom.x)} | Y: {Math.round(selectedRoom.y)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center h-full flex flex-col items-center justify-center gap-6">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center border-2 border-slate-100 text-slate-200">
                                <Info size={48} />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-400 uppercase text-xs tracking-[0.2em] mb-2">Pilih Ruangan</h4>
                                <p className="text-xs text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                                    Klik pada ruangan di denah untuk mengedit informasi atau gunakan toolbar untuk mulai merancang.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FloorPlan;
