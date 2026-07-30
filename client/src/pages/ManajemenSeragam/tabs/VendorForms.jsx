import { useState, useEffect } from 'react';
import api from '../../../lib/axios';
import { Plus, Trash2 } from 'lucide-react';

export const ProjectForm = ({ vendors, initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState(() => {
        if (initialData) {
            return {
                ...initialData,
                projectType: initialData.projectType || 'SELEKSI',
                directVendorId: initialData.directVendorId || '',
                items: initialData.projectItems ? initialData.projectItems.map(pi => ({ variantId: pi.variantId, quantity: pi.quantity, name: pi.variant?.item?.name, sizeName: pi.variant?.sizeName })) : []
            };
        }
        return { year: new Date().getFullYear(), title: '', targetQuantity: 0, status: 'PERENCANAAN', note: '', items: [], projectType: 'SELEKSI', directVendorId: '' };
    });
    const [variants, setVariants] = useState([]);
    const [availableItems, setAvailableItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState('');
    const [variantQuantities, setVariantQuantities] = useState({});

    useEffect(() => {
        api.get('/uniforms/variants').then(res => {
            setVariants(res.data);
            const itemsMap = new Map();
            res.data.forEach(v => {
                if (v.item && !itemsMap.has(v.item.id)) {
                    itemsMap.set(v.item.id, v.item);
                }
            });
            setAvailableItems(Array.from(itemsMap.values()));
        }).catch(console.error);
    }, []);

    const handleAddItemVariants = () => {
        if (!selectedItem) return;
        const itemObj = availableItems.find(i => i.name === selectedItem);
        if (!itemObj) {
            alert("Barang tidak ditemukan.");
            return;
        }

        const itemVariants = variants.filter(v => v.itemId === itemObj.id);
        const newItems = [...formData.items];

        itemVariants.forEach(v => {
            const qty = parseInt(variantQuantities[v.id]) || 0;
            if (qty > 0) {
                // Remove if already exists
                const existingIdx = newItems.findIndex(i => i.variantId === v.id);
                if (existingIdx >= 0) newItems.splice(existingIdx, 1);
                newItems.push({ variantId: v.id, quantity: qty, name: itemObj.name, sizeName: v.sizeName });
            }
        });

        const newTotal = newItems.reduce((acc, curr) => acc + curr.quantity, 0);
        setFormData({ ...formData, items: newItems, targetQuantity: newTotal });
        setSelectedItem('');
        setVariantQuantities({});
    };

    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        const newTotal = newItems.reduce((acc, curr) => acc + curr.quantity, 0);
        setFormData({ ...formData, items: newItems, targetQuantity: newTotal });
    };

    return (
        <form onSubmit={e => { e.preventDefault(); onSave(formData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Proyek</label>
                    <input type="number" required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                    <select className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
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
                    <select className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.projectType} onChange={e => setFormData({ ...formData, projectType: e.target.value })}>
                        <option value="SELEKSI">Proyek Seleksi (Tender)</option>
                        <option value="PENUNJUKAN_LANGSUNG">Penunjukan Langsung (Parsial)</option>
                    </select>
                </div>
                {formData.projectType === 'PENUNJUKAN_LANGSUNG' && (
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Pilih Vendor Langsung</label>
                        <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.directVendorId} onChange={e => setFormData({ ...formData, directVendorId: e.target.value })}>
                            <option value="">-- Pilih Vendor --</option>
                            {vendors && vendors.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Judul / Nama Proyek</label>
                <input type="text" required placeholder={formData.projectType === 'PENUNJUKAN_LANGSUNG' ? 'Contoh: Pesanan Celana SD 2026' : 'Contoh: Pengadaan Seragam Siswa 2026'} className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>
            
            <div className="border border-slate-200 p-3 rounded-xl bg-slate-50 space-y-3">
                <label className="block text-xs font-bold text-slate-700">Daftar Barang Pesanan</label>
                
                <div className="flex flex-col gap-2">
                    <input 
                        type="text"
                        list="available-items"
                        placeholder="Pilih nama barang..."
                        className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white" 
                        value={selectedItem} 
                        onChange={e => setSelectedItem(e.target.value)}
                    />
                    <datalist id="available-items">
                        {availableItems.map(item => (
                            <option key={item.id} value={item.name} />
                        ))}
                    </datalist>

                    {selectedItem && availableItems.find(i => i.name === selectedItem) && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-700 mb-2">Masukkan Jumlah per Ukuran:</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {variants.filter(v => v.item?.name === selectedItem).map(v => (
                                    <div key={v.id} className="flex items-center gap-2">
                                        <label className="text-xs font-medium w-12 text-slate-700">Uk. {v.sizeName}</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            className="w-full px-2 py-1.5 border rounded-lg text-sm text-center bg-slate-50" 
                                            placeholder="0"
                                            value={variantQuantities[v.id] || ''}
                                            onChange={e => setVariantQuantities({...variantQuantities, [v.id]: e.target.value})}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 flex justify-end">
                                <button type="button" onClick={handleAddItemVariants} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">
                                    Tambahkan ke Pesanan
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {formData.items.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600">
                                <tr>
                                    <th className="p-2">Nama Barang & Ukuran</th>
                                    <th className="p-2 w-20 text-center">Jumlah</th>
                                    <th className="p-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {formData.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2">{item.name} - <span className="font-bold border border-slate-300 px-1 rounded">{item.sizeName}</span></td>
                                        <td className="p-2 text-center font-medium">{item.quantity}</td>
                                        <td className="p-2 text-center">
                                            <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-50 font-bold">
                                    <td className="p-2 text-right text-slate-600">Total Keseluruhan:</td>
                                    <td className="p-2 text-center text-blue-600">{formData.targetQuantity}</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" rows={2} value={formData.note || ''} onChange={e => setFormData({ ...formData, note: e.target.value })}></textarea>
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700">Simpan Proyek</button>
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
                <textarea className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" rows={2} placeholder="Contoh: Harga paling kompetitif dan sampel baju sangat bagus." value={formData.reason || ''} onChange={e => setFormData({ ...formData, reason: e.target.value })}></textarea>
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700">Simpan Seleksi</button>
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
                            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
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
            <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700">Simpan MoU</button>
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
                            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
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
            <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700">Simpan Penilaian</button>
            </div>
        </form>
    );
};

export const ProjectReceiveForm = ({ initialData, onSave, onCancel }) => {
    const [warehouseId, setWarehouseId] = useState('');
    const [receivedQuantities, setReceivedQuantities] = useState({});
    const [warehouses, setWarehouses] = useState([]);
    const [isMatchesOrder, setIsMatchesOrder] = useState(true);
    const projectItems = initialData?.projectItems || [];

    useEffect(() => {
        api.get('/uniforms/warehouses').then(res => setWarehouses(res.data)).catch(console.error);
        
        // Auto-fill received quantities from order
        const initialQtys = {};
        projectItems.forEach(pi => {
            initialQtys[pi.variantId] = pi.quantity;
        });
        setReceivedQuantities(initialQtys);
    }, [initialData]);

    const handleQuantityChange = (variantId, val) => {
        setReceivedQuantities(prev => ({
            ...prev,
            [variantId]: parseInt(val) || 0
        }));
    };

    const handleMatchesOrderChange = (matches) => {
        setIsMatchesOrder(matches);
        if (matches) {
            // Reset to ordered quantities
            const initialQtys = {};
            projectItems.forEach(pi => {
                initialQtys[pi.variantId] = pi.quantity;
            });
            setReceivedQuantities(initialQtys);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const itemsToReceive = [];
        Object.entries(receivedQuantities).forEach(([variantId, qty]) => {
            if (qty > 0) {
                itemsToReceive.push({ variantId: parseInt(variantId), quantity: qty });
            }
        });

        if (itemsToReceive.length === 0) {
            alert('Silakan masukkan jumlah barang yang diterima.');
            return;
        }

        const payload = {
            warehouseId: parseInt(warehouseId),
            items: itemsToReceive
        };
        onSave(payload, initialData.id);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl mb-4">
                <p className="text-sm font-bold text-blue-800">Penerimaan Barang Proyek: {initialData?.title}</p>
                <p className="text-xs text-blue-600">Masukkan rincian ukuran barang yang selesai diproduksi dan pilih gudang tujuan penyimpanan.</p>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Gudang Penyimpanan</label>
                <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500 bg-white" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                    <option value="">-- Pilih Gudang --</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
            </div>

            <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                    <p className="text-xs font-bold text-slate-700 mb-2">Apakah barang yang diterima sesuai dengan pesanan?</p>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name="matchesOrder" checked={isMatchesOrder} onChange={() => handleMatchesOrderChange(true)} className="w-4 h-4 text-blue-600" />
                            Ya, Sesuai Pesanan
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name="matchesOrder" checked={!isMatchesOrder} onChange={() => handleMatchesOrderChange(false)} className="w-4 h-4 text-blue-600" />
                            Tidak, Ada Selisih
                        </label>
                    </div>
                </div>

                <label className="block text-xs font-bold text-slate-700">Rincian Ukuran Barang Diterima</label>
                <div className="grid gap-3">
                    {projectItems.map(pi => (
                        <div key={pi.id} className="flex justify-between items-center border border-slate-200 p-3 rounded-xl bg-slate-50">
                            <div>
                                <p className="font-bold text-sm text-slate-800">{pi.variant?.item?.name}</p>
                                <p className="text-xs text-slate-500">Ukuran: <span className="font-bold text-slate-700">{pi.variant?.sizeName}</span> | Dipesan: {pi.quantity}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-slate-700">Diterima:</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    className={`w-20 px-2 py-1.5 border rounded-lg text-sm text-center ${isMatchesOrder ? 'bg-slate-200 text-slate-500' : 'bg-white'}`} 
                                    placeholder="0"
                                    value={receivedQuantities[pi.variantId] !== undefined ? receivedQuantities[pi.variantId] : ''}
                                    onChange={e => handleQuantityChange(pi.variantId, e.target.value)}
                                    readOnly={isMatchesOrder}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-green-600 rounded-xl hover:bg-green-700 font-bold">Terima Barang & Selesai</button>
            </div>
        </form>
    );
};
