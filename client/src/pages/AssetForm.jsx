import { useForm } from 'react-hook-form';
import { Save, X } from 'lucide-react';

const AssetForm = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();

    const onSubmit = (data) => {
        console.log(data);
        alert('Data siap dikirim: ' + JSON.stringify(data));
        // Implementation of API call pending
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Input Aset Baru</h2>
                    <p className="text-slate-500 text-sm">Masukkan detail aset dengan lengkap</p>
                </div>
                <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-5">
                        <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4 border-b border-blue-100 pb-2">Data Umum</h3>

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
                                    <option value="1">Elektronik</option>
                                    <option value="2">Furniture</option>
                                    <option value="3">Kendaraan</option>
                                </select>
                                {errors.categoryId && <span className="text-red-500 text-xs mt-1">Wajib dipilih</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Merk / Type</label>
                                <input {...register('brand')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Dell / XPS 15" />
                            </div>
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

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Unit / Divisi</label>
                            <select {...register('unitId')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <option value="">Pilih Unit</option>
                                <option value="1">IT Department</option>
                                <option value="2">Human Resources</option>
                                <option value="3">Finance</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ruangan</label>
                            <select {...register('roomId')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <option value="">Pilih Ruangan</option>
                                <option value="1">R. Server Lt.1</option>
                                <option value="2">R. Meeting Utama</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Kondisi</label>
                                <select {...register('condition')} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                    <option value="BAIK">Baik</option>
                                    <option value="RUSAK_RINGAN">Rusak Ringan</option>
                                    <option value="RUSAK_BERAT">Rusak Berat</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah Unit</label>
                                <input type="number" {...register('quantity', { value: 1 })} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
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
                    <button type="button" className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg mr-4 transition-colors">Batal</button>
                    <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all transform hover:scale-105">
                        <Save size={18} /> Simpan Data Aset
                    </button>
                </div>
            </form>
        </div>
    );
};
export default AssetForm;
