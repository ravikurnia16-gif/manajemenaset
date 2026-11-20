import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, AlertTriangle, CheckCircle2, Send, ShieldAlert, Users, GraduationCap } from 'lucide-react';
import api from '../../../lib/axios';

const PRESET_OPTIONS = [
    { value: '', label: 'Sesuai Preset Kamera' },
    { value: 'CLASSROOM', label: 'Kelas: Hitung Siswa & Cek Guru' },
    { value: 'SECURITY_NIGHT', label: 'Keamanan Malam: Deteksi Penyusup' },
    { value: 'CROWD', label: 'Area Umum: Hitung Orang & Kendaraan' },
    { value: 'CUSTOM', label: 'Instruksi Kustom' }
];

const CameraAiModal = ({ isOpen, onClose, camera, snapshotDataUrl = null }) => {
    const [preset, setPreset] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [sendingWa, setSendingWa] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [waMsg, setWaMsg] = useState('');

    useEffect(() => {
        if (isOpen && camera) {
            setPreset('');
            setCustomPrompt(camera.aiCustomPrompt || '');
            setAnalysis(null);
            setErrorMsg('');
            setWaMsg('');
        }
    }, [isOpen, camera]);

    if (!isOpen || !camera) return null;

    const handleRunAnalysis = async (sendAlert = false) => {
        setErrorMsg('');
        setWaMsg('');
        if (sendAlert) setSendingWa(true);
        else setLoading(true);

        try {
            const payload = {
                imageBase64: snapshotDataUrl || undefined,
                mimeType: 'image/jpeg',
                preset: preset || undefined,
                customPrompt: customPrompt.trim() || undefined,
                sendAlert,
                forceSendAlert: sendAlert
            };

            const res = await api.post(`/cctv/cameras/${camera.id}/ai-analyze`, payload);
            setAnalysis(res.data?.analysis || null);
            if (sendAlert && res.data?.waResult) {
                setWaMsg(
                    res.data.waResult.sent
                        ? `Laporan dikirim ke ${res.data.waResult.recipientCount} penerima WA.`
                        : (res.data.waResult.reason || 'Penerima WA belum tersedia.')
                );
            }
        } catch (err) {
            setErrorMsg(err.response?.data?.error || 'Gagal menjalankan analisis AI kamera.');
        } finally {
            setLoading(false);
            setSendingWa(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-5 py-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-purple-950 text-sm sm:text-base flex items-center gap-2">
                            <Sparkles size={18} className="text-purple-600" />
                            Analisis AI — {camera.name}
                        </h3>
                        <p className="text-[11px] text-purple-700/80 mt-0.5">
                            {camera.location || 'Lokasi belum diisi'} • Preset aktif: <strong>{camera.aiPreset || 'CLASSROOM'}</strong>
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

                <div className="p-5 overflow-y-auto space-y-4">
                    {snapshotDataUrl ? (
                        <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 max-h-56 flex items-center justify-center">
                            <img src={snapshotDataUrl} alt={camera.name} className="max-h-56 w-auto object-contain" />
                        </div>
                    ) : (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                            Snapshot browser tidak tersedia; backend akan mencoba mengambil 1 frame langsung via <code>ffmpeg</code> server.
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Mode Analisis</label>
                            <select
                                value={preset}
                                onChange={(e) => setPreset(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                            >
                                {PRESET_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Instruksi Tambahan / Kustom</label>
                            <input
                                type="text"
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder="Mis. cek apakah guru terlihat atau kelas kosong..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {waMsg && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
                            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                            <span>{waMsg}</span>
                        </div>
                    )}

                    {analysis && (
                        <div className={`p-4 rounded-xl border space-y-3 ${analysis.alertTriggered ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    {analysis.alertTriggered ? (
                                        <><ShieldAlert size={16} className="text-amber-600" /> Perlu Perhatian</>
                                    ) : (
                                        <><CheckCircle2 size={16} className="text-emerald-600" /> Kondisi Normal</>
                                    )}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                    {analysis.model} • {new Date(analysis.analyzedAt).toLocaleTimeString('id-ID')}
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs">
                                {analysis.studentCount !== undefined && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">
                                        <Users size={13} className="text-blue-600" /> Siswa: ~{analysis.studentCount}
                                    </span>
                                )}
                                {analysis.teacherPresent && (
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold ${
                                        analysis.teacherPresent === 'ADA'
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                            : 'bg-amber-100 text-amber-800 border-amber-200'
                                    }`}>
                                        <GraduationCap size={13} /> Guru: {analysis.teacherPresent}
                                    </span>
                                )}
                                {analysis.personCount !== undefined && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">
                                        Orang Terdeteksi: {analysis.personCount}
                                    </span>
                                )}
                                {analysis.subjectType && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">
                                        Objek: {analysis.subjectType}
                                    </span>
                                )}
                                {analysis.peopleCount !== undefined && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-700">
                                        Orang: {analysis.peopleCount} • Kendaraan: {analysis.vehicleCount ?? 0}
                                    </span>
                                )}
                            </div>

                            <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                                {analysis.summary}
                            </p>

                            {analysis.alertReason && (
                                <p className="text-[11px] font-semibold text-amber-800">
                                    Alasan Peringatan: {analysis.alertReason}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => handleRunAnalysis(true)}
                        disabled={loading || sendingWa}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        {sendingWa ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Analisis &amp; Kirim ke WA
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white"
                        >
                            Tutup
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRunAnalysis(false)}
                            disabled={loading || sendingWa}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {analysis ? 'Analisis Ulang' : 'Jalankan Analisis AI'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CameraAiModal;
