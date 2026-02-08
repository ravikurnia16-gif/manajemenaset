import { useState, useEffect } from 'react';
import { Save, Building2, UserCheck, ShieldCheck, Globe, Mail, MapPin, Phone } from 'lucide-react';
import api from '../lib/axios';

const Settings = () => {
    const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'users'
    const [settings, setSettings] = useState({
        orgName: '',
        orgAddress: '',
        orgPhone: '',
        orgEmail: '',
        orgLogo: '',
        orgHeadName: '',
        orgHeadNip: '',
        assetCodePrefix: 'AST'
    });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || {});

    // Add User Modal State
    const [showUserModal, setShowUserModal] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        email: '',
        nip: '',
        role: 'USER'
    });

    useEffect(() => {
        fetchSettings();
        if (currentUser.role === 'SUPER_ADMIN') {
            fetchUsers();
        }
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/settings');
            if (res.data) setSettings(res.data);
        } catch (error) {
            console.error("Fetch settings error:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (error) {
            console.error("Fetch users error:", error);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert("Ukuran logo terlalu besar! Maksimal 2MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setSettings({ ...settings, orgLogo: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            await api.put('/settings', settings);
            alert('Pengaturan berhasil disimpan!');
        } catch (error) {
            console.error("Save settings error:", error);
            alert('Gagal menyimpan pengaturan.');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await api.post('/users', newUser);
            alert('User berhasil ditambahkan!');
            setShowUserModal(false);
            setNewUser({ username: '', password: '', email: '', nip: '', role: 'USER' });
            fetchUsers();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menambah user');
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('Hapus user ini?')) return;
        try {
            await api.delete(`/users/${id}`);
            fetchUsers();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menghapus user');
        }
    };

    const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

    if (loading) return <div className="p-8 text-center text-slate-500">Memuat pengaturan...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pengaturan</h1>
                    <p className="text-slate-500 text-sm">Kelola identitas instansi dan hak akses pengguna</p>
                </div>
                {isSuperAdmin && (
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'profile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2 uppercase tracking-tight">
                                <Building2 size={16} /> Profil Instansi
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2 uppercase tracking-tight">
                                <UserCheck size={16} /> Manajemen Pengguna
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'profile' ? (
                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Org Profile */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-50 text-blue-600">
                                <Building2 size={20} />
                                <h2 className="font-semibold uppercase tracking-wider text-xs">Profil Instansi</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-col md:flex-row gap-6 items-center md:items-start pb-4">
                                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden relative group">
                                        {settings.orgLogo ? (
                                            <img src={settings.orgLogo} alt="Logo" className="w-full h-full object-contain" />
                                        ) : (
                                            <Building2 size={32} className="text-slate-300" />
                                        )}
                                        <label className="absolute inset-0 bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                            Ganti Logo
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                        </label>
                                    </div>
                                    <div className="flex-1 space-y-1 text-center md:text-left">
                                        <h3 className="text-sm font-semibold text-slate-800">Logo Instansi</h3>
                                        <p className="text-xs text-slate-500">Format PNG, JPG atau WebP. Maksimal 2MB.</p>
                                        <label className="inline-block mt-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
                                            Pilih File
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Instansi / Yayasan</label>
                                    <input
                                        type="text"
                                        value={settings.orgName}
                                        onChange={e => setSettings({ ...settings, orgName: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Contoh: SMA Negeri 1 Jakarta"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                            <Mail size={14} className="text-slate-400" /> Email Support
                                        </label>
                                        <input
                                            type="email"
                                            value={settings.orgEmail || ''}
                                            onChange={e => setSettings({ ...settings, orgEmail: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="admin@sekolah.sch.id"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                            <Phone size={14} className="text-slate-400" /> No. Telepon
                                        </label>
                                        <input
                                            type="text"
                                            value={settings.orgPhone || ''}
                                            onChange={e => setSettings({ ...settings, orgPhone: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="021-xxxxxxx"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        <MapPin size={14} className="text-slate-400" /> Alamat Lengkap
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={settings.orgAddress || ''}
                                        onChange={e => setSettings({ ...settings, orgAddress: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Masukkan alamat lengkap instansi..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Penanggung Jawab Section */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-50 text-blue-600">
                                <UserCheck size={20} />
                                <h2 className="font-semibold uppercase tracking-wider text-xs">Penanggung Jawab (Top Management)</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        value={settings.orgHeadName || ''}
                                        onChange={e => setSettings({ ...settings, orgHeadName: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Nama Kepala Sekolah / Pimpinan"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">NIP / NIY</label>
                                    <input
                                        type="text"
                                        value={settings.orgHeadNip || ''}
                                        onChange={e => setSettings({ ...settings, orgHeadNip: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Masukkan nomor identitas..."
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400">Data ini akan muncul pada kolom tanda tangan di laporan aset.</p>
                        </div>
                    </div>

                    {/* Right Column: System Config */}
                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-xl shadow-lg p-6 text-white space-y-6">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-700 text-blue-400">
                                <ShieldCheck size={20} />
                                <h2 className="font-semibold uppercase tracking-wider text-xs">Konfigurasi Sistem</h2>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">Prefix Kode Aset</label>
                                <input
                                    type="text"
                                    value={settings.assetCodePrefix}
                                    onChange={e => setSettings({ ...settings, assetCodePrefix: e.target.value.toUpperCase() })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                    maxLength={5}
                                />
                                <p className="text-[10px] text-slate-500 mt-2">Default: AST. Perubahan akan berlaku untuk aset baru.</p>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/40 disabled:opacity-50"
                                >
                                    <Save size={18} />
                                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                            <div className="flex items-center gap-2 mb-4 text-slate-800">
                                <Globe size={18} className="text-blue-500" />
                                <h3 className="font-semibold text-sm">Versi Aplikasi</h3>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Versi Build</span>
                                <span className="font-mono text-blue-600 font-bold">v1.2.6-Stable</span>
                            </div>
                        </div>
                    </div>
                </form>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                        <div>
                            <h2 className="font-bold text-slate-800">Daftar Pengguna</h2>
                            <p className="text-slate-500 text-xs">Kelola akses staf dan otorisasi sistem</p>
                        </div>
                        <button
                            onClick={() => setShowUserModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all"
                        >
                            + Tambah Pengguna
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-6 py-4">User / NIP</th>
                                    <th className="px-6 py-4">Hak Akses</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{user.username}</div>
                                                    <div className="text-[10px] text-slate-400">NIP: {user.nip || '-'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-600' :
                                                user.role === 'ADMIN_ASET' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">{user.email || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                disabled={user.id === currentUser.id}
                                                className="text-red-500 hover:text-red-700 text-xs font-semibold disabled:opacity-30"
                                            >
                                                Hapus
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Tambah User */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <h2 className="font-bold text-slate-800">Tambah Pengguna Baru</h2>
                            <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NIP</label>
                                    <input
                                        type="text"
                                        value={newUser.nip}
                                        onChange={e => setNewUser({ ...newUser, nip: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                                    <select
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                                        <option value="ADMIN_ASET">ADMIN_ASET</option>
                                        <option value="USER">USER</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowUserModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                                >
                                    Tambah User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
