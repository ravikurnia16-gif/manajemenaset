import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X, ArrowRightLeft } from 'lucide-react';
import api from '../lib/axios';
import SearchableSelect from '../components/SearchableSelect';
import { getMediaUrl, compressImage } from '../lib/media';

const AssetForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = !!id;
    const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
        defaultValues: {
            condition: 'BAIK',
            usefulLife: 5,
            sourceOfFunds: 'Yayasan',
            acquisitionStatus: 'Pembelian',
            purchaseDate: new Date().toISOString().split('T')[0],
            isLendable: false,
            needsRoutineMaintenance: false,
            maintenanceInterval: 3, // Default 3 months
            vendorName: ''
        }
    });

    const [intervalUnit, setIntervalUnit] = useState('MONTHS');

    const [masterData, setMasterData] = useState({
        units: [],
        rooms: [],
        categories: [],
        users: []
    });
    const [settings, setSettings] = useState({ assetCodePrefix: 'DEI' });
    const [isAutoCode, setIsAutoCode] = useState(true);
    const [loading, setLoading] = useState(false);
    const [locationUnitId, setLocationUnitId] = useState('');

    const [currentUser] = useState(JSON.parse(localStorage.getItem('user')) || {});
    const isGlobalAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(currentUser.role);

    // Image Upload State
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fetchMaster = async () => {
            try {
                const [rUnits, rRooms, rCats, rUsers, rSettings] = await Promise.all([
                    api.get('/master/units'),
                    api.get('/master/rooms'),
                    api.get('/master/categories'),
                    api.get('/users').catch(() => ({ data: [] })),
                    api.get('/settings').catch(() => ({ data: { assetCodePrefix: 'DEI' } }))
                ]);
                setMasterData({
                    units: rUnits.data,
                    rooms: rRooms.data,
                    categories: rCats.data,
                    users: Array.isArray(rUsers.data) ? rUsers.data : []
                });
                setSettings(rSettings.data);

                // Set unit if not global admin
                if (!isGlobalAdmin && currentUser.unitId && !isEdit) {
                    reset(prev => ({ ...prev, unitId: currentUser.unitId }));
                }

                // If editing, fetch asset details
                if (isEdit) {
                    const rAsset = await api.get(`/assets/${id}`);
                    const asset = rAsset.data;
                    setIsAutoCode(false); // Manual if editing old asset
                    reset({
                        ...asset,
                        purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
                        maintenanceInterval: asset.maintenanceInterval >= 30 ? Math.round(asset.maintenanceInterval / 30) : asset.maintenanceInterval
                    });
                    if (asset.maintenanceInterval < 30) setIntervalUnit('DAYS');
                    else setIntervalUnit('MONTHS');

                    if (asset.image) {
                        setImagePreview(getMediaUrl(asset.image));
                    }
                    if (asset.room) {
                        setLocationUnitId(asset.room.unitId.toString());
                    } else if (asset.unitId) {
                        setLocationUnitId(asset.unitId.toString());
                    }
                }
            } catch (err) {
                console.error("Fetch error:", err);
                if (err.response?.status !== 401 && err.response?.status !== 403) {
                    alert("Gagal memuat data master.");
                }
            }
        };
        fetchMaster();
    }, [id, isEdit, reset, isGlobalAdmin, currentUser.unitId]);

    const watchedFields = watch(["unitId", "categoryId", "purchaseDate", "roomId", "newCategoryCode", "picId"]);
    const selectedUnitId = watchedFields[0];
    const selectedCategoryId = watchedFields[1];
    const purchaseDate = watchedFields[2];
    const selectedRoomId = watchedFields[3];
    const newCategoryCode = watchedFields[4];
    const selectedPicId = watchedFields[5];

    const filteredRooms = locationUnitId
        ? masterData.rooms.filter(r => r.unitId === parseInt(locationUnitId))
        : masterData.rooms;

    const selectedUnit = masterData.units.find(u => u.id === parseInt(selectedUnitId));
    const isYayasan = selectedUnit?.name?.toLowerCase().includes('yayasan');

    // If unit changes and it's not Yayasan, force locationUnitId to match unitId
    useEffect(() => {
        if (selectedUnitId && !isYayasan) {
            setLocationUnitId(selectedUnitId.toString());
        }
    }, [selectedUnitId, isYayasan]);

    // Code Preview Logic
    const generatePreview = () => {
        if (!selectedUnitId || !selectedCategoryId) return "Selesaikan pilihan...";
        const unit = masterData.units.find(u => u.id === parseInt(selectedUnitId));
        let catCode = '???';

        if (selectedCategoryId === 'other') {
            catCode = newCategoryCode || '???';
        } else {
            const cat = masterData.categories.find(c => c.id === parseInt(selectedCategoryId));
            catCode = cat?.code || '???';
        }

        const year = purchaseDate ? new Date(purchaseDate).getFullYear() : 'YYYY';

        return `${settings.assetCodePrefix || 'DEI'}.${unit?.code || '???'}.${catCode}.${year}.xxxx`;
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            // PDF check - don't compress PDFs
            if (file.type === 'application/pdf') {
                if (file.size > 10 * 1024 * 1024) {
                    alert('Ukuran PDF maksimal 10MB');
                    return;
                }
                const previewUrl = URL.createObjectURL(file);
                setImagePreview(previewUrl);
                setValue('imageFile', file);
                return;
            }

            try {
                // Compress image before preview and upload
                const compressedFile = await compressImage(file, { maxWidth: 1024, quality: 0.8 });
                
                // Cleanup old preview URL to avoid memory leaks
                if (imagePreview && imagePreview.startsWith('blob:')) {
                    URL.revokeObjectURL(imagePreview);
                }

                const previewUrl = URL.createObjectURL(compressedFile);
                setImagePreview(previewUrl);
                setValue('imageFile', compressedFile);
                
                console.log('[DEBUG] Asset Image Compressed:', {
                    originalSize: (file.size / 1024).toFixed(1) + 'KB',
                    compressedSize: (compressedFile.size / 1024).toFixed(1) + 'KB'
                });
            } catch (err) {
                console.error('Compression failed:', err);
                const previewUrl = URL.createObjectURL(file);
                setImagePreview(previewUrl);
                setValue('imageFile', file);
            }
        }
    };

    const onSubmit = async (data) => {
        try {
            setLoading(true);

            const formData = new FormData();
            
            // Convert interval to days if unit is months
            const intervalVal = parseInt(data.maintenanceInterval || 0);
            const intervalInDays = intervalUnit === 'MONTHS' ? intervalVal * 30 : intervalVal;
            formData.set('maintenanceInterval', intervalInDays.toString());

            // Append all data fields to FormData
            Object.keys(data).forEach(key => {
                if (key === 'imageFile') {
                    if (data[key]) formData.append('image', data[key]);
                } else if (key === 'maintenanceInterval') {
                    // Already set above
                } else if (key !== 'image') { // Don't append the old base64 if it exists
                    formData.append(key, data[key]);
                }
            });

            // If auto code is enabled, don't send the "code" field so backend generates it
            if (isAutoCode && !isEdit) {
                formData.delete('code');
            }

            if (isEdit) {
                await api.put(`/assets/${id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Aset berhasil diperbarui!');
            } else {
                await api.post('/assets', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Aset berhasil disimpan!');
            }
            navigate('/aset');
        } catch (error) {
            console.error('Submit error:', error);
            alert('Gagal menyimpan aset: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{isEdit ? 'Edit Aset' : 'Input Aset Baru'}</h2>
                    <p className="text-slate-500 text-sm">{isEdit ? 'Perbarui informasi aset Anda' : 'Masukkan detail aset dengan lengkap'}</p>
                </div>
                <button
                    onClick={() => navigate('/aset')}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-5">
                        <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4 border-b border-blue-100 pb-2">Data Umum</h3>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-slate-700">Kode Aset</label>
                                <button
                                    type="button"
                                    onClick={() => setIsAutoCode(!isAutoCode)}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${isAutoCode ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-500'}`}
                                >
                                    {isAutoCode ? 'OTOMATIS' : 'MANUAL'}
                                </button>
                            </div>

                            {isAutoCode ? (
                                <div className="bg-slate-50 border border-slate-200 border-dashed rounded-lg px-4 py-2.5 flex items-center justify-between group">
                                    <div className="flex flex-col">
                                        <span className="text-blue-600 font-mono font-bold tracking-wider">{generatePreview()}</span>
                                        <span className="text-[10px] text-slate-400">Kode akan digenerate saat simpan</span>
                                    </div>
                                    <div className="text-slate-300 group-hover:text-blue-200 transition-colors">
                                        <Save size={16} />
                                    </div>
                                </div>
                            ) : (
                                <input {...register('code')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Contoh: AST.MKT.LPT.24.001" />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Aset <span className="text-red-500">*</span></label>
                            <input {...register('name', { required: true })} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="Contoh: Laptop Dell XPS 15" />
                            {errors.name && <span className="text-red-500 text-xs mt-1">Nama aset wajib diisi</span>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Kategori <span className="text-red-500">*</span></label>
                                <select {...register('categoryId', { required: true })} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                    <option value="">Pilih Kategori</option>
                                    {masterData.categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                    <option value="other" className="text-blue-600 font-bold">+ Lainnya (Input Manual)</option>
                                </select>
                                {errors.categoryId && <span className="text-red-500 text-xs mt-1">Wajib dipilih</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Merk / Type</label>
                                <input {...register('brand')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Dell / XPS 15" />
                            </div>
                        </div>

                        {selectedCategoryId === 'other' && (
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Kategori Baru</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <input {...register('newCategoryName', { required: selectedCategoryId === 'other' })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nama Kategori (ex: Drone)" />
                                    <input {...register('newCategoryCode', { required: selectedCategoryId === 'other' })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder="Kode (ex: DRN)" />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Vendor / Toko</label>
                            <input {...register('vendorName')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nama Vendor / Toko (opsional)" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Spesifikasi</label>
                            <textarea {...register('specification')} rows={3} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Processor i7, RAM 16GB..."></textarea>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Harga Perolehan</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-500 text-sm">Rp</span>
                                    <input type="number" {...register('price')} className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Beli</label>
                                <input type="date" {...register('purchaseDate')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4 border-b border-blue-100 pb-2">Lokasi & Kondisi</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Sumber Dana</label>
                                <select {...register('sourceOfFunds')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-blue-700">
                                    <option value="Yayasan">Yayasan</option>
                                    <option value="BOS">BOS</option>
                                    <option value="Hibah">Hibah</option>
                                    <option value="Pemerintah">Pemerintah</option>
                                    <option value="Cashback">Cashback</option>
                                    <option value="Lainnya">Lainnya</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status Perolehan</label>
                                <select {...register('acquisitionStatus')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                    <option value="Pembelian">Pembelian</option>
                                    <option value="Hibah/Wakaf">Hibah/Wakaf</option>
                                    <option value="Sewa">Sewa</option>
                                    <option value="Lainnya">Lainnya</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Unit / Divisi</label>
                            <select
                                {...register('unitId')}
                                disabled={!isGlobalAdmin}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500"
                            >
                                <option value="">Pilih Unit</option>
                                {masterData.units.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                            {!isGlobalAdmin && <p className="text-[10px] text-blue-600 mt-1 italic font-semibold">Unit Anda terkunci sesuai pengaturan hak akses.</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Unit Lokasi <span className="text-[10px] text-blue-500 font-bold">(Area Penempatan)</span>
                                </label>
                                <select
                                    value={locationUnitId}
                                    onChange={(e) => setLocationUnitId(e.target.value)}
                                    disabled={!isYayasan}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500"
                                >
                                    <option value="">Pilih Unit Lokasi</option>
                                    {masterData.units.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                                {isYayasan && <p className="text-[9px] text-blue-600 mt-1 font-bold italic">* Aset Yayasan boleh ditaruh di Unit manapun.</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ruangan</label>
                                <select {...register('roomId')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                    <option value="">Pilih Ruangan</option>
                                    {filteredRooms.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.building || '-'})</option>
                                    ))}
                                    {locationUnitId && <option value="other" className="text-blue-600 font-bold">+ Lainnya (Input Manual)</option>}
                                </select>
                            </div>
                        </div>

                        {selectedRoomId === 'other' && (
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider text-center">Data Ruangan Baru</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Nama Ruangan</label>
                                        <input
                                            {...register('newRoomName', { required: selectedRoomId === 'other' })}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                            placeholder="Contoh: Ruang Rapat"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase text-blue-600">Lokasi (Misal: Lapai)</label>
                                        <input
                                            {...register('newRoomBuilding')}
                                            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                            placeholder="Gedung / Area / Lokasi"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-blue-500 italic font-medium px-1">
                                    * Kode ruangan akan dibuat otomatis (KodeUnit-xx) dan Lantai diset ke '1' secara default.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Umur Manfaat (Thn)</label>
                                <input type="number" {...register('usefulLife', { value: 5 })} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Kondisi</label>
                                <select {...register('condition')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                    <option value="BAIK">Baik</option>
                                    <option value="RUSAK_RINGAN">Rusak Ringan</option>
                                    <option value="RUSAK_BERAT">Rusak Berat</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${watch('isLendable') ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <ArrowRightLeft size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Bisa Dipinjam?</p>
                                    <p className="text-[10px] text-slate-500">Izinkan aset ini untuk dipinjam oleh unit lain/staf.</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    {...register('isLendable')}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>

                        {/* Routine Maintenance Toggle */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${watch('needsRoutineMaintenance') ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <Save size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Pemeliharaan Rutin?</p>
                                        <p className="text-[10px] text-slate-500">Aktifkan jika aset butuh servis berkala.</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        {...register('needsRoutineMaintenance')}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {watch('needsRoutineMaintenance') && (
                                <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase">Interval Pemeliharaan</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" 
                                            {...register('maintenanceInterval')}
                                            className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Misal: 3"
                                        />
                                        <select 
                                            value={intervalUnit}
                                            onChange={(e) => setIntervalUnit(e.target.value)}
                                            className="w-24 border border-blue-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        >
                                            <option value="MONTHS">Bulan</option>
                                            <option value="DAYS">Hari</option>
                                        </select>
                                    </div>
                                    <p className="text-[10px] text-blue-500 italic">
                                        * Aset akan muncul di pengingat setiap {watch('maintenanceInterval')} {intervalUnit === 'MONTHS' ? 'Bulan' : 'Hari'}.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Upload Foto</label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/jpeg,image/png,application/pdf"
                                onChange={handleFileChange}
                            />
                            <div
                                onClick={() => fileInputRef.current.click()}
                                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative overflow-hidden group"
                            >
                                {imagePreview ? (
                                    <div className="relative">
                                        <img src={imagePreview} alt="Preview" className="h-48 mx-auto object-contain rounded-lg" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-white font-bold">Ganti Foto</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3 group-hover:scale-110 transition-transform">
                                            <Save size={24} />
                                        </div>
                                        <p className="text-sm text-slate-500">Klik untuk upload foto aset</p>
                                        <p className="text-xs text-slate-400 mt-1">JPG, PNG, PDF max 5MB</p>
                                    </>
                                )}
                            </div>
                            {/* Hidden input to ensure image is registered in RHF */}
                            <input type="hidden" {...register('image')} />
                            {imagePreview && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (imagePreview.startsWith('blob:')) {
                                            URL.revokeObjectURL(imagePreview);
                                        }
                                        setImagePreview(null);
                                        setValue('imageFile', null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className="text-xs text-red-500 mt-2 hover:underline"
                                >
                                    Hapus Foto
                                </button>
                            )}
                        </div>

                        <div className="pt-2">
                            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4 border-b border-blue-100 pb-2">Penanggung Jawab (PIC)</h3>

                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setValue('picId', null);
                                            setValue('picName', '');
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${!selectedPicId ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}
                                    >
                                        NAMA MANUAL
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (masterData.users.length > 0) {
                                                setValue('picId', masterData.users[0].id);
                                                setValue('picName', masterData.users[0].name);
                                            }
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${selectedPicId ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}
                                    >
                                        PILIH USER SISTEM
                                    </button>
                                </div>

                                {selectedPicId ? (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Pilih User</label>
                                        <select
                                            {...register('picId')}
                                            onChange={(e) => {
                                                const u = masterData.users.find(user => user.id === parseInt(e.target.value));
                                                setValue('picName', u?.name || '');
                                            }}
                                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        >
                                            <option value="">Pilih User</option>
                                            {masterData.users.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nama PIC</label>
                                        <input
                                            {...register('picName')}
                                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Contoh: Budi Sudarsono (Manager)"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={() => navigate('/aset')}
                        className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg mr-4 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all transform hover:scale-105 disabled:opacity-50"
                    >
                        <Save size={18} /> {loading ? 'Menyimpan...' : 'Simpan Data Aset'}
                    </button>
                </div>
            </form>
        </div>
    );
};
export default AssetForm;
