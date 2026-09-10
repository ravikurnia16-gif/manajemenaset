import React, { useState, useEffect } from 'react';
import {
    Wrench,
    HardHat,
    Cog,
    Save,
    ArrowLeft,
    Users,
    Sparkles,
    ShieldCheck,
    Bell,
    CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import Swal from 'sweetalert2';

function WorkshopBaruSettings() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [users, setUsers] = useState([]);
    const [settings, setSettings] = useState({
        workshopPicKayu: '',
        workshopPicBesi: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [settingsRes, usersRes] = await Promise.all([
                api.get('/settings'),
                api.get('/users')
            ]);
            setSettings({
                workshopPicKayu: settingsRes.data?.workshopPicKayu || '',
                workshopPicBesi: settingsRes.data?.workshopPicBesi || ''
            });
            setUsers(usersRes.data || []);
        } catch (error) {
            console.error('Failed to load settings:', error);
            Swal.fire('Error', 'Gagal memuat pengaturan workshop.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            await api.put('/settings', {
                workshopPicKayu: settings.workshopPicKayu,
                workshopPicBesi: settings.workshopPicBesi
            });
            Swal.fire('Tersimpan!', 'Pengaturan khusus Workshop Unit 21 berhasil diperbarui.', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            Swal.fire('Gagal!', error.response?.data?.error || 'Terjadi kesalahan saat menyimpan.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Filter users belonging to Unit 21 or workshop
    const workshopStaff = users.filter(u =>
        u.unitId === 21 ||
        (u.unit?.name || '').toLowerCase().includes('workshop') ||
        (u.unit?.name || '').toLowerCase().includes('sarana')
    );

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-medium">Memuat pengaturan workshop...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/workshop-baru/dashboard')}
                    className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                >
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Wrench className="text-emerald-600" size={24} /> Pengaturan Workshop Unit 21
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Konfigurasi PIC Default pengerjaan Kayu & Besi serta alur notifikasi pesanan masuk
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* PIC Assignment Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-emerald-700">
                        <Users size={18} />
                        <h2 className="font-bold text-sm uppercase tracking-wider">Penanggung Jawab (PIC) Default</h2>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                        Nama PIC yang dipilih di bawah ini akan otomatis menjadi penanggung jawab dan menerima notifikasi WhatsApp saat pesanan baru diajukan oleh unit pemesan sesuai tipe workshop.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                        {/* PIC Kayu */}
                        <div className="p-4 rounded-xl border border-orange-200/80 bg-orange-50/40 space-y-2">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-[10px] font-extrabold">
                                    🪵 KAYU
                                </span>
                                Penanggung Jawab Workshop Kayu
                            </label>
                            <select
                                value={settings.workshopPicKayu || ''}
                                onChange={e => setSettings({ ...settings, workshopPicKayu: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-slate-800"
                            >
                                <option value="">-- Pilih Staff Workshop Kayu --</option>
                                {workshopStaff.map(u => (
                                    <option key={u.id} value={u.name}>
                                        {u.name} ({u.position || 'Staff'} - {u.unit?.name || 'Unit 21'})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-500">
                                Staff yang bertanggung jawab untuk fabrikasi mebel, perbaikan kayu, dan partisi.
                            </p>
                        </div>

                        {/* PIC Besi */}
                        <div className="p-4 rounded-xl border border-slate-300/80 bg-slate-50/70 space-y-2">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-extrabold">
                                    ⚙️ BESI
                                </span>
                                Penanggung Jawab Workshop Besi
                            </label>
                            <select
                                value={settings.workshopPicBesi || ''}
                                onChange={e => setSettings({ ...settings, workshopPicBesi: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-slate-800"
                            >
                                <option value="">-- Pilih Staff Workshop Besi --</option>
                                {workshopStaff.map(u => (
                                    <option key={u.id} value={u.name}>
                                        {u.name} ({u.position || 'Staff'} - {u.unit?.name || 'Unit 21'})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-500">
                                Staff yang bertanggung jawab untuk pengelasan, tralis, kanopi, dan struktur besi.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Information Card */}
                <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl p-6 shadow-md space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                        <ShieldCheck size={18} /> Keistimewaan Akses Unit 21
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Akun yang terdaftar di <strong>Unit ID 21 (Sarana & Workshop)</strong> secara otomatis memiliki hak kelola penuh (*Full Workshop Admin*) pada sistem. Mereka dapat melihat semua pesanan masuk dari seluruh unit, memperbarui status antrean, mengubah estimasi harga, mengunggah foto progres pengerjaan, hingga menyelesaikan pesanan.
                    </p>
                </div>

                {/* Submit button */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-emerald-600/30 transition-all disabled:opacity-50"
                    >
                        <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default WorkshopBaruSettings;
