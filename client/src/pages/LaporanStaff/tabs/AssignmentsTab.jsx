import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Send, User, Clock, CheckCircle, ExternalLink, Wrench } from 'lucide-react';
import dayjs from 'dayjs';
import { DIVISION_TAGS } from '../constants';

export default function AssignmentsTab({
    isKabid,
    user,
    assignments = [],
    staffList = [],
    showAssignmentForm,
    setShowAssignmentForm,
    assignmentForm,
    setAssignmentForm,
    handleCreateAssignment,
    handleUpdateTaskProgress,
    handlePurgeRoutine,
    routinePurged,
    saving,
    onImportTaskToReport
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {isKabid && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-base font-black text-slate-800">Manajemen Delegasi Penugasan</h3>
                            <p className="text-xs text-slate-400 font-medium">Berikan penugasan berbatas waktu kepada staf bidang sarana.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {!routinePurged && (
                                <button
                                    onClick={handlePurgeRoutine}
                                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    title="Hapus semua tugas rutin otomatis yang menumpuk di database (hanya 1 kali pakai)"
                                >
                                    <Trash2 size={14} /> Bersihkan Tugas Rutin Otomatis
                                </button>
                            )}
                            <button
                                onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                                {showAssignmentForm ? 'Tutup Form' : '+ Buat Penugasan Baru'}
                            </button>
                        </div>
                    </div>

                    {showAssignmentForm && (
                        <form onSubmit={handleCreateAssignment} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Judul Penugasan</label>
                                    <input 
                                        required 
                                        placeholder="Misal: Perbaikan AC Ruang Guru Gedung B"
                                        value={assignmentForm.title}
                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Ditugaskan Kepada</label>
                                    <select
                                        required
                                        value={assignmentForm.assigneeId}
                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, assigneeId: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Pilih Staf Sarana</option>
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.position || 'Staf'})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Kategori Divisi</label>
                                    <select
                                        value={assignmentForm.category}
                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, category: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                                    >
                                        {DIVISION_TAGS.map(d => (
                                            <option key={d.key} value={d.key}>{d.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Batas Waktu (Deadline)</label>
                                    <input 
                                        type="date"
                                        required
                                        value={assignmentForm.dueDate}
                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Rincian Instruksi</label>
                                    <textarea 
                                        rows="2"
                                        required
                                        placeholder="Instruksi spesifik pengerjaan..."
                                        value={assignmentForm.description}
                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <button 
                                type="submit" 
                                disabled={saving}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Send size={14} /> Kirim Penugasan
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Assignments List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignments.length === 0 ? (
                    <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 italic text-xs">
                        Belum ada daftar penugasan aktif.
                    </div>
                ) : (
                    assignments.map(task => {
                        let maintenanceMeta = null;
                        if (task.notes) {
                            try {
                                const parsed = JSON.parse(task.notes);
                                if (parsed.source === 'MAINTENANCE' || parsed.maintenanceId) {
                                    maintenanceMeta = parsed;
                                }
                            } catch (e) {
                                const match = task.notes.match(/"maintenanceId":\s*(\d+)/);
                                if (match) maintenanceMeta = { maintenanceId: match[1] };
                            }
                        }

                        return (
                            <div key={task.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                {task.category || 'UMUM'}
                                            </span>
                                            {maintenanceMeta && (
                                                <span className="text-[10px] font-black tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <Wrench size={10} /> Pemeliharaan {maintenanceMeta.maintenanceCode ? `#${maintenanceMeta.maintenanceCode}` : ''}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-800">{task.title}</h4>
                                        <p className="text-xs text-slate-500">{task.description}</p>
                                        {maintenanceMeta?.maintenanceId && (
                                            <div className="pt-0.5">
                                                <Link 
                                                    to={`/pemeliharaan/${maintenanceMeta.maintenanceId}`}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                                                >
                                                    <span>Buka Detail Tiket Pemeliharaan</span>
                                                    <ExternalLink size={11} />
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase shrink-0 ${
                                        task.progressPercentage === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {task.progressPercentage}%
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                                    <div className="flex items-center gap-1 font-bold">
                                        <User size={12} className="text-slate-400" /> {task.assignee?.name}
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px]">
                                        <Clock size={12} className="text-slate-400" /> Deadline: {dayjs(task.dueDate).format('DD MMM YYYY')}
                                    </div>
                                </div>

                                {/* Actions & Progress Slider */}
                                {(user.id === task.assigneeId || isKabid) && (
                                    <div className="space-y-2.5 pt-1 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                                            <span>Update Progres</span>
                                            <span className="text-slate-700 font-black">{task.progressPercentage}%</span>
                                        </div>
                                        <input 
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            value={task.progressPercentage}
                                            onChange={(e) => handleUpdateTaskProgress(task.id, e.target.value)}
                                            className="w-full accent-blue-600 cursor-pointer"
                                        />
                                        <div className="flex items-center gap-1.5">
                                            {[25, 50, 75, 100].map(pct => (
                                                <button
                                                    key={pct}
                                                    type="button"
                                                    onClick={() => handleUpdateTaskProgress(task.id, pct)}
                                                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer border ${
                                                        task.progressPercentage === pct 
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {pct === 100 ? '100% Selesai' : `${pct}%`}
                                                </button>
                                            ))}
                                        </div>

                                        {/* 1-Click Import Task into Daily Report */}
                                        {user.id === task.assigneeId && onImportTaskToReport && (
                                            <button
                                                type="button"
                                                onClick={() => onImportTaskToReport(task)}
                                                className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                                                title="Salin tugas ini ke dalam butir laporan harian hari ini"
                                            >
                                                <CheckCircle size={13} className="text-blue-600" />
                                                <span>Jadikan Butir Laporan Hari Ini</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
