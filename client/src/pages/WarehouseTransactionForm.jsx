import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Search, Package, DollarSign } from 'lucide-react';
import api from '../lib/axios';

const WarehouseTransactionForm = () => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [type, setType] = useState('IN');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [note, setNote] = useState('');
    const [allItems, setAllItems] = useState([]);
    const [rows, setRows] = useState([{ itemId: '', quantity: '1', price: '', recipientName: '', recipientUnit: '', search: '' }]);

    useEffect(() => {
        api.get('/warehouse/items').then(r => setAllItems(r.data)).catch(console.error);
    }, []);

    const addRow = () => setRows(prev => [...prev, { itemId: '', quantity: '1', price: '', recipientName: '', recipientUnit: '', search: '' }]);

    const removeRow = (idx) => {
        if (rows.length === 1) return;
        setRows(prev => prev.filter((_, i) => i !== idx));
    };

    const updateRow = (idx, field, value) => {
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };

    const selectItem = (idx, item) => {
        setRows(prev => prev.map((r, i) => i === idx ? { 
            ...r, 
            itemId: item.id.toString(), 
            price: item.purchasePrice?.toString() || '',
            search: `${item.code} - ${item.name}${item.type ? ` [${item.type}]` : ''}${item.itemUnit ? ` (${item.itemUnit})` : ''}${item.size ? ` (${item.size})` : ''}${item.purchaseYear ? ` [${item.purchaseYear}]` : ''}` 
        } : r));
    };

    const getFilteredItems = (searchTerm) => {
        if (!searchTerm) return allItems.slice(0, 15);
        const searchTerms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);

        return allItems.filter(i => {
            const displayGender = i.gender === 'L' ? 'Ikhwan' : i.gender === 'P' ? 'Akhwat' : i.gender;
            const searchableText = [
                i.code, i.name, i.type, displayGender, i.itemUnit,
                i.size ? `Ukuran ${i.size}` : null, i.purchaseYear, i.category?.name
            ].filter(Boolean).join(' ').toLowerCase();

            return searchTerms.every(term => searchableText.includes(term));
        }).slice(0, 15);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validRows = rows.filter(r => r.itemId && parseInt(r.quantity) > 0);
        if (validRows.length === 0) return alert('Tambahkan minimal 1 item');

        try {
            setSaving(true);
            await api.post('/warehouse/transactions', {
                type, date, note,
                items: validRows.map(r => ({
                    itemId: parseInt(r.itemId),
                    quantity: parseInt(r.quantity),
                    price: type === 'IN' ? parseFloat(r.price) || 0 : null,
                    recipientName: r.recipientName || null,
                    recipientUnit: r.recipientUnit || null
                }))
            });
            alert('Transaksi berhasil!');
            navigate('/gudang/transaksi');
        } catch (e) { alert(e.response?.data?.error || 'Gagal'); } finally { setSaving(false); }
    };

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/gudang/transaksi')} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Transaksi Baru</h1>
                    <p className="text-sm text-slate-500 mt-1">Catat barang masuk atau keluar gudang</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div className="flex gap-3">
                    <button type="button" onClick={() => setType('IN')}
                        className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold text-center transition-all flex items-center justify-center gap-2 ${type === 'IN' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <ArrowDownCircle size={18} /> Barang Masuk
                    </button>
                    <button type="button" onClick={() => setType('OUT')}
                        className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold text-center transition-all flex items-center justify-center gap-2 ${type === 'OUT' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <ArrowUpCircle size={18} /> Barang Keluar
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tanggal</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Catatan (Opsional)</label>
                        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Misal: Pembelian semester genap" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-slate-700">Daftar Item</label>
                        <button type="button" onClick={addRow} className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:text-indigo-800"><Plus size={14} /> Tambah Baris</button>
                    </div>

                    <div className="space-y-3">
                        {rows.map((row, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
                                <div className="flex gap-2 items-start">
                                    <div className="flex-1 relative">
                                        <Search size={14} className="absolute left-2.5 top-3 text-slate-400" />
                                        <input
                                            type="text"
                                            value={row.search}
                                            onChange={e => { updateRow(idx, 'search', e.target.value); updateRow(idx, 'itemId', ''); }}
                                            placeholder="Cari kode/nama barang..."
                                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                        />
                                        {row.search && !row.itemId && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                                {getFilteredItems(row.search).map(item => (
                                                    <button key={item.id} type="button" onClick={() => selectItem(idx, item)}
                                                        className="w-full text-left p-2.5 hover:bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                                                        {item.image ? (
                                                            <img src={item.image} alt={item.name} className="w-8 h-8 rounded bg-slate-200 object-cover border border-slate-100 shrink-0" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                                                                <Package size={14} />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 overflow-hidden">
                                                            <div className="text-xs truncate">
                                                                <span className="font-mono text-indigo-600">{item.code}</span>
                                                                <span className="ml-1 font-bold">{item.name}</span>
                                                                {item.type && <span className="text-indigo-500 font-bold ml-1">[{item.type}]</span>}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 truncate">
                                                                {item.itemUnit && <span>{item.itemUnit}</span>}
                                                                {item.size && <span className="ml-1">({item.size})</span>}
                                                                {item.gender && <span className="ml-1">{item.gender === 'L' ? 'Ikhwan' : 'Akhwat'}</span>}
                                                                {item.purchaseYear && <span className="ml-1">[{item.purchaseYear}]</span>}
                                                                <span className={`ml-2 font-bold ${item.stock <= item.minStock ? 'text-red-500' : 'text-green-600'}`}>Stok: {item.stock}</span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <input type="number" value={row.quantity} onChange={e => updateRow(idx, 'quantity', e.target.value)} min="1" className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center" placeholder="Qty" />
                                        <span className="text-[10px] text-center text-slate-400 font-bold">JUMLAH</span>
                                    </div>
                                    {type === 'IN' && (
                                        <div className="flex flex-col gap-1">
                                            <div className="relative">
                                                <DollarSign size={12} className="absolute left-2 top-3 text-slate-400" />
                                                <input type="number" value={row.price} onChange={e => updateRow(idx, 'price', e.target.value)} className="w-32 pl-6 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="Harga Beli" />
                                            </div>
                                            <span className="text-[10px] text-center text-slate-400 font-bold uppercase">Harga Satuan</span>
                                        </div>
                                    )}
                                    <button type="button" onClick={() => removeRow(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg self-start mt-1"><Trash2 size={16} /></button>
                                </div>
                                {type === 'OUT' && (
                                    <div className="flex gap-2">
                                        <input type="text" value={row.recipientName} onChange={e => updateRow(idx, 'recipientName', e.target.value)} placeholder="Nama Penerima" className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" />
                                        <input type="text" value={row.recipientUnit} onChange={e => updateRow(idx, 'recipientUnit', e.target.value)} placeholder="Unit Penerima" className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" disabled={saving}
                    className={`w-full py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 text-white ${type === 'IN' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-orange-600 to-amber-600'}`}>
                    <Save size={18} /> {saving ? 'Menyimpan...' : `Simpan Transaksi ${type === 'IN' ? 'Masuk' : 'Keluar'}`}
                </button>
            </form>
        </div>
    );
};

export default WarehouseTransactionForm;
