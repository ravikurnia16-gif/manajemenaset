import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Download, Upload, Trash2, Edit } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';

const WarehouseStock = () => {
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [genderFilter, setGenderFilter] = useState('');
    const [sizeFilter, setSizeFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const navigate = useNavigate();

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = {};
            if (categoryFilter) params.categoryId = categoryFilter;
            if (genderFilter) params.gender = genderFilter;
            if (sizeFilter) params.size = sizeFilter;
            if (typeFilter) params.type = typeFilter;
            if (yearFilter) params.purchaseYear = yearFilter;
            if (search) params.search = search;
            const [itemsRes, catsRes] = await Promise.all([
                api.get('/warehouse/items', { params }),
                api.get('/warehouse/categories')
            ]);
            setItems(itemsRes.data);
            setCategories(catsRes.data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [categoryFilter, genderFilter, sizeFilter, typeFilter, yearFilter]);

    const filtered = items.filter(i => {
        if (!search) return true;
        const displayGender = i.gender === 'L' ? 'Ikhwan' : i.gender === 'P' ? 'Akhwat' : i.gender;
        const searchableText = [
            i.code, i.name, i.type, displayGender, i.itemUnit,
            i.size ? `Ukuran ${i.size}` : null, i.purchaseYear, i.category?.name
        ].filter(Boolean).join(' ').toLowerCase();

        const searchTerms = search.toLowerCase().split(/\s+/).filter(Boolean);
        return searchTerms.every(term => searchableText.includes(term));
    });

    const handleDelete = async (id) => {
        if (!confirm('Hapus item ini?')) return;
        try { await api.delete(`/warehouse/items/${id}`); fetchData(); } catch (e) { alert('Gagal menghapus'); }
    };

    const handleTemplate = () => {
        const headers = ['Nama', 'KategoriID', 'Tipe', 'Gender', 'Ukuran', 'TahunPembelian', 'Unit', 'Stok', 'StokMin', 'HargaBeli', 'Supplier', 'Lokasi'];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        ws['!cols'] = headers.map(() => ({ wch: 18 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'template_gudang.xlsx');
    };

    const handleExport = async () => {
        try {
            const res = await api.get('/warehouse/items/export');
            const data = res.data;
            const headers = ['Kode', 'Nama', 'Kategori', 'Tipe', 'Gender', 'Ukuran', 'Tahun', 'Unit', 'Stok', 'Stok Min', 'Harga', 'Supplier', 'Lokasi'];
            const rows = data.map(i => [i.code, i.name, i.category?.name || '', i.type || '', i.gender || '', i.size || '', i.purchaseYear || '', i.itemUnit || '', i.stock, i.minStock, i.purchasePrice || '', i.supplier || '', i.location || '']);
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            ws['!cols'] = headers.map(() => ({ wch: 16 }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Stok Gudang');
            XLSX.writeFile(wb, `stok_gudang_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) { alert('Gagal export'); }
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        const processRows = async (rows) => {
            const dataRows = rows.slice(1).filter(r => r[0] && !String(r[0]).startsWith('#'));
            const items = dataRows.map(cols => ({
                name: String(cols[0] || '').trim(),
                categoryId: String(cols[1] || '').trim(),
                type: String(cols[2] || '').trim() || null,
                gender: (() => {
                    const g = String(cols[3] || '').trim().toLowerCase();
                    if (!g) return null;
                    if (['l', 'ikhwan', 'laki-laki'].includes(g)) return 'L';
                    if (['p', 'akhwat', 'perempuan'].includes(g)) return 'P';
                    return String(cols[3]).trim();
                })(),
                size: String(cols[4] || '').trim() || null,
                purchaseYear: String(cols[5] || '').trim() || null,
                itemUnit: String(cols[6] || '').trim() || null,
                stock: String(cols[7] || '').trim() || '0',
                minStock: String(cols[8] || '').trim() || '5',
                purchasePrice: String(cols[9] || '').trim() || null,
                supplier: String(cols[10] || '').trim() || null,
                location: String(cols[11] || '').trim() || null,
            })).filter(item => item.name);
            try {
                const res = await api.post('/warehouse/items/import', { items });
                alert(res.data.message);
                fetchData();
            } catch (err) { alert(err.response?.data?.error || 'Gagal import'); }
            e.target.value = '';
        };
        const reader = new FileReader();
        reader.onload = (ev) => {
            const wb = XLSX.read(ev.target.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            processRows(rows);
        };
        reader.readAsArrayBuffer(file);
    };

    const years = [...new Set(items.map(i => i.purchaseYear).filter(Boolean))].sort((a, b) => b - a);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Package className="text-indigo-600" /> Data Stok Gudang</h1>
                    <p className="text-sm text-slate-500 mt-1">Kelola stok barang gudang</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={handleTemplate} className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"><Download size={14} /> Template</button>
                    <label className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 cursor-pointer">
                        <Download size={14} /> Import
                        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} className="hidden" />
                    </label>
                    <button onClick={handleExport} className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"><Upload size={14} /> Export</button>

                    <button onClick={() => navigate('/gudang/stok/input')} className="flex items-center gap-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl"><Plus size={16} /> Tambah</button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Cari kode/nama..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <option value="">Semua Kategori</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <option value="">Semua Gender</option>
                    <option value="Ikhwan">Ikhwan</option>
                    <option value="Akhwat">Akhwat</option>
                </select>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <option value="">Semua Tipe</option>
                    <option value="BAJU">Baju</option>
                    <option value="CELANA">Celana</option>
                    <option value="JILBAB">Jilbab</option>
                </select>
                <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                    <option value="">Semua Ukuran</option>
                    {['SS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '38', '40', '42', '44', '46', '48', '50/20', '50/22', '50/24', '52/20', '52/22', '52/24', '54/20', '54/22', '54/24'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {years.length > 0 && (
                    <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                        <option value="">Semua Tahun</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? <div className="p-10 text-center text-slate-400">Memuat...</div> : filtered.length === 0 ? (
                    <div className="p-10 text-center text-slate-400"><Package size={40} className="mx-auto mb-2 text-slate-300" />Belum ada data stok</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead><tr className="bg-slate-50 border-b">
                                <th className="text-left p-3 font-semibold text-slate-600">Kode</th>
                                <th className="text-left p-3 font-semibold text-slate-600">Nama Barang</th>
                                <th className="text-left p-3 font-semibold text-slate-600">Kategori</th>
                                <th className="text-left p-3 font-semibold text-slate-600">Lokasi</th>
                                <th className="text-center p-3 font-semibold text-slate-600">Stok</th>
                                <th className="text-center p-3 font-semibold text-slate-600">Aksi</th>
                            </tr></thead>
                            <tbody>
                                {filtered.map(item => {
                                    const displayGender = item.gender === 'L' ? 'Ikhwan' : item.gender === 'P' ? 'Akhwat' : item.gender;
                                    const isSeragam = item.category?.name?.toLowerCase().includes('seragam');
                                    let parts = isSeragam ? [item.type, item.name, displayGender, item.itemUnit ? <span key="unit" className="text-slate-500 font-bold">({item.itemUnit})</span> : null, item.size ? `Ukuran ${item.size}` : null, item.purchaseYear ? `[${item.purchaseYear}]` : null].filter(Boolean) : [item.name, item.type, displayGender, item.itemUnit ? <span key="unit" className="text-slate-500 font-bold">({item.itemUnit})</span> : null, item.size ? `Ukuran ${item.size}` : null, item.purchaseYear ? `[${item.purchaseYear}]` : null].filter(Boolean);

                                    return (
                                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="p-3 font-mono text-xs">{item.code}</td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-3">
                                                    {item.image && (
                                                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                                                            <img src={getMediaUrl(item.image)} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    <div className="font-medium flex flex-wrap gap-1">
                                                        {parts.map((p, i) => <span key={i}>{p}</span>)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{item.category?.name}</span></td>
                                            <td className="p-3 text-sm text-slate-600">{item.location || '-'}</td>
                                            <td className="p-3 text-center">
                                                <span className={`font-bold ${item.stock <= item.minStock ? 'text-red-600' : 'text-green-600'}`}>{item.stock}</span>
                                            </td>
                                            <td className="p-3 text-center flex items-center justify-center gap-1">
                                                <button onClick={() => navigate(`/gudang/stok/edit/${item.id}`)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Edit"><Edit size={15} /></button>
                                                <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Hapus"><Trash2 size={15} /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WarehouseStock;
