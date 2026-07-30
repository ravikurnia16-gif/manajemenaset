import { useState } from 'react';

export const ProjectForm = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState(initialData || { year: new Date().getFullYear(), title: '', targetQuantity: 0, status: 'PERENCANAAN', note: '' });
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
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Judul / Nama Proyek</label>
                <input type="text" required placeholder="Contoh: Pengadaan Seragam Siswa 2026" className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Jumlah Pesanan (Pcs)</label>
                <input type="number" required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.targetQuantity} onChange={e => setFormData({ ...formData, targetQuantity: e.target.value })} />
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
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Proyek</label>
                        <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.projectId} onChange={e => setFormData({ ...formData, projectId: e.target.value })}>
                            <option value="">-- Pilih Proyek --</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Vendor</label>
                        <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.vendorId} onChange={e => setFormData({ ...formData, vendorId: e.target.value })}>
                            <option value="">-- Pilih Vendor --</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
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

    return (
        <form onSubmit={e => { e.preventDefault(); onSave(formData); }} className="space-y-4">
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
                        <label className="block text-xs font-medium text-slate-700 mb-1">Vendor</label>
                        <select required className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-blue-500" value={formData.vendorId} onChange={e => setFormData({ ...formData, vendorId: e.target.value })}>
                            <option value="">-- Pilih Vendor --</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
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
