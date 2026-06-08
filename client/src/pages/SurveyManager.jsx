import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, MessageSquare, List, Star, Text, Copy, ArrowLeft, Calendar } from 'lucide-react';
import api from '../lib/axios';
import Swal from 'sweetalert2';

const SurveyManager = () => {
    // Top Level State
    const [surveys, setSurveys] = useState([]);
    const [loadingSurveys, setLoadingSurveys] = useState(true);
    const [selectedSurvey, setSelectedSurvey] = useState(null);

    // Survey Form State
    const [showNewSurveyForm, setShowNewSurveyForm] = useState(false);
    const [editingSurveyId, setEditingSurveyId] = useState(null);
    const [surveyForm, setSurveyForm] = useState({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        isActive: false
    });

    // Questions State (when a survey is selected)
    const [questions, setQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [showNewQuestionForm, setShowNewQuestionForm] = useState(false);
    const [editingQuestionId, setEditingQuestionId] = useState(null);
    const [questionForm, setQuestionForm] = useState({ text: '', type: 'RATING', isActive: true, order: 0 });

    useEffect(() => {
        fetchSurveys();
    }, []);

    const fetchSurveys = async () => {
        try {
            setLoadingSurveys(true);
            const res = await api.get('/surveys');
            setSurveys(res.data);
        } catch (error) {
            Swal.fire('Error', 'Gagal memuat paket survey.', 'error');
        } finally {
            setLoadingSurveys(false);
        }
    };

    // --- SURVEY ACTIONS ---
    const handleSurveySubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSurveyId) {
                await api.put(`/surveys/${editingSurveyId}`, surveyForm);
                Swal.fire('Sukses', 'Survey berhasil diperbarui', 'success');
            } else {
                await api.post('/surveys', surveyForm);
                Swal.fire('Sukses', 'Survey baru berhasil dibuat', 'success');
            }
            setShowNewSurveyForm(false);
            setEditingSurveyId(null);
            fetchSurveys();
        } catch (error) {
            Swal.fire('Error', 'Gagal menyimpan survey.', 'error');
        }
    };

    const handleSurveyDelete = async (id) => {
        if (!window.confirm('Yakin ingin menghapus paket survey ini beserta semua pertanyaannya?')) return;
        try {
            await api.delete(`/surveys/${id}`);
            fetchSurveys();
        } catch (error) {
            Swal.fire('Error', 'Gagal menghapus survey.', 'error');
        }
    };

    const handleSurveyDuplicate = async (id) => {
        try {
            await api.post(`/surveys/${id}/duplicate`);
            Swal.fire('Sukses', 'Survey berhasil diduplikat', 'success');
            fetchSurveys();
        } catch (error) {
            Swal.fire('Error', 'Gagal menduplikat survey.', 'error');
        }
    };

    const toggleSurveyActive = async (s) => {
        try {
            await api.put(`/surveys/${s.id}`, { ...s, isActive: !s.isActive });
            fetchSurveys();
        } catch (error) {
            Swal.fire('Error', 'Gagal mengubah status survey.', 'error');
        }
    };

    const openSurveyForm = (s = null) => {
        if (s) {
            setEditingSurveyId(s.id);
            setSurveyForm({
                title: s.title,
                description: s.description || '',
                startDate: s.startDate ? s.startDate.split('T')[0] : '',
                endDate: s.endDate ? s.endDate.split('T')[0] : '',
                isActive: s.isActive
            });
        } else {
            setEditingSurveyId(null);
            setSurveyForm({ title: '', description: '', startDate: '', endDate: '', isActive: false });
        }
        setShowNewSurveyForm(true);
    };

    // --- QUESTION ACTIONS ---
    const openQuestions = async (survey) => {
        setSelectedSurvey(survey);
        fetchQuestions(survey.id);
    };

    const fetchQuestions = async (surveyId) => {
        try {
            setLoadingQuestions(true);
            const res = await api.get(`/surveys/${surveyId}/questions`);
            setQuestions(res.data);
        } catch (error) {
            Swal.fire('Error', 'Gagal memuat pertanyaan.', 'error');
        } finally {
            setLoadingQuestions(false);
        }
    };

    const handleQuestionSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingQuestionId) {
                await api.put(`/surveys/questions/${editingQuestionId}`, questionForm);
                Swal.fire('Sukses', 'Pertanyaan diperbarui', 'success');
            } else {
                await api.post('/surveys/questions', { ...questionForm, surveyId: selectedSurvey.id });
                Swal.fire('Sukses', 'Pertanyaan ditambahkan', 'success');
            }
            setShowNewQuestionForm(false);
            setEditingQuestionId(null);
            fetchQuestions(selectedSurvey.id);
        } catch (error) {
            Swal.fire('Error', 'Gagal menyimpan pertanyaan.', 'error');
        }
    };

    const handleQuestionDelete = async (id) => {
        if (!window.confirm('Yakin hapus pertanyaan ini?')) return;
        try {
            await api.delete(`/surveys/questions/${id}`);
            fetchQuestions(selectedSurvey.id);
        } catch (error) {
            Swal.fire('Error', 'Gagal menghapus pertanyaan.', 'error');
        }
    };

    const toggleQuestionActive = async (q) => {
        try {
            await api.put(`/surveys/questions/${q.id}`, { ...q, isActive: !q.isActive });
            fetchQuestions(selectedSurvey.id);
        } catch (error) {
            Swal.fire('Error', 'Gagal mengubah status pertanyaan.', 'error');
        }
    };

    const openQuestionForm = (q = null) => {
        if (q) {
            setEditingQuestionId(q.id);
            setQuestionForm({ text: q.text, type: q.type, isActive: q.isActive, order: q.order });
        } else {
            setEditingQuestionId(null);
            setQuestionForm({ text: '', type: 'RATING', isActive: true, order: 0 });
        }
        setShowNewQuestionForm(true);
    };

    // --- RENDER VIEWS ---

    if (selectedSurvey) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
                <button 
                    onClick={() => { setSelectedSurvey(null); fetchSurveys(); }}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors"
                >
                    <ArrowLeft size={16} /> Kembali ke Daftar Survey
                </button>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <MessageSquare className="text-blue-500" />
                            Kelola Pertanyaan
                        </h1>
                        <p className="text-slate-500 text-sm">Paket Survey: <span className="font-bold">{selectedSurvey.title}</span></p>
                    </div>
                    <button
                        onClick={() => openQuestionForm()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-md"
                    >
                        <Plus size={16} /> Tambah Pertanyaan
                    </button>
                </div>

                {showNewQuestionForm && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4">{editingQuestionId ? 'Edit Pertanyaan' : 'Buat Pertanyaan Baru'}</h3>
                        <form onSubmit={handleQuestionSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Teks Pertanyaan</label>
                                <input
                                    type="text" required
                                    value={questionForm.text}
                                    onChange={e => setQuestionForm({ ...questionForm, text: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipe Jawaban</label>
                                    <select
                                        value={questionForm.type}
                                        onChange={e => setQuestionForm({ ...questionForm, type: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none"
                                    >
                                        <option value="RATING">Rating (Bintang)</option>
                                        <option value="TEXT">Teks Bebas</option>
                                    </select>
                                </div>
                                <div className="flex items-center pt-6 gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={questionForm.isActive}
                                            onChange={e => setQuestionForm({ ...questionForm, isActive: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Aktif</span>
                                    </label>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">Simpan</button>
                                <button type="button" onClick={() => setShowNewQuestionForm(false)} className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-300">Batal</button>
                            </div>
                        </form>
                    </div>
                )}

                {loadingQuestions ? (
                    <div className="text-center py-8 text-slate-500">Memuat...</div>
                ) : questions.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                        <List size={48} className="mx-auto text-slate-300 mb-3" />
                        <h3 className="text-lg font-bold text-slate-700">Belum ada pertanyaan</h3>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {questions.map((q, index) => (
                            <div key={q.id} className={`bg-white p-5 rounded-xl border ${q.isActive ? 'border-slate-200' : 'bg-slate-50 opacity-75'}`}>
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
                                    <div className="flex gap-2">
                                        <button onClick={() => toggleQuestionActive(q)} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
                                            {q.isActive ? <X size={16} /> : <Check size={16} />}
                                        </button>
                                        <button onClick={() => openQuestionForm(q)} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"><Edit2 size={16} /></button>
                                        <button onClick={() => handleQuestionDelete(q.id)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <List className="text-blue-500" />
                        Manajemen Paket Survey
                    </h1>
                    <p className="text-slate-500 text-sm">Kelola daftar paket survey untuk disebarkan ke publik.</p>
                </div>
                <button
                    onClick={() => openSurveyForm()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-md"
                >
                    <Plus size={16} /> Buat Paket Baru
                </button>
            </div>

            {showNewSurveyForm && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4">{editingSurveyId ? 'Edit Paket Survey' : 'Buat Paket Survey Baru'}</h3>
                    <form onSubmit={handleSurveySubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Judul Survey</label>
                            <input
                                type="text" required
                                value={surveyForm.title}
                                onChange={e => setSurveyForm({ ...surveyForm, title: e.target.value })}
                                className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none"
                                placeholder="Contoh: Survey Kepuasan Fasilitas Q1 2026"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi Singkat</label>
                            <textarea
                                value={surveyForm.description}
                                onChange={e => setSurveyForm({ ...surveyForm, description: e.target.value })}
                                className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none resize-none"
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai (Opsional)</label>
                                <input
                                    type="date"
                                    value={surveyForm.startDate}
                                    onChange={e => setSurveyForm({ ...surveyForm, startDate: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai (Opsional)</label>
                                <input
                                    type="date"
                                    value={surveyForm.endDate}
                                    onChange={e => setSurveyForm({ ...surveyForm, endDate: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex items-center pt-2 gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                id="activeSurvey"
                                checked={surveyForm.isActive}
                                onChange={e => setSurveyForm({ ...surveyForm, isActive: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300"
                            />
                            <label htmlFor="activeSurvey" className="text-sm font-medium text-slate-700">Langsung Aktifkan Survey Ini</label>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">Simpan Survey</button>
                            <button type="button" onClick={() => setShowNewSurveyForm(false)} className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-300">Batal</button>
                        </div>
                    </form>
                </div>
            )}

            {loadingSurveys ? (
                <div className="text-center py-12 text-slate-500">Memuat paket survey...</div>
            ) : surveys.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                    <List size={48} className="mx-auto text-slate-300 mb-3" />
                    <h3 className="text-lg font-bold text-slate-700">Belum ada paket survey</h3>
                    <p className="text-slate-500 text-sm mt-1">Buat paket survey pertama Anda untuk disebarkan.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {surveys.map(s => (
                        <div key={s.id} className={`bg-white rounded-xl border p-5 shadow-sm ${s.isActive ? 'border-blue-200 ring-1 ring-blue-50' : 'border-slate-200'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">{s.title}</h3>
                                    <p className="text-sm text-slate-500 line-clamp-1">{s.description || 'Tidak ada deskripsi'}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {s.isActive ? 'Aktif' : 'Nonaktif'}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded-lg">
                                <span className="flex items-center gap-1"><Calendar size={14}/> {s.startDate ? new Date(s.startDate).toLocaleDateString('id-ID') : '∞'} - {s.endDate ? new Date(s.endDate).toLocaleDateString('id-ID') : '∞'}</span>
                                <span className="flex items-center gap-1"><List size={14}/> {s._count?.questions || 0} Pertanyaan</span>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-auto">
                                <button onClick={() => openQuestions(s)} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-semibold py-2 px-3 rounded-lg text-center transition-colors">
                                    Kelola Pertanyaan
                                </button>
                                <button onClick={() => toggleSurveyActive(s)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg" title="Toggle Aktif">
                                    {s.isActive ? <X size={16}/> : <Check size={16}/>}
                                </button>
                                <button onClick={() => handleSurveyDuplicate(s.id)} className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg" title="Duplikat Survey">
                                    <Copy size={16}/>
                                </button>
                                <button onClick={() => openSurveyForm(s)} className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg" title="Edit Survey">
                                    <Edit2 size={16}/>
                                </button>
                                <button onClick={() => handleSurveyDelete(s.id)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg" title="Hapus">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SurveyManager;
