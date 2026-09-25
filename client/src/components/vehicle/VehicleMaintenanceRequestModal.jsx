import React, { useState, useEffect } from 'react';
import { X, Car, Wrench, Calendar, Gauge, DollarSign, AlertCircle, Upload, Check, Plus, Trash2 } from 'lucide-react';
import api from '../../lib/axios';

const ROUTINE_COMPONENTS_BY_TYPE = {
    MOTOR: [
        'Oli Mesin', 'Busi', 'Filter Udara', 'Oli Gardan (Matic)', 'V-Belt (Matic)', 
        'Roller (Matic)', 'Rantai & Gir', 'Kampas Rem', 'Minyak Rem', 'Ban', 'Aki', 'Tune Up'
    ],
    BUS: [
        'Oli Mesin', 'Filter Oli', 'Oli Transmisi', 'Oli Gardan', 'Filter Udara', 'Filter AC', 
        'Filter BBM / Solar', 'Kampas Rem', 'Minyak Rem', 'Ban', 'Spooring & Balancing', 
        'Aki', 'Air Radiator', 'Greasing / Pelumasan', 'Sistem Pneumatik', 'Tune Up'
    ],
    GENERAL: [
        'Oli Mesin', 'Filter Oli', 'Oli Transmisi', 'Oli Gardan', 'Filter Udara', 'Filter AC', 
        'Filter BBM', 'Kampas Rem', 'Ban (Rotasi/Ganti)', 'Spooring & Balancing', 'Aki', 
        'Air Radiator', 'Minyak Rem', 'Busi', 'Tune Up'
    ]
};

function resolveCategory(vehicleType = '') {
    const t = vehicleType.toLowerCase();
    if (t.includes('motor') || t.includes('sepeda')) return 'MOTOR';
    if (t.includes('bus') || t.includes('microbus')) return 'BUS';
    return 'GENERAL';
}

export default function VehicleMaintenanceRequestModal({ show, onClose, onSuccess, vehicles = [] }) {
    const [localVehicles, setLocalVehicles] = useState(vehicles);
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [category, setCategory] = useState('ROUTINE');
    const [type, setType] = useState('SERVICE_RUTIN');
    const [urgency, setUrgency] = useState('NORMAL');
    const [odometer, setOdometer] = useState('');
    const [estimatedCost, setEstimatedCost] = useState('');
    const [workshop, setWorkshop] = useState('');
    const [description, setDescription] = useState('');
    const [selectedComponents, setSelectedComponents] = useState([]);
    const [customComponent, setCustomComponent] = useState('');
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (vehicles && vehicles.length > 0) {
            setLocalVehicles(vehicles);
        } else if (show) {
            api.get('/vehicles')
                .then(res => setLocalVehicles(Array.isArray(res.data) ? res.data : []))
                .catch(err => console.error('Fetch vehicles error:', err));
        }
    }, [vehicles, show]);

    const vehicleList = (localVehicles && localVehicles.length > 0) ? localVehicles : vehicles;
    const selectedVehicle = vehicleList.find(v => v.id === parseInt(selectedVehicleId));

    useEffect(() => {
        if (selectedVehicle) {
            setOdometer(selectedVehicle.odometer || '');
            // Reset checklist on vehicle change
            setSelectedComponents([]);
        }
    }, [selectedVehicleId]);

    if (!show) return null;

    const availableComponents = selectedVehicle
        ? (ROUTINE_COMPONENTS_BY_TYPE[resolveCategory(selectedVehicle.type)] || ROUTINE_COMPONENTS_BY_TYPE.GENERAL)
        : ROUTINE_COMPONENTS_BY_TYPE.GENERAL;

    const toggleComponent = (name) => {
        setSelectedComponents(prev => 
            prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
        );
    };

    const addCustomComponent = () => {
        if (!customComponent.trim()) return;
        if (!selectedComponents.includes(customComponent.trim())) {
            setSelectedComponents(prev => [...prev, customComponent.trim()]);
        }
        setCustomComponent('');
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedVehicleId) {
            setError('Pilih kendaraan yang akan diservis.');
            return;
        }
        if (!description.trim()) {
            setError('Deskripsi kebutuhan / keluhan kendala servis wajib diisi.');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const formData = new FormData();
            formData.append('vehicleId', selectedVehicleId);
            formData.append('category', category);
            formData.append('type', type);
            formData.append('urgency', urgency);
            formData.append('description', description);
            if (odometer) formData.append('odometer', odometer);
            if (estimatedCost) formData.append('estimatedCost', estimatedCost);
            if (workshop) formData.append('workshop', workshop);
            
            // Format items
            const itemsData = selectedComponents.map(name => ({
                name,
                isRoutine: category === 'ROUTINE',
                cost: null
            }));
            formData.append('items', JSON.stringify(itemsData));

            if (photoFile) {
                formData.append('complaintPhoto', photoFile);
            }

            const res = await api.post('/vehicles/maintenance/request', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (onSuccess) onSuccess(res.data?.service);
            onClose();
        } catch (err) {
            console.error('Request maintenance error:', err);
            setError(err.response?.data?.error || 'Gagal mengirim pengajuan pemeliharaan.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
                {/* Header */}
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-400">
                            <Wrench size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Formulir Pengajuan Pemeliharaan Kendaraan</h3>
                            <p className="text-[11px] text-slate-400">Diajukan oleh Staff Kendaraan / Driver untuk persetujuan Kabid Sarana</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* 1. Pilih Kendaraan & Odometer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Pilih Kendaraan <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={selectedVehicleId}
                                onChange={(e) => setSelectedVehicleId(e.target.value)}
                                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">-- Pilih Kendaraan --</option>
                                {vehicleList.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.name} ({v.plateNumber}) — {v.type || 'Kendaraan'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                KM Odometer Saat Ini
                            </label>
                            <div className="relative">
                                <Gauge size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="number"
                                    value={odometer}
                                    onChange={(e) => setOdometer(e.target.value)}
                                    placeholder="Contoh: 45200"
                                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Jenis, Tipe & Urgensi */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Kategori Servis
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ROUTINE">Pemeliharaan Rutin / Berkala</option>
                                <option value="NON_ROUTINE">Insidentil / Kerusakan</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Tipe Pengerjaan
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="SERVICE_RUTIN">Servis Berkala</option>
                                <option value="GANTI_OLI">Ganti Oli</option>
                                <option value="PERBAIKAN">Perbaikan Kerusakan</option>
                                <option value="GANTI_BAN">Ganti / Rotasi Ban</option>
                                <option value="PAJAK">Pajak / STNK / KIR</option>
                                <option value="OTHER">Lainnya</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Tingkat Urgensi
                            </label>
                            <select
                                value={urgency}
                                onChange={(e) => setUrgency(e.target.value)}
                                className={`w-full text-xs border rounded-xl px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    urgency === 'EMERGENCY' ? 'bg-rose-50 text-rose-700 border-rose-300' :
                                    urgency === 'URGENT' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                    'bg-slate-50 text-slate-800 border-slate-300'
                                }`}
                            >
                                <option value="NORMAL">Normal / Biasa</option>
                                <option value="URGENT">Mendesak / Penting</option>
                                <option value="EMERGENCY">Darurat (Tidak Layak Jalan)</option>
                            </select>
                        </div>
                    </div>

                    {/* 3. Checklist Komponen Rekomendasi */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                Komponen yang Diusulkan Diservis / Diganti:
                            </label>
                            <span className="text-[10px] text-slate-500">Klik untuk memilih komponen</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                            {availableComponents.map(comp => {
                                const isSelected = selectedComponents.includes(comp);
                                return (
                                    <button
                                        type="button"
                                        key={comp}
                                        onClick={() => toggleComponent(comp)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                                            isSelected 
                                                ? 'bg-blue-600 text-white shadow-xs' 
                                                : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400'
                                        }`}
                                    >
                                        {isSelected && <Check size={12} />}
                                        <span>{comp}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Tambah Komponen Kustom */}
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="text"
                                value={customComponent}
                                onChange={(e) => setCustomComponent(e.target.value)}
                                placeholder="Tambah komponen lain (misal: Wiper Depan)..."
                                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomComponent(); } }}
                            />
                            <button
                                type="button"
                                onClick={addCustomComponent}
                                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                                <Plus size={13} /> Tambah
                            </button>
                        </div>
                    </div>

                    {/* 4. Deskripsi / Uraian Keluhan */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Uraian Keluhan / Indikasi Kerusakan <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Jelaskan kendala, bunyi mencurigakan, atau rincian perawatan yang dibutuhkan..."
                            className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                            required
                        />
                    </div>

                    {/* 5. Estimasi Biaya & Usulan Bengkel */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Estimasi Biaya (Rp) <span className="text-slate-400 font-normal">(Opsional)</span>
                            </label>
                            <div className="relative">
                                <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="number"
                                    value={estimatedCost}
                                    onChange={(e) => setEstimatedCost(e.target.value)}
                                    placeholder="Contoh: 350000"
                                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Usulan Bengkel / Lokasi <span className="text-slate-400 font-normal">(Opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={workshop}
                                onChange={(e) => setWorkshop(e.target.value)}
                                placeholder="Contoh: Bengkel Auto 2000 Padang"
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* 6. Unggah Foto Bukti / Kondisi Kerusakan */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Foto Kondisi / Kerusakan <span className="text-slate-400 font-normal">(Opsional)</span>
                        </label>
                        <div className="flex items-center gap-3">
                            <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                                <Upload size={14} />
                                <span>{photoFile ? 'Ganti Foto' : 'Unggah Foto'}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    className="hidden"
                                />
                            </label>
                            {photoPreview && (
                                <div className="relative group">
                                    <img
                                        src={photoPreview}
                                        alt="Preview"
                                        className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                                        className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            )}
                            <span className="text-[11px] text-slate-400 italic">Format: JPG, PNG, WEBP (Maks 10MB)</span>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-200 flex justify-end items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <Wrench size={14} />
                            {submitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan ke Kabid Sarana'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
