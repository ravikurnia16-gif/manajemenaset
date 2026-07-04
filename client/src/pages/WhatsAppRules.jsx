import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search, Bell, Info, Smartphone, RefreshCw, Power } from 'lucide-react';
import api from '../lib/axios';
import Swal from 'sweetalert2';

const EVENT_TYPES = [
    { value: 'NEW_VEHICLE_BOOKING', label: 'Pengajuan Peminjaman Baru' },
    { value: 'VEHICLE_BOOKING_STATUS_CHANGED', label: 'Status Peminjaman Berubah (Disetujui/Ditolak)' },
    { value: 'NEW_MAINTENANCE', label: 'Laporan Kerusakan Aset' },
    { value: 'MORNING_BRIEF', label: 'Laporan Rutin Harian (Terjadwal)' },
];

export default function WhatsAppRules() {
    const [rules, setRules] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);

    const [waStatus, setWaStatus] = useState({ status: 'DISCONNECTED', qr: null });
    const [loadingWa, setLoadingWa] = useState(false);

    const [formData, setFormData] = useState({
        eventName: 'NEW_VEHICLE_BOOKING',
        messageTpl: '',
        targetGroup: '',
        cronTime: '',
        isActive: true
    });

    useEffect(() => {
        fetchData();
        fetchWaStatus();
    }, []);

    useEffect(() => {
        let interval;
        if (waStatus.status === 'SCAN_QR' || waStatus.status === 'INITIALIZING') {
            interval = setInterval(fetchWaStatus, 5000);
        }
        return () => clearInterval(interval);
    }, [waStatus.status]);

    const fetchWaStatus = async () => {
        try {
            setLoadingWa(true);
            const res = await api.get('/whatsapp/status').catch(e => ({ data: { status: 'DISCONNECTED' } }));
            setWaStatus(res.data);
            if (res.data?.status === 'CONNECTED') {
                const groupsRes = await api.get('/whatsapp/groups').catch(e => ({ data: [] }));
                setGroups(groupsRes.data || []);
            }
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
            Swal.fire('Error', 'Gagal menginisialisasi ulang WA.', 'error');
            setLoadingWa(false);
        }
    };

    const handleWaLogout = async () => {
        const result = await Swal.fire({
            title: 'Putuskan Koneksi?',
            text: "Yakin ingin memutuskan koneksi perangkat WhatsApp ini?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, putuskan!',
            cancelButtonText: 'Batal'
        });
        
        if (!result.isConfirmed) return;
        
        try {
            setLoadingWa(true);
            await api.post('/whatsapp/logout');
            setTimeout(fetchWaStatus, 3000);
        } catch (error) {
            Swal.fire('Error', 'Gagal memutuskan koneksi WA.', 'error');
            setLoadingWa(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rulesRes, groupsRes] = await Promise.all([
                api.get('/whatsapp/rules').catch(e => ({ data: [] })),
                api.get('/whatsapp/groups').catch(e => ({ data: [] }))
            ]);
            setRules(rulesRes.data || []);
            setGroups(groupsRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            Swal.fire('Error', 'Gagal mengambil data. Pastikan database aktif.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (rule = null) => {
        if (rule) {
            setEditingRule(rule);
            setFormData({ ...rule });
        } else {
            setEditingRule(null);
            setFormData({
                eventName: 'NEW_VEHICLE_BOOKING',
                messageTpl: 'Halo, ada pengajuan peminjaman dari [NAMA_PEMINJAM] untuk armada [KENDARAAN] ([PLAT]).\n\nTujuan: [TUJUAN]\nJadwal: [START] s.d [END]\n\nMohon segera dicek.',
                targetGroup: '',
                cronTime: '',
                isActive: true
            });
        }
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingRule) {
                await api.put(`/whatsapp/rules/${editingRule.id}`, formData);
                Swal.fire('Berhasil', 'Aturan berhasil diperbarui', 'success');
            } else {
                await api.post('/whatsapp/rules', formData);
                Swal.fire('Berhasil', 'Aturan baru berhasil ditambahkan', 'success');
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            Swal.fire('Error', error.response?.data?.error || 'Gagal menyimpan aturan', 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Hapus Aturan?',
            text: "Yakin ingin menghapus aturan notifikasi ini?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus!',
            cancelButtonText: 'Batal'
        });
        
        if (!result.isConfirmed) return;
        
        try {
            await api.delete(`/whatsapp/rules/${id}`);
            Swal.fire('Terhapus', 'Aturan telah dihapus', 'success');
            fetchData();
        } catch (error) {
            Swal.fire('Error', 'Gagal menghapus aturan', 'error');
        }
    };

    const handleTemplateChange = (e) => {
        const val = e.target.value;
        setFormData({
            ...formData,
            messageTpl: val
        });
    };

    const getTemplateHelp = (eventName) => {
        switch (eventName) {
            case 'NEW_VEHICLE_BOOKING':
                return 'Variabel yang bisa digunakan: [NAMA_PEMINJAM], [KENDARAAN], [PLAT], [TUJUAN], [KEPERLUAN], [START], [END]';
            case 'VEHICLE_BOOKING_STATUS_CHANGED':
                return 'Variabel: [NAMA_PEMINJAM], [KENDARAAN], [STATUS], [CATATAN]';
            case 'NEW_MAINTENANCE':
                return 'Variabel: [ASET], [LOKASI], [PELAPOR], [KELUHAN]';
            case 'MORNING_BRIEF':
                return 'Hanya kirim pesan statis. Kirim setiap hari jam (contoh: 07:00).';
            default:
                return '';
        }
    };

    const EventLabel = ({ value }) => {
        const found = EVENT_TYPES.find(e => e.value === value);
        return found ? found.label : value;
    };

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Bell className="text-blue-500" /> Pusat Kendali Notifikasi WA
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Atur aturan otomatis pengiriman pesan WhatsApp ke Grup atau Individu berdasarkan kejadian di sistem.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                >
                    <Plus size={18} /> Aturan Baru
                </button>
            </div>

            {/* WA Connection Status Block */}
            <div className="bg-white rounded-xl shadow border border-slate-100 p-6 mb-6">
                <div className="flex flex-col items-center justify-center space-y-4">
                    {loadingWa ? (
                        <div className="text-slate-500 animate-pulse">Memuat status WhatsApp...</div>
                    ) : (
                        <>
                            <div className={`px-4 py-2 rounded-full text-sm font-bold border flex items-center gap-2
                                ${waStatus.status === 'CONNECTED' ? 'bg-green-50 text-green-600 border-green-200' :
                                waStatus.status === 'SCAN_QR' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                waStatus.status === 'INITIALIZING' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                'bg-red-50 text-red-600 border-red-200'}`}
                            >
                                <div className={`w-2.5 h-2.5 rounded-full ${waStatus.status === 'CONNECTED' ? 'bg-green-500' : waStatus.status === 'SCAN_QR' ? 'bg-amber-500 animate-pulse' : waStatus.status === 'INITIALIZING' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></div>
                                Status: {waStatus.status === 'CONNECTED' ? 'WhatsApp Terhubung' : waStatus.status === 'SCAN_QR' ? 'Menunggu Scan QR' : waStatus.status === 'INITIALIZING' ? 'Sedang Memulai...' : 'WhatsApp Terputus'}
                            </div>

                            {waStatus.status === 'SCAN_QR' && waStatus.qr && (
                                <div className="p-4 bg-white border-2 border-dashed border-slate-200 rounded-xl">
                                    <img src={waStatus.qr} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                                    <p className="text-center text-xs text-slate-500 mt-2">Buka WhatsApp di HP Anda, masuk ke Perangkat Tertaut, dan scan kode ini.</p>
                                </div>
                            )}

                            <div className="flex gap-4 mt-2">
                                <button
                                    onClick={handleWaInit}
                                    disabled={loadingWa || waStatus.status === 'CONNECTED'}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    <RefreshCw size={16} /> Muat Ulang QR
                                </button>
                                <button
                                    onClick={handleWaLogout}
                                    disabled={loadingWa || waStatus.status !== 'CONNECTED'}
                                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    <Power size={16} /> Putuskan Koneksi
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm uppercase tracking-wider">
                                <th className="p-4 font-medium">Jenis Kejadian</th>
                                <th className="p-4 font-medium">Grup Tujuan</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-500">
                                        Memuat data...
                                    </td>
                                </tr>
                            ) : rules.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-500">
                                        Belum ada aturan notifikasi. Silakan tambah baru.
                                    </td>
                                </tr>
                            ) : (
                                rules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-medium text-slate-800">
                                            <EventLabel value={rule.eventName} />
                                        </td>
                                        <td className="p-4 text-slate-600">
                                            {groups.find(g => g.id === rule.targetGroup)?.name || rule.targetGroup || '-'}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {rule.isActive ? 'AKTIF' : 'NONAKTIF'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(rule)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(rule.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden mt-10 mb-10">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold">
                                {editingRule ? 'Edit Aturan' : 'Tambah Aturan Notifikasi'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Jenis Kejadian (Trigger)
                                </label>
                                <select
                                    value={formData.eventName}
                                    onChange={(e) => {
                                        setFormData({ ...formData, eventName: e.target.value });
                                    }}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    {EVENT_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Kirim Ke Grup (Target)
                                </label>
                                <select
                                    value={formData.targetGroup}
                                    onChange={(e) => setFormData({ ...formData, targetGroup: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">-- Pilih Grup WA --</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Catatan: Grup harus terdaftar dan bot sudah dimasukkan ke grup tersebut.</p>
                            </div>

                            {formData.eventName === 'MORNING_BRIEF' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Jam Kirim (Format HH:mm)
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.cronTime}
                                        onChange={(e) => setFormData({ ...formData, cronTime: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Format Pesan
                                </label>
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-2 text-sm text-blue-800 flex gap-2 items-start">
                                    <Info className="shrink-0 mt-0.5" size={16} />
                                    <span>{getTemplateHelp(formData.eventName)}</span>
                                </div>
                                <textarea
                                    value={formData.messageTpl}
                                    onChange={handleTemplateChange}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-32"
                                    placeholder="Ketik format pesan di sini..."
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-2 mt-4">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                                    Aturan Aktif
                                </label>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                                >
                                    <Save size={18} /> Simpan Aturan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
