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
    const [unitList, setUnitList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || {});

    // Add User Modal State
    const [showUserModal, setShowUserModal] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        name: '', // Add name
        password: '',
        email: '',
        nip: '',
        role: 'USER',
        unitId: ''
    });

    // Change Password State
    const [passwords, setPasswords] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) {
            alert('Konfirmasi password baru tidak sesuai!');
            return;
        }
        try {
            setSaving(true);
            await api.put('/auth/change-password', {
                oldPassword: passwords.oldPassword,
                newPassword: passwords.newPassword
            });
            alert('Password berhasil diubah!');
            setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal mengubah password');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        if (['SUPER_ADMIN', 'BIDANG_IT'].includes(currentUser.role)) {
            fetchUsers();
            fetchUnits();
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

    const fetchUnits = async () => {
        try {
            const res = await api.get('/master/units');
            setUnitList(res.data);
        } catch (error) {
            console.error("Fetch units error:", error);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (error) {
            console.error("Fetch users error:", error);
            if (error.response?.status !== 401 && error.response?.status !== 403) {
                alert("Gagal memuat data pengguna.");
            }
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

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            if (newUser.id) {
                // UPDATE logic
                await api.put(`/users/${newUser.id}`, newUser);
                alert('User berhasil diperbarui!');
            } else {
                // CREATE logic
                await api.post('/users', newUser);
                alert('User berhasil ditambahkan!');
            }
            setShowUserModal(false);
            setNewUser({ username: '', name: '', password: '', email: '', nip: '', phone: '', position: '', role: 'USER', unitId: '' });
            fetchUsers();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan user');
        }
    };

    const handleEditUser = (user) => {
        setNewUser({
            id: user.id,
            username: user.username,
            name: user.name || '', // Add name
            password: '',
            email: user.email || '',
            nip: user.nip || '',
            phone: user.phone || '',
            position: user.position || '',
            role: user.role,
            unitId: user.unitId || ''
        });
        setShowUserModal(true);
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

    const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(currentUser.role);

    if (loading) return <div className="p-8 text-center text-slate-500">Memuat pengaturan...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pengaturan</h1>
                    <p className="text-slate-500 text-sm">Kelola identitas instansi dan hak akses pengguna</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg ml-auto">
                    {isSuperAdmin && (
                        <>
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'profile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <div className="flex items-center gap-2 uppercase tracking-tight">
                                    <Building2 size={16} /> Profil
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <div className="flex items-center gap-2 uppercase tracking-tight">
                                    <UserCheck size={16} /> Users
                                </div>
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'security' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <div className="flex items-center gap-2 uppercase tracking-tight">
                            <ShieldCheck size={16} /> Keamanan
                        </div>
                    </button>
                </div>
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
                            onClick={() => {
                                setNewUser({ username: '', password: '', email: '', nip: '', phone: '', position: '', role: 'USER', unitId: '' });
                                setShowUserModal(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all"
                        >
                            + Tambah Pengguna
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-6 py-4">NIY / Username</th>
                                    <th className="px-6 py-4">Nama Lengkap</th>
                                    <th className="px-6 py-4">Unit Kerja</th>
                                    <th className="px-6 py-4">Hak Akses</th>
                                    <th className="px-6 py-4">Kontak</th>
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
                                                    <div className="font-bold text-slate-800 font-mono">{user.username}</div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {user.nip ? `NIP (NIY): ${user.nip}` : 'NIY Login'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-slate-800">{user.name || '-'}</div>
                                            <div className="text-[10px] text-slate-500">{user.position || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-semibold text-slate-700">{user.unit?.name || 'GLOBAL / SEMUA UNIT'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${['SUPER_ADMIN', 'BIDANG_IT'].includes(user.role) ? 'bg-purple-100 text-purple-600' :
                                                user.role === 'ADMIN_ASET' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            <div className="flex flex-col">
                                                <span>{user.email || '-'}</span>
                                                {user.phone && <span className="text-[10px] text-slate-400">📞 {user.phone}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button
                                                onClick={() => handleEditUser(user)}
                                                className="text-blue-500 hover:text-blue-700 text-xs font-bold"
                                            >
                                                Edit
                                            </button>
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

            {activeTab === 'security' && (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-50">
                            <h2 className="font-bold text-slate-800">Keamanan Akun</h2>
                            <p className="text-slate-500 text-xs">Ganti password akun Anda secara berkala untuk keamanan.</p>
                        </div>
                        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password Lama</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.oldPassword}
                                    onChange={e => setPasswords({ ...passwords, oldPassword: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.newPassword}
                                    onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password Baru</label>
                                <input
                                    type="password"
                                    required
                                    value={passwords.confirmPassword}
                                    onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Menyimpan...' : 'Ganti Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Tambah/Edit User */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <h2 className="font-bold text-slate-800">{newUser.id ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</h2>
                            <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NIY (Login User)</label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.username}
                                        onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                        placeholder="Gunakan NIY"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">*Digunakan untuk Log In & NIP secara otomatis</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        value={newUser.name || ''}
                                        onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                                        placeholder="Nama Sesuai KTP"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email <span className="font-normal text-slate-400 normal-case">(Opsional)</span></label>
                                <input
                                    type="email"
                                    value={newUser.email || ''}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                                <input
                                    type="password"
                                    required={!newUser.id}
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder={newUser.id ? "Kosongkan jika tidak ubah password" : "********"}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">No. HP / Telepon</label>
                                    <input
                                        type="text"
                                        value={newUser.phone || ''}
                                        onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0812xxxx (Untuk WA)"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Jabatan & Hak Akses</label>
                                <select
                                    value={newUser.position || ''}
                                    onChange={e => {
                                        const pos = [
                                            { label: 'Ketua Yayasan', role: 'SUPER_ADMIN', scope: 'GLOBAL' },
                                            { label: 'Sekretaris Yayasan', role: 'SUPER_ADMIN', scope: 'GLOBAL' },
                                            { label: 'Bendahara Yayasan', role: 'SUPER_ADMIN', scope: 'GLOBAL' },
                                            { label: 'Kepala Bidang Sarana dan Prasarana', role: 'SUPER_ADMIN', scope: 'GLOBAL' },
                                            { label: 'Staff Bidang IT', role: 'BIDANG_IT', scope: 'GLOBAL' },
                                            { label: 'Kepala Bidang (Non-super)', role: 'KEPALA_BIDANG', scope: 'GLOBAL' },
                                            { label: 'Staf Bidang Sarana dan Prasarana', role: 'ADMIN_ASET', scope: 'GLOBAL' },
                                            { label: 'Kepala Unit', role: 'ADMIN_UNIT', scope: 'UNIT' },
                                            { label: 'Bendahara Unit', role: 'ADMIN_UNIT', scope: 'UNIT' },
                                            { label: 'Sarpras Unit', role: 'USER', scope: 'UNIT' }
                                        ].find(p => p.label === e.target.value);

                                        if (pos) {
                                            setNewUser({
                                                ...newUser,
                                                position: pos.label,
                                                role: pos.role,
                                                unitId: pos.scope === 'GLOBAL' ? '' : newUser.unitId
                                            });
                                        } else {
                                            setNewUser({ ...newUser, position: e.target.value });
                                        }
                                    }}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700"
                                >
                                    <option value="">-- PILIH JABATAN --</option>
                                    <optgroup label="Pengurus Yayasan (Global Access)">
                                        <option value="Ketua Yayasan">Ketua Yayasan</option>
                                        <option value="Sekretaris Yayasan">Sekretaris Yayasan</option>
                                        <option value="Bendahara Yayasan">Bendahara Yayasan</option>
                                    </optgroup>
                                    <optgroup label="Bidang Sarana Prasarana & IT (Global Access)">
                                        <option value="Kepala Bidang Sarana dan Prasarana">Kepala Bidang Sarana dan Prasarana</option>
                                        <option value="Staff Bidang IT">Staff Bidang IT</option>
                                        <option value="Kepala Bidang (Non-super)">Kepala Bidang (Non-super)</option>
                                        <option value="Staf Bidang Sarana dan Prasarana">Staf Bidang Sarana dan Prasarana</option>
                                    </optgroup>
                                    <optgroup label="Unit Sekolah / Lembaga (Unit Access)">
                                        <option value="Kepala Unit">Kepala Unit</option>
                                        <option value="Bendahara Unit">Bendahara Unit</option>
                                        <option value="Sarpras Unit">Sarpras Unit</option>
                                    </optgroup>
                                </select>
                                <div className="mt-1 text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                                    Role System: <span className="font-bold text-blue-600">{newUser.role || '-'}</span>
                                    {newUser.role && (
                                        <span className="ml-1 text-slate-400">
                                            ({['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(newUser.role) ? 'Akses Global' : 'Akses Terbatas Unit'})
                                        </span>
                                    )}
                                </div>
                            </div>

                            {['ADMIN_UNIT', 'USER'].includes(newUser.role) && (
                                <div className="animate-in slide-in-from-top-2 fade-in">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit Kerja Assignment</label>
                                    <select
                                        value={newUser.unitId}
                                        required={['ADMIN_UNIT', 'USER'].includes(newUser.role)}
                                        onChange={e => setNewUser({ ...newUser, unitId: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30"
                                    >
                                        <option value="">-- PILIH UNIT KERJA --</option>
                                        {unitList.map(unit => (
                                            <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1 italic">*Wajib diisi untuk Staff Unit agar data terfilter sesuai unitnya.</p>
                                </div>
                            )}
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
                                    {newUser.id ? 'Simpan Perubahan' : 'Tambah User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )}
        </div >
    );
};

export default Settings;
