import { useState, useEffect } from 'react';
import { FileCheck, Plus, Clock, CheckCircle2, AlertCircle, Calendar, User, Search, MapPin, Tag } from 'lucide-react';
import api from '../lib/axios';

const PersonnelAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [limit, setLimit] = useState(10);

    // User info for role-based UI
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const canAssign = ['KEPALA_BIDANG', 'ADMIN_UNIT', 'SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(user.role);

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
            const res = await api.get('/personnel/assignments', {
                params: { limit }
            });
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
    }, [limit]); // Fetch on limit change

    useEffect(() => {
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

    const handleUpdateProgress = async (id, data) => {
        try {
            await api.put(`/personnel/assignments/${id}/status`, data);
            setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
            if (data.status === 'COMPLETED') fetchAssignments(); // Refresh to get timestamps
        } catch (err) {
            alert('Gagal update progres');
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            await api.put(`/personnel/assignments/${id}/status`, { status: newStatus });
            fetchAssignments(); // Fetch to get actual times
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

            <div className="flex justify-end items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="w-40">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tampilkan</label>
                    <select
                        value={limit}
                        onChange={e => setLimit(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="10">10 Data</option>
                        <option value="25">25 Data</option>
                        <option value="50">50 Data</option>
                        <option value="all">Semua</option>
                    </select>
                </div>
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
                                    <option value="Kerja">Kerja</option>
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
                        <AssignmentCard
                            key={a.id}
                            a={a}
                            statusConfig={statusConfig}
                            handleUpdateStatus={handleUpdateStatus}
                            handleUpdateProgress={handleUpdateProgress}
                            canAssign={canAssign}
                            userId={user.id}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

const AssignmentCard = ({ a, statusConfig, handleUpdateStatus, handleUpdateProgress, canAssign, userId }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localProgress, setLocalProgress] = useState(a.progressPercentage || 0);
    const [localNotes, setLocalNotes] = useState(a.notes || '');

    const isAssignee = a.assigneeId === userId;

    const calculateDuration = () => {
        if (!a.actualStartDate || !a.actualCompletionDate) return null;
        const start = new Date(a.actualStartDate);
        const end = new Date(a.actualCompletionDate);
        const diff = Math.abs(end - start);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days} Hari ${hours % 24} Jam`;
        }
        return `${hours} Jam ${mins} Menit`;
    };

    const duration = calculateDuration();

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
            {/* Progress Bar Background */}
            <div className="absolute top-0 left-0 h-1 bg-blue-500 transition-all duration-500" style={{ width: `${a.progressPercentage}%` }}></div>

            <div>
                <div className="flex justify-between items-start mb-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${statusConfig[a.status].color}`}>
                        {statusConfig[a.status].icon}
                        {statusConfig[a.status].label}
                    </span>
                    <div className="text-right space-y-0.5">
                        {a.startDate && (
                            <span className="text-[10px] text-blue-400 flex items-center gap-1 font-medium justify-end">
                                <Calendar size={10} /> Sched: {new Date(a.startDate).toLocaleDateString('id-ID')}
                            </span>
                        )}
                        {a.dueDate && (
                            <span className="text-[10px] text-red-400 flex items-center gap-1 font-medium justify-end">
                                <Clock size={10} /> Deadline: {new Date(a.dueDate).toLocaleDateString('id-ID')}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-start gap-2">
                    <h3 className="text-base font-bold text-slate-800 mb-1">{a.title}</h3>
                    <span className="text-blue-600 font-bold text-sm">{a.progressPercentage}%</span>
                </div>
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{a.description}</p>

                {/* Timeline info */}
                {(a.actualStartDate || a.actualCompletionDate) && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Timeline Realisasi</div>
                        {a.actualStartDate && (
                            <div className="text-xs text-slate-600 flex justify-between">
                                <span>Mulai:</span>
                                <span className="font-semibold text-blue-600">{new Date(a.actualStartDate).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        )}
                        {a.actualCompletionDate && (
                            <div className="text-xs text-slate-600 flex justify-between">
                                <span>Selesai:</span>
                                <span className="font-semibold text-green-600">{new Date(a.actualCompletionDate).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        )}
                        {duration && (
                            <div className="text-xs text-slate-600 flex justify-between pt-1 border-t border-slate-200 mt-1">
                                <span>Durasi:</span>
                                <span className="font-bold text-slate-800">{duration}</span>
                            </div>
                        )}
                    </div>
                )}

                {a.notes && (
                    <div className="mb-4">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Catatan Pekerjaan:</div>
                        <p className="text-xs text-slate-600 italic bg-blue-50/50 p-2 rounded border border-blue-100/50">{a.notes}</p>
                    </div>
                )}

                <div className="space-y-2 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Tag size={14} className="text-slate-400" />
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
                </div>
            </div>

            <div className="mt-6 space-y-3">
                {isEditing ? (
                    <div className="bg-slate-50 p-3 rounded-lg border border-blue-200 animate-in fade-in zoom-in-95 duration-200">
                        <div className="mb-3">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 flex justify-between">
                                PROGRES KERJA <span>{localProgress}%</span>
                            </label>
                            <input
                                type="range"
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                value={localProgress}
                                onChange={e => setLocalProgress(e.target.value)}
                            />
                        </div>
                        <div className="mb-3">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">CATATAN PERKEMBANGAN</label>
                            <textarea
                                className="w-full p-2 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                rows={2}
                                value={localNotes}
                                onChange={e => setLocalNotes(e.target.value)}
                                placeholder="Update kendala atau hasil sementara..."
                            ></textarea>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 px-3 py-1.5 bg-slate-200 text-slate-600 rounded font-bold text-[10px] hover:bg-slate-300"
                            >Batal</button>
                            <button
                                onClick={() => {
                                    handleUpdateProgress(a.id, { progressPercentage: localProgress, notes: localNotes });
                                    setIsEditing(false);
                                }}
                                className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded font-bold text-[10px] hover:bg-blue-700 shadow-sm"
                            >Simpan Progres</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        {a.status === 'PENDING' && (isAssignee || canAssign) && (
                            <button
                                onClick={() => handleUpdateStatus(a.id, 'IN_PROGRESS')}
                                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                <Plus size={14} /> Mulai Kerjakan
                            </button>
                        )}
                        {a.status === 'IN_PROGRESS' && (isAssignee || canAssign) && (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex-1 bg-white text-blue-600 border border-blue-200 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-50 transition-all shadow-sm"
                                >
                                    Update Progres
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(a.id, 'COMPLETED')}
                                    className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
                                >
                                    Selesai
                                </button>
                            </>
                        )}
                        {a.status === 'COMPLETED' && (
                            <div className="w-full text-center py-2.5 text-[10px] text-green-600 font-bold bg-green-50 rounded-xl border border-green-100 italic flex items-center justify-center gap-1">
                                <CheckCircle2 size={12} /> Tugas telah diselesaikan
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonnelAssignments;
