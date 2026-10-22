import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, User, LayoutDashboard, Zap, Loader2 } from 'lucide-react';
import api from '../lib/axios';
import { isDevEnvironment } from '../components/DevRoleSwitcher';

const DEV_PRESETS = [
    {
        key: 'KABID',
        label: 'Kabid Sarana',
        role: 'KABID_SARPRAS',
        position: 'Kepala Bidang Sarana',
        name: 'Ravi Kurnia (Kabid Sarana)',
        icon: '👑',
        border: 'border-violet-200 hover:border-violet-400 bg-violet-50/50 hover:bg-violet-50 text-violet-900'
    },
    {
        key: 'TEKNISI',
        label: 'Staff Teknisi',
        role: 'USER',
        position: 'Staff Teknisi',
        name: 'Staff Teknisi Lapangan',
        icon: '🛠️',
        border: 'border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 text-amber-900'
    },
    {
        key: 'ADMIN_ASET',
        label: 'Admin Aset',
        role: 'ADMIN_ASET',
        position: 'Staff Manajemen Aset',
        name: 'Admin Sarana & Aset',
        icon: '📦',
        border: 'border-blue-200 hover:border-blue-400 bg-blue-50/50 hover:bg-blue-50 text-blue-900'
    },
    {
        key: 'SUPER_ADMIN',
        label: 'Super Admin',
        role: 'SUPER_ADMIN',
        position: 'Kepala Bidang IT',
        name: 'Super Administrator',
        icon: '⚡',
        border: 'border-rose-200 hover:border-rose-400 bg-rose-50/50 hover:bg-rose-50 text-rose-900'
    },
    {
        key: 'ADMIN_UNIT',
        label: 'Admin Unit',
        role: 'ADMIN_UNIT',
        position: 'Tata Usaha Unit',
        name: 'Admin Unit Sekolah',
        icon: '🏫',
        border: 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900'
    },
    {
        key: 'GUDANG',
        label: 'Staff Gudang',
        role: 'USER',
        position: 'Staff Gudang dan Logistik',
        name: 'Staff Gudang & Seragam',
        icon: '🏪',
        border: 'border-cyan-200 hover:border-cyan-400 bg-cyan-50/50 hover:bg-cyan-50 text-cyan-900'
    }
];

const LoginPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectUrl = searchParams.get('redirect') || '/dashboard';
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [devLoadingKey, setDevLoadingKey] = useState(null);
    const [error, setError] = useState('');
    const isDev = isDevEnvironment();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleDevQuickLogin = async (preset) => {
        setDevLoadingKey(preset.key);
        setError('');
        try {
            const payload = {
                role: preset.role,
                position: preset.position,
                name: preset.name,
                username: preset.key.toLowerCase()
            };
            const response = await api.post('/auth/dev-login', payload);
            if (response.data?.token && response.data?.user) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
                localStorage.setItem('token', response.data.token);
            } else {
                const fallbackUser = {
                    id: 999,
                    name: preset.name,
                    role: preset.role,
                    position: preset.position,
                    username: preset.key.toLowerCase(),
                    unitId: 1
                };
                localStorage.setItem('user', JSON.stringify(fallbackUser));
                localStorage.setItem('token', 'dev-mock-token-' + Date.now());
            }
            navigate(redirectUrl);
        } catch (err) {
            console.warn('Dev login request failed, using client fallback:', err);
            const fallbackUser = {
                id: 999,
                name: preset.name,
                role: preset.role,
                position: preset.position,
                username: preset.key.toLowerCase(),
                unitId: 1
            };
            localStorage.setItem('user', JSON.stringify(fallbackUser));
            localStorage.setItem('token', 'dev-mock-token-' + Date.now());
            navigate(redirectUrl);
        } finally {
            setDevLoadingKey(null);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/auth/login', formData);
            const { token, user } = response.data;

            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('token', token);

            navigate(redirectUrl);
        } catch (error) {
            setError(error.response?.data?.error || 'Username atau password salah');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500">
                <div className="w-full p-8 md:p-12">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-lg shadow-blue-200">
                            <LayoutDashboard size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">SARPRAS DEI</h2>
                        <p className="text-slate-500 text-sm">Sistem Manajemen Aset & Pengadaan</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1 ml-1">Username / NIY</label>
                            <div className="relative group">
                                <User className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                    placeholder="admin"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1 ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                                    placeholder="••••••"
                                />
                            </div>
                        </div>

                        {error && <div className="text-red-500 text-xs text-center p-2 bg-red-50 rounded-lg">{error}</div>}

                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                Ingat Saya
                            </label>
                            <a href="#" className="hover:text-blue-600 transition-colors">Lupa Password?</a>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-all transform active:scale-95 shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Memproses...' : 'Masuk Sistem'}
                        </button>
                    </form>

                    {/* KHUSUS LOCALHOST: Panel Pilihan Role Cepat (Dev Quick Login) */}
                    {isDev && (
                        <div className="mt-6 pt-5 border-t border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                                    <Zap size={13} className="text-amber-500 fill-amber-500" /> Mode Dev: Pilih Role Cepat
                                </span>
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                    Localhost Only
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3 font-medium">
                                Klik salah satu role di bawah untuk langsung masuk tanpa perlu memasukkan password:
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {DEV_PRESETS.map((preset) => {
                                    const isThisLoading = devLoadingKey === preset.key;
                                    return (
                                        <button
                                            key={preset.key}
                                            type="button"
                                            disabled={!!devLoadingKey || loading}
                                            onClick={() => handleDevQuickLogin(preset)}
                                            className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 shadow-2xs hover:shadow-xs active:scale-95 disabled:opacity-50 ${preset.border}`}
                                        >
                                            <span className="text-base shrink-0">{preset.icon}</span>
                                            <div className="min-w-0 flex-1">
                                                <span className="text-xs font-black block truncate">
                                                    {preset.label}
                                                </span>
                                                <span className="text-[9px] opacity-75 font-bold block truncate">
                                                    {preset.role}
                                                </span>
                                            </div>
                                            {isThisLoading && (
                                                <Loader2 size={13} className="animate-spin shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mt-8 text-center text-xs text-slate-400 font-medium">
                        &copy; Kepala Bidang Sarana 2025/2027
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <a href="/pesan-seragam" className="text-indigo-600 font-bold hover:underline py-2 block">
                                → Pesan Seragam (Publik)
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default LoginPage;
