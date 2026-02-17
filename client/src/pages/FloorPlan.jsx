import React, { useState, useRef } from 'react';
import { MapPin, Plus, Trash2, Box, Info, ZoomIn, ZoomOut, Maximize, Square, MousePointer2 } from 'lucide-react';
import { cn } from '../lib/utils';

const FloorPlan = () => {
    const [markers, setMarkers] = useState([
        { id: 1, x: 25, y: 35, name: 'Printer HP LaserJet', code: 'AST.IT.001', status: 'BAIK' },
        { id: 2, x: 45, y: 60, name: 'PC Lab Komputer 12', code: 'AST.IT.045', status: 'RUSAK' },
        { id: 3, x: 70, y: 20, name: 'AC Daikin 2PK', code: 'AST.ME.012', status: 'BAIK' },
    ]);
    const [rooms, setRooms] = useState([
        { id: 'r1', x: 10, y: 10, w: 25, h: 30, name: 'Kantor Utama', color: 'blue' },
        { id: 'r2', x: 10, y: 50, w: 25, h: 40, name: 'Lab Komputer', color: 'emerald' },
        { id: 'r3', x: 45, y: 10, w: 45, h: 40, name: 'Gudang Logistik', color: 'amber' },
    ]);

    const [mode, setMode] = useState('SELECT'); // SELECT, ADD_ASSET, ADD_ROOM
    const [selectedItem, setSelectedItem] = useState(null);
    const [drawingRoom, setDrawingRoom] = useState(null);
    const containerRef = useRef(null);

    const handleMouseDown = (e) => {
        if (mode !== 'ADD_ROOM') return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setDrawingRoom({ x, y, startX: e.clientX, startY: e.clientY, w: 0, h: 0 });
    };

    const handleMouseMove = (e) => {
        if (!drawingRoom || mode !== 'ADD_ROOM') return;

        const rect = containerRef.current.getBoundingClientRect();
        const currentX = ((e.clientX - rect.left) / rect.width) * 100;
        const currentY = ((e.clientY - rect.top) / rect.height) * 100;

        setDrawingRoom(prev => ({
            ...prev,
            w: Math.abs(currentX - prev.x),
            h: Math.abs(currentY - prev.y),
            actualX: Math.min(prev.x, currentX),
            actualY: Math.min(prev.y, currentY)
        }));
    };

    const handleMouseUp = () => {
        if (drawingRoom && drawingRoom.w > 1 && drawingRoom.h > 1) {
            const newRoom = {
                id: Date.now(),
                x: drawingRoom.actualX !== undefined ? drawingRoom.actualX : drawingRoom.x,
                y: drawingRoom.actualY !== undefined ? drawingRoom.actualY : drawingRoom.y,
                w: drawingRoom.w,
                h: drawingRoom.h,
                name: 'Ruangan Baru',
                color: 'slate'
            };
            setRooms([...rooms, newRoom]);
            setSelectedItem({ type: 'ROOM', data: newRoom });
        }
        setDrawingRoom(null);
        if (mode === 'ADD_ROOM') setMode('SELECT');
    };

    const handleContainerClick = (e) => {
        if (mode === 'ADD_ASSET') {
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
            setMode('SELECT');
            setSelectedItem({ type: 'ASSET', data: newMarker });
        }
    };

    const deleteItem = () => {
        if (!selectedItem) return;
        if (selectedItem.type === 'ASSET') {
            setMarkers(markers.filter(m => m.id !== selectedItem.data.id));
        } else {
            setRooms(rooms.filter(r => r.id !== selectedItem.data.id));
        }
        setSelectedItem(null);
    };

    const markerToFixed = (val) => Number(val).toFixed(2);

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden">
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">DENAH LOKASI ASET</h1>
                    <p className="text-sm text-slate-500 font-medium">Visualisasi posisi aset dan tata ruang secara real-time.</p>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setMode('SELECT')}
                        className={cn("p-2 rounded-xl transition-all", mode === 'SELECT' ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:bg-slate-50")}
                        title="Pilih / Geser"
                    >
                        <MousePointer2 size={20} />
                    </button>
                    <button
                        onClick={() => setMode('ADD_ASSET')}
                        className={cn("p-2 rounded-xl transition-all", mode === 'ADD_ASSET' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50")}
                        title="Tambah Aset"
                    >
                        <MapPin size={20} />
                    </button>
                    <button
                        onClick={() => setMode('ADD_ROOM')}
                        className={cn("p-2 rounded-xl transition-all", mode === 'ADD_ROOM' ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:bg-slate-50")}
                        title="Buat Kotak Ruangan"
                    >
                        <Square size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0">
                <div className="flex-1 bg-slate-900 rounded-3xl relative overflow-hidden shadow-2xl border-4 border-slate-800 select-none">
                    <div
                        ref={containerRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onClick={handleContainerClick}
                        className={cn(
                            "absolute inset-0 cursor-crosshair transition-all duration-300",
                            mode !== 'SELECT' && "ring-4 ring-blue-500 ring-inset bg-blue-500/5"
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
                        {/* Rooms */}
                        {rooms.map(room => (
                            <div
                                key={room.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem({ type: 'ROOM', data: room });
                                }}
                                className={cn(
                                    "absolute border-2 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                                    selectedItem?.type === 'ROOM' && selectedItem.data.id === room.id
                                        ? "ring-2 ring-white border-white z-20"
                                        : `border-${room.color || 'slate'}-500/40 bg-${room.color || 'slate'}-500/5 hover:bg-${room.color || 'slate'}-500/10`
                                )}
                                style={{
                                    left: `${room.x}%`,
                                    top: `${room.y}%`,
                                    width: `${room.w}%`,
                                    height: `${room.h}%`
                                }}
                            >
                                <span className={cn(
                                    "font-black text-[10px] uppercase tracking-widest transition-opacity text-center px-1",
                                    (room.w < 10 || room.h < 5) ? "opacity-0" : "opacity-40"
                                )}>
                                    {room.name}
                                </span>
                            </div>
                        ))}

                        {/* Drawing Room Feedback */}
                        {drawingRoom && (
                            <div
                                className="absolute border-2 border-dashed border-blue-400 bg-blue-400/20 rounded-lg pointer-events-none"
                                style={{
                                    left: `${drawingRoom.actualX !== undefined ? drawingRoom.actualX : drawingRoom.x}%`,
                                    top: `${drawingRoom.actualY !== undefined ? drawingRoom.actualY : drawingRoom.y}%`,
                                    width: `${drawingRoom.w}%`,
                                    height: `${drawingRoom.h}%`
                                }}
                            />
                        )}

                        {/* Pins */}
                        {markers.map((marker) => (
                            <button
                                key={marker.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem({ type: 'ASSET', data: marker });
                                }}
                                className={cn(
                                    "absolute -translate-x-1/2 -translate-y-full transition-all hover:scale-125 z-30",
                                    (selectedItem?.type === 'ASSET' && selectedItem.data.id === marker.id) ? "scale-125" : "scale-100"
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

                    {/* Mode Indicators */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
                        {mode === 'ADD_ASSET' && (
                            <div className="bg-blue-600/90 backdrop-blur-md text-white px-6 py-2 rounded-full font-bold text-sm shadow-2xl animate-bounce">
                                Mode Pin: Klik area untuk meletakkan aset
                            </div>
                        )}
                        {mode === 'ADD_ROOM' && (
                            <div className="bg-emerald-600/90 backdrop-blur-md text-white px-6 py-2 rounded-full font-bold text-sm shadow-2xl animate-pulse">
                                Mode Kotak: Klik & Drag pada denah untuk membuat ruangan
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Panel */}
                <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-y-auto custom-scrollbar flex flex-col">
                    {selectedItem ? (
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="font-black text-lg text-slate-800 leading-tight uppercase tracking-tight">
                                    Detail {selectedItem.type === 'ASSET' ? 'Aset' : 'Ruangan'}
                                </h3>
                                <button
                                    onClick={deleteItem}
                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 rounded-lg"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            {selectedItem.type === 'ASSET' ? (
                                <div className="space-y-5">
                                    <div className="aspect-square bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200">
                                        <Box size={40} className="text-slate-300" />
                                    </div>
                                    <div className="grid gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama Aset</label>
                                            <input
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={selectedItem.data.name}
                                                onChange={(e) => {
                                                    const newName = e.target.value;
                                                    setMarkers(markers.map(m => m.id === selectedItem.data.id ? { ...m, name: newName } : m));
                                                    setSelectedItem(prev => ({ ...prev, data: { ...prev.data, name: newName } }));
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                                            <select
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={selectedItem.data.status}
                                                onChange={(e) => {
                                                    const newStatus = e.target.value;
                                                    setMarkers(markers.map(m => m.id === selectedItem.data.id ? { ...m, status: newStatus } : m));
                                                    setSelectedItem(prev => ({ ...prev, data: { ...prev.data, status: newStatus } }));
                                                }}
                                            >
                                                <option value="BAIK">BAIK</option>
                                                <option value="RUSAK">RUSAK</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div className="aspect-video bg-slate-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200">
                                        <Square size={40} className="text-slate-300" />
                                    </div>
                                    <div className="grid gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama Ruangan</label>
                                            <input
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                                value={selectedItem.data.name}
                                                onChange={(e) => {
                                                    const newName = e.target.value;
                                                    setRooms(rooms.map(r => r.id === selectedItem.data.id ? { ...r, name: newName } : r));
                                                    setSelectedItem(prev => ({ ...prev, data: { ...prev.data, name: newName } }));
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Warna Area</label>
                                            <div className="flex gap-2">
                                                {['blue', 'emerald', 'amber', 'rose', 'slate'].map(color => (
                                                    <button
                                                        key={color}
                                                        onClick={() => {
                                                            setRooms(rooms.map(r => r.id === selectedItem.data.id ? { ...r, color } : r));
                                                            setSelectedItem(prev => ({ ...prev, data: { ...prev.data, color } }));
                                                        }}
                                                        className={cn(
                                                            "w-6 h-6 rounded-full border-2",
                                                            `bg-${color}-500`,
                                                            selectedItem.data.color === color ? "border-slate-900" : "border-white"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                    <span>Presisi Koordinat</span>
                                    <span className="text-slate-600">X: {markerToFixed(selectedItem.data.x)}% Y: {markerToFixed(selectedItem.data.y)}%</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center h-full flex flex-col items-center justify-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 text-slate-300">
                                <Info size={32} />
                            </div>
                            <h4 className="font-bold text-slate-400 uppercase text-xs tracking-widest mb-1">Mode Perancangan</h4>
                            <p className="text-xs text-slate-400 leading-relaxed px-4">
                                Gunakan toolbar untuk mulai menggambar denah atau meletakkan aset pada area blueprint.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FloorPlan;
