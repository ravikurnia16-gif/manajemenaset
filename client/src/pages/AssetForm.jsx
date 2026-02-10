import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import api from '../lib/axios';

const AssetForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = !!id;
    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
        defaultValues: {
            condition: 'BAIK',
            usefulLife: 5,
            sourceOfFunds: 'Mandiri',
            acquisitionStatus: 'Pembelian',
            purchaseDate: new Date().toISOString().split('T')[0]
        }
    });

    const [masterData, setMasterData] = useState({
        units: [],
        rooms: [],
        categories: [],
        vendors: []
    });
    const [settings, setSettings] = useState({ assetCodePrefix: 'AST' });
    const [isAutoCode, setIsAutoCode] = useState(true);
    const [loading, setLoading] = useState(false);

    const [currentUser] = useState(JSON.parse(localStorage.getItem('user')) || {});
    const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(currentUser.role);

    useEffect(() => {
        const fetchMaster = async () => {
            try {
                const [rUnits, rRooms, rCats, rVendors, rSettings] = await Promise.all([
                    api.get('/master/units'),
                    api.get('/master/rooms'),
                    api.get('/master/categories'),
                    api.get('/master/vendors'),
                    api.get('/settings').catch(() => ({ data: { assetCodePrefix: 'AST' } }))
                ]);
                setMasterData({
                    units: rUnits.data,
                    rooms: rRooms.data,
                    categories: rCats.data,
                    vendors: rVendors.data
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
                        purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : ''
                    });
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

    const watchedFields = watch(["unitId", "categoryId", "purchaseDate", "vendorId", "roomId", "newCategoryCode"]);
    const selectedUnitId = watchedFields[0];
    const selectedCategoryId = watchedFields[1];
    const purchaseDate = watchedFields[2];
    const selectedVendorId = watchedFields[3];
    const selectedRoomId = watchedFields[4];
    const newCategoryCode = watchedFields[5];

    const filteredRooms = selectedUnitId
        ? masterData.rooms.filter(r => r.unitId === parseInt(selectedUnitId))
        : masterData.rooms;

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

        return `${settings.assetCodePrefix || 'AST'}.${unit?.code || '???'}.${catCode}.${year}.xxxx`;
    };

    const onSubmit = async (data) => {
        try {
            setLoading(true);

            // If auto code is enabled, don't send the "code" field so backend generates it
            const payload = { ...data };
            if (isAutoCode && !isEdit) {
                delete payload.code;
            }

            if (isEdit) {
                await api.put(`/assets/${id}`, payload);
                alert('Aset berhasil diperbarui!');
            } else {
                await api.post('/assets', payload);
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
                            <select {...register('vendorId')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <option value="">Pilih Vendor...</option>
                                {masterData.vendors.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                                <option value="other" className="text-blue-600 font-bold">+ Lainnya (Input Manual)</option>
                            </select>
                        </div>

                        {selectedVendorId === 'other' && (
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Vendor Baru</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <input {...register('newVendorName', { required: selectedVendorId === 'other' })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nama Vendor / Toko" />
                                    <input {...register('newVendorContact')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Kontak (Opsional)" />
                                </div>
                            </div>
                        )}

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

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ruangan</label>
                            <select {...register('roomId')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <option value="">Pilih Ruangan</option>
                                {filteredRooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                                <option value="other" className="text-blue-600 font-bold">+ Lainnya (Input Manual)</option>
                            </select>
                        </div>

                        {selectedRoomId === 'other' && (
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Ruangan Baru</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <input {...register('newRoomName', { required: selectedRoomId === 'other' })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nama Ruangan" />
                                    <input {...register('newRoomCode')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Kode Ruang (ex: R101)" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input {...register('newRoomFloor')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Lantai (ex: 1)" />
                                    <input {...register('newRoomBuilding')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Gedung (ex: Utama)" />
                                </div>
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

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Upload Foto</label>
                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                                <p className="text-sm text-slate-500">Klik untuk upload foto aset atau invoice</p>
                                <p className="text-xs text-slate-400 mt-1">JPG, PNG, PDF max 5MB</p>
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
