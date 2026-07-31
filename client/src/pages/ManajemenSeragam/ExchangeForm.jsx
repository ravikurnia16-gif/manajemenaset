import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

const InputField = ({ label, ...props }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase">{label}</label>
        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" {...props} />
    </div>
);

const SelectField = ({ label, children, ...props }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase">{label}</label>
        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" {...props}>
            {children}
        </select>
    </div>
);

export const ExchangeForm = ({ warehouses = [], variants = [], onSave }) => {
    const [form, setForm] = useState({
        customerName: '',
        studentName: '',
        warehouseId: warehouses[0]?.id || '',
        fromVariantId: '',
        toVariantId: '',
        qty: 1,
        reason: 'SIZE_MISMATCH',
        note: ''
    });

    const selectedFromVariant = variants.find(v => String(v.id) === String(form.fromVariantId));
    const availableToVariants = selectedFromVariant 
        ? variants.filter(v => String(v.itemId) === String(selectedFromVariant.itemId))
        : [];

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <InputField label="Nama Pelanggan / Wali Murid *" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} required />
                <InputField label="Nama Siswa" value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })} />
            </div>

            <SelectField label="Lokasi Gudang Penukaran *" value={form.warehouseId} onChange={e => setForm({ ...form, warehouseId: e.target.value })} required>
                <option value="">-- Pilih Gudang --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </SelectField>

            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-4">
                <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                    <RefreshCw size={16} /> Rincian Penukaran
                </h3>
                
                <SelectField label="Barang yang Dikembalikan (Dari) *" value={form.fromVariantId} onChange={e => setForm({ ...form, fromVariantId: e.target.value, toVariantId: '' })} required>
                    <option value="">-- Pilih Barang yang Dikembalikan --</option>
                    {variants.map(v => (
                        <option key={v.id} value={v.id}>{v.sku} - {v.item?.name} ({v.sizeName})</option>
                    ))}
                </SelectField>

                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                        <SelectField label="Barang Pengganti (Ke) *" value={form.toVariantId} onChange={e => setForm({ ...form, toVariantId: e.target.value })} required disabled={!form.fromVariantId}>
                            <option value="">-- Pilih Ukuran Pengganti --</option>
                            {availableToVariants.map(v => (
                                <option key={v.id} value={v.id}>{v.sku} - {v.item?.name} ({v.sizeName})</option>
                            ))}
                        </SelectField>
                    </div>
                    <div>
                        <InputField label="Jumlah (Qty) *" type="number" min="1" value={form.qty} onChange={e => setForm({ ...form, qty: parseInt(e.target.value) || 1 })} required />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <SelectField label="Alasan Penukaran *" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} required>
                    <option value="SIZE_MISMATCH">Ukuran Tidak Pas</option>
                    <option value="DEFECTIVE">Barang Cacat / Rusak</option>
                    <option value="WRONG_ITEM">Salah Barang</option>
                    <option value="OTHER">Lainnya</option>
                </SelectField>
                <InputField label="Catatan Tambahan" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-blue-500/30">
                    <RefreshCw size={18} /> Proses Penukaran
                </button>
            </div>
        </form>
    );
};
