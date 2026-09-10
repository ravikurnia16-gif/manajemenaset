import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft,
    HardHat,
    Cog,
    Clock,
    CheckCircle2,
    Calendar,
    Phone,
    User,
    Building2,
    Printer,
    Edit3,
    Camera,
    Plus,
    FileText,
    AlertTriangle,
    X,
    MessageSquare,
    Sparkles,
    ShieldCheck,
    Send
} from 'lucide-react';
import api from '../../lib/axios';
import Swal from 'sweetalert2';

function WorkshopBaruDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    const userStr = localStorage.getItem('user');
    const userObj = userStr ? JSON.parse(userStr) : null;
    const isWorkshopAdmin = userObj && (
        ['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS'].includes(userObj.role) ||
        userObj.unitId === 21 ||
        (userObj.unit?.name || '').toLowerCase().includes('workshop')
    );

    // Modal States
    const [statusModal, setStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusMsg, setStatusMsg] = useState('');

    const [progressModal, setProgressModal] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');
    const [progressPercent, setProgressPercent] = useState('');
    const [photoBase64, setPhotoBase64] = useState(null);

    const [detailsModal, setDetailsModal] = useState(false);
    const [editWorkshopType, setEditWorkshopType] = useState('');
    const [editDeadline, setEditDeadline] = useState('');
    const [editItems, setEditItems] = useState([]);

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/workshop/orders/${id}`);
            setOrder(res.data);
            setNewStatus(res.data.status);
            setEditWorkshopType(res.data.workshopType || '');
            setEditDeadline(res.data.deadline ? new Date(res.data.deadline).toISOString().split('T')[0] : '');
            setEditItems(res.data.items?.map(it => ({ id: it.id, name: it.name, estimatedPrice: it.estimatedPrice || 0 })) || []);
        } catch (error) {
            console.error('Failed to fetch order detail:', error);
            Swal.fire('Error', 'Gagal memuat detail pesanan workshop.', 'error');
            navigate('/workshop-baru/board');
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                Swal.fire('Error', 'Ukuran foto maksimal 2MB', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoBase64(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateStatus = async (e) => {
        e.preventDefault();

        if (newStatus === 'COMPLETED' && !photoBase64) {
            Swal.fire('Peringatan', 'Foto bukti hasil pengerjaan wajib diunggah untuk status Selesai (COMPLETED).', 'warning');
            return;
        }

        try {
            await api.put(`/workshop/orders/${id}/status`, {
                status: newStatus,
                message: statusMsg,
                photoBase64: photoBase64
            });
            Swal.fire('Berhasil', 'Status pesanan berhasil diperbarui.', 'success');
            setStatusModal(false);
            setPhotoBase64(null);
            setStatusMsg('');
            fetchOrder();
        } catch (error) {
            Swal.fire('Gagal', error.response?.data?.error || 'Gagal mengubah status', 'error');
        }
    };

    const handleAddProgress = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/workshop/orders/${id}/progress`, {
                message: progressMsg,
                percentage: progressPercent ? parseInt(progressPercent) : 0,
                photoBase64: photoBase64
            });
            Swal.fire('Berhasil', 'Catatan progres berhasil ditambahkan.', 'success');
            setProgressModal(false);
            setProgressMsg('');
            setProgressPercent('');
            setPhotoBase64(null);
            fetchOrder();
        } catch (error) {
            Swal.fire('Gagal', error.response?.data?.error || 'Gagal menambahkan progres', 'error');
        }
    };

    const handleCancelOrder = () => {
        Swal.fire({
            title: 'Tolak / Batalkan Pesanan',
            text: 'Masukkan alasan pembatalan pekerjaan workshop:',
            input: 'textarea',
            inputPlaceholder: 'Tuliskan alasan penolakan...',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Ya, Batalkan',
            cancelButtonText: 'Tutup',
            inputValidator: (value) => {
                if (!value) return 'Alasan pembatalan wajib diisi!';
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await api.put(`/workshop/orders/${id}/status`, {
                        status: 'CANCELLED',
                        message: `Pesanan Ditolak/Dibatalkan: ${result.value}`
                    });
                    Swal.fire('Dibatalkan', 'Pesanan telah dibatalkan.', 'success');
                    fetchOrder();
                } catch (error) {
                    Swal.fire('Gagal', error.response?.data?.error || 'Terjadi kesalahan', 'error');
                }
            }
        });
    };

    const handleUpdateDetails = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/workshop/orders/${id}/details`, {
                workshopType: editWorkshopType,
                deadline: editDeadline || null,
                items: editItems
            });
            Swal.fire('Berhasil', 'Detail pesanan berhasil diperbarui.', 'success');
            setDetailsModal(false);
            fetchOrder();
        } catch (error) {
            Swal.fire('Gagal', error.response?.data?.error || 'Terjadi kesalahan', 'error');
        }
    };

    const handlePrintSPK = () => {
        window.print();
    };

    if (loading || !order) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-medium">Memuat detail pesanan workshop...</p>
            </div>
        );
    }

    const latestProgress = order.progress && order.progress.length > 0 ? order.progress[0] : null;
    const currentPercent = latestProgress?.percentage || (order.status === 'COMPLETED' ? 100 : (order.status === 'IN_PROGRESS' ? 40 : 0));

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
            {/* Action Bar / Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <button
                    onClick={() => navigate('/workshop-baru/board')}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-colors"
                >
                    <ArrowLeft size={16} /> Kembali ke Papan Kerja
                </button>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handlePrintSPK}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-colors"
                    >
                        <Printer size={16} /> Cetak SPK Lembar Kerja
                    </button>

                    {isWorkshopAdmin && (
                        <>
                            <button
                                onClick={() => setDetailsModal(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-colors"
                            >
                                <Edit3 size={16} /> Edit Info / Harga
                            </button>

                            <button
                                onClick={() => setProgressModal(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors"
                            >
                                <Camera size={16} /> Update Progres Foto
                            </button>

                            <button
                                onClick={() => setStatusModal(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
                            >
                                <CheckCircle2 size={16} /> Ubah Status
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Printable SPK Header */}
            <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
                <h2 className="text-xl font-black uppercase tracking-wider">Surat Perintah Kerja (SPK) Workshop</h2>
                <p className="text-xs text-slate-600 mt-1">Unit 21 • Divisi Workshop & Fabrikasi (Kayu & Besi)</p>
            </div>

            {/* Main Header Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-mono text-sm font-black bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                                {order.code}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                order.workshopType === 'KAYU' ? 'bg-orange-100 text-orange-800' : 'bg-slate-200 text-slate-800'
                            }`}>
                                {order.workshopType === 'KAYU' ? '🪵 Workshop Kayu' : (order.workshopType === 'BESI' ? '⚙️ Workshop Besi' : 'Umum')}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                                order.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' :
                                order.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                                Prioritas: {order.priority}
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900">{order.title}</h1>
                        <p className="text-xs text-slate-500 mt-1">
                            Diajukan pada {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>

                    <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status Pekerjaan</div>
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                            order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            order.status === 'QUALITY_CHECK' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                            order.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                            'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                            {order.status}
                        </span>

                        {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && isWorkshopAdmin && (
                            <button
                                onClick={handleCancelOrder}
                                className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold print:hidden mt-1"
                            >
                                Tolak / Batalkan Pesanan
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1.5">
                        <span>Penyelesaian Fisik</span>
                        <span className="text-emerald-600 font-black">{currentPercent}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${currentPercent}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Grid 2 Columns: Requestor Info & Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Requestor / Unit Info */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 size={16} /> Informasi Pemesan
                    </h3>

                    <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                            <span className="text-slate-500">Unit Pemesan</span>
                            <strong className="text-slate-800">{order.unit?.name || '-'}</strong>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                            <span className="text-slate-500">Nama Pemohon</span>
                            <strong className="text-slate-800">{order.requestedBy?.name || order.requestedBy?.username || '-'}</strong>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                            <span className="text-slate-500">Nomor Kontak</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-800">{order.requestedBy?.phone || '-'}</span>
                                {order.requestedBy?.phone && (
                                    <a
                                        href={`https://wa.me/${order.requestedBy.phone.replace(/[^0-9]/g, '')}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-emerald-600 hover:text-emerald-700 print:hidden font-bold"
                                        title="Chat WhatsApp"
                                    >
                                        <Phone size={14} />
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-100">
                            <span className="text-slate-500">PIC Workshop (Unit 21)</span>
                            <strong className="text-slate-800">{order.picName || 'Belum Ditugaskan'}</strong>
                        </div>
                        <div className="flex justify-between py-1.5">
                            <span className="text-slate-500">Target Selesai (Deadline)</span>
                            <strong className="text-slate-800">
                                {order.deadline ? new Date(order.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                            </strong>
                        </div>
                    </div>

                    {order.notes && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600">
                            <span className="font-bold block text-slate-700 mb-1">Catatan Pemesan:</span>
                            {order.notes}
                        </div>
                    )}
                </div>

                {/* Estimation & Financial Summary */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock size={16} /> Riwayat & Waktu Pengerjaan
                        </h3>

                        <div className="space-y-2.5 text-xs mt-3">
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                                <span className="text-slate-500">Tanggal Masuk</span>
                                <strong className="text-slate-800">
                                    {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </strong>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                                <span className="text-slate-500">Mulai Pengerjaan</span>
                                <strong className="text-slate-800">
                                    {order.startDate ? new Date(order.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Belum Dimulai'}
                                </strong>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                                <span className="text-slate-500">Tanggal Selesai Aktual</span>
                                <strong className="text-slate-800">
                                    {order.completionDate ? new Date(order.completionDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                </strong>
                            </div>
                            <div className="flex justify-between py-1.5">
                                <span className="text-slate-500">Total Estimasi Biaya</span>
                                <strong className="text-emerald-700 text-sm font-black">
                                    Rp {(order.estimatedCost || 0).toLocaleString('id-ID')}
                                </strong>
                            </div>
                        </div>
                    </div>

                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-800 flex items-center gap-2">
                        <Sparkles size={16} className="text-emerald-600 shrink-0" />
                        <span>Dikelola dan diawasi langsung oleh Tim Workshop Unit 21.</span>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                    Daftar Barang & Rincian Pekerjaan ({order.items?.length || 0})
                </h3>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="p-3">No</th>
                                <th className="p-3">Nama Barang / Pekerjaan</th>
                                <th className="p-3">Spesifikasi Detail</th>
                                <th className="p-3 text-center">Jumlah</th>
                                <th className="p-3 text-right">Estimasi Harga</th>
                                <th className="p-3 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {order.items?.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                                    <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                                    <td className="p-3 text-slate-600 max-w-sm whitespace-pre-wrap">{item.spec || '-'}</td>
                                    <td className="p-3 text-center font-bold text-slate-800">
                                        {item.qty} {item.unit}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-600">
                                        Rp {(item.estimatedPrice || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-800">
                                        Rp {((item.estimatedPrice || 0) * (item.qty || 1)).toLocaleString('id-ID')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                            <tr>
                                <td colSpan="5" className="p-3 text-right text-slate-700">Total Estimasi</td>
                                <td className="p-3 text-right text-emerald-700 font-black font-mono">
                                    Rp {(order.estimatedCost || 0).toLocaleString('id-ID')}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Progress Log & Photos Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                        Log Progres & Dokumentasi Foto Bengkel
                    </h3>
                    {isWorkshopAdmin && (
                        <button
                            onClick={() => setProgressModal(true)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 print:hidden"
                        >
                            <Plus size={14} /> Tambah Dokumentasi
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    {order.progress && order.progress.length > 0 ? (
                        order.progress.map((prog, idx) => (
                            <div key={prog.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row gap-4">
                                {prog.photo && (
                                    <div className="shrink-0">
                                        <img
                                            src={prog.photo}
                                            alt="Progres Workshop"
                                            className="w-28 h-28 object-cover rounded-xl border border-slate-200 shadow-xs"
                                        />
                                    </div>
                                )}
                                <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="font-bold text-slate-700">
                                            {prog.user?.name || prog.user?.username || 'Petugas Workshop'}
                                        </span>
                                        <span>
                                            {new Date(prog.createdAt).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <div className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold text-[10px]">
                                        Progres: {prog.percentage}%
                                    </div>
                                    <p className="text-xs text-slate-700 whitespace-pre-wrap mt-1">
                                        {prog.message}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                            Belum ada catatan progres pengerjaan untuk pesanan ini.
                        </div>
                    )}
                </div>
            </div>

            {/* Print Signatures */}
            <div className="hidden print:grid grid-cols-3 gap-6 pt-10 text-center text-xs">
                <div>
                    <p className="text-slate-500 mb-16">Pemohon (Unit)</p>
                    <p className="font-bold underline">{order.requestedBy?.name || '........................'}</p>
                </div>
                <div>
                    <p className="text-slate-500 mb-16">PIC Workshop (Unit 21)</p>
                    <p className="font-bold underline">{order.picName || '........................'}</p>
                </div>
                <div>
                    <p className="text-slate-500 mb-16">Kepala Bidang Sarana</p>
                    <p className="font-bold underline">........................</p>
                </div>
            </div>

            {/* --- MODAL: Ubah Status --- */}
            {statusModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-800 text-sm">Ubah Status Pesanan Workshop</h3>
                            <button onClick={() => setStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateStatus} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Pilih Status Baru</label>
                                <select
                                    value={newStatus}
                                    onChange={e => setNewStatus(e.target.value)}
                                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                >
                                    <option value="PENDING">PENDING (Antrean)</option>
                                    <option value="IN_PROGRESS">IN_PROGRESS (Sedang Dikerjakan)</option>
                                    <option value="QUALITY_CHECK">QUALITY_CHECK (Pemeriksaan QC)</option>
                                    <option value="COMPLETED">COMPLETED (Selesai)</option>
                                </select>
                            </div>

                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Catatan Perubahan Status</label>
                                <textarea
                                    rows={3}
                                    value={statusMsg}
                                    onChange={e => setStatusMsg(e.target.value)}
                                    placeholder="Tuliskan catatan pengerjaan atau kondisi fisik..."
                                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-600 block mb-1">
                                    Upload Foto {newStatus === 'COMPLETED' ? '(Wajib Selesai)' : '(Opsional)'}
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                />
                                {photoBase64 && (
                                    <img src={photoBase64} alt="Preview" className="w-20 h-20 object-cover rounded-lg mt-2 border" />
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setStatusModal(false)}
                                    className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-semibold"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                >
                                    Simpan Status
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: Tambah Progres & Foto --- */}
            {progressModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-800 text-sm">Dokumentasi Progres Bengkel</h3>
                            <button onClick={() => setProgressModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddProgress} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Persentase Pengerjaan (0 - 100%)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={progressPercent}
                                    onChange={e => setProgressPercent(e.target.value)}
                                    placeholder="Contoh: 50"
                                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Uraian Progres</label>
                                <textarea
                                    rows={3}
                                    value={progressMsg}
                                    onChange={e => setProgressMsg(e.target.value)}
                                    placeholder="Contoh: Rangka besi telah dilas dan siap dicat dasar anti-karat."
                                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Upload Foto Progres</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                {photoBase64 && (
                                    <img src={photoBase64} alt="Preview" className="w-20 h-20 object-cover rounded-lg mt-2 border" />
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setProgressModal(false)}
                                    className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-semibold"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                >
                                    Simpan Progres
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: Edit Details & Harga --- */}
            {detailsModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-800 text-sm">Edit Tipe & Estimasi Harga</h3>
                            <button onClick={() => setDetailsModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateDetails} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-slate-600 block mb-1">Tipe Workshop</label>
                                    <select
                                        value={editWorkshopType}
                                        onChange={e => setEditWorkshopType(e.target.value)}
                                        className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="">Pilih Tipe</option>
                                        <option value="KAYU">🪵 Workshop Kayu</option>
                                        <option value="BESI">⚙️ Workshop Besi</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-slate-600 block mb-1">Batas Waktu (Deadline)</label>
                                    <input
                                        type="date"
                                        value={editDeadline}
                                        onChange={e => setEditDeadline(e.target.value)}
                                        className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="font-bold text-slate-700 block">Estimasi Harga Satuan per Item (Rp)</label>
                                {editItems.map((item, idx) => (
                                    <div key={item.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                                        <span className="flex-1 font-semibold text-slate-800 truncate">{item.name}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-400 font-mono">Rp</span>
                                            <input
                                                type="number"
                                                value={item.estimatedPrice}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, estimatedPrice: val } : it));
                                                }}
                                                className="w-28 p-1.5 border border-slate-200 rounded-lg text-right font-mono outline-none bg-white"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setDetailsModal(false)}
                                    className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-semibold"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                >
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkshopBaruDetail;
