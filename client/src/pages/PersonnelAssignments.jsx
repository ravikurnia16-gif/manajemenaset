import { useState, useEffect } from 'react';
import { FileCheck, Plus, Clock, CheckCircle2, AlertCircle, Calendar, User, Search, MapPin, Tag } from 'lucide-react';
import api from '../lib/axios';

const PersonnelAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // User info for role-based UI
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const canAssign = ['KEPALA_BIDANG', 'ADMIN_UNIT', 'SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role);

    const [form, setForm] = useState({
        assigneeId: '',
        title: '',
        description: '',
        category: 'UMUM',
        location: '',
        startDate: '',
        dueDate: '',
        addToCalendar: true
    });

    const statusConfig = {
        PENDING: { color: 'bg-yellow-100 text-yellow-700', icon: <Clock size={14} />, label: 'Menunggu' },
        IN_PROGRESS: { color: 'bg-blue-100 text-blue-700', icon: <AlertCircle size={14} />, label: 'Proses' },
        COMPLETED: { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={14} />, label: 'Selesai' },
        CANCELLED: { color: 'bg-red-100 text-red-700', icon: <AlertCircle size={14} />, label: 'Dibatalkan' }
    };

    const fetchAssignments = async () => {
        try {
            setLoading(true);
            const res = await api.get('/personnel/assignments');
            setAssignments(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get('/personnel/staff');
            setStaff(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchAssignments();
        fetchStaff();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.assigneeId || !form.title) return alert('Penerima tugas dan Judul wajib diisi');

        try {
            setSubmitting(true);
            await api.post('/personnel/assignments', form);
            setShowForm(false);
            setForm({ assigneeId: '', title: '', description: '', category: 'UMUM', location: '', startDate: '', dueDate: '', addToCalendar: true });
            fetchAssignments();
            alert(`Tugas berhasil diberikan${form.addToCalendar ? ' dan masuk Kalender' : ''}`);
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal memberikan tugas');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            await api.put(`/personnel/assignments/${id}/status`, { status: newStatus });
            setAssignments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
        } catch (err) {
            alert('Gagal update status');
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileCheck className="text-blue-600" /> Penugasan Personalia
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Pemberian tugas dan pelacakan aktivitas staf Sarpras (Terhubung Kalender Kerja)
                    </p>
                </div>
                {canAssign && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm"
                    >
                        {showForm ? 'Batal' : <><Plus size={18} /> Beri Tugas Baru</>}
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Form Penugasan Baru</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pilih Staf (Penerima Tugas)</label>
                                <select
                                    value={form.assigneeId}
                                    onChange={e => setForm({ ...form, assigneeId: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">-- Pilih Staf --</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Mulai</label>
                                <input
                                    type="date"
                                    value={form.startDate}
                                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Deadline / Batas Waktu</label>
                                <input
                                    type="date"
                                    value={form.dueDate}
                                    onChange={e => setForm({ ...form, dueDate: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kategori</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm({ ...form, category: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="UMUM">Umum</option>
                                    <option value="Servis">Servis</option>
                                    <option value="Perbaikan">Perbaikan</option>
                                    <option value="Pengadaan">Pengadaan</option>
                                    <option value="Pengecekan">Pengecekan</option>
                                    <option value="Lainnya">Lainnya</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Lokasi (Opsional)</label>
                                <input
                                    type="text"
                                    value={form.location}
                                    onChange={e => setForm({ ...form, location: e.target.value })}
                                    placeholder="Misal: Gedung A Lt. 1"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Judul Tugas</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder="Misal: Perbaikan AC Ruang Rapat"
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Deskripsi Tugas</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                rows={3}
                                placeholder="Detail instruksi tugas..."
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            ></textarea>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                id="addToCalendar"
                                checked={form.addToCalendar}
                                onChange={e => setForm({ ...form, addToCalendar: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label htmlFor="addToCalendar" className="text-sm text-slate-700 font-medium cursor-pointer">
                                Tampilkan di Kalender Sarpras
                            </label>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {submitting ? 'Memproses...' : 'Tugaskan & Jadwalkan'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {loading ? (
                    <div className="lg:col-span-2 p-10 text-center text-slate-400 font-medium">Memuat data penugasan...</div>
                ) : assignments.length === 0 ? (
                    <div className="lg:col-span-2 p-10 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
                        <FileCheck size={40} className="mx-auto mb-2 text-slate-200" />
                        Belum ada data penugasan aktif.
                    </div>
                ) : (
                    assignments.map(a => (
                        <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${statusConfig[a.status].color}`}>
                                        {statusConfig[a.status].icon}
                                        {statusConfig[a.status].label}
                                    </span>
                                    <div className="text-right space-y-0.5">
                                        {a.startDate && (
                                            <span className="text-[10px] text-blue-400 flex items-center gap-1 font-medium justify-end">
                                                <Calendar size={10} /> Mulai: {new Date(a.startDate).toLocaleDateString('id-ID')}
                                            </span>
                                        )}
                                        {a.dueDate && (
                                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium justify-end">
                                                <Clock size={10} /> Deadline: {new Date(a.dueDate).toLocaleDateString('id-ID')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-base font-bold text-slate-800 mb-1">{a.title}</h3>
                                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{a.description}</p>

                                <div className="space-y-2 pt-4 border-t border-slate-50">
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <CategoryIcon category={a.category} />
                                        <span className="font-semibold">Kategori:</span> {a.category}
                                    </div>
                                    {a.location && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <MapPin size={14} className="text-slate-400" />
                                            <span className="font-semibold">Lokasi:</span> {a.location}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <User size={14} className="text-slate-400" />
                                        <span className="font-semibold">PIC:</span> {a.assignee?.name}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                                        <span className="font-semibold text-slate-500">Oleh:</span> {a.assigner?.name}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center gap-2">
                                {a.status === 'PENDING' && (
                                    <button
                                        onClick={() => handleUpdateStatus(a.id, 'IN_PROGRESS')}
                                        className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all"
                                    >
                                        Mulai Kerjakan
                                    </button>
                                )}
                                {a.status === 'IN_PROGRESS' && (
                                    <button
                                        onClick={() => handleUpdateStatus(a.id, 'COMPLETED')}
                                        className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-all shadow-sm"
                                    >
                                        Tandai Selesai
                                    </button>
                                )}
                                {a.status === 'COMPLETED' && (
                                    <div className="w-full text-center py-2 text-[10px] text-green-600 font-bold bg-green-50 rounded-lg border border-green-100 italic flex items-center justify-center gap-1">
                                        <CheckCircle2 size={12} /> Tugas ini telah diselesaikan
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const CategoryIcon = ({ category }) => {
    return <Tag size={14} className="text-slate-400" />;
};

export default PersonnelAssignments;
