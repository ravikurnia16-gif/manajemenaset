import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag, Shirt, Ruler } from 'lucide-react';
import api from '../../../lib/axios';

const MasterCard = ({ title, icon: Icon, items, onAdd, onEdit, onDelete }) => {
    const [showForm, setShowForm] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [name, setName] = useState('');

    const handleSubmit = async () => {
        try {
            if (!name.trim()) return;
            const payload = { name };
            if (editItem) {
                await onEdit(editItem.id, payload);
            } else {
                await onAdd(payload);
            }
            setName('');
            setEditItem(null);
            setShowForm(false);
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan data');
        }
    };

    const startEdit = (item) => {
        setEditItem(item);
        setName(item.name);
        setShowForm(true);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Icon size={16} className="text-blue-600" /></div>
                    <h3 className="font-bold text-slate-800">{title}</h3>
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <button onClick={() => { setShowForm(!showForm); setEditItem(null); setName(''); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors">
                    <Plus size={16} />
                </button>
            </div>

            {showForm && (
                <div className="p-4 bg-blue-50/50 border-b border-slate-100 flex gap-2 items-end">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Nama</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Masukkan nama..." className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                    </div>
                    <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-blue-700 transition-colors whitespace-nowrap">
                        {editItem ? 'Update' : 'Simpan'}
                    </button>
                    <button onClick={() => { setShowForm(false); setEditItem(null); }} className="text-slate-400 hover:text-red-500 px-2 py-2 transition-colors">✕</button>
                </div>
            )}

            <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
                {items.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">Belum ada data.</div>
                ) : items.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/80 transition-colors group">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-700">{item.name}</span>
                            {item._count && <span className="text-[10px] text-slate-400">({item._count.items || 0} barang)</span>}
                            {item.sortOrder !== undefined && item.sortOrder > 0 && <span className="text-[10px] text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded">#{item.sortOrder}</span>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(item)} className="text-slate-400 hover:text-blue-600 p-1 rounded"><Pencil size={13} /></button>
                            <button onClick={() => onDelete(item.id)} className="text-slate-400 hover:text-red-500 p-1 rounded"><Trash2 size={13} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const MasterDataTab = ({ categories, clothingTypes, sizes, units, fetchData }) => {
    // Kategori handlers
    const addCategory = async (data) => { await api.post('/uniforms/categories', data); fetchData(); };
    const editCategory = async (id, data) => { await api.put(`/uniforms/categories/${id}`, data); fetchData(); };
    const deleteCategory = async (id) => { if (confirm('Hapus kategori ini?')) { await api.delete(`/uniforms/categories/${id}`); fetchData(); } };

    // Jenis Pakaian handlers
    const addClothingType = async (data) => { await api.post('/uniforms/clothing-types', data); fetchData(); };
    const editClothingType = async (id, data) => { await api.put(`/uniforms/clothing-types/${id}`, data); fetchData(); };
    const deleteClothingType = async (id) => { if (confirm('Hapus jenis pakaian ini?')) { await api.delete(`/uniforms/clothing-types/${id}`); fetchData(); } };

    // Ukuran handlers
    const addSize = async (data) => { await api.post('/uniforms/sizes', data); fetchData(); };
    const editSize = async (id, data) => { await api.put(`/uniforms/sizes/${id}`, data); fetchData(); };
    const deleteSize = async (id) => { if (confirm('Hapus ukuran ini?')) { await api.delete(`/uniforms/sizes/${id}`); fetchData(); } };

    // Unit handlers
    const addUnit = async (data) => { await api.post('/uniforms/units', data); fetchData(); };
    const editUnit = async (id, data) => { await api.put(`/uniforms/units/${id}`, data); fetchData(); };
    const deleteUnit = async (id) => { if (confirm('Hapus unit ini?')) { await api.delete(`/uniforms/units/${id}`); fetchData(); } };

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500">Kelola data referensi yang digunakan sebagai pilihan dropdown di seluruh modul seragam.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MasterCard title="Kategori" icon={Tag} items={categories} onAdd={addCategory} onEdit={editCategory} onDelete={deleteCategory} />
                <MasterCard title="Jenis Pakaian" icon={Shirt} items={clothingTypes} onAdd={addClothingType} onEdit={editClothingType} onDelete={deleteClothingType} />
                <MasterCard title="Unit / Jenjang" icon={Tag} items={units} onAdd={addUnit} onEdit={editUnit} onDelete={deleteUnit} />
                <MasterCard title="Ukuran" icon={Ruler} items={sizes} onAdd={addSize} onEdit={editSize} onDelete={deleteSize} />
            </div>
        </div>
    );
};
