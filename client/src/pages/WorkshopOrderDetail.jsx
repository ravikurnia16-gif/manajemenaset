import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import Swal from 'sweetalert2';
import {
    ArrowLeft,
    Clock,
    CheckCircle,
    Package,
    Calendar,
    User,
    HardHat,
    Cog,
    FileText,
    Camera,
    PlusCircle,
    Activity
} from 'lucide-react';

function WorkshopOrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    const userStr = localStorage.getItem('user');
    const userObj = userStr ? JSON.parse(userStr) : null;
    const isWorkshopAdmin = userObj && (
        ['SUPER_ADMIN', 'ADMIN_ASET'].includes(userObj.role) || 
        (userObj.unit?.name || '').toLowerCase().includes('workshop') ||
        userObj.unitId === 21
    );

    const canCancel = userObj && (
        ['SUPER_ADMIN', 'ADMIN_ASET'].includes(userObj.role) || 
        userObj.unitId === 21
    );

    // Form states
    const [statusForm, setStatusForm] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusMsg, setStatusMsg] = useState('');
    
    const [progressForm, setProgressForm] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');
    const [progressPercent, setProgressPercent] = useState('');
    const [photoBase64, setPhotoBase64] = useState(null);

    // Edit Details Form states
    const [detailsForm, setDetailsForm] = useState(false);
    const [editWorkshopType, setEditWorkshopType] = useState('');
    const [editItems, setEditItems] = useState([]);

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const fetchOrder = async () => {
        try {
            const res = await api.get(`/workshop/orders/${id}`);
            setOrder(res.data);
            setNewStatus(res.data.status);
            setEditWorkshopType(res.data.workshopType || '');
            setEditItems(res.data.items?.map(it => ({ id: it.id, name: it.name, estimatedPrice: it.estimatedPrice || 0 })) || []);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Gagal memuat detail pesanan', 'error');
            navigate('/workshop/orders');
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
            Swal.fire('Peringatan', 'Foto wajib diunggah saat menyelesaikan pesanan (Status: COMPLETED).', 'warning');
            return;
        }

        try {
            await api.put(`/workshop/orders/${id}/status`, {
                status: newStatus,
                message: statusMsg,
                photoBase64: photoBase64
            });
            Swal.fire('Berhasil', 'Status berhasil diperbarui', 'success');
            setStatusForm(false);
            setPhotoBase64(null);
            fetchOrder();
        } catch (error) {
            Swal.fire('Gagal', error.response?.data?.error || 'Terjadi kesalahan', 'error');
        }
    };

    const handleAddProgress = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/workshop/orders/${id}/progress`, {
                message: progressMsg,
                percentage: progressPercent,
                photoBase64: photoBase64
            });
            Swal.fire('Berhasil', 'Progress berhasil ditambahkan', 'success');
            setProgressForm(false);
            setProgressMsg('');
            setProgressPercent('');
            setPhotoBase64(null);
            fetchOrder();
        } catch (error) {
            Swal.fire('Gagal', error.response?.data?.error || 'Terjadi kesalahan', 'error');
        }
    };

    const handleCancelOrder = () => {
        Swal.fire({
            title: 'Tolak / Batalkan Pesanan',
            text: 'Masukkan alasan pembatalan atau penolakan:',
            input: 'textarea',
            inputPlaceholder: 'Alasan penolakan...',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Ya, Batalkan',
            cancelButtonText: 'Tutup',
            inputValidator: (value) => {
                if (!value) {
                    return 'Alasan pembatalan wajib diisi!';
                }
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await api.put(`/workshop/orders/${id}/status`, {
                        status: 'CANCELLED',
                        message: `Pesanan Ditolak/Dibatalkan. Alasan: ${result.value}`
                    });
                    Swal.fire('Dibatalkan', 'Pesanan telah berhasil dibatalkan.', 'success');
                    fetchOrder();
                } catch (error) {
                    Swal.fire('Gagal', error.response?.data?.error || 'Terjadi kesalahan saat membatalkan', 'error');
                }
            }
        });
    };

    const handleUpdateDetails = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/workshop/orders/${id}/details`, {
                workshopType: editWorkshopType,
                items: editItems
            });
            Swal.fire('Berhasil', 'Detail pesanan berhasil diperbarui', 'success');
            setDetailsForm(false);
            fetchOrder();
        } catch (error) {
            Swal.fire('Gagal', error.response?.data?.error || 'Terjadi kesalahan', 'error');
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Memuat detail...</div>;
    if (!order) return <div className="p-10 text-center text-red-500">Pesanan tidak ditemukan.</div>;

    const getStatusColor = (status) => {
        const colors = {
            DRAFT: 'bg-gray-100 text-gray-800 border-gray-200',
            PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
            QUALITY_CHECK: 'bg-purple-100 text-purple-800 border-purple-200',
            COMPLETED: 'bg-green-100 text-green-800 border-green-200',
            CANCELLED: 'bg-red-100 text-red-800 border-red-200'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const isDone = order.status === 'COMPLETED' || order.status === 'CANCELLED';

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-gray-600" />
                    </button>
                    <div>
                        <div className="flex items-center space-x-3 mb-1">
                            <h1 className="text-2xl font-bold text-gray-800">{order.code}</h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                                {order.status.replace('_', ' ')}
                            </span>
                            <span className={`px-2 py-1 flex items-center text-xs font-bold rounded ${order.workshopType === 'KAYU' ? 'bg-orange-100 text-orange-800' : order.workshopType === 'BESI' ? 'bg-slate-100 text-slate-800' : 'bg-gray-100 text-gray-800'}`}>
                                {order.workshopType === 'KAYU' ? <HardHat size={12} className="mr-1" /> : order.workshopType === 'BESI' ? <Cog size={12} className="mr-1" /> : null}
                                {order.workshopType || 'Belum Ditentukan'}
                            </span>
                            {order.priority === 'URGENT' && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">URGENT</span>
                            )}
                        </div>
                        <h2 className="text-lg text-gray-600">{order.title}</h2>
                    </div>
                </div>
                <div className="flex space-x-2">
                    {/* Button Surat Pesanan di-hide sesuai request */}
                    {/* {order.officeDocument && (
                        <Link to={`/e-office/documents/${order.officeDocument.id}`} className="flex items-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium border border-indigo-200 transition-colors">
                            <FileText size={16} className="mr-2" />
                            Surat Pesanan
                        </Link>
                    )} */}
                    {isWorkshopAdmin && !isDone && (
                        <button onClick={() => setDetailsForm(true)} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            Update Detail
                        </button>
                    )}
                    {canCancel && order.status === 'PENDING' && (
                        <button onClick={handleCancelOrder} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                            Tolak / Batalkan
                        </button>
                    )}
                    {!isDone && (
                        <button onClick={() => { setPhotoBase64(null); setStatusForm(true); }} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            Update Status
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Info & Items */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* General Info */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 font-semibold text-gray-700 flex items-center">
                            <Activity size={18} className="mr-2 text-gray-500"/> Informasi Pesanan
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Pemohon</p>
                                <div className="flex items-center">
                                    <User size={16} className="text-gray-400 mr-2" />
                                    <span className="font-medium text-gray-800">{order.requestedBy?.name}</span>
                                </div>
                                <p className="text-sm text-gray-600 ml-6">{order.unit?.name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Workshop Tujuan</p>
                                <div className="font-medium text-gray-800">{order.workshopUnit?.name || 'Internal Workshop'}</div>
                                {order.picName && <div className="text-sm text-gray-600">PIC: {order.picName}</div>}
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Tanggal Pesanan</p>
                                <div className="flex items-center text-sm font-medium text-gray-800">
                                    <Calendar size={16} className="text-gray-400 mr-2" />
                                    {new Date(order.orderDate).toLocaleDateString('id-ID')}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Target Selesai (Deadline)</p>
                                <div className="flex items-center text-sm font-medium text-gray-800">
                                    <Clock size={16} className="text-gray-400 mr-2" />
                                    {order.deadline ? new Date(order.deadline).toLocaleDateString('id-ID') : '-'}
                                </div>
                            </div>
                            {order.completionDate && (
                                <div>
                                    <p className="text-xs text-emerald-600 mb-1 font-semibold">Selesai Aktual</p>
                                    <div className="flex items-center text-sm font-bold text-emerald-700">
                                        <CheckCircle size={16} className="mr-2" />
                                        {new Date(order.completionDate).toLocaleString('id-ID')}
                                    </div>
                                </div>
                            )}
                        </div>
                        {order.procurement && (
                            <div className="p-4 border-t border-blue-100 bg-blue-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-blue-600 font-medium">Terkait Pengadaan</p>
                                        <p className="text-sm text-blue-800 font-semibold">{order.procurement.code} - {order.procurement.title}</p>
                                    </div>
                                    <Link to={`/procurements/${order.procurementId}`} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Lihat Pengadaan</Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Items List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 font-semibold text-gray-700 flex items-center justify-between">
                            <div className="flex items-center"><Package size={18} className="mr-2 text-gray-500"/> Item Pekerjaan</div>
                            <div className="text-sm text-gray-500 font-normal">Total: {order.items?.length || 0} Item</div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 text-xs text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Nama / Spesifikasi</th>
                                        <th className="px-4 py-3 text-center">Jumlah</th>
                                        <th className="px-4 py-3 text-right">Est. Harga Satuan</th>
                                        <th className="px-4 py-3 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {order.items?.map((item, idx) => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-800">{item.name}</div>
                                                <div className="text-xs text-gray-500 mt-1">{item.spec || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="font-medium text-gray-800">{item.qty}</span> <span className="text-xs text-gray-500">{item.unit}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-600">
                                                Rp {(item.estimatedPrice || 0).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-gray-700">
                                                Rp {((item.estimatedPrice || 0) * (item.qty || 1)).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 font-bold text-gray-800">
                                        <td colSpan="2" className="px-4 py-3 text-right">Total Estimasi Keseluruhan:</td>
                                        <td colSpan="2" className="px-4 py-3 text-right text-emerald-600 text-lg">
                                            Rp {(order.estimatedCost || 0).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Progress Timeline */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full max-h-[800px]">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 font-semibold text-gray-700 flex justify-between items-center">
                            <span>Riwayat Progress</span>
                            {(order.status === 'IN_PROGRESS' || order.status === 'QUALITY_CHECK') && (
                                <button onClick={() => setProgressForm(true)} className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-1 rounded flex items-center">
                                    <PlusCircle size={14} className="mr-1" /> Tambah
                                </button>
                            )}
                        </div>
                        
                        <div className="p-5 flex-1 overflow-y-auto">
                            {order.progress?.length === 0 ? (
                                <div className="text-center text-gray-400 py-10 text-sm">Belum ada progress tercatat.</div>
                            ) : (
                                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-gray-200 before:via-gray-200 before:to-transparent">
                                    {order.progress?.map((prog, idx) => (
                                        <div key={prog.id} className="relative flex items-start md:justify-between group">
                                            {/* Line marker */}
                                            <div className="absolute left-0 md:left-1/2 w-10 h-10 -translate-x-1/2 flex items-center justify-center">
                                                <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                                            </div>
                                            
                                            <div className={`w-full ml-10 md:w-[calc(50%-2.5rem)] md:ml-0 ${idx % 2 === 0 ? 'md:mr-auto md:text-right' : 'md:ml-auto md:text-left'} bg-white border border-gray-100 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow`}>
                                                <div className={`flex items-center text-xs text-gray-500 mb-2 ${idx % 2 === 0 ? 'md:justify-end' : ''}`}>
                                                    <Clock size={12} className="mr-1" /> {new Date(prog.createdAt).toLocaleString('id-ID')}
                                                </div>
                                                <p className="text-sm text-gray-800 font-medium mb-1">{prog.message}</p>
                                                {prog.percentage > 0 && (
                                                    <div className="mt-2">
                                                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                                                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${prog.percentage}%` }}></div>
                                                        </div>
                                                        <span className="text-xs text-gray-500">{prog.percentage}% Selesai</span>
                                                    </div>
                                                )}
                                                {prog.photo && (
                                                    <a href={prog.photo} target="_blank" rel="noreferrer" className="mt-3 block">
                                                        <img src={prog.photo} alt="Progress" className="w-full h-32 object-cover rounded border border-gray-200 hover:opacity-90" />
                                                    </a>
                                                )}
                                                <div className="mt-2 text-[10px] text-gray-400">Oleh: {prog.user?.name || 'Sistem'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            
            {/* Modal Update Status */}
            {statusForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold mb-4">Update Status Pesanan</h3>
                        <form onSubmit={handleUpdateStatus}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status Baru</label>
                                <select 
                                    value={newStatus} 
                                    onChange={(e) => setNewStatus(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value="DRAFT">DRAFT</option>
                                    <option value="PENDING">PENDING</option>
                                    <option value="IN_PROGRESS">IN PROGRESS</option>
                                    <option value="QUALITY_CHECK">QUALITY CHECK</option>
                                    <option value="COMPLETED">COMPLETED</option>
                                    <option value="CANCELLED">CANCELLED</option>
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Tambahan (Opsional)</label>
                                <textarea 
                                    rows="3" 
                                    value={statusMsg}
                                    onChange={(e) => setStatusMsg(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="Alasan perubahan status..."
                                ></textarea>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Foto Status / Progres {newStatus === 'COMPLETED' ? <span className="text-red-500">*</span> : '(Opsional)'}
                                </label>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    required={newStatus === 'COMPLETED'}
                                    onChange={handlePhotoChange}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                                {photoBase64 && (
                                    <img src={photoBase64} alt="Preview" className="mt-2 h-24 object-cover rounded border" />
                                )}
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button type="button" onClick={() => { setStatusForm(false); setPhotoBase64(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
                                <button type="submit" className="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Simpan Status</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Add Progress */}
            {progressForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold mb-4">Catat Progress Pekerjaan</h3>
                        <form onSubmit={handleAddProgress}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Progress *</label>
                                <textarea 
                                    required
                                    rows="3" 
                                    value={progressMsg}
                                    onChange={(e) => setProgressMsg(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="Contoh: Pemotongan kayu selesai, lanjut perakitan..."
                                ></textarea>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estimasi % Selesai (Opsional)</label>
                                <input 
                                    type="number" 
                                    min="0" max="100"
                                    value={progressPercent}
                                    onChange={(e) => setProgressPercent(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="0 - 100"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Foto Progress (Opsional)</label>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                                {photoBase64 && (
                                    <img src={photoBase64} alt="Preview" className="mt-2 h-24 object-cover rounded border" />
                                )}
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button type="button" onClick={() => setProgressForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
                                <button type="submit" className="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Simpan Progress</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Update Detail (WorkshopType & Estimated Prices) */}
            {detailsForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-4">Update Detail Pesanan Workshop</h3>
                        <form onSubmit={handleUpdateDetails}>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tipe Workshop (Tujuan)</label>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setEditWorkshopType('KAYU')}
                                        className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                                            editWorkshopType === 'KAYU' ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 text-gray-500 hover:border-orange-200'
                                        }`}
                                    >
                                        <div className="font-bold">Workshop Kayu</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditWorkshopType('BESI')}
                                        className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                                            editWorkshopType === 'BESI' ? 'border-slate-500 bg-slate-100 text-slate-800' : 'border-gray-200 text-gray-500 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="font-bold">Workshop Besi</div>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Estimasi Harga Item</label>
                                <div className="space-y-3">
                                    {editItems.map((item, index) => (
                                        <div key={item.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center p-3 border rounded-lg bg-gray-50">
                                            <div className="text-sm font-medium text-gray-700">{item.name}</div>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm text-gray-500">Rp</span>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    value={item.estimatedPrice}
                                                    onChange={(e) => {
                                                        const newItems = [...editItems];
                                                        newItems[index].estimatedPrice = parseFloat(e.target.value) || 0;
                                                        setEditItems(newItems);
                                                    }}
                                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:border-emerald-500 outline-none"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex justify-end space-x-2 mt-6">
                                <button type="button" onClick={() => setDetailsForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
                                <button type="submit" className="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Simpan Detail</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

export default WorkshopOrderDetail;
