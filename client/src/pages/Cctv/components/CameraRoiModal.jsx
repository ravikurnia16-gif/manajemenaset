import { useCallback, useEffect, useRef, useState } from 'react';
import { X, SquareDashedMousePointer, Trash2, Save, RefreshCw, AlertCircle, Upload } from 'lucide-react';
import api from '../../../lib/axios';

const ZONE_COLORS = [
    { border: 'border-emerald-400', bg: 'bg-emerald-500/20', badge: 'bg-emerald-600' },
    { border: 'border-amber-400', bg: 'bg-amber-500/20', badge: 'bg-amber-600' },
    { border: 'border-cyan-400', bg: 'bg-cyan-500/20', badge: 'bg-cyan-600' },
    { border: 'border-rose-400', bg: 'bg-rose-500/20', badge: 'bg-rose-600' }
];

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const CameraRoiModal = ({ isOpen, onClose, camera, initialSnapshotUrl = null, onSaved }) => {
    const stageRef = useRef(null);

    const [zones, setZones] = useState([]);
    const [motionThreshold, setMotionThreshold] = useState(6.0);
    const [snapshotUrl, setSnapshotUrl] = useState(initialSnapshotUrl || null);
    const [loadingSnap, setLoadingSnap] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [drawingStart, setDrawingStart] = useState(null); // { xPct, yPct }
    const [draftRect, setDraftRect] = useState(null); // { x, y, width, height }

    const fetchServerSnapshot = useCallback(async (camId) => {
        if (!camId) return;
        setLoadingSnap(true);
        setErrorMsg('');
        try {
            const res = await api.get(`/cctv/cameras/${camId}/snapshot`);
            if (res.data?.imageDataUrl) {
                setSnapshotUrl(res.data.imageDataUrl);
            }
        } catch (err) {
            setErrorMsg(
                err.response?.data?.error ||
                'Belum bisa mengambil gambar server (ffmpeg). Buka Live Monitoring lalu klik tombol "ROI" pada player, atau unggah 1 screenshot kamera secara manual.'
            );
        } finally {
            setLoadingSnap(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen || !camera) return;
        let parsed = [];
        if (Array.isArray(camera.aiRoiZones)) {
            parsed = camera.aiRoiZones;
        } else if (typeof camera.aiRoiZones === 'string' && camera.aiRoiZones.trim()) {
            try {
                parsed = JSON.parse(camera.aiRoiZones);
            } catch {
                parsed = [];
            }
        }
        setZones(parsed);
        setMotionThreshold(camera.aiMotionThreshold ?? 6.0);
        setDraftRect(null);
        setDrawingStart(null);
        setErrorMsg('');

        if (initialSnapshotUrl) {
            setSnapshotUrl(initialSnapshotUrl);
        } else {
            setSnapshotUrl(null);
            fetchServerSnapshot(camera.id);
        }
    }, [isOpen, camera, initialSnapshotUrl, fetchServerSnapshot]);

    if (!isOpen || !camera) return null;

    const getRelativePct = (clientX, clientY) => {
        const rect = stageRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return { xPct: 0, yPct: 0 };
        return {
            xPct: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
            yPct: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100)
        };
    };

    const handlePointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (zones.length >= 10) {
            setErrorMsg('Maksimal 10 zona kotak ROI per kamera.');
            return;
        }
        setErrorMsg('');
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const pt = getRelativePct(e.clientX, e.clientY);
        setDrawingStart(pt);
        setDraftRect({ x: pt.xPct, y: pt.yPct, width: 0, height: 0 });
    };

    const handlePointerMove = (e) => {
        if (!drawingStart) return;
        const pt = getRelativePct(e.clientX, e.clientY);
        const x = Math.min(drawingStart.xPct, pt.xPct);
        const y = Math.min(drawingStart.yPct, pt.yPct);
        const width = Math.abs(pt.xPct - drawingStart.xPct);
        const height = Math.abs(pt.yPct - drawingStart.yPct);
        setDraftRect({
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            width: Number(width.toFixed(2)),
            height: Number(height.toFixed(2))
        });
    };

    const handlePointerUp = () => {
        if (!drawingStart || !draftRect) {
            setDrawingStart(null);
            setDraftRect(null);
            return;
        }
        if (draftRect.width >= 2 && draftRect.height >= 2) {
            const nextIndex = zones.length + 1;
            setZones((prev) => [
                ...prev,
                {
                    id: `roi-${Date.now()}-${nextIndex}`,
                    label: `Benda / Area ${nextIndex}`,
                    ...draftRect
                }
            ]);
        }
        setDrawingStart(null);
        setDraftRect(null);
    };

    const handleUploadManualImage = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setSnapshotUrl(reader.result);
                setErrorMsg('');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        setErrorMsg('');
        try {
            const res = await api.put(`/cctv/cameras/${camera.id}/ai-rois`, {
                roiZones: zones,
                aiMotionThreshold: Number(motionThreshold) || 6.0
            });
            if (typeof onSaved === 'function') {
                onSaved(res.data);
            }
            onClose();
        } catch (err) {
            setErrorMsg(err.response?.data?.error || 'Gagal menyimpan zona ROI kamera.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
                <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-emerald-950 text-sm sm:text-base flex items-center gap-2">
                            <SquareDashedMousePointer size={18} className="text-emerald-600" />
                            Tandai Kotak ROI Benda / Area — {camera.name}
                        </h3>
                        <p className="text-[11px] text-emerald-800/80 mt-0.5">
                            Klik &amp; tarik (*drag*) di atas gambar kamera untuk menggambar kotak. Jika zona ROI diisi, sensor gerak &amp; AI hanya fokus memantau area di dalam kotak.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Interactive Drawing Canvas */}
                    <div className="lg:col-span-2 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-slate-600">
                                Kanvas Kamera ({zones.length}/10 Kotak Ditandai)
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fetchServerSnapshot(camera.id)}
                                    disabled={loadingSnap}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-50"
                                >
                                    <RefreshCw size={12} className={loadingSnap ? 'animate-spin' : ''} /> Ambil Ulang Frame
                                </button>
                                <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer">
                                    <Upload size={12} /> Unggah Screenshot
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadManualImage} />
                                </label>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div
                            ref={stageRef}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-slate-300 bg-slate-900 select-none touch-none cursor-crosshair"
                        >
                            {snapshotUrl ? (
                                <img
                                    src={snapshotUrl}
                                    alt={camera.name}
                                    draggable={false}
                                    className="w-full h-full object-fill pointer-events-none"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs p-6 text-center">
                                    {loadingSnap ? 'Mengambil frame kamera...' : 'Gambar referensi belum dimuat — Anda tetap bisa menggambar kotak perkiraan atau unggah screenshot kamera.'}
                                </div>
                            )}

                            {/* Rendered ROI Zones */}
                            {zones.map((zone, idx) => {
                                const color = ZONE_COLORS[idx % ZONE_COLORS.length];
                                return (
                                    <div
                                        key={zone.id || idx}
                                        style={{
                                            left: `${zone.x}%`,
                                            top: `${zone.y}%`,
                                            width: `${zone.width}%`,
                                            height: `${zone.height}%`
                                        }}
                                        className={`absolute border-2 ${color.border} ${color.bg} pointer-events-none`}
                                    >
                                        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold text-white rounded-br ${color.badge}`}>
                                            #{idx + 1} {zone.label}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Live Drawing Draft Rectangle */}
                            {draftRect && draftRect.width > 0 && draftRect.height > 0 && (
                                <div
                                    style={{
                                        left: `${draftRect.x}%`,
                                        top: `${draftRect.y}%`,
                                        width: `${draftRect.width}%`,
                                        height: `${draftRect.height}%`
                                    }}
                                    className="absolute border-2 border-dashed border-yellow-300 bg-yellow-400/20 pointer-events-none"
                                />
                            )}
                        </div>
                    </div>

                    {/* Zone List & Controls */}
                    <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                            <label className="block text-[11px] font-bold text-slate-700">
                                Sensitivitas Gerakan di Dalam Kotak (%)
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                step="0.5"
                                value={motionThreshold}
                                onChange={(e) => setMotionThreshold(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                            />
                            <p className="text-[10px] text-slate-500">
                                Makin kecil (mis. 3–5%), gerakan kecil di dalam kotak makin mudah memicu verifikasi Gemini AI.
                            </p>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                                <span>Daftar Kotak ROI ({zones.length})</span>
                                {zones.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setZones([])}
                                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                                    >
                                        Hapus Semua
                                    </button>
                                )}
                            </div>
                            <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                                {zones.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 text-center py-6">
                                        Belum ada kotak ROI. Bila kosong, sistem memantau seluruh layar kamera.
                                    </p>
                                ) : (
                                    zones.map((zone, idx) => (
                                        <div key={zone.id || idx} className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-bold text-slate-500">Zona #{idx + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setZones((prev) => prev.filter((_, i) => i !== idx))}
                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                                    title="Hapus zona ini"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={zone.label}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setZones((prev) => prev.map((z, i) => (i === idx ? { ...z, label: val } : z)));
                                                }}
                                                placeholder="Nama benda/area (mis. Kotak Infaq)"
                                                className="w-full px-2.5 py-1 rounded border border-slate-200 text-xs font-medium"
                                            />
                                            <p className="text-[10px] font-mono text-slate-400">
                                                x:{zone.x}% y:{zone.y}% w:{zone.width}% h:{zone.height}%
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                    >
                        <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Zona ROI'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CameraRoiModal;
