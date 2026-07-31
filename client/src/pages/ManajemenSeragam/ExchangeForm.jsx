import { useState } from 'react';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';

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

const VariantInput = ({ label, value, onChange, variants, placeholder }) => {
    const selected = variants.find(v => String(v.id) === String(value));
    const [inputValue, setInputValue] = useState(selected ? `${selected.item?.name} (${selected.sizeName})` : '');

    return (
        <div className="space-y-1.5">
           <label className="block text-xs font-bold text-slate-500 uppercase">{label}</label>
           <input 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              list="variants-list-opts"
              value={inputValue}
              onChange={e => {
                  setInputValue(e.target.value);
                  const matched = variants.find(v => `${v.item?.name} (${v.sizeName})` === e.target.value);
                  if (matched) onChange(matched.id);
                  else onChange('');
              }}
              placeholder={placeholder || "Ketik nama barang..."}
              required
           />
           <datalist id="variants-list-opts">
               {variants.map(v => <option key={v.id} value={`${v.item?.name} (${v.sizeName})`} />)}
           </datalist>
        </div>
    );
};

export const ExchangeForm = ({ warehouses = [], variants = [], onSave }) => {
    const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
    const [studentName, setStudentName] = useState('');
    const [reason, setReason] = useState('SIZE_MISMATCH');
    const [note, setNote] = useState('');
    const [exchanges, setExchanges] = useState([{ fromVariantId: '', toVariantId: '', qty: 1 }]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            warehouseId,
            studentName,
            reason,
            note,
            exchanges
        });
    };

    const updateExchange = (index, field, value) => {
        const newExchanges = [...exchanges];
        newExchanges[index][field] = value;
        if (field === 'fromVariantId') newExchanges[index].toVariantId = ''; // reset target
        setExchanges(newExchanges);
    };

    const removeExchange = (index) => {
        setExchanges(exchanges.filter((_, i) => i !== index));
    };

    const addExchange = () => {
        setExchanges([...exchanges, { fromVariantId: '', toVariantId: '', qty: 1 }]);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <InputField label="Nama Siswa *" value={studentName} onChange={e => setStudentName(e.target.value)} required placeholder="Ketik nama siswa..." />
                <SelectField label="Lokasi Gudang Penukaran *" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
                    <option value="">-- Pilih Gudang --</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </SelectField>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                        <RefreshCw size={16} /> Rincian Penukaran
                    </h3>
                    <button type="button" onClick={addExchange} className="text-xs flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 font-bold">
                        <Plus size={14} /> Tambah Barang
                    </button>
                </div>

                {exchanges.map((exc, index) => {
                    const selectedFromVariant = variants.find(v => String(v.id) === String(exc.fromVariantId));
                    const availableToVariants = selectedFromVariant 
                        ? variants.filter(v => String(v.itemId) === String(selectedFromVariant.itemId))
                        : [];

                    return (
                        <div key={index} className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-4 relative">
                            {exchanges.length > 1 && (
                                <button type="button" onClick={() => removeExchange(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 bg-white rounded-full shadow-sm">
                                    <Trash2 size={14} />
                                </button>
                            )}
                            
                            <VariantInput 
                                label="Barang yang Dikembalikan (Ketik Nama) *" 
                                value={exc.fromVariantId} 
                                onChange={val => updateExchange(index, 'fromVariantId', val)} 
                                variants={variants} 
                            />

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <SelectField label="Barang Pengganti (Ke) *" value={exc.toVariantId} onChange={e => updateExchange(index, 'toVariantId', e.target.value)} required disabled={!exc.fromVariantId}>
                                        <option value="">-- Pilih Ukuran Pengganti --</option>
                                        {availableToVariants.map(v => (
                                            <option key={v.id} value={v.id}>{v.item?.name} ({v.sizeName})</option>
                                        ))}
                                    </SelectField>
                                </div>
                                <div>
                                    <InputField label="Jumlah (Qty) *" type="number" min="1" value={exc.qty} onChange={e => updateExchange(index, 'qty', parseInt(e.target.value) || 1)} required />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <SelectField label="Alasan Penukaran *" value={reason} onChange={e => setReason(e.target.value)} required>
                    <option value="SIZE_MISMATCH">Ukuran Tidak Pas</option>
                    <option value="DEFECTIVE">Barang Cacat / Rusak</option>
                    <option value="WRONG_ITEM">Salah Barang</option>
                    <option value="OTHER">Lainnya</option>
                </SelectField>
                <InputField label="Catatan Tambahan" value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-blue-500/30">
                    <RefreshCw size={18} /> Proses Penukaran
                </button>
            </div>
        </form>
    );
};
