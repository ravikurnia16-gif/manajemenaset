import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, MessageSquare, List, Star, Text } from 'lucide-react';
import api from '../lib/axios';
import Swal from 'sweetalert2';

const SurveyManager = () => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(null);
    const [editForm, setEditForm] = useState({ text: '', type: 'RATING', isActive: true });
    
    // New Question Form
    const [showNewForm, setShowNewForm] = useState(false);
    const [newQuestion, setNewQuestion] = useState({ text: '', type: 'RATING', isActive: true });

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/surveys/questions');
            setQuestions(res.data);
        } catch (error) {
            console.error("Fetch questions error:", error);
            Swal.fire('Error', 'Gagal memuat pertanyaan survey.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/surveys/questions', newQuestion);
            Swal.fire('Sukses', 'Pertanyaan berhasil ditambahkan', 'success');
            setNewQuestion({ text: '', type: 'RATING', isActive: true });
            setShowNewForm(false);
            fetchQuestions();
        } catch (error) {
            Swal.fire('Error', 'Gagal menambahkan pertanyaan.', 'error');
        }
    };

    const handleUpdate = async (id) => {
        try {
            await api.put(`/surveys/questions/${id}`, editForm);
            Swal.fire('Sukses', 'Pertanyaan berhasil diperbarui', 'success');
            setIsEditing(null);
            fetchQuestions();
        } catch (error) {
            Swal.fire('Error', 'Gagal memperbarui pertanyaan.', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin ingin menghapus pertanyaan ini? Seluruh jawaban untuk pertanyaan ini juga akan terhapus.')) return;
        try {
            await api.delete(`/surveys/questions/${id}`);
            Swal.fire('Dihapus', 'Pertanyaan berhasil dihapus', 'success');
            fetchQuestions();
        } catch (error) {
            Swal.fire('Error', 'Gagal menghapus pertanyaan.', 'error');
        }
    };

    const toggleActive = async (q) => {
        try {
            await api.put(`/surveys/questions/${q.id}`, { ...q, isActive: !q.isActive });
            fetchQuestions();
        } catch (error) {
            Swal.fire('Error', 'Gagal mengubah status aktif.', 'error');
        }
    };

    const startEdit = (q) => {
        setIsEditing(q.id);
        setEditForm({ text: q.text, type: q.type, isActive: q.isActive });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <MessageSquare className="text-blue-500" />
                        Rancang Survey Kepuasan
                    </h1>
                    <p className="text-slate-500 text-sm">Kelola daftar pertanyaan yang akan tampil di form survey publik.</p>
                </div>
                <button
                    onClick={() => setShowNewForm(!showNewForm)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
                >
                    {showNewForm ? <><X size={16} /> Batal</> : <><Plus size={16} /> Tambah Pertanyaan</>}
                </button>
            </div>

            {showNewForm && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in zoom-in-95">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Plus size={18} className="text-blue-500" /> Buat Pertanyaan Baru
                    </h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Teks Pertanyaan</label>
                            <input
                                type="text"
                                required
                                value={newQuestion.text}
                                onChange={e => setNewQuestion({ ...newQuestion, text: e.target.value })}
                                className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Contoh: Bagaimana kebersihan fasilitas yang kami sediakan?"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Jawaban</label>
                                <select
                                    value={newQuestion.type}
                                    onChange={e => setNewQuestion({ ...newQuestion, type: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    <option value="RATING">Rating (Skala 1-5 Bintang/Emoticon)</option>
                                    <option value="TEXT">Teks Bebas (Komentar / Saran)</option>
                                </select>
                            </div>
                            <div className="flex items-center pt-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newQuestion.isActive}
                                        onChange={e => setNewQuestion({ ...newQuestion, isActive: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Aktifkan Langsung</span>
                                </label>
                            </div>
                        </div>
                        <div className="pt-2">
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700">
                                Simpan Pertanyaan
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12 text-slate-500">Memuat pertanyaan...</div>
            ) : questions.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                    <List size={48} className="mx-auto text-slate-300 mb-3" />
                    <h3 className="text-lg font-bold text-slate-700">Belum ada pertanyaan</h3>
                    <p className="text-slate-500 text-sm mt-1">Silakan tambahkan pertanyaan baru untuk merancang survey Anda.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {questions.map((q, index) => (
                        <div key={q.id} className={`bg-white p-5 rounded-xl border ${q.isActive ? 'border-slate-200 shadow-sm' : 'border-slate-200 bg-slate-50 opacity-75'}`}>
                            {isEditing === q.id ? (
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        required
                                        value={editForm.text}
                                        onChange={e => setEditForm({ ...editForm, text: e.target.value })}
                                        className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                        <select
                                            value={editForm.type}
                                            onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                                            className="w-full sm:w-64 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                        >
                                            <option value="RATING">Rating (Skala 1-5 Bintang)</option>
                                            <option value="TEXT">Teks Bebas</option>
                                        </select>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button onClick={() => setIsEditing(null)} className="flex-1 sm:flex-none px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-medium">Batal</button>
                                            <button onClick={() => handleUpdate(q.id)} className="flex-1 sm:flex-none px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">Simpan</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">{index + 1}</span>
                                            <h4 className={`text-base font-bold ${q.isActive ? 'text-slate-800' : 'text-slate-500 line-through decoration-slate-300'}`}>{q.text}</h4>
                                        </div>
                                        <div className="flex items-center gap-3 pl-9">
                                            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">
                                                {q.type === 'RATING' ? <Star size={12} className="text-orange-400" /> : <Text size={12} className="text-blue-400" />}
                                                {q.type}
                                            </span>
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase ${q.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {q.isActive ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pl-9 md:pl-0">
                                        <button 
                                            onClick={() => toggleActive(q)}
                                            className={`p-2 rounded-lg text-sm font-medium transition-colors ${q.isActive ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                            title={q.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                        >
                                            {q.isActive ? <X size={16} /> : <Check size={16} />}
                                        </button>
                                        <button 
                                            onClick={() => startEdit(q)}
                                            className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(q.id)}
                                            className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                            title="Hapus"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SurveyManager;
