import React, { useState, useEffect } from 'react';
import { Star, Send, Building2, CheckCircle2 } from 'lucide-react';
import api from '../lib/axios';

const EmoticonRating = ({ value, onChange }) => {
    const options = [
        { val: 1, emoji: '😡', label: 'Sangat Kurang' },
        { val: 2, emoji: '😞', label: 'Kurang' },
        { val: 3, emoji: '😐', label: 'Cukup' },
        { val: 4, emoji: '🙂', label: 'Baik' },
        { val: 5, emoji: '🤩', label: 'Sangat Baik' }
    ];

    return (
        <div className="flex justify-between sm:justify-start gap-2 sm:gap-6 w-full">
            {options.map((opt) => (
                <button
                    key={opt.val}
                    type="button"
                    onClick={() => onChange(opt.val)}
                    className={`flex flex-col items-center gap-2 p-2 sm:p-3 rounded-xl transition-all ${
                        value === opt.val 
                            ? 'bg-blue-50 border-2 border-blue-500 scale-110 shadow-sm' 
                            : 'bg-white border-2 border-slate-100 hover:border-blue-200 hover:bg-slate-50 grayscale hover:grayscale-0'
                    }`}
                >
                    <span className="text-3xl sm:text-4xl">{opt.emoji}</span>
                    <span className={`text-[9px] sm:text-[10px] font-bold text-center ${value === opt.val ? 'text-blue-600' : 'text-slate-400'}`}>
                        {opt.label}
                    </span>
                </button>
            ))}
        </div>
    );
};

const PublicSurvey = () => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [form, setForm] = useState({
        respondentName: '',
        respondentUnit: ''
    });
    
    // Answers state: { [questionId]: { ratingValue: null, textValue: '' } }
    const [answers, setAnswers] = useState({});

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const res = await api.get('/surveys/active-questions');
                setQuestions(res.data);
                
                // Init answers state
                const initialAnswers = {};
                res.data.forEach(q => {
                    initialAnswers[q.id] = { ratingValue: null, textValue: '' };
                });
                setAnswers(initialAnswers);
            } catch (err) {
                console.error(err);
                if (err.response?.status === 403) {
                    setError('Survey Kepuasan Pengguna saat ini sedang ditutup atau dinonaktifkan.');
                } else {
                    setError('Gagal memuat formulir survey. Silakan coba lagi nanti.');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchQuestions();
    }, []);

    const handleRatingChange = (qId, value) => {
        setAnswers(prev => ({
            ...prev,
            [qId]: { ...prev[qId], ratingValue: value }
        }));
    };

    const handleTextChange = (qId, text) => {
        setAnswers(prev => ({
            ...prev,
            [qId]: { ...prev[qId], textValue: text }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation for RATING questions
        const ratingQuestions = questions.filter(q => q.type === 'RATING');
        const uncompletedRatings = ratingQuestions.filter(q => answers[q.id]?.ratingValue === null);
        
        if (uncompletedRatings.length > 0) {
            alert('Mohon lengkapi semua penilaian (rating) sebelum mengirimkan survey.');
            return;
        }

        const payloadAnswers = questions.map(q => ({
            questionId: q.id,
            ratingValue: q.type === 'RATING' ? answers[q.id].ratingValue : null,
            textValue: q.type === 'TEXT' ? answers[q.id].textValue : null
        }));

        try {
            setIsSubmitting(true);
            await api.post('/surveys/submit', {
                respondentName: form.respondentName || 'Anonim',
                respondentUnit: form.respondentUnit || '-',
                answers: payloadAnswers
            });
            setIsSuccess(true);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || 'Gagal mengirim survey.');
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center animate-pulse">
                    <Building2 size={48} className="text-blue-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-500">Memuat Formulir Survey...</h2>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-red-500">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">📴</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Survey Ditutup</h2>
                    <p className="text-slate-500">{error}</p>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
                <div className="bg-white p-8 sm:p-12 rounded-3xl shadow-2xl max-w-lg w-full text-center animate-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={48} />
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-800 mb-3">Terima Kasih!</h2>
                    <p className="text-slate-500 mb-8 leading-relaxed">
                        Masukan dan penilaian Anda sangat berarti bagi kami untuk terus meningkatkan kualitas sarana, prasarana, dan pelayanan.
                    </p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                    >
                        Isi Survey Lagi
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto">
                
                {/* Header */}
                <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4">
                    <img src="/Sarpras.jpeg" alt="Logo" className="w-20 h-20 rounded-2xl shadow-md mx-auto mb-4 object-cover" />
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight mb-2">
                        Survey Kepuasan Pengguna
                    </h1>
                    <p className="text-slate-500">Bidang Sarana dan Prasarana - Yayasan Dar el-Iman</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-8 delay-150 fill-mode-both">
                    
                    {/* Identitas Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">1</span>
                            Data Diri (Opsional)
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Lengkap</label>
                                <input
                                    type="text"
                                    value={form.respondentName}
                                    onChange={e => setForm({ ...form, respondentName: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                    placeholder="Boleh dikosongkan (Anonim)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Unit Kerja / Asal</label>
                                <input
                                    type="text"
                                    value={form.respondentUnit}
                                    onChange={e => setForm({ ...form, respondentUnit: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                    placeholder="Contoh: SD IT, SMP IT, dll"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Questions Cards */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-10">
                        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">2</span>
                            Penilaian & Masukan
                        </h2>
                        
                        {questions.map((q, idx) => (
                            <div key={q.id} className="pt-6 border-t border-slate-100 first:border-0 first:pt-0">
                                <label className="block text-base sm:text-lg font-bold text-slate-800 mb-4">
                                    {idx + 1}. {q.text}
                                    {q.type === 'RATING' && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                
                                {q.type === 'RATING' ? (
                                    <div className="mt-2">
                                        <EmoticonRating 
                                            value={answers[q.id]?.ratingValue} 
                                            onChange={(val) => handleRatingChange(q.id, val)} 
                                        />
                                    </div>
                                ) : (
                                    <div className="mt-2">
                                        <textarea
                                            rows={4}
                                            value={answers[q.id]?.textValue}
                                            onChange={(e) => handleTextChange(q.id, e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all resize-none"
                                            placeholder="Tuliskan saran, kritik, atau masukan Anda di sini..."
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Submit Area */}
                    <div className="text-center pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 mx-auto transition-all shadow-xl shadow-blue-200 disabled:opacity-70"
                        >
                            <Send size={20} />
                            {isSubmitting ? 'Mengirim Data...' : 'Kirim Survey Kepuasan'}
                        </button>
                        <p className="mt-4 text-xs text-slate-400">
                            Data yang dikirimkan akan digunakan untuk evaluasi dan peningkatan mutu secara internal.
                        </p>
                    </div>
                    
                </form>
            </div>
        </div>
    );
};

export default PublicSurvey;
