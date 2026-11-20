import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Eye, Loader2, ArrowRight, Terminal } from 'lucide-react';
import api from '../../../lib/axios';

const ACTION_BADGE = {
    updated: { label: 'Diperbarui', cls: 'bg-emerald-100 text-emerald-700' },
    will_update: { label: 'Akan Diperbarui', cls: 'bg-blue-100 text-blue-700' },
    forced_overwrite: { label: 'Ditumpuk Paksa', cls: 'bg-amber-100 text-amber-700' },
    will_force_overwrite: { label: 'Akan Ditumpuk Paksa', cls: 'bg-amber-100 text-amber-700' },
    up_to_date: { label: 'Sudah Sesuai', cls: 'bg-slate-100 text-slate-600' },
    local_ahead: { label: 'KM Lokal Lebih Tinggi', cls: 'bg-amber-50 text-amber-700 border border-amber-200' }
};

const AmbulanceSyncModal = ({ isOpen, onClose, onSynced }) => {
    const [status, setStatus] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [runningAction, setRunningAction] = useState(null); // 'preview' | 'sync' | null
    const [forceOverwrite, setForceOverwrite] = useState(false);
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const fetchStatus = useCallback(async () => {
        setLoadingStatus(true);
        try {
            const res = await api.get('/vehicles/ambulance-sync/status');
            setStatus(res.data);
        } catch (err) {
            setErrorMsg(err.response?.data?.error || 'Gagal memuat status sinkronisasi Ambulance.');
        } finally {
            setLoadingStatus(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setErrorMsg('');
            setSuccessMsg('');
            setResult(null);
            fetchStatus();
        }
    }, [isOpen, fetchStatus]);

    const handleRunSync = async (dryRun) => {
        setErrorMsg('');
        setSuccessMsg('');
        setRunningAction(dryRun ? 'preview' : 'sync');
        try {
            const res = await api.post('/vehicles/ambulance-sync/run', {
                dryRun,
                forceOverwrite
            });
            setResult(res.data);
            if (!dryRun) {
                setSuccessMsg(
                    `Sinkronisasi selesai: ${res.data.summary.matchedCount} cocok plat, ${res.data.summary.updatedCount} KM diperbarui.`
                );
                await fetchStatus();
                if (typeof onSynced === 'function') onSynced();
            }
        } catch (err) {
            setErrorMsg(err.response?.data?.error || 'Gagal menjalankan sinkronisasi KM Ambulance.');
        } finally {
            setRunningAction(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <RefreshCw size={20} className="text-emerald-600" />
                            Sinkronisasi KM Ambulance (API DEIPED)
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Mencocokkan <span className="font-semibold">Plat Nomor</span> armada di Manajemen Aset dengan data <code className="bg-slate-200/70 px-1 rounded">last_km</code> dari API Ambulance.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {errorMsg && (
                        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {successMsg && (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2.5">
                            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* Status Bar */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700">Status Koneksi API (.env Server):</span>
                            {loadingStatus ? (
                                <span className="text-slate-400">Memeriksa...</span>
                            ) : status?.configured ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                                    Siap (Terbaca dari server/.env)
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                                    Belum Dikonfigurasi di server/.env
                                </span>
                            )}
                        </div>

                        {status?.resolvedEndpoint && (
                            <p className="text-slate-500">
                                Endpoint: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{status.resolvedEndpoint}</code>
                                {status?.tokenMasked && (
                                    <span className="ml-2 text-slate-400">Token: {status.tokenMasked}</span>
                                )}
                            </p>
                        )}

                        {!loadingStatus && !status?.configured && (
                            <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                                <Terminal size={15} className="shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="font-semibold">Konfigurasi token dan URL disimpan khusus di sisi backend (.env).</p>
                                    <p className="text-[11px]">
                                        Tambahkan <code>AMBULANCE_API_URL</code> dan <code>AMBULANCE_API_TOKEN</code> pada file <code>server/.env</code> lalu restart backend server.
                                    </p>
                                </div>
                            </div>
                        )}

                        {status?.lastSyncAt && (
                            <p className="text-slate-500">
                                Sinkronisasi terakhir: <span className="font-medium text-slate-700">{new Date(status.lastSyncAt).toLocaleString('id-ID')}</span>
                                {status.lastSyncTrigger && <span className="text-slate-400"> ({status.lastSyncTrigger})</span>}
                            </p>
                        )}
                    </div>

                    {/* Sync Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
                        <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={forceOverwrite}
                                onChange={(e) => setForceOverwrite(e.target.checked)}
                                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span>
                                <span className="font-semibold text-slate-700">Timpa paksa jika KM API lebih kecil</span>
                                <span className="block text-[11px] text-slate-400">
                                    Secara default hanya menaikkan KM karena <code>last_km</code> DEIPED hanya menghitung trip berstatus <em>verified</em>.
                                </span>
                            </span>
                        </label>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                disabled={!status?.configured || Boolean(runningAction)}
                                onClick={() => handleRunSync(true)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50"
                            >
                                {runningAction === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                                Pratinjau Cocok Plat
                            </button>
                            <button
                                type="button"
                                disabled={!status?.configured || Boolean(runningAction)}
                                onClick={() => handleRunSync(false)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                            >
                                {runningAction === 'sync' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                Sinkronkan Sekarang
                            </button>
                        </div>
                    </div>

                    {/* Result Details */}
                    {result && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-bold uppercase text-slate-400">Data API</p>
                                    <p className="text-lg font-black text-slate-800">{result.summary.totalApiVehicles}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                                    <p className="text-[10px] font-bold uppercase text-blue-500">Cocok Plat</p>
                                    <p className="text-lg font-black text-blue-700">{result.summary.matchedCount}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                                    <p className="text-[10px] font-bold uppercase text-emerald-500">
                                        {result.summary.dryRun ? 'Akan Diperbarui' : 'Diperbarui'}
                                    </p>
                                    <p className="text-lg font-black text-emerald-700">{result.summary.updatedCount}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                                    <p className="text-[10px] font-bold uppercase text-amber-500">Lokal Lebih Tinggi</p>
                                    <p className="text-lg font-black text-amber-700">{result.summary.localAheadCount}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-bold uppercase text-slate-400">Tidak Terdaftar</p>
                                    <p className="text-lg font-black text-slate-700">{result.summary.unmatchedApiCount}</p>
                                </div>
                            </div>

                            {result.matched.length > 0 && (
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700">
                                        Hasil Pencocokan Plat Nomor
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50/60 text-[11px] uppercase text-slate-500 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-2.5">Plat Nomor</th>
                                                    <th className="px-4 py-2.5">Armada Manajemen Aset</th>
                                                    <th className="px-4 py-2.5">Nama di API DEIPED</th>
                                                    <th className="px-4 py-2.5 text-right">KM Sebelumnya</th>
                                                    <th className="px-4 py-2.5 text-right">KM API (last_km)</th>
                                                    <th className="px-4 py-2.5 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {result.matched.map((item) => {
                                                    const badge = ACTION_BADGE[item.action] || ACTION_BADGE.up_to_date;
                                                    return (
                                                        <tr key={`${item.vehicleId}-${item.externalId}`} className="hover:bg-slate-50/70">
                                                            <td className="px-4 py-2.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                                                                {item.localPlateNumber}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-700">
                                                                <span className="font-semibold">{item.localName}</span>
                                                                <span className="block text-[10px] text-slate-400">{item.localType}</span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-slate-600">
                                                                {item.externalName}
                                                                <span className="block text-[10px] font-mono text-slate-400">{item.externalPlateNumber}</span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                                                                {(item.previousOdometer || 0).toLocaleString('id-ID')} km
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                                                {(item.apiLastKm || 0).toLocaleString('id-ID')} km
                                                                {item.newOdometer !== item.previousOdometer && (
                                                                    <span className="block text-[10px] text-emerald-600 flex items-center justify-end gap-0.5">
                                                                        <ArrowRight size={10} /> {(item.newOdometer || 0).toLocaleString('id-ID')} km
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.cls}`}>
                                                                    {badge.label}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {(result.unmatchedApiVehicles.length > 0 || result.unmatchedLocalAmbulances.length > 0) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {result.unmatchedApiVehicles.length > 0 && (
                                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1.5">
                                            <div className="font-bold text-amber-800 flex items-center gap-1.5">
                                                <AlertTriangle size={14} />
                                                Plat API Belum Ada di Manajemen Aset ({result.unmatchedApiVehicles.length})
                                            </div>
                                            <ul className="space-y-1 text-[11px] text-amber-900">
                                                {result.unmatchedApiVehicles.map((u, idx) => (
                                                    <li key={idx} className="flex justify-between gap-2">
                                                        <span><strong>{u.plateNumber || '-'}</strong> — {u.name}</span>
                                                        <span className="font-mono">{u.lastKm != null ? `${Number(u.lastKm).toLocaleString('id-ID')} km` : '-'}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {result.unmatchedLocalAmbulances.length > 0 && (
                                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                                            <div className="font-bold text-slate-700 flex items-center gap-1.5">
                                                <AlertCircle size={14} />
                                                Ambulance Lokal Tidak Ditemukan di API ({result.unmatchedLocalAmbulances.length})
                                            </div>
                                            <ul className="space-y-1 text-[11px] text-slate-600">
                                                {result.unmatchedLocalAmbulances.map((v) => (
                                                    <li key={v.vehicleId} className="flex justify-between gap-2">
                                                        <span><strong>{v.plateNumber}</strong> — {v.name}</span>
                                                        <span className="font-mono">{(v.odometer || 0).toLocaleString('id-ID')} km</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AmbulanceSyncModal;
