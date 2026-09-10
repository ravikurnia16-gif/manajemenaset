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
    CheckCircle2,
    BookOpen,
    FileText,
    UserCheck,
    Phone,
    Info,
    Plus,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import Swal from 'sweetalert2';

const DEFAULT_UNIT_RULES = [
    "Setiap pesanan pekerjaan workshop wajib diajukan dan diverifikasi secara resmi oleh Kepala Unit pemesan.",
    "Estimasi biaya material dan durasi waktu pengerjaan harus dikonfirmasi oleh unit pemesan sebelum pengerjaan fisik dimulai.",
    "Pengajuan dengan prioritas 'Urgent' harus menyertakan keterangan kebutuhan darurat dari Kepala Unit pemesan.",
    "Seluruh item pekerjaan yang telah rampung wajib melalui tahap Quality Control (QC) sebelum serah terima resmi (Berita Acara).",
    "Spesifikasi barang fabrikasi mengacu pada Katalog Standar Workshop Yayasan Dar El-Iman.",
    "Perubahan desain atau rincian spesifikasi di tengah proses pengerjaan wajib dikoordinasikan tertulis dengan Tim Workshop."
];

export default function WorkshopBaruSettings() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [users, setUsers] = useState([]);

    const [settings, setSettings] = useState({
        workshopPicKayu: '',
        workshopPicBesi: '',
        headName: '',
        headNip: '',
        phone: '',
        description: ''
    });

    const [unitRules, setUnitRules] = useState(DEFAULT_UNIT_RULES);
    const [newRuleText, setNewRuleText] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [settingsUnitRes, usersRes] = await Promise.allSettled([
                api.get('/workshop/settings-unit'),
                api.get('/users')
            ]);

            let loadedSettings = {};
            let loadedUnit = {};
            let u21UsersFromServer = [];

            if (settingsUnitRes.status === 'fulfilled') {
                loadedSettings = settingsUnitRes.value.data?.settings || {};
                loadedUnit = settingsUnitRes.value.data?.unit21 || {};
                u21UsersFromServer = settingsUnitRes.value.data?.unit21Users || [];
            } else {
                // Fallback to separate endpoints
                const s = await api.get('/settings').catch(() => ({ data: {} }));
                const u = await api.get('/master/units/21').catch(() => ({ data: {} }));
                loadedSettings = s.data || {};
                loadedUnit = u.data || {};
            }

            const allUsers = usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : [];
            const mergedUsers = [...allUsers];
            u21UsersFromServer.forEach(u => {
                if (!mergedUsers.some(existing => existing.id === u.id)) {
                    mergedUsers.push(u);
                }
            });
            setUsers(mergedUsers);

            // Filter users strictly belonging to Unit 21 (Workshop)
            const u21List = mergedUsers.filter(u =>
                u.unitId === 21 ||
                (u.unit?.name || '').toLowerCase().includes('workshop') ||
                (u.position || '').toLowerCase().includes('workshop')
            );
            const candidateUsers = u21List.length > 0 ? u21List : mergedUsers;

            // Resolve Kepala Unit
            let matchedUser = null;
            if (loadedUnit.headName) {
                matchedUser = candidateUsers.find(u => u.name && u.name.trim().toLowerCase() === loadedUnit.headName.trim().toLowerCase()) ||
                              mergedUsers.find(u => u.name && u.name.trim().toLowerCase() === loadedUnit.headName.trim().toLowerCase());
            }
            if (!matchedUser && loadedUnit.headNip && loadedUnit.headNip !== '-') {
                matchedUser = candidateUsers.find(u => 
                    (u.nip && u.nip.trim() === loadedUnit.headNip.trim()) ||
                    (u.username && u.username.trim() === loadedUnit.headNip.trim())
                );
            }
            if (!matchedUser && candidateUsers.length > 0) {
                matchedUser = candidateUsers.find(u => (u.position || '').toLowerCase().includes('kepala')) ||
                              candidateUsers.find(u => (u.position || '').toLowerCase().includes('sarpras unit')) ||
                              candidateUsers.find(u => u.role === 'ADMIN_UNIT') ||
                              candidateUsers[0];
            }

            const initialHeadName = loadedUnit.headName || matchedUser?.name || '';
            const initialHeadNip = (loadedUnit.headNip && loadedUnit.headNip !== '-' && loadedUnit.headNip.trim() !== '')
                ? loadedUnit.headNip
                : (matchedUser?.nip || matchedUser?.username || '');
            const initialPhone = (loadedUnit.phone && loadedUnit.phone !== '-' && loadedUnit.phone.trim() !== '')
                ? loadedUnit.phone
                : (matchedUser?.phone || '');

            setSettings({
                workshopPicKayu: loadedSettings.workshopPicKayu || '',
                workshopPicBesi: loadedSettings.workshopPicBesi || '',
                headName: initialHeadName,
                headNip: initialHeadNip,
                phone: initialPhone,
                description: loadedUnit.description || ''
            });

            // Load custom rules from description if JSON encoded, otherwise use defaults
            if (loadedUnit.description && loadedUnit.description.startsWith('{"rules":')) {
                try {
                    const parsed = JSON.parse(loadedUnit.description);
                    if (Array.isArray(parsed.rules) && parsed.rules.length > 0) {
                        setUnitRules(parsed.rules);
                    }
                } catch (e) {
                    console.error('Failed to parse unit rules JSON', e);
                }
            } else {
                const savedLocal = localStorage.getItem('workshop_unit_rules');
                if (savedLocal) {
                    try {
                        setUnitRules(JSON.parse(savedLocal));
                    } catch (e) {}
                }
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            Swal.fire('Error', 'Gagal memuat pengaturan workshop.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddRule = () => {
        if (!newRuleText.trim()) return;
        setUnitRules([...unitRules, newRuleText.trim()]);
        setNewRuleText('');
    };

    const handleRemoveRule = (index) => {
        setUnitRules(unitRules.filter((_, i) => i !== index));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);

            // Encode rules in unit description
            const descriptionPayload = JSON.stringify({
                info: settings.description || 'Unit 21 Workshop & Sarana',
                rules: unitRules
            });

            localStorage.setItem('workshop_unit_rules', JSON.stringify(unitRules));

            await api.put('/workshop/settings-unit', {
                workshopPicKayu: settings.workshopPicKayu,
                workshopPicBesi: settings.workshopPicBesi,
                headName: settings.headName,
                headNip: settings.headNip,
                phone: settings.phone,
                description: descriptionPayload
            });

            Swal.fire({
                title: 'Tersimpan!',
                text: 'Pengaturan dan Aturan Kepala Unit berhasil diperbarui.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Failed to save settings:', error);
            Swal.fire('Gagal!', error.response?.data?.error || 'Terjadi kesalahan saat menyimpan pengaturan.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Filter users belonging to Unit 21 or workshop / sarana
    const workshopStaff = users.filter(u =>
        u.unitId === 21 ||
        (u.unit?.name || '').toLowerCase().includes('workshop') ||
        (u.unit?.name || '').toLowerCase().includes('sarana')
    );

    // Filter users strictly belonging to Unit 21 (Workshop) for Kepala Unit selection
    const unit21Users = users.filter(u =>
        u.unitId === 21 ||
        (u.unit?.name || '').toLowerCase().includes('workshop') ||
        (u.position || '').toLowerCase().includes('workshop')
    );
    const eligibleHeadUsers = unit21Users.length > 0 ? unit21Users : users;

    const selectedHeadUser = eligibleHeadUsers.find(u =>
        (settings.headName && u.name && u.name.trim().toLowerCase() === settings.headName.trim().toLowerCase()) ||
        (settings.headNip && (u.nip === settings.headNip || u.username === settings.headNip))
    );

    // Auto-sync NIY and Phone if a head user is matched but the fields are empty or '-'
    useEffect(() => {
        if (selectedHeadUser) {
            const autoNiy = selectedHeadUser.nip || selectedHeadUser.username || '';
            const autoPhone = selectedHeadUser.phone || '';
            let needsUpdate = false;
            let nextNip = settings.headNip;
            let nextPhone = settings.phone;

            if ((!settings.headNip || settings.headNip === '-') && autoNiy) {
                nextNip = autoNiy;
                needsUpdate = true;
            }
            if ((!settings.phone || settings.phone === '-') && autoPhone) {
                nextPhone = autoPhone;
                needsUpdate = true;
            }
            if (needsUpdate) {
                setSettings(prev => ({
                    ...prev,
                    headNip: nextNip,
                    phone: nextPhone
                }));
            }
        }
    }, [selectedHeadUser]);

    const handleHeadUserChange = (userId) => {
        const uid = parseInt(userId);
        const found = eligibleHeadUsers.find(u => u.id === uid);
        if (found) {
            const autoNiy = found.nip || found.username || '';
            const autoPhone = found.phone || '';
            setSettings(prev => ({
                ...prev,
                headName: found.name,
                headNip: autoNiy,
                phone: autoPhone
            }));
        } else {
            setSettings(prev => ({
                ...prev,
                headName: '',
                headNip: '',
                phone: ''
            }));
        }
    };

    if (loading) {
        return (
            <div className="p-12 flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-medium">Memuat pengaturan workshop & aturan kepala unit...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24">
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
                        Konfigurasi Aturan Kepala Unit, Penanggung Jawab Teknis, dan SOP Alur Kerja Workshop
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* 1. SEKSI ATURAN KEPALA UNIT (SOP & KEBIJAKAN RESMI) */}
                <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-indigo-50 text-indigo-900">
                        <div className="flex items-center gap-2">
                            <BookOpen size={20} className="text-indigo-600" />
                            <div>
                                <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
                                    Aturan Kepala Unit (SOP Pemesanan Workshop)
                                </h2>
                                <p className="text-[11px] text-slate-500 font-normal">
                                    Pedoman dan aturan resmi yang mengikat Kepala Unit dalam mengajukan dan menyetujui pekerjaan workshop.
                                </p>
                            </div>
                        </div>
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200">
                            Regulasi Aktif
                        </span>
                    </div>

                    {/* Identitas Kepala Unit 21 (Dipilih dari User Unit 21) */}
                    <div className="space-y-4 bg-gradient-to-br from-indigo-50/70 to-blue-50/40 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <UserCheck size={13} className="text-indigo-600" />
                                        Pilih Kepala Unit <span className="text-rose-500">*</span>
                                    </span>
                                    <span className="text-[9px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full font-bold">
                                        User Unit 21
                                    </span>
                                </label>
                                <select
                                    className="w-full border border-indigo-200 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-semibold text-slate-800 shadow-sm transition-all"
                                    value={selectedHeadUser ? selectedHeadUser.id : ''}
                                    onChange={(e) => handleHeadUserChange(e.target.value)}
                                >
                                    <option value="">-- Pilih User Unit 21 --</option>
                                    {eligibleHeadUsers.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.name} (NIY: {u.nip || u.username || '-'}) - {u.position || 'Staff Workshop'}
                                        </option>
                                    ))}
                                </select>
                                {settings.headName && (
                                    <p className="text-[11px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1 truncate">
                                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                        <span>Terpilih: <strong>{settings.headName}</strong></span>
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase mb-1.5 flex items-center justify-between">
                                    <span>NIY / NIP Kepala Unit</span>
                                    {settings.headNip && settings.headNip !== '-' && (
                                        <span className="text-[9px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Terdata Otomatis
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    className="w-full border border-indigo-200 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800 font-mono font-bold shadow-sm"
                                    value={settings.headNip}
                                    onChange={e => setSettings({ ...settings, headNip: e.target.value })}
                                    placeholder="NIY terisi otomatis..."
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {selectedHeadUser ? `Terdata langsung dari akun: ${selectedHeadUser.name}` : 'Otomatis terdata saat memilih user'}
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase mb-1.5 flex items-center justify-between">
                                    <span>No. Telepon / WhatsApp Unit</span>
                                    {settings.phone && settings.phone !== '-' && (
                                        <span className="text-[9px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Terdata Otomatis
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    className="w-full border border-indigo-200 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800 font-semibold shadow-sm"
                                    value={settings.phone}
                                    onChange={e => setSettings({ ...settings, phone: e.target.value })}
                                    placeholder="0812... / Kontak WhatsApp"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {selectedHeadUser ? (selectedHeadUser.phone ? `Kontak WhatsApp aktif: ${selectedHeadUser.phone}` : 'Belum ada No HP di profil akun user') : 'Otomatis terdata saat memilih user'}
                                </p>
                            </div>
                        </div>

                        {/* Status Sinkronisasi Langsung */}
                        {selectedHeadUser && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/80 border border-indigo-100 text-indigo-900 text-xs font-medium shadow-xs">
                                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                                <div className="leading-snug">
                                    <span className="text-slate-600">Identitas Kepala Unit terdata otomatis dari Akun: </span>
                                    <strong className="font-bold text-slate-900">{selectedHeadUser.name}</strong>
                                    <span className="text-slate-500"> | NIY: </span>
                                    <span className="font-mono font-bold text-indigo-800">{settings.headNip || selectedHeadUser.nip || selectedHeadUser.username || '-'}</span>
                                    <span className="text-slate-500"> | WhatsApp: </span>
                                    <span className="font-bold text-emerald-800">{settings.phone || selectedHeadUser.phone || '-'}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Daftar Butir Aturan Kepala Unit */}
                    <div className="space-y-3 pt-2">
                        <label className="text-xs font-bold text-slate-700 block">
                            Poin-Poin Aturan & Ketentuan untuk Seluruh Kepala Unit:
                        </label>

                        <div className="space-y-2">
                            {unitRules.map((rule, idx) => (
                                <div 
                                    key={idx}
                                    className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                                            {idx + 1}
                                        </span>
                                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                            {rule}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRule(idx)}
                                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                                        title="Hapus butir aturan"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Input Tambah Aturan Baru */}
                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="text"
                                className="flex-1 border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                placeholder="Tulis butir aturan baru untuk Kepala Unit..."
                                value={newRuleText}
                                onChange={e => setNewRuleText(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddRule();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleAddRule}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm"
                            >
                                <Plus size={14} /> Tambah Aturan
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. PIC PENANGGUNG JAWAB TEKNIS (KAYU & BESI) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-emerald-700">
                        <Users size={18} />
                        <h2 className="font-bold text-sm uppercase tracking-wider text-slate-800">
                            Penanggung Jawab Teknis Pengerjaan
                        </h2>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                        Staff teknisi penanggung jawab fabrikasi Kayu dan Besi di Unit 21 yang akan mengkoordinir pengerjaan pesanan:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                        {/* PIC Kayu */}
                        <div className="p-4 rounded-xl border border-orange-200/80 bg-orange-50/40 space-y-2">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-[10px] font-extrabold">
                                    🪵 KAYU
                                </span>
                                Penanggung Jawab Fabrikasi Kayu
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
                                Bertanggung jawab untuk fabrikasi mebel, perbaikan kayu, meja, rak, dan partisi.
                            </p>
                        </div>

                        {/* PIC Besi */}
                        <div className="p-4 rounded-xl border border-slate-300/80 bg-slate-50/70 space-y-2">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-extrabold">
                                    ⚙️ BESI
                                </span>
                                Penanggung Jawab Fabrikasi Besi
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
                                Bertanggung jawab untuk pengelasan, tralis, kanopi, pagar, dan struktur besi.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. INFORMATION CARD: HAK AKSES KHUSUS */}
                <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                        <ShieldCheck size={18} /> Otoritas Penuh Kepala Bidang Sarana & Unit 21
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Manajemen Workshop Baru (Unit 21) memberikan kontrol terpusat bagi <strong>Kepala Bidang Sarana</strong> untuk memantau alur antrean pengerjaan, mengontrol estimasi biaya realisasi, menerbitkan pesanan resmi, serta mengelola <strong>Katalog Produk Workshop</strong> yang tersinkronisasi otomatis dengan <strong>Data Vendor</strong>.
                    </p>
                </div>

                {/* Submit button */}
                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 hover:scale-105"
                    >
                        <Save size={16} /> {saving ? 'Menyimpan Pengaturan...' : 'Simpan Seluruh Pengaturan'}
                    </button>
                </div>
            </form>
        </div>
    );
}
