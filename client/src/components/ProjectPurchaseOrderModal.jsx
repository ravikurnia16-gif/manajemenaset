import React, { useState } from 'react';
import { 
    Printer, 
    Send, 
    FileText, 
    ExternalLink, 
    MessageSquare, 
    Calendar, 
    Building2, 
    Package, 
    ShieldCheck, 
    X, 
    AlertCircle, 
    CheckCircle2 
} from 'lucide-react';
import QRCode from 'react-qr-code';
import api from '../lib/axios';

export const ProjectPurchaseOrderModal = ({ 
    isOpen, 
    onClose, 
    project, 
    type = 'INVENTORY', // 'INVENTORY' | 'UNIFORM'
    vendors = [],
    onSuccess 
}) => {
    if (!isOpen || !project) return null;

    const hasPO = Boolean(project.poNumber);

    // Form states if PO not yet generated
    const defaultVendor = (() => {
        if (project.poVendorName) return project.poVendorName;
        const chosenSel = (project.selections || project.vendorSelections || []).find(s => s.status === 'DIPILIH');
        return chosenSel?.vendor?.name || '';
    })();

    const chosenVendorObj = (project.selections || project.vendorSelections || []).find(s => s.status === 'DIPILIH')?.vendor || null;

    const [selectedVendorId, setSelectedVendorId] = useState(chosenVendorObj?.id || '');
    const [vendorName, setVendorName] = useState(defaultVendor || chosenVendorObj?.name || '');
    const [vendorAddress, setVendorAddress] = useState(chosenVendorObj?.address || project.poVendorAddress || '');
    const [vendorPhone, setVendorPhone] = useState(chosenVendorObj?.phone || project.poVendorPhone || '');
    const [deadline, setDeadline] = useState(project.targetDate || project.poDeadline || '');
    const [notes, setNotes] = useState(project.poNotes || project.justification || '');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const items = project.projectItems || [];

    const handleVendorSelectChange = (vId) => {
        setSelectedVendorId(vId);
        const found = vendors.find(v => v.id === parseInt(vId, 10));
        if (found) {
            setVendorName(found.name);
            setVendorAddress(found.address || '');
            setVendorPhone(found.phone || '');
        }
    };

    const handleCreatePO = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSubmitting(true);

        try {
            const endpoint = type === 'UNIFORM'
                ? `/uniforms/projects/${project.id}/purchase-order`
                : `/inventory/projects/${project.id}/purchase-order`;

            const res = await api.post(endpoint, {
                vendorId: selectedVendorId || undefined,
                vendorName,
                vendorAddress,
                vendorPhone,
                deadline,
                notes
            });

            if (onSuccess) {
                onSuccess(res.data);
            }
        } catch (err) {
            console.error('Create PO Error:', err);
            setErrorMsg(err.response?.data?.error || 'Gagal menerbitkan Surat Pesanan');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleOpenEOffice = () => {
        window.open('/e-office', '_blank');
    };

    const handleSendWA = () => {
        const phone = (project.poVendorPhone || vendorPhone || '').replace(/\D/g, '');
        const targetPhone = phone.startsWith('0') ? `62${phone.slice(1)}` : phone;

        const itemsList = items.map((it, idx) => 
            `${idx + 1}. ${it.item?.name || it.variant?.item?.name || it.name || 'Barang'} (${it.quantity} ${it.item?.unit || it.unit || 'Pcs'})`
        ).join('\n');

        const message = `*SURAT PESANAN RESMI (PURCHASE ORDER)*\n*Yayasan Dar el-Iman Padang - Bidang Sarana*\n\n` +
            `Nomor PO: *${project.poNumber}*\n` +
            `Kepada Yth: *${project.poVendorName || vendorName}*\n` +
            `Proyek: *${project.title || project.name}*\n` +
            `Batas Waktu Pengiriman: *${project.poDeadline || deadline ? new Date(project.poDeadline || deadline).toLocaleDateString('id-ID') : '-'}*\n\n` +
            `*Rincian Barang yang Dipesan:*\n${itemsList}\n\n` +
            `*Catatan Khusus:*\n${notes || '-'}\n\n` +
            `Surat pesanan ini telah ditandatangani secara digital (TTE) oleh Kepala Bidang Sarana Yayasan Dar el-Iman dan teregistrasi resmi di sistem E-Office.\n` +
            `Mohon konfirmasi kesiapan pengerjaan dan pengiriman. Terima kasih.`;

        const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
                {/* Header Modal */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-base">Surat Pesanan (Purchase Order / PO)</h3>
                            <p className="text-xs text-slate-500">Penerbitan Dokumen Resmi ke Vendor Rekanan Terkoneksi E-Office</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasPO && (
                            <>
                                <button 
                                    type="button" 
                                    onClick={handleSendWA} 
                                    className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                                >
                                    <MessageSquare size={14} /> Kirim WhatsApp
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleOpenEOffice} 
                                    className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                                >
                                    <ExternalLink size={14} /> E-Office
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handlePrint} 
                                    className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                                >
                                    <Printer size={14} /> Cetak PO
                                </button>
                            </>
                        )}
                        <button 
                            onClick={onClose} 
                            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="p-6 max-h-[78vh] overflow-y-auto space-y-6 print:max-h-none print:p-0">
                    {!hasPO ? (
                        /* Form Penerbitan PO jika belum ada */
                        <form onSubmit={handleCreatePO} className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
                                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5">
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-blue-900 text-sm">Proyek Telah Disetujui Kepala Bidang Sarana (ACC)</h4>
                                    <p className="text-xs text-blue-700 mt-0.5">
                                        Silakan lengkapi informasi vendor rekanan di bawah ini untuk menerbitkan Surat Pesanan resmi.
                                        Sistem akan otomatis mengalokasikan nomor dokumen PO (contoh: <code>.../PO/SRN/...</code>) dan mendaftarkannya ke modul E-Office.
                                    </p>
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
                                    <AlertCircle size={15} /> {errorMsg}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Pilih Vendor Rekanan (Opsional jika baru)</label>
                                    <select 
                                        className="w-full px-3 py-2 border rounded-xl outline-none focus:border-blue-500 bg-white"
                                        value={selectedVendorId}
                                        onChange={e => handleVendorSelectChange(e.target.value)}
                                    >
                                        <option value="">-- Pilih dari Daftar Vendor --</option>
                                        {vendors.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Nama Perusahaan / Rekanan / Toko *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="Nama Vendor / CV / Toko" 
                                        className="w-full px-3 py-2 border rounded-xl outline-none focus:border-blue-500"
                                        value={vendorName}
                                        onChange={e => setVendorName(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Alamat Vendor *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="Alamat kantor / workshop vendor" 
                                        className="w-full px-3 py-2 border rounded-xl outline-none focus:border-blue-500"
                                        value={vendorAddress}
                                        onChange={e => setVendorAddress(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">No. Kontak / WhatsApp Vendor *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="Contoh: 08123456789" 
                                        className="w-full px-3 py-2 border rounded-xl outline-none focus:border-blue-500"
                                        value={vendorPhone}
                                        onChange={e => setVendorPhone(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Target Batas Waktu Pengiriman (Deadline) *</label>
                                    <input 
                                        type="date" 
                                        required 
                                        className="w-full px-3 py-2 border rounded-xl outline-none focus:border-blue-500"
                                        value={deadline}
                                        onChange={e => setDeadline(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Catatan / Syarat Khusus Pemesanan</label>
                                    <input 
                                        type="text" 
                                        placeholder="Contoh: Barang harus dikirim lengkap beserta nota resmi" 
                                        className="w-full px-3 py-2 border rounded-xl outline-none focus:border-blue-500"
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Preview Rincian Barang yang Dipesan */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                                <div className="p-3 bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                                    Daftar Barang yang Dipesan ({items.length} item):
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                                        <tr>
                                            <th className="p-2 w-10 text-center">#</th>
                                            <th className="p-2">Nama Barang & Spesifikasi</th>
                                            <th className="p-2 text-center">Jumlah</th>
                                            <th className="p-2 text-center">Satuan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((it, idx) => (
                                            <tr key={it.id || idx}>
                                                <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                                                <td className="p-2 font-bold text-slate-800">
                                                    {it.item?.name || it.variant?.item?.name || it.name || 'Barang'}
                                                    {it.variant?.sizeName && ` (Ukuran: ${it.variant.sizeName})`}
                                                </td>
                                                <td className="p-2 text-center font-bold text-blue-600">{it.quantity}</td>
                                                <td className="p-2 text-center text-slate-600">{it.item?.unit || it.unit || 'Pcs'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md flex items-center gap-2"
                                >
                                    <Send size={15} />
                                    {submitting ? 'Menerbitkan...' : 'Terbitkan PO & Sinkron ke E-Office'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* Tampilan Surat Pesanan Resmi Ber-Kop (Printable Layout) */
                        <div className="space-y-6 text-xs text-slate-800">
                            {/* Kop Surat */}
                            <div className="border-b-2 border-slate-800 pb-3 text-center">
                                <h2 className="font-extrabold text-slate-900 text-lg tracking-wide uppercase">
                                    YAYASAN DAR EL-IMAN PADANG
                                </h2>
                                <h4 className="font-bold text-slate-700 text-xs sm:text-sm uppercase tracking-wider">
                                    BIDANG SARANA DAN PRASARANA
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Jl. Gajah Mada No. 1, Kota Padang, Sumatera Barat • Telp / Hotline Sarpras: 0812-3456-7890
                                </p>
                            </div>

                            {/* Judul & Nomor PO */}
                            <div className="text-center space-y-1">
                                <h3 className="text-base font-black uppercase tracking-wider text-slate-900 underline">
                                    SURAT PESANAN (PURCHASE ORDER)
                                </h3>
                                <p className="font-mono font-bold text-slate-700 text-xs">
                                    Nomor: {project.poNumber}
                                </p>
                            </div>

                            {/* Pihak Penerima (Vendor) & Info Pemesanan */}
                            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <div>
                                    <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Kepada Rekanan / Penyedia:</span>
                                    <p className="font-black text-sm text-slate-900">{project.poVendorName || vendorName}</p>
                                    <p className="text-slate-600 text-xs mt-0.5">{project.poVendorAddress || vendorAddress || '-'}</p>
                                    <p className="text-slate-600 text-xs mt-0.5">Kontak / WA: <b className="text-slate-800">{project.poVendorPhone || vendorPhone || '-'}</b></p>
                                </div>
                                <div className="text-right">
                                    <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Referensi Pengadaan:</span>
                                    <p className="font-bold text-slate-800 text-xs">Proyek: {project.title || project.name}</p>
                                    <p className="text-slate-600 text-xs mt-0.5">
                                        Tanggal Pemesanan: <b>{project.poDate ? new Date(project.poDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID')}</b>
                                    </p>
                                    <p className="text-slate-600 text-xs mt-0.5">
                                        Batas Pengiriman: <b className="text-red-600">{project.poDeadline || deadline ? new Date(project.poDeadline || deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Segera'}</b>
                                    </p>
                                </div>
                            </div>

                            {/* Kalimat Pembuka */}
                            <p className="leading-relaxed">
                                Dengan ini kami dari Bidang Sarana dan Prasarana Yayasan Dar el-Iman memberikan pesanan pengadaan barang sesuai rincian spesifikasi dan jumlah di bawah ini:
                            </p>

                            {/* Tabel Barang PO */}
                            <div className="border border-slate-300 rounded-lg overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                                        <tr>
                                            <th className="p-2.5 w-10 text-center">No</th>
                                            <th className="p-2.5">Nama Barang & Spesifikasi</th>
                                            <th className="p-2.5 text-center">Jumlah</th>
                                            <th className="p-2.5 text-center">Satuan</th>
                                            <th className="p-2.5 text-right">Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {items.map((it, idx) => (
                                            <tr key={it.id || idx}>
                                                <td className="p-2.5 text-center font-medium text-slate-500">{idx + 1}</td>
                                                <td className="p-2.5 font-bold text-slate-900">
                                                    {it.item?.name || it.variant?.item?.name || it.name || 'Barang'}
                                                    {it.variant?.sizeName && (
                                                        <span className="ml-2 font-normal text-slate-600">
                                                            (Ukuran: {it.variant.sizeName})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-center font-black text-slate-900">{it.quantity}</td>
                                                <td className="p-2.5 text-center text-slate-700">{it.item?.unit || it.unit || 'Pcs'}</td>
                                                <td className="p-2.5 text-right text-slate-500 text-[11px]">Sesuai Standar Mutu</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Catatan / Ketentuan PO */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                                <p className="font-bold text-slate-800">Syarat & Ketentuan Penerimaan:</p>
                                <ol className="list-decimal list-inside space-y-0.5">
                                    <li>Barang wajib dikirimkan dalam kondisi baru, baik, dan sesuai spesifikasi yang disepakati.</li>
                                    <li>Penerimaan barang di gudang akan diverifikasi melalui Lembar Cek Fisik dan Berita Acara Serah Terima (BAST).</li>
                                    <li>Surat Pesanan ini terdaftar resmi secara digital di E-Office Yayasan Dar el-Iman.</li>
                                </ol>
                            </div>

                            {/* Tanda Tangan & QR Code Verifikasi */}
                            <div className="pt-4 grid grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                    <p className="font-bold text-slate-700 text-xs">Penyedia / Rekanan,</p>
                                    <div className="h-16 flex items-center text-slate-400 italic text-[11px]">
                                        (Cap & Tanda Tangan Rekanan)
                                    </div>
                                    <p className="font-bold text-slate-900 underline uppercase">{project.poVendorName || vendorName}</p>
                                    <p className="text-[10px] text-slate-500">Pihak Rekanan</p>
                                </div>

                                <div className="text-right space-y-1 flex flex-col items-end">
                                    <p className="font-bold text-slate-700 text-xs">
                                        Padang, {project.poDate ? new Date(project.poDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID')}
                                    </p>
                                    <p className="font-bold text-blue-900 text-xs">Kepala Bidang Sarana Yayasan Dar el-Iman</p>
                                    
                                    {/* QR Code Verifikasi Digital E-Office */}
                                    <div className="py-1 flex items-center gap-3">
                                        <div className="text-right text-[9px] text-slate-500 leading-tight">
                                            <p className="font-bold text-emerald-700">TTE TERVERIFIKASI</p>
                                            <p>No: {project.poNumber}</p>
                                            <p>Modul E-Office</p>
                                        </div>
                                        <div className="p-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs">
                                            <QRCode 
                                                value={`https://eoffice.dareliman.or.id/verify/${project.poNumber}`} 
                                                size={55} 
                                                level="M"
                                            />
                                        </div>
                                    </div>

                                    <p className="font-bold text-slate-900 underline uppercase">{project.approvedByName || 'Ravi Kurnia, S.Pd.I'}</p>
                                    <p className="text-[10px] text-slate-500">Kepala Bidang Sarana dan Prasarana</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs text-slate-500 print:hidden">
                    <span className="font-mono text-[11px]">
                        {hasPO ? `PO: ${project.poNumber} • Terhubung E-Office` : 'Status: Menunggu Penerbitan PO'}
                    </span>
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
