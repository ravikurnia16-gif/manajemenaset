import { useState, useEffect } from 'react';
import api from '../../../../lib/axios';
import { Plus, Trash2, Box, PackagePlus, AlertTriangle } from 'lucide-react';

export const ProjectForm = ({ vendors, initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState(() => {
        if (initialData) {
            return {
                ...initialData,
                title: initialData.title || initialData.name || '',
                projectType: initialData.projectType || initialData.type || 'SELEKSI',
                directVendorId: initialData.directVendorId || '',
                budget: initialData.budget || '',
                items: initialData.projectItems ? initialData.projectItems.map(pi => ({
                    itemId: pi.itemId,
                    quantity: pi.quantity,
                    name: pi.item?.name,
                    code: pi.item?.code,
                    unit: pi.item?.unit || 'Pcs',
                    categoryName: pi.item?.category?.name || 'Umum'
                })) : []
            };
        }
        return {
            year: new Date().getFullYear(),
            title: '',
            targetQuantity: 0,
            budget: '',
            status: 'PERENCANAAN',
            note: '',
            items: [],
            projectType: 'SELEKSI',
            directVendorId: ''
        };
    });

    const [availableItems, setAvailableItems] = useState([]);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [inputQty, setInputQty] = useState(1);

    useEffect(() => {
        api.get('/inventory/items').then(res => {
            setAvailableItems(res.data || []);
        }).catch(console.error);
    }, []);

    const handleAddItem = () => {
        if (!selectedItemId) return alert('Silakan pilih barang terlebih dahulu!');
        const it = availableItems.find(i => i.id === parseInt(selectedItemId, 10));
        if (!it) return alert('Barang tidak ditemukan!');

        const qty = parseInt(inputQty, 10);
        if (isNaN(qty) || qty <= 0) return alert('Jumlah target harus lebih dari 0!');

        const newItems = [...formData.items];
        const existingIdx = newItems.findIndex(i => i.itemId === it.id);

        if (existingIdx >= 0) {
            newItems[existingIdx].quantity += qty;
        } else {
            newItems.push({
                itemId: it.id,
                quantity: qty,
                name: it.name,
                code: it.code,
                unit: it.unit || 'Pcs',
                categoryName: it.category?.name || 'Umum'
            });
        }

        const newTotal = newItems.reduce((acc, curr) => acc + curr.quantity, 0);
        setFormData({ ...formData, items: newItems, targetQuantity: newTotal });
        setSelectedItemId('');
        setInputQty(1);
    };

    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        const newTotal = newItems.reduce((acc, curr) => acc + curr.quantity, 0);
        setFormData({ ...formData, items: newItems, targetQuantity: newTotal });
    };

    const handleItemQtyChange = (index, val) => {
        const qty = parseInt(val, 10) || 0;
        const newItems = [...formData.items];
        newItems[index].quantity = qty;
        const newTotal = newItems.reduce((acc, curr) => acc + curr.quantity, 0);
        setFormData({ ...formData, items: newItems, targetQuantity: newTotal });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.items.length === 0) {
            return alert('Harap tambahkan minimal 1 barang pesanan ke dalam proyek!');
        }
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Proyek</label>
                    <input 
                        type="number" 
                        required 
                        className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" 
                        value={formData.year} 
                        onChange={e => setFormData({ ...formData, year: e.target.value })} 
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                    <select 
                        className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" 
                        value={formData.status} 
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                    >
                        <option value="PERENCANAAN">Perencanaan</option>
                        <option value="SELEKSI">Seleksi Vendor</option>
                        <option value="BERJALAN">Proyek Berjalan</option>
                        <option value="SELESAI">Selesai</option>
                    </select>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tipe Pemesanan</label>
                    <select 
                        className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" 
                        value={formData.projectType} 
                        onChange={e => setFormData({ ...formData, projectType: e.target.value })}
                    >
                        <option value="SELEKSI">Proyek Seleksi (Tender)</option>
                        <option value="PENUNJUKAN_LANGSUNG">Penunjukan Langsung (Parsial)</option>
                    </select>
                </div>
                {formData.projectType === 'PENUNJUKAN_LANGSUNG' ? (
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Pilih Vendor Langsung</label>
                        <select 
                            required 
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" 
                            value={formData.directVendorId} 
                            onChange={e => setFormData({ ...formData, directVendorId: e.target.value })}
                        >
                            <option value="">-- Pilih Vendor --</option>
                            {vendors && vendors.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Estimasi Anggaran / Budget (Rp)</label>
                        <input 
                            type="number" 
                            placeholder="Contoh: 15000000"
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" 
                            value={formData.budget} 
                            onChange={e => setFormData({ ...formData, budget: e.target.value })} 
                        />
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Judul / Nama Proyek Pengadaan</label>
                <input 
                    type="text" 
                    required 
                    placeholder={formData.projectType === 'PENUNJUKAN_LANGSUNG' ? 'Contoh: Pengadaan Kertas HVS & ATK Kantor 2026' : 'Contoh: Pengadaan Logistik & Perlengkapan Operasional 2026'} 
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" 
                    value={formData.title} 
                    onChange={e => setFormData({ ...formData, title: e.target.value })} 
                />
            </div>
            
            {/* Box Pemilihan Master Barang Logistik */}
            <div className="border border-slate-200 p-4 rounded-xl bg-slate-50 space-y-3">
                <div className="flex items-center gap-2">
                    <Box size={16} className="text-blue-600" />
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Daftar Barang Proyek (Master Data Logistik)
                    </label>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="sm:col-span-8">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Pilih Barang dari Master Data</label>
                        <select
                            className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-blue-500 bg-slate-50 font-medium"
                            value={selectedItemId}
                            onChange={e => setSelectedItemId(e.target.value)}
                        >
                            <option value="">-- Cari & Pilih Barang Logistik --</option>
                            {availableItems.map(it => (
                                <option key={it.id} value={it.id}>
                                    {it.name} ({it.code}) - {it.category?.name || 'Umum'} [{it.unit || 'Pcs'}]
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Target Jumlah</label>
                        <input
                            type="number"
                            min="1"
                            className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-blue-500 text-center font-bold"
                            value={inputQty}
                            onChange={e => setInputQty(e.target.value)}
                        />
                    </div>

                    <div className="sm:col-span-2 flex items-end">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs"
                        >
                            <Plus size={14} /> Tambah
                        </button>
                    </div>
                </div>

                {/* Tabel Barang yang telah ditambahkan */}
                {formData.items.length > 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100/90 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-2.5 w-10 text-center">#</th>
                                    <th className="p-2.5">Nama Barang & Kode</th>
                                    <th className="p-2.5">Kategori</th>
                                    <th className="p-2.5 w-28 text-center">Target Qty</th>
                                    <th className="p-2.5 w-12 text-center"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {formData.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="p-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                                        <td className="p-2.5">
                                            <div className="font-bold text-slate-800">{item.name}</div>
                                            <div className="text-[11px] text-slate-400 font-mono">{item.code}</div>
                                        </td>
                                        <td className="p-2.5 text-slate-600 font-medium">{item.categoryName || '-'}</td>
                                        <td className="p-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-16 px-1.5 py-1 border rounded text-xs text-center font-bold text-blue-700 bg-slate-50"
                                                    value={item.quantity}
                                                    onChange={e => handleItemQtyChange(idx, e.target.value)}
                                                />
                                                <span className="text-[11px] text-slate-500 font-medium">{item.unit}</span>
                                            </div>
                                        </td>
                                        <td className="p-2.5 text-center">
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveItem(idx)} 
                                                className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                                title="Hapus barang"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-700">
                                    <td colSpan="3" className="p-2.5 text-right">Total Keseluruhan Target:</td>
                                    <td className="p-2.5 text-center text-blue-600 font-extrabold text-sm">{formData.targetQuantity} item</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center text-slate-400 text-xs">
                        Belum ada barang logistik yang ditambahkan ke pesanan proyek ini.
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan / Keterangan Tambahan</label>
                <textarea 
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" 
                    rows={2} 
                    placeholder="Contoh: Pengadaan triwulan 1, barang wajib dikirim lengkap sebelum tanggal tertentu..."
                    value={formData.note || ''} 
                    onChange={e => setFormData({ ...formData, note: e.target.value })}
                ></textarea>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors font-medium">Batal</button>
                <button type="submit" className="px-5 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-md shadow-blue-500/20">Simpan Proyek</button>
            </div>
        </form>
    );
};

export const VendorSelectionForm = ({ vendors, initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState(initialData || { projectId: '', vendorId: '', proposedPrice: 0, status: 'MENUNGGU', reason: '' });
    const [file, setFile] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        const data = new FormData();
        Object.keys(formData).forEach(key => data.append(key, formData[key]));
        if (file) data.append('file', file);
        onSave(data, formData.id);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {!formData.id && (
                <>
                    <input type="hidden" value={formData.projectId} />
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Pilih Vendor</label>
                        <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.vendorId} onChange={e => setFormData({ ...formData, vendorId: e.target.value })}>
                            <option value="">-- Pilih Vendor --</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                </>
            )}
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Harga Penawaran Total (Rp)</label>
                <input type="number" required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.proposedPrice} onChange={e => setFormData({ ...formData, proposedPrice: e.target.value })} />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Upload Proposal (PDF/Doc) {formData.proposalFileUrl && '(File sudah ada)'}</label>
                <input type="file" className="w-full px-3 py-2 border rounded-xl text-sm" onChange={e => setFile(e.target.files[0])} />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Keputusan Seleksi</label>
                <select className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="MENUNGGU">Menunggu Keputusan</option>
                    <option value="DIPILIH">Vendor Dipilih</option>
                    <option value="DITOLAK">Ditolak</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Alasan Keputusan</label>
                <textarea className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" rows={2} placeholder="Contoh: Harga paling kompetitif dan kualitas barang sesuai spesifikasi." value={formData.reason || ''} onChange={e => setFormData({ ...formData, reason: e.target.value })}></textarea>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 font-bold">Simpan Seleksi</button>
            </div>
        </form>
    );
};

export const VendorMoUForm = ({ vendors, projects, initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState(initialData || { projectId: '', vendorId: '', mouNumber: '', startDate: '', endDate: '', status: 'DRAFT' });
    const [file, setFile] = useState(null);

    const selectedProject = projects.find(p => p.id == formData.projectId);
    const filteredVendors = selectedProject && selectedProject.selections
        ? vendors.filter(v => selectedProject.selections.some(s => s.vendorId === v.id && s.status === 'DIPILIH'))
        : [];

    const handleSubmit = (e) => {
        e.preventDefault();
        const data = new FormData();
        Object.keys(formData).forEach(key => {
            if (key !== 'vendorId') data.append(key, formData[key]);
        });
        
        const finalVendorId = filteredVendors.length === 1 ? filteredVendors[0].id : formData.vendorId;
        data.append('vendorId', finalVendorId);
        
        if (file) data.append('file', file);
        onSave(data, formData.id);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {!formData.id && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Proyek</label>
                        <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.projectId} onChange={e => setFormData({ ...formData, projectId: e.target.value })}>
                            <option value="">-- Pilih Proyek --</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.title || p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Vendor (Tersaring otomatis)</label>
                        {filteredVendors.length === 1 ? (
                            <div className="w-full px-3 py-2 border border-blue-200 bg-blue-50 text-blue-800 rounded-xl text-sm font-medium">
                                {filteredVendors[0].name}
                            </div>
                        ) : (
                            <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.vendorId} onChange={e => setFormData({ ...formData, vendorId: e.target.value })} disabled={!formData.projectId}>
                                <option value="">-- Pilih Vendor --</option>
                                {filteredVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        )}
                        {formData.projectId && filteredVendors.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">Proyek ini belum memiliki vendor yang berstatus "Dipilih".</p>
                        )}
                    </div>
                </div>
            )}
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nomor MoU / Surat Perjanjian</label>
                <input type="text" required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.mouNumber} onChange={e => setFormData({ ...formData, mouNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                    <input type="date" required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.startDate ? formData.startDate.split('T')[0] : ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Berakhir</label>
                    <input type="date" required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.endDate ? formData.endDate.split('T')[0] : ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Upload Scan MoU (PDF) {formData.fileUrl && '(File sudah ada)'}</label>
                <input type="file" className="w-full px-3 py-2 border rounded-xl text-sm" onChange={e => setFile(e.target.files[0])} />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status Kontrak</label>
                <select className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="DRAFT">Draft / Belum TTD</option>
                    <option value="SIGNED">Signed / Aktif</option>
                    <option value="EXPIRED">Selesai / Kadaluarsa</option>
                </select>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 font-bold">Simpan MoU</button>
            </div>
        </form>
    );
};

export const VendorEvaluationForm = ({ vendors, projects, initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState(initialData || { projectId: '', vendorId: '', rating: 0, onTimeRate: 0, rejectRate: 0, notes: '' });

    const selectedProject = projects.find(p => p.id == formData.projectId);
    const filteredVendors = selectedProject && selectedProject.selections
        ? vendors.filter(v => selectedProject.selections.some(s => s.vendorId === v.id && s.status === 'DIPILIH'))
        : [];

    return (
        <form onSubmit={e => {
            e.preventDefault();
            const finalData = { ...formData };
            if (filteredVendors.length === 1) finalData.vendorId = filteredVendors[0].id;
            onSave(finalData);
        }} className="space-y-4">
            {!formData.id && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Proyek</label>
                        <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.projectId} onChange={e => setFormData({ ...formData, projectId: e.target.value })}>
                            <option value="">-- Pilih Proyek --</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.title || p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Vendor Tersaring</label>
                        {filteredVendors.length === 1 ? (
                            <div className="w-full px-3 py-2 border border-blue-200 bg-blue-50 text-blue-800 rounded-xl text-sm font-medium">
                                {filteredVendors[0].name}
                            </div>
                        ) : (
                            <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.vendorId} onChange={e => setFormData({ ...formData, vendorId: e.target.value })} disabled={!formData.projectId}>
                                <option value="">-- Pilih Vendor --</option>
                                {filteredVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        )}
                        {formData.projectId && filteredVendors.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">Belum ada vendor terpilih.</p>
                        )}
                    </div>
                </div>
            )}
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Rating Keseluruhan (0 - 5.0)</label>
                <input type="number" step="0.1" max="5" min="0" required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.rating} onChange={e => setFormData({ ...formData, rating: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Ketepatan Waktu (%)</label>
                    <input type="number" max="100" min="0" required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.onTimeRate} onChange={e => setFormData({ ...formData, onTimeRate: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Barang Reject/Cacat (%)</label>
                    <input type="number" max="100" min="0" required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.rejectRate} onChange={e => setFormData({ ...formData, rejectRate: e.target.value })} />
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan Evaluasi / Rekomendasi</label>
                <textarea className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" rows={3} placeholder="Apakah vendor ini direkomendasikan untuk tahun depan?" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })}></textarea>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 font-bold">Simpan Penilaian</button>
            </div>
        </form>
    );
};

export const ProjectReceiveForm = ({ initialData, onSave, onCancel }) => {
    const [warehouseId, setWarehouseId] = useState('');
    const [receivedQuantities, setReceivedQuantities] = useState({});
    const [warehouses, setWarehouses] = useState([]);
    const [isMatchesOrder, setIsMatchesOrder] = useState(true);
    const [isFinal, setIsFinal] = useState(false);
    const projectItems = initialData?.projectItems || [];

    useEffect(() => {
        api.get('/inventory/warehouses').then(res => setWarehouses(res.data || [])).catch(console.error);
        
        // Auto-fill received quantities from remaining order
        const initialQtys = {};
        projectItems.forEach(pi => {
            const remaining = Math.max(0, pi.quantity - (pi.receivedQuantity || 0));
            initialQtys[pi.itemId] = remaining;
        });
        setReceivedQuantities(initialQtys);
    }, [initialData]);

    const handleQuantityChange = (itemId, val) => {
        setReceivedQuantities(prev => ({
            ...prev,
            [itemId]: parseInt(val, 10) || 0
        }));
    };

    const handleMatchesOrderChange = (matches) => {
        setIsMatchesOrder(matches);
        if (matches) {
            // Reset to remaining quantities
            const initialQtys = {};
            projectItems.forEach(pi => {
                const remaining = Math.max(0, pi.quantity - (pi.receivedQuantity || 0));
                initialQtys[pi.itemId] = remaining;
            });
            setReceivedQuantities(initialQtys);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const itemsToReceive = [];
        Object.entries(receivedQuantities).forEach(([itemId, qty]) => {
            if (qty > 0) {
                itemsToReceive.push({ itemId: parseInt(itemId, 10), quantity: qty });
            }
        });

        if (itemsToReceive.length === 0 && !isFinal) {
            alert('Silakan masukkan jumlah barang yang diterima, atau centang Tutup Proyek jika ini adalah proses final.');
            return;
        }

        const payload = {
            warehouseId: parseInt(warehouseId, 10),
            items: itemsToReceive,
            isFinal: isFinal
        };
        onSave(payload, initialData.id);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl mb-4">
                <p className="text-sm font-bold text-blue-900">Penerimaan Barang Proyek: {initialData?.title || initialData?.name}</p>
                <p className="text-xs text-blue-700 mt-0.5">Pilih gudang logistik tujuan penyimpanan dan masukkan jumlah barang yang datang.</p>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Gudang Penyimpanan</label>
                <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                    <option value="">-- Pilih Gudang Logistik --</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
            </div>

            <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                    <p className="text-xs font-bold text-slate-700 mb-2">Apakah barang yang datang sesuai dengan *Sisa Pesanan*?</p>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name="matchesOrder" checked={isMatchesOrder} onChange={() => handleMatchesOrderChange(true)} className="w-4 h-4 text-blue-600" />
                            Ya, Sesuai Sisa
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name="matchesOrder" checked={!isMatchesOrder} onChange={() => handleMatchesOrderChange(false)} className="w-4 h-4 text-blue-600" />
                            Tidak, Ketik Manual
                        </label>
                    </div>
                </div>

                <label className="block text-xs font-bold text-slate-700">Rincian Barang yang Diterima</label>
                {projectItems.length === 0 ? (
                    <div className="p-4 border border-dashed border-red-200 bg-red-50 rounded-xl text-center">
                        <p className="text-sm font-bold text-red-600">Proyek ini belum memiliki rincian barang!</p>
                        <p className="text-xs text-red-500 mt-1">Silakan "Edit Proyek" terlebih dahulu untuk memasukkan rincian barang logistik.</p>
                    </div>
                ) : (
                    <div className="grid gap-2.5 max-h-64 overflow-y-auto pr-1">
                        {projectItems.map(pi => {
                            const remaining = Math.max(0, pi.quantity - (pi.receivedQuantity || 0));
                            return (
                                <div key={pi.id || pi.itemId} className="flex justify-between items-center border border-slate-200 p-3 rounded-xl bg-slate-50">
                                    <div>
                                        <p className="font-bold text-sm text-slate-800">{pi.item?.name || 'Barang Logistik'}</p>
                                        <p className="text-xs text-slate-500">Kode: <span className="font-mono font-bold text-slate-700">{pi.item?.code || '-'}</span> | Satuan: <b>{pi.item?.unit || 'Pcs'}</b></p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Target: <span className="font-semibold text-blue-600">{pi.quantity}</span> | 
                                            Sdh Diterima: <span className="font-semibold text-green-600">{pi.receivedQuantity || 0}</span> | 
                                            Sisa: <span className={`font-semibold ${remaining > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{remaining}</span>
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Terima ({pi.item?.unit || 'Pcs'})</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            className={`w-24 px-2 py-1.5 border rounded-lg text-sm text-center font-bold ${isMatchesOrder ? 'bg-slate-200 text-slate-600' : 'bg-white text-blue-700'}`} 
                                            placeholder="0"
                                            value={receivedQuantities[pi.itemId] !== undefined ? receivedQuantities[pi.itemId] : ''}
                                            onChange={e => handleQuantityChange(pi.itemId, e.target.value)}
                                            readOnly={isMatchesOrder}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="pt-2 border-t border-slate-200 mt-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} className="w-4 h-4 text-orange-600" />
                    <div>
                        <p className="font-bold text-orange-800">Tutup Proyek (Final)</p>
                        <p className="text-xs text-orange-600">Centang ini jika pengiriman ini adalah yang terakhir dan Anda ingin mengubah status proyek menjadi Selesai.</p>
                    </div>
                </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 font-bold flex items-center gap-2">
                    <PackagePlus size={16} /> Catat Penerimaan & Update Stok
                </button>
            </div>
        </form>
    );
};







