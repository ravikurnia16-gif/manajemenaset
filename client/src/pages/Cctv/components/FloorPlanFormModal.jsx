import { useEffect, useState } from 'react';
import { X, Upload, Map as MapIcon, Link as LinkIcon, Save } from 'lucide-react';
import api from '../../../lib/axios';

const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (/^(https?:|data:|blob:)/i.test(url)) return url;
    if (url.startsWith('/api/')) {
        const base = (api?.defaults?.baseURL || '/api').replace(/\/+$/, '');
        return base === '/api' ? url : `${base}${url.slice(4)}`;
    }
    return url;
};

const FloorPlanFormModalInner = ({
    onClose,
    onSave,
    initialData = null,
    units = [],
    saving = false
}) => {
    const [name, setName] = useState(initialData?.name || '');
    const [unitId, setUnitId] = useState(initialData?.unitId ? String(initialData.unitId) : '');
    const [floorLabel, setFloorLabel] = useState(initialData?.floorLabel || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0);
    const [imageFile, setImageFile] = useState(null);
    const [imageUrlInput, setImageUrlInput] = useState(initialData?.imageUrl || '');
    const [previewUrl, setPreviewUrl] = useState(() => resolveMediaUrl(initialData?.imageUrl || ''));
    const [useUrlMode, setUseUrlMode] = useState(false);

    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
        }
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (!initialData && !imageFile && !imageUrlInput.trim()) return;

        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('unitId', unitId || '');
        formData.append('floorLabel', floorLabel.trim());
        formData.append('description', description.trim());
        formData.append('sortOrder', String(parseInt(sortOrder, 10) || 0));

        if (imageFile) {
            formData.append('image', imageFile);
        } else if (imageUrlInput.trim()) {
            formData.append('imageUrl', imageUrlInput.trim());
        }

        onSave(formData, initialData?.id || null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
                            <MapIcon size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">
                                {initialData ? 'Edit Denah Lokasi CCTV' : 'Tambah Denah Lokasi CCTV'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                Unggah gambar denah gedung/area untuk menandai titik lokasi kamera.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Nama Denah <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Denah Lantai 1 Gedung SMAIT"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Unit / Sekolah</label>
                            <select
                                value={unitId}
                                onChange={(e) => setUnitId(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- Lintas Unit / Umum --</option>
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Lantai / Zona Area</label>
                            <input
                                type="text"
                                value={floorLabel}
                                onChange={(e) => setFloorLabel(e.target.value)}
                                placeholder="Contoh: Lantai 1 / Area Parkir"
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Upload Gambar Denah */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-700">
                                Gambar Denah {!initialData && <span className="text-rose-500">*</span>}
                            </label>
                            <button
                                type="button"
                                onClick={() => setUseUrlMode((prev) => !prev)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                            >
                                <LinkIcon size={12} /> {useUrlMode ? 'Unggah File Gambar' : 'Atau Pakai URL Gambar'}
                            </button>
                        </div>

                        {!useUrlMode ? (
                            <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-blue-50/40 hover:border-blue-400 cursor-pointer transition-colors text-center">
                                <Upload size={20} className="text-blue-600" />
                                <span className="text-xs font-semibold text-slate-700">
                                    {imageFile ? imageFile.name : (initialData ? 'Klik untuk mengganti gambar denah (opsional)' : 'Klik untuk memilih file denah (PNG, JPG, WEBP)')}
                                </span>
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                        ) : (
                            <input
                                type="text"
                                value={imageUrlInput}
                                onChange={(e) => {
                                    setImageFile(null);
                                    setImageUrlInput(e.target.value);
                                    setPreviewUrl(resolveMediaUrl(e.target.value));
                                }}
                                placeholder="https://... atau /api/media/..."
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        )}

                        {previewUrl && (
                            <div className="rounded-xl border border-slate-200 bg-slate-100 p-2 overflow-hidden">
                                <img
                                    src={previewUrl}
                                    alt="Preview Denah"
                                    className="max-h-56 w-full object-contain rounded-lg bg-white"
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan (Opsional)</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Catatan singkat cakupan denah..."
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Urutan</label>
                            <input
                                type="number"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim() || (!initialData && !imageFile && !imageUrlInput.trim())}
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                        >
                            <Save size={15} /> {saving ? 'Menyimpan...' : (initialData ? 'Simpan Perubahan' : 'Simpan Denah')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FloorPlanFormModal = ({ isOpen, initialData = null, ...props }) => {
    if (!isOpen) return null;
    return (
        <FloorPlanFormModalInner
            key={initialData?.id || 'new-floor-plan'}
            initialData={initialData}
            {...props}
        />
    );
};

export default FloorPlanFormModal;
