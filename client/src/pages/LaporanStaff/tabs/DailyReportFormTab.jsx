import React from 'react';
import { 
    Calendar, CheckCircle2, AlertCircle, CheckSquare, ChevronDown, 
    Plus, X, RotateCcw, Edit2, Trash2, Layers, Clock, AlertTriangle, 
    Camera, Loader2, Save 
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { getMediaUrl } from '../../../lib/media';
import { DIVISION_TAGS, ROUTINE_TEMPLATES } from '../constants';

dayjs.locale('id');

const DailyReportFormTab = ({
    user,
    userDivision,
    selectedDate,
    setSelectedDate,
    morningPoints,
    setMorningPoints,
    afternoonPoints,
    setAfternoonPoints,
    personalStats,
    saving,
    handleSaveReport,
    uploadingPhotoIndex,
    setCameraModalConfig,
    handlePhotoUpload,
    handleRemovePhoto,
    setLightboxPhoto,
    // Templates management
    staffCustomTemplates,
    saveStaffTemplates,
    handleResetToDefaultTemplates,
    newTemplateText,
    setNewTemplateText,
    newTemplateCategory,
    setNewTemplateCategory,
    isAddingTemplate,
    setIsAddingTemplate,
    handleAddCustomTemplate,
    editingTemplateId,
    setEditingTemplateId,
    editingTemplateText,
    setEditingTemplateText,
    handleSaveEditTemplate,
    handleDeleteCustomTemplate,
    // Accordion toggles
    showTemplateAccordion,
    setShowTemplateAccordion,
    showAllTemplates,
    setShowAllTemplates,
    showMissedDates,
    setShowMissedDates,
    mobileSessionTab,
    setMobileSessionTab,
    // Routine & assignments
    assignments = [],
    convertTaskToReport,
    applyRoutine
}) => {
    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
            {/* Personal Scorecard Banner - Compact on Mobile */}
            {personalStats && (
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                    <div className="space-y-1">
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-200">Kartu Skor Kinerja Personal</span>
                        <h3 className="text-base sm:text-lg font-black leading-tight">{user.name} ({user.position || 'Staff Manajemen Aset'})</h3>
                        {personalStats.latestFeedback && (
                            <div className="mt-1.5 bg-white/10 backdrop-blur-sm p-2 sm:p-2.5 rounded-xl text-xs text-white/90 border border-white/20">
                                💬 <b>Catatan Kabid ({personalStats.latestFeedback.date}):</b> "{personalStats.latestFeedback.note}"
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-6 shrink-0 bg-white/10 backdrop-blur-md p-2.5 sm:px-5 sm:py-3 rounded-2xl border border-white/20 text-center sm:text-left">
                        <div>
                            <span className="text-[9px] sm:text-[10px] font-bold text-blue-200 block">Kedisiplinan Bulan Ini</span>
                            <span className="text-xl sm:text-2xl font-black text-white">{personalStats.disciplineScore}%</span>
                        </div>
                        <div className="border-l border-white/20 pl-3 sm:pl-6">
                            <span className="text-[9px] sm:text-[10px] font-bold text-blue-200 block">Hari Lengkap</span>
                            <span className="text-xl sm:text-2xl font-black text-white">{personalStats.completedDays} / {personalStats.totalWorkDaysPassed || 0} Hari</span>
                        </div>
                    </div>
                </div>
            )}

            {/* BANNER MODE LAPORAN SUSULAN (WIB) */}
            {selectedDate !== dayjs().format('YYYY-MM-DD') && (
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold shrink-0">
                            <Calendar size={18} />
                        </div>
                        <div>
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-100 block">Mode Pengisian Susulan (WIB)</span>
                            <h4 className="text-xs sm:text-sm font-black">
                                Mengisi Laporan untuk: {dayjs(selectedDate).format('dddd, DD MMMM YYYY')}
                            </h4>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSelectedDate(dayjs().format('YYYY-MM-DD'))}
                        className="text-[11px] font-bold bg-white text-orange-800 hover:bg-orange-50 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
                    >
                        Kembali ke Hari Ini
                    </button>
                </div>
            )}

            {/* RANGKUMAN TANGGAL BELUM LAPOR (SENIN - JUMAT) */}
            {personalStats?.missedDates && personalStats.missedDates.length > 0 ? (
                <div className="bg-amber-50 border border-amber-300 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl space-y-2.5 sm:space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                                <AlertCircle size={16} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wider truncate">
                                    {personalStats.missedDates.length} Hari Belum Lengkap
                                </h4>
                                <p className="text-[10px] sm:text-[11px] text-amber-800 font-medium truncate sm:whitespace-normal">
                                    Ketuk tanggal untuk mengisi susulan laporan harian.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowMissedDates(!showMissedDates)}
                            className="text-[10px] sm:text-[11px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-2.5 py-1 rounded-xl transition-all shrink-0 cursor-pointer"
                        >
                            {showMissedDates ? 'Ciutkan' : 'Lihat Semua'}
                        </button>
                    </div>

                    {/* Compact Horizontal Scroll on Mobile when Collapsed */}
                    {!showMissedDates ? (
                        <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 custom-scrollbar">
                            {personalStats.missedDates.map((mItem, idx) => {
                                const isSelected = selectedDate === mItem.date;
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setSelectedDate(mItem.date)}
                                        className={`px-3 py-1.5 rounded-xl border text-left shrink-0 transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                : 'bg-white hover:bg-amber-100/70 border-amber-200 text-slate-800'
                                        }`}
                                    >
                                        <span className="text-[11px] font-black block leading-tight">{mItem.formattedDate}</span>
                                        <span className={`text-[9px] font-bold block ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                            {mItem.hasMorning ? 'Pagi ✅' : 'Pagi ❌'} | {mItem.hasAfternoon ? 'Siang ✅' : 'Siang ❌'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                            {personalStats.missedDates.map((mItem, idx) => {
                                const isSelected = selectedDate === mItem.date;
                                return (
                                    <div 
                                        key={idx}
                                        onClick={() => setSelectedDate(mItem.date)}
                                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 group ${
                                            isSelected
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400'
                                                : 'bg-white hover:bg-amber-100/60 border-amber-200 text-slate-800 shadow-2xs'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-1">
                                            <div>
                                                <span className="text-xs font-black block leading-tight">
                                                    {mItem.formattedDate}
                                                </span>
                                                <span className={`text-[10px] font-medium ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                                    {mItem.isToday ? 'Hari Kerja Ini' : 'Hari Kerja'}
                                                </span>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0 ${
                                                isSelected 
                                                    ? 'bg-white text-blue-700' 
                                                    : (mItem.status === 'BELUM' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800')
                                            }`}>
                                                {mItem.status === 'BELUM' ? 'Belum Diisi' : 'Parsial'}
                                            </span>
                                        </div>

                                        <div className={`flex items-center justify-between text-[11px] pt-1.5 border-t ${
                                            isSelected ? 'border-blue-500' : 'border-slate-100'
                                        }`}>
                                            <span className={`font-medium ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                                {mItem.hasMorning ? 'Pagi ✅' : 'Pagi ❌'} | {mItem.hasAfternoon ? 'Siang ✅' : 'Siang ❌'}
                                            </span>
                                            <span className={`font-bold flex items-center gap-1 ${
                                                isSelected ? 'text-white underline' : 'text-blue-600 group-hover:text-blue-800'
                                            }`}>
                                                {isSelected ? 'Sedang Dipilih' : '✍️ Isi Laporan'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 sm:p-4 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-bold shadow-2xs">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>Alhamdulillah! Seluruh laporan hari kerja Anda (Senin s.d. Jumat) bulan ini telah terisi lengkap.</span>
                </div>
            )}

            {/* ROUTINE CHECKLIST & TASK CONVERTER SECTION (Collapsible for Mobile Convenience) */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <div 
                    onClick={() => setShowTemplateAccordion(!showTemplateAccordion)}
                    className="flex items-center justify-between cursor-pointer select-none"
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                            <CheckSquare size={18} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Template Rutinitas & Penugasan
                                </h3>
                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                    {DIVISION_TAGS.find(d => d.key === userDivision)?.label || userDivision}
                                </span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                                {showTemplateAccordion ? 'Klik untuk menutup daftar template' : 'Klik untuk menyalin kegiatan rutin otomatis ke sesi Pagi/Siang'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all shrink-0 cursor-pointer"
                    >
                        <ChevronDown size={18} className={`transition-transform duration-200 ${showTemplateAccordion ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {showTemplateAccordion && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-slate-100 animate-in fade-in duration-200">
                        {/* Daily Routine Checklist - Personalized per staff */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>Template Rutinitas Mandiri</span>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                            {staffCustomTemplates.length} Kegiatan
                                        </span>
                                    </h4>
                                    <p className="text-[10px] text-slate-400">Disusun oleh Anda sendiri sesuai tugas riil di lapangan</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingTemplate(!isAddingTemplate)}
                                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                            isAddingTemplate 
                                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                        }`}
                                    >
                                        {isAddingTemplate ? <X size={12} /> : <Plus size={12} />}
                                        {isAddingTemplate ? 'Batal' : '+ Susun Template'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResetToDefaultTemplates}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-lg transition-all cursor-pointer"
                                        title="Kosongkan daftar template"
                                    >
                                        <RotateCcw size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* Inline Add Template Form */}
                            {isAddingTemplate && (
                                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2.5 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Tambah Butir Kegiatan Rutin Baru</span>
                                        <span className="text-[9px] text-emerald-600">Akan tersimpan di akun Anda</span>
                                    </div>
                                    <textarea
                                        value={newTemplateText}
                                        onChange={(e) => setNewTemplateText(e.target.value)}
                                        placeholder="Tuliskan kegiatan rutin harian Anda di sini..."
                                        rows={2}
                                        className="w-full text-xs p-2.5 bg-white border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 resize-none"
                                        autoFocus
                                    />
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <select
                                            value={newTemplateCategory}
                                            onChange={(e) => setNewTemplateCategory(e.target.value)}
                                            className="text-xs py-1 px-2.5 bg-white border border-emerald-200 rounded-lg text-slate-700 font-semibold focus:outline-none"
                                        >
                                            <option value="ASET">Divisi Manajemen Aset</option>
                                            <option value="GUDANG">Divisi Gudang & Logistik</option>
                                            <option value="TEKNISI">Divisi Teknisi & Perbaikan</option>
                                            <option value="KENDARAAN">Divisi Kendaraan</option>
                                            <option value="KEUANGAN">Divisi Keuangan & Admin</option>
                                            <option value="UMUM">Operasional Umum</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleAddCustomTemplate}
                                            disabled={!newTemplateText.trim()}
                                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs"
                                        >
                                            Simpan Template
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Custom Template Items List */}
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                {staffCustomTemplates.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        Belum ada template kegiatan mandiri. Klik <strong>"+ Susun Template"</strong> untuk menambahkan rutinitas kerja Anda.
                                    </div>
                                ) : (
                                    staffCustomTemplates.map((tpl, rIdx) => {
                                        const isEditing = editingTemplateId === tpl.id;
                                        return (
                                            <div 
                                                key={tpl.id || rIdx}
                                                className="p-2.5 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl text-xs font-medium text-slate-700 space-y-2 shadow-2xs transition-all"
                                            >
                                                {isEditing ? (
                                                    <div className="space-y-2">
                                                        <textarea
                                                            value={editingTemplateText}
                                                            onChange={(e) => setEditingTemplateText(e.target.value)}
                                                            rows={2}
                                                            className="w-full text-xs p-2 bg-slate-50 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 resize-none"
                                                            autoFocus
                                                        />
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingTemplateId(null)}
                                                                className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                                                            >
                                                                Batal
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveEditTemplate(tpl.id)}
                                                                className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-all cursor-pointer"
                                                            >
                                                                Simpan
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                                                                tpl.categoryTag === 'GUDANG' ? 'bg-amber-100 text-amber-800' :
                                                                tpl.categoryTag === 'TEKNISI' ? 'bg-emerald-100 text-emerald-800' :
                                                                tpl.categoryTag === 'KENDARAAN' ? 'bg-indigo-100 text-indigo-800' :
                                                                tpl.categoryTag === 'KEUANGAN' ? 'bg-violet-100 text-violet-800' :
                                                                tpl.categoryTag === 'ASET' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-slate-100 text-slate-700'
                                                            }`}>
                                                                {tpl.categoryTag || 'UMUM'}
                                                            </span>
                                                            <span className="text-slate-700 text-xs leading-relaxed break-words">{tpl.text}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                                            <button
                                                                type="button"
                                                                onClick={() => applyRoutine(tpl.text, tpl.categoryTag || 'UMUM', 'morning')}
                                                                className="px-2 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer active:scale-95"
                                                                title="Tambahkan ke Sesi Pagi"
                                                            >
                                                                + Pagi
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => applyRoutine(tpl.text, tpl.categoryTag || 'UMUM', 'afternoon')}
                                                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer active:scale-95"
                                                                title="Tambahkan ke Sesi Siang"
                                                            >
                                                                + Siang
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setEditingTemplateId(tpl.id); setEditingTemplateText(tpl.text); }}
                                                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all cursor-pointer"
                                                                title="Edit butir template"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteCustomTemplate(tpl.id)}
                                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                                                title="Hapus template"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Optional Reference Accordion from other divisions */}
                            {Object.values(ROUTINE_TEMPLATES).some(arr => arr.length > 0) && (
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowAllTemplates(!showAllTemplates)}
                                        className="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                        <ChevronDown size={13} className={`transition-transform duration-200 ${showAllTemplates ? 'rotate-180' : ''}`} />
                                        {showAllTemplates ? 'Sembunyikan Referensi Divisi Lain' : '💡 Butuh Ide? Lihat Referensi Template Divisi Lain'}
                                    </button>
                                    {showAllTemplates && (
                                        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar p-2 bg-slate-50 rounded-xl border border-slate-200/60 animate-in fade-in duration-200">
                                            {Object.entries(ROUTINE_TEMPLATES).map(([catKey, routines]) => (
                                                <div key={catKey} className="space-y-1">
                                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                                                        {DIVISION_TAGS.find(d => d.key === catKey)?.label || catKey}
                                                    </span>
                                                    {routines.map((rText, rIdx) => (
                                                        <div key={rIdx} className="p-1.5 bg-white rounded-lg border border-slate-200/60 text-[11px] flex items-center justify-between gap-1.5">
                                                            <span className="flex-1 text-slate-600 truncate">{rText}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newTpl = {
                                                                        id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                                                                        text: rText,
                                                                        categoryTag: catKey
                                                                    };
                                                                    saveStaffTemplates([...staffCustomTemplates, newTpl]);
                                                                }}
                                                                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded cursor-pointer whitespace-nowrap"
                                                                title="Salin butir ini ke Template Saya"
                                                            >
                                                                + Salin
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Active Assigned Tasks Converter */}
                        <div className="space-y-2.5">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers size={14} className="text-blue-600" /> Penugasan Khusus dari Pimpinan
                            </h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {assignments.filter(t => t.assigneeId === user.id && t.progressPercentage < 100).length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        Tidak ada penugasan khusus aktif yang tertunda untuk Anda.
                                    </div>
                                ) : (
                                    assignments.filter(t => t.assigneeId === user.id && t.progressPercentage < 100).map(t => (
                                        <div key={t.id} className="p-3 bg-slate-50 border border-slate-200/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                                            <div>
                                                <h5 className="text-xs font-bold text-slate-800">{t.title}</h5>
                                                <p className="text-[10px] text-slate-500 line-clamp-1">{t.description}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => convertTaskToReport(t, 'morning')}
                                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                                                >
                                                    + Pagi
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => convertTaskToReport(t, 'afternoon')}
                                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                                                >
                                                    + Siang
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MOBILE SESSION SWITCHER (Visible on Mobile Only) */}
            <div className="flex sm:hidden items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                    type="button"
                    onClick={() => setMobileSessionTab('ALL')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        mobileSessionTab === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                >
                    Semua
                </button>
                <button
                    type="button"
                    onClick={() => setMobileSessionTab('MORNING')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        mobileSessionTab === 'MORNING' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                >
                    🌅 Pagi ({morningPoints.length})
                </button>
                <button
                    type="button"
                    onClick={() => setMobileSessionTab('AFTERNOON')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        mobileSessionTab === 'AFTERNOON' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                >
                    🌇 Siang ({afternoonPoints.length})
                </button>
            </div>

            {/* SESI INPUT FORM: Sesi Pagi & Sesi Siang */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Sesi Pagi */}
                <div className={`bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between ${
                    mobileSessionTab === 'AFTERNOON' ? 'hidden sm:flex' : 'flex'
                }`}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock size={16} className="text-blue-600" /> Sesi Pagi (07.15 - 12.00 WIB)
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Batas pengingat: 13.30 WIB</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setMorningPoints([...morningPoints, { text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }])}
                                    className="px-2.5 sm:px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                >
                                    <Plus size={14} /> <span className="hidden sm:inline">Tambah Kegiatan</span><span className="sm:hidden">+ Butir</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveReport('morning')}
                                    disabled={saving}
                                    className="px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50"
                                    title="Simpan Laporan Sesi Pagi"
                                >
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    <span>Simpan</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {morningPoints.map((point, index) => (
                                <div key={`m-${index}`} className="p-3.5 sm:p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                                    {/* Row 1: Number + Division Dropdown + Delete */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="w-7 h-7 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs">
                                                {index + 1}
                                            </span>
                                            <select
                                                value={point.categoryTag}
                                                onChange={(e) => {
                                                    const n = [...morningPoints];
                                                    n[index].categoryTag = e.target.value;
                                                    setMorningPoints(n);
                                                }}
                                                className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none truncate"
                                            >
                                                {DIVISION_TAGS.map(d => (
                                                    <option key={d.key} value={d.key}>{d.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {morningPoints.length > 1 && (
                                            <button 
                                                type="button"
                                                onClick={() => setMorningPoints(morningPoints.filter((_, i) => i !== index))}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
                                                title="Hapus butir ini"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Feedback / Arahan dari Kabid jika ada */}
                                    {point.review && (
                                        <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                                            point.review.status === 'APPROVED' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900' :
                                            point.review.status === 'REVISION' ? 'bg-amber-50/90 border-amber-200 text-amber-900' :
                                            'bg-blue-50/90 border-blue-200 text-blue-900'
                                        }`}>
                                            <div className="flex items-center justify-between font-bold text-[11px]">
                                                <span className="flex items-center gap-1.5">
                                                    {point.review.status === 'APPROVED' ? '✅ Disetujui Pimpinan' :
                                                     point.review.status === 'REVISION' ? '⚠️ Perlu Perbaikan (Arahan Kabid)' : '💡 Catatan Arahan Pimpinan'}
                                                </span>
                                                <span className="text-[10px] opacity-75 font-normal">
                                                    oleh {point.review.reviewerName || 'Kabid Sarana'} • {dayjs(point.review.reviewedAt).format('DD/MM HH:mm')}
                                                </span>
                                            </div>
                                            {point.review.feedbackNote && (
                                                <p className="text-xs font-semibold italic pl-1 leading-relaxed bg-white/70 p-2 rounded-lg border border-slate-200/60">
                                                    "{point.review.feedbackNote}"
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Row 2: Touch-Friendly Status Pills */}
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const n = [...morningPoints];
                                                n[index].status = 'COMPLETED';
                                                setMorningPoints(n);
                                            }}
                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                point.status === 'COMPLETED' 
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <CheckCircle2 size={12} /> Selesai 100%
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const n = [...morningPoints];
                                                n[index].status = 'IN_PROGRESS';
                                                setMorningPoints(n);
                                            }}
                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                point.status === 'IN_PROGRESS' 
                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <Clock size={12} /> Proses
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const n = [...morningPoints];
                                                n[index].status = 'OBSTACLE';
                                                setMorningPoints(n);
                                            }}
                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                point.status === 'OBSTACLE' 
                                                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <AlertTriangle size={12} /> Kendala ⚠️
                                        </button>
                                    </div>

                                    {/* Activity Description */}
                                    <textarea
                                        rows="3"
                                        placeholder="Uraikan aktivitas kerja pagi yang dikerjakan secara jelas..."
                                        value={point.text}
                                        onChange={(e) => {
                                            const n = [...morningPoints];
                                            n[index].text = e.target.value;
                                            setMorningPoints(n);
                                        }}
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                                    />

                                    {/* Obstacle Note Field */}
                                    {point.status === 'OBSTACLE' && (
                                        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
                                            <AlertCircle size={14} className="text-rose-600 shrink-0" />
                                            <input 
                                                type="text"
                                                placeholder="Jelaskan kendala/masalah yang dihadapi..."
                                                value={point.obstacleNote}
                                                onChange={(e) => {
                                                    const n = [...morningPoints];
                                                    n[index].obstacleNote = e.target.value;
                                                    setMorningPoints(n);
                                                }}
                                                className="w-full bg-transparent text-xs font-bold text-rose-800 outline-none placeholder:text-rose-400"
                                            />
                                        </div>
                                    )}

                                    {/* Mobile-Friendly Photo Upload Zone (Opsional) */}
                                    <div className="space-y-2 pt-1 border-t border-slate-200/60">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Camera size={13} className="text-blue-600" />
                                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                                    Foto Bukti Lapangan
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                                                    (Opsional)
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-medium text-slate-400">
                                                {(point.photos || []).length}/5 Foto
                                            </span>
                                        </div>

                                        {/* Dual Upload Options: Direct Camera vs Gallery */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={uploadingPhotoIndex !== null}
                                                onClick={() => setCameraModalConfig({ isOpen: true, index, period: 'morning' })}
                                                className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold text-blue-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer disabled:opacity-50"
                                            >
                                                {uploadingPhotoIndex === `morning-${index}` ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                                                <span>{uploadingPhotoIndex === `morning-${index}` ? 'Mengunggah...' : 'Buka Kamera'}</span>
                                            </button>

                                            <label className="cursor-pointer py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs">
                                                <Plus size={14} />
                                                <span>Pilih Galeri</span>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="hidden" 
                                                    disabled={uploadingPhotoIndex !== null}
                                                    onChange={(e) => {
                                                        if (e.target.files[0]) {
                                                            handlePhotoUpload(index, e.target.files[0], 'morning');
                                                            e.target.value = '';
                                                        }
                                                    }} 
                                                />
                                            </label>
                                        </div>

                                        <p className="text-[10px] text-slate-400 italic">
                                            * Upload foto bukti lapangan bersifat opsional (tidak wajib).
                                        </p>

                                        {/* Photo Thumbnails with Touch Delete Badge */}
                                        {point.photos && point.photos.length > 0 && (
                                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-1.5">
                                                {point.photos.map((ph, pIdx) => (
                                                    <div key={pIdx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-2xs bg-slate-100">
                                                        <img 
                                                            src={getMediaUrl(ph.url || ph)} 
                                                            alt="Bukti Lapangan" 
                                                            className="w-full h-full object-cover cursor-pointer"
                                                            onClick={() => setLightboxPhoto(getMediaUrl(ph.url || ph))}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemovePhoto(index, pIdx, 'morning');
                                                            }}
                                                            className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
                                                            title="Hapus foto"
                                                        >
                                                            <X size={11} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Add Item Button at Bottom */}
                            <button
                                type="button"
                                onClick={() => setMorningPoints([...morningPoints, { text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }])}
                                className="w-full py-2.5 bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-dashed border-blue-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                            >
                                <Plus size={15} /> Tambah Butir Kegiatan Pagi
                            </button>

                            {/* Tombol Simpan Khusus Sesi Pagi */}
                            <button
                                type="button"
                                onClick={() => handleSaveReport('morning')}
                                disabled={saving}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 mt-1"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                <span>Simpan Laporan Sesi Pagi</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sesi Siang */}
                <div className={`bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between ${
                    mobileSessionTab === 'MORNING' ? 'hidden sm:flex' : 'flex'
                }`}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock size={16} className="text-indigo-600" /> Sesi Siang (13.00 - 16.15 WIB)
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Batas pengingat: 19.00 WIB</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setAfternoonPoints([...afternoonPoints, { text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }])}
                                    className="px-2.5 sm:px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                >
                                    <Plus size={14} /> <span className="hidden sm:inline">Tambah Kegiatan</span><span className="sm:hidden">+ Butir</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveReport('afternoon')}
                                    disabled={saving}
                                    className="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50"
                                    title="Simpan Laporan Sesi Siang"
                                >
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    <span>Simpan</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {afternoonPoints.map((point, index) => (
                                <div key={`a-${index}`} className="p-3.5 sm:p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                                    {/* Row 1: Number + Division Dropdown + Delete */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs">
                                                {index + 1}
                                            </span>
                                            <select
                                                value={point.categoryTag}
                                                onChange={(e) => {
                                                    const n = [...afternoonPoints];
                                                    n[index].categoryTag = e.target.value;
                                                    setAfternoonPoints(n);
                                                }}
                                                className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none truncate"
                                            >
                                                {DIVISION_TAGS.map(d => (
                                                    <option key={d.key} value={d.key}>{d.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {afternoonPoints.length > 1 && (
                                            <button 
                                                type="button"
                                                onClick={() => setAfternoonPoints(afternoonPoints.filter((_, i) => i !== index))}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
                                                title="Hapus butir ini"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Feedback / Arahan dari Kabid jika ada */}
                                    {point.review && (
                                        <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                                            point.review.status === 'APPROVED' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900' :
                                            point.review.status === 'REVISION' ? 'bg-amber-50/90 border-amber-200 text-amber-900' :
                                            'bg-blue-50/90 border-blue-200 text-blue-900'
                                        }`}>
                                            <div className="flex items-center justify-between font-bold text-[11px]">
                                                <span className="flex items-center gap-1.5">
                                                    {point.review.status === 'APPROVED' ? '✅ Disetujui Pimpinan' :
                                                     point.review.status === 'REVISION' ? '⚠️ Perlu Perbaikan (Arahan Kabid)' : '💡 Catatan Arahan Pimpinan'}
                                                </span>
                                                <span className="text-[10px] opacity-75 font-normal">
                                                    oleh {point.review.reviewerName || 'Kabid Sarana'} • {dayjs(point.review.reviewedAt).format('DD/MM HH:mm')}
                                                </span>
                                            </div>
                                            {point.review.feedbackNote && (
                                                <p className="text-xs font-semibold italic pl-1 leading-relaxed bg-white/70 p-2 rounded-lg border border-slate-200/60">
                                                    "{point.review.feedbackNote}"
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Row 2: Touch-Friendly Status Pills */}
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const n = [...afternoonPoints];
                                                n[index].status = 'COMPLETED';
                                                setAfternoonPoints(n);
                                            }}
                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                point.status === 'COMPLETED' 
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <CheckCircle2 size={12} /> Selesai 100%
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const n = [...afternoonPoints];
                                                n[index].status = 'IN_PROGRESS';
                                                setAfternoonPoints(n);
                                            }}
                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                point.status === 'IN_PROGRESS' 
                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <Clock size={12} /> Proses
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const n = [...afternoonPoints];
                                                n[index].status = 'OBSTACLE';
                                                setAfternoonPoints(n);
                                            }}
                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                point.status === 'OBSTACLE' 
                                                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <AlertTriangle size={12} /> Kendala ⚠️
                                        </button>
                                    </div>

                                    {/* Activity Description */}
                                    <textarea
                                        rows="3"
                                        placeholder="Uraikan aktivitas kerja siang yang dikerjakan secara jelas..."
                                        value={point.text}
                                        onChange={(e) => {
                                            const n = [...afternoonPoints];
                                            n[index].text = e.target.value;
                                            setAfternoonPoints(n);
                                        }}
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                                    />

                                    {/* Obstacle Note Field */}
                                    {point.status === 'OBSTACLE' && (
                                        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
                                            <AlertCircle size={14} className="text-rose-600 shrink-0" />
                                            <input 
                                                type="text"
                                                placeholder="Jelaskan kendala/masalah yang dihadapi..."
                                                value={point.obstacleNote}
                                                onChange={(e) => {
                                                    const n = [...afternoonPoints];
                                                    n[index].obstacleNote = e.target.value;
                                                    setAfternoonPoints(n);
                                                }}
                                                className="w-full bg-transparent text-xs font-bold text-rose-800 outline-none placeholder:text-rose-400"
                                            />
                                        </div>
                                    )}

                                    {/* Mobile-Friendly Photo Upload Zone (Opsional) */}
                                    <div className="space-y-2 pt-1 border-t border-slate-200/60">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Camera size={13} className="text-indigo-600" />
                                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                                    Foto Bukti Lapangan
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                                                    (Opsional)
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-medium text-slate-400">
                                                {(point.photos || []).length}/5 Foto
                                            </span>
                                        </div>

                                        {/* Dual Upload Options: Direct Camera vs Gallery */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={uploadingPhotoIndex !== null}
                                                onClick={() => setCameraModalConfig({ isOpen: true, index, period: 'afternoon' })}
                                                className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer disabled:opacity-50"
                                            >
                                                {uploadingPhotoIndex === `afternoon-${index}` ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                                                <span>{uploadingPhotoIndex === `afternoon-${index}` ? 'Mengunggah...' : 'Buka Kamera'}</span>
                                            </button>

                                            <label className="cursor-pointer py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs">
                                                <Plus size={14} />
                                                <span>Galeri</span>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="hidden" 
                                                    disabled={uploadingPhotoIndex !== null}
                                                    onChange={(e) => {
                                                        if (e.target.files[0]) {
                                                            handlePhotoUpload(index, e.target.files[0], 'afternoon');
                                                            e.target.value = '';
                                                        }
                                                    }} 
                                                />
                                            </label>
                                        </div>

                                        <p className="text-[10px] text-slate-400 italic">
                                            * Upload foto bukti lapangan bersifat opsional (tidak wajib).
                                        </p>

                                        {/* Photo Thumbnails with Touch Delete Badge */}
                                        {point.photos && point.photos.length > 0 && (
                                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-1.5">
                                                {point.photos.map((ph, pIdx) => (
                                                    <div key={pIdx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-2xs bg-slate-100">
                                                        <img 
                                                            src={getMediaUrl(ph.url || ph)} 
                                                            alt="Bukti Lapangan" 
                                                            className="w-full h-full object-cover cursor-pointer"
                                                            onClick={() => setLightboxPhoto(getMediaUrl(ph.url || ph))}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemovePhoto(index, pIdx, 'afternoon');
                                                            }}
                                                            className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
                                                            title="Hapus foto"
                                                        >
                                                            <X size={11} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Add Item Button at Bottom */}
                            <button
                                type="button"
                                onClick={() => setAfternoonPoints([...afternoonPoints, { text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }])}
                                className="w-full py-2.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-dashed border-indigo-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                            >
                                <Plus size={15} /> Tambah Butir Kegiatan Siang
                            </button>

                            {/* Tombol Simpan Khusus Sesi Siang */}
                            <button
                                type="button"
                                onClick={() => handleSaveReport('afternoon')}
                                disabled={saving}
                                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 mt-1"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                <span>Simpan Laporan Sesi Siang</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* SAVE BUTTON - Floating on Mobile above Navbar, Sticky on Desktop */}
            <div className="fixed sm:sticky bottom-[72px] sm:bottom-4 z-[45] left-3 right-3 sm:left-auto sm:right-auto sm:flex sm:justify-end">
                {/* Mobile view */}
                <div className="flex sm:hidden flex-col gap-2 w-full bg-white/95 backdrop-blur-md p-2.5 rounded-2xl border border-slate-200/90 shadow-2xl">
                    {mobileSessionTab === 'MORNING' && (
                        <button
                            type="button"
                            onClick={() => handleSaveReport('morning')}
                            disabled={saving}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            <span>Simpan Laporan Sesi Pagi</span>
                            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                                {dayjs(selectedDate).format('DD/MM/YYYY')}
                            </span>
                        </button>
                    )}
                    {mobileSessionTab === 'AFTERNOON' && (
                        <button
                            type="button"
                            onClick={() => handleSaveReport('afternoon')}
                            disabled={saving}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            <span>Simpan Laporan Sesi Siang</span>
                            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                                {dayjs(selectedDate).format('DD/MM/YYYY')}
                            </span>
                        </button>
                    )}
                    {mobileSessionTab === 'ALL' && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleSaveReport('morning')}
                                disabled={saving}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                <span>Simpan Pagi</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSaveReport('afternoon')}
                                disabled={saving}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                <span>Simpan Siang</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSaveReport(null)}
                                disabled={saving}
                                className="px-3 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
                                title="Simpan Semua Sesi"
                            >
                                <Save size={15} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Desktop view */}
                <div className="hidden sm:flex sm:items-center sm:gap-3">
                    <button
                        type="button"
                        onClick={() => handleSaveReport('morning')}
                        disabled={saving}
                        className="px-5 py-3.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        <span>Simpan Sesi Pagi</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSaveReport('afternoon')}
                        disabled={saving}
                        className="px-5 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        <span>Simpan Sesi Siang</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSaveReport(null)}
                        disabled={saving}
                        className="px-7 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        <span>
                            {saving 
                                ? 'Menyimpan ke Server...' 
                                : (selectedDate !== dayjs().format('YYYY-MM-DD') ? 'Simpan Semua Laporan Susulan' : 'Simpan Semua (Pagi & Siang)')
                            }
                        </span>
                        <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                            {dayjs(selectedDate).format('DD/MM/YYYY')} (WIB)
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyReportFormTab;
