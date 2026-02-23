import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Car, Camera, Save, MapPin, Fuel, Gauge, Palette, Calendar, User, Search } from 'lucide-react';
import api from '../lib/axios';

const VehicleForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState({
        name: '',
        brand: '',
        model: '',
        type: 'Mobil',
        plateNumber: '',
        fuelType: 'Pertalite',
        capacity: '',
        color: '',
        odometer: 0,
        photo: '',
        status: 'ACTIVE',
        taxDueDate: '',
        stnkDueDate: '',
        kirDueDate: '',
        picIds: []
    });
    const [users, setUsers] = useState([]);
    const [picSearch, setPicSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isEdit) {
            fetchVehicle();
        }
        fetchUsers();
    }, [id]);

    const fetchVehicle = async () => {
        try {
            const res = await api.get(`/vehicles/${id}`);
            const data = res.data;
            const formatDate = (date) => {
                if (!date) return '';
                try {
                    return new Date(date).toISOString().split('T')[0];
                } catch (e) { return ''; }
            };
            setForm({
                ...data,
                taxDueDate: formatDate(data.taxDueDate),
                stnkDueDate: formatDate(data.stnkDueDate),
                kirDueDate: formatDate(data.kirDueDate),
                picIds: data.pics?.map(p => p.id) || []
            });
        } catch (error) {
            console.error('Failed to fetch vehicle:', error);
            alert('Gagal mengambil data kendaraan');
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (error) { console.error(error); }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setForm({ ...form, photo: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isEdit) {
                await api.put(`/vehicles/${id}`, form);
            } else {
                await api.post('/vehicles', form);
            }
            alert(`Kendaraan berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}!`);
            navigate('/kendaraan/data');
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in slide-in-from-bottom-4">
            <button onClick={() => navigate('/kendaraan/data')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors">
                <ArrowLeft size={16} /> Batal & Kembali
            </button>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <Car size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">{isEdit ? 'Edit Kendaraan' : 'Tambah Kendaraan Baru'}</h1>
                            <p className="text-slate-500 text-sm">Lengkapi rincian data kendaraan operasional.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Photo Section */}
                        <div className="md:col-span-1 space-y-4">
                            <label className="block text-sm font-bold text-slate-700">Foto Kendaraan</label>
                            <div className="aspect-video rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden relative group">
                                {form.photo ? (
                                    <img src={form.photo} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                        <Camera size={32} strokeWidth={1.5} />
                                        <span className="text-[10px] mt-2 font-medium">Klik untuk upload</span>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                {form.photo && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-white text-xs font-bold">Ganti Foto</p>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 text-center">Format: JPG, PNG. Rekomendasi 16:9.</p>
                        </div>

                        {/* Info Section */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nama Kendaraan</label>
                                    <input
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700"
                                        placeholder="Contoh: Bus Pariwisata / Avanza Putih"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Plat Nomor</label>
                                    <input
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase"
                                        placeholder="B 1234 ABC"
                                        value={form.plateNumber}
                                        onChange={e => setForm({ ...form, plateNumber: e.target.value.toUpperCase() })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipe Kendaraan</label>
                                    <select
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold"
                                        value={form.type}
                                        onChange={e => setForm({ ...form, type: e.target.value })}
                                    >
                                        <option value="Mobil">Mobil</option>
                                        <option value="Motor">Motor</option>
                                        <option value="Bus">Bus</option>
                                        <option value="Truck">Truck</option>
                                        <option value="Lainnya">Lainnya</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-100 italic">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase">
                                <User size={16} className="text-purple-500" /> Penanggung Jawab (Semua Pengguna)
                            </label>
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cari nama PIC..."
                                    className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none w-full md:w-64"
                                    value={picSearch}
                                    onChange={e => setPicSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            {(users || [])
                                .filter(u => u.name?.toLowerCase().includes(picSearch.toLowerCase()) || (form.picIds || []).includes(u.id))
                                .map(s => (
                                    <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${(form.picIds || []).includes(s.id) ? 'bg-purple-50 border-purple-200 text-purple-700 font-bold' : 'bg-white border-transparent text-slate-500 hover:border-slate-100'}`}>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={form.picIds.includes(s.id)}
                                            onChange={() => {
                                                const newPicIds = form.picIds.includes(s.id)
                                                    ? form.picIds.filter(id => id !== s.id)
                                                    : [...form.picIds, s.id];
                                                setForm({ ...form, picIds: newPicIds });
                                            }}
                                        />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${form.picIds.includes(s.id) ? 'bg-purple-500 border-purple-500 text-white' : 'border-slate-300'}`}>
                                            {form.picIds.includes(s.id) && <div className="text-[10px]">✓</div>}
                                        </div>
                                        <span className="text-xs truncate">{s.name}</span>
                                    </label>
                                ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 italic">*PIC yang dipilih akan menerima notifikasi WhatsApp untuk menyetujui/menolak peminjaman.</p>
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <MapPin size={14} className="text-blue-500" /> Merk
                            </label>
                            <input
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                placeholder="Toyota / Honda"
                                value={form.brand}
                                onChange={e => setForm({ ...form, brand: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Model / Varian</label>
                            <input
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                placeholder="Avanza G / Vario 160"
                                value={form.model}
                                onChange={e => setForm({ ...form, model: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <Palette size={14} className="text-pink-500" /> Warna
                            </label>
                            <input
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                placeholder="Putih / Hitam"
                                value={form.color}
                                onChange={e => setForm({ ...form, color: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <Fuel size={14} className="text-orange-500" /> Bahan Bakar
                            </label>
                            <select
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                                value={form.fuelType}
                                onChange={e => setForm({ ...form, fuelType: e.target.value })}
                            >
                                <option value="Pertalite">Pertalite</option>
                                <option value="Pertamax">Pertamax</option>
                                <option value="Solar">Solar</option>
                                <option value="Dexlite">Dexlite</option>
                                <option value="Listrik">Listrik</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kapasitas (Kursi)</label>
                            <input
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                placeholder="Contoh: 7 Kursi / 40 Kursi"
                                value={form.capacity}
                                onChange={e => setForm({ ...form, capacity: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <Gauge size={14} className="text-green-500" /> Kilometer (ODO)
                            </label>
                            <input
                                type="number"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-bold"
                                value={form.odometer}
                                onChange={e => setForm({ ...form, odometer: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <Calendar size={14} className="text-orange-600" /> Jatuh Tempo Pajak
                            </label>
                            <input
                                type="date"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-mono"
                                value={form.taxDueDate}
                                onChange={e => setForm({ ...form, taxDueDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <Calendar size={14} className="text-red-600" /> Jatuh Tempo STNK (5 Thn)
                            </label>
                            <input
                                type="date"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-mono"
                                value={form.stnkDueDate}
                                onChange={e => setForm({ ...form, stnkDueDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                <Calendar size={14} className="text-blue-600" /> Jadwal KIR (Opsional)
                            </label>
                            <input
                                type="date"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-mono"
                                value={form.kirDueDate}
                                onChange={e => setForm({ ...form, kirDueDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, status: 'ACTIVE' })}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.status === 'ACTIVE' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}
                                >
                                    Aktif
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, status: 'INACTIVE' })}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${form.status === 'INACTIVE' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}
                                >
                                    Non-Aktif
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/kendaraan/data')}
                            className="px-8 py-3 rounded-xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all font-mono"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-10 py-3 rounded-xl font-black hover:bg-blue-700 shadow-xl shadow-blue-600/30 transition-all transform hover:-translate-y-1 flex items-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <><Save size={20} /> SIMPAN DATA KENDARAAN</>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default VehicleForm;
