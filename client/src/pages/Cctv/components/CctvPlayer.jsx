import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
    Camera, Maximize2, Minimize2, RefreshCw, Volume2, VolumeX,
    Settings, AlertCircle, Wifi, HardDrive, Cctv, Wrench, Radio
} from 'lucide-react';
import api from '../../../lib/axios';
import { cn } from '../../../lib/utils';

const BRAND_BADGE_STYLES = {
    HIKVISION: 'bg-red-500/20 text-red-300 border-red-500/30',
    'G-LENZ': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    EZVIZ: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    DAHUA: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    LAINNYA: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
};

const getApiBase = () => (api?.defaults?.baseURL || '/api').replace(/\/+$/, '');

const resolveSessionUrl = (locationHeader) => {
    if (!locationHeader) return null;
    if (/^https?:\/\//i.test(locationHeader)) return locationHeader;
    if (locationHeader.startsWith('/api/')) {
        const base = getApiBase();
        if (base === '/api') return locationHeader;
        return `${base}${locationHeader.slice(4)}`;
    }
    return locationHeader;
};

/**
 * Permukaan pemutar aktif — di-mount ulang lewat React key setiap kali kamera/protokol/reload berubah
 * agar tidak perlu memanggil setState sinkron di dalam useEffect.
 */
const CctvStreamSurface = ({
    camera,
    targetProto,
    rawUrl,
    isGatewayMode,
    muted,
    canFallbackHls,
    videoRef,
    imgRef,
    onFallbackToHls,
    onReload,
    onStatusChange
}) => {
    const [status, setStatus] = useState('connecting'); // connecting | live | error | unsupported
    const [errorMsg, setErrorMsg] = useState('');
    const onStatusChangeRef = useRef(onStatusChange);

    useEffect(() => {
        onStatusChangeRef.current = onStatusChange;
    }, [onStatusChange]);

    const updateStatus = useCallback((nextStatus, nextErr = '') => {
        setStatus(nextStatus);
        setErrorMsg(nextErr);
        onStatusChangeRef.current?.(nextStatus);
    }, []);

    useEffect(() => {
        const videoEl = videoRef.current;
        const token = localStorage.getItem('token') || '';
        const apiBase = getApiBase();

        if (targetProto === 'IFRAME' || targetProto === 'MJPEG' || targetProto === 'VIDEO') {
            return undefined;
        }

        // --- MODE HLS (lewat hls.js atau Safari native) ---
        if (targetProto === 'HLS') {
            const hlsSource = isGatewayMode
                ? `${apiBase}/cctv/play/${camera.id}/hls/index.m3u8`
                : rawUrl;

            if (!Hls.isSupported()) {
                if (videoEl && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
                    const safariUrl = isGatewayMode && token
                        ? `${hlsSource}?token=${encodeURIComponent(token)}`
                        : hlsSource;
                    videoEl.src = safariUrl;
                    videoEl.play().catch(() => {});
                    return () => {
                        if (videoEl) {
                            videoEl.removeAttribute('src');
                            videoEl.load();
                        }
                    };
                }
                Promise.resolve().then(() => {
                    updateStatus('unsupported', 'Browser tidak mendukung pemutaran HLS.');
                });
                return undefined;
            }

            if (!videoEl) return undefined;

            let networkRetries = 0;
            const hls = new Hls({
                lowLatencyMode: true,
                backBufferLength: 10,
                liveSyncDurationCount: 2,
                liveMaxLatencyDurationCount: 5,
                manifestLoadingTimeOut: 25000,
                fragLoadingTimeOut: 20000,
                xhrSetup: (xhr) => {
                    if (isGatewayMode && token) {
                        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    }
                }
            });

            hls.loadSource(hlsSource);
            hls.attachMedia(videoEl);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoEl.play().catch(() => {});
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (!data.fatal) return;
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 1) {
                    networkRetries += 1;
                    setTimeout(() => {
                        try { hls.startLoad(); } catch { /* ignore */ }
                    }, 1500);
                    return;
                }
                if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                    return;
                }
                const detail = data?.response?.code
                    ? `Gateway mengembalikan HTTP ${data.response.code}. Pastikan MediaMTX aktif & IP kamera terjangkau.`
                    : 'Gagal memuat stream HLS dari MediaMTX / kamera.';
                updateStatus('error', detail);
                hls.destroy();
            });

            return () => {
                hls.destroy();
            };
        }

        // --- MODE WHEP / WebRTC (dengan fallback otomatis ke HLS bila UDP ICE terblokir) ---
        if (targetProto === 'WHEP') {
            let pc = null;
            let aborted = false;
            let sessionLocation = null;
            let fallbackTriggered = false;
            let iceTimer = null;

            const triggerFallbackOrError = (message) => {
                if (aborted || fallbackTriggered) return;
                if (canFallbackHls && onFallbackToHls) {
                    fallbackTriggered = true;
                    onFallbackToHls();
                    return;
                }
                updateStatus('error', message);
            };

            const startWhep = async () => {
                try {
                    const whepEndpoint = isGatewayMode
                        ? `${apiBase}/cctv/play/${camera.id}/whep`
                        : (rawUrl.endsWith('/whep') ? rawUrl : `${rawUrl.replace(/\/+$/, '')}/whep`);

                    pc = new RTCPeerConnection({
                        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                    });

                    pc.addTransceiver('video', { direction: 'recvonly' });
                    pc.addTransceiver('audio', { direction: 'recvonly' });

                    if (canFallbackHls) {
                        iceTimer = setTimeout(() => {
                            if (!aborted && pc && pc.connectionState !== 'connected') {
                                triggerFallbackOrError('WebRTC timeout.');
                            }
                        }, 6500);
                    }

                    pc.ontrack = (event) => {
                        if (aborted || !videoEl) return;
                        if (videoEl.srcObject !== event.streams[0]) {
                            videoEl.srcObject = event.streams[0];
                            videoEl.play().catch(() => {});
                            if (iceTimer) clearTimeout(iceTimer);
                            updateStatus('live');
                        }
                    };

                    pc.onconnectionstatechange = () => {
                        if (aborted || !pc) return;
                        if (pc.connectionState === 'connected') {
                            if (iceTimer) clearTimeout(iceTimer);
                            updateStatus('live');
                        } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
                            triggerFallbackOrError('Koneksi WebRTC terputus. Coba muat ulang atau pindah ke HLS.');
                        }
                    };

                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    const headers = { 'Content-Type': 'application/sdp' };
                    if (isGatewayMode && token) {
                        headers.Authorization = `Bearer ${token}`;
                    }

                    const res = await fetch(whepEndpoint, {
                        method: 'POST',
                        headers,
                        body: offer.sdp
                    });

                    if (!res.ok) {
                        const errBody = await res.text().catch(() => '');
                        throw new Error(errBody || `HTTP ${res.status} dari gateway streaming`);
                    }

                    sessionLocation = resolveSessionUrl(res.headers.get('Location'));
                    const answerSdp = await res.text();
                    if (!aborted && pc) {
                        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
                    }
                } catch (err) {
                    triggerFallbackOrError(err.message || 'Gagal terhubung ke gateway WebRTC.');
                }
            };

            startWhep();

            return () => {
                aborted = true;
                if (iceTimer) clearTimeout(iceTimer);
                if (pc) {
                    try { pc.close(); } catch { /* ignore */ }
                }
                if (videoEl) {
                    videoEl.srcObject = null;
                }
                if (sessionLocation) {
                    const delHeaders = isGatewayMode && token ? { Authorization: `Bearer ${token}` } : {};
                    fetch(sessionLocation, { method: 'DELETE', headers: delHeaders }).catch(() => {});
                }
            };
        }

        return undefined;
    }, [camera.id, targetProto, rawUrl, isGatewayMode, canFallbackHls, onFallbackToHls, videoRef, updateStatus]);

    return (
        <>
            {(targetProto === 'WHEP' || targetProto === 'HLS' || targetProto === 'VIDEO') && (
                <video
                    ref={videoRef}
                    src={targetProto === 'VIDEO' ? rawUrl : undefined}
                    autoPlay
                    muted={muted}
                    playsInline
                    loop={targetProto === 'VIDEO'}
                    controls={targetProto === 'VIDEO'}
                    onPlaying={() => updateStatus('live')}
                    onError={() => {
                        if (targetProto === 'VIDEO') {
                            updateStatus('error', 'Gagal memutar video stream dari URL tersebut.');
                        }
                    }}
                    className="w-full h-full object-contain bg-black"
                />
            )}

            {targetProto === 'IFRAME' && (
                <iframe
                    src={rawUrl}
                    title={camera.name}
                    allow="autoplay; fullscreen; encrypted-media"
                    allowFullScreen
                    onLoad={() => updateStatus('live')}
                    className="w-full h-full border-0 bg-black"
                />
            )}

            {targetProto === 'MJPEG' && (
                <img
                    ref={imgRef}
                    src={rawUrl}
                    alt={camera.name}
                    crossOrigin="anonymous"
                    onLoad={() => updateStatus('live')}
                    onError={() => updateStatus('error', 'Stream gambar/MJPEG gagal dimuat.')}
                    className="w-full h-full object-contain bg-black"
                />
            )}

            {status === 'connecting' && (
                <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 text-slate-300 pointer-events-none">
                    <Radio size={26} className="text-blue-400 animate-ping" />
                    <span className="text-xs font-semibold tracking-wide">
                        Menghubungkan stream ({targetProto === 'WHEP' ? 'WebRTC' : targetProto})...
                    </span>
                </div>
            )}

            {(status === 'error' || status === 'unsupported') && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                        <AlertCircle size={22} />
                    </div>
                    <p className="text-xs font-bold text-rose-300">
                        {status === 'unsupported' ? 'Format Tidak Didukung Browser Ini' : 'Stream Tidak Terhubung'}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed">{errorMsg}</p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                        <button
                            type="button"
                            onClick={onReload}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
                        >
                            <RefreshCw size={12} /> Coba Sambung Ulang
                        </button>
                        {targetProto === 'WHEP' && canFallbackHls && onFallbackToHls && (
                            <button
                                type="button"
                                onClick={onFallbackToHls}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                            >
                                Putar via HLS
                            </button>
                        )}
                    </div>
                </div>
            )}

            {status === 'live' && (
                <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/65 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE • {targetProto === 'WHEP' ? 'WEBRTC' : targetProto}
                </div>
            )}
        </>
    );
};

const CctvPlayer = ({
    camera,
    isExpanded = false,
    onToggleExpand,
    canManage = false,
    onEditCamera,
    onOpenGateway,
    compact = false
}) => {
    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const imgRef = useRef(null);

    const [muted, setMuted] = useState(true);
    const [reloadTick, setReloadTick] = useState(0);
    const [gatewayProtoOverride, setGatewayProtoOverride] = useState(null); // null | 'WHEP' | 'HLS'
    const [liveIndicator, setLiveIndicator] = useState('idle');
    const [snapshotErr, setSnapshotErr] = useState('');

    const rawUrl = (camera.streamUrl || '').trim();
    const isGatewayMode = Boolean(camera.playback?.gateway || camera.streamMode === 'GATEWAY');

    let precheckState = null;
    if (!camera.isActive) {
        precheckState = 'maintenance';
    } else if (isGatewayMode) {
        if (camera.playback && !camera.playback.hasSource) {
            precheckState = 'no_source';
        } else if (camera.playback && !camera.playback.ready) {
            precheckState = 'gateway_not_ready';
        }
    } else if (!rawUrl) {
        precheckState = 'no_url';
    }

    const canWhep = Boolean(camera.playback?.whep);
    const canHls = Boolean(camera.playback?.hls);

    let targetProto = (camera.streamMode || 'GATEWAY').toUpperCase();
    if (isGatewayMode) {
        if (gatewayProtoOverride) {
            targetProto = gatewayProtoOverride;
        } else if (canWhep) {
            targetProto = 'WHEP';
        } else {
            targetProto = 'HLS';
        }
    }

    const handleTakeSnapshot = () => {
        setSnapshotErr('');
        try {
            const canvas = document.createElement('canvas');
            let width = 1280;
            let height = 720;
            let sourceEl = null;

            if ((targetProto === 'WHEP' || targetProto === 'HLS' || targetProto === 'VIDEO') && videoRef.current?.videoWidth > 0) {
                sourceEl = videoRef.current;
                width = videoRef.current.videoWidth;
                height = videoRef.current.videoHeight;
            } else if (targetProto === 'MJPEG' && imgRef.current?.naturalWidth > 0) {
                sourceEl = imgRef.current;
                width = imgRef.current.naturalWidth;
                height = imgRef.current.naturalHeight;
            }

            if (!sourceEl) return;
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(sourceEl, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const safeName = (camera.name || 'cctv').toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.download = `cctv-${safeName}-${stamp}.png`;
            link.href = dataUrl;
            link.click();
        } catch {
            setSnapshotErr('Snapshot diblokir oleh kebijakan CORS server video.');
        }
    };

    const handleNativeFullscreen = () => {
        if (onToggleExpand) {
            onToggleExpand(camera.id);
        } else if (containerRef.current?.requestFullscreen) {
            containerRef.current.requestFullscreen().catch(() => {});
        }
    };

    const brandClass = BRAND_BADGE_STYLES[camera.brand] || BRAND_BADGE_STYLES.LAINNYA;
    const effectiveDotStatus = precheckState || liveIndicator;
    const streamKey = `${camera.id}-${targetProto}-${rawUrl}-${reloadTick}`;

    return (
        <div
            ref={containerRef}
            className={cn(
                'group relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-lg flex flex-col transition-all',
                isExpanded ? 'ring-2 ring-blue-500 shadow-blue-500/20' : 'hover:border-slate-700'
            )}
        >
            {/* Header Bar */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/95 border-b border-slate-800/90 z-10">
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className={cn(
                            'w-2.5 h-2.5 rounded-full shrink-0',
                            effectiveDotStatus === 'live' && 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse',
                            effectiveDotStatus === 'connecting' && 'bg-amber-400 animate-pulse',
                            effectiveDotStatus === 'maintenance' && 'bg-amber-500',
                            (effectiveDotStatus === 'error' || effectiveDotStatus === 'unsupported') && 'bg-rose-500',
                            ['idle', 'no_url', 'no_source', 'gateway_not_ready'].includes(effectiveDotStatus) && 'bg-slate-500'
                        )}
                        title={`Status: ${effectiveDotStatus}`}
                    />
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                                {camera.name}
                            </h3>
                            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0', brandClass)}>
                                {camera.brand}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 truncate">
                            <span className="truncate font-medium text-slate-300">
                                {camera.unit?.name || 'Umum / Lintas Unit'}
                            </span>
                            {camera.location && (
                                <span className="truncate text-slate-500">• {camera.location}</span>
                            )}
                            <span className="inline-flex items-center gap-0.5 text-slate-500 shrink-0">
                                {camera.deviceType === 'WIFI_CAMERA' ? (
                                    <><Wifi size={10} /> WiFi</>
                                ) : (
                                    <><HardDrive size={10} /> DVR Ch.{camera.channelNo}</>
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-1 shrink-0">
                    {isGatewayMode && !precheckState && canWhep && canHls && (
                        <button
                            type="button"
                            onClick={() => setGatewayProtoOverride(targetProto === 'WHEP' ? 'HLS' : 'WHEP')}
                            className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            title="Ganti protokol pemutar (WebRTC / HLS)"
                        >
                            {targetProto === 'WHEP' ? 'WebRTC' : 'HLS'}
                        </button>
                    )}

                    {(targetProto === 'WHEP' || targetProto === 'HLS' || targetProto === 'VIDEO') && liveIndicator === 'live' && (
                        <>
                            <button
                                type="button"
                                onClick={() => setMuted((m) => !m)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title={muted ? 'Nyalakan Audio' : 'Bisukan Audio'}
                            >
                                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                            </button>
                            <button
                                type="button"
                                onClick={handleTakeSnapshot}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title="Tangkap Gambar (Screenshot)"
                            >
                                <Camera size={14} />
                            </button>
                        </>
                    )}
                    {targetProto === 'MJPEG' && liveIndicator === 'live' && (
                        <button
                            type="button"
                            onClick={handleTakeSnapshot}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Tangkap Gambar"
                        >
                            <Camera size={14} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setReloadTick((t) => t + 1)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Muat Ulang Stream"
                    >
                        <RefreshCw size={14} />
                    </button>
                    {canManage && onEditCamera && (
                        <button
                            type="button"
                            onClick={() => onEditCamera(camera)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                            title="Pengaturan Kamera"
                        >
                            <Settings size={14} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleNativeFullscreen}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title={isExpanded ? 'Perkecil Tampilan' : 'Perbesar Kamera'}
                    >
                        {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                </div>
            </div>

            {/* Video Canvas Area */}
            <div className={cn('relative w-full bg-slate-950 flex items-center justify-center overflow-hidden', compact ? 'aspect-video' : 'aspect-video')}>
                {!precheckState ? (
                    <CctvStreamSurface
                        key={streamKey}
                        camera={camera}
                        targetProto={targetProto}
                        rawUrl={rawUrl}
                        isGatewayMode={isGatewayMode}
                        muted={muted}
                        canFallbackHls={isGatewayMode && canHls && targetProto === 'WHEP'}
                        videoRef={videoRef}
                        imgRef={imgRef}
                        onFallbackToHls={() => setGatewayProtoOverride('HLS')}
                        onReload={() => setReloadTick((t) => t + 1)}
                        onStatusChange={setLiveIndicator}
                    />
                ) : precheckState === 'maintenance' ? (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            <Wrench size={24} />
                        </div>
                        <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Kamera Nonaktif / Maintenance</p>
                        <p className="text-[11px] text-slate-400 max-w-xs">
                            Kamera ini sementara dinonaktifkan oleh Kepala Bidang Sarana.
                        </p>
                    </div>
                ) : precheckState === 'gateway_not_ready' ? (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            <Settings size={24} />
                        </div>
                        <p className="text-xs font-bold text-amber-300">Gateway MediaMTX Belum Diatur</p>
                        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                            {canManage
                                ? 'Lengkapi pengaturan server Gateway MediaMTX di tab "Pengaturan & Gateway" agar kamera ini dapat ditayangkan.'
                                : 'Gateway video sedang dikonfigurasi oleh Kepala Bidang Sarana.'}
                        </p>
                        {canManage && onOpenGateway && (
                            <button
                                type="button"
                                onClick={onOpenGateway}
                                className="mt-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                            >
                                Buka Pengaturan Gateway
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400">
                            <Cctv size={24} />
                        </div>
                        <p className="text-xs font-bold text-slate-300">
                            {precheckState === 'no_source' ? 'IP / Sumber RTSP Belum Diisi' : 'URL Stream Belum Diatur'}
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-xs">
                            {canManage
                                ? 'Isi IP Kamera/DVR dan password RTSP di pengaturan kamera agar video muncul.'
                                : 'Konfigurasi kamera sedang dipersiapkan oleh Kepala Bidang Sarana.'}
                        </p>
                        {canManage && onEditCamera && (
                            <button
                                type="button"
                                onClick={() => onEditCamera(camera)}
                                className="mt-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                            >
                                Lengkapi Data Kamera
                            </button>
                        )}
                    </div>
                )}

                {snapshotErr && (
                    <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded bg-rose-900/90 text-rose-100 text-[10px] font-semibold">
                        {snapshotErr}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CctvPlayer;
