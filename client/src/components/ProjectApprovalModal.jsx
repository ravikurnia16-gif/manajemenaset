import React, { useState, useEffect } from 'react';
import { 
    CheckCircle, 
    XCircle, 
    Clock, 
    Printer, 
    FileText, 
    ShieldCheck, 
    AlertCircle, 
    Send, 
    Calendar, 
    User, 
    DollarSign, 
    Package, 
    X,
    Minus,
    Plus,
    RotateCcw
} from 'lucide-react';
import api from '../lib/axios';

export const ProjectApprovalModal = ({ 
    isOpen, 
    onClose, 
    project, 
    type = 'INVENTORY', // 'INVENTORY' | 'UNIFORM'
    onSuccess 
}) => {
    if (!isOpen || !project) return null;

    const currentUser = (() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch (e) {
            return {};
        }
    })();

    const userRole = currentUser.role || '';
    const userPosition = (currentUser.position || '').toLowerCase();
    const canApprove = userRole === 'SUPER_ADMIN' || 
                       userRole === 'KABID_SARPRAS' || 
                       userRole === 'KEPALA_BIDANG' || 
                       userPosition.includes('kepala bidang sarana') || 
                       userPosition.includes('kabid sarpras');

    const [action, setAction] = useState('APPROVE'); // 'APPROVE' | 'REJECT'
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [itemQuantities, setItemQuantities] = useState({});

    const isAlreadyApproved = project.approvalStatus === 'APPROVED' || project.status === 'DISETUJUI' || project.status === 'BERJALAN' || project.status === 'SELESAI';
    const isRejected = project.approvalStatus === 'REJECTED' || project.status === 'DITOLAK';

    const items = project.projectItems || [];
    const estimatedBudget = project.budget ? Number(project.budget) : 0;

    // Inisialisasi kuantitas item saat modal dibuka atau project berubah
    useEffect(() => {
        if (project?.projectItems) {
            const initMap = {};
            project.projectItems.forEach(it => {
                initMap[it.id] = it.quantity;
            });
            setItemQuantities(initMap);
        }
        if (project?.approvalNote) {
            setNotes(project.approvalNote);
        } else {
            setNotes('');
        }
    }, [project, isOpen]);

    // Menghitung ringkasan jumlah usulan vs disetujui
    const totalOriginalQty = items.reduce((acc, it) => {
        // Jika sudah pernah disesuaikan sebelumnya, cek riwayat jika ada
        const prevAdj = (project.itemAdjustments || []).find(a => (a.itemId === it.itemId) || (a.variantId === it.variantId));
        const orig = prevAdj ? prevAdj.originalQuantity : it.quantity;
        return acc + (parseInt(orig, 10) || 0);
    }, 0);

    const totalApprovedQty = items.reduce((acc, it) => {
        const q = itemQuantities[it.id] !== undefined ? parseInt(itemQuantities[it.id], 10) : it.quantity;
        return acc + Math.max(0, isNaN(q) ? 0 : q);
    }, 0);

    const totalReduced = Math.max(0, totalOriginalQty - totalApprovedQty);

    const handleApprovalSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSubmitting(true);

        try {
            const endpoint = type === 'UNIFORM'
                ? `/uniforms/projects/${project.id}/approve`
                : `/inventory/projects/${project.id}/approve`;

            const adjustedItems = items.map(it => {
                const q = itemQuantities[it.id] !== undefined ? parseInt(itemQuantities[it.id], 10) : it.quantity;
                return {
                    id: it.id,
                    itemId: it.itemId || it.variantId,
                    variantId: it.variantId,
                    quantity: Math.max(0, isNaN(q) ? 0 : q),
                    originalQuantity: it.quantity
                };
            });

            const res = await api.post(endpoint, {
                action,
                notes,
                signature: currentUser.signatureUrl || null,
                adjustedItems
            });

            if (onSuccess) {
                onSuccess(res.data);
            }
            onClose();
        } catch (err) {
            console.error('Approval Error:', err);
            setErrorMsg(err.response?.data?.error || 'Gagal memproses persetujuan proyek');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
                {/* Header Modal */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-base">Lembar Persetujuan Prapengadaan (Proyek)</h3>
                            <p className="text-xs text-slate-500">Pemeriksaan, Penyesuaian Jumlah Item & Disposisi Kepala Bidang Sarana</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            type="button" 
                            onClick={handlePrint} 
                            className="text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                            <Printer size={14} /> Cetak Lembar
                        </button>
                        <button 
                            onClick={onClose} 
                            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Printable Content Area */}
                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto print:max-h-none print:p-0">
                    {/* Official Letterhead / Kop Surat (Visible in print or clean view) */}
                    <div className="border-b-2 border-slate-800 pb-3 text-center">
                        <h2 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-wide uppercase">
                            YAYASAN DAR EL-IMAN PADANG
                        </h2>
                        <h4 className="font-bold text-slate-700 text-xs sm:text-sm uppercase tracking-wider">
                            BIDANG SARANA DAN PRASARANA
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Jl. Gajah Mada No. 1, Kota Padang, Sumatera Barat • Telp / Hotline Sarpras: 0812-3456-7890
                        </p>
                    </div>

                    {/* Title & Status Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Judul Pengadaan / Proyek</span>
                            <h4 className="text-base font-black text-slate-800">{project.title || project.name}</h4>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                <span>Tahun Anggaran: <b className="text-slate-700">{project.year}</b></span>
                                <span>•</span>
                                <span>Tipe: <b className="text-blue-700">{project.projectType || project.type || 'SELEKSI'}</b></span>
                            </div>
                        </div>
                        <div>
                            {isAlreadyApproved ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200">
                                    <CheckCircle size={15} /> Disetujui (ACC)
                                </div>
                            ) : isRejected ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 font-bold text-xs border border-rose-200">
                                    <XCircle size={15} /> Ditolak / Revisi
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 animate-pulse">
                                    <Clock size={15} /> Menunggu Persetujuan Kabid
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Meta Detail Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                <User size={12} /> Unit Pemohon / PIC
                            </span>
                            <p className="font-bold text-slate-800 text-sm">{project.requestedByName || project.pic || 'Staff Bagian Sarana'}</p>
                            <p className="text-[11px] text-slate-500">Diajukan: {project.createdAt ? new Date(project.createdAt).toLocaleDateString('id-ID') : '-'}</p>
                        </div>

                        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                <Calendar size={12} /> Target Waktu Kebutuhan
                            </span>
                            <p className="font-bold text-slate-800 text-sm">
                                {project.targetDate ? new Date(project.targetDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Segera / Menyesuaikan'}
                            </p>
                            <p className="text-[11px] text-slate-500">Deadline operasional pemakaian</p>
                        </div>

                        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                <DollarSign size={12} /> Estimasi Pagu Anggaran
                            </span>
                            <p className="font-bold text-emerald-600 text-sm">
                                {estimatedBudget > 0 ? `Rp ${estimatedBudget.toLocaleString('id-ID')}` : 'Sesuai Penawaran Vendor'}
                            </p>
                            <p className="text-[11px] text-slate-500">Total target: {totalApprovedQty} unit (Usulan: {totalOriginalQty})</p>
                        </div>
                    </div>

                    {/* Urgensi & Latar Belakang */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                        <span className="font-bold text-slate-700 block mb-1 uppercase tracking-wider text-[11px]">
                            Latar Belakang & Urgensi Kebutuhan:
                        </span>
                        <p className="text-slate-600 whitespace-pre-line leading-relaxed italic">
                            "{project.justification || project.note || 'Pengadaan barang operasional untuk mendukung kelancaran kegiatan sarana dan prasarana.'}"
                        </p>
                    </div>

                    {/* Rincian Barang Pengadaan & Penyesuaian Kuantitas */}
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2">
                                <Package size={16} className="text-blue-600" />
                                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                                    Daftar Rincian Barang & Persetujuan Kuantitas:
                                </h4>
                            </div>
                            {canApprove && !isAlreadyApproved && (
                                <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg font-medium">
                                    💡 Kepala Bidang dapat menyesuaikan / mengurangi kuantitas per item di bawah ini
                                </span>
                            )}
                        </div>

                        {items.length === 0 ? (
                            <div className="text-center py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs">
                                Belum ada rincian barang yang dicantumkan dalam proyek ini.
                            </div>
                        ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                                        <tr>
                                            <th className="p-2.5 w-10 text-center">No</th>
                                            <th className="p-2.5">Nama Barang & Spesifikasi</th>
                                            <th className="p-2.5">Kategori / Kode</th>
                                            <th className="p-2.5 text-center w-24">Jml Diajukan</th>
                                            <th className="p-2.5 text-center min-w-[200px]">Jml Disetujui (ACC)</th>
                                            <th className="p-2.5 text-center w-20">Satuan</th>
                                            <th className="p-2.5 text-center w-36">Status Item</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((it, idx) => {
                                            const prevAdj = (project.itemAdjustments || []).find(a => (a.itemId === it.itemId) || (a.variantId === it.variantId));
                                            const originalQty = prevAdj ? prevAdj.originalQuantity : it.quantity;
                                            const currentApprovedQty = itemQuantities[it.id] !== undefined ? itemQuantities[it.id] : it.quantity;
                                            const isReduced = currentApprovedQty < originalQty && currentApprovedQty > 0;
                                            const isCancelled = currentApprovedQty === 0;
                                            const isMatched = currentApprovedQty === originalQty;

                                            return (
                                                <tr key={it.id || idx} className={`transition-colors ${isCancelled ? 'bg-rose-50/40 text-slate-400' : isReduced ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'}`}>
                                                    <td className="p-2.5 text-center font-medium text-slate-400">{idx + 1}</td>
                                                    <td className="p-2.5 font-bold text-slate-800">
                                                        <span className={isCancelled ? 'line-through text-slate-400' : ''}>
                                                            {it.item?.name || it.variant?.item?.name || it.name || 'Barang'}
                                                        </span>
                                                        {it.variant?.sizeName && (
                                                            <span className="ml-2 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold">
                                                                Ukuran: {it.variant.sizeName}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 text-slate-500">
                                                        {it.item?.category?.name || it.variant?.item?.clothingType?.name || it.item?.code || '-'}
                                                    </td>
                                                    <td className="p-2.5 text-center font-semibold text-slate-600">
                                                        {originalQty}
                                                    </td>
                                                    <td className="p-2.5 text-center">
                                                        {canApprove && !isAlreadyApproved ? (
                                                            <div className="flex items-center justify-center gap-1 print:hidden">
                                                                <button
                                                                    type="button"
                                                                    title="Kurangi 1 unit"
                                                                    onClick={() => {
                                                                        const curr = itemQuantities[it.id] !== undefined ? itemQuantities[it.id] : it.quantity;
                                                                        setItemQuantities({ ...itemQuantities, [it.id]: Math.max(0, curr - 1) });
                                                                    }}
                                                                    className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors shadow-2xs"
                                                                >
                                                                    <Minus size={12} />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={originalQty}
                                                                    value={itemQuantities[it.id] !== undefined ? itemQuantities[it.id] : it.quantity}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value === '' ? '' : Math.max(0, Math.min(originalQty, parseInt(e.target.value, 10) || 0));
                                                                        setItemQuantities({ ...itemQuantities, [it.id]: val });
                                                                    }}
                                                                    className={`w-14 text-center font-bold px-1.5 py-1 border rounded-lg text-xs outline-none transition-all ${isCancelled ? 'border-rose-400 bg-rose-50 text-rose-700' : isReduced ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-300 bg-white text-blue-700 focus:border-blue-500'}`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    title="Tambah 1 unit"
                                                                    disabled={currentApprovedQty >= originalQty}
                                                                    onClick={() => {
                                                                        const curr = itemQuantities[it.id] !== undefined ? itemQuantities[it.id] : it.quantity;
                                                                        setItemQuantities({ ...itemQuantities, [it.id]: Math.min(originalQty, curr + 1) });
                                                                    }}
                                                                    className={`w-6 h-6 rounded-md font-bold flex items-center justify-center transition-colors shadow-2xs ${currentApprovedQty >= originalQty ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                                                                >
                                                                    <Plus size={12} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    title="Coret / Batalkan item ini dari usulan"
                                                                    onClick={() => {
                                                                        setItemQuantities({ ...itemQuantities, [it.id]: 0 });
                                                                    }}
                                                                    className="text-[10px] px-1.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold border border-rose-200 transition-colors ml-0.5"
                                                                >
                                                                    Batal (0)
                                                                </button>
                                                                {currentApprovedQty !== originalQty && (
                                                                    <button
                                                                        type="button"
                                                                        title="Reset ke kuantitas awal usulan"
                                                                        onClick={() => {
                                                                            setItemQuantities({ ...itemQuantities, [it.id]: originalQty });
                                                                        }}
                                                                        className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                                                                    >
                                                                        <RotateCcw size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="font-extrabold text-blue-700 text-sm">
                                                                {currentApprovedQty}
                                                            </div>
                                                        )}
                                                        <div className="hidden print:block text-center font-bold">
                                                            {currentApprovedQty}
                                                        </div>
                                                    </td>
                                                    <td className="p-2.5 text-center text-slate-600">
                                                        {it.item?.unit || it.unit || 'Pcs'}
                                                    </td>
                                                    <td className="p-2.5 text-center">
                                                        {isCancelled ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md">
                                                                ❌ Dicoret (0)
                                                            </span>
                                                        ) : isReduced ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md">
                                                                ⚠️ Dikurangi (-{originalQty - currentApprovedQty})
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                                                ✓ Sesuai Usulan
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Banner Ringkasan Penyesuaian Kuantitas jika ada pengurangan */}
                        {totalReduced > 0 && (
                            <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                                    <span>
                                        Kuantitas disesuaikan oleh Kepala Bidang Sarana: semula <b>{totalOriginalQty} unit</b> disetujui menjadi <b>{totalApprovedQty} unit</b>.
                                    </span>
                                </div>
                                <span className="font-extrabold text-amber-800 bg-white px-2.5 py-1 rounded-lg border border-amber-300 text-[11px] shadow-2xs">
                                    Pengurangan: -{totalReduced} Unit
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Lembar Tanda Tangan & Riwayat Keputusan */}
                    <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-xs">
                        <div className="text-center p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                            <p className="text-slate-500 mb-1">Diajukan Oleh,</p>
                            <p className="font-bold text-slate-700">Staff / Pemohon Sarana</p>
                            <div className="h-16 flex items-center justify-center my-2 text-slate-400 italic text-[11px]">
                                (Tercatat Digital Sistem)
                            </div>
                            <p className="font-bold text-slate-800 underline">{project.requestedByName || currentUser.name || 'Staff Pemohon'}</p>
                            <p className="text-[10px] text-slate-400">Yayasan Dar el-Iman</p>
                        </div>

                        <div className="text-center p-4 border border-blue-200 rounded-xl bg-blue-50/30">
                            <p className="text-slate-500 mb-1">Disetujui & Disahkan Oleh,</p>
                            <p className="font-bold text-blue-900">Kepala Bidang Sarana</p>
                            
                            <div className="h-16 flex flex-col items-center justify-center my-2">
                                {isAlreadyApproved ? (
                                    <div className="border border-emerald-500 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-lg text-center shadow-xs">
                                        <div className="flex items-center justify-center gap-1 font-extrabold text-[11px] text-emerald-700 uppercase tracking-wider">
                                            <ShieldCheck size={13} /> TTE DISAHKAN (ACC)
                                        </div>
                                        <p className="text-[9px] text-emerald-600 mt-0.5">
                                            {project.approvedAt ? new Date(project.approvedAt).toLocaleString('id-ID') : 'Valid E-Signature'}
                                        </p>
                                    </div>
                                ) : isRejected ? (
                                    <div className="border border-rose-400 bg-rose-50 text-rose-700 px-3 py-1 rounded-lg text-xs font-bold">
                                        REVISI / DITOLAK
                                    </div>
                                ) : (
                                    <div className="border border-dashed border-amber-300 bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-[11px] font-medium">
                                        Menunggu ACC Kabid
                                    </div>
                                )}
                            </div>

                            <p className="font-bold text-slate-800 underline">{project.approvedByName || 'Ravi Kurnia, S.Pd.I'}</p>
                            <p className="text-[10px] text-slate-500">Kepala Bidang Sarana dan Prasarana</p>
                        </div>
                    </div>

                    {/* Riwayat Catatan Disposisi jika sudah ada */}
                    {project.approvalNote && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                            <span className="font-bold text-amber-800 block mb-1">Catatan / Arahan Disposisi Kepala Bidang Sarana:</span>
                            <p className="text-amber-900 italic">"{project.approvalNote}"</p>
                        </div>
                    )}

                    {/* FORM DISPOSISI KEPALA BIDANG SARANA (Hanya muncul jika berwenang dan belum final) */}
                    {canApprove && !isAlreadyApproved && (
                        <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/40 border-2 border-blue-200 print:hidden space-y-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={18} className="text-blue-600" />
                                <div>
                                    <h4 className="font-extrabold text-sm text-slate-800">
                                        Form Keputusan & Pengesahan TTE Kepala Bidang Sarana
                                    </h4>
                                    <p className="text-[11px] text-slate-500">
                                        Pastikan kuantitas item di atas telah disesuaikan sebelum menekan tombol persetujuan (ACC).
                                    </p>
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                                    <AlertCircle size={15} /> {errorMsg}
                                </div>
                            )}

                            <form onSubmit={handleApprovalSubmit} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Keputusan Persetujuan:</label>
                                    <div className="flex gap-4">
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer font-bold text-xs transition-all ${action === 'APPROVE' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                                            <input 
                                                type="radio" 
                                                name="action" 
                                                value="APPROVE" 
                                                checked={action === 'APPROVE'} 
                                                onChange={() => setAction('APPROVE')} 
                                                className="hidden" 
                                            />
                                            <CheckCircle size={16} className={action === 'APPROVE' ? 'text-emerald-600' : 'text-slate-400'} />
                                            Setujui Proyek (ACC & Terbitkan Pemesanan: {totalApprovedQty} Unit)
                                        </label>

                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer font-bold text-xs transition-all ${action === 'REJECT' ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                                            <input 
                                                type="radio" 
                                                name="action" 
                                                value="REJECT" 
                                                checked={action === 'REJECT'} 
                                                onChange={() => setAction('REJECT')} 
                                                className="hidden" 
                                            />
                                            <XCircle size={16} className={action === 'REJECT' ? 'text-rose-600' : 'text-slate-400'} />
                                            Tolak / Kembalikan dengan Catatan
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Catatan Arahan / Disposisi (Opsional):
                                    </label>
                                    <textarea 
                                        rows={2} 
                                        placeholder="Tuliskan arahan pengadaan, alasan pengurangan kuantitas item, atau catatan revisi..." 
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-500 bg-white"
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                    />
                                </div>

                                <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black">
                                            RK
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{currentUser.name || 'Ravi Kurnia, S.Pd.I'}</p>
                                            <p className="text-[10px] text-slate-500">TTE Terotentikasi sebagai Kepala Bidang Sarana</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="submit" 
                                        disabled={submitting}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md transition-all ${action === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'}`}
                                    >
                                        <Send size={14} />
                                        {submitting ? 'Memproses...' : (action === 'APPROVE' ? 'Sahkan ACC & Kuantitas Resmi' : 'Kirim Catatan Tolak')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs text-slate-500 print:hidden">
                    <span>Dokumen Persetujuan Resmi Yayasan Dar el-Iman</span>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-1.5 rounded-xl font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
};
