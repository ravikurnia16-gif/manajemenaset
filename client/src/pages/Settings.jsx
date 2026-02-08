import { useState, useEffect } from 'react';
import { Save, Building2, UserCheck, ShieldCheck, Globe, Mail, MapPin, Phone } from 'lucide-react';
import api from '../lib/axios';

const Settings = () => {
    const [settings, setSettings] = useState({
        orgName: '',
        orgAddress: '',
        orgPhone: '',
        orgEmail: '',
        orgHeadName: '',
        orgHeadNip: '',
        assetCodePrefix: 'AST'
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
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

    if (loading) return <div className="p-8 text-center text-slate-500">Memuat pengaturan...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pengaturan Sistem</h1>
                    <p className="text-slate-500 text-sm">Kelola identitas instansi dan konfigurasi aplikasi</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Org Profile */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-50 text-blue-600">
                            <Building2 size={20} />
                            <h2 className="font-semibold uppercase tracking-wider text-xs">Profil Instansi</h2>
                        </div>

                        <div className="space-y-4">
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
                            <span className="font-mono text-blue-600 font-bold">v1.2.5-Stable</span>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default Settings;
