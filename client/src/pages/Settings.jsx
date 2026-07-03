import { useState, useEffect, Fragment } from 'react';
import { Save, Building2, UserCheck, ShieldCheck, Globe, Mail, MapPin, Phone, Eye, EyeOff, Wrench, Smartphone } from 'lucide-react';
import api from '../lib/axios';

const Settings = () => {
    const [activeTab, setActiveTab] = useState('myProfile'); // Default to my profile
    const [settings, setSettings] = useState({
        orgName: '',
        orgAddress: '',
        orgPhone: '',
        orgEmail: '',
        orgLogo: '',
        orgHeadName: '',
        orgHeadNip: '',
        assetCodePrefix: 'AST',
        surveyEnabled: false
    });
    const [myProfile, setMyProfile] = useState({
        name: '',
        email: '',
        phone: '',
        username: '',
        position: '',
        unitName: ''
    });
    const [users, setUsers] = useState([]);
    const [unitList, setUnitList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || {});

    // WhatsApp State
    const [waStatus, setWaStatus] = useState({ status: 'LOADING', qr: null });
    const [loadingWa, setLoadingWa] = useState(false);

    // Filter states for Users Tab
    const [userSearch, setUserSearch] = useState('');
    const [userUnitFilter, setUserUnitFilter] = useState('');

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

    const [showPassword, setShowPassword] = useState(false);

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
        fetchMyProfile();
        if (['SUPER_ADMIN', 'BIDANG_IT', 'KABID_SARPRAS'].includes(currentUser.role)) {
            fetchUsers();
            fetchUnits();
        }
    }, []);

    const fetchMyProfile = async () => {
        try {
            const res = await api.get('/users/profile');
            setMyProfile({
                ...res.data,
                unitName: res.data.unit?.name || 'GLOBAL'
            });
        } catch (error) {
            console.error("Fetch profile error:", error);
        }
    };

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

    const fetchWaStatus = async () => {
        try {
            setLoadingWa(true);
            const res = await api.get('/whatsapp/status');
            setWaStatus(res.data);
        } catch (error) {
            console.error("Fetch WA status error:", error);
        } finally {
            setLoadingWa(false);
        }
    };

    const handleWaInit = async () => {
        try {
            setLoadingWa(true);
            await api.post('/whatsapp/init');
            setTimeout(fetchWaStatus, 3000);
        } catch (error) {
            alert('Gagal menginisialisasi ulang WA.');
            setLoadingWa(false);
        }
    };

    const handleWaLogout = async () => {
        if (!window.confirm('Yakin ingin memutuskan koneksi perangkat WhatsApp ini?')) return;
        try {
            setLoadingWa(true);
            await api.post('/whatsapp/logout');
            setTimeout(fetchWaStatus, 3000);
        } catch (error) {
            alert('Gagal memutuskan koneksi WA.');
            setLoadingWa(false);
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
            alert('Pengaturan instansi berhasil disimpan!');
        } catch (error) {
            console.error("Save settings error:", error);
            alert('Gagal menyimpan pengaturan instansi.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveMyProfile = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const res = await api.put('/users/profile', {
                name: myProfile.name,
                email: myProfile.email,
                phone: myProfile.phone
            });
            alert('Profil berhasil diperbarui!');

            // Reload to sync with Layout and other components immediately
            window.location.reload();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan profil.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            if (newUser.id) {
                // UPDATE logic
                const res = await api.put(`/users/${newUser.id}`, newUser);
                alert('User berhasil diperbarui!');

                // If the updated user is the current user, sync localStorage and reload
                if (newUser.id === currentUser.id) {
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                    window.location.reload();
                    return;
                }
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
        setShowPassword(false);
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

    const isSuperAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'KABID_SARPRAS'].includes(currentUser.role);
    const isKabidSarpras = currentUser?.position === 'Kepala Bidang Sarana';

    const handleFixGenders = async () => {
        if (!window.confirm('Bersihkan data gender "Akhowat/Ikhwan" menjadi "P/L"? Proses ini tidak bisa dibatalkan.')) return;
        setSaving(true);
        try {
            const res = await api.get('/warehouse/maintenance/fix-gender');
            alert(res.data.message);
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menjalankan pembersihan data.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Memuat pengaturan...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pengaturan</h1>
                    <p className="text-slate-500 text-sm">Kelola identitas instansi dan hak akses pengguna</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg ml-auto overflow-x-auto whitespace-nowrap">
                    <button
                        onClick={() => setActiveTab('myProfile')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'myProfile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <div className="flex items-center gap-2 uppercase tracking-tight">
                            <UserCheck size={16} /> Profil Saya
                        </div>
                    </button>
                    {isSuperAdmin && (
                        <>
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'profile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <div className="flex items-center gap-2 uppercase tracking-tight">
                                    <Building2 size={16} /> Instansi
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
                    {isKabidSarpras && (
                        <button
                            onClick={() => { setActiveTab('whatsapp'); fetchWaStatus(); }}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'whatsapp' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2 uppercase tracking-tight">
                                <Smartphone size={16} /> WhatsApp
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'myProfile' && (
                <form onSubmit={handleSaveMyProfile} className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-50 text-blue-600">
                                <UserCheck size={20} />
                                <h2 className="font-semibold uppercase tracking-wider text-xs">Informasi Pribadi</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Username / NIY</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={myProfile.username}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-500 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        value={myProfile.name || ''}
                                        onChange={e => setMyProfile({ ...myProfile, name: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Nama Lengkap"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        <Mail size={14} className="text-slate-400" /> Email
                                    </label>
                                    <input
                                        type="email"
                                        value={myProfile.email || ''}
                                        onChange={e => setMyProfile({ ...myProfile, email: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="email@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        <Phone size={14} className="text-slate-400" /> No. HP (WhatsApp)
                                    </label>
                                    <input
                                        type="text"
                                        value={myProfile.phone || ''}
                                        onChange={e => setMyProfile({ ...myProfile, phone: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0812xxxxxx"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-50 text-blue-600">
                                <ShieldCheck size={20} />
                                <h2 className="font-semibold uppercase tracking-wider text-xs">Penempatan & Jabatan</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Unit Kerja</label>
                                    <div className="text-sm font-semibold text-slate-700">{myProfile.unitName}</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Jabatan</label>
                                    <div className="text-sm font-semibold text-slate-700">{myProfile.position || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Hak Akses</label>
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">{myProfile.role}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                <Save size={18} />
                                {saving ? 'Menyimpan...' : 'Update Profil'}
                            </button>
                            <p className="text-[10px] text-slate-400 mt-4 text-center italic">
                                *Jabatan dan Unit hanya bisa diubah oleh Super Admin.
                            </p>
                        </div>
                    </div>
                </form>
            )}

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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">NIY</label>
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

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">Aktivasi Halaman Survey</label>
                                <label className="flex items-center cursor-pointer gap-3 relative">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={settings.surveyEnabled || false}
                                            onChange={e => setSettings({ ...settings, surveyEnabled: e.target.checked })}
                                        />
                                        <div className={`block w-10 h-6 rounded-full transition-colors ${settings.surveyEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.surveyEnabled ? 'transform translate-x-4' : ''}`}></div>
                                    </div>
                                    <span className="text-sm font-medium text-slate-300">
                                        {settings.surveyEnabled ? 'Survey Aktif (Publik & User)' : 'Survey Dinonaktifkan'}
                                    </span>
                                </label>
                                <p className="text-[10px] text-slate-500 mt-2">Jika diaktifkan, menu pengisian survey akan muncul dan bisa diakses publik.</p>
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

                        {isSuperAdmin && (
                            <div className="bg-orange-50 rounded-xl border border-orange-100 p-6 space-y-4">
                                <div className="flex items-center gap-2 text-orange-700">
                                    <Wrench size={18} />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">Pemeliharaan Data</h3>
                                </div>
                                <p className="text-[10px] text-orange-600 leading-relaxed italic">
                                    Gunakan tombol di bawah untuk merapikan data gender gudang yang tidak seragam (Akhowat → P, Ikhwan → L).
                                </p>
                                <button
                                    type="button"
                                    onClick={handleFixGenders}
                                    disabled={saving}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 rounded-lg transition-all shadow-md shadow-orange-200 disabled:opacity-50"
                                >
                                    {saving ? 'Memproses...' : 'BERSIHKAN DATA GENDER'}
                                </button>
                            </div>
                        )}
                    </div>
                </form>
            ) : null}

            {activeTab === 'users' && isSuperAdmin && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="font-bold text-slate-800">Daftar Pengguna</h2>
                            <p className="text-slate-500 text-xs">Kelola akses staf dan otorisasi sistem</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <input
                                type="text"
                                placeholder="Cari nama, NIY, username..."
                                className="w-full sm:w-64 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                            />
                            <select
                                className="w-full sm:w-48 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                value={userUnitFilter}
                                onChange={e => setUserUnitFilter(e.target.value)}
                            >
                                <option value="">Semua Unit</option>
                                <option value="GLOBAL / SEMUA UNIT">GLOBAL / SEMUA UNIT</option>
                                {unitList.map(u => (
                                    <option key={u.id} value={u.name}>{u.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => {
                                    setNewUser({ username: '', name: '', password: '', email: '', nip: '', phone: '', position: '', role: 'USER', unitId: '' });
                                    setShowPassword(false);
                                    setShowUserModal(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                            >
                                + Tambah Pengguna
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold sticky top-0 z-10 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4">NIY / Username</th>
                                    <th className="px-6 py-4">Nama Lengkap</th>
                                    <th className="px-6 py-4">Hak Akses</th>
                                    <th className="px-6 py-4">Kontak</th>
                                    <th className="px-6 py-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {Object.entries(
                                    users
                                        .filter(user => {
                                            const searchLower = userSearch.toLowerCase();
                                            const matchesSearch = !userSearch ||
                                                (user.name?.toLowerCase() || '').includes(searchLower) ||
                                                (user.username?.toLowerCase() || '').includes(searchLower) ||
                                                (user.nip?.toLowerCase() || '').includes(searchLower);

                                            const unitName = user.unit?.name || 'GLOBAL / SEMUA UNIT';
                                            const matchesUnit = !userUnitFilter || unitName === userUnitFilter;

                                            return matchesSearch && matchesUnit;
                                        })
                                        .reduce((acc, user) => {
                                            const unitName = user.unit?.name || 'GLOBAL / SEMUA UNIT';
                                            if (!acc[unitName]) acc[unitName] = [];
                                            acc[unitName].push(user);
                                            return acc;
                                        }, {})
                                ).map(([unit, unitUsers]) => (
                                    <Fragment key={unit}>
                                        <tr className="bg-slate-50/80">
                                            <td colSpan={5} className="px-6 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <Building2 size={14} className="text-blue-500" />
                                                    <span className="text-[11px] font-extrabold text-blue-800 uppercase tracking-wider">{unit}</span>
                                                    <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold">{unitUsers.length} Users</span>
                                                </div>
                                            </td>
                                        </tr>
                                        {unitUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs ring-2 ring-white group-hover:scale-110 transition-transform">
                                                            {user.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800 font-mono tracking-tighter">{user.username}</div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {user.nip ? `NIY: ${user.nip}` : 'NIY Login'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-semibold text-slate-800 uppercase tracking-tight">{user.name || '-'}</div>
                                                    <div className="text-[10px] text-slate-500 italic">{user.position || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${['SUPER_ADMIN', 'BIDANG_IT', 'KABID_SARPRAS'].includes(user.role) ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                        user.role === 'ADMIN_ASET' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            user.role === 'AUDITOR' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                'bg-slate-50 text-slate-600 border-slate-100'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-medium">{user.email || '-'}</span>
                                                        {user.phone && <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                            <Phone size={10} /> {user.phone}
                                                        </span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <button
                                                        onClick={() => handleEditUser(user)}
                                                        className="text-blue-600 hover:text-blue-800 text-[10px] font-bold hover:underline"
                                                    >
                                                        EDIT
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        disabled={user.id === currentUser.id}
                                                        className="text-red-500 hover:text-red-700 text-[10px] font-bold disabled:opacity-30"
                                                    >
                                                        HAPUS
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </Fragment>
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
            )
            }

            {/* Modal Tambah/Edit User */}
            {
                showUserModal && (
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
                                            autoComplete="off"
                                            value={newUser.username}
                                            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                            placeholder="Gunakan NIY"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">*Digunakan untuk Log In & NIY secara otomatis</p>
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
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required={!newUser.id}
                                            autoComplete="new-password"
                                            value={newUser.password}
                                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg pl-4 pr-10 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder={newUser.id ? "Kosongkan jika tidak ubah password" : "********"}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
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
                                                { label: 'Auditor', role: 'AUDITOR', scope: 'GLOBAL' },

                                                // BIDANG SARANA & PRASARANA
                                                { label: 'Kepala Bidang Sarana', role: 'SUPER_ADMIN', scope: 'GLOBAL' },
                                                { label: 'Staff Keuangan dan Administrasi', role: 'ADMIN_ASET', scope: 'GLOBAL' },
                                                { label: 'Staff Manajemen Aset', role: 'ADMIN_ASET', scope: 'GLOBAL' },
                                                { label: 'Staff Teknisi Aset', role: 'ADMIN_ASET', scope: 'GLOBAL' },
                                                { label: 'Staff Gudang dan Logistik', role: 'ADMIN_ASET', scope: 'GLOBAL' },
                                                { label: 'Staff Kendaraan', role: 'ADMIN_ASET', scope: 'GLOBAL' },

                                                // BIDANG IT
                                                { label: 'Kepala Bidang IT', role: 'SUPER_ADMIN', scope: 'GLOBAL' },
                                                { label: 'Staff Programming', role: 'SUPER_ADMIN', scope: 'GLOBAL' },
                                                { label: 'Staff IT', role: 'ADMIN_ASET', scope: 'GLOBAL' },

                                                // BIDANG SDM
                                                { label: 'Kepala Bidang SDM', role: 'KEPALA_BIDANG', scope: 'GLOBAL' },
                                                { label: 'Staff SDM', role: 'USER', scope: 'UNIT' },

                                                // BIDANG KEUANGAN
                                                { label: 'Kepala Bidang Keuangan', role: 'KEPALA_BIDANG', scope: 'GLOBAL' },
                                                { label: 'Staff Keuangan', role: 'USER', scope: 'UNIT' },

                                                // BIDANG PEMBANGUNAN
                                                { label: 'Kepala Bidang Pembangunan', role: 'KEPALA_BIDANG', scope: 'GLOBAL' },
                                                { label: 'Staff Pembangunan', role: 'ADMIN_PBG', scope: 'GLOBAL' },

                                                // BIDANG K3
                                                { label: 'Kepala Bidang K3', role: 'KEPALA_BIDANG', scope: 'GLOBAL' },
                                                { label: 'Staff K3', role: 'USER', scope: 'UNIT' },

                                                // DIVISI PENDIDIKAN
                                                { label: 'Wakil Divisi Pendidikan', role: 'KEPALA_BIDANG', scope: 'GLOBAL' },
                                                { label: 'Staff Divisi Pendidikan', role: 'USER', scope: 'UNIT' },

                                                { label: 'Kepala Unit', role: 'ADMIN_UNIT', scope: 'UNIT' },
                                                { label: 'Sarpras Unit', role: 'ADMIN_UNIT', scope: 'UNIT' },
                                                { label: 'Bendahara Unit', role: 'USER', scope: 'UNIT' },
                                                { label: 'Staff Unit/divisi/bidang', role: 'USER', scope: 'UNIT' }
                                            ].find(p => p.label === e.target.value);

                                            if (pos) {
                                                // Auto-assign Kantor Yayasan unit for global roles
                                                let autoUnitId = newUser.unitId;
                                                if (pos.scope === 'GLOBAL') {
                                                    const yayasanUnit = unitList.find(u => u.name.toLowerCase().includes('yayasan'));
                                                    autoUnitId = yayasanUnit ? String(yayasanUnit.id) : '';
                                                }
                                                setNewUser({
                                                    ...newUser,
                                                    position: pos.label,
                                                    role: pos.role,
                                                    unitId: autoUnitId
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
                                            <option value="Auditor">Auditor (Yayasan)</option>
                                        </optgroup>
                                        <optgroup label="Kantor Yayasan">
                                            <option disabled className="bg-slate-100 font-bold text-slate-800">-- BIDANG SARPRAS & IT --</option>
                                            <option value="Kepala Bidang Sarana">Kepala Bidang Sarana (Super Admin)</option>
                                            <option value="Staff Keuangan dan Administrasi">Staff Keuangan & Adm (Admin Aset)</option>
                                            <option value="Staff Manajemen Aset">Staff Manajemen Aset (Admin Aset)</option>
                                            <option value="Staff Teknisi Aset">Staff Teknisi Aset (Admin Aset)</option>
                                            <option value="Staff Gudang dan Logistik">Staff Gudang dan Logistik (Admin Aset)</option>
                                            <option value="Staff Kendaraan">Staff Kendaraan (Admin Aset)</option>
                                            <option value="Kepala Bidang IT">Kepala Bidang IT (Super Admin)</option>
                                            <option value="Staff Programming">Staff Programming (Super Admin)</option>
                                            <option value="Staff IT">Staff IT (Admin Aset)</option>

                                            <option disabled className="bg-slate-100 font-bold text-slate-800">-- BIDANG SDM & KEUANGAN --</option>
                                            <option value="Kepala Bidang SDM">Kepala Bidang SDM (Global Terbatas)</option>
                                            <option value="Staff SDM">Staff SDM (User)</option>
                                            <option value="Kepala Bidang Keuangan">Kepala Bidang Keuangan (Global Terbatas)</option>
                                            <option value="Staff Keuangan">Staff Keuangan (User)</option>

                                            <option disabled className="bg-slate-100 font-bold text-slate-800">-- BIDANG PEMBANGUNAN & K3 --</option>
                                            <option value="Kepala Bidang Pembangunan">Kepala Bidang Pembangunan (Global Terbatas)</option>
                                            <option value="Staff Pembangunan">Staff Pembangunan (Admin Pbg)</option>
                                            <option value="Kepala Bidang K3">Kepala Bidang K3 (Global Terbatas)</option>
                                            <option value="Staff K3">Staff K3 (User)</option>

                                            <option disabled className="bg-slate-100 font-bold text-slate-800">-- DIVISI PENDIDIKAN --</option>
                                            <option value="Wakil Divisi Pendidikan">Wakil Divisi Pendidikan (Global Terbatas)</option>
                                            <option value="Staff Divisi Pendidikan">Staff Divisi Pendidikan (User)</option>
                                        </optgroup>
                                        <optgroup label="Unit / Divisi / Bidang (Unit Access)">
                                            <option value="Kepala Unit">Kepala Unit</option>
                                            <option value="Sarpras Unit">Sarpras Unit</option>
                                            <option value="Bendahara Unit">Bendahara Unit</option>
                                            <option value="Staff Unit/divisi/bidang">Staff Unit/divisi/bidang</option>
                                        </optgroup>
                                    </select>
                                    <div className="mt-1 text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                                        Role System: <span className="font-bold text-blue-600">{newUser.role || '-'}</span>
                                        {newUser.role && (
                                            <span className="ml-1 text-slate-400">
                                                ({['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'KABID_SARPRAS', 'ADMIN_PBG', 'AUDITOR'].includes(newUser.role) ? 'Akses Global' : 'Akses Terbatas Unit'})
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
                )
            }

            {activeTab === 'whatsapp' && isKabidSarpras && (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-50">
                            <h2 className="font-bold text-slate-800">Koneksi WhatsApp Lokal</h2>
                            <p className="text-slate-500 text-xs">Kelola perangkat WhatsApp yang terhubung langsung ke server (Jalur Utama).</p>
                        </div>
                        <div className="p-6 flex flex-col items-center justify-center space-y-6">
                            {loadingWa ? (
                                <div className="text-slate-500 animate-pulse">Memuat status...</div>
                            ) : (
                                <>
                                    <div className={`px-4 py-2 rounded-full text-sm font-bold border flex items-center gap-2
                                        ${waStatus.status === 'CONNECTED' ? 'bg-green-50 text-green-600 border-green-200' :
                                        waStatus.status === 'SCAN_QR' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                        waStatus.status === 'INITIALIZING' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                        'bg-red-50 text-red-600 border-red-200'}`}
                                    >
                                        <div className={`w-2.5 h-2.5 rounded-full ${waStatus.status === 'CONNECTED' ? 'bg-green-500' : waStatus.status === 'SCAN_QR' ? 'bg-amber-500 animate-pulse' : waStatus.status === 'INITIALIZING' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></div>
                                        Status: {waStatus.status === 'CONNECTED' ? 'Terhubung' : waStatus.status === 'SCAN_QR' ? 'Menunggu Scan QR' : waStatus.status === 'INITIALIZING' ? 'Sedang Memulai...' : 'Terputus'}
                                    </div>

                                    {waStatus.status === 'SCAN_QR' && waStatus.qr && (
                                        <div className="p-4 bg-white border-2 border-dashed border-slate-200 rounded-xl">
                                            <img src={waStatus.qr} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                                            <p className="text-center text-xs text-slate-500 mt-2">Buka WhatsApp di HP Anda, masuk ke Perangkat Tertaut, dan scan kode ini.</p>
                                        </div>
                                    )}

                                    <div className="flex gap-4 w-full max-w-sm mt-4">
                                        <button
                                            onClick={handleWaInit}
                                            disabled={loadingWa || waStatus.status === 'CONNECTED'}
                                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                                        >
                                            Muat Ulang QR
                                        </button>
                                        <button
                                            onClick={handleWaLogout}
                                            disabled={loadingWa || waStatus.status !== 'CONNECTED'}
                                            className="flex-1 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                                        >
                                            Putuskan (Logout)
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Settings;
