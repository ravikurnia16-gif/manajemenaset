import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Car, Camera, Save, ArrowLeft, Trash2, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import api from '../lib/axios';

const VehicleInspectionForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Photos state
    const [photos, setPhotos] = useState({
        frontPhoto: null,
        rightPhoto: null,
        leftPhoto: null,
        backPhoto: null
    });
    const [previews, setPreviews] = useState({
        frontPhoto: null,
        rightPhoto: null,
        leftPhoto: null,
        backPhoto: null
    });

    // Scratches state: { side: 'frontPhoto', x: 50, y: 50, severity: 'light' }
    const [scratches, setScratches] = useState([]);
    const [activeSide, setActiveSide] = useState('frontPhoto');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        fetchVehicle();
    }, [id]);

    const fetchVehicle = async () => {
        try {
            const res = await api.get(`/vehicles/${id}`);
            setVehicle(res.data);
        } catch (error) {
            console.error('Failed to fetch vehicle:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (side, e) => {
        const file = e.target.files[0];
        if (!file) return;

        setPhotos(prev => ({ ...prev, [side]: file }));
        setPreviews(prev => ({ ...prev, [side]: URL.createObjectURL(file) }));
        setActiveSide(side);
    };

    const handlePhotoClick = (e) => {
        if (!previews[activeSide]) return;

        const rect = e.target.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Add a light scratch by default, user can change it
        const newScratch = {
            id: Date.now(),
            side: activeSide,
            x,
            y,
            severity: 'light'
        };

        setScratches(prev => [...prev, newScratch]);
    };

    const updateScratchSeverity = (scratchId, severity) => {
        setScratches(prev => prev.map(s => 
            s.id === scratchId ? { ...s, severity } : s
        ));
    };

    const removeScratch = (scratchId) => {
        setScratches(prev => prev.filter(s => s.id !== scratchId));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Basic validation
        if (!photos.frontPhoto && !photos.backPhoto && !photos.leftPhoto && !photos.rightPhoto) {
            alert('Mohon unggah setidaknya satu foto sisi kendaraan.');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('vehicleId', id);
            formData.append('notes', notes);
            formData.append('scratches', JSON.stringify(scratches));
            
            Object.keys(photos).forEach(side => {
                if (photos[side]) {
                    formData.append(side, photos[side]);
                }
            });

            await api.post('/vehicle-inspections', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Inspeksi berhasil disimpan');
            navigate(`/kendaraan/data`);
        } catch (error) {
            console.error('Failed to save inspection:', error);
            alert('Gagal menyimpan inspeksi: ' + (error.response?.data?.error || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Loading...</div>;
    if (!vehicle) return <div className="p-10 text-center">Kendaraan tidak ditemukan</div>;

    const sideLabels = {
        frontPhoto: 'Depan',
        rightPhoto: 'Kanan',
        leftPhoto: 'Kiri',
        backPhoto: 'Belakang'
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                        <ArrowLeft className="text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Inspeksi Goresan</h1>
                        <p className="text-slate-500 font-medium">
                            {vehicle.name} • <span className="uppercase font-mono text-blue-600 font-bold">{vehicle.plateNumber}</span>
                        </p>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold">
                    <Info size={18} />
                    Klik pada foto untuk menandai goresan
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-700">
                <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-blue-700 leading-relaxed">
                    <span className="font-bold block mb-1 uppercase tracking-tight text-[10px]">Tips Unggahan Foto:</span>
                    <ul className="list-disc list-inside space-y-1 text-xs font-medium">
                        <li>Gunakan resolusi **720p atau 1080p** (Maksimal 1920x1080).</li>
                        <li>Rasio foto dianjurkan **4:3 atau 16:9** (Potret atau Lanskap).</li>
                        <li>Ukuran file dianjurkan **di bawah 2MB** per foto agar pengunggahan cepat.</li>
                        <li>Pastikan pencahayaan cukup agar goresan bodi terlihat jelas pada layar editor.</li>
                    </ul>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Photo Selectors */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Camera size={18} className="text-blue-600" /> Pilih Sisi Kendaraan
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.keys(sideLabels).map(side => (
                                <div key={side} className="relative group">
                                    <input 
                                        type="file" 
                                        id={side} 
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleFileChange(side, e)}
                                    />
                                    <label 
                                        htmlFor={side}
                                        className={`flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed transition-all cursor-pointer relative overflow-hidden ${
                                            activeSide === side 
                                                ? 'border-blue-500 bg-blue-50' 
                                                : previews[side] 
                                                    ? 'border-green-200 bg-green-50' 
                                                    : 'border-slate-200 bg-slate-50 hover:border-blue-300'
                                        }`}
                                        onClick={() => setActiveSide(side)}
                                    >
                                        {previews[side] ? (
                                            <img src={previews[side]} alt={side} className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <Camera className="text-slate-400 mb-2" size={24} />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">{sideLabels[side]}</span>
                                            </>
                                        )}
                                        
                                        {/* Badge count */}
                                        {scratches.filter(s => s.side === side).length > 0 && (
                                            <div className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                                                {scratches.filter(s => s.side === side).length}
                                            </div>
                                        )}

                                        {/* Status indicator */}
                                        <div className={`absolute bottom-0 left-0 right-0 py-1 text-center text-[8px] font-bold uppercase tracking-tighter ${
                                            activeSide === side ? 'bg-blue-500 text-white' : 'bg-transparent text-transparent'
                                        }`}>
                                            Sedang Diedit
                                        </div>
                                    </label>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Catatan Tambahan</label>
                                <textarea 
                                    className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none text-sm"
                                    placeholder="Jelaskan detail goresan jika perlu..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                ></textarea>
                            </div>
                            
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                            >
                                {submitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Save size={20} />}
                                Simpan Inspeksi
                            </button>
                        </div>
                    </div>
                </div>

                {/* Interactive Editor */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[500px]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800 text-lg uppercase tracking-wider flex items-center gap-2">
                                <Info className="text-blue-500" size={20} />
                                Editor: Tampak {sideLabels[activeSide]}
                            </h3>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold border border-green-100">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div> Ringan
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-[10px] font-bold border border-yellow-100">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div> Sedang
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-bold border border-red-100">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div> Berat
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-slate-100 relative group overflow-hidden p-4">
                            {previews[activeSide] ? (
                                <div className="relative inline-block cursor-crosshair shadow-xl rounded-lg overflow-hidden">
                                    <img 
                                        src={previews[activeSide]} 
                                        alt="Editor" 
                                        className="max-w-full max-h-[600px] object-contain select-none"
                                        onClick={handlePhotoClick}
                                    />
                                    
                                    {/* Render Dots */}
                                    {scratches.filter(s => s.side === activeSide).map(scratch => (
                                        <div 
                                            key={scratch.id}
                                            className="absolute group/dot"
                                            style={{ 
                                                left: `${scratch.x}%`, 
                                                top: `${scratch.y}%`,
                                                transform: 'translate(-50%, -50%)' 
                                            }}
                                        >
                                            <div className={`w-6 h-6 rounded-full border-2 border-white shadow-lg animate-pulse ${
                                                scratch.severity === 'light' ? 'bg-green-500' : 
                                                scratch.severity === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}></div>
                                            
                                            {/* Tooltip Popup */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 opacity-0 group-hover/dot:opacity-100 transition-opacity pointer-events-auto z-50 flex gap-1 items-center">
                                                <button 
                                                    type="button"
                                                    onClick={() => updateScratchSeverity(scratch.id, 'light')}
                                                    className={`w-6 h-6 rounded-full bg-green-500 border-2 ${scratch.severity === 'light' ? 'border-blue-600 scale-110' : 'border-white'}`}
                                                ></button>
                                                <button 
                                                    type="button"
                                                    onClick={() => updateScratchSeverity(scratch.id, 'medium')}
                                                    className={`w-6 h-6 rounded-full bg-yellow-500 border-2 ${scratch.severity === 'medium' ? 'border-blue-600 scale-110' : 'border-white'}`}
                                                ></button>
                                                <button 
                                                    type="button"
                                                    onClick={() => updateScratchSeverity(scratch.id, 'heavy')}
                                                    className={`w-6 h-6 rounded-full bg-red-500 border-2 ${scratch.severity === 'heavy' ? 'border-blue-600 scale-110' : 'border-white'}`}
                                                ></button>
                                                <div className="w-[1px] h-4 bg-slate-100 mx-1"></div>
                                                <button 
                                                    type="button"
                                                    onClick={() => removeScratch(scratch.id)}
                                                    className="p-1 px-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center p-10">
                                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Camera className="text-slate-400" size={32} />
                                    </div>
                                    <h4 className="text-slate-600 font-bold mb-1">Belum Ada Foto</h4>
                                    <p className="text-slate-400 text-sm max-w-sm">
                                        Silakan pilih dan unggah foto tampak {sideLabels[activeSide]} terlebih dahulu untuk mulai menandai goresan.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default VehicleInspectionForm;
