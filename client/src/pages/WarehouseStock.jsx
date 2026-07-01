import React, { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Download, Upload, Trash2, Edit, ChevronDown, ChevronRight } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState('SERAGAM');
    const navigate = useNavigate();

    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

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
        
        const processRows = async (rows) => {
            if (rows.length < 2) {
                alert('File kosong atau tidak ada data.');
                return;
            }

            const headerRow = rows[0].map(h => String(h || '').trim().toLowerCase());
            
            const getCol = (names) => {
                for (const name of names) {
                    const idx = headerRow.findIndex(h => h === name.toLowerCase());
                    if (idx !== -1) return idx;
                }
                return -1;
            };

            const idxNama = getCol(['nama', 'nama barang']);
            const idxKategori = getCol(['kategori', 'kategoriid']);
            const idxTipe = getCol(['tipe', 'type']);
            const idxGender = getCol(['gender', 'jenis kelamin']);
            const idxUkuran = getCol(['ukuran', 'size']);
            const idxTahun = getCol(['tahun', 'tahunpembelian', 'tahun pembelian']);
            const idxUnit = getCol(['unit', 'satuan']);
            const idxStok = getCol(['stok', 'stock']);
            const idxStokMin = getCol(['stok min', 'stokmin', 'min stock']);
            const idxHarga = getCol(['harga', 'hargabeli', 'harga beli']);
            const idxSupplier = getCol(['supplier']);
            const idxLokasi = getCol(['lokasi']);

            if (idxNama === -1) {
                alert('Format tidak valid. Kolom Nama tidak ditemukan.');
                e.target.value = '';
                return;
            }

            const dataRows = rows.slice(1).filter(r => r[idxNama] && !String(r[idxNama]).startsWith('#'));
            const items = dataRows.map(cols => {
                return {
                    name: String(cols[idxNama] || '').trim(),
                    categoryId: idxKategori !== -1 ? String(cols[idxKategori] || '').trim() : '',
                    type: idxTipe !== -1 ? String(cols[idxTipe] || '').trim() : null,
                    gender: (() => {
                        if (idxGender === -1) return null;
                        const g = String(cols[idxGender] || '').trim().toLowerCase();
                        if (!g) return null;
                        if (['l', 'ikhwan', 'laki-laki'].includes(g)) return 'L';
                        if (['p', 'akhwat', 'perempuan'].includes(g)) return 'P';
                        return String(cols[idxGender]).trim();
                    })(),
                    size: idxUkuran !== -1 ? String(cols[idxUkuran] || '').trim() : null,
                    purchaseYear: idxTahun !== -1 ? String(cols[idxTahun] || '').trim() : null,
                    itemUnit: idxUnit !== -1 ? String(cols[idxUnit] || '').trim() : null,
                    stock: idxStok !== -1 ? String(cols[idxStok] || '').trim() : '0',
                    minStock: idxStokMin !== -1 ? String(cols[idxStokMin] || '').trim() : '5',
                    purchasePrice: idxHarga !== -1 ? String(cols[idxHarga] || '').trim() : null,
                    supplier: idxSupplier !== -1 ? String(cols[idxSupplier] || '').trim() : null,
                    location: idxLokasi !== -1 ? String(cols[idxLokasi] || '').trim() : null,
                };
            }).filter(item => item.name);
            
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

    const handleRollbackImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const processRows = async (rows) => {
            if (rows.length < 2) return;

            const headerRow = rows[0].map(h => String(h || '').trim().toLowerCase());
            const getCol = (names) => {
                for (const name of names) {
                    const idx = headerRow.findIndex(h => h === name.toLowerCase());
                    if (idx !== -1) return idx;
                }
                return -1;
            };

            const idxNama = getCol(['nama', 'nama barang']);
            const idxKategori = getCol(['kategori', 'kategoriid']);
            const idxTipe = getCol(['tipe', 'type']);
            const idxGender = getCol(['gender', 'jenis kelamin']);
            const idxUkuran = getCol(['ukuran', 'size']);
            const idxUnit = getCol(['unit', 'satuan']);
            const idxStok = getCol(['stok', 'stock']);

            if (idxNama === -1) {
                alert('Format tidak valid.');
                e.target.value = '';
                return;
            }

            const dataRows = rows.slice(1).filter(r => r[idxNama] && !String(r[idxNama]).startsWith('#'));
            const items = dataRows.map(cols => {
                return {
                    name: String(cols[idxNama] || '').trim(),
                    categoryId: idxKategori !== -1 ? String(cols[idxKategori] || '').trim() : '',
                    type: idxTipe !== -1 ? String(cols[idxTipe] || '').trim() : null,
                    gender: (() => {
                        if (idxGender === -1) return null;
                        const g = String(cols[idxGender] || '').trim().toLowerCase();
                        if (!g) return null;
                        if (['l', 'ikhwan', 'laki-laki'].includes(g)) return 'L';
                        if (['p', 'akhwat', 'perempuan'].includes(g)) return 'P';
                        return String(cols[idxGender]).trim();
                    })(),
                    size: idxUkuran !== -1 ? String(cols[idxUkuran] || '').trim() : null,
                    itemUnit: idxUnit !== -1 ? String(cols[idxUnit] || '').trim() : null,
                    stock: idxStok !== -1 ? String(cols[idxStok] || '').trim() : '0',
                };
            }).filter(item => item.name);
            
            try {
                const res = await api.post('/warehouse/items/rollback-import', { items });
                alert(res.data.message);
                fetchData();
            } catch (err) { alert(err.response?.data?.error || 'Gagal rollback'); }
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

    // --- DATA TRANSFORMATION ---
    const displayItemsSeragam = [];
    const displayItemsLainnya = [];
    const seragamGroups = {};

    const sizeOrder = {
        'SS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6, 'XXXL': 7, '4XL': 8,
        '38': 20, '40': 21, '42': 22, '44': 23, '46': 24, '48': 25, '50': 26,
        '50/20': 30, '50/22': 31, '50/24': 32, '52/20': 33, '52/22': 34, '52/24': 35, '54/20': 36, '54/22': 37, '54/24': 38
    };
    
    const sortSizes = (a, b) => {
        const orderA = sizeOrder[a] || 999;
        const orderB = sizeOrder[b] || 999;
        if (orderA !== orderB) return orderA - orderB;
        return String(a).localeCompare(String(b));
    };

    filtered.forEach(item => {
        const isSeragam = item.category?.name?.toLowerCase().includes('seragam');
        if (isSeragam) {
            const displayGender = item.gender === 'L' ? 'Ikhwan' : item.gender === 'P' ? 'Akhwat' : (item.gender || 'Umum');
            const displayUnit = item.itemUnit || '-';
            const groupKey = `${item.name}-${displayGender}-${displayUnit}`;
            
            if (!seragamGroups[groupKey]) {
                seragamGroups[groupKey] = {
                    isGroup: true,
                    id: groupKey,
                    name: item.name,
                    gender: displayGender,
                    unit: displayUnit,
                    category: item.category,
                    items: [],
                    totalStock: 0,
                    firstImage: item.image
                };
                displayItemsSeragam.push(seragamGroups[groupKey]);
            }
            seragamGroups[groupKey].items.push(item);
            seragamGroups[groupKey].totalStock += item.stock;
        } else {
            displayItemsLainnya.push({
                isGroup: false,
                ...item
            });
        }
    });

    const displayItems = activeTab === 'SERAGAM' ? displayItemsSeragam : displayItemsLainnya;

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
                    <label className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 cursor-pointer text-orange-600 border-orange-200 bg-orange-50/30">
                        <Trash2 size={14} /> Rollback
                        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleRollbackImport} className="hidden" />
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

            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('SERAGAM')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'SERAGAM' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    Stok Seragam
                </button>
                <button
                    onClick={() => setActiveTab('LAINNYA')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'LAINNYA' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    Perlengkapan Lainnya
                </button>
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
                                {displayItems.map((row) => {
                                    if (!row.isGroup) {
                                        const item = row;
                                        const displayGender = item.gender === 'L' ? 'Ikhwan' : item.gender === 'P' ? 'Akhwat' : item.gender;
                                        let parts = [item.name, item.type, displayGender, item.itemUnit ? <span key="unit" className="text-slate-500 font-bold">({item.itemUnit})</span> : null, item.size ? `Ukuran ${item.size}` : null, item.purchaseYear ? `[${item.purchaseYear}]` : null].filter(Boolean);

                                        return (
                                            <tr key={`item-${item.id}`} className="border-b border-slate-100 hover:bg-slate-50">
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
                                                <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{item.category?.name || '-'}</span></td>
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
                                    } else {
                                        const group = row;
                                        const isExpanded = expandedGroups.has(group.id);
                                        const uniqueSizes = isExpanded ? [...new Set(group.items.map(i => i.size || '-'))].sort(sortSizes) : [];
                                        const uniqueTypes = isExpanded ? [...new Set(group.items.map(i => i.type || '-'))].sort() : [];

                                        return (
                                            <Fragment key={`group-${group.id}`}>
                                                <tr className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${isExpanded ? 'bg-indigo-50/20' : ''}`} onClick={() => toggleGroup(group.id)}>
                                                    <td className="p-3 font-mono text-xs text-slate-400 font-semibold tracking-wider">GROUP</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`}>
                                                                <ChevronRight size={18}/>
                                                            </div>
                                                            {group.firstImage && (
                                                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                                                                    <img src={getMediaUrl(group.firstImage)} alt="" className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-800 text-[15px]">{group.name}</span>
                                                                <div className="flex gap-1.5 mt-0.5">
                                                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 w-fit">{group.gender}</span>
                                                                    {group.unit !== '-' && (
                                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 w-fit">{group.unit}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{group.category?.name || 'Seragam'}</span></td>
                                                    <td className="p-3 text-sm text-slate-600">-</td>
                                                    <td className="p-3 text-center">
                                                        <span className="font-black text-indigo-700 text-lg">{group.totalStock}</span>
                                                    </td>
                                                    <td className="p-3 text-center text-xs text-slate-400 font-semibold uppercase tracking-wider">
                                                        {isExpanded ? 'Tutup Matriks' : 'Lihat Matriks'}
                                                    </td>
                                                </tr>
                                                
                                                {isExpanded && (
                                                    <tr className="bg-slate-50/60 border-b-2 border-indigo-100">
                                                        <td colSpan={6} className="p-4 md:px-8">
                                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Matriks Stok Berdasarkan Ukuran & Tahun</span>
                                                                    <span className="text-[10px] text-slate-400 font-semibold bg-slate-200/50 px-2 py-1 rounded-md">Arahkan kursor ke angka stok untuk Edit/Hapus</span>
                                                                </div>
                                                                <div className="overflow-x-auto p-4">
                                                                    <table className="min-w-full text-sm border-collapse border border-slate-200">
                                                                        <thead>
                                                                            <tr>
                                                                                <th className="border border-slate-200 p-2.5 text-left bg-slate-50 text-slate-500 font-black tracking-wider text-[10px] uppercase w-32">Tipe</th>
                                                                                {uniqueSizes.map(sz => (
                                                                                    <th key={sz} className="border border-slate-200 p-2.5 text-center bg-slate-50 text-slate-600 font-black tracking-wider text-[11px] uppercase min-w-24">
                                                                                        {sz === '-' ? 'No Size' : sz}
                                                                                    </th>
                                                                                ))}
                                                                                <th className="border border-slate-200 p-2.5 text-center bg-indigo-50/50 text-indigo-700 font-black tracking-wider text-[10px] uppercase w-20">Total</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {uniqueTypes.map((type, idx) => {
                                                                                const rowTotal = group.items.filter(i => (i.type || '-') === type).reduce((sum, i) => sum + i.stock, 0);
                                                                                
                                                                                return (
                                                                                    <tr key={type} className={`hover:bg-slate-50/70 ${idx !== uniqueTypes.length - 1 ? 'border-b border-slate-200' : ''}`}>
                                                                                        <td className="border border-slate-200 p-2.5 font-semibold text-slate-700 bg-slate-50/10">
                                                                                            {type === '-' ? 'Lainnya' : type}
                                                                                        </td>
                                                                                        {uniqueSizes.map(sz => {
                                                                                            const cellItems = group.items.filter(i => (i.type || '-') === type && (i.size || '-') === sz);
                                                                                            const sortedCellItems = [...cellItems].sort((a, b) => {
                                                                                                const yrA = a.purchaseYear ? Number(a.purchaseYear) : 9999;
                                                                                                const yrB = b.purchaseYear ? Number(b.purchaseYear) : 9999;
                                                                                                return yrA - yrB;
                                                                                            });
                                                                                            
                                                                                            return (
                                                                                                <td key={sz} className="border border-slate-200 p-2 text-center align-middle">
                                                                                                    {sortedCellItems.length > 0 ? (
                                                                                                        <div className="flex flex-col gap-1 items-center justify-center">
                                                                                                            {sortedCellItems.map(item => (
                                                                                                                <div key={item.id} className="group/cell relative flex items-center justify-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors w-full min-w-[60px] h-7">
                                                                                                                    <span className={`font-black text-sm ${item.stock <= item.minStock ? 'text-red-500' : 'text-slate-700'}`}>
                                                                                                                        {item.stock} <span className="text-[10px] text-slate-400 font-normal">({item.purchaseYear || '-'})</span>
                                                                                                                    </span>
                                                                                                                    <div className="absolute inset-0 bg-white/95 backdrop-blur-[2px] flex items-center justify-center gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity rounded border border-slate-200 shadow-sm">
                                                                                                                        <button onClick={(e) => { e.stopPropagation(); navigate(`/gudang/stok/edit/${item.id}`); }} className="p-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" title="Edit Item"><Edit size={11}/></button>
                                                                                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors" title="Hapus Item"><Trash2 size={11}/></button>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <span className="text-slate-200">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                            );
                                                                                        })}
                                                                                        <td className="border border-slate-200 p-2.5 text-center font-black text-indigo-600 bg-indigo-50/30">
                                                                                            {rowTotal}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    }
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
