import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, HardHat, Cog, AlertTriangle } from 'lucide-react';
import api from '../lib/axios';
import Swal from 'sweetalert2';

const WorkshopOrderForm = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const userStr = localStorage.getItem('user');
    const userObj = userStr ? JSON.parse(userStr) : null;
    const isAdminUnit21 = userObj?.role === 'ADMIN_UNIT' && userObj?.unitId === 21;
    const isAdminOrSarpras = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(userObj?.role) || isAdminUnit21;

    // PIC Workshop dari Settings (diambil sekali dari server)
    const [workshopPics, setWorkshopPics] = useState({ KAYU: '', BESI: '' });

    const location = useLocation();
    const fromMaintenance = location.state?.fromMaintenance;

    const [form, setForm] = useState({
        title: fromMaintenance ? fromMaintenance.title : '',
        priority: 'NORMAL',
        deadline: '',
        notes: fromMaintenance ? fromMaintenance.notes : '',
        picName: '',
        workshopType: '',
        unitId: fromMaintenance ? fromMaintenance.unitId : ''
    });

    const [units, setUnits] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [unitsRes, settingsRes] = await Promise.all([
                    api.get('/master/units'),
                    api.get('/settings')
                ]);
                setUnits(unitsRes.data);
                setWorkshopPics({
                    KAYU: settingsRes.data?.workshopPicKayu || '',
                    BESI: settingsRes.data?.workshopPicBesi || ''
                });
            } catch (err) {
                console.error('Failed to fetch data:', err);
            }
        };
        fetchData();
    }, []);

    const [items, setItems] = useState([
        { name: '', spec: '', qty: 1, unit: 'Unit' }
    ]);

    const handleFormChange = (field, value) => {
        if (field === 'workshopType') {
            // Auto-set PIC dari Settings global jika field PIC belum diisi manual
            setForm(prev => ({
                ...prev,
                [field]: value,
                picName: prev.picName || workshopPics[value] || ''
            }));
        } else {
            setForm(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleItemChange = (index, field, value) => {
        setItems(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ));
    };

    const addItem = () => {
        setItems([...items, { name: '', spec: '', qty: 1, unit: 'Unit' }]);
    };

    const removeItem = (index) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.title.trim()) {
            return Swal.fire('Peringatan', 'Judul pesanan wajib diisi.', 'warning');
        }

        const emptyItems = items.filter(it => !it.name.trim());
        if (emptyItems.length > 0) {
            return Swal.fire('Peringatan', 'Semua item harus memiliki nama.', 'warning');
        }

        const confirm = await Swal.fire({
            title: 'Kirim Pesanan Workshop?',
            html: `<p>Total Item: <strong>${items.length}</strong></p>
                   <p class="text-sm text-gray-500 mt-2">Pesanan akan dievaluasi dan diproses langsung oleh Unit Workshop.</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#059669',
            confirmButtonText: 'Ya, Kirim',
            cancelButtonText: 'Batal'
        });

        if (!confirm.isConfirmed) return;

        setLoading(true);
        try {
            await api.post('/workshop/orders', {
                ...form,
                maintenanceId: fromMaintenance?.id,
                items
            });
            Swal.fire('Berhasil!', 'Pesanan workshop berhasil dibuat dan dikirim ke Unit Workshop.', 'success');
            navigate('/workshop/orders');
        } catch (error) {
            console.error('Error creating workshop order:', error);
            Swal.fire('Gagal', error.response?.data?.error || 'Gagal membuat pesanan.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-20 px-2 sm:px-0 p-6">
            <button onClick={() => navigate('/workshop/orders')} className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors">
                <ArrowLeft size={16} /> Batal & Kembali
            </button>

            <div className="bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-slate-100">
                <div className="mb-6">
                    <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Buat Pesanan Workshop Baru</h1>
                    <p className="text-slate-500 text-xs sm:text-sm">Ajukan permintaan pekerjaan ke Workshop Kayu atau Workshop Besi.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Detail Pesanan */}
                    <div className="bg-slate-50 p-4 sm:p-6 rounded-xl border border-slate-200 space-y-4">
                        <h3 className="text-sm font-bold text-slate-700 mb-2">Detail Pesanan</h3>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Judul Pesanan *</label>
                            <input
                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-slate-700"
                                placeholder="Contoh: Pembuatan Lemari Arsip untuk Unit Keuangan"
                                value={form.title}
                                onChange={e => handleFormChange('title', e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Pesanan Dari Unit *</label>
                            <select
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                value={form.unitId}
                                onChange={e => handleFormChange('unitId', e.target.value)}
                                required
                            >
                                <option value="">-- Pilih Unit --</option>
                                {units.map(unit => (
                                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tipe Workshop</label>
                                <select
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                    value={form.workshopType}
                                    onChange={e => handleFormChange('workshopType', e.target.value)}
                                >
                                    <option value="">-- Pilih Tipe --</option>
                                    <option value="KAYU">🪵 Workshop Kayu</option>
                                    <option value="BESI">⚙️ Workshop Besi</option>
                                </select>
                                {form.workshopType && (
                                    <p className="text-[10px] mt-1 font-semibold"
                                        style={{ color: form.workshopType === 'KAYU' ? '#c2410c' : '#475569' }}
                                    >
                                        PJ Default: {workshopPics[form.workshopType] || 'Belum diatur'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Prioritas</label>
                                <select
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                    value={form.priority}
                                    onChange={e => handleFormChange('priority', e.target.value)}
                                >
                                    <option value="LOW">Low - Tidak Mendesak</option>
                                    <option value="NORMAL">Normal</option>
                                    <option value="HIGH">High - Penting</option>
                                    <option value="URGENT">Urgent - Sangat Mendesak</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Deadline (Opsional)</label>
                                <input
                                    type="date"
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={form.deadline}
                                    onChange={e => handleFormChange('deadline', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block flex items-center gap-1">
                                    PIC / Penanggung Jawab
                                    {form.workshopType && (
                                        <span className="ml-1 px-1.5 py-0.5 text-[9px] rounded font-bold"
                                            style={{
                                                background: form.workshopType === 'KAYU' ? '#fff7ed' : '#f1f5f9',
                                                color: form.workshopType === 'KAYU' ? '#c2410c' : '#475569',
                                            }}
                                        >
                                            {form.workshopType}
                                        </span>
                                    )}
                                </label>
                                <input
                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder={form.workshopType ? (workshopPics[form.workshopType] || 'Nama PIC') : 'Nama PIC / Kepala Workshop'}
                                    value={form.picName}
                                    onChange={e => handleFormChange('picName', e.target.value)}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Kosongkan untuk pakai PIC default sesuai tipe workshop.</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Catatan Tambahan (Opsional)</label>
                            <textarea
                                rows="2"
                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-700"
                                placeholder="Catatan khusus untuk workshop..."
                                value={form.notes}
                                onChange={e => handleFormChange('notes', e.target.value)}
                            ></textarea>
                        </div>
                    </div>

                    {/* Items Section */}
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-4 bg-emerald-50 p-3 sm:p-4 rounded-lg border border-emerald-100">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-emerald-900">Daftar Item Pekerjaan</h3>
                                <p className="text-xs text-emerald-600">Rincian barang/pekerjaan yang diminta ke workshop.</p>
                            </div>
                            <button type="button" onClick={addItem} className="flex items-center gap-1 text-white bg-emerald-600 hover:bg-emerald-700 text-xs font-bold px-3 py-2 rounded-lg shadow-sm">
                                <Plus size={14} /> Tambah Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-2 sm:gap-4 items-start p-3 sm:p-4 border border-slate-200 rounded-xl bg-white hover:border-emerald-300 transition-colors group">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-xs mt-1">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nama Item / Pekerjaan *</label>
                                                <input
                                                    placeholder="Contoh: Lemari Arsip 4 Pintu"
                                                    className="border border-slate-300 p-2 rounded text-sm font-semibold w-full focus:border-emerald-500 outline-none"
                                                    value={item.name}
                                                    onChange={e => handleItemChange(index, 'name', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Spesifikasi</label>
                                                <input
                                                    placeholder="Contoh: Kayu Jati, ukuran 120x40x180cm"
                                                    className="border border-slate-300 p-2 rounded text-sm w-full focus:border-emerald-500 outline-none"
                                                    value={item.spec}
                                                    onChange={e => handleItemChange(index, 'spec', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Jumlah</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="border border-slate-300 p-2 rounded text-sm w-full focus:border-emerald-500 outline-none"
                                                    value={item.qty}
                                                    onChange={e => handleItemChange(index, 'qty', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Satuan</label>
                                                <input
                                                    placeholder="Unit/Pcs/Set"
                                                    className="border border-slate-300 p-2 rounded text-sm w-full focus:border-emerald-500 outline-none"
                                                    value={item.unit}
                                                    onChange={e => handleItemChange(index, 'unit', e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(index)} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Priority Warning */}
                    {form.priority === 'URGENT' && (
                        <div className="flex items-center gap-3 bg-red-50 border border-red-200 p-4 rounded-xl">
                            <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-700">Pesanan dengan prioritas <strong>URGENT</strong> akan mendapat notifikasi langsung ke WhatsApp Admin/Kabid.</p>
                        </div>
                    )}

                    {/* Submit */}
                    <div className="pt-4 sm:pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/workshop/orders')}
                            className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-emerald-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all transform hover:-translate-y-1 flex items-center gap-2 justify-center"
                        >
                            {loading ? 'Mengirim...' : 'Kirim Pesanan'} <Save size={18} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WorkshopOrderForm;
