import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, Check, Loader2, AlertCircle } from 'lucide-react';

/**
 * Interactive Live Camera Viewfinder Modal for Real-Time Field Photo Documentation
 */
export default function LiveCameraModal({ isOpen, onClose, onCapture, pointIndex, period }) {
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' | 'user'
    const [cameraError, setCameraError] = useState(null);
    const [isStarting, setIsStarting] = useState(true);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [captureFeedback, setCaptureFeedback] = useState(null);

    // Start video stream
    useEffect(() => {
        if (!isOpen) return;

        let activeStream = null;
        let isCancelled = false;

        const startCamera = async () => {
            setIsStarting(true);
            setIsVideoReady(false);
            setCameraError(null);
            setCaptureFeedback(null);

            try {
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                }

                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Kamera langsung (WebRTC) tidak didukung pada browser ini atau membutuhkan koneksi aman (HTTPS).');
                }

                const constraints = {
                    video: {
                        facingMode: { ideal: cameraFacing },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                };

                const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                if (isCancelled) {
                    newStream.getTracks().forEach(t => t.stop());
                    return;
                }

                activeStream = newStream;
                setStream(newStream);

                if (videoRef.current) {
                    const video = videoRef.current;
                    video.srcObject = newStream;
                    video.muted = true;
                    video.defaultMuted = true;
                    video.playsInline = true;
                    video.setAttribute('playsinline', '');
                    video.setAttribute('webkit-playsinline', '');
                    try {
                        await video.play();
                    } catch (e) {
                        console.warn('Video auto-play warning:', e);
                    }
                }
            } catch (err) {
                console.error('Camera access error:', err);
                setCameraError(
                    'Tidak dapat mengakses kamera langsung. Pastikan izin kamera aktif atau gunakan tombol Kamera Bawaan HP di bawah.'
                );
                setIsStarting(false);
            }
        };

        startCamera();

        return () => {
            isCancelled = true;
            if (activeStream) {
                activeStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [isOpen, cameraFacing]);

    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const takeSnapshot = async () => {
        setCaptureFeedback(null);

        // 1. Try modern W3C ImageCapture API first (Chrome Android & Desktop)
        const track = stream?.getVideoTracks?.()?.[0];
        if (typeof window !== 'undefined' && 'ImageCapture' in window && track && track.readyState === 'live') {
            try {
                const imageCapture = new window.ImageCapture(track);
                const blob = await imageCapture.takePhoto();
                if (blob && blob.size > 1000) {
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    if (dataUrl) {
                        setCapturedImage(dataUrl);
                        return;
                    }
                }
            } catch (icErr) {
                console.warn('ImageCapture fallback to canvas drawImage:', icErr);
            }
        }

        // 2. Fallback: Draw frame from <video> element to HTML5 Canvas
        if (!videoRef.current) return;
        const video = videoRef.current;

        if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
            setCaptureFeedback('Lensa kamera sedang memuat frame. Mohon tunggu 1 detik lalu jepret lagi.');
            return;
        }

        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(video, 0, 0, width, height);

        // Verify canvas is not pure pitch black (0,0,0)
        try {
            const sampleW = Math.min(width, 30);
            const sampleH = Math.min(height, 30);
            const imgData = ctx.getImageData(0, 0, sampleW, sampleH).data;
            let sum = 0;
            for (let i = 0; i < imgData.length; i += 4) {
                sum += imgData[i] + imgData[i + 1] + imgData[i + 2];
            }
            const avg = sum / (sampleW * sampleH * 3);
            if (avg < 2) {
                setCaptureFeedback('Frame terdeteksi gelap kosong. Tunggu 1 detik atau gunakan Kamera Bawaan HP.');
                return;
            }
        } catch (e) {
            console.warn('Black frame check warning:', e);
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setCapturedImage(dataUrl);
    };

    const retake = () => {
        setCapturedImage(null);
        setCaptureFeedback(null);
    };

    const confirmUsePhoto = () => {
        if (capturedImage) {
            onCapture(capturedImage, pointIndex, period);
            stopStream();
            onClose();
        }
    };

    const handleClose = () => {
        stopStream();
        setCapturedImage(null);
        setCaptureFeedback(null);
        onClose();
    };

    const switchCamera = () => {
        setIsVideoReady(false);
        setIsStarting(true);
        setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-lg bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-slate-900/90 text-white z-10 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                            <Camera size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black tracking-tight">Kamera Langsung</h3>
                            <p className="text-[10px] text-slate-400">Bukti kegiatan {period === 'morning' ? 'Sesi Pagi' : 'Sesi Siang'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Viewfinder / Preview */}
                <div className="relative flex-1 bg-black flex items-center justify-center min-h-[320px] sm:min-h-[420px] overflow-hidden">
                    {cameraError ? (
                        <div className="p-6 text-center text-slate-300 space-y-4 max-w-sm">
                            <AlertCircle size={40} className="mx-auto text-rose-500" />
                            <div className="space-y-1">
                                <h4 className="text-xs font-black text-white">Kamera Langsung Terkendala</h4>
                                <p className="text-[11px] text-slate-400">{cameraError}</p>
                            </div>
                            <div className="pt-2 flex flex-col gap-2">
                                <label className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95">
                                    <Camera size={16} />
                                    <span>Gunakan Kamera Bawaan HP</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                onCapture(e.target.files[0], pointIndex, period);
                                                handleClose();
                                            }
                                        }}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={switchCamera}
                                    className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                                >
                                    Coba Alihkan Kamera
                                </button>
                            </div>
                        </div>
                    ) : capturedImage ? (
                        <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <img 
                                src={capturedImage} 
                                alt="Hasil Tangkapan Kamera" 
                                className="w-full h-full object-contain max-h-[60vh]"
                            />
                            <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-md flex items-center gap-1.5">
                                <Check size={12} strokeWidth={3} />
                                <span>Foto Siap Digunakan</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                onLoadedMetadata={() => {
                                    if (videoRef.current) {
                                        videoRef.current.play().catch(e => console.warn(e));
                                    }
                                }}
                                onCanPlay={() => {
                                    setIsVideoReady(true);
                                    setIsStarting(false);
                                }}
                                onPlaying={() => {
                                    setIsVideoReady(true);
                                    setIsStarting(false);
                                }}
                                className="w-full h-full object-contain max-h-[60vh]"
                            />

                            {/* Camera Readiness Badge */}
                            {isVideoReady && !isStarting && (
                                <div className="absolute top-3 right-3 bg-emerald-600/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-md">
                                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                                    <span>Lensa Aktif</span>
                                </div>
                            )}

                            {isStarting && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 text-white">
                                    <Loader2 className="animate-spin text-blue-500" size={32} />
                                    <span className="text-xs font-bold">Menghubungkan ke lensa kamera...</span>
                                    <span className="text-[10px] text-slate-400">Pastikan izin kamera disetujui</span>
                                </div>
                            )}

                            {/* Alert Feedback Banner */}
                            {captureFeedback && (
                                <div className="absolute bottom-4 inset-x-4 bg-amber-500/90 text-slate-950 px-3 py-2 rounded-xl text-xs font-bold text-center shadow-lg animate-in slide-in-from-bottom-2">
                                    {captureFeedback}
                                </div>
                            )}

                            {/* Visual Grid Lines */}
                            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-20 border border-white/20">
                                <div className="border-r border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div className="border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div className="border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div></div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-900 text-white flex items-center justify-around border-t border-slate-800">
                    {capturedImage ? (
                        <div className="flex items-center gap-3 w-full">
                            <button
                                type="button"
                                onClick={retake}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                <RefreshCw size={15} /> Foto Ulang
                            </button>
                            <button
                                type="button"
                                onClick={confirmUsePhoto}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/30 cursor-pointer active:scale-95"
                            >
                                <Check size={16} strokeWidth={3} /> Gunakan Foto Ini
                            </button>
                        </div>
                    ) : !cameraError ? (
                        <div className="flex items-center justify-between w-full px-4 sm:px-6">
                            {/* Switch Camera Front/Back */}
                            <button
                                type="button"
                                onClick={switchCamera}
                                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl transition-all cursor-pointer active:scale-90"
                                title="Balik Kamera (Depan / Belakang)"
                            >
                                <RefreshCw size={18} />
                            </button>

                            {/* Big Circular Shutter Button */}
                            <button
                                type="button"
                                onClick={takeSnapshot}
                                disabled={isStarting || !isVideoReady}
                                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white p-1 flex items-center justify-center shadow-xl active:scale-90 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Jepret Foto"
                            >
                                <div className="w-full h-full rounded-full bg-blue-600 hover:bg-blue-700 border-4 border-white transition-all flex items-center justify-center text-white">
                                    <Camera size={24} />
                                </div>
                            </button>

                            {/* Alternative: Native Camera Upload (Clear & Prominent) */}
                            <label 
                                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-2xl transition-all cursor-pointer active:scale-90 flex items-center gap-1.5 border border-slate-700 shadow-sm"
                                title="Gunakan Aplikasi Kamera Bawaan HP Langsung"
                            >
                                <Camera size={16} className="text-amber-400" />
                                <span className="text-[11px] font-bold">Kamera HP</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            onCapture(e.target.files[0], pointIndex, period);
                                            handleClose();
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                            Tutup Kamera
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
