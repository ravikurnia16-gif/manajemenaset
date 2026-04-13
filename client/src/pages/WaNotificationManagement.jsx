import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  MessageSquare, Save, RotateCcw, Search, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, Eye, Edit3, X, Check, Loader2, Bell,
  Bus, Wrench, ShoppingCart, Users, Box, Sparkles, AlertCircle, Info
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

const CATEGORY_META = {
  KENDARAAN: { icon: Bus, color: '#10b981', label: 'Kendaraan' },
  PEMELIHARAAN: { icon: Wrench, color: '#f59e0b', label: 'Pemeliharaan' },
  PENGADAAN: { icon: ShoppingCart, color: '#6366f1', label: 'Pengadaan' },
  PERSONALIA: { icon: Users, color: '#8b5cf6', label: 'Personalia' },
  GUDANG: { icon: Box, color: '#ec4899', label: 'Gudang' },
  UMUM: { icon: Bell, color: '#64748b', label: 'Umum' }
};

const WaNotificationManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editPositions, setEditPositions] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const token = JSON.parse(localStorage.getItem('user'))?.token;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/wa-templates`, { headers });
      setTemplates(data);
      // Auto-expand all categories
      const cats = {};
      data.forEach(t => { cats[t.category] = true; });
      setExpandedCats(cats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      setSeeding(true);
      const { data } = await axios.post(`${API}/wa-templates/seed`, {}, { headers });
      showToast(data.message);
      fetchTemplates();
    } catch (err) {
      showToast('Gagal menambahkan template default');
    } finally {
      setSeeding(false);
    }
  };

  const handleToggle = async (tpl) => {
    try {
      await axios.put(`${API}/wa-templates/${tpl.id}`, { isActive: !tpl.isActive }, { headers });
      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, isActive: !t.isActive } : t));
      showToast(`Notifikasi "${tpl.name}" ${!tpl.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
    } catch (err) {
      showToast('Gagal mengubah status');
    }
  };

  const handleEdit = (tpl) => {
    setEditingId(tpl.id);
    setEditContent(tpl.content);
    try {
      const positions = JSON.parse(tpl.recipientPositions || '[]');
      setEditPositions(positions.join(', '));
    } catch {
      setEditPositions('');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const positions = editPositions.split(',').map(s => s.trim()).filter(Boolean);
      await axios.put(`${API}/wa-templates/${editingId}`, {
        content: editContent,
        recipientPositions: JSON.stringify(positions)
      }, { headers });
      setEditingId(null);
      fetchTemplates();
      showToast('Template berhasil disimpan');
    } catch (err) {
      showToast('Gagal menyimpan template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (slug) => {
    if (!confirm('Reset template ini ke konten default?')) return;
    try {
      await axios.post(`${API}/wa-templates/reset/${slug}`, {}, { headers });
      fetchTemplates();
      showToast('Template berhasil di-reset');
    } catch (err) {
      showToast('Gagal reset template');
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const toggleCat = (cat) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Group templates by category
  const grouped = useMemo(() => {
    const filtered = templates.filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.reduce((acc, tpl) => {
      if (!acc[tpl.category]) acc[tpl.category] = [];
      acc[tpl.category].push(tpl);
      return acc;
    }, {});
  }, [templates, search]);

  const renderPreview = (content) => {
    // Replace {{var}} with highlighted spans
    return content.replace(/\{\{(\w+)\}\}/g, '[$1]');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-xl">
              <MessageSquare className="w-6 h-6 text-emerald-700" />
            </div>
            Manajemen Notifikasi WhatsApp
          </h1>
          <p className="text-slate-500 mt-1 ml-14">Kelola template dan pengaturan notifikasi otomatis</p>
        </div>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 shadow-sm"
        >
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Tambah Template Default
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Panduan Pengeditan Template</p>
          <p>Gunakan <code className="bg-blue-100 px-1 rounded text-xs font-mono">{`{{variabel}}`}</code> untuk menyisipkan data dinamis. Variabel yang tersedia ditampilkan pada setiap template. Contoh: <code className="bg-blue-100 px-1 rounded text-xs font-mono">{`{{nama_pemesan}}`}</code> akan otomatis berisi nama pemesan.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari template berdasarkan nama, slug, atau konten..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none transition-all text-sm"
        />
      </div>

      {/* Template List by Category */}
      {templates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">Belum ada template notifikasi.</p>
          <button onClick={handleSeed} className="text-emerald-600 hover:text-emerald-700 font-medium">
            Klik untuk menambahkan template default
          </button>
        </div>
      ) : (
        Object.entries(grouped).map(([category, tpls]) => {
          const meta = CATEGORY_META[category] || CATEGORY_META.UMUM;
          const Icon = meta.icon;
          const isExpanded = expandedCats[category];

          return (
            <div key={category} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Category Header */}
              <button
                onClick={() => toggleCat(category)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: meta.color + '15' }}>
                    <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-800">{meta.label}</h3>
                    <p className="text-xs text-slate-400">{tpls.length} template</p>
                  </div>
                </div>
                {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
              </button>

              {/* Template Items */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {tpls.map((tpl) => (
                    <div key={tpl.id} className={`border-b border-slate-50 last:border-b-0 ${!tpl.isActive ? 'opacity-60' : ''}`}>
                      {/* Template Row */}
                      <div className="p-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-slate-800 text-sm">{tpl.name}</h4>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-mono rounded">{tpl.slug}</span>
                            {!tpl.isActive && <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[10px] rounded font-medium">NONAKTIF</span>}
                          </div>
                          {tpl.description && <p className="text-xs text-slate-400 mt-1">{tpl.description}</p>}

                          {/* Available Variables */}
                          {tpl.availableVars && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {JSON.parse(tpl.availableVars).map(v => (
                                <span key={v} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-mono rounded border border-amber-200">
                                  {`{{${v}}}`}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Recipients */}
                          {tpl.recipientPositions && JSON.parse(tpl.recipientPositions || '[]').length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              <span className="text-[10px] text-slate-400 mr-1">Penerima:</span>
                              {JSON.parse(tpl.recipientPositions).map(p => (
                                <span key={p} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded border border-blue-200">
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setPreviewId(previewId === tpl.id ? null : tpl.id)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(tpl)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReset(tpl.slug)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-all"
                            title="Reset ke Default"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggle(tpl)}
                            className="p-2 rounded-lg transition-all"
                            title={tpl.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            {tpl.isActive
                              ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                              : <ToggleLeft className="w-5 h-5 text-slate-300" />
                            }
                          </button>
                        </div>
                      </div>

                      {/* Preview Panel */}
                      {previewId === tpl.id && (
                        <div className="mx-4 mb-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                          <p className="text-xs font-medium text-emerald-700 mb-2">Preview Pesan WhatsApp:</p>
                          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{renderPreview(tpl.content)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                Edit Template Notifikasi
              </h3>
              <button onClick={() => setEditingId(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Available Variables */}
              {(() => {
                const tpl = templates.find(t => t.id === editingId);
                if (!tpl?.availableVars) return null;
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-medium text-amber-700 mb-2">Variabel yang tersedia (klik untuk menyalin):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {JSON.parse(tpl.availableVars).map(v => (
                        <button
                          key={v}
                          onClick={() => {
                            const varStr = `{{${v}}}`;
                            navigator.clipboard?.writeText(varStr);
                            showToast(`Disalin: ${varStr}`);
                          }}
                          className="px-2 py-1 bg-white text-amber-800 text-xs font-mono rounded border border-amber-300 hover:bg-amber-100 transition-all cursor-pointer"
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Content Editor */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Isi Pesan</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={12}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none transition-all resize-y"
                  placeholder="Tulis template pesan di sini..."
                />
              </div>

              {/* Recipient Positions */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Penerima (Posisi, pisahkan dengan koma)</label>
                <input
                  type="text"
                  value={editPositions}
                  onChange={(e) => setEditPositions(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none transition-all"
                  placeholder="Staff Manajemen Aset, Kepala Bidang Sarana dan Prasarana"
                />
                <p className="text-xs text-slate-400 mt-1">Kosongkan jika notifikasi dikirim langsung ke user terkait (bukan broadcast).</p>
              </div>

              {/* Preview */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-medium text-slate-500 mb-2">Preview:</p>
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{renderPreview(editContent)}</pre>
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-all text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 text-sm shadow-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 z-[9999] animate-in slide-in-from-bottom-4">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-sm">{toastMsg}</span>
        </div>
      )}
    </div>
  );
};

export default WaNotificationManagement;
