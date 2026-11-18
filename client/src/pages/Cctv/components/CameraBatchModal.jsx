import { useMemo, useState } from 'react';
import { X, Layers, Eye, EyeOff, HardDrive, Check, Sparkles, AlertTriangle } from 'lucide-react';

const buildPreviewPath = (brand, channelNo, quality) => {
    const ch = Math.max(1, Number(channelNo) || 1);
    const q = (quality || 'SUB').toUpperCase();
    if (brand === 'HIKVISION') return `/Streaming/Channels/${ch}${q === 'MAIN' ? '01' : '02'}`;
    if (brand === 'G-LENZ' || brand === 'GLENZ') return `/live/${ch}/${q === 'MAIN' ? 'MAIN' : 'SUB'}`;
    if (brand === 'DAHUA') return `/cam/realmonitor?channel=${ch}&subtype=${q === 'MAIN' ? '0' : '1'}`;
    if (brand === 'EZVIZ') return `/h264/ch${ch}/${q === 'MAIN' ? 'main' : 'sub'}/av_stream`;
    return `/stream${ch}`;
};

const CameraBatchModalInner = ({
    onClose,
    onSaveBatch,
    units = [],
    existingCameras = [],
    gatewayConfigured = false,
    saving = false
}) => {
    const dvrTemplates = useMemo(() => {
        const map = new Map();
        existingCameras
            .filter((c) => c.deviceType === 'DVR_NVR' && c.ipAddress)
            .forEach((c) => {
                const key = `${c.unitId || ''}|${c.brand}|${c.ipAddress}|${c.rtspPort || 554}`;
                if (!map.has(key)) map.set(key, c);
            });
        return Array.from(map.values());
    }, [existingCameras]);

    const firstTemplate = dvrTemplates[0] || null;
    const defaultUnitId = firstTemplate?.unitId ? String(firstTemplate.unitId) : (units[0]?.id ? String(units[0].id) : '');
    const initialUnitObj = units.find((u) => String(u.id) === defaultUnitId);

    const [selectedTemplateId, setSelectedTemplateId] = useState(firstTemplate ? String(firstTemplate.id) : '');
    const [unitId, setUnitId] = useState(defaultUnitId);
    const [namePrefix, setNamePrefix] = useState(initialUnitObj?.code || 'Kamera');
    const [brand, setBrand] = useState(firstTemplate?.brand || 'G-LENZ');
    const [ipAddress, setIpAddress] = useState(firstTemplate?.ipAddress || '');
    const [rtspPort, setRtspPort] = useState(firstTemplate?.rtspPort || 554);
    const [rtspUsername, setRtspUsername] = useState(firstTemplate?.rtspUsername || 'admin');
    const [rtspPassword, setRtspPassword] = useState(firstTemplate?.rtspPassword || '');
    const [rtspQuality, setRtspQuality] = useState(firstTemplate?.rtspQuality || 'SUB');
    const [showPassword, setShowPassword] = useState(false);

    const [startChannel, setStartChannel] = useState(1);
    const [endChannel, setEndChannel] = useState(12);
    const [skipExisting, setSkipExisting] = useState(true);
    const [customNames, setCustomNames] = useState({});
    const [excludedChannels, setExcludedChannels] = useState({});

    const existingChannelsSet = useMemo(() => {
        const set = new Set();
        const trimmedIp = ipAddress.trim();
        const parsedPort = Number(rtspPort) || 554;
        existingCameras.forEach((c) => {
            if (c.deviceType !== 'DVR_NVR') return;
            if (trimmedIp && c.ipAddress === trimmedIp && (Number(c.rtspPort) || 554) === parsedPort) {
                if (!unitId || String(c.unitId || '') === String(unitId)) {
                    set.add(Number(c.channelNo));
                }
            }
        });
        return set;
    }, [existingCameras, ipAddress, rtspPort, unitId]);

    const channelItems = useMemo(() => {
        const s = Math.max(1, Math.min(64, Number(startChannel) || 1));
        const e = Math.max(s, Math.min(s + 31, Math.min(64, Number(endChannel) || s)));
        const list = [];
        for (let ch = s; ch <= e; ch += 1) {
            const alreadyExists = existingChannelsSet.has(ch);
            const autoSkipped = skipExisting && alreadyExists;
            const checked = !autoSkipped && !excludedChannels[ch];
            const cleanPrefix = namePrefix.trim() || 'Kamera';
            list.push({
                channelNo: ch,
                name: customNames[ch] !== undefined ? customNames[ch] : `${cleanPrefix} Ch.${ch}`,
                alreadyExists,
                autoSkipped,
                checked,
                rtspPath: buildPreviewPath(brand, ch, rtspQuality)
            });
        }
        return list;
    }, [startChannel, endChannel, existingChannelsSet, skipExisting, excludedChannels, customNames, namePrefix, brand, rtspQuality]);

    const selectedChannels = useMemo(
        () => channelItems.filter((item) => item.checked && item.name.trim()),
        [channelItems]
    );

    const handleApplyTemplate = (camIdStr) => {
        setSelectedTemplateId(camIdStr);
        const tpl = dvrTemplates.find((c) => String(c.id) === camIdStr);
        if (!tpl) return;
        const tplUnitId = tpl.unitId ? String(tpl.unitId) : '';
        const unitObj = units.find((u) => String(u.id) === tplUnitId);
        setUnitId(tplUnitId);
        setBrand(tpl.brand || 'G-LENZ');
        setIpAddress(tpl.ipAddress || '');
        setRtspPort(tpl.rtspPort || 554);
        setRtspUsername(tpl.rtspUsername || 'admin');
        setRtspPassword(tpl.rtspPassword || '');
        setRtspQuality(tpl.rtspQuality || 'SUB');
        if (unitObj?.code) setNamePrefix(unitObj.code);
    };

    const handleUnitChange = (nextUnitId) => {
        setUnitId(nextUnitId);
        const unitObj = units.find((u) => String(u.id) === nextUnitId);
        if (unitObj?.code) setNamePrefix(unitObj.code);
    };

    const handleRangePreset = (s, e) => {
        setStartChannel(s);
        setEndChannel(e);
        setExcludedChannels({});
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!ipAddress.trim() || selectedChannels.length === 0) return;
        onSaveBatch({
            unitId: unitId ? parseInt(unitId, 10) : null,
            brand,
            ipAddress: ipAddress.trim(),
            rtspPort: parseInt(rtspPort, 10) || 554,
            rtspUsername: rtspUsername.trim() || 'admin',
            rtspPassword,
            rtspQuality,
            streamMode: 'GATEWAY',
            isActive: true,
            skipExisting,
            channels: selectedChannels.map((c) => ({
                channelNo: c.channelNo,
                name: c.name.trim(),
                sortOrder: c.channelNo - 1
            }))
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200">
                            <Layers size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">
                                Tambah Banyak Channel DVR Sekaligus (1 Klik)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Buat seluruh channel DVR (misal Ch.1–Ch.12) dalam satu formulir tanpa input berulang.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
                    {!gatewayConfigured && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                            <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                            <span>Gateway MediaMTX belum aktif. Pastikan statusnya hijau di tab Pengaturan &amp; Langkah Setting.</span>
                        </div>
                    )}

                    {/* Salin Pengaturan dari DVR yang Sudah Ada */}
                    {dvrTemplates.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                                <Sparkles size={15} className="text-indigo-600 shrink-0" />
                                <span>Salin IP, Port &amp; Password dari DVR yang Sudah Terdaftar:</span>
                            </div>
                            <select
                                value={selectedTemplateId}
                                onChange={(e) => handleApplyTemplate(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">-- Isi Manual --</option>
                                {dvrTemplates.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {(t.unit?.name || 'Umum')} • {t.brand} ({t.ipAddress}:{t.rtspPort || 554})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Konfigurasi DVR Bersama */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Unit Pendidikan</label>
                            <select
                                value={unitId}
                                onChange={(e) => handleUnitChange(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">-- Umum / Lintas Unit --</option>
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Awalan Nama Kamera</label>
                            <input
                                type="text"
                                value={namePrefix}
                                onChange={(e) => setNamePrefix(e.target.value)}
                                placeholder="Misal: SMAIT"
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Merek DVR/NVR</label>
                            <select
                                value={brand}
                                onChange={(e) => setBrand(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="G-LENZ">G-LENZ</option>
                                <option value="HIKVISION">Hikvision</option>
                                <option value="DAHUA">Dahua</option>
                                <option value="EZVIZ">EZVIZ</option>
                                <option value="LAINNYA">Lainnya (ONVIF/RTSP)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                IP Publik / LAN / VPN DVR <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={ipAddress}
                                onChange={(e) => setIpAddress(e.target.value)}
                                placeholder="180.241.160.22 atau 10.99.0.11"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Port RTSP</label>
                            <input
                                type="number"
                                value={rtspPort}
                                onChange={(e) => setRtspPort(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Kualitas RTSP</label>
                            <select
                                value={rtspQuality}
                                onChange={(e) => setRtspQuality(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                            >
                                <option value="SUB">Sub-Stream (Ringan)</option>
                                <option value="MAIN">Main-Stream (HD)</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Username RTSP</label>
                            <input
                                type="text"
                                value={rtspUsername}
                                onChange={(e) => setRtspUsername(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Password RTSP DVR/NVR</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={rtspPassword}
                                    onChange={(e) => setRtspPassword(e.target.value)}
                                    placeholder="••••••"
                                    className="w-full px-3 py-2 pr-9 rounded-lg border border-slate-300 text-sm font-mono bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Rentang Channel */}
                    <div className="flex flex-wrap items-end justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-center gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Dari Channel</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={64}
                                    value={startChannel}
                                    onChange={(e) => setStartChannel(e.target.value)}
                                    className="w-24 px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-center"
                                />
                            </div>
                            <span className="text-slate-400 pb-2 font-bold">s.d.</span>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Sampai Channel</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={64}
                                    value={endChannel}
                                    onChange={(e) => setEndChannel(e.target.value)}
                                    className="w-24 px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-center"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-500 mr-1">Cepat:</span>
                            {[
                                [1, 4],
                                [1, 8],
                                [1, 12],
                                [1, 16]
                            ].map(([s, e]) => (
                                <button
                                    key={`${s}-${e}`}
                                    type="button"
                                    onClick={() => handleRangePreset(s, e)}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-xs font-bold text-slate-700 transition-colors"
                                >
                                    Ch {s}–{e}
                                </button>
                            ))}
                        </div>

                        <label className="w-full inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                            <input
                                type="checkbox"
                                checked={skipExisting}
                                onChange={(e) => setSkipExisting(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600"
                            />
                            Otomatis lewati channel yang sudah terdaftar pada DVR &amp; IP ini
                        </label>
                    </div>

                    {/* Daftar Preview Channel */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <HardDrive size={14} className="text-indigo-600" />
                                Preview Channel yang Akan Dibuat ({selectedChannels.length} dipilih)
                            </span>
                            <span className="text-[11px] text-slate-500">
                                Bisa edit nama ruangan per channel sebelum disimpan
                            </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                            {channelItems.map((item) => (
                                <div
                                    key={item.channelNo}
                                    className={`px-4 py-2 flex items-center gap-3 ${item.autoSkipped ? 'bg-slate-50 opacity-60' : 'bg-white'}`}
                                >
                                    <input
                                        type="checkbox"
                                        disabled={item.autoSkipped}
                                        checked={item.checked}
                                        onChange={() =>
                                            setExcludedChannels((prev) => ({
                                                ...prev,
                                                [item.channelNo]: item.checked
                                            }))
                                        }
                                        className="w-4 h-4 rounded text-indigo-600 shrink-0"
                                    />
                                    <span className="text-xs font-bold text-slate-600 w-12 shrink-0">
                                        Ch.{item.channelNo}
                                    </span>
                                    <input
                                        type="text"
                                        disabled={!item.checked}
                                        value={item.name}
                                        onChange={(e) =>
                                            setCustomNames((prev) => ({
                                                ...prev,
                                                [item.channelNo]: e.target.value
                                            }))
                                        }
                                        className="flex-1 min-w-0 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium disabled:bg-slate-100"
                                    />
                                    <code className="hidden sm:inline-block text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                                        {item.rtspPath}
                                    </code>
                                    {item.alreadyExists && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold shrink-0">
                                            Sudah Ada
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        Tips: Jika setelah tersimpan ada channel tertentu yang gagal tampil di browser non-Chrome/perangkat lama, ubah pengaturan <em>Video Encoding Sub-Stream</em> channel tersebut di menu DVR menjadi <strong>H.264</strong>.
                    </p>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-white transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || !ipAddress.trim() || selectedChannels.length === 0}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold shadow-md shadow-indigo-200 transition-colors"
                    >
                        <Check size={16} />
                        {saving ? 'Membuat Channel...' : `Buat ${selectedChannels.length} Channel Sekaligus`}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CameraBatchModal = ({ isOpen, ...props }) => {
    if (!isOpen) return null;
    return <CameraBatchModalInner {...props} />;
};

export default CameraBatchModal;
