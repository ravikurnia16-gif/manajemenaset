import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
    Map as MapIcon, Plus, Edit2, Trash2, MapPin, Eye, Move, ZoomIn, ZoomOut,
    RotateCcw, Save, X, Compass, Tag, Cctv, Search, CheckCircle2, AlertCircle
} from 'lucide-react';
import api from '../../../lib/axios';
import { cn } from '../../../lib/utils';
import CctvPlayer from './CctvPlayer';
import FloorPlanFormModal from './FloorPlanFormModal';

const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (/^(https?:|data:|blob:)/i.test(url)) return url;
    if (url.startsWith('/api/')) {
        const base = (api?.defaults?.baseURL || '/api').replace(/\/+$/, '');
        return base === '/api' ? url : `${base}${url.slice(4)}`;
    }
    return url;
};

const QUICK_ANGLES = [
    { label: 'Atas', angle: 0 },
    { label: 'Kanan', angle: 90 },
    { label: 'Bawah', angle: 180 },
    { label: 'Kiri', angle: 270 }
];

const toPinsFromPlan = (plan) => (plan?.cameras || [])
    .filter((c) => typeof c.posX === 'number' && typeof c.posY === 'number')
    .map((c) => ({
        cameraId: c.id,
        posX: c.posX,
        posY: c.posY,
        fovAngle: c.fovAngle ?? null
    }));

const FloorPlanTab = ({
    floorPlans = [],
    allCameras = [],
    units = [],
    isManager = false,
    onRefresh,
    onOpenEditCamera
}) => {
    const [unitFilter, setUnitFilter] = useState('');
    const [activePlanId, setActivePlanId] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [showLabels, setShowLabels] = useState(true);
    const [camSearch, setCamSearch] = useState('');

    // Edit & Placement state
    const [draftPins, setDraftPins] = useState([]);
    const [dirty, setDirty] = useState(false);
    const [savingPositions, setSavingPositions] = useState(false);
    const [selectedCameraId, setSelectedCameraId] = useState(null);
    const [placingCameraId, setPlacingCameraId] = useState(null);

    // Modals
    const [planModalOpen, setPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [savingPlan, setSavingPlan] = useState(false);
    const [previewCamera, setPreviewCamera] = useState(null);

    // Refs for canvas coordinates & dragging
    const canvasRef = useRef(null);
    const dragStateRef = useRef(null);
    const suppressClickRef = useRef(false);

    const filteredPlans = useMemo(() => {
        if (!unitFilter) return floorPlans;
        return floorPlans.filter((fp) => String(fp.unitId || '') === unitFilter);
    }, [floorPlans, unitFilter]);

    useEffect(() => {
        if (filteredPlans.length === 0) {
            setActivePlanId(null);
            return;
        }
        if (!filteredPlans.some((fp) => fp.id === activePlanId)) {
            setActivePlanId(filteredPlans[0].id);
        }
    }, [filteredPlans, activePlanId]);

    const activePlan = useMemo(
        () => filteredPlans.find((fp) => fp.id === activePlanId) || null,
        [filteredPlans, activePlanId]
    );

    // Reset draft pins saat berpindah denah atau data refresh
    useEffect(() => {
        setDraftPins(toPinsFromPlan(activePlan));
        setDirty(false);
        setSelectedCameraId(null);
        setPlacingCameraId(null);
    }, [activePlan]);

    const cameraById = useMemo(() => {
        const map = new Map();
        (activePlan?.cameras || []).forEach((c) => map.set(c.id, c));
        allCameras.forEach((c) => map.set(c.id, c));
        return map;
    }, [activePlan, allCameras]);

    const placedCameraIdSet = useMemo(
        () => new Set(draftPins.map((p) => p.cameraId)),
        [draftPins]
    );

    const placedList = useMemo(() => {
        const q = camSearch.trim().toLowerCase();
        return draftPins
            .map((pin) => ({ pin, camera: cameraById.get(pin.cameraId) }))
            .filter(({ camera }) => {
                if (!camera) return false;
                if (!q) return true;
                return (
                    (camera.name || '').toLowerCase().includes(q) ||
                    (camera.location || '').toLowerCase().includes(q)
                );
            });
    }, [draftPins, cameraById, camSearch]);

    const unplacedCameras = useMemo(() => {
        if (!isManager) return [];
        const q = camSearch.trim().toLowerCase();
        return allCameras.filter((cam) => {
            if (placedCameraIdSet.has(cam.id)) return false;
            if (activePlan?.unitId && cam.unitId && cam.unitId !== activePlan.unitId && !q) {
                return false;
            }
            if (!q) return true;
            return (
                (cam.name || '').toLowerCase().includes(q) ||
                (cam.location || '').toLowerCase().includes(q) ||
                (cam.unit?.name || '').toLowerCase().includes(q)
            );
        });
    }, [isManager, allCameras, placedCameraIdSet, activePlan, camSearch]);

    const otherUnitUnplacedCount = useMemo(() => {
        if (!isManager || !activePlan?.unitId) return 0;
        return allCameras.filter(
            (cam) => !placedCameraIdSet.has(cam.id) && (!cam.unitId || cam.unitId !== activePlan.unitId)
        ).length;
    }, [isManager, activePlan, allCameras, placedCameraIdSet]);

    const selectedPin = useMemo(
        () => draftPins.find((p) => p.cameraId === selectedCameraId) || null,
        [draftPins, selectedCameraId]
    );
    const selectedCamera = selectedCameraId ? cameraById.get(selectedCameraId) : null;

    const getCoordsFromPointer = (clientX, clientY) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        const x = Math.round(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)) * 100) / 100;
        const y = Math.round(Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)) * 100) / 100;
        return { posX: x, posY: y };
    };

    const placeCameraAt = (cameraId, posX, posY) => {
        setDraftPins((prev) => {
            const exists = prev.some((p) => p.cameraId === cameraId);
            if (exists) {
                return prev.map((p) => (p.cameraId === cameraId ? { ...p, posX, posY } : p));
            }
            const cam = cameraById.get(cameraId);
            return [...prev, { cameraId, posX, posY, fovAngle: cam?.fovAngle ?? null }];
        });
        setDirty(true);
        setSelectedCameraId(cameraId);
    };

    const handleCanvasClick = (e) => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        if (!editMode || !isManager || !activePlan) return;

        const targetId = placingCameraId || selectedCameraId;
        if (!targetId) return;

        const coords = getCoordsFromPointer(e.clientX, e.clientY);
        if (!coords) return;

        placeCameraAt(targetId, coords.posX, coords.posY);
        if (placingCameraId) {
            setPlacingCameraId(null);
        }
    };

    useEffect(() => {
        const handlePointerMove = (e) => {
            const drag = dragStateRef.current;
            if (!drag) return;
            const movedDist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
            if (movedDist > 4) {
                drag.moved = true;
            }
            const coords = getCoordsFromPointer(e.clientX, e.clientY);
            if (!coords) return;
            setDraftPins((prev) =>
                prev.map((p) => (p.cameraId === drag.cameraId ? { ...p, posX: coords.posX, posY: coords.posY } : p))
            );
            setDirty(true);
        };

        const handlePointerUp = () => {
            const drag = dragStateRef.current;
            if (!drag) return;
            if (drag.moved) {
                suppressClickRef.current = true;
            }
            dragStateRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, []);

    const handlePinPointerDown = (e, cameraId) => {
        e.stopPropagation();
        if (!editMode || !isManager) return;
        setSelectedCameraId(cameraId);
        setPlacingCameraId(null);
        dragStateRef.current = {
            cameraId,
            startX: e.clientX,
            startY: e.clientY,
            moved: false
        };
    };

    const handlePinClick = (e, camera) => {
        e.stopPropagation();
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        if (editMode && isManager) {
            setSelectedCameraId(camera.id);
            setPlacingCameraId(null);
            return;
        }
        setPreviewCamera(camera);
    };

    const handleAngleChange = (angle) => {
        if (!selectedCameraId) return;
        setDraftPins((prev) =>
            prev.map((p) => (p.cameraId === selectedCameraId ? { ...p, fovAngle: angle } : p))
        );
        setDirty(true);
    };

    const handleRemovePin = (cameraId) => {
        setDraftPins((prev) => prev.filter((p) => p.cameraId !== cameraId));
        if (selectedCameraId === cameraId) setSelectedCameraId(null);
        setDirty(true);
    };

    const handleSavePositions = async () => {
        if (!activePlan) return;
        try {
            setSavingPositions(true);
            await api.put(`/cctv/floor-plans/${activePlan.id}/positions`, {
                placements: draftPins,
                clearMissing: true
            });
            setDirty(false);
            await onRefresh?.();
            Swal.fire({
                icon: 'success',
                title: 'Titik Kamera Tersimpan',
                text: `Posisi ${draftPins.length} kamera pada "${activePlan.name}" berhasil disimpan.`,
                timer: 1800,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menyimpan Posisi',
                text: err.response?.data?.error || err.message
            });
        } finally {
            setSavingPositions(false);
        }
    };

    const handleDiscardChanges = () => {
        setDraftPins(toPinsFromPlan(activePlan));
        setDirty(false);
        setSelectedCameraId(null);
        setPlacingCameraId(null);
    };

    const handleSavePlan = async (formData, planId) => {
        try {
            setSavingPlan(true);
            let savedId = planId;
            if (planId) {
                await api.put(`/cctv/floor-plans/${planId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                const res = await api.post('/cctv/floor-plans', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                savedId = res.data?.id || null;
            }
            setPlanModalOpen(false);
            setEditingPlan(null);
            await onRefresh?.();
            if (savedId) setActivePlanId(savedId);
            Swal.fire({
                icon: 'success',
                title: planId ? 'Denah Diperbarui' : 'Denah Ditambahkan',
                timer: 1600,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menyimpan Denah',
                text: err.response?.data?.error || err.message
            });
        } finally {
            setSavingPlan(false);
        }
    };

    const handleDeletePlan = async (plan) => {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'Hapus Denah?',
            text: `Denah "${plan.name}" akan dihapus. Kamera yang terpasang hanya dilepas dari denah (tidak ikut terhapus).`,
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus Denah',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#e11d48'
        });
        if (!confirm.isConfirmed) return;

        try {
            await api.delete(`/cctv/floor-plans/${plan.id}`);
            await onRefresh?.();
            Swal.fire({
                icon: 'success',
                title: 'Denah Dihapus',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus Denah',
                text: err.response?.data?.error || err.message
            });
        }
    };

    const handleSwitchPlan = async (nextPlanId) => {
        if (nextPlanId === activePlanId) return;
        if (dirty) {
            const res = await Swal.fire({
                icon: 'question',
                title: 'Ada Perubahan Posisi Belum Disimpan',
                text: 'Pindah denah tanpa menyimpan perubahan titik kamera saat ini?',
                showCancelButton: true,
                confirmButtonText: 'Pindah & Buang Perubahan',
                cancelButtonText: 'Batal'
            });
            if (!res.isConfirmed) return;
        }
        setActivePlanId(nextPlanId);
    };

    return (
        <div className="space-y-4">
            {/* Bar Pemilih Denah & Aksi */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    {units.length > 0 && (
                        <select
                            value={unitFilter}
                            onChange={(e) => setUnitFilter(e.target.value)}
                            className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Semua Unit Denah</option>
                            {units.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5">
                        {filteredPlans.map((fp) => {
                            const active = fp.id === activePlanId;
                            return (
                                <button
                                    key={fp.id}
                                    type="button"
                                    onClick={() => handleSwitchPlan(fp.id)}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all',
                                        active
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    )}
                                >
                                    <MapIcon size={13} />
                                    <span>{fp.name}</span>
                                    <span
                                        className={cn(
                                            'px-1.5 py-0.5 rounded-md text-[10px] font-extrabold',
                                            active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                                        )}
                                    >
                                        {(fp.cameras || []).length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {isManager && (
                    <div className="flex flex-wrap items-center gap-2">
                        {activePlan && (
                            <>
                                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditMode(false);
                                            setPlacingCameraId(null);
                                        }}
                                        className={cn(
                                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                            !editMode
                                                ? 'bg-white text-blue-700 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        )}
                                    >
                                        <Eye size={13} /> Mode Pantau
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditMode(true)}
                                        className={cn(
                                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                            editMode
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        )}
                                    >
                                        <Move size={13} /> Atur Titik Kamera
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingPlan(activePlan);
                                        setPlanModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold"
                                    title="Edit Info / Ganti Gambar Denah"
                                >
                                    <Edit2 size={13} /> Edit Denah
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeletePlan(activePlan)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold"
                                    title="Hapus Denah Ini"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                setEditingPlan(null);
                                setPlanModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
                        >
                            <Plus size={14} /> Tambah Denah
                        </button>
                    </div>
                )}
            </div>

            {/* Jika Belum Ada Denah */}
            {!activePlan ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
                    <MapIcon size={42} className="mx-auto text-slate-300" />
                    <h3 className="text-base font-bold text-slate-700">
                        {floorPlans.length === 0 ? 'Belum Ada Denah Lokasi CCTV' : 'Tidak Ada Denah untuk Filter Unit Ini'}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                        {isManager
                            ? 'Unggah gambar denah gedung/area terlebih dahulu, lalu klik untuk meletakkan titik lokasi masing-masing kamera CCTV.'
                            : 'Kepala Bidang Sarana belum menandai titik kamera Anda pada denah lokasi.'}
                    </p>
                    {isManager && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingPlan(null);
                                setPlanModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
                        >
                            <Plus size={15} /> Upload Denah Pertama
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
                    {/* Kolom Kiri (3 cols): Kanvas Denah Interaktif */}
                    <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                        {/* Canvas Toolbar */}
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-bold text-slate-800 text-sm truncate">{activePlan.name}</h3>
                                    {activePlan.unit?.name && (
                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                                            {activePlan.unit.name}
                                        </span>
                                    )}
                                    {activePlan.floorLabel && (
                                        <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold">
                                            {activePlan.floorLabel}
                                        </span>
                                    )}
                                </div>
                                {activePlan.description && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">{activePlan.description}</p>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setShowLabels((v) => !v)}
                                    className={cn(
                                        'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors',
                                        showLabels
                                            ? 'bg-slate-800 text-white border-slate-800'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                    )}
                                    title="Tampilkan / Sembunyikan Label Nama Kamera"
                                >
                                    <Tag size={12} /> Label
                                </button>

                                <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setZoom((z) => Math.max(75, z - 25))}
                                        className="p-1.5 hover:bg-slate-100 text-slate-600"
                                        title="Perkecil"
                                    >
                                        <ZoomOut size={14} />
                                    </button>
                                    <span className="px-2 text-[11px] font-mono font-bold text-slate-700 border-x border-slate-200">
                                        {zoom}%
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setZoom((z) => Math.min(200, z + 25))}
                                        className="p-1.5 hover:bg-slate-100 text-slate-600"
                                        title="Perbesar"
                                    >
                                        <ZoomIn size={14} />
                                    </button>
                                    {zoom !== 100 && (
                                        <button
                                            type="button"
                                            onClick={() => setZoom(100)}
                                            className="p-1.5 hover:bg-slate-100 text-slate-500 border-l border-slate-200"
                                            title="Reset Zoom"
                                        >
                                            <RotateCcw size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Banner Status Mode Edit / Simpan */}
                        {isManager && editMode && (
                            <div className={cn(
                                'px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs',
                                placingCameraId
                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                    : (dirty ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-indigo-50/70 border-indigo-200 text-indigo-900')
                            )}>
                                <div className="flex items-center gap-2 font-semibold">
                                    <MapPin size={15} className="shrink-0" />
                                    {placingCameraId ? (
                                        <span>
                                            Klik titik di atas denah untuk menempatkan kamera:{' '}
                                            <strong>{cameraById.get(placingCameraId)?.name}</strong>
                                        </span>
                                    ) : selectedCamera ? (
                                        <span>
                                            Kamera terpilih: <strong>{selectedCamera.name}</strong> — geser pin atau klik denah untuk memindahkan, lalu klik Simpan.
                                        </span>
                                    ) : (
                                        <span>
                                            Pilih kamera di panel kanan lalu klik pada gambar denah, atau seret (drag) titik kamera yang sudah ada.
                                        </span>
                                    )}
                                </div>

                                {dirty && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleDiscardChanges}
                                            disabled={savingPositions}
                                            className="px-3 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSavePositions}
                                            disabled={savingPositions}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs disabled:opacity-50"
                                        >
                                            <Save size={13} /> {savingPositions ? 'Menyimpan...' : 'Simpan Posisi Titik'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Viewport Gambar Denah */}
                        <div className="p-4 bg-slate-900/5 overflow-auto max-h-[75vh] flex justify-center items-start">
                            <div
                                ref={canvasRef}
                                onClick={handleCanvasClick}
                                style={{ width: `${zoom}%` }}
                                className={cn(
                                    'relative inline-block select-none rounded-xl overflow-hidden shadow-md border border-slate-300 bg-white shrink-0',
                                    editMode && (placingCameraId || selectedCameraId) ? 'cursor-crosshair' : 'cursor-default'
                                )}
                            >
                                <img
                                    src={resolveMediaUrl(activePlan.imageUrl)}
                                    alt={activePlan.name}
                                    draggable={false}
                                    className="block w-full h-auto pointer-events-none"
                                />

                                {/* Overlay Titik Kamera */}
                                {draftPins.map((pin) => {
                                    const cam = cameraById.get(pin.cameraId);
                                    if (!cam) return null;
                                    const isSelected = editMode && selectedCameraId === cam.id;
                                    const isActiveCam = cam.isActive !== false;

                                    return (
                                        <div
                                            key={cam.id}
                                            style={{ left: `${pin.posX}%`, top: `${pin.posY}%` }}
                                            onPointerDown={(e) => handlePinPointerDown(e, cam.id)}
                                            onClick={(e) => handlePinClick(e, cam)}
                                            className={cn(
                                                'absolute -translate-x-1/2 -translate-y-1/2 group z-10',
                                                editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                                                isSelected && 'z-20'
                                            )}
                                            title={`${cam.name}${cam.location ? ` (${cam.location})` : ''}`}
                                        >
                                            {/* Arah Pandang Kamera (FOV Cone) */}
                                            {typeof pin.fovAngle === 'number' && (
                                                <svg
                                                    viewBox="0 0 80 80"
                                                    style={{ transform: `translate(-50%, -50%) rotate(${pin.fovAngle}deg)` }}
                                                    className="absolute left-1/2 top-1/2 w-20 h-20 pointer-events-none"
                                                >
                                                    <path
                                                        d="M40 40 L20 6 A38 38 0 0 1 60 6 Z"
                                                        fill={isSelected ? 'rgba(99, 102, 241, 0.28)' : 'rgba(37, 99, 235, 0.22)'}
                                                        stroke={isSelected ? 'rgba(79, 70, 229, 0.7)' : 'rgba(37, 99, 235, 0.55)'}
                                                        strokeWidth="1.5"
                                                    />
                                                </svg>
                                            )}

                                            {/* Ikon Pin Kamera */}
                                            <div
                                                className={cn(
                                                    'relative w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg ring-2 transition-transform group-hover:scale-110',
                                                    isSelected
                                                        ? 'bg-indigo-600 ring-amber-300 scale-110'
                                                        : (isActiveCam ? 'bg-blue-600 ring-white' : 'bg-slate-500 ring-white/80')
                                                )}
                                            >
                                                <Cctv size={15} />
                                                {isActiveCam && (
                                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white" />
                                                )}
                                            </div>

                                            {/* Label Nama Kamera */}
                                            {showLabels && (
                                                <div
                                                    className={cn(
                                                        'mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap shadow-sm border text-center -translate-x-1/2 left-1/2 relative w-fit pointer-events-none',
                                                        isSelected
                                                            ? 'bg-indigo-900 text-white border-indigo-400'
                                                            : 'bg-slate-900/85 text-white border-white/20'
                                                    )}
                                                >
                                                    {cam.name}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Legenda Bawah */}
                        <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            <div className="flex flex-wrap items-center gap-4">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Kamera Aktif
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-slate-500 inline-block" /> Nonaktif
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                                    {editMode ? 'Drag pin / klik peta untuk atur lokasi' : 'Klik titik kamera di denah untuk menonton Live Video'}
                                </span>
                            </div>
                            <span className="font-semibold text-slate-700">
                                {draftPins.length} Titik Terpasang
                            </span>
                        </div>
                    </div>

                    {/* Kolom Kanan: Daftar Kamera & Pengaturan Titik Terpilih */}
                    <div className="space-y-4">
                        {/* Inspector Pin Terpilih (Mode Edit) */}
                        {isManager && editMode && selectedPin && selectedCamera && (
                            <div className="bg-white rounded-2xl border-2 border-indigo-300 p-4 space-y-3 shadow-xs">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="text-[10px] font-extrabold uppercase text-indigo-600">
                                            Titik Terpilih
                                        </span>
                                        <h4 className="font-bold text-slate-800 text-sm">{selectedCamera.name}</h4>
                                        <p className="text-[11px] text-slate-500">
                                            Koordinat: X {selectedPin.posX}% • Y {selectedPin.posY}%
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePin(selectedCamera.id)}
                                        className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold"
                                        title="Hapus titik kamera ini dari denah"
                                    >
                                        Lepas Titik
                                    </button>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-700 flex items-center gap-1">
                                            <Compass size={13} className="text-indigo-600" /> Arah Pandang Kamera
                                        </span>
                                        <span className="font-mono text-[11px] font-bold text-indigo-700">
                                            {typeof selectedPin.fovAngle === 'number' ? `${selectedPin.fovAngle}°` : 'Mati'}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="359"
                                        step="5"
                                        value={selectedPin.fovAngle ?? 0}
                                        onChange={(e) => handleAngleChange(parseInt(e.target.value, 10))}
                                        className="w-full accent-indigo-600 cursor-pointer"
                                    />
                                    <div className="grid grid-cols-5 gap-1">
                                        {QUICK_ANGLES.map((item) => (
                                            <button
                                                key={item.label}
                                                type="button"
                                                onClick={() => handleAngleChange(item.angle)}
                                                className={cn(
                                                    'py-1 rounded-md text-[10px] font-bold border transition-colors',
                                                    selectedPin.fovAngle === item.angle
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                )}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => handleAngleChange(null)}
                                            className="py-1 rounded-md text-[10px] font-bold border bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                                        >
                                            Off
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Panel Daftar Kamera */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={camSearch}
                                    onChange={(e) => setCamSearch(e.target.value)}
                                    placeholder="Cari kamera..."
                                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Kamera Terpasang di Denah */}
                            <div>
                                <h4 className="text-[11px] font-extrabold uppercase text-slate-500 mb-2 flex items-center justify-between">
                                    <span>Terpasang di Denah ({placedList.length})</span>
                                    <CheckCircle2 size={13} className="text-emerald-600" />
                                </h4>
                                {placedList.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-2">
                                        Belum ada titik kamera di denah ini.
                                    </p>
                                ) : (
                                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                        {placedList.map(({ camera }) => (
                                            <button
                                                key={camera.id}
                                                type="button"
                                                onClick={() => {
                                                    if (editMode && isManager) {
                                                        setSelectedCameraId(camera.id);
                                                        setPlacingCameraId(null);
                                                    } else {
                                                        setPreviewCamera(camera);
                                                    }
                                                }}
                                                className={cn(
                                                    'w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors',
                                                    editMode && selectedCameraId === camera.id
                                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                                                        : 'bg-slate-50 hover:bg-blue-50/60 border-slate-200 text-slate-800'
                                                )}
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-bold truncate">{camera.name}</div>
                                                    <div className="text-[10px] text-slate-500 truncate">
                                                        {camera.location || camera.unit?.name || `Ch.${camera.channelNo || 1}`}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold text-blue-600 shrink-0">
                                                    {editMode ? 'Pilih' : 'Lihat'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Kamera Belum Ditempatkan (Khusus Manager) */}
                            {isManager && (
                                <div className="pt-3 border-t border-slate-100">
                                    <h4 className="text-[11px] font-extrabold uppercase text-slate-500 mb-2 flex items-center justify-between">
                                        <span>Belum Ditempatkan ({unplacedCameras.length})</span>
                                        <AlertCircle size={13} className="text-amber-500" />
                                    </h4>
                                    {unplacedCameras.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic py-2">
                                            {otherUnitUnplacedCount > 0
                                                ? `Semua kamera unit ini sudah terpasang (ketik di kolom cari untuk melihat ${otherUnitUnplacedCount} kamera unit lain).`
                                                : 'Tidak ada kamera lain yang menunggu penempatan.'}
                                        </p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                            {unplacedCameras.map((cam) => {
                                                const isPlacingThis = editMode && placingCameraId === cam.id;
                                                return (
                                                    <div
                                                        key={cam.id}
                                                        className={cn(
                                                            'px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2',
                                                            isPlacingThis
                                                                ? 'bg-amber-50 border-amber-400'
                                                                : 'bg-white border-slate-200'
                                                        )}
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-800 truncate">{cam.name}</div>
                                                            <div className="text-[10px] text-slate-500 truncate">
                                                                {cam.unit?.name || 'Umum'} {cam.location ? `• ${cam.location}` : ''}
                                                                {cam.floorPlanId && cam.floorPlanId !== activePlan?.id ? ' • (di denah lain)' : ''}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditMode(true);
                                                                setPlacingCameraId(cam.id);
                                                                setSelectedCameraId(cam.id);
                                                            }}
                                                            className={cn(
                                                                'px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-colors',
                                                                isPlacingThis
                                                                    ? 'bg-amber-600 text-white'
                                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                            )}
                                                        >
                                                            {isPlacingThis ? 'Klik Denah...' : '+ Letakkan'}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Live Stream saat Pin Kamera diklik di Mode Pantau */}
            {previewCamera && (
                <div
                    className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
                    onClick={() => setPreviewCamera(null)}
                >
                    <div
                        className="w-full max-w-4xl space-y-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between text-white px-1">
                            <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
                                <MapPin size={15} className="text-blue-400" />
                                <span>{activePlan?.name}</span>
                                <span className="text-slate-400">•</span>
                                <span>{previewCamera.name}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewCamera(null)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold border border-slate-700"
                            >
                                <X size={14} /> Tutup
                            </button>
                        </div>
                        <CctvPlayer
                            camera={previewCamera}
                            isExpanded
                            onToggleExpand={() => setPreviewCamera(null)}
                            canManage={isManager}
                            onEditCamera={(cam) => {
                                setPreviewCamera(null);
                                onOpenEditCamera?.(cam);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Modal Tambah / Edit Denah */}
            {isManager && (
                <FloorPlanFormModal
                    isOpen={planModalOpen}
                    onClose={() => {
                        setPlanModalOpen(false);
                        setEditingPlan(null);
                    }}
                    onSave={handleSavePlan}
                    initialData={editingPlan}
                    units={units}
                    saving={savingPlan}
                />
            )}
        </div>
    );
};

export default FloorPlanTab;
