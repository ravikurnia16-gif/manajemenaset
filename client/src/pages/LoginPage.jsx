import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, LayoutDashboard } from 'lucide-react';
import api from '../lib/axios';

const LoginPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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

            navigate('/dashboard');
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
                        <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
                        <p className="text-slate-500 text-sm">Masuk untuk mengelola aset anda</p>
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

                    <div className="mt-8 text-center text-xs text-slate-400">
                        &copy; 2026 Asset Management System v1.0
                    </div>
                </div>
            </div>
        </div>
    );
};
export default LoginPage;
