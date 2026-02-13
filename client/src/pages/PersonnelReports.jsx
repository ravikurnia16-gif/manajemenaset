import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Calendar, ChevronRight, ChevronDown, CheckCircle2, Clock } from 'lucide-react';
import api from '../lib/axios';

const PersonnelReports = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        type: 'DAILY',
        category: 'UMUM',
        content: '',
        date: new Date().toISOString().split('T')[0],
        // Specialized fields
        finance: { income: '', outcome: '', balance: '' },
        assets: {
            activityType: 'DISTRIBUSI',
            items: [{ name: '', qty: '', target: '' }],
            checks: { bast: false, photo: false, database: false }
        },
        warehouse: { in: '', out: '', remaining: '' },
        vehicle: { kmStart: '', kmEnd: '', fuel: '', condition: 'BAIK' }
    });

    const user = JSON.parse(localStorage.getItem('user')) || {};

    const fetchReports = async () => {
        try {
            setLoading(true);
            const params = {};
            if (typeFilter !== 'ALL') params.type = typeFilter;
            const res = await api.get('/personnel/reports', { params });
            setReports(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [typeFilter]);

    const addAssetItem = () => {
        setForm({
            ...form,
            assets: { ...form.assets, items: [...form.assets.items, { name: '', qty: '', target: '' }] }
        });
    };

    const removeAssetItem = (index) => {
        const newItems = form.assets.items.filter((_, i) => i !== index);
        setForm({ ...form, assets: { ...form.assets, items: newItems } });
    };

    const handleAssetItemChange = (index, field, value) => {
        const newItems = [...form.assets.items];
        newItems[index][field] = value;
        setForm({ ...form, assets: { ...form.assets, items: newItems } });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        let details = '';
        let metadata = null;

        if (form.category === 'KEUANGAN') {
            details = `💰 *Pemasukan*: Rp ${form.finance.income || '-'}\n💸 *Pengeluaran*: Rp ${form.finance.outcome || '-'}\n⚖️ *Saldo*: Rp ${form.finance.balance || '-'}`;
        } else if (form.category === 'ASET') {
            const itemsList = form.assets.items.map(it => `- ${it.name} (${it.qty})${it.target ? ' -> ' + it.target : ''}`).join('\n');
            const checksList = [
                form.assets.checks.bast ? '✓ BAST Lengkap' : '✗ BAST Belum',
                form.assets.checks.photo ? '✓ Foto Fisik Ada' : '✗ Foto Fisik Belum',
                form.assets.checks.database ? '✓ Master Data Terupdate' : '✗ Master Data Belum'
            ].join(', ');

            details = `📦 *Aktivitas*: ${form.assets.activityType}\n📊 *Daftar Barang*:\n${itemsList || '-'}\n📝 *Dokumen*: ${checksList}`;
            metadata = {
                activityType: form.assets.activityType,
                items: form.assets.items.filter(it => it.name.trim() !== ''),
                checks: form.assets.checks
            };
        } else if (form.category === 'GUDANG') {
            details = `🏠 *Stok Masuk*: ${form.warehouse.in || '-'}\n📦 *Stok Keluar*: ${form.warehouse.out || '-'}\n📊 *Sisa Stok*: ${form.warehouse.remaining || '-'}`;
        } else if (form.category === 'KENDARAAN') {
            details = `🚗 *KM Awal*: ${form.vehicle.kmStart || '-'}\n🏁 *KM Akhir*: ${form.vehicle.kmEnd || '-'}\n⛽ *BBM*: ${form.vehicle.fuel || '-'}\n🛠️ *Kondisi*: ${form.vehicle.condition}`;
        }

        if (!form.content.trim() && !details) return alert('Isi laporan tidak boleh kosong');

        try {
            setSubmitting(true);
            await api.post('/personnel/reports', {
                ...form,
                details: details.replace(/\*/g, ''), // Send clean text to backend
                metadata
            });
            setShowForm(false);
            setForm({
                type: 'DAILY',
                category: 'UMUM',
                content: '',
                date: new Date().toISOString().split('T')[0],
                finance: { income: '', outcome: '', balance: '' },
                assets: {
                    activityType: 'DISTRIBUSI',
                    items: [{ name: '', qty: '', target: '' }],
                    checks: { bast: false, photo: false, database: false }
                },
                warehouse: { in: '', out: '', remaining: '' },
                vehicle: { kmStart: '', kmEnd: '', fuel: '', condition: 'BAIK' }
            });
            fetchReports();
            alert('Laporan berhasil dikirim');
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengirim laporan');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredReports = reports;

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> Laporan Personalia
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Manajemen laporan harian dan mingguan staf Sarpras
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm"
                >
                    {showForm ? 'Batal' : <><Plus size={18} /> Buat Laporan</>}
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Input Laporan Baru</h3>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className={`grid grid-cols-1 ${form.type === 'WEEKLY' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jenis Laporan</label>
                                <select
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value, category: e.target.value === 'DAILY' ? 'UMUM' : form.category })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="DAILY">Harian</option>
                                    <option value="WEEKLY">Mingguan</option>
                                </select>
                            </div>
                            {form.type === 'WEEKLY' && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kategori Bidang</label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm({ ...form, category: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600"
                                    >
                                        <option value="UMUM">Umum / Lainnya</option>
                                        <option value="KEUANGAN">📦 Staf Keuangan (Syafruan)</option>
                                        <option value="ASET">🏢 Staf Manajemen Aset (Eldo)</option>
                                        <option value="GUDANG">🏠 Staf Gudang & Logistik (Jeri)</option>
                                        <option value="KENDARAAN">🚗 Staf Kendaraan (Ringgo/Wegi)</option>
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Category Specific Fields (ONLY for WEEKLY) */}
                        {form.type === 'WEEKLY' && form.category === 'KEUANGAN' && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Pemasukan (Rp)</label>
                                    <input type="number" value={form.finance.income} onChange={e => setForm({ ...form, finance: { ...form.finance, income: e.target.value } })} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Pengeluaran (Rp)</label>
                                    <input type="number" value={form.finance.outcome} onChange={e => setForm({ ...form, finance: { ...form.finance, outcome: e.target.value } })} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Saldo Akhir (Rp)</label>
                                    <input type="number" value={form.finance.balance} onChange={e => setForm({ ...form, finance: { ...form.finance, balance: e.target.value } })} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                            </div>
                        )}

                        {form.type === 'WEEKLY' && form.category === 'ASET' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Jenis Aktivitas</label>
                                        <select
                                            value={form.assets.activityType}
                                            onChange={e => setForm({ ...form, assets: { ...form.assets, activityType: e.target.value } })}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-blue-700"
                                        >
                                            <option value="PENERIMAAN">PENERIMAAN ASET</option>
                                            <option value="DISTRIBUSI">DISTRIBUSI / PENGIRIMAN</option>
                                            <option value="MUTASI">MUTASI ANTAR RUANG</option>
                                            <option value="LABELING">LABELING / KODIFIKASI</option>
                                            <option value="AUDIT">AUDIT / STOK OPNAME</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-4 pt-5">
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                            <input type="checkbox" checked={form.assets.checks.bast} onChange={e => setForm({ ...form, assets: { ...form.assets, checks: { ...form.assets.checks, bast: e.target.checked } } })} /> BAST LENGKAP
                                        </label>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                            <input type="checkbox" checked={form.assets.checks.photo} onChange={e => setForm({ ...form, assets: { ...form.assets, checks: { ...form.assets.checks, photo: e.target.checked } } })} /> FOTO FISIK
                                        </label>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                            <input type="checkbox" checked={form.assets.checks.database} onChange={e => setForm({ ...form, assets: { ...form.assets, checks: { ...form.assets.checks, database: e.target.checked } } })} /> MASTER DATA OK
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase">Daftar Rincian Barang</label>
                                        <button type="button" onClick={addAssetItem} className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1">
                                            <Plus size={14} /> Tambah Baris
                                        </button>
                                    </div>
                                    {form.assets.items.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end group">
                                            <div className="md:col-span-1">
                                                <input placeholder="Nama Barang" value={item.name} onChange={e => handleAssetItemChange(idx, 'name', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                            </div>
                                            <div className="md:col-span-1">
                                                <input placeholder="Jumlah / Qty" value={item.qty} onChange={e => handleAssetItemChange(idx, 'qty', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                            </div>
                                            <div className="md:col-span-2 flex gap-2">
                                                <input placeholder="Tujuan / Asal" value={item.target} onChange={e => handleAssetItemChange(idx, 'target', e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm" />
                                                {form.assets.items.length > 1 && (
                                                    <button type="button" onClick={() => removeAssetItem(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {form.type === 'WEEKLY' && form.category === 'GUDANG' && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Stok Masuk</label>
                                    <input type="text" value={form.warehouse.in} onChange={e => setForm({ ...form, warehouse: { ...form.warehouse, in: e.target.value } })} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Stok Keluar</label>
                                    <input type="text" value={form.warehouse.out} onChange={e => setForm({ ...form, warehouse: { ...form.warehouse, out: e.target.value } })} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Sisa Stok</label>
                                    <input type="text" value={form.warehouse.remaining} onChange={e => setForm({ ...form, warehouse: { ...form.warehouse, remaining: e.target.value } })} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                            </div>
                        )}

                        {form.type === 'WEEKLY' && form.category === 'KENDARAAN' && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">KM Awal</label>
                                    <input type="number" value={form.vehicle.kmStart} onChange={e => setForm({ ...form, vehicle: { ...form.vehicle, kmStart: e.target.value } })} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">KM Akhir</label>
                                    <input type="number" value={form.vehicle.kmEnd} onChange={e => setForm({ ...form, vehicle: { ...form.vehicle, kmEnd: e.target.value } })} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">BBM (Liter)</label>
                                    <input type="number" value={form.vehicle.fuel} onChange={e => setForm({ ...form, vehicle: { ...form.vehicle, fuel: e.target.value } })} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Kondisi</label>
                                    <select value={form.vehicle.condition} onChange={e => setForm({ ...form, vehicle: { ...form.vehicle, condition: e.target.value } })} className="w-full p-2 border border-slate-200 rounded-lg text-sm">
                                        <option value="BAIK">BAIK</option>
                                        <option value="SERVIS">PERLU SERVIS</option>
                                        <option value="RUSAK">RUSAK</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Laporan Kegiatan / Aktivitas</label>
                            <textarea
                                value={form.content}
                                onChange={e => setForm({ ...form, content: e.target.value })}
                                rows={form.type === 'DAILY' ? 6 : 4}
                                placeholder={form.type === 'DAILY' ? "Jelaskan apa saja yang Anda lakukan hari ini..." : "Berikan ringkasan aktivitas selama seminggu ini..."}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            ></textarea>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all disabled:opacity-50"
                            >
                                {submitting ? 'Mengirim...' : 'Kirim Laporan'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {['ALL', 'DAILY', 'WEEKLY'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${typeFilter === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {t === 'ALL' ? 'Semua' : t === 'DAILY' ? 'Harian' : 'Mingguan'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <div className="p-10 text-center text-slate-400">Memuat laporan...</div>
                    ) : reports.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">
                            <FileText size={40} className="mx-auto mb-2 text-slate-300" />
                            Belum ada laporan yang dikirimkan.
                        </div>
                    ) : (
                        reports.map(report => (
                            <div key={report.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${report.type === 'DAILY' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                                            {report.type === 'DAILY' ? 'H' : 'M'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800">{report.user?.name || report.user?.username}</div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                <Calendar size={12} /> {new Date(report.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${report.type === 'DAILY' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                        {report.type === 'DAILY' ? 'HARIAN' : 'MINGGUAN'}
                                    </span>
                                </div>
                                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                                    {report.content}
                                    {report.metadata?.items && report.metadata.items.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-200">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Rincian Barang:</div>
                                            <div className="space-y-1">
                                                {report.metadata.items.map((item, i) => (
                                                    <div key={i} className="text-xs flex items-center gap-2">
                                                        <span className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                                        <span className="font-semibold">{item.name}</span>
                                                        <span className="text-slate-400">({item.qty})</span>
                                                        {item.target && <span className="text-blue-500 flex items-center gap-1"><ChevronRight size={12} /> {item.target}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                            {report.metadata.checks && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {report.metadata.checks.bast && <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-bold border border-green-100 flex items-center gap-1"><CheckCircle2 size={10} /> BAST</span>}
                                                    {report.metadata.checks.photo && <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-bold border border-green-100 flex items-center gap-1"><CheckCircle2 size={10} /> FOTO</span>}
                                                    {report.metadata.checks.database && <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-bold border border-green-100 flex items-center gap-1"><CheckCircle2 size={10} /> DATABASE</span>}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 text-[10px] text-slate-400 text-right">
                                    Dikirim pada {new Date(report.createdAt).toLocaleString('id-ID')}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonnelReports;
