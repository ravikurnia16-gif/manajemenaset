import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import QRCode from 'react-qr-code';
import { 
  Printer, ArrowLeft, Building2, User, Calendar, 
  Package, CheckCircle2, Clock, XCircle, FileText, CheckCheck, Copy, Share2
} from 'lucide-react';

export default function InventoryInvoicePublic() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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
              zoom: 0.92;
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

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-2xs"
              title="Salin Link Invoice Digital"
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
              <div className="text-xs font-mono font-bold text-slate-500">NO. DOKUMEN</div>
              <div className="text-base sm:text-lg font-black text-blue-700 font-mono tracking-tight">{invoice.code}</div>
              
              <div className="mt-2">
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
              </div>
            </div>
          </div>

          {/* JUDUL DOKUMEN */}
          <div className="text-center py-1">
            <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-wide underline underline-offset-4">
              SURAT PERMINTAAN & PENYERAHAN BARANG GUDANG
            </h1>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Lembar Bukti Pengajuan, Persetujuan, dan Serah Terima Barang Logistik
            </p>
          </div>

          {/* META DATA PEMOHON & DOKUMEN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200 text-xs">
            <div className="space-y-1.5">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block">Identitas Pemohon:</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-24">Nama Pemohon</span>
                <span className="font-extrabold text-slate-800">: {invoice.requesterName || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-24">Unit / Departemen</span>
                <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">: {invoice.requesterUnit || 'Umum'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-24">Petugas Input</span>
                <span className="font-medium text-slate-700">: {invoice.createdBy?.name || invoice.createdBy?.username || '-'}</span>
              </div>
            </div>

            <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block">Detail Tanggal:</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-28">Tgl Permohonan</span>
                <span className="font-bold text-slate-800">: {new Date(invoice.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-28">Tgl Input Sistem</span>
                <span className="font-medium text-slate-600">: {new Date(invoice.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-28">Status Dokumen</span>
                <span className="font-bold text-slate-700">: {invoice.status}</span>
              </div>
            </div>
          </div>

          {/* TABEL RINCIAN BARANG */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider">
                  <th className="p-3 w-10 text-center border-r border-slate-700">No</th>
                  <th className="p-3 w-28 border-r border-slate-700">Kode</th>
                  <th className="p-3 border-r border-slate-700">Nama Barang & Kategori</th>
                  <th className="p-3 w-20 text-center border-r border-slate-700">Diminta</th>
                  <th className="p-3 w-20 text-center border-r border-slate-700">Disetujui</th>
                  <th className="p-3 w-20 text-center border-r border-slate-700">Diserahkan</th>
                  <th className="p-3 w-16 text-center border-r border-slate-700">Satuan</th>
                  <th className="p-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-bold text-slate-500 border-r border-slate-200">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-700 border-r border-slate-200">{it.item?.code || '-'}</td>
                      <td className="p-3 border-r border-slate-200">
                        <div className="font-extrabold text-slate-800">{it.item?.name || 'Barang Logistik'}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{it.item?.category?.name || 'Umum'}</div>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-800 border-r border-slate-200 bg-slate-50/50">
                        {it.qtyRequested}
                      </td>
                      <td className="p-3 text-center font-bold text-blue-700 border-r border-slate-200">
                        {it.qtyApproved ?? it.qtyRequested}
                      </td>
                      <td className="p-3 text-center font-black text-emerald-700 border-r border-slate-200 bg-emerald-50/30">
                        {it.qtyDelivered ?? (invoice.status === 'COMPLETED' ? (it.qtyApproved || it.qtyRequested) : 0)}
                      </td>
                      <td className="p-3 text-center text-slate-600 font-semibold border-r border-slate-200">
                        {it.item?.unit || 'Pcs'}
                      </td>
                      <td className="p-3 text-slate-600 text-[11px] italic">
                        {it.note || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="p-6 text-center text-slate-400 italic">
                      Tidak ada daftar item barang pada pesanan ini.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                  <td colSpan="3" className="p-3 text-right uppercase tracking-wider text-[11px] border-r border-slate-200">
                    Total Kuantitas Barang :
                  </td>
                  <td className="p-3 text-center font-mono font-extrabold border-r border-slate-200">{totalRequested}</td>
                  <td className="p-3 text-center font-mono font-extrabold text-blue-700 border-r border-slate-200">{totalApproved || totalRequested}</td>
                  <td className="p-3 text-center font-mono font-extrabold text-emerald-700 border-r border-slate-200">{totalDelivered || (invoice.status === 'COMPLETED' ? totalRequested : 0)}</td>
                  <td colSpan="2" className="p-3 text-slate-500 font-normal text-[11px]">Total unit barang</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* CATATAN TAMBAHAN */}
          {invoice.note && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <span className="font-bold text-slate-700 block">Catatan Tambahan / Keperluan:</span>
              <p className="text-slate-600 italic leading-relaxed">{invoice.note}</p>
            </div>
          )}

          {/* LEMBAR PENGESAHAN & TANDA TANGAN (3 KOLOM RESMI) */}
          <div className="pt-4 border-t border-slate-200">
            <div className="grid grid-cols-3 gap-4 text-center text-xs">
              
              {/* Kolom 1: Pemohon */}
              <div className="flex flex-col justify-between h-36 p-2">
                <div>
                  <span className="font-bold text-slate-700 block">Yang Memohon,</span>
                  <span className="text-[10px] text-slate-400">Unit / Pemesan</span>
                </div>
                <div>
                  <div className="font-extrabold text-slate-800 uppercase underline underline-offset-2">
                    {invoice.requesterName || '( ..................................... )'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{invoice.requesterUnit || 'Pemohon Unit'}</div>
                </div>
              </div>

              {/* Kolom 2: Petugas Gudang */}
              <div className="flex flex-col justify-between h-36 p-2">
                <div>
                  <span className="font-bold text-slate-700 block">Yang Menyerahkan,</span>
                  <span className="text-[10px] text-slate-400">Petugas Gudang Logistik</span>
                </div>
                <div>
                  <div className="font-extrabold text-slate-800 uppercase underline underline-offset-2">
                    ( Petugas Logistik DEI )
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Staff Sarpras & Pergudangan</div>
                </div>
              </div>

              {/* Kolom 3: Mengetahui Kabid */}
              <div className="flex flex-col justify-between h-36 p-2">
                <div>
                  <span className="font-bold text-slate-700 block">Mengetahui & Menyetujui,</span>
                  <span className="text-[10px] text-slate-400">Pengelola Aset & Sarpras</span>
                </div>
                <div>
                  <div className="font-extrabold text-slate-800 uppercase underline underline-offset-2">
                    ( Kabid Sarana & Prasarana )
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Yayasan Dar el-Iman</div>
                </div>
              </div>

            </div>
          </div>

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
    </div>
  );
}
