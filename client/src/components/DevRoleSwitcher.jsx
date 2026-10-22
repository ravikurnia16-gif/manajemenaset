import React, { useState, useEffect } from 'react';
import { 
    Zap, UserCheck, Shield, ChevronUp, ChevronDown, 
    X, Check, RefreshCw, Users, Wrench, Package, 
    Building, Sparkles 
} from 'lucide-react';
import api from '../lib/axios';

const ROLE_PRESETS = [
    {
        key: 'KABID',
        label: 'Kabid Sarana',
        fullName: 'Kepala Bidang Sarana',
        role: 'KABID_SARPRAS',
        position: 'Kepala Bidang Sarana',
        defaultName: 'Ravi Kurnia (Kabid Sarana)',
        icon: '👑',
        badgeColor: 'bg-violet-100 text-violet-800 border-violet-200',
        activeRing: 'ring-violet-500 border-violet-400 bg-violet-50',
        desc: 'Approval, Rencana Kerja, Penugasan & Review PPP'
    },
    {
        key: 'TEKNISI',
        label: 'Staff Teknisi',
        fullName: 'Staff Teknisi Lapangan',
        role: 'USER',
        position: 'Staff Teknisi',
        defaultName: 'Staff Teknisi Lapangan',
        icon: '🛠️',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        activeRing: 'ring-amber-500 border-amber-400 bg-amber-50',
        desc: 'Laporan Harian (PPP), Service AC & Listrik, SPK'
    },
    {
        key: 'ADMIN_ASET',
        label: 'Admin Aset',
        fullName: 'Staff Manajemen Aset',
        role: 'ADMIN_ASET',
        position: 'Staff Manajemen Aset',
        defaultName: 'Admin Sarana & Aset',
        icon: '📦',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
        activeRing: 'ring-blue-500 border-blue-400 bg-blue-50',
        desc: 'Inventaris Aset, Mutasi, Penghapusan & Logistik'
    },
    {
        key: 'SUPER_ADMIN',
        label: 'Super Admin',
        fullName: 'Super Administrator',
        role: 'SUPER_ADMIN',
        position: 'Kepala Bidang IT',
        defaultName: 'Super Administrator (IT)',
        icon: '⚡',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
        activeRing: 'ring-rose-500 border-rose-400 bg-rose-50',
        desc: 'Akses Penuh Semua Modul, User & Pengaturan'
    },
    {
        key: 'ADMIN_UNIT',
        label: 'Admin Unit',
        fullName: 'Tata Usaha Unit (Sekolah)',
        role: 'ADMIN_UNIT',
        position: 'Tata Usaha Unit',
        defaultName: 'Admin Unit Sekolah',
        icon: '🏫',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        activeRing: 'ring-emerald-500 border-emerald-400 bg-emerald-50',
        desc: 'Pengadaan Unit, Pinjam Aset, Permohonan Servis'
    },
    {
        key: 'GUDANG',
        label: 'Staff Gudang',
        fullName: 'Staff Gudang & Logistik',
        role: 'USER',
        position: 'Staff Gudang dan Logistik',
        defaultName: 'Staff Gudang & Seragam',
        icon: '🏪',
        badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        activeRing: 'ring-cyan-500 border-cyan-400 bg-cyan-50',
        desc: 'Stok Barang, Seragam, Penerimaan Barang'
    }
];

export const isDevEnvironment = () => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.endsWith('.local') ||
        import.meta.env.DEV
    );
};

const DevRoleSwitcher = () => {
    const isLocal = isDevEnvironment();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [dbUsers, setDbUsers] = useState([]);
    const [selectedTab, setSelectedTab] = useState('PRESETS'); // 'PRESETS' | 'DB_USERS'

    // Baca user aktif saat ini
    const currentUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    useEffect(() => {
        if (isLocal) {
            api.get('/auth/dev-roles')
                .then(res => {
                    if (res.data?.success && Array.isArray(res.data.allUsers)) {
                        setDbUsers(res.data.allUsers);
                    }
                })
                .catch(() => {
                    // Silently ignore if server doesn't respond
                });
        }
    }, [isLocal]);

    if (!isLocal) {
        return null;
    }

    const handleSwitchRole = async (target) => {
        setSwitching(true);
        try {
            const payload = {
                userId: target.matchedUser?.id || target.id || null,
                role: target.role,
                position: target.position,
                name: target.name || target.defaultName || target.fullName,
                username: target.username || null
            };

            const response = await api.post('/auth/dev-login', payload);
            if (response.data?.token && response.data?.user) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            } else {
                // Client-side fallback jika backend dev-login tidak merespon
                const fallbackUser = {
                    id: target.id || 999,
                    name: target.name || target.defaultName,
                    role: target.role,
                    position: target.position,
                    username: (target.key || target.role).toLowerCase(),
                    unitId: 1
                };
                localStorage.setItem('user', JSON.stringify(fallbackUser));
            }

            setIsOpen(false);
            // Refresh halaman agar sidebar, context, dan route langsung ter-update dengan permission role baru
            window.location.reload();
        } catch (err) {
            console.warn('Gagal beralih role via dev-login, menerapkan fallback lokal:', err);
            const fallbackUser = {
                id: target.id || 999,
                name: target.name || target.defaultName || target.label,
                role: target.role,
                position: target.position,
                username: (target.key || target.role || 'dev').toLowerCase(),
                unitId: 1
            };
            localStorage.setItem('user', JSON.stringify(fallbackUser));
            window.location.reload();
        } finally {
            setSwitching(false);
        }
    };

    // Deteksi role aktif yang cocok dengan preset
    const activePreset = ROLE_PRESETS.find(p => {
        if (p.key === 'KABID') {
            return currentUser.role === 'KABID_SARPRAS' || (currentUser.position || '').toLowerCase().includes('kepala bidang sarana');
        }
        if (p.key === 'TEKNISI') {
            return (currentUser.position || '').toLowerCase().includes('teknisi');
        }
        if (p.key === 'ADMIN_ASET') {
            return currentUser.role === 'ADMIN_ASET' || (currentUser.position || '').toLowerCase().includes('manajemen aset');
        }
        if (p.key === 'SUPER_ADMIN') {
            return currentUser.role === 'SUPER_ADMIN';
        }
        if (p.key === 'ADMIN_UNIT') {
            return currentUser.role === 'ADMIN_UNIT';
        }
        if (p.key === 'GUDANG') {
            return (currentUser.position || '').toLowerCase().includes('gudang');
        }
        return false;
    });

    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-4 left-4 z-50 p-2.5 rounded-full bg-slate-900 text-amber-400 border border-amber-500/50 shadow-xl hover:scale-110 transition-all cursor-pointer flex items-center justify-center group"
                title="Buka Localhost Dev Role Switcher"
            >
                <Zap size={18} className="animate-pulse" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-[10px] font-black text-amber-300 ml-0 group-hover:ml-1.5">
                    Dev Role Switcher
                </span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 z-50 font-sans">
            {/* Popover Menu Saat Terbuka */}
            {isOpen && (
                <div className="mb-2 w-84 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
                    {/* Header */}
                    <div className="p-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-xs">
                                ⚡
                            </div>
                            <div>
                                <h4 className="text-xs font-black tracking-wider uppercase text-amber-300">
                                    Localhost Role Switcher
                                </h4>
                                <p className="text-[10px] text-slate-300">
                                    Beralih akun/role instan tanpa logout
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsMinimized(true)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer text-[10px]"
                                title="Sembunyikan ke Tombol Kecil"
                            >
                                Minimize
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Info User Saat Ini */}
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Aktif Saat Ini:</span>
                        <span className="font-extrabold text-slate-800 truncate max-w-[180px] flex items-center gap-1">
                            <span>{activePreset?.icon || '👤'}</span>
                            <span className="truncate">{currentUser?.name || currentUser?.role || 'Guest'}</span>
                        </span>
                    </div>

                    {/* Tab Selector */}
                    {dbUsers.length > 0 && (
                        <div className="grid grid-cols-2 p-1.5 bg-slate-100/70 border-b border-slate-200 text-xs">
                            <button
                                type="button"
                                onClick={() => setSelectedTab('PRESETS')}
                                className={`py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                                    selectedTab === 'PRESETS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                🎯 6 Role Standar
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTab('DB_USERS')}
                                className={`py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                                    selectedTab === 'DB_USERS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                👥 Database User ({dbUsers.length})
                            </button>
                        </div>
                    )}

                    {/* Content List */}
                    <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                        {selectedTab === 'PRESETS' ? (
                            ROLE_PRESETS.map((preset) => {
                                const isActive = activePreset?.key === preset.key;
                                return (
                                    <button
                                        key={preset.key}
                                        type="button"
                                        disabled={switching}
                                        onClick={() => handleSwitchRole(preset)}
                                        className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                                            isActive
                                                ? preset.activeRing + ' shadow-2xs'
                                                : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="text-lg shrink-0">{preset.icon}</span>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-black text-slate-900 truncate">
                                                        {preset.label}
                                                    </span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${preset.badgeColor}`}>
                                                        {preset.role}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                                    {preset.desc}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {isActive ? (
                                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                                                    ✓
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-700">
                                                    Pilih →
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            dbUsers.map((u) => {
                                const isUserActive = currentUser?.id === u.id;
                                return (
                                    <button
                                        key={u.id}
                                        type="button"
                                        disabled={switching}
                                        onClick={() => handleSwitchRole(u)}
                                        className={`w-full p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                            isUserActive
                                                ? 'bg-violet-50 border-violet-400 text-violet-950 font-bold'
                                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-bold truncate">
                                                    {u.name || u.username}
                                                </span>
                                                <span className="text-[9px] font-bold px-1 rounded bg-slate-100 text-slate-600">
                                                    {u.role}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 truncate">
                                                {u.position || 'Staff'} • {u.unit?.name || 'Unit -'}
                                            </p>
                                        </div>
                                        {isUserActive && (
                                            <span className="w-4 h-4 rounded-full bg-violet-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                                                ✓
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer Tips */}
                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center font-medium">
                        💡 Hanya tampil di <code className="font-mono text-slate-600 font-bold">localhost / dev</code>. Tidak akan muncul di server production.
                    </div>
                </div>
            )}

            {/* Floating Trigger Pill */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-900 text-white px-3 py-1.5 rounded-full border border-amber-400/50 shadow-xl backdrop-blur-md transition-all cursor-pointer">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 text-xs font-bold cursor-pointer"
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-amber-400 font-black tracking-wider flex items-center gap-1">
                        <Zap size={13} className="fill-amber-400" /> DEV ROLE:
                    </span>
                    <span className="text-white font-extrabold max-w-[140px] truncate">
                        {activePreset ? `${activePreset.icon} ${activePreset.label}` : (currentUser?.name || 'Pilih Role')}
                    </span>
                    {isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
                </button>

                <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    className="text-slate-400 hover:text-white p-0.5 rounded transition-colors ml-1 cursor-pointer"
                    title="Kecilkan icon"
                >
                    <X size={12} />
                </button>
            </div>
        </div>
    );
};

export default DevRoleSwitcher;
