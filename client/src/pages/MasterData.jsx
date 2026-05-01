import { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Building2, MapPin, Tag, Save, Edit, Search } from 'lucide-react';
import api from '../lib/axios';

const MasterData = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdminAset = user.role === 'ADMIN_ASET' || user.role === 'SUPER_ADMIN';
    const isAdminUnit = user.role === 'ADMIN_UNIT';

    const [activeTab, setActiveTab] = useState(isAdminAset ? 'units' : 'rooms');
    const [units, setUnits] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [roomSearch, setRoomSearch] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Form inputs
    const [newUnit, setNewUnit] = useState({
        name: '',
        code: '',
        description: '',
        phone: '',
        email: '',
        address: '',
        headName: '',
        headNip: '',
        logo: ''
    });

    // Helper for image compression
    const compressImage = (base64Str, maxWidth = 300, maxHeight = 300) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality
            };
        });
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show loading state or alert if file is too big to start with
        if (file.size > 5 * 1024 * 1024) {
            alert('File terlalu besar. Sistem akan mencoba mengompresinya, mohon tunggu...');
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const compressed = await compressImage(reader.result);
            setNewUnit(prev => ({ ...prev, logo: compressed }));
        };
        reader.readAsDataURL(file);
    };
    const [newRoom, setNewRoom] = useState({ 
        name: '', 
        code: '', 
        floor: '1', 
        building: '', 
        unitId: (user.role === 'ADMIN_UNIT' ? user.unitId : '') 
    });
    const [newCategory, setNewCategory] = useState({ name: '', code: '', usefulLife: 5 });
    const [editingItem, setEditingItem] = useState(null); // { type, id, data }
    const [selectedIds, setSelectedIds] = useState(new Set());


    const toggleSelectAll = (e) => {
        if (e.target.checked) {
            const currentData = activeTab === 'units' ? units : activeTab === 'rooms' ? rooms : categories;
            setSelectedIds(new Set(currentData.map(item => item.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const toggleSelectItem = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Hapus ${selectedIds.size} data terpilih?`)) return;
        try {
            await api.delete(`/master/${activeTab}/bulk`, { data: { ids: Array.from(selectedIds) } });
            setSelectedIds(new Set());
            fetchData();
        } catch (err) { alert(err.message); }
    };

    const changeTab = (tab) => {
        setActiveTab(tab);
        setSelectedIds(new Set());
        setEditingItem(null);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [ru, rr, rc] = await Promise.all([
                api.get('/master/units'),
                api.get('/master/rooms'),
                api.get('/master/categories')
            ]);
            setUnits(ru.data);
            setRooms(rr.data);
            setCategories(rc.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCleanupRooms = async () => {
        if (!confirm('Gabungkan semua ruangan dengan nama yang sama dalam satu unit? Aset akan dipindahkan secara otomatis ke ruangan utama.')) return;
        try {
            setActionLoading(true);
            const res = await api.post('/master/rooms/cleanup');
            alert(res.data.message);
            fetchData();
        } catch (err) { alert(err.message); }
        finally { setActionLoading(false); }
    };

    const handleSyncCodes = async () => {
        if (!confirm('Sinkronisasi ulang semua kode aset berdasarkan kode unit dan kategori terbaru?')) return;
        try {
            setActionLoading(true);
            const res = await api.post('/master/assets/sync');
            alert(res.data.message);
            fetchData();
        } catch (err) { alert(err.message); }
        finally { setActionLoading(false); }
    };




    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAddUnit = async (e) => {
        e.preventDefault();
        try {
            if (editingItem && editingItem.type === 'units') {
                await api.put(`/master/units/${editingItem.id}`, newUnit);
                setEditingItem(null);
            } else {
                await api.post('/master/units', newUnit);
            }
            setNewUnit({
                name: '',
                code: '',
                description: '',
                phone: '',
                email: '',
                address: '',
                headName: '',
                headNip: '',
                logo: ''
            });
            fetchData();
        } catch (err) { alert(err.message); }
    };

    const handleAddRoom = async (e) => {
        e.preventDefault();
        try {
            if (editingItem && editingItem.type === 'rooms') {
                await api.put(`/master/rooms/${editingItem.id}`, newRoom);
                setEditingItem(null);
            } else {
                await api.post('/master/rooms', newRoom);
            }
            setNewRoom({ 
                name: '', 
                code: '', 
                floor: '1', 
                building: '', 
                unitId: (user.role === 'ADMIN_UNIT' ? user.unitId : '') 
            });
            fetchData();
        } catch (err) { alert(err.message); }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        try {
            if (editingItem && editingItem.type === 'categories') {
                await api.put(`/master/categories/${editingItem.id}`, newCategory);
                setEditingItem(null);
            } else {
                await api.post('/master/categories', newCategory);
            }
            setNewCategory({ name: '', code: '', usefulLife: 5 });
            fetchData();
        } catch (err) { alert(err.message); }
    };


    const handleDelete = async (type, id) => {
        if (!confirm('Hapus data ini?')) return;
        try {
            await api.delete(`/master/${type}/${id}`);
            if (editingItem && editingItem.id === id) setEditingItem(null);
            fetchData();
        } catch (err) { alert(err.message); }
    };

    const handleEdit = async (type, item) => {
        setEditingItem({ type, id: item.id });
        if (type === 'units') {
            try {
                const { data } = await api.get(`/master/units/${item.id}`);
                setNewUnit({
                    name: data.name || '',
                    code: data.code || '',
                    description: data.description || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    address: data.address || '',
                    headName: data.headName || '',
                    headNip: data.headNip || '',
                    logo: data.logo || ''
                });
            } catch (error) {
                console.error("Failed to fetch unit details:", error);
                setNewUnit({
                    name: item.name,
                    code: item.code,
                    description: item.description || '',
                    phone: item.phone || '',
                    email: item.email || '',
                    address: item.address || '',
                    headName: item.headName || '',
                    headNip: item.headNip || '',
                    logo: ''
                });
            }
        }
        if (type === 'rooms') setNewRoom({ 
            name: item.name, 
            code: item.code, 
            floor: item.floor, 
            building: item.building, 
            unitId: (user.role === 'ADMIN_UNIT' ? user.unitId : item.unitId)
        });
        if (type === 'categories') setNewCategory({ name: item.name, code: item.code, usefulLife: item.usefulLife });
        setActiveTab(type);
    };

    const cancelEdit = () => {
        setEditingItem(null);
        setNewUnit({
            name: '',
            code: '',
            description: '',
            phone: '',
            email: '',
            address: '',
            headName: '',
            headNip: '',
            logo: ''
        });
        setNewRoom({ 
            name: '', 
            code: '', 
            floor: '1', 
            building: '', 
            unitId: (user.role === 'ADMIN_UNIT' ? user.unitId : '') 
        });
        setNewCategory({ name: '', code: '', usefulLife: 5 });
    };



    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Database className="text-blue-600" /> Pengelolaan Master Data
                </h1>
                <p className="text-slate-500 text-sm">Kelola Unit, Ruangan, dan Kategori untuk dropdown formulir aset</p>
            </div>

            <div className="flex justify-between items-center">
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100 w-fit">
                    {isAdminAset && (
                        <button onClick={() => changeTab('units')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'units' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Unit / Divisi</button>
                    )}
                    <button onClick={() => changeTab('rooms')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'rooms' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Ruangan</button>
                    {isAdminAset && (
                        <button onClick={() => changeTab('categories')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'categories' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Kategori</button>
                    )}
                </div>
                <div className="flex gap-2">
                    {isAdminAset && activeTab === 'rooms' && (
                        <button 
                            disabled={actionLoading}
                            onClick={handleCleanupRooms} 
                            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save size={16} /> {actionLoading ? 'Memproses...' : 'Bersihkan Duplikat'}
                        </button>
                    )}
                    {isAdminAset && activeTab === 'units' && (
                        <button 
                            disabled={actionLoading}
                            onClick={handleSyncCodes} 
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <Database size={16} /> {actionLoading ? 'Memproses...' : 'Sinkronisasi Kode'}
                        </button>
                    )}
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center gap-2 animate-in slide-in-from-right-5 fade-in">
                            <Trash2 size={16} /> Hapus {selectedIds.size} Terpilih
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Plus className="text-blue-600" size={20} /> {editingItem ? 'Edit' : 'Tambah'} {activeTab === 'units' ? 'Unit' : activeTab === 'rooms' ? 'Ruangan' : activeTab === 'categories' ? 'Kategori' : 'Vendor'}
                        </h3>
                        {editingItem && (
                            <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-slate-600 font-medium">Batal</button>
                        )}
                    </div>

                    {activeTab === 'units' && isAdminAset && (
                        <form onSubmit={handleAddUnit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Unit</label>
                                    <input required value={newUnit.name} onChange={e => setNewUnit({ ...newUnit, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Pemasaran" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Kode Unit</label>
                                    <input required value={newUnit.code} onChange={e => setNewUnit({ ...newUnit, code: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="MKT" />
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Informasi Pimpinan</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Kepala Unit</label>
                                        <input value={newUnit.headName} onChange={e => setNewUnit({ ...newUnit, headName: e.target.value })} className="w-full border border-white rounded-lg px-3 py-2 text-sm outline-none shadow-sm" placeholder="Ravi Kurnia" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">NIY Kepala Unit</label>
                                        <input value={newUnit.headNip} onChange={e => setNewUnit({ ...newUnit, headNip: e.target.value })} className="w-full border border-white rounded-lg px-3 py-2 text-sm outline-none shadow-sm" placeholder="1997..." />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nomor Handphone</label>
                                    <input value={newUnit.phone} onChange={e => setNewUnit({ ...newUnit, phone: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="628..." />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Email Unit</label>
                                    <input value={newUnit.email} onChange={e => setNewUnit({ ...newUnit, email: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="unit@mail.com" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Alamat / Lokasi</label>
                                <textarea value={newUnit.address} onChange={e => setNewUnit({ ...newUnit, address: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Gedung A Lantai 2..." />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Logo Unit</label>
                                <div className="flex items-center gap-4 p-3 bg-blue-50/50 border border-blue-100 rounded-xl mt-1">
                                    <div className="w-16 h-16 bg-white border border-blue-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                        {newUnit.logo ? (
                                            <img src={newUnit.logo} alt="Preview" className="w-full h-full object-contain" />
                                        ) : (
                                            <Building2 className="text-blue-300" size={30} />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            id="logoUpload"
                                            className="hidden"
                                            onChange={handleLogoUpload}
                                        />
                                        <label htmlFor="logoUpload" className="inline-block px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 cursor-pointer transition-all">
                                            {newUnit.logo ? 'Ganti Logo' : 'Upload Logo'}
                                        </label>
                                        <p className="text-[10px] text-slate-400 italic">Format PNG/JPG, Maks 1MB</p>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95">
                                <Save size={18} /> {editingItem ? 'Perbarui Profil Unit' : 'Simpan Data Unit'}
                            </button>
                        </form>
                    )}

                    {activeTab === 'rooms' && (
                        <form onSubmit={handleAddRoom} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Unit Induk</label>
                                <select 
                                    required 
                                    disabled={isAdminUnit}
                                    value={newRoom.unitId} 
                                    onChange={e => setNewRoom({ ...newRoom, unitId: e.target.value })} 
                                    className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none bg-white ${isAdminUnit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                >
                                    {!isAdminUnit && <option value="">Pilih Unit</option>}
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                                {isAdminUnit && <p className="text-[10px] text-blue-500 mt-1 font-medium">Anda hanya dapat menambahkan ruangan untuk unit Anda.</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Ruangan</label>
                                <input required value={newRoom.name} onChange={e => setNewRoom({ ...newRoom, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Contoh: Ruang Rapat" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wider">Lokasi (Misal: Lapai / Gedung A)</label>
                                <input required value={newRoom.building} onChange={e => setNewRoom({ ...newRoom, building: e.target.value })} className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Contoh: Lapai" />
                            </div>
                            {!editingItem && (
                                <p className="text-[10px] text-blue-500 italic">
                                    * Kode ruangan otomatis (KodeUnit-xx) dan Lantai diset '1'.
                                </p>
                            )}
                            <button className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                                <Save size={16} /> {editingItem ? 'Perbarui' : 'Simpan'} Ruangan
                            </button>
                        </form>
                    )}

                    {activeTab === 'categories' && isAdminAset && (
                        <form onSubmit={handleAddCategory} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Kategori</label>
                                <input required value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Laptop" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Kode</label>
                                <input required value={newCategory.code} onChange={e => setNewCategory({ ...newCategory, code: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="LPT" />
                            </div>
                            <button className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                                <Save size={16} /> {editingItem ? 'Perbarui' : 'Simpan'} Kategori
                            </button>
                        </form>
                    )}

                </div>

                {/* Table Section */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden h-fit">
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 font-bold text-slate-700 flex items-center justify-between">
                        <span>Daftar {activeTab === 'units' ? 'Unit' : activeTab === 'rooms' ? 'Ruangan' : 'Kategori'}</span>
                        <div className="flex items-center gap-3">
                            {activeTab === 'rooms' && (
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Cari ruangan..." 
                                        value={roomSearch}
                                        onChange={e => setRoomSearch(e.target.value)}
                                        className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 w-40 sm:w-60"
                                    />
                                </div>
                            )}
                            <span className="text-xs font-normal text-slate-500">Total: {activeTab === 'units' ? units.length : activeTab === 'rooms' ? rooms.length : categories.length} item</span>
                        </div>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 w-4">
                                        <input
                                            type="checkbox"
                                            onChange={toggleSelectAll}
                                            checked={
                                                (activeTab === 'units' && units.length > 0 && selectedIds.size === units.length) ||
                                                (activeTab === 'rooms' && rooms.length > 0 && selectedIds.size === rooms.length) ||
                                                (activeTab === 'categories' && categories.length > 0 && selectedIds.size === categories.length)
                                            }
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="px-6 py-3">Nama</th>
                                    {activeTab === 'vendors' ? <th className="px-6 py-3">Kontak</th> : <th className="px-6 py-3">Kode</th>}
                                    {activeTab === 'rooms' && <th className="px-6 py-3">Lokasi</th>}
                                    {activeTab === 'rooms' && <th className="px-6 py-3">Unit</th>}
                                    <th className="px-6 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {activeTab === 'units' && isAdminAset && units.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(u.id)}
                                                onChange={() => toggleSelectItem(u.id)}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-6 py-3 font-medium text-slate-800">{u.name}</td>
                                        <td className="px-6 py-3 text-slate-600 font-mono">{u.code}</td>
                                        <td className="px-6 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit('units', u)} className="p-1 px-2 text-blue-500 hover:bg-blue-50 rounded transition-colors"><Edit size={16} /></button>
                                                <button onClick={() => handleDelete('units', u.id)} className="p-1 px-2 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                 {activeTab === 'rooms' && rooms
                                    .filter(r => r.name.toLowerCase().includes(roomSearch.toLowerCase()) || (r.unit?.name || '').toLowerCase().includes(roomSearch.toLowerCase()))
                                    .map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(r.id)}
                                                onChange={() => toggleSelectItem(r.id)}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-6 py-3 font-medium text-slate-800">{r.name}</td>
                                        <td className="px-6 py-3 text-slate-600 font-mono italic">{r.code}</td>
                                        <td className="px-6 py-3 text-blue-600 font-semibold">{r.building || '-'}</td>
                                        <td className="px-6 py-3 text-slate-500 text-xs">{r.unit?.name || '-'}</td>
                                        <td className="px-6 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit('rooms', r)} className="p-1 px-2 text-blue-500 hover:bg-blue-50 rounded transition-colors"><Edit size={16} /></button>
                                                <button onClick={() => handleDelete('rooms', r.id)} className="p-1 px-2 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {activeTab === 'categories' && isAdminAset && categories.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(c.id)}
                                                onChange={() => toggleSelectItem(c.id)}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-6 py-3 font-medium text-slate-800">{c.name}</td>
                                        <td className="px-6 py-3 text-slate-600 font-mono">{c.code}</td>
                                        <td className="px-6 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit('categories', c)} className="p-1 px-2 text-blue-500 hover:bg-blue-50 rounded transition-colors"><Edit size={16} /></button>
                                                <button onClick={() => handleDelete('categories', c.id)} className="p-1 px-2 text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MasterData;
