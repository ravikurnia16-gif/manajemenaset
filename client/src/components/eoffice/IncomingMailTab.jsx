import React, { useState, useEffect } from 'react';
import { Mail, Plus, Search, X, Save, Eye, Trash2, Edit3, Paperclip } from 'lucide-react';
import api from '../../lib/axios';

const Badge = ({ children, className }) => (
    <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5 w-fit shrink-0 ${className}`}>{children}</span>
);

const statusStyles = {
    DITERIMA: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Diterima' },
    DIPROSES: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Diproses' },
    DIDISPOSISI: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Didisposisi' },
    SELESAI: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Selesai' },
    ARSIP: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Arsip' },
};

const IncomingMailTab = () => {
    const [mails, setMails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [selectedMail, setSelectedMail] = useState(null);
    const [form, setForm] = useState({ senderName: '', senderOrg: '', mailNumber: '', mailDate: '', subject: '', type: 'UMUM', urgency: 'NORMAL', description: '', disposition: '' });

    const fetchMails = async () => {
        setLoading(true);
        try {
            const res = await api.get('/documents/incoming-mail/all');
            setMails(Array.isArray(res.data) ? res.data : []);
        } catch { setMails([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchMails(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/documents/incoming-mail', form);
            setShowForm(false);
            setForm({ senderName: '', senderOrg: '', mailNumber: '', mailDate: '', subject: '', type: 'UMUM', urgency: 'NORMAL', description: '', disposition: '' });
            fetchMails();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan'); }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await api.put(`/documents/incoming-mail/${id}`, { status });
            fetchMails();
            setSelectedMail(null);
        } catch { alert('Gagal memperbarui status'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus surat masuk ini?')) return;
        try { await api.delete(`/documents/incoming-mail/${id}`); fetchMails(); setSelectedMail(null); } catch { alert('Gagal menghapus'); }
    };

    const filtered = mails.filter(m =>
        m.subject?.toLowerCase().includes(search.toLowerCase()) ||
        m.senderName?.toLowerCase().includes(search.toLowerCase()) ||
        m.code?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            {/* Toolbar */}
            <div className="bg-white rounded-2xl p-2 pl-4 flex flex-col sm:flex-row items-center justify-between mb-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 gap-4">
                <div className="flex-1 flex items-center gap-3 w-full">
                    <Search className="text-slate-300" size={18} />
                    <input type="text" placeholder="Cari surat masuk..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full bg-transparent border-none text-sm font-semibold text-slate-700 placeholder:text-slate-300 focus:ring-0 outline-none" />
                </div>
                <button onClick={() => setShowForm(true)} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-indigo-200 shrink-0">
                    <Plus size={14} /> Catat Surat Masuk
                </button>
            </div>

            {/* List */}
            {loading ? (
                <div className="py-20 text-center"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div></div>
            ) : filtered.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Mail size={48} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">Belum ada surat masuk</h3>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(m => {
                        const st = statusStyles[m.status] || statusStyles.DITERIMA;
                        return (
                            <div key={m.id} onClick={() => setSelectedMail(m)} className="group bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 shrink-0 group-hover:bg-orange-100 transition-colors"><Mail size={20} /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap gap-2 mb-1">
                                            <Badge className={`${st.bg} ${st.text}`}>{st.label}</Badge>
                                            <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{m.type}</span>
                                            {m.urgency === 'URGENT' && <span className="text-[10px] font-black text-rose-500 tracking-widest uppercase bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 animate-pulse">URGENT</span>}
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700">{m.subject}</h3>
                                        <div className="flex gap-3 text-[11px] text-slate-500 font-semibold mt-1">
                                            <span>No: {m.code}</span><span>•</span><span>Dari: {m.senderName} {m.senderOrg ? `(${m.senderOrg})` : ''}</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-bold text-slate-700">{new Date(m.receivedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CREATE FORM MODAL */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><Mail size={18} /></div>
                                <h3 className="text-base font-bold text-slate-800">Catat Surat Masuk</h3>
                            </div>
                            <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Pengirim *</label>
                                    <input required value={form.senderName} onChange={e => setForm({...form, senderName: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Instansi / Organisasi</label>
                                    <input value={form.senderOrg} onChange={e => setForm({...form, senderOrg: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nomor Surat</label>
                                    <input value={form.mailNumber} onChange={e => setForm({...form, mailNumber: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tanggal Surat *</label>
                                    <input type="date" required value={form.mailDate} onChange={e => setForm({...form, mailDate: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Perihal *</label>
                                <input required value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Jenis</label>
                                    <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none">
                                        <option value="UMUM">Umum</option><option value="UNDANGAN">Undangan</option><option value="PEMBERITAHUAN">Pemberitahuan</option><option value="PERMOHONAN">Permohonan</option><option value="LAINNYA">Lainnya</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Urgensi</label>
                                    <select value={form.urgency} onChange={e => setForm({...form, urgency: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none">
                                        <option value="NORMAL">Normal</option><option value="HIGH">Penting</option><option value="URGENT">Sangat Segera</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ringkasan / Catatan</label>
                                <textarea rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 outline-none resize-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Disposisi</label>
                                <textarea rows="2" value={form.disposition} onChange={e => setForm({...form, disposition: e.target.value})} placeholder="Tindak lanjut yang diinstruksikan..." className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 outline-none resize-none" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">Batal</button>
                                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-md shadow-indigo-200 active:scale-95"><Save size={14} /> Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {selectedMail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">Detail Surat Masuk</h3>
                            <button onClick={() => setSelectedMail(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge className={`${(statusStyles[selectedMail.status] || statusStyles.DITERIMA).bg} ${(statusStyles[selectedMail.status] || statusStyles.DITERIMA).text}`}>{(statusStyles[selectedMail.status] || statusStyles.DITERIMA).label}</Badge>
                                <Badge className="bg-slate-100 text-slate-600">{selectedMail.type}</Badge>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                                <p><span className="font-bold text-slate-500">No. Agenda:</span> <span className="text-slate-800 font-semibold">{selectedMail.code}</span></p>
                                <p><span className="font-bold text-slate-500">Pengirim:</span> <span className="text-slate-800 font-semibold">{selectedMail.senderName} {selectedMail.senderOrg ? `- ${selectedMail.senderOrg}` : ''}</span></p>
                                <p><span className="font-bold text-slate-500">No. Surat:</span> <span className="text-slate-800 font-semibold">{selectedMail.mailNumber || '-'}</span></p>
                                <p><span className="font-bold text-slate-500">Tgl Surat:</span> <span className="text-slate-800 font-semibold">{new Date(selectedMail.mailDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                                <p><span className="font-bold text-slate-500">Perihal:</span> <span className="text-slate-800 font-semibold">{selectedMail.subject}</span></p>
                            </div>
                            {selectedMail.description && <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedMail.description}</p></div>}
                            {selectedMail.disposition && <div className="bg-amber-50 rounded-xl border border-amber-200 p-4"><p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Disposisi</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedMail.disposition}</p></div>}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap gap-2 justify-between">
                            <div className="flex gap-2 flex-wrap">
                                {selectedMail.status === 'DITERIMA' && <button onClick={() => handleUpdateStatus(selectedMail.id, 'DIPROSES')} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold">Proses</button>}
                                {selectedMail.status === 'DIPROSES' && <button onClick={() => handleUpdateStatus(selectedMail.id, 'SELESAI')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">Selesai</button>}
                                {selectedMail.status !== 'ARSIP' && <button onClick={() => handleUpdateStatus(selectedMail.id, 'ARSIP')} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-xs font-bold">Arsipkan</button>}
                                <button onClick={() => handleDelete(selectedMail.id)} className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold"><Trash2 size={12} className="inline mr-1" />Hapus</button>
                            </div>
                            <button onClick={() => setSelectedMail(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncomingMailTab;
