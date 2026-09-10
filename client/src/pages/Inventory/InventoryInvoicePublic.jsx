import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/axios';
import QRCode from 'react-qr-code';
import Swal from 'sweetalert2';
import { 
  Printer, ArrowLeft, Building2, User, Calendar, 
  Package, CheckCircle2, Clock, XCircle, FileText, CheckCheck, Copy, Share2,
  PenTool, ShieldCheck, X, Receipt, FileCheck, CreditCard, CalendarClock, AlertTriangle, CheckCircle
} from 'lucide-react';
import SignaturePad from '../../components/SignaturePad';

export default function InventoryInvoicePublic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlDocType = searchParams.get('docType');
  const [docType, setDocType] = useState(urlDocType === 'bast' ? 'bast' : 'nota');
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [signatureModal, setSignatureModal] = useState({
    isOpen: false,
    type: '', // 'requester' | 'deliverer'
    title: '',
    signerName: ''
  });
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    const dt = searchParams.get('docType');
    if (dt === 'bast' || dt === 'nota') {
      setDocType(dt);
    }
  }, [searchParams]);

  const handleDocTypeChange = (type) => {
    setDocType(type);
    setSearchParams({ docType: type });
  };

  const getNamaHari = (dateStr) => {
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = dateStr ? new Date(dateStr) : new Date();
    return hari[d.getDay()] || 'Senin';
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [id]);

  const fetchInvoiceData = async () => {
    setLoading(true);
    try {
      // Coba fetch via endpoint internal atau publik
      const [resInvoice, resSettings] = await Promise.allSettled([
        api.get(`/inventory/orders/${id}`),
        api.get('/settings')
      ]);

      if (resInvoice.status === 'fulfilled') {
        setInvoice(resInvoice.value.data);
      } else {
        // Fallback ke public endpoint jika tanpa token
        const publicRes = await api.get(`/inventory/orders/public/${id}`);
        setInvoice(publicRes.data);
      }

      if (resSettings.status === 'fulfilled') {
        setSettings(resSettings.value.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Invoice / Surat jalan gudang tidak ditemukan');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="font-bold text-slate-600 text-sm">Memuat Invoice & Surat Jalan Gudang...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <XCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Invoice Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500">{error || 'Data pesanan tidak ditemukan atau telah dihapus.'}</p>
          <button
            onClick={() => navigate('/inventory/pesanan')}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-sm"
          >
            Kembali ke Daftar Pesanan
          </button>
        </div>
      </div>
    );
  }

  const qrData = `${window.location.origin}/public/invoice-gudang/${invoice.id}`;
  const totalRequested = (invoice.items || []).reduce((acc, i) => acc + (Number(i.qtyRequested) || 0), 0);
  const totalApproved = (invoice.items || []).reduce((acc, i) => acc + (Number(i.qtyApproved) || 0), 0);
  const totalDelivered = (invoice.items || []).reduce((acc, i) => acc + (Number(i.qtyDelivered) || 0), 0);

  const formatRupiah = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const terbilang = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '-';
    n = Math.floor(Math.abs(Number(n)));
    if (n === 0) return 'Nol Rupiah';
    
    const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    
    function convert(num) {
      if (num < 12) return bilangan[num];
      if (num < 20) return convert(num - 10) + ' Belas';
      if (num < 100) return convert(Math.floor(num / 10)) + ' Puluh' + (num % 10 !== 0 ? ' ' + convert(num % 10) : '');
      if (num < 200) return 'Seratus' + (num % 100 !== 0 ? ' ' + convert(num % 100) : '');
      if (num < 1000) return convert(Math.floor(num / 100)) + ' Ratus' + (num % 100 !== 0 ? ' ' + convert(num % 100) : '');
      if (num < 2000) return 'Seribu' + (num % 1000 !== 0 ? ' ' + convert(num % 1000) : '');
      if (num < 1000000) return convert(Math.floor(num / 1000)) + ' Ribu' + (num % 1000 !== 0 ? ' ' + convert(num % 1000) : '');
      if (num < 1000000000) return convert(Math.floor(num / 1000000)) + ' Juta' + (num % 1000000 !== 0 ? ' ' + convert(num % 1000000) : '');
      if (num < 1000000000000) return convert(Math.floor(num / 1000000000)) + ' Miliar' + (num % 1000000000 !== 0 ? ' ' + convert(num % 1000000000) : '');
      return convert(Math.floor(num / 1000000000000)) + ' Triliun' + (num % 1000000000000 !== 0 ? ' ' + convert(num % 1000000000000) : '');
    }
    
    return convert(n).trim() + ' Rupiah';
  };

  const getItemSellingPrice = (it) => {
    if (it.item?.sellingPrice !== null && it.item?.sellingPrice !== undefined && Number(it.item.sellingPrice) > 0) {
      return Number(it.item.sellingPrice);
    }
    return Number(it.item?.price || 0);
  };

  const getEffectiveQty = (it, status) => {
    if (status === 'COMPLETED') {
      return it.qtyDelivered ?? (it.qtyApproved || it.qtyRequested);
    }
    if (status === 'APPROVED' || status === 'PROCESS') {
      return it.qtyApproved ?? it.qtyRequested;
    }
    return it.qtyRequested || 0;
  };

  const getOrderNoteText = (ord) => {
    if (!ord) return '';
    if (ord.displayNote !== undefined) return ord.displayNote;
    const noteVal = ord.note;
    if (!noteVal) return '';
    if (typeof noteVal === 'object') return noteVal.note || noteVal.text || '';
    if (typeof noteVal === 'string' && noteVal.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(noteVal);
        return parsed.note !== undefined ? parsed.note : (parsed.text || '');
      } catch (e) {
        return noteVal;
      }
    }
    return noteVal;
  };

  const getOrderSignatures = (ord) => {
    if (!ord) return { requester: null, deliverer: null, kabid: null };
    if (ord.signatures && typeof ord.signatures === 'object') {
      return {
        requester: ord.signatures.requester || null,
        deliverer: ord.signatures.deliverer || null,
        kabid: ord.signatures.kabid || null
      };
    }
    if (ord.note && typeof ord.note === 'string' && ord.note.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(ord.note);
        return {
          requester: parsed.signatures?.requester || null,
          deliverer: parsed.signatures?.deliverer || null,
          kabid: parsed.signatures?.kabid || null
        };
      } catch (e) {}
    }
    return { requester: null, deliverer: null, kabid: null };
  };

  const checkIsKabidSarana = () => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      const pos = (u?.position || '').toLowerCase();
      const role = u?.role || '';
      return pos.includes('kepala bidang sarana') || 
             pos.includes('kabid sarpras') || 
             (pos.includes('sarana') && (role === 'SUPER_ADMIN' || role === 'KABID_SARPRAS' || role === 'KEPALA_BIDANG')) ||
             role === 'KABID_SARPRAS';
    } catch (e) {
      return false;
    }
  };

  const openSignatureModal = (type) => {
    let title = 'Tanda Tangan Pemohon Barang';
    let defaultName = invoice.requesterName || '';
    if (type === 'deliverer') {
      title = 'Tanda Tangan Petugas Gudang (Yang Menyerahkan)';
      defaultName = 'Petugas Logistik DEI';
    }
    setSignatureModal({
      isOpen: true,
      type,
      title,
      signerName: defaultName
    });
  };

  const handleSaveSignature = async (dataUrl) => {
    if (!invoice || !signatureModal.type) return;
    setSigning(true);
    try {
      const res = await api.put(`/inventory/orders/public/${invoice.id}/signatures`, {
        type: signatureModal.type,
        signatureData: dataUrl,
        signerName: signatureModal.signerName
      });
      setInvoice(res.data);
      setSignatureModal({ isOpen: false, type: '', title: '', signerName: '' });
      Swal.fire({
        icon: 'success',
        title: 'Tanda Tangan Tersimpan',
        text: 'Tanda tangan resmi berhasil dibubuhkan.',
        timer: 1200,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('Gagal Menyimpan', err.response?.data?.error || 'Gagal menyimpan tanda tangan', 'error');
    } finally {
      setSigning(false);
    }
  };

  const handleResetSignature = async (type) => {
    const confirm = await Swal.fire({
      title: 'Hapus Tanda Tangan?',
      text: 'Tanda tangan pada kolom ini akan dikosongkan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48'
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await api.put(`/inventory/orders/public/${invoice.id}/signatures`, {
        type,
        action: 'RESET'
      });
      setInvoice(res.data);
      Swal.fire({
        icon: 'success',
        title: 'Tanda Tangan Dihapus',
        timer: 1000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('Gagal', err.response?.data?.error || 'Gagal menghapus tanda tangan', 'error');
    }
  };

  const handleKabidAcc = async (isReset = false) => {
    if (!invoice) return;

    if (!checkIsKabidSarana()) {
      Swal.fire({
        icon: 'warning',
        title: 'Akses Ditolak',
        text: 'Pengesahan dan tanda tangan ACC ini hanya dapat dilakukan melalui akun resmi dengan Jabatan (Position) Kepala Bidang Sarana.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    if (isReset) {
      const confirm = await Swal.fire({
        title: 'Batalkan ACC Dokumen?',
        text: 'Pengesahan ACC Kepala Bidang Sarana pada faktur ini akan ditarik kembali.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Batalkan ACC',
        cancelButtonText: 'Kembali',
        confirmButtonColor: '#e11d48'
      });
      if (!confirm.isConfirmed) return;

      try {
        const res = await api.put(`/inventory/orders/${invoice.id}/signatures`, {
          type: 'kabid',
          action: 'RESET'
        });
        setInvoice(res.data);
        Swal.fire({
          icon: 'success',
          title: 'ACC Dibatalkan',
          timer: 1200,
          showConfirmButton: false
        });
      } catch (err) {
        Swal.fire('Gagal', err.response?.data?.error || 'Gagal membatalkan ACC', 'error');
      }
      return;
    }

    const confirm = await Swal.fire({
      title: 'ACC & Sahkan Dokumen Resmi?',
      html: `
        <div class="text-left text-xs space-y-2 text-slate-600">
          <p>Anda akan melakukan <b>ACC dan Pengesahan Tanda Tangan Resmi</b> sebagai <b>Kepala Bidang Sarana</b> untuk faktur invoice:</p>
          <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-blue-800">
            <div><b>Kode:</b> ${invoice.code}</div>
            <div><b>Pemohon:</b> ${invoice.requesterName} (${invoice.requesterUnit || 'Umum'})</div>
          </div>
          <p class="text-emerald-700 font-bold">Stempel Digital Resmi TTE Kepala Bidang Sarana akan dibubuhkan ke dokumen ini.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, ACC & Sahkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669'
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await api.put(`/inventory/orders/${invoice.id}/signatures`, {
        type: 'kabid',
        action: 'SIGN'
      });
      setInvoice(res.data);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil di-ACC',
        text: 'Dokumen pesanan telah resmi di-ACC oleh Kepala Bidang Sarana.',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('Gagal', err.response?.data?.error || 'Gagal melakukan ACC', 'error');
    }
  };

  const grandTotal = (invoice.items || []).reduce((acc, it) => {
    const price = getItemSellingPrice(it);
    const qty = getEffectiveQty(it, invoice.status);
    return acc + (price * qty);
  }, 0);

  const isOrderOverdue = (order) => {
    if (!order || order.paymentStatus === 'PAID' || !order.dueDate) return false;
    const due = new Date(order.dueDate);
    due.setHours(23, 59, 59, 999);
    return due < new Date();
  };

  const handleQuickTogglePayment = async () => {
    if (!invoice) return;
    const isCurrentlyPaid = invoice.paymentStatus === 'PAID';
    const newStatus = isCurrentlyPaid ? 'UNPAID' : 'PAID';

    const confirm = await Swal.fire({
      title: isCurrentlyPaid ? 'Tandai BELUM LUNAS?' : 'Tandai LUNAS?',
      html: `
        <div class="text-left text-xs space-y-2 text-slate-600">
          <p>Ubah status pembayaran faktur <b>${invoice.code}</b> (${invoice.requesterName}) menjadi:</p>
          <div class="p-2.5 rounded-xl font-bold text-center text-sm ${
            newStatus === 'PAID' ? 'bg-emerald-50 border border-emerald-300 text-emerald-800' : 'bg-rose-50 border border-rose-300 text-rose-800'
          }">
            ${newStatus === 'PAID' ? '✓ LUNAS (PAID)' : '⏳ BELUM LUNAS (UNPAID)'}
          </div>
          <p class="text-[11px] text-slate-400">Total Tagihan: <b>${formatRupiah(grandTotal)}</b></p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: newStatus === 'PAID' ? 'Ya, Tandai Lunas' : 'Ya, Belum Lunas',
      cancelButtonText: 'Batal',
      confirmButtonColor: newStatus === 'PAID' ? '#059669' : '#e11d48'
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await api.put(`/inventory/orders/public/${invoice.id}/payment`, {
        paymentStatus: newStatus,
        paidAt: newStatus === 'PAID' ? new Date().toISOString() : null,
        paymentMethod: newStatus === 'PAID' ? (invoice.paymentMethod || 'Tunai / Kasir') : null
      });
      setInvoice(res.data);
      Swal.fire({
        icon: 'success',
        title: newStatus === 'PAID' ? 'Status: LUNAS' : 'Status: BELUM LUNAS',
        timer: 1200,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('Gagal', err.response?.data?.error || 'Gagal mengubah status pembayaran', 'error');
    }
  };

  const signatures = getOrderSignatures(invoice);
  const displayNote = getOrderNoteText(invoice);
  const isKabid = checkIsKabidSarana();

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6 font-sans print:bg-white print:p-0 print:min-h-0 print:block">
      <style type="text/css" media="print">
        {`
          @page { size: A4 portrait; margin: 8mm; }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }
          @media print {
            .invoice-container {
              zoom: 0.90;
              page-break-inside: avoid;
              page-break-after: avoid;
            }
            .print\\:shadow-none { box-shadow: none !important; }
            .print\\:rounded-none { border-radius: 0 !important; }
            .print\\:border-none { border: none !important; }
          }
        `}
      </style>

      <div className="max-w-4xl w-full mx-auto print:block space-y-4">
        
        {/* Action Bar (Hidden on Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
          <button
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/inventory/pesanan')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl hover:bg-slate-100 transition"
          >
            <ArrowLeft size={16} /> Kembali
          </button>

          {/* Segmented Switcher Tab */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setDocType('nota')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                docType === 'nota'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt size={14} className={docType === 'nota' ? 'text-emerald-600' : 'text-slate-400'} />
              <span>1. Nota / Faktur</span>
            </button>
            <button
              type="button"
              onClick={() => setDocType('bast')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                docType === 'bast'
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck size={14} className={docType === 'bast' ? 'text-indigo-600' : 'text-slate-400'} />
              <span>2. BAST Serah Terima</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleQuickTogglePayment}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
                invoice.paymentStatus === 'PAID'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
              }`}
              title="Klik untuk ubah status pembayaran Lunas / Belum Lunas"
            >
              <CreditCard size={14} />
              <span>{invoice.paymentStatus === 'PAID' ? '✓ Lunas' : 'Belum Lunas'}</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs"
              title="Salin Link Dokumen Digital"
            >
              {copied ? (
                <>
                  <CheckCheck size={14} className="text-emerald-600" />
                  <span className="text-emerald-600">Link Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy size={14} className="text-slate-500" />
                  <span>Salin Link</span>
                </>
              )}
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition"
            >
              <Printer size={15} /> Cetak / Simpan PDF
            </button>
          </div>
        </div>

        {/* Printable Invoice Container (A4 Layout) */}
        <div className="invoice-container bg-white p-6 sm:p-10 rounded-3xl shadow-xl border border-slate-200 print:shadow-none print:rounded-none print:border-none print:p-2 space-y-6">
          
          {/* KOP SURAT RESMI */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-800 pb-5 gap-4">
            <div className="flex items-center gap-4">
              <img 
                src={settings?.orgLogo || "/Sarpras.jpeg"} 
                alt="Logo" 
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl border border-slate-100 p-1"
              />
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                  {settings?.orgName || "YAYASAN DAR EL-IMAN PADANG"}
                </h2>
                <h3 className="text-xs sm:text-sm font-extrabold text-blue-700 uppercase tracking-wide">
                  BAGIAN SARANA & PRASARANA (LOGISTIK & PERGUDANGAN)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Layanan Pengadaan & Pendistribusian Logistik Perlengkapan Unit Yayasan
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  Padang, Sumatera Barat • sarpras.dareliman.or.id
                </p>
              </div>
            </div>

            {/* Document Stamp */}
            <div className="text-left sm:text-right w-full sm:w-auto">
              <div className="text-xs font-mono font-bold text-slate-500">
                {docType === 'nota' ? 'NO. NOTA PENJUALAN' : 'NO. BERITA ACARA (BAST)'}
              </div>
              <div className="text-base sm:text-lg font-black text-blue-700 font-mono tracking-tight">
                {docType === 'nota' 
                  ? invoice.code 
                  : `BAST/${invoice.code}/${new Date(invoice.date || Date.now()).getFullYear()}`}
              </div>
              
              <div className="mt-2 flex sm:justify-end items-center gap-1.5 flex-wrap">
                {invoice.status === 'COMPLETED' ? (
                  <span className="inline-block border-2 border-emerald-600 text-emerald-700 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider rotate-[-2deg] bg-emerald-50 print:border-emerald-700">
                    ✓ SELESAI (DISERAHKAN)
                  </span>
                ) : invoice.status === 'APPROVED' ? (
                  <span className="inline-block border-2 border-blue-600 text-blue-700 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider rotate-[-2deg] bg-blue-50">
                    ✓ DISETUJUI (APPROVED)
                  </span>
                ) : invoice.status === 'REJECTED' ? (
                  <span className="inline-block border-2 border-rose-600 text-rose-700 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider rotate-[2deg] bg-rose-50">
                    ✕ DITOLAK
                  </span>
                ) : (
                  <span className="inline-block border-2 border-amber-500 text-amber-800 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-50">
                    ⏳ MENUNGGU PROSES
                  </span>
                )}

                {/* Stempel Resmi Status Pembayaran (Khusus Nota) */}
                {docType === 'nota' && (
                  invoice.paymentStatus === 'PAID' ? (
                    <span className="inline-block border-2 border-emerald-600 text-emerald-700 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-50 rotate-[-2deg] shadow-xs print:border-emerald-700">
                      ✓ LUNAS
                    </span>
                  ) : (
                    <span className={`inline-block border-2 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider rotate-[2deg] shadow-xs ${
                      isOrderOverdue(invoice)
                        ? 'border-rose-600 text-rose-700 bg-rose-50 animate-pulse print:border-rose-700'
                        : 'border-amber-500 text-amber-800 bg-amber-50 print:border-amber-600'
                    }`}>
                      {isOrderOverdue(invoice) ? '⚠️ JATUH TEMPO' : 'BELUM LUNAS'}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          {/* ======================================================= */}
          {/* DOKUMEN TYPE 1: NOTA / FAKTUR PENJUALAN LOGISTIK        */}
          {/* ======================================================= */}
          {docType === 'nota' && (
            <div className="space-y-6">
              {/* JUDUL DOKUMEN NOTA */}
              <div className="text-center py-1">
                <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-wide underline underline-offset-4">
                  FAKTUR / NOTA PENJUALAN GUDANG LOGISTIK
                </h1>
                <p className="text-[11px] text-slate-500 font-medium mt-1">
                  Lembar Bukti Rincian Biaya, Nilai Jual, dan Pembayaran Logistik Barang Gudang
                </p>
              </div>

              {/* META DATA PEMOHON & DOKUMEN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200 text-xs">
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block">Identitas Pembeli / Pemohon:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-24">Nama Pemohon</span>
                    <span className="font-extrabold text-slate-800">: {invoice.requesterName || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-24">Unit / Departemen</span>
                    <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">: {invoice.requesterUnit || 'Umum'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-24">Petugas Kasir/Input</span>
                    <span className="font-medium text-slate-700">: {invoice.createdBy?.name || invoice.createdBy?.username || '-'}</span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
                  <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block">Rincian Transaksi:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-28">No. Nota / Faktur</span>
                    <span className="font-bold text-slate-800 font-mono">: {invoice.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-28">Tanggal Transaksi</span>
                    <span className="font-bold text-slate-800">: {new Date(invoice.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-28">Deadline Bayar</span>
                    <span className={`font-bold ${isOrderOverdue(invoice) ? 'text-rose-600 font-black' : 'text-slate-800'}`}>
                      : {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                      {isOrderOverdue(invoice) && <span className="ml-1 text-[10px] text-rose-600 font-bold">(Lewat Jatuh Tempo)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-28">Status Pembayaran</span>
                    <div className="font-bold flex items-center gap-1.5 flex-wrap">
                      <span>:</span>
                      {invoice.paymentStatus === 'PAID' ? (
                        <span className="text-emerald-700 font-black bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded text-[11px]">
                          ✓ LUNAS {invoice.paidAt ? `(${new Date(invoice.paidAt).toLocaleDateString('id-ID')})` : ''} {invoice.paymentMethod ? `- ${invoice.paymentMethod}` : ''}
                        </span>
                      ) : (
                        <span className="text-amber-800 font-black bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded text-[11px]">
                          ⏳ BELUM LUNAS
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleQuickTogglePayment}
                        className="text-[10px] text-blue-600 hover:underline print:hidden font-bold cursor-pointer ml-1"
                      >
                        [Tandai {invoice.paymentStatus === 'PAID' ? 'Belum Lunas' : 'Lunas'}]
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-28">Status Dokumen</span>
                    <span className="font-bold text-slate-700">: {invoice.status}</span>
                  </div>
                </div>
              </div>

              {/* TABEL RINCIAN BARANG */}
              <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider">
                      <th className="p-3 w-10 text-center border-r border-slate-700">No</th>
                      <th className="p-3 w-28 border-r border-slate-700">Kode</th>
                      <th className="p-3 border-r border-slate-700">Nama Barang & Kategori</th>
                      <th className="p-3 w-16 text-center border-r border-slate-700">Qty</th>
                      <th className="p-3 w-16 text-center border-r border-slate-700">Satuan</th>
                      <th className="p-3 w-28 text-right border-r border-slate-700">Harga Jual</th>
                      <th className="p-3 w-32 text-right border-r border-slate-700">Subtotal</th>
                      <th className="p-3 w-28">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((it, idx) => {
                        const sellingPrice = getItemSellingPrice(it);
                        const effectiveQty = getEffectiveQty(it, invoice.status);
                        const subtotal = sellingPrice * effectiveQty;

                        return (
                          <tr key={it.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 text-center font-bold text-slate-500 border-r border-slate-200">{idx + 1}</td>
                            <td className="p-3 font-mono font-bold text-slate-700 border-r border-slate-200 text-[11px]">{it.item?.code || '-'}</td>
                            <td className="p-3 border-r border-slate-200">
                              <div className="font-extrabold text-slate-800">{it.item?.name || 'Barang Logistik'}</div>
                              <div className="text-[10px] text-slate-400 font-medium">{it.item?.category?.name || 'Umum'}</div>
                            </td>
                            <td className="p-3 text-center font-black text-emerald-700 border-r border-slate-200 bg-emerald-50/30">
                              {effectiveQty}
                            </td>
                            <td className="p-3 text-center text-slate-600 font-semibold border-r border-slate-200">
                              {it.item?.unit || 'Pcs'}
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-slate-700 border-r border-slate-200">
                              {formatRupiah(sellingPrice)}
                            </td>
                            <td className="p-3 text-right font-mono font-extrabold text-blue-800 border-r border-slate-200 bg-blue-50/30">
                              {formatRupiah(subtotal)}
                            </td>
                            <td className="p-3 text-slate-600 text-[11px] italic">
                              {it.note || '-'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-slate-400 italic">
                          Tidak ada item barang pada faktur ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                      <td colSpan="3" className="p-3 text-right uppercase tracking-wider text-[10px] border-r border-slate-200">
                        Total Kuantitas :
                      </td>
                      <td className="p-3 text-center font-mono font-extrabold text-emerald-700 border-r border-slate-200">
                        {totalDelivered || (invoice.status === 'COMPLETED' ? totalRequested : totalApproved || totalRequested)}
                      </td>
                      <td className="p-3 text-center text-slate-500 font-medium text-[10px] border-r border-slate-200">Unit</td>
                      <td className="p-3 text-right uppercase tracking-wider text-[10px] text-slate-500 border-r border-slate-200">Grand Total :</td>
                      <td className="p-3 text-right font-mono font-black text-blue-900 bg-blue-100/60 text-sm border-r border-slate-200">
                        {formatRupiah(grandTotal)}
                      </td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* BOX TOTAL TAGIHAN & TERBILANG */}
              <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-blue-50/80 border-2 border-blue-200 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1.5 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-600" /> Terbilang Jumlah Nilai Tagihan (Harga Jual):
                  </span>
                  <div className="font-serif italic font-bold text-slate-800 text-xs sm:text-sm bg-white/90 p-3 rounded-xl border border-blue-100 shadow-2xs">
                    "{terbilang(grandTotal)}"
                  </div>
                </div>

                <div className="bg-white border-2 border-blue-600 rounded-2xl p-4 sm:px-6 sm:py-3.5 text-right shadow-sm w-full sm:w-auto shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                    TOTAL TAGIHAN (HARGA JUAL)
                  </span>
                  <div className="text-xl sm:text-2xl font-mono font-black text-blue-700 tracking-tight">
                    {formatRupiah(grandTotal)}
                  </div>
                </div>
              </div>

              {/* CATATAN */}
              {displayNote && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                  <span className="font-bold text-slate-700 block text-[11px]">Catatan / Keperluan:</span>
                  <p className="text-slate-600 italic">{displayNote}</p>
                </div>
              )}

              {/* TANDA TANGAN NOTA (2 KOLOM: PEMBELI & KASIR / PETUGAS LOGISTIK) */}
              <div className="pt-4 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-6 text-center text-xs max-w-2xl mx-auto">
                  
                  {/* KOLOM 1: YANG MEMESAN / PEMBELI */}
                  <div className="flex flex-col justify-between min-h-[160px] p-3 bg-slate-50/60 rounded-2xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-700 block text-xs">Yang Memesan / Pembeli,</span>
                      <span className="text-[10px] text-slate-400">Unit / Pemesan Barang</span>
                    </div>

                    <div className="my-2 flex-1 flex flex-col items-center justify-center min-h-[70px]">
                      {signatures.requester?.signatureData ? (
                        <div className="flex flex-col items-center">
                          <img 
                            src={signatures.requester.signatureData} 
                            alt="TTD Pemohon" 
                            className="h-16 max-w-[150px] object-contain" 
                          />
                          <span className="text-[9px] text-emerald-700 font-bold mt-1">✓ Tanda Tangan Digital</span>
                          <span className="text-[8px] text-slate-400 font-mono">
                            {new Date(signatures.requester.signedAt).toLocaleDateString('id-ID')}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => handleResetSignature('requester')} 
                            className="text-[9px] text-rose-500 hover:underline print:hidden mt-0.5 cursor-pointer"
                          >
                            Hapus TTD
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openSignatureModal('requester')}
                            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer print:hidden"
                            title="Goreskan Tanda Tangan Pemohon"
                          >
                            <PenTool size={13} />
                            <span>Input Tanda Tangan</span>
                          </button>
                          <div className="h-12 hidden print:block"></div>
                        </>
                      )}
                    </div>

                    <div>
                      <div className="font-extrabold text-slate-800 uppercase underline underline-offset-2">
                        {signatures.requester?.name || invoice.requesterName || '( ..................................... )'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{invoice.requesterUnit || 'Pemohon'}</div>
                    </div>
                  </div>

                  {/* KOLOM 2: KASIR / PETUGAS LOGISTIK */}
                  <div className="flex flex-col justify-between min-h-[160px] p-3 bg-slate-50/60 rounded-2xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-700 block text-xs">Kasir / Petugas Logistik,</span>
                      <span className="text-[10px] text-slate-400">Bagian Sarana & Prasarana</span>
                    </div>

                    <div className="my-2 flex-1 flex flex-col items-center justify-center min-h-[70px]">
                      {signatures.deliverer?.signatureData ? (
                        <div className="flex flex-col items-center">
                          <img 
                            src={signatures.deliverer.signatureData} 
                            alt="TTD Petugas" 
                            className="h-16 max-w-[150px] object-contain" 
                          />
                          <span className="text-[9px] text-emerald-700 font-bold mt-1">✓ Tanda Tangan Digital</span>
                          <span className="text-[8px] text-slate-400 font-mono">
                            {new Date(signatures.deliverer.signedAt).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="text-slate-400 italic text-xs print:hidden">( Belum ditandatangani )</div>
                          <div className="h-12 hidden print:block"></div>
                        </>
                      )}
                    </div>

                    <div>
                      <div className="font-extrabold text-slate-800 uppercase underline underline-offset-2">
                        {signatures.deliverer?.name || '( Petugas Logistik DEI )'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Staff Sarpras & Logistik</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* DOKUMEN TYPE 2: BERITA ACARA SERAH TERIMA (BAST / BBAST)*/}
          {/* ======================================================= */}
          {docType === 'bast' && (
            <div className="space-y-5">
              {/* JUDUL DOKUMEN BAST */}
              <div className="text-center py-1">
                <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-wide underline underline-offset-4">
                  BERITA ACARA SERAH TERIMA BARANG (BAST)
                </h1>
                <p className="text-xs text-blue-800 font-mono font-bold mt-1">
                  Nomor: BAST/{invoice.code}/{new Date(invoice.date || Date.now()).getFullYear()}
                </p>
              </div>

              {/* KALIMAT PEMBUKA / PREAMBLE BAST */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs leading-relaxed text-slate-700">
                Pada hari ini, <span className="font-extrabold text-slate-900">{getNamaHari(invoice.date)}</span>, tanggal <span className="font-extrabold text-slate-900">{new Date(invoice.date || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>, bertempat di Kantor Sarana & Prasarana Yayasan Dar el-Iman Padang, telah dilaksanakan serah terima barang permohonan logistik antara pihak-pihak sebagai berikut:
              </div>

              {/* IDENTITAS PARA PIHAK (PIHAK I & PIHAK II) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* PIHAK PERTAMA */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1.5 shadow-2xs">
                  <span className="font-black text-blue-900 uppercase text-[10px] tracking-wider block border-b border-slate-100 pb-1">
                    I. PIHAK PERTAMA (Yang Menyerahkan):
                  </span>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-slate-500 w-20 shrink-0">Nama</span>
                    <span className="font-extrabold text-slate-800">: {signatures.deliverer?.name || 'Petugas Logistik DEI'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-20 shrink-0">Jabatan</span>
                    <span className="text-slate-700 font-medium">: Staf Logistik & Pergudangan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-20 shrink-0">Unit Kerja</span>
                    <span className="text-slate-700 font-medium">: Bagian Sarana & Prasarana</span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 italic pt-1.5 border-t border-slate-50">
                    Bertindak untuk dan atas nama Bagian Sarpras yang menyerahkan barang logistik.
                  </p>
                </div>

                {/* PIHAK KEDUA */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1.5 shadow-2xs">
                  <span className="font-black text-indigo-900 uppercase text-[10px] tracking-wider block border-b border-slate-100 pb-1">
                    II. PIHAK KEDUA (Yang Menerima):
                  </span>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-slate-500 w-20 shrink-0">Nama</span>
                    <span className="font-extrabold text-slate-800">: {signatures.requester?.name || invoice.requesterName || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-20 shrink-0">Peran</span>
                    <span className="text-slate-700 font-medium">: Pemohon Barang Logistik</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-20 shrink-0">Unit Kerja</span>
                    <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">: {invoice.requesterUnit || 'Unit Pemohon'}</span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 italic pt-1.5 border-t border-slate-50">
                    Bertindak untuk dan atas nama unit pemohon yang menerima dan memeriksa barang.
                  </p>
                </div>
              </div>

              {/* KLAUSUL PERNYATAAN PENYERAHAN */}
              <p className="text-xs text-slate-600 leading-relaxed">
                PIHAK PERTAMA telah menyerahkan barang perlengkapan kebutuhan kepada PIHAK KEDUA, dan PIHAK KEDUA menyatakan telah memeriksa serta menerima barang tersebut dalam kondisi <b>BAIK, LENGKAP, dan SESUAI SPESIFIKASI</b>, dengan rincian fisik sebagai berikut:
              </p>

              {/* TABEL PEMERIKSAAN FISIK BARANG (BAST) */}
              <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider">
                      <th className="p-3 w-10 text-center border-r border-slate-700">No</th>
                      <th className="p-3 w-28 border-r border-slate-700">Kode</th>
                      <th className="p-3 border-r border-slate-700">Nama Barang & Spesifikasi</th>
                      <th className="p-3 w-20 text-center border-r border-slate-700">Diminta</th>
                      <th className="p-3 w-24 text-center border-r border-slate-700">Diserahkan</th>
                      <th className="p-3 w-20 text-center border-r border-slate-700">Satuan</th>
                      <th className="p-3 w-32 text-center border-r border-slate-700">Kondisi Fisik</th>
                      <th className="p-3 w-36">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((it, idx) => {
                        const qtyDeliv = it.qtyDelivered ?? (invoice.status === 'COMPLETED' ? (it.qtyApproved || it.qtyRequested) : (it.qtyApproved ?? it.qtyRequested));

                        return (
                          <tr key={it.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 text-center font-bold text-slate-500 border-r border-slate-200">{idx + 1}</td>
                            <td className="p-3 font-mono font-bold text-slate-700 border-r border-slate-200 text-[11px]">{it.item?.code || '-'}</td>
                            <td className="p-3 border-r border-slate-200">
                              <div className="font-extrabold text-slate-800">{it.item?.name || 'Barang Logistik'}</div>
                              <div className="text-[10px] text-slate-400 font-medium">{it.item?.category?.name || 'Umum'}</div>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700 border-r border-slate-200 bg-slate-50/50">
                              {it.qtyRequested}
                            </td>
                            <td className="p-3 text-center font-black text-emerald-700 border-r border-slate-200 bg-emerald-50/40">
                              {qtyDeliv}
                            </td>
                            <td className="p-3 text-center text-slate-600 font-semibold border-r border-slate-200">
                              {it.item?.unit || 'Pcs'}
                            </td>
                            <td className="p-3 text-center border-r border-slate-200">
                              <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-[10.5px] font-bold">
                                ✓ Baik & Lengkap
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 text-[11px] italic">
                              {it.note || '-'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-slate-400 italic">
                          Tidak ada item barang pada dokumen ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                      <td colSpan="3" className="p-3 text-right uppercase tracking-wider text-[10px] border-r border-slate-200">
                        Total Kuantitas Fisik :
                      </td>
                      <td className="p-3 text-center font-mono font-extrabold border-r border-slate-200">{totalRequested}</td>
                      <td className="p-3 text-center font-mono font-black text-emerald-700 border-r border-slate-200">
                        {totalDelivered || (invoice.status === 'COMPLETED' ? totalRequested : totalApproved || totalRequested)}
                      </td>
                      <td className="p-3 text-center text-slate-500 font-medium text-[10px] border-r border-slate-200">Unit</td>
                      <td colSpan="2" className="p-3 text-left text-xs text-emerald-800 font-semibold">
                        ✓ Seluruh barang telah diverifikasi secara fisik
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* KLAUSUL PENUTUP BAST */}
              <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs text-slate-600 italic leading-relaxed">
                Demikian Berita Acara Serah Terima (BAST) ini dibuat dan ditandatangani oleh para pihak dengan sadar dan tanpa paksaan dari pihak manapun, untuk dipergunakan sebagai bukti fisik pertanggungjawaban penyerahan logistik dan inventarisasi aset Yayasan Dar el-Iman.
              </div>

              {/* TANDA TANGAN BAST 3 PIHAK */}
              <div className="pt-3 border-t border-slate-200">
                <div className="grid grid-cols-3 gap-4 text-center text-xs">
                  
                  {/* KOLOM 1: PIHAK KEDUA (YANG MENERIMA) */}
                  <div className="flex flex-col justify-between min-h-[160px] p-3 bg-slate-50/50 rounded-2xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-700 block text-xs">PIHAK KEDUA (Yang Menerima),</span>
                      <span className="text-[10px] text-slate-400">Unit Pemohon / Pemesan</span>
                    </div>

                    <div className="my-2 flex-1 flex flex-col items-center justify-center min-h-[70px]">
                      {signatures.requester?.signatureData ? (
                        <div className="flex flex-col items-center">
                          <img 
                            src={signatures.requester.signatureData} 
                            alt="TTD Pemohon" 
                            className="h-16 max-w-[150px] object-contain" 
                          />
                          <span className="text-[9px] text-emerald-700 font-bold mt-1">✓ Tanda Tangan Digital</span>
                          <span className="text-[8px] text-slate-400 font-mono">
                            {new Date(signatures.requester.signedAt).toLocaleDateString('id-ID')}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => handleResetSignature('requester')} 
                            className="text-[9px] text-rose-500 hover:underline print:hidden mt-0.5 cursor-pointer"
                          >
                            Hapus TTD
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openSignatureModal('requester')}
                            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer print:hidden"
                            title="Goreskan Tanda Tangan Pemohon"
                          >
                            <PenTool size={13} />
                            <span>Input Tanda Tangan</span>
                          </button>
                          <div className="h-12 hidden print:block"></div>
                        </>
                      )}
                    </div>

                    <div>
                      <div className="font-extrabold text-slate-800 uppercase underline underline-offset-2">
                        {signatures.requester?.name || invoice.requesterName || '( ..................................... )'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{invoice.requesterUnit || 'Pemohon'}</div>
                    </div>
                  </div>

                  {/* KOLOM 2: PIHAK PERTAMA (YANG MENYERAHKAN) */}
                  <div className="flex flex-col justify-between min-h-[160px] p-3 bg-slate-50/50 rounded-2xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-700 block text-xs">PIHAK PERTAMA (Yang Menyerahkan),</span>
                      <span className="text-[10px] text-slate-400">Staf Logistik & Pergudangan</span>
                    </div>

                    <div className="my-2 flex-1 flex flex-col items-center justify-center min-h-[70px]">
                      {signatures.deliverer?.signatureData ? (
                        <div className="flex flex-col items-center">
                          <img 
                            src={signatures.deliverer.signatureData} 
                            alt="TTD Petugas" 
                            className="h-16 max-w-[150px] object-contain" 
                          />
                          <span className="text-[9px] text-emerald-700 font-bold mt-1">✓ Tanda Tangan Digital</span>
                          <span className="text-[8px] text-slate-400 font-mono">
                            {new Date(signatures.deliverer.signedAt).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="text-slate-400 italic text-xs print:hidden">( Belum ditandatangani )</div>
                          <div className="h-12 hidden print:block"></div>
                        </>
                      )}
                    </div>

                    <div>
                      <div className="font-extrabold text-slate-800 uppercase underline underline-offset-2">
                        {signatures.deliverer?.name || '( Petugas Logistik DEI )'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Staff Sarpras & Logistik</div>
                    </div>
                  </div>

                  {/* KOLOM 3: MENGETAHUI & MENYETUJUI (KEPALA BIDANG SARANA) */}
                  <div className="flex flex-col justify-between min-h-[160px] p-3 bg-slate-50/50 rounded-2xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-700 block text-xs">Mengetahui & Menyetujui,</span>
                      <span className="text-[10px] text-blue-700 font-extrabold uppercase">Kepala Bidang Sarana</span>
                    </div>

                    <div className="my-2 flex-1 flex flex-col items-center justify-center min-h-[70px]">
                      {signatures.kabid?.approved ? (
                        <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500 rounded-2xl text-center shadow-xs w-full max-w-[190px]">
                          <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-black text-[10px] uppercase tracking-wider">
                            <ShieldCheck size={14} className="text-emerald-600" />
                            <span>ACC RESMI DIGITAL</span>
                          </div>
                          <div className="text-[9px] font-black text-slate-800 mt-1 uppercase">
                            KEPALA BIDANG SARANA
                          </div>
                          <div className="text-[8px] text-slate-500 font-mono mt-0.5">
                            {new Date(signatures.kabid.signedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-[7.5px] text-emerald-700 font-mono font-bold truncate mt-0.5">
                            {signatures.kabid.authHash || 'ACC-VALID'}
                          </div>
                          {isKabid && (
                            <button 
                              type="button" 
                              onClick={() => handleKabidAcc(true)} 
                              className="text-[9px] text-rose-500 hover:underline print:hidden mt-1 cursor-pointer block mx-auto"
                            >
                              Batalkan ACC
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {isKabid ? (
                            <button
                              type="button"
                              onClick={() => handleKabidAcc(false)}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2 mx-auto cursor-pointer print:hidden"
                              title="ACC & Berikan Tanda Tangan Pengesahan Kepala Bidang Sarana"
                            >
                              <ShieldCheck size={15} />
                              <span>ACC & Sahkan</span>
                            </button>
                          ) : (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-center print:hidden max-w-[170px]">
                              <div className="text-[10px] font-bold text-amber-800 flex items-center justify-center gap-1">
                                <Clock size={12} className="text-amber-600" />
                                <span>Menunggu ACC</span>
                              </div>
                              <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">
                                Melalui Akun Resmi Jabatan Kepala Bidang Sarana
                              </p>
                            </div>
                          )}
                          <div className="h-12 hidden print:block"></div>
                        </>
                      )}
                    </div>

                    <div>
                      <div className="font-extrabold text-slate-800 uppercase underline underline-offset-2">
                        {signatures.kabid?.name || '( Kepala Bidang Sarana )'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {signatures.kabid?.position || 'Kepala Bidang Sarana'}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* FOOTER & QR VERIFIKASI */}
          <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-slate-100 text-[10px] text-slate-400 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <QRCode value={qrData} size={48} />
              </div>
              <div>
                <p className="font-bold text-slate-700">Verifikasi Dokumen Digital</p>
                <p className="text-slate-400">Scan QR Code untuk memvalidasi keaslian invoice di sistem resmi SarPras.</p>
              </div>
            </div>
            <div className="text-right font-mono">
              Dicetak pada: {new Date().toLocaleString('id-ID')}
            </div>
          </div>

        </div>
      </div>

      {/* MODAL INPUT TANDA TANGAN (SIGNATURE PAD) */}
      {signatureModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95 duration-150 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <PenTool size={16} className="text-blue-600" />
                  {signatureModal.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Goreskan tanda tangan digital untuk dibubuhkan pada dokumen invoice.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setSignatureModal({ isOpen: false, type: '', title: '', signerName: '' })}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase">
                Nama Penandatangan
              </label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                value={signatureModal.signerName}
                onChange={e => setSignatureModal(prev => ({ ...prev, signerName: e.target.value }))}
                placeholder="Masukkan nama lengkap..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase">
                Goreskan Tanda Tangan
              </label>
              <SignaturePad 
                title=""
                onCancel={() => setSignatureModal({ isOpen: false, type: '', title: '', signerName: '' })}
                onSave={handleSaveSignature}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
