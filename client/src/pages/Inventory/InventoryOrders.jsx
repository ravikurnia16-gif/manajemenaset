import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, ShoppingCart, Eye, CheckCircle, XCircle, Trash2, 
  Package, Minus, Filter, ArrowRight, Check, X, Store, ShoppingBag, 
  Sparkles, Calendar, User, Building2, FileText, AlertCircle, RefreshCw, 
  Printer, ExternalLink, ArrowLeft, Clock, ShieldCheck, CheckCheck, 
  Tag, Info, AlertTriangle, Layers, ChevronRight, Copy, Warehouse, PenTool,
  Receipt, FileCheck, CreditCard, Banknote, CalendarClock, DollarSign
} from 'lucide-react';
import QRCode from 'react-qr-code';
import Swal from 'sweetalert2';
import api from '../../lib/axios';
import { getMediaUrl } from '../../lib/media';
import SignaturePad from '../../components/SignaturePad';

export default function InventoryOrders() {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [invoiceModalOrder, setInvoiceModalOrder] = useState(null);
  const [docType, setDocType] = useState('nota'); // 'nota' | 'bast'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [signatureModal, setSignatureModal] = useState({
    isOpen: false,
    type: '', // 'requester' | 'deliverer'
    title: '',
    order: null,
    signerName: ''
  });
  const [signing, setSigning] = useState(false);

  // Modal Status & Deadline Pembayaran
  const [paymentModal, setPaymentModal] = useState({
    isOpen: false,
    order: null,
    paymentStatus: 'UNPAID', // 'PAID' | 'UNPAID'
    dueDate: '',
    paidAt: '',
    paymentMethod: 'Tunai / Kasir',
    paymentNote: ''
  });
  const [savingPayment, setSavingPayment] = useState(false);

  const openDocumentModal = (order, type = 'nota') => {
    setInvoiceModalOrder(order);
    setDocType(type);
  };

  const getNamaHari = (dateStr) => {
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = dateStr ? new Date(dateStr) : new Date();
    return hari[d.getDay()] || 'Senin';
  };

  // Catalog search & filter states for Shopee/Tokopedia E-Commerce modal
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('SEMUA');
  const [activeMobileTab, setActiveMobileTab] = useState('catalog'); // 'catalog' | 'cart'

  // Form states for creating order
  const [formData, setFormData] = useState({
    requesterName: '',
    requesterUnit: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    note: '',
    items: [] // array of { itemId, qtyRequested, note }
  });

  // Form states for processing order
  const [processData, setProcessData] = useState({
    status: '',
    note: '',
    warehouseId: '',
    approvedItems: [] // array of { orderItemId, qtyApproved }
  });

  useEffect(() => {
    fetchOrders();
    fetchOptions();
  }, [statusFilter, paymentFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/orders', { 
        params: { 
          status: statusFilter,
          paymentStatus: paymentFilter
        } 
      });
      setOrders(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch (e) {
      console.error(e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [resItems, resWh, resSettings] = await Promise.allSettled([
        api.get('/inventory/items'),
        api.get('/inventory/warehouses'),
        api.get('/settings')
      ]);
      if (resItems.status === 'fulfilled') {
        setItems(Array.isArray(resItems.value.data) ? resItems.value.data : (resItems.value.data?.data || []));
      }
      if (resWh.status === 'fulfilled') {
        setWarehouses(Array.isArray(resWh.value.data) ? resWh.value.data : (resWh.value.data?.data || []));
      }
      if (resSettings.status === 'fulfilled') {
        setSettings(resSettings.value.data);
      }
    } catch (e) {
      console.error(e);
      setItems([]);
      setWarehouses([]);
    }
  };

  // Helper formatting Rupiah
  const formatRupiah = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  // Helper mendapatkan harga jual item (fallback ke modal/price)
  const getItemSellingPrice = (it) => {
    if (it?.sellingPrice !== null && it?.sellingPrice !== undefined && Number(it.sellingPrice) > 0) {
      return Number(it.sellingPrice);
    }
    return Number(it?.price || 0);
  };

  // Helper kuantitas efektif untuk invoice & subtotal
  const getEffectiveQty = (it, status) => {
    if (status === 'COMPLETED') {
      return it.qtyDelivered ?? (it.qtyApproved || it.qtyRequested);
    }
    if (status === 'APPROVED' || status === 'PROCESS') {
      return it.qtyApproved ?? it.qtyRequested;
    }
    return it.qtyRequested || 0;
  };

  // Helper kalkulasi total tagihan pesanan berdasarkan harga jual
  const calculateOrderTotal = (order) => {
    if (!order || !order.items) return 0;
    return order.items.reduce((acc, it) => {
      const price = getItemSellingPrice(it.item);
      const qty = getEffectiveQty(it, order.status);
      return acc + (price * (qty || 0));
    }, 0);
  };

  // Helper terbilang nominal mata uang rupiah
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

  // Helper to extract logged-in user profile info
  const getLoggedInUserInfo = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const name = user.name || user.fullName || user.username || '';
      let unit = '';
      if (user.unit) {
        if (typeof user.unit === 'string') unit = user.unit;
        else if (typeof user.unit === 'object' && user.unit.name) unit = user.unit.name;
      } else if (user.unitName) {
        unit = user.unitName;
      } else if (user.unit_name) {
        unit = user.unit_name;
      } else if (user.department) {
        unit = user.department;
      }
      return { name, unit };
    } catch (e) {
      return { name: '', unit: '' };
    }
  };

  // Helper to extract clean note text
  const getOrderNoteText = (order) => {
    if (!order) return '';
    if (order.displayNote !== undefined) return order.displayNote;
    const noteVal = order.note;
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

  // Helper to extract signatures
  const getOrderSignatures = (order) => {
    if (!order) return { requester: null, deliverer: null, kabid: null };
    if (order.signatures && typeof order.signatures === 'object') {
      return {
        requester: order.signatures.requester || null,
        deliverer: order.signatures.deliverer || null,
        kabid: order.signatures.kabid || null
      };
    }
    if (order.note && typeof order.note === 'string' && order.note.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(order.note);
        return {
          requester: parsed.signatures?.requester || null,
          deliverer: parsed.signatures?.deliverer || null,
          kabid: parsed.signatures?.kabid || null
        };
      } catch (e) {}
    }
    return { requester: null, deliverer: null, kabid: null };
  };

  // Helper check if logged in user is Kepala Bidang Sarana
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

  // Buka Modal Input Tanda Tangan
  const openSignatureModal = (type, order) => {
    let title = 'Tanda Tangan Pemohon Barang';
    let defaultName = order.requesterName || '';
    if (type === 'deliverer') {
      title = 'Tanda Tangan Petugas Gudang (Yang Menyerahkan)';
      const userInfo = getLoggedInUserInfo();
      defaultName = userInfo.name || 'Petugas Logistik DEI';
    }
    setSignatureModal({
      isOpen: true,
      type,
      title,
      order,
      signerName: defaultName
    });
  };

  // Simpan Tanda Tangan dari SignaturePad
  const handleSaveSignature = async (dataUrl) => {
    if (!signatureModal.order || !signatureModal.type) return;
    setSigning(true);
    try {
      const res = await api.put(`/inventory/orders/${signatureModal.order.id}/signatures`, {
        type: signatureModal.type,
        signatureData: dataUrl,
        signerName: signatureModal.signerName
      });
      const updated = res.data;
      setInvoiceModalOrder(updated);
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      if (selectedOrder && selectedOrder.id === updated.id) setSelectedOrder(updated);
      setSignatureModal({ isOpen: false, type: '', title: '', order: null, signerName: '' });
      Swal.fire({
        icon: 'success',
        title: 'Tanda Tangan Tersimpan',
        text: 'Tanda tangan resmi telah terpasang pada faktur invoice.',
        timer: 1300,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('Gagal Menyimpan', err.response?.data?.error || 'Terjadi kesalahan saat menyimpan tanda tangan', 'error');
    } finally {
      setSigning(false);
    }
  };

  // Reset / Hapus Tanda Tangan
  const handleResetSignature = async (order, type) => {
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
      const res = await api.put(`/inventory/orders/${order.id}/signatures`, {
        type,
        action: 'RESET'
      });
      const updated = res.data;
      setInvoiceModalOrder(updated);
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      if (selectedOrder && selectedOrder.id === updated.id) setSelectedOrder(updated);
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

  // ACC Resmi Kepala Bidang Sarana
  const handleKabidAcc = async (order, isReset = false) => {
    if (!order) return;

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
        const res = await api.put(`/inventory/orders/${order.id}/signatures`, {
          type: 'kabid',
          action: 'RESET'
        });
        const updated = res.data;
        setInvoiceModalOrder(updated);
        setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
        if (selectedOrder && selectedOrder.id === updated.id) setSelectedOrder(updated);
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
            <div><b>Kode:</b> ${order.code}</div>
            <div><b>Pemohon:</b> ${order.requesterName} (${order.requesterUnit || 'Umum'})</div>
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
      const res = await api.put(`/inventory/orders/${order.id}/signatures`, {
        type: 'kabid',
        action: 'SIGN'
      });
      const updated = res.data;
      setInvoiceModalOrder(updated);
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      if (selectedOrder && selectedOrder.id === updated.id) setSelectedOrder(updated);
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

  // Helper check if order is past payment due date
  const isOrderOverdue = (order) => {
    if (!order || order.paymentStatus === 'PAID' || !order.dueDate) return false;
    const due = new Date(order.dueDate);
    due.setHours(23, 59, 59, 999);
    return due < new Date();
  };

  // Badge Status Pembayaran
  const getPaymentBadge = (order) => {
    if (!order) return null;
    if (order.paymentStatus === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-2xs">
          <CheckCircle size={11} className="text-emerald-600 shrink-0" />
          <span>✓ LUNAS</span>
        </span>
      );
    }
    if (isOrderOverdue(order)) {
      return (
        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-2xs animate-pulse" title="Melewati batas waktu jatuh tempo">
          <AlertTriangle size={11} className="text-rose-600 shrink-0" />
          <span>⚠️ LEWAT TEMPO</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-2xs">
        <Clock size={11} className="text-amber-600 shrink-0" />
        <span>BELUM LUNAS</span>
      </span>
    );
  };

  // Open Payment Modal
  const openPaymentModal = (order) => {
    setPaymentModal({
      isOpen: true,
      order,
      paymentStatus: order.paymentStatus || 'UNPAID',
      dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split('T')[0] : '',
      paidAt: order.paidAt ? new Date(order.paidAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      paymentMethod: order.paymentMethod || 'Tunai / Kasir',
      paymentNote: order.paymentNote || ''
    });
  };

  // Handle Save Payment Modal
  const handleSavePayment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!paymentModal.order) return;

    setSavingPayment(true);
    try {
      const res = await api.put(`/inventory/orders/${paymentModal.order.id}/payment`, {
        paymentStatus: paymentModal.paymentStatus,
        dueDate: paymentModal.dueDate || null,
        paidAt: paymentModal.paymentStatus === 'PAID' ? (paymentModal.paidAt ? new Date(paymentModal.paidAt).toISOString() : new Date().toISOString()) : null,
        paymentMethod: paymentModal.paymentStatus === 'PAID' ? paymentModal.paymentMethod : null,
        paymentNote: paymentModal.paymentNote
      });

      const updated = res.data;
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      if (invoiceModalOrder && invoiceModalOrder.id === updated.id) setInvoiceModalOrder(updated);
      if (selectedOrder && selectedOrder.id === updated.id) setSelectedOrder(updated);
      setPaymentModal(prev => ({ ...prev, isOpen: false, order: null }));

      Swal.fire({
        icon: 'success',
        title: updated.paymentStatus === 'PAID' ? 'Faktur Ditandai LUNAS!' : 'Ditandai BELUM LUNAS',
        text: `Status pembayaran faktur ${updated.code} berhasil diperbarui.`,
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('Gagal Menyimpan', err.response?.data?.error || 'Terjadi kesalahan saat memperbarui status pembayaran', 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  // Quick toggle payment status directly
  const handleQuickTogglePayment = async (order) => {
    if (!order) return;
    const isCurrentlyPaid = order.paymentStatus === 'PAID';
    const newStatus = isCurrentlyPaid ? 'UNPAID' : 'PAID';

    const confirm = await Swal.fire({
      title: isCurrentlyPaid ? 'Tandai BELUM LUNAS?' : 'Tandai LUNAS?',
      html: `
        <div class="text-left text-xs space-y-2 text-slate-600">
          <p>Ubah status pembayaran faktur <b>${order.code}</b> (${order.requesterName}) menjadi:</p>
          <div class="p-2.5 rounded-xl font-bold text-center text-sm ${
            newStatus === 'PAID' ? 'bg-emerald-50 border border-emerald-300 text-emerald-800' : 'bg-rose-50 border border-rose-300 text-rose-800'
          }">
            ${newStatus === 'PAID' ? '✓ LUNAS (PAID)' : '⏳ BELUM LUNAS (UNPAID)'}
          </div>
          <p class="text-[11px] text-slate-400">Total Tagihan: <b>${formatRupiah(calculateOrderTotal(order))}</b></p>
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
      const res = await api.put(`/inventory/orders/${order.id}/payment`, {
        paymentStatus: newStatus,
        paidAt: newStatus === 'PAID' ? new Date().toISOString() : null,
        paymentMethod: newStatus === 'PAID' ? (order.paymentMethod || 'Tunai / Kasir') : null
      });
      const updated = res.data;
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      if (invoiceModalOrder && invoiceModalOrder.id === updated.id) setInvoiceModalOrder(updated);
      if (selectedOrder && selectedOrder.id === updated.id) setSelectedOrder(updated);

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

  // Helper untuk cek stok barang di gudang
  const getItemStockInWh = (itemId, whId) => {
    const it = (items || []).find(i => i.id === itemId);
    if (!it || !it.stocks) return 0;
    if (whId) {
      const st = Array.isArray(it.stocks) ? it.stocks.find(s => s.warehouseId === parseInt(whId)) : null;
      return st?.quantity || 0;
    }
    return it.totalStock || 0;
  };

  const openCreateModal = () => {
    const userInfo = getLoggedInUserInfo();
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 14); // default 14 hari

    setFormData({
      requesterName: userInfo.name,
      requesterUnit: userInfo.unit,
      date: new Date().toISOString().split('T')[0],
      dueDate: defaultDueDate.toISOString().split('T')[0],
      note: '',
      items: []
    });
    setCatalogSearch('');
    setSelectedCategory('SEMUA');
    setActiveMobileTab('catalog');
    setIsCreateModalOpen(true);
  };

  // Cart Helper Functions
  const addToCart = (item) => {
    setFormData(prev => {
      const exists = prev.items.find(i => i.itemId === item.id);
      if (exists) return prev;
      return {
        ...prev,
        items: [...prev.items, { itemId: item.id, qtyRequested: 1, note: '' }]
      };
    });
  };

  const updateCartQty = (itemId, qty) => {
    const parsedQty = parseInt(qty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(i => i.itemId === itemId ? { ...i, qtyRequested: parsedQty } : i)
    }));
  };

  const updateCartNote = (itemId, note) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(i => i.itemId === itemId ? { ...i, note } : i)
    }));
  };

  const removeFromCart = (itemId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.itemId !== itemId)
    }));
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Keranjang masih kosong. Pilih minimal satu barang.' });
    if (!formData.requesterName.trim()) return Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Nama pemesan wajib diisi.' });
    
    setSubmitting(true);
    try {
      await api.post('/inventory/orders', {
        ...formData,
        dueDate: formData.dueDate || null,
        items: formData.items.map(i => ({
          itemId: parseInt(i.itemId),
          qtyRequested: parseInt(i.qtyRequested),
          note: i.note
        }))
      });
      setIsCreateModalOpen(false);
      fetchOrders();
      Swal.fire({
        icon: 'success',
        title: 'Pesanan Dikirim!',
        text: 'Permohonan barang logistik berhasil diajukan dan masuk ke sistem.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal Membuat Pesanan', text: e.response?.data?.error || 'Terjadi kesalahan saat membuat pesanan' });
    } finally {
      setSubmitting(false);
    }
  };

  const openProcessModal = (order) => {
    setSelectedOrder(order);
    setCopiedCode(false);
    setProcessData({
      status: order.status || 'PENDING',
      note: order.note || '',
      warehouseId: warehouses.length === 1 ? String(warehouses[0].id) : '',
      approvedItems: (order.items || []).map(it => ({ 
        orderItemId: it.id, 
        qtyApproved: it.qtyApproved ?? it.qtyRequested 
      }))
    });
    setIsProcessModalOpen(true);
  };

  // Quick helper: Setujui semua barang 100% sesuai permintaan
  const handleApproveAllFull = () => {
    if (!selectedOrder) return;
    setProcessData(prev => ({
      ...prev,
      status: prev.status === 'PENDING' ? 'APPROVED' : prev.status,
      approvedItems: (selectedOrder.items || []).map(it => ({
        orderItemId: it.id,
        qtyApproved: it.qtyRequested
      }))
    }));
  };

  // Quick helper: Setujui semua barang = 0 (Tolak/Kosong)
  const handleApproveAllZero = () => {
    if (!selectedOrder) return;
    setProcessData(prev => ({
      ...prev,
      approvedItems: (selectedOrder.items || []).map(it => ({
        orderItemId: it.id,
        qtyApproved: 0
      }))
    }));
  };

  const handleProcessOrder = async (e) => {
    e.preventDefault();
    try {
      if (processData.status === 'COMPLETED' && selectedOrder.status !== 'COMPLETED' && !processData.warehouseId) {
        return Swal.fire({ icon: 'warning', title: 'Pilih Gudang', text: 'Pilih gudang sumber untuk memproses dan memotong stok barang pesanan.' });
      }

      await api.put(`/inventory/orders/${selectedOrder.id}/status`, processData);
      setIsProcessModalOpen(false);
      fetchOrders();
      Swal.fire({
        icon: 'success',
        title: 'Status Diperbarui',
        text: `Pesanan ${selectedOrder.code} berhasil diperbarui ke status ${processData.status}.`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal Memproses', text: e.response?.data?.error || 'Terjadi kesalahan saat memproses pesanan' });
    }
  };

  const handleCopyOrderCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': 
        return <span className="bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">⏳ Menunggu</span>;
      case 'APPROVED': 
        return <span className="bg-blue-50 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">✓ Disetujui</span>;
      case 'PROCESS': 
        return <span className="bg-indigo-50 text-indigo-800 border border-indigo-300 px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">🔄 Diproses</span>;
      case 'COMPLETED': 
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">✓ Selesai</span>;
      case 'REJECTED': 
        return <span className="bg-rose-50 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">✕ Ditolak</span>;
      default: 
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const filteredOrders = (orders || []).filter(o => {
    if (!o) return false;
    const term = (search || '').toLowerCase();
    const code = (o.code || '').toLowerCase();
    const reqName = (o.requesterName || '').toLowerCase();
    const reqUnit = (o.requesterUnit || '').toLowerCase();
    const matchSearch = code.includes(term) || reqName.includes(term) || reqUnit.includes(term);
    if (!matchSearch) return false;

    if (paymentFilter === 'PAID') {
      return o.paymentStatus === 'PAID';
    }
    if (paymentFilter === 'UNPAID') {
      return o.paymentStatus !== 'PAID';
    }
    if (paymentFilter === 'OVERDUE') {
      return isOrderOverdue(o);
    }
    return true;
  });

  // Categories extracted from items list
  const categoryList = ['SEMUA', ...new Set((items || []).map(i => i.category?.name).filter(Boolean))];

  // Filtered Catalog Items for E-Commerce View
  const catalogItems = (items || []).filter(item => {
    if (!item) return false;
    const term = (catalogSearch || '').toLowerCase();
    const nameMatch = (item.name || '').toLowerCase().includes(term);
    const codeMatch = (item.code || '').toLowerCase().includes(term);
    const matchSearch = nameMatch || codeMatch;
    const matchCategory = selectedCategory === 'SEMUA' || item.category?.name === selectedCategory;
    return matchSearch && matchCategory;
  });

  // Calculate Total Quantity & Estimated Value in Cart
  const totalCartCount = (formData.items || []).reduce((acc, curr) => acc + (parseInt(curr.qtyRequested) || 0), 0);
  const totalEstimatedValue = (formData.items || []).reduce((acc, curr) => {
    const itemObj = (items || []).find(i => i.id === curr.itemId);
    const price = getItemSellingPrice(itemObj);
    return acc + (price * (parseInt(curr.qtyRequested) || 0));
  }, 0);

  // Stats in selected order
  const totalRequestedInOrder = selectedOrder ? (selectedOrder.items || []).reduce((acc, i) => acc + (i.qtyRequested || 0), 0) : 0;
  const totalApprovedInOrder = selectedOrder ? (processData.approvedItems || []).reduce((acc, i) => acc + (parseInt(i.qtyApproved) || 0), 0) : 0;
  const totalOrderValueInModal = selectedOrder ? (selectedOrder.items || []).reduce((acc, it) => {
    const sellPrice = getItemSellingPrice(it.item);
    const approvedVal = (processData.approvedItems || []).find(ai => ai.orderItemId === it.id)?.qtyApproved ?? (it.qtyApproved ?? it.qtyRequested);
    const effectiveQty = selectedOrder.status === 'COMPLETED' ? (it.qtyDelivered ?? approvedVal) : approvedVal;
    return acc + (sellPrice * effectiveQty);
  }, 0) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
                Pesanan & Permohonan Barang Logistik
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola permohonan pengadaan barang antar unit dan proses serah terima barang gudang.
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={openCreateModal}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 text-xs sm:text-sm"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>+ Buat Pesanan Baru</span>
        </button>
      </div>

      {/* ORDERS LIST CARD */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 bg-slate-50/70 items-center justify-between">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari kode pesanan, pemesan, atau unit..."
              className="pl-10 pr-4 py-2 w-full border border-slate-200 bg-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-2xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={15} className="text-slate-400" />
            <select 
              className="border border-slate-200 bg-white px-3 py-2 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">-- Semua Status ({orders.length}) --</option>
              <option value="PENDING">Menunggu (Pending)</option>
              <option value="APPROVED">Disetujui (Approved)</option>
              <option value="PROCESS">Diproses (Process)</option>
              <option value="COMPLETED">Selesai (Completed)</option>
              <option value="REJECTED">Ditolak (Rejected)</option>
            </select>

            <select 
              className={`border px-3 py-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs transition-all ${
                paymentFilter === 'PAID' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                paymentFilter === 'OVERDUE' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                paymentFilter === 'UNPAID' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                'border-slate-200 bg-white text-slate-700'
              }`}
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="">-- Semua Pembayaran --</option>
              <option value="PAID">✓ Lunas (Paid)</option>
              <option value="UNPAID">⏳ Belum Lunas (Unpaid)</option>
              <option value="OVERDUE">⚠️ Lewat Jatuh Tempo</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                <th className="p-3.5">Tanggal & Kode</th>
                <th className="p-3.5">Pemohon</th>
                <th className="p-3.5">Unit Kerja</th>
                <th className="p-3.5">Jumlah Barang</th>
                <th className="p-3.5 text-right">Total Nilai (Jual)</th>
                <th className="p-3.5">Status Barang</th>
                <th className="p-3.5">Pembayaran</th>
                <th className="p-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                    Memuat data pesanan...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">
                    Tidak ada pesanan barang yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const orderVal = calculateOrderTotal(order);

                  return (
                    <tr key={order.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-sm text-slate-800">
                          {order.date ? new Date(order.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : (order.createdAt ? new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono font-bold mt-0.5">{order.code || '-'}</div>
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">{order.requesterName || '-'}</td>
                      <td className="p-3.5">
                        <span className="text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-medium text-[11px]">
                          {order.requesterUnit || 'Umum'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-700 font-bold">
                        {order.items?.length || 0} jenis barang
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-blue-700 text-xs sm:text-sm">
                        {formatRupiah(orderVal)}
                      </td>
                      <td className="p-3.5">{getStatusBadge(order.status)}</td>
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {getPaymentBadge(order)}
                            <button
                              type="button"
                              onClick={() => handleQuickTogglePayment(order)}
                              className="text-[10px] text-slate-400 hover:text-blue-600 transition p-0.5 rounded hover:bg-slate-100"
                              title="Ubah Cepat Status Lunas/Belum Lunas"
                            >
                              <RefreshCw size={11} />
                            </button>
                          </div>
                          {order.paymentStatus === 'PAID' ? (
                            <div className="text-[10.5px] text-slate-500 font-medium">
                              <span>{order.paymentMethod || 'Tunai'}</span>
                              {order.paidAt && (
                                <span className="text-slate-400 font-mono text-[10px] ml-1">
                                  • {new Date(order.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className={`text-[10.5px] font-medium flex items-center gap-1 ${isOrderOverdue(order) ? 'text-rose-600 font-extrabold' : 'text-slate-500'}`}>
                              <CalendarClock size={11} className={isOrderOverdue(order) ? 'text-rose-600' : 'text-slate-400'} />
                              <span>{order.dueDate ? `Tempo: ${new Date(order.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : 'Tanpa Deadline'}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <button 
                            type="button"
                            onClick={() => openDocumentModal(order, 'nota')}
                            className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg inline-flex items-center text-xs font-bold transition-all gap-1 shadow-2xs cursor-pointer"
                            title="Buka & Cetak Nota / Faktur Penjualan"
                          >
                            <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Nota
                          </button>
                          <button 
                            type="button"
                            onClick={() => openDocumentModal(order, 'bast')}
                            className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg inline-flex items-center text-xs font-bold transition-all gap-1 shadow-2xs cursor-pointer"
                            title="Buka & Cetak Berita Acara Serah Terima (BAST)"
                          >
                            <FileCheck className="w-3.5 h-3.5 text-indigo-600" /> BAST
                          </button>
                          <button 
                            type="button"
                            onClick={() => openPaymentModal(order)}
                            className={`px-2 py-1 rounded-lg inline-flex items-center text-xs font-bold transition-all gap-1 shadow-2xs cursor-pointer ${
                              order.paymentStatus === 'PAID'
                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300'
                                : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300'
                            }`}
                            title="Atur Pembayaran & Jatuh Tempo"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Bayar
                          </button>
                          <button 
                            onClick={() => openProcessModal(order)}
                            className="text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg inline-flex items-center text-xs font-bold transition-all gap-1 shadow-2xs cursor-pointer"
                            title="Detail & Proses Status Pesanan"
                          >
                            <Eye className="w-3.5 h-3.5" /> Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: BUAT PESANAN BARU (E-COMMERCE VIEW) */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-auto">
            
            {/* Modal Header */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Store size={22} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                    Katalog & Permohonan Logistik
                    <span className="bg-blue-50 text-blue-600 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-blue-100">
                      Katalog Barang
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">Pilih barang langsung dari katalog dan tentukan kuantitas kebutuhan unit Anda.</p>
                </div>
              </div>

              {/* Mobile Tabs Switcher */}
              <div className="flex lg:hidden items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('catalog')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeMobileTab === 'catalog' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  📦 Katalog ({catalogItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('cart')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeMobileTab === 'cart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  <ShoppingCart size={13} />
                  <span>Keranjang ({formData.items.length})</span>
                </button>
              </div>

              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Split 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
              
              {/* LEFT COLUMN: CATALOG PRODUCTS (7 Columns) */}
              <div className={`lg:col-span-7 p-4 border-r border-slate-200 overflow-y-auto space-y-4 ${activeMobileTab === 'catalog' ? 'block' : 'hidden lg:block'}`}>
                
                {/* Search & Category Filter */}
                <div className="space-y-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Cari nama barang atau kode barang..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {categoryList.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                          selectedCategory === cat
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {cat === 'SEMUA' ? '🌐 Semua Kategori' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Catalog Product Cards Grid */}
                {catalogItems.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-2">
                    <Package className="w-12 h-12 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">Barang Tidak Ditemukan</p>
                    <p className="text-xs text-slate-400">Coba cari dengan kata kunci lain atau pilih kategori berbeda.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {catalogItems.map(item => {
                      const cartItem = formData.items.find(i => i.itemId === item.id);
                      const inCart = !!cartItem;
                      const hasStock = (item.totalStock ?? 0) > 0;
                      const isLowStock = hasStock && (item.totalStock <= (item.minStock || 5));

                      return (
                        <div 
                          key={item.id}
                          className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between hover:shadow-md ${
                            inCart ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <div>
                            <div className="h-28 bg-slate-100 relative overflow-hidden flex items-center justify-center border-b border-slate-100 group">
                              {item.image ? (
                                <img 
                                  src={getMediaUrl(item.image)} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                />
                              ) : (
                                <Package className="w-10 h-10 text-slate-300" />
                              )}
                              
                              <div className="absolute top-2 left-2">
                                {item.totalStock === 0 ? (
                                  <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                    Habis
                                  </span>
                                ) : isLowStock ? (
                                  <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                    Stok: {item.totalStock} {item.unit}
                                  </span>
                                ) : (
                                  <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                    Stok: {item.totalStock} {item.unit}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="p-3 space-y-1">
                              <p className="text-[10px] font-mono text-slate-400">{item.code}</p>
                              <h3 className="font-bold text-slate-800 text-xs line-clamp-2 leading-snug" title={item.name}>
                                {item.name}
                              </h3>
                              <div className="flex items-center justify-between pt-1">
                                <p className="text-[10px] text-slate-500 font-medium">Satuan: {item.unit}</p>
                                <span className="text-xs font-black text-blue-700 font-mono">
                                  {formatRupiah(getItemSellingPrice(item))}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="p-2 pt-0">
                            {inCart ? (
                              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.id, cartItem.qtyRequested - 1)}
                                  className="w-7 h-7 bg-white text-blue-700 rounded-lg flex items-center justify-center font-bold hover:bg-blue-100 shadow-xs"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="text-xs font-bold text-blue-900 px-2">{cartItem.qtyRequested}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.id, cartItem.qtyRequested + 1)}
                                  className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold hover:bg-blue-700 shadow-xs"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(item)}
                                className="w-full bg-slate-900 hover:bg-blue-600 text-white py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                              >
                                <Plus size={13} /> Tambah
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: CHECKOUT CART & ORDER FORM (5 Columns) */}
              <div className={`lg:col-span-5 bg-white flex flex-col justify-between overflow-y-auto ${activeMobileTab === 'cart' ? 'block' : 'hidden lg:flex'}`}>
                <form onSubmit={handleCreateOrder} className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Pemesan Info Card */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                        <User size={14} className="text-blue-600" /> Identitas Pemohon & Tanggal
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Pemohon</label>
                          <input 
                            type="text"
                            required
                            placeholder="Nama pemohon..."
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.requesterName}
                            onChange={e => setFormData({...formData, requesterName: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit / Departemen</label>
                          <input 
                            type="text"
                            required
                            placeholder="Contoh: SD IT, TK, IT..."
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.requesterUnit}
                            onChange={e => setFormData({...formData, requesterUnit: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tanggal Pesanan</label>
                          <input 
                            type="date"
                            required
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.date}
                            onChange={e => setFormData({...formData, date: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                            <span>Deadline Jatuh Tempo</span>
                            <span className="text-blue-600 font-semibold lowercase text-[9.5px]">(Batas Bayar)</span>
                          </label>
                          <input 
                            type="date"
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.dueDate}
                            onChange={e => setFormData({...formData, dueDate: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cart Items List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <ShoppingCart size={14} className="text-blue-600" />
                          Rincian Keranjang ({formData.items.length})
                        </h3>
                        {formData.items.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, items: [] }))}
                            className="text-[10px] text-rose-600 font-bold hover:underline"
                          >
                            Kosongkan
                          </button>
                        )}
                      </div>

                      {formData.items.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-2 bg-slate-50/50">
                          <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-xs font-bold text-slate-600">Keranjang Masih Kosong</p>
                          <p className="text-[11px] text-slate-400">Pilih barang dari katalog di sebelah kiri untuk ditambahkan ke pesanan.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {formData.items.map((cartItem) => {
                            const itemDetails = items.find(i => i.id === cartItem.itemId) || {};
                            return (
                              <div 
                                key={cartItem.itemId} 
                                className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2 relative"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-xs font-bold text-slate-800 truncate" title={itemDetails.name}>
                                      {itemDetails.name || 'Barang'}
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                      <span>{itemDetails.code}</span>
                                      <span>•</span>
                                      <span className="text-blue-700 font-bold">{formatRupiah(getItemSellingPrice(itemDetails))} / {itemDetails.unit || 'Pcs'}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center border border-slate-300 bg-white rounded-lg">
                                    <button
                                      type="button"
                                      onClick={() => updateCartQty(cartItem.itemId, cartItem.qtyRequested - 1)}
                                      className="p-1 text-slate-600 hover:bg-slate-100 rounded-l-lg"
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <input 
                                      type="number" 
                                      min="1" 
                                      className="w-10 text-center text-xs font-bold bg-transparent outline-none"
                                      value={cartItem.qtyRequested}
                                      onChange={(e) => updateCartQty(cartItem.itemId, e.target.value)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateCartQty(cartItem.itemId, cartItem.qtyRequested + 1)}
                                      className="p-1 text-slate-600 hover:bg-slate-100 rounded-r-lg"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>

                                  <div className="text-right min-w-[70px]">
                                    <span className="text-xs font-black font-mono text-blue-800">
                                      {formatRupiah(getItemSellingPrice(itemDetails) * (parseInt(cartItem.qtyRequested) || 0))}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(cartItem.itemId)}
                                    className="text-slate-400 hover:text-rose-600 p-1"
                                    title="Hapus"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>

                                <input
                                  type="text"
                                  placeholder="Catatan khusus item ini (opsional)..."
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                                  value={cartItem.note}
                                  onChange={(e) => updateCartNote(cartItem.itemId, e.target.value)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* General Order Note */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Catatan Umum Pesanan</label>
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                        rows="2"
                        placeholder="Contoh: Diperlukan untuk kegiatan operasional unit..."
                        value={formData.note}
                        onChange={e => setFormData({...formData, note: e.target.value})}
                      ></textarea>
                    </div>
                  </div>

                  {/* Checkout Footer */}
                  <div className="pt-3 border-t border-slate-200 space-y-2 bg-white">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Total Kuantitas Permintaan:</span>
                      <span className="text-blue-600 font-extrabold">{totalCartCount} Unit</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 pt-1 border-t border-slate-100">
                      <span>Total Estimasi (Harga Jual):</span>
                      <span className="text-emerald-700 font-mono font-black text-sm">{formatRupiah(totalEstimatedValue)}</span>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => setIsCreateModalOpen(false)} 
                        className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                      <button 
                        type="submit" 
                        disabled={submitting || formData.items.length === 0}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Mengirim...
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={14} /> Ajukan Permohonan ({formData.items.length})
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DETAIL & PROSES PESANAN (PREMIUM, STRUCTURED & INTERACTIVE) */}
      {/* ========================================================================= */}
      {isProcessModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-auto">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-800">Detail & Proses Pesanan</h2>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs font-mono text-xs font-bold text-blue-700">
                      <span>{selectedOrder.code || '-'}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyOrderCode(selectedOrder.code || '')}
                        className="text-slate-400 hover:text-blue-600 transition p-0.5"
                        title="Salin Kode Pesanan"
                      >
                        {copiedCode ? <CheckCheck size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Verifikasi kuantitas, persetujuan admin, dan serah terima pengeluaran stok.</p>
                </div>
              </div>

              {/* Action Buttons Header */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => openDocumentModal(selectedOrder, 'nota')}
                  className="text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                  title="Buka & Cetak Nota / Faktur Penjualan"
                >
                  <Receipt size={14} className="text-emerald-700" /> Cetak Nota
                </button>
                <button
                  type="button"
                  onClick={() => openDocumentModal(selectedOrder, 'bast')}
                  className="text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                  title="Buka & Cetak Berita Acara Serah Terima (BAST)"
                >
                  <FileCheck size={14} className="text-indigo-700" /> Cetak BAST
                </button>
                <button 
                  onClick={() => setIsProcessModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleProcessOrder} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 custom-scrollbar">
              
              {/* 1. INTERACTIVE WORKFLOW STEPPER */}
              <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 p-3.5 sm:p-4 rounded-2xl border border-blue-200/80 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <Clock size={13} className="text-blue-600" /> Alur Tahapan Pesanan:
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Step 1: PENDING */}
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                    selectedOrder.status === 'PENDING'
                      ? 'bg-amber-100/90 border-amber-300 text-amber-900 shadow-2xs font-bold'
                      : ['APPROVED', 'PROCESS', 'COMPLETED'].includes(selectedOrder.status)
                      ? 'bg-white border-slate-200 text-emerald-700'
                      : 'bg-white/60 border-slate-200 text-slate-400'
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      ['APPROVED', 'PROCESS', 'COMPLETED'].includes(selectedOrder.status) ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {['APPROVED', 'PROCESS', 'COMPLETED'].includes(selectedOrder.status) ? '✓' : '1'}
                    </div>
                    <span className="text-xs">1. Diajukan</span>
                  </div>

                  {/* Step 2: APPROVED */}
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                    selectedOrder.status === 'APPROVED'
                      ? 'bg-blue-100 border-blue-300 text-blue-900 shadow-2xs font-bold'
                      : ['PROCESS', 'COMPLETED'].includes(selectedOrder.status)
                      ? 'bg-white border-slate-200 text-emerald-700'
                      : 'bg-white/60 border-slate-200 text-slate-400'
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      ['PROCESS', 'COMPLETED'].includes(selectedOrder.status) ? 'bg-emerald-600 text-white' : (selectedOrder.status === 'APPROVED' ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700')
                    }`}>
                      {['PROCESS', 'COMPLETED'].includes(selectedOrder.status) ? '✓' : '2'}
                    </div>
                    <span className="text-xs">2. Disetujui</span>
                  </div>

                  {/* Step 3: PROCESS */}
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                    selectedOrder.status === 'PROCESS'
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-900 shadow-2xs font-bold'
                      : selectedOrder.status === 'COMPLETED'
                      ? 'bg-white border-slate-200 text-emerald-700'
                      : 'bg-white/60 border-slate-200 text-slate-400'
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      selectedOrder.status === 'COMPLETED' ? 'bg-emerald-600 text-white' : (selectedOrder.status === 'PROCESS' ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-700')
                    }`}>
                      {selectedOrder.status === 'COMPLETED' ? '✓' : '3'}
                    </div>
                    <span className="text-xs">3. Penyiapan</span>
                  </div>

                  {/* Step 4: COMPLETED */}
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                    selectedOrder.status === 'COMPLETED'
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-900 shadow-2xs font-bold'
                      : selectedOrder.status === 'REJECTED'
                      ? 'bg-rose-100 border-rose-300 text-rose-900 shadow-2xs font-bold'
                      : 'bg-white/60 border-slate-200 text-slate-400'
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      selectedOrder.status === 'COMPLETED' ? 'bg-emerald-600 text-white' : (selectedOrder.status === 'REJECTED' ? 'bg-rose-600 text-white' : 'bg-slate-300 text-slate-700')
                    }`}>
                      {selectedOrder.status === 'COMPLETED' ? '✓' : (selectedOrder.status === 'REJECTED' ? '✕' : '4')}
                    </div>
                    <span className="text-xs">{selectedOrder.status === 'REJECTED' ? '4. Ditolak' : '4. Diserahkan'}</span>
                  </div>
                </div>
              </div>

              {/* 2. SUMMARY GRID: PEMOHON & KEPERLUAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Identitas Pemohon</span>
                  <div className="font-extrabold text-slate-800 text-sm">{selectedOrder.requesterName || '-'}</div>
                  <div className="text-xs font-semibold text-blue-700 mt-0.5">{selectedOrder.requesterUnit || 'Unit Umum'}</div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tanggal Permohonan</span>
                  <div className="font-bold text-slate-800 text-sm">
                    {selectedOrder.date ? new Date(selectedOrder.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Input: {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString('id-ID') : '-'}</div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ringkasan Item</span>
                  <div className="font-bold text-slate-800 text-sm">
                    {selectedOrder.items?.length || 0} Jenis Barang
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Permintaan: <b>{totalRequestedInOrder} Unit</b> • Disetujui: <b className="text-blue-700">{totalApprovedInOrder} Unit</b>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/80 p-3.5 rounded-2xl border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block mb-1">Total Nilai Tagihan</span>
                  <div className="font-mono font-black text-blue-800 text-sm sm:text-base">
                    {formatRupiah(totalOrderValueInModal)}
                  </div>
                  <div className="text-[10px] text-blue-600 font-medium mt-0.5">Berdasarkan harga jual</div>
                </div>

                {selectedOrder.note && (
                  <div className="col-span-full bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5 mb-0.5">
                      <Tag size={13} className="text-amber-600" /> Catatan / Keterangan Pemohon:
                    </span>
                    <p className="text-amber-950 italic">{selectedOrder.note}</p>
                  </div>
                )}
              </div>

              {/* CARD STATUS & DEADLINE PEMBAYARAN */}
              <div className="bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                      <CreditCard size={16} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                        Informasi Pembayaran & Jatuh Tempo
                      </h3>
                      <p className="text-[10.5px] text-slate-500">Kelola status pelunasan faktur pesanan logistik</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPaymentBadge(selectedOrder)}
                    <button
                      type="button"
                      onClick={() => openPaymentModal(selectedOrder)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <CreditCard size={12} /> Ubah Rincian Bayar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Status Pembayaran</span>
                    <div className={`font-black text-xs flex items-center gap-1 ${selectedOrder.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {selectedOrder.paymentStatus === 'PAID' ? '✓ SUDAH LUNAS' : '⏳ BELUM LUNAS'}
                    </div>
                    {selectedOrder.paymentStatus === 'PAID' && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Metode: <b>{selectedOrder.paymentMethod || 'Tunai / Kasir'}</b>
                        {selectedOrder.paidAt && (
                          <span> • Tgl: {new Date(selectedOrder.paidAt).toLocaleDateString('id-ID')}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Batas Jatuh Tempo (Deadline)</span>
                    <div className={`font-extrabold text-xs flex items-center gap-1 ${isOrderOverdue(selectedOrder) ? 'text-rose-600' : 'text-slate-700'}`}>
                      <CalendarClock size={13} className={isOrderOverdue(selectedOrder) ? 'text-rose-600' : 'text-slate-400'} />
                      <span>
                        {selectedOrder.dueDate ? new Date(selectedOrder.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Tidak ada deadline'}
                      </span>
                    </div>
                    {isOrderOverdue(selectedOrder) && (
                      <span className="text-[10px] text-rose-600 font-bold block animate-pulse mt-0.5">
                        ⚠️ Lewat dari tanggal jatuh tempo
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Aksi Cepat</span>
                    <button
                      type="button"
                      onClick={() => handleQuickTogglePayment(selectedOrder)}
                      className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold border transition shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 ${
                        selectedOrder.paymentStatus === 'PAID'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {selectedOrder.paymentStatus === 'PAID' ? (
                        <>
                          <XCircle size={13} />
                          <span>Tandai BELUM LUNAS</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={13} />
                          <span>Tandai LUNAS Sekarang</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. TABLE OF ITEMS & APPROVAL QTY */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Package size={15} className="text-blue-600" />
                    Daftar Barang & Kuantitas Persetujuan
                  </h3>
                  
                  {/* Quick Action Buttons */}
                  {selectedOrder.status !== 'COMPLETED' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleApproveAllFull}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition shadow-2xs"
                      >
                        ✓ Setujui Penuh (100%)
                      </button>
                      <button
                        type="button"
                        onClick={handleApproveAllZero}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition shadow-2xs"
                      >
                        ✕ Nol-kan
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100/90 text-slate-600 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Barang & Kategori</th>
                        <th className="p-3 text-center">Stok Gudang</th>
                        <th className="p-3 text-center">Diminta</th>
                        <th className="p-3 text-center w-36">Disetujui (Approve)</th>
                        <th className="p-3 text-center">Diserahkan</th>
                        <th className="p-3 text-right">Harga Jual</th>
                        <th className="p-3 text-right">Subtotal</th>
                        <th className="p-3">Catatan Khusus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedOrder.items || []).map((item) => {
                        const approvedQtyValue = (processData.approvedItems || []).find(ai => ai.orderItemId === item.id)?.qtyApproved ?? (item.qtyApproved ?? item.qtyRequested);
                        const currentWhStock = getItemStockInWh(item.itemId, processData.warehouseId);
                        const isExceedWhStock = processData.status === 'COMPLETED' && processData.warehouseId && approvedQtyValue > currentWhStock;
                        const sellPrice = getItemSellingPrice(item.item);
                        const effectiveQty = selectedOrder.status === 'COMPLETED' ? (item.qtyDelivered ?? approvedQtyValue) : approvedQtyValue;
                        const subtotalVal = sellPrice * effectiveQty;

                        return (
                          <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${isExceedWhStock ? 'bg-rose-50/40' : ''}`}>
                            <td className="p-3">
                              <div className="font-extrabold text-slate-800 text-sm">{item.item?.name || 'Barang'}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {item.item?.code || '-'} • {item.item?.category?.name || 'Umum'} • [{item.item?.unit || 'Pcs'}]
                              </div>
                            </td>
                            
                            {/* Stock Indicator */}
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                                currentWhStock === 0 
                                  ? 'bg-rose-100 text-rose-800' 
                                  : (currentWhStock < item.qtyRequested ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')
                              }`}>
                                {currentWhStock} unit
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg font-bold text-slate-800 font-mono text-sm">
                                {item.qtyRequested}
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              {selectedOrder.status === 'COMPLETED' ? (
                                <span className="font-extrabold font-mono text-blue-700 text-sm">
                                  {approvedQtyValue} {item.item?.unit || 'Pcs'}
                                </span>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <input 
                                    type="number" 
                                    min="0" 
                                    max={item.qtyRequested * 2}
                                    className={`w-20 border rounded-xl p-1.5 text-center font-extrabold text-xs outline-none focus:ring-2 focus:ring-blue-400 ${
                                      isExceedWhStock ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300 bg-white text-slate-800'
                                    }`} 
                                    value={approvedQtyValue}
                                    onChange={(e) => {
                                      const newAppItems = [...(processData.approvedItems || [])];
                                      const existIdx = newAppItems.findIndex(ai => ai.orderItemId === item.id);
                                      const val = parseInt(e.target.value) || 0;
                                      if (existIdx >= 0) newAppItems[existIdx].qtyApproved = val;
                                      else newAppItems.push({ orderItemId: item.id, qtyApproved: val });
                                      setProcessData({...processData, approvedItems: newAppItems});
                                    }}
                                  />
                                </div>
                              )}
                              {isExceedWhStock && (
                                <div className="text-[10px] text-rose-600 font-bold mt-0.5">Melebihi stok gudang!</div>
                              )}
                            </td>

                            <td className="p-3 text-center">
                              <span className="font-extrabold font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs">
                                {item.qtyDelivered ?? (selectedOrder.status === 'COMPLETED' ? approvedQtyValue : 0)}
                              </span>
                            </td>

                            <td className="p-3 text-right font-mono font-semibold text-slate-700">
                              {formatRupiah(sellPrice)}
                            </td>

                            <td className="p-3 text-right font-mono font-black text-blue-800">
                              {formatRupiah(subtotalVal)}
                            </td>

                            <td className="p-3 text-slate-500 italic max-w-[160px] truncate" title={item.note}>
                              {item.note || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200 text-xs">
                      <tr>
                        <td colSpan="2" className="p-3 text-right uppercase tracking-wider text-[11px] text-slate-500">
                          Total Akumulasi :
                        </td>
                        <td className="p-3 text-center font-mono font-extrabold">{totalRequestedInOrder}</td>
                        <td className="p-3 text-center font-mono font-extrabold text-blue-700">{totalApprovedInOrder}</td>
                        <td className="p-3 text-center font-mono font-extrabold text-emerald-700">
                          {(selectedOrder.items || []).reduce((acc, it) => acc + (it.qtyDelivered || (selectedOrder.status === 'COMPLETED' ? (it.qtyApproved || it.qtyRequested) : 0)), 0)}
                        </td>
                        <td className="p-3 text-right uppercase tracking-wider text-[10px] text-slate-500">
                          Grand Total (Jual) :
                        </td>
                        <td className="p-3 text-right font-mono font-black text-blue-900 bg-blue-100/60 text-sm">
                          {formatRupiah(totalOrderValueInModal)}
                        </td>
                        <td className="p-3 text-slate-400 font-normal text-[11px]"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 4. DECISION PANEL: STATUS PROSES & GUDANG */}
              <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-4 sm:p-5 rounded-2xl border border-blue-200 space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-blue-950 uppercase tracking-wider mb-2">
                    Tentukan Status Pesanan:
                  </label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { key: 'PENDING', label: 'Menunggu', desc: 'Belum diproses', color: 'amber' },
                      { key: 'APPROVED', label: 'Disetujui', desc: 'Barang disetujui', color: 'blue' },
                      { key: 'PROCESS', label: 'Diproses', desc: 'Sedang disiapkan', color: 'indigo' },
                      { key: 'COMPLETED', label: 'Selesai / Serahkan', desc: 'Potong stok gudang', color: 'emerald' },
                      { key: 'REJECTED', label: 'Tolak', desc: 'Batalkan pesanan', color: 'rose' }
                    ].map(st => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setProcessData({ ...processData, status: st.key })}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          processData.status === st.key
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 ring-2 ring-blue-300'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                        }`}
                      >
                        <div className="font-extrabold text-xs">{st.label}</div>
                        <div className={`text-[10px] mt-0.5 ${processData.status === st.key ? 'text-blue-100' : 'text-slate-400'}`}>
                          {st.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Warehouse Selector (Wajib jika COMPLETED) */}
                {processData.status === 'COMPLETED' && selectedOrder.status !== 'COMPLETED' && (
                  <div className="p-3.5 bg-white border-2 border-emerald-400 rounded-xl space-y-2 shadow-2xs animate-in fade-in">
                    <div className="flex items-center gap-2 font-extrabold text-emerald-950 text-xs">
                      <Warehouse size={16} className="text-emerald-600 shrink-0" />
                      <span>Pilih Lokasi Gudang Pengeluaran Stok Fisik:</span>
                    </div>
                    <select 
                      required 
                      className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={processData.warehouseId} 
                      onChange={e => setProcessData({...processData, warehouseId: e.target.value})}
                    >
                      <option value="">-- Wajib Pilih Gudang Sumber Pengeluaran --</option>
                      {(warehouses || []).map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name} {wh.location ? `(${wh.location})` : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      * Sistem akan otomatis memotong kuantitas stok barang yang disetujui dari gudang di atas dan mencatat bukti transaksi pengeluaran (OUT).
                    </p>
                  </div>
                )}

                {/* Admin Note with Quick Chips */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-extrabold text-blue-950 uppercase tracking-wider">
                      Catatan / Pesan Admin:
                    </label>
                  </div>
                  
                  {/* Quick Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      'Barang telah disiapkan dan diserahkan lengkap.',
                      'Disetujui sebagian karena keterbatasan stok gudang.',
                      'Barang sedang disiapkan di gudang logistik.',
                      'Mohon maaf, permohonan belum dapat disetujui saat ini.'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setProcessData(prev => ({ ...prev, note: chip }))}
                        className="text-[10px] bg-white hover:bg-blue-100 text-slate-700 border border-slate-200 rounded-lg px-2 py-0.5 transition"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>

                  <textarea 
                    className="w-full bg-white border border-blue-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" 
                    rows="2" 
                    placeholder="Tuliskan catatan tambahan untuk pemohon atau alasan persetujuan/penolakan..."
                    value={processData.note} 
                    onChange={e => setProcessData({...processData, note: e.target.value})}
                  ></textarea>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="pt-2 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openDocumentModal(selectedOrder, 'nota')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Receipt size={14} className="text-emerald-600" /> Nota Penjualan
                  </button>
                  <button
                    type="button"
                    onClick={() => openDocumentModal(selectedOrder, 'bast')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <FileCheck size={14} className="text-indigo-600" /> BAST Serah Terima
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setIsProcessModalOpen(false)} 
                    className="flex-1 sm:flex-initial px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Batal / Tutup
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 sm:flex-initial px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition"
                  >
                    <CheckCircle size={15} /> Simpan Perubahan Status
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PREVIEW & CETAK INVOICE PESANAN LOGISTIK (BERDASARKAN HARGA JUAL) */}
      {/* ========================================================================= */}
      {invoiceModalOrder && (() => {
        const qrData = `${window.location.origin}/public/invoice-gudang/${invoiceModalOrder.id}`;
        const totalReq = (invoiceModalOrder.items || []).reduce((acc, i) => acc + (Number(i.qtyRequested) || 0), 0);
        const totalApp = (invoiceModalOrder.items || []).reduce((acc, i) => acc + (Number(i.qtyApproved) || 0), 0);
        const totalDel = (invoiceModalOrder.items || []).reduce((acc, i) => acc + (Number(i.qtyDelivered) || 0), 0);
        const invoiceGrandTotal = calculateOrderTotal(invoiceModalOrder);
        const signatures = getOrderSignatures(invoiceModalOrder);
        const displayNote = getOrderNoteText(invoiceModalOrder);
        const isKabid = checkIsKabidSarana();

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto print:p-0">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200">
              
              {/* Modal Top Bar (Hidden on print) */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3 print:hidden">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 text-white rounded-xl shadow-xs ${docType === 'nota' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                    {docType === 'nota' ? <Receipt size={18} /> : <FileCheck size={18} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                        {docType === 'nota' ? 'Faktur / Nota Penjualan Logistik' : 'Berita Acara Serah Terima (BAST)'}
                      </h3>
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        {invoiceModalOrder.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {docType === 'nota'
                        ? 'Nota komersial & rincian biaya pengeluaran logistik berdasarkan harga jual.'
                        : 'Berita acara serah terima resmi (BBAST) bukti fisik penyerahan barang logistik.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Segmented Switcher Tab */}
                  <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setDocType('nota')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        docType === 'nota'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Receipt size={13} />
                      <span>1. Nota / Faktur</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocType('bast')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        docType === 'bast'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileCheck size={13} />
                      <span>2. BAST Serah Terima</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openPaymentModal(invoiceModalOrder)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
                      invoiceModalOrder.paymentStatus === 'PAID'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                    }`}
                    title="Ubah Status Pembayaran & Batas Jatuh Tempo"
                  >
                    <CreditCard size={14} />
                    <span>{invoiceModalOrder.paymentStatus === 'PAID' ? '✓ Lunas' : 'Belum Lunas'}</span>
                  </button>

                  <a
                    href={`/public/invoice-gudang/${invoiceModalOrder.id}?docType=${docType}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs"
                    title="Buka Dokumen di Tab Baru"
                  >
                    <ExternalLink size={14} /> Tab Baru
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const printUrl = `/public/invoice-gudang/${invoiceModalOrder.id}?docType=${docType}`;
                      const printWin = window.open(printUrl, '_blank');
                      if (printWin) {
                        printWin.focus();
                      }
                    }}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
                  >
                    <Printer size={14} /> Cetak / PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceModalOrder(null)}
                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition ml-1 cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Body: Printable Document View */}
              <div className="overflow-y-auto p-4 sm:p-8 space-y-5 bg-white text-slate-800 text-xs custom-scrollbar">
                
                {/* KOP SURAT RESMI */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-800 pb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src={settings?.orgLogo || "/Sarpras.jpeg"} 
                      alt="Logo" 
                      className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-xl border border-slate-100 p-1"
                    />
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
                        {settings?.orgName || "YAYASAN DAR EL-IMAN PADANG"}
                      </h2>
                      <h3 className="text-xs font-extrabold text-blue-700 uppercase tracking-wide">
                        BAGIAN SARANA & PRASARANA (LOGISTIK & PERGUDANGAN)
                      </h3>
                      <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                        Layanan Pengadaan & Pendistribusian Logistik Perlengkapan Unit Yayasan
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Padang, Sumatera Barat • sarpras.dareliman.or.id
                      </p>
                    </div>
                  </div>

                  {/* Document Stamp */}
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                      {docType === 'nota' ? 'NO. NOTA PENJUALAN' : 'NO. BERITA ACARA (BAST)'}
                    </div>
                    <div className="text-sm sm:text-base font-black text-blue-700 font-mono">
                      {docType === 'nota' 
                        ? invoiceModalOrder.code 
                        : `BAST/${invoiceModalOrder.code}/${new Date(invoiceModalOrder.date || Date.now()).getFullYear()}`}
                    </div>
                    <div className="mt-1 flex sm:justify-end items-center gap-1.5 flex-wrap">
                      {invoiceModalOrder.status === 'COMPLETED' ? (
                        <span className="inline-block border border-emerald-600 text-emerald-700 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50">
                          ✓ SELESAI (DISERAHKAN)
                        </span>
                      ) : invoiceModalOrder.status === 'APPROVED' ? (
                        <span className="inline-block border border-blue-600 text-blue-700 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50">
                          ✓ DISETUJUI
                        </span>
                      ) : (
                        <span className="inline-block border border-amber-500 text-amber-800 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50">
                          ⏳ {invoiceModalOrder.status}
                        </span>
                      )}

                      {/* Stempel Resmi Status Pembayaran (Khusus Nota) */}
                      {docType === 'nota' && (
                        invoiceModalOrder.paymentStatus === 'PAID' ? (
                          <span className="inline-block border-2 border-emerald-600 text-emerald-700 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 rotate-[-2deg] shadow-xs">
                            ✓ LUNAS
                          </span>
                        ) : (
                          <span className={`inline-block border-2 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider rotate-[2deg] shadow-xs ${
                            isOrderOverdue(invoiceModalOrder)
                              ? 'border-rose-600 text-rose-700 bg-rose-50 animate-pulse'
                              : 'border-amber-500 text-amber-800 bg-amber-50'
                          }`}>
                            {isOrderOverdue(invoiceModalOrder) ? '⚠️ JATUH TEMPO' : 'BELUM LUNAS'}
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
                  <div className="space-y-5">
                    {/* TITLE DOKUMEN NOTA */}
                    <div className="text-center py-0.5">
                      <h1 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide underline underline-offset-4">
                        FAKTUR / NOTA PENJUALAN GUDANG LOGISTIK
                      </h1>
                      <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">
                        Lembar Bukti Rincian Biaya, Nilai Jual, dan Pembayaran Logistik Barang Gudang
                      </p>
                    </div>

                    {/* METADATA PEMESAN & TRANSAKSI */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider block">Identitas Pembeli / Pemohon:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-24">Nama Pemohon</span>
                          <span className="font-extrabold text-slate-800">: {invoiceModalOrder.requesterName || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-24">Unit / Departemen</span>
                          <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">: {invoiceModalOrder.requesterUnit || 'Umum'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-24">Petugas Kasir/Input</span>
                          <span className="font-medium text-slate-700">: {invoiceModalOrder.createdBy?.name || invoiceModalOrder.createdBy?.username || '-'}</span>
                        </div>
                      </div>

                      <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
                        <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider block">Rincian Transaksi:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-28">No. Nota / Faktur</span>
                          <span className="font-bold text-slate-800 font-mono">: {invoiceModalOrder.code}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-28">Tanggal Transaksi</span>
                          <span className="font-bold text-slate-800">: {new Date(invoiceModalOrder.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-28">Deadline Bayar</span>
                          <span className={`font-bold ${isOrderOverdue(invoiceModalOrder) ? 'text-rose-600 font-black' : 'text-slate-800'}`}>
                            : {invoiceModalOrder.dueDate ? new Date(invoiceModalOrder.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                            {isOrderOverdue(invoiceModalOrder) && <span className="ml-1 text-[9.5px] text-rose-600 font-bold">(Lewat Jatuh Tempo)</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-28">Status Pembayaran</span>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>:</span>
                            {invoiceModalOrder.paymentStatus === 'PAID' ? (
                              <span className="text-emerald-700 font-black bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10.5px]">
                                ✓ LUNAS {invoiceModalOrder.paidAt ? `(${new Date(invoiceModalOrder.paidAt).toLocaleDateString('id-ID')})` : ''} {invoiceModalOrder.paymentMethod ? `- ${invoiceModalOrder.paymentMethod}` : ''}
                              </span>
                            ) : (
                              <span className="text-amber-800 font-black bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10.5px]">
                                ⏳ BELUM LUNAS
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => openPaymentModal(invoiceModalOrder)}
                              className="text-[10px] text-blue-600 hover:underline print:hidden font-bold cursor-pointer"
                            >
                              [Ubah]
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-28">Status Dokumen</span>
                          <span className="font-bold text-slate-700">: {invoiceModalOrder.status}</span>
                        </div>
                      </div>
                    </div>

                    {/* TABEL RINCIAN HARGA JUAL BARANG */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider">
                            <th className="p-2.5 w-8 text-center border-r border-slate-700">No</th>
                            <th className="p-2.5 w-24 border-r border-slate-700">Kode</th>
                            <th className="p-2.5 border-r border-slate-700">Nama Barang & Kategori</th>
                            <th className="p-2.5 w-14 text-center border-r border-slate-700">Qty</th>
                            <th className="p-2.5 w-14 text-center border-r border-slate-700">Satuan</th>
                            <th className="p-2.5 w-24 text-right border-r border-slate-700">Harga Jual</th>
                            <th className="p-2.5 w-28 text-right border-r border-slate-700">Subtotal</th>
                            <th className="p-2.5 w-24">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {invoiceModalOrder.items && invoiceModalOrder.items.length > 0 ? (
                            invoiceModalOrder.items.map((it, idx) => {
                              const sellingPrice = getItemSellingPrice(it.item);
                              const effectiveQty = getEffectiveQty(it, invoiceModalOrder.status);
                              const subtotal = sellingPrice * effectiveQty;

                              return (
                                <tr key={it.id || idx} className="hover:bg-slate-50">
                                  <td className="p-2.5 text-center font-bold text-slate-500 border-r border-slate-200">{idx + 1}</td>
                                  <td className="p-2.5 font-mono font-bold text-slate-700 border-r border-slate-200 text-[11px]">{it.item?.code || '-'}</td>
                                  <td className="p-2.5 border-r border-slate-200">
                                    <div className="font-extrabold text-slate-800">{it.item?.name || 'Barang Logistik'}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">{it.item?.category?.name || 'Umum'}</div>
                                  </td>
                                  <td className="p-2.5 text-center font-black text-emerald-700 border-r border-slate-200 bg-emerald-50/30">
                                    {effectiveQty}
                                  </td>
                                  <td className="p-2.5 text-center text-slate-600 font-semibold border-r border-slate-200">
                                    {it.item?.unit || 'Pcs'}
                                  </td>
                                  <td className="p-2.5 text-right font-mono font-semibold text-slate-700 border-r border-slate-200">
                                    {formatRupiah(sellingPrice)}
                                  </td>
                                  <td className="p-2.5 text-right font-mono font-extrabold text-blue-800 border-r border-slate-200 bg-blue-50/30">
                                    {formatRupiah(subtotal)}
                                  </td>
                                  <td className="p-2.5 text-slate-600 text-[11px] italic">
                                    {it.note || '-'}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="8" className="p-6 text-center text-slate-400 italic">
                                Tidak ada item barang pada pesanan ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                            <td colSpan="3" className="p-2.5 text-right uppercase tracking-wider text-[10px] border-r border-slate-200">
                              Total Kuantitas :
                            </td>
                            <td className="p-2.5 text-center font-mono font-extrabold text-emerald-700 border-r border-slate-200">
                              {totalDel || (invoiceModalOrder.status === 'COMPLETED' ? totalReq : totalApp || totalReq)}
                            </td>
                            <td className="p-2.5 text-center text-slate-500 font-medium text-[10px] border-r border-slate-200">Unit</td>
                            <td className="p-2.5 text-right uppercase tracking-wider text-[10px] text-slate-500 border-r border-slate-200">Grand Total :</td>
                            <td className="p-2.5 text-right font-mono font-black text-blue-900 bg-blue-100/60 text-sm border-r border-slate-200">
                              {formatRupiah(invoiceGrandTotal)}
                            </td>
                            <td className="p-2.5"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* TOTAL TAGIHAN & TERBILANG BOX */}
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-blue-50/80 border-2 border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                          <FileText size={13} className="text-blue-600" /> Terbilang Jumlah Nilai Tagihan (Harga Jual):
                        </span>
                        <div className="font-serif italic font-bold text-slate-800 text-xs bg-white/80 p-2.5 rounded-xl border border-blue-100">
                          "{terbilang(invoiceGrandTotal)}"
                        </div>
                      </div>

                      <div className="bg-white border-2 border-blue-600 rounded-2xl p-3 sm:px-5 sm:py-2.5 text-right shadow-sm w-full sm:w-auto shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                          TOTAL TAGIHAN (HARGA JUAL)
                        </span>
                        <div className="text-base sm:text-xl font-mono font-black text-blue-700 tracking-tight">
                          {formatRupiah(invoiceGrandTotal)}
                        </div>
                      </div>
                    </div>

                    {/* CATATAN */}
                    {displayNote && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-slate-700 block text-[11px]">Catatan / Keperluan:</span>
                        <p className="text-slate-600 italic">{displayNote}</p>
                      </div>
                    )}

                    {/* TANDA TANGAN NOTA (2 KOLOM: PEMBELI & KASIR / PETUGAS LOGISTIK) */}
                    <div className="pt-3 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-4 text-center text-xs max-w-2xl mx-auto">
                        
                        {/* KOLOM 1: YANG MEMOHON / PEMBELI */}
                        <div className="flex flex-col justify-between min-h-[140px] p-2 bg-slate-50/60 rounded-xl border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-700 block text-[11px]">Yang Memesan / Pembeli,</span>
                            <span className="text-[10px] text-slate-400">Unit / Pemesan Barang</span>
                          </div>

                          <div className="my-2 flex-1 flex flex-col items-center justify-center min-h-[60px]">
                            {signatures.requester?.signatureData ? (
                              <div className="flex flex-col items-center">
                                <img 
                                  src={signatures.requester.signatureData} 
                                  alt="TTD Pemohon" 
                                  className="h-14 max-w-[140px] object-contain" 
                                />
                                <span className="text-[8.5px] text-emerald-700 font-bold mt-0.5">✓ TTD Digital</span>
                                <span className="text-[7.5px] text-slate-400 font-mono">
                                  {new Date(signatures.requester.signedAt).toLocaleDateString('id-ID')}
                                </span>
                                <button 
                                  type="button" 
                                  onClick={() => handleResetSignature(invoiceModalOrder, 'requester')} 
                                  className="text-[9px] text-rose-500 hover:underline print:hidden mt-0.5 cursor-pointer"
                                >
                                  Hapus TTD
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openSignatureModal('requester', invoiceModalOrder)}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 shadow-2xs transition cursor-pointer print:hidden"
                                  title="Goreskan Tanda Tangan Pemohon"
                                >
                                  <PenTool size={11} />
                                  <span>Input TTD</span>
                                </button>
                                <div className="h-10 hidden print:block"></div>
                              </>
                            )}
                          </div>

                          <div>
                            <div className="font-extrabold text-slate-800 uppercase underline text-[11px]">
                              {signatures.requester?.name || invoiceModalOrder.requesterName || '( ..................................... )'}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{invoiceModalOrder.requesterUnit || 'Pemohon'}</div>
                          </div>
                        </div>

                        {/* KOLOM 2: KASIR / PETUGAS LOGISTIK */}
                        <div className="flex flex-col justify-between min-h-[140px] p-2 bg-slate-50/60 rounded-xl border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-700 block text-[11px]">Kasir / Petugas Logistik,</span>
                            <span className="text-[10px] text-slate-400">Bagian Sarana & Prasarana</span>
                          </div>

                          <div className="my-2 flex-1 flex flex-col items-center justify-center min-h-[60px]">
                            {signatures.deliverer?.signatureData ? (
                              <div className="flex flex-col items-center">
                                <img 
                                  src={signatures.deliverer.signatureData} 
                                  alt="TTD Petugas" 
                                  className="h-14 max-w-[140px] object-contain" 
                                />
                                <span className="text-[8.5px] text-emerald-700 font-bold mt-0.5">✓ TTD Digital</span>
                                <span className="text-[7.5px] text-slate-400 font-mono">
                                  {new Date(signatures.deliverer.signedAt).toLocaleDateString('id-ID')}
                                </span>
                                <button 
                                  type="button" 
                                  onClick={() => handleResetSignature(invoiceModalOrder, 'deliverer')} 
                                  className="text-[9px] text-rose-500 hover:underline print:hidden mt-0.5 cursor-pointer"
                                >
                                  Hapus TTD
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openSignatureModal('deliverer', invoiceModalOrder)}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 shadow-2xs transition cursor-pointer print:hidden"
                                  title="Goreskan Tanda Tangan Petugas Gudang"
                                >
                                  <PenTool size={11} />
                                  <span>Input TTD</span>
                                </button>
                                <div className="h-10 hidden print:block"></div>
                              </>
                            )}
                          </div>

                          <div>
                            <div className="font-extrabold text-slate-800 uppercase underline text-[11px]">
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
                  <div className="space-y-4">
                    {/* TITLE DOKUMEN BAST */}
                    <div className="text-center py-0.5">
                      <h1 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide underline underline-offset-4">
                        BERITA ACARA SERAH TERIMA BARANG (BAST)
                      </h1>
                      <p className="text-[11px] text-blue-800 font-mono font-bold mt-0.5">
                        Nomor: BAST/{invoiceModalOrder.code}/{new Date(invoiceModalOrder.date || Date.now()).getFullYear()}
                      </p>
                    </div>

                    {/* KALIMAT PEMBUKA / PREAMBLE BAST RESMI */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-700">
                      Pada hari ini, <span className="font-extrabold text-slate-900">{getNamaHari(invoiceModalOrder.date)}</span>, tanggal <span className="font-extrabold text-slate-900">{new Date(invoiceModalOrder.date || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>, bertempat di Kantor Sarana & Prasarana Yayasan Dar el-Iman Padang, telah dilaksanakan serah terima barang permohonan logistik antara pihak-pihak sebagai berikut:
                    </div>

                    {/* IDENTITAS PARA PIHAK (PIHAK I & PIHAK II) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* PIHAK PERTAMA */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                        <span className="font-black text-blue-900 uppercase text-[9.5px] tracking-wider block border-b border-slate-100 pb-1">
                          I. PIHAK PERTAMA (Yang Menyerahkan):
                        </span>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-slate-500 w-16 shrink-0">Nama</span>
                          <span className="font-extrabold text-slate-800">: {signatures.deliverer?.name || 'Petugas Logistik DEI'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 w-16 shrink-0">Jabatan</span>
                          <span className="text-slate-700 font-medium">: Staf Logistik & Pergudangan</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 w-16 shrink-0">Unit Kerja</span>
                          <span className="text-slate-700 font-medium">: Bagian Sarana & Prasarana</span>
                        </div>
                        <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-50">
                          Bertindak untuk dan atas nama Bagian Sarpras yang menyerahkan barang logistik.
                        </p>
                      </div>

                      {/* PIHAK KEDUA */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                        <span className="font-black text-indigo-900 uppercase text-[9.5px] tracking-wider block border-b border-slate-100 pb-1">
                          II. PIHAK KEDUA (Yang Menerima):
                        </span>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-slate-500 w-16 shrink-0">Nama</span>
                          <span className="font-extrabold text-slate-800">: {signatures.requester?.name || invoiceModalOrder.requesterName || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 w-16 shrink-0">Peran</span>
                          <span className="text-slate-700 font-medium">: Pemohon Barang Logistik</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 w-16 shrink-0">Unit Kerja</span>
                          <span className="font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded">: {invoiceModalOrder.requesterUnit || 'Unit Pemohon'}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-50">
                          Bertindak untuk dan atas nama unit pemohon yang menerima dan memeriksa barang.
                        </p>
                      </div>
                    </div>

                    {/* KLAUSUL PERNYATAAN PENYERAHAN */}
                    <p className="text-xs text-slate-600 leading-snug">
                      PIHAK PERTAMA telah menyerahkan barang perlengkapan kebutuhan kepada PIHAK KEDUA, dan PIHAK KEDUA telah memeriksa serta menerima barang tersebut dalam kondisi <b>BAIK, LENGKAP, dan SESUAI SPESIFIKASI</b>, dengan rincian fisik sebagai berikut:
                    </p>

                    {/* TABEL PEMERIKSAAN FISIK BARANG (BAST) */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider">
                            <th className="p-2.5 w-8 text-center border-r border-slate-700">No</th>
                            <th className="p-2.5 w-24 border-r border-slate-700">Kode</th>
                            <th className="p-2.5 border-r border-slate-700">Nama Barang & Spesifikasi</th>
                            <th className="p-2.5 w-16 text-center border-r border-slate-700">Diminta</th>
                            <th className="p-2.5 w-20 text-center border-r border-slate-700">Diserahkan</th>
                            <th className="p-2.5 w-16 text-center border-r border-slate-700">Satuan</th>
                            <th className="p-2.5 w-28 text-center border-r border-slate-700">Kondisi Fisik</th>
                            <th className="p-2.5 w-32">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {invoiceModalOrder.items && invoiceModalOrder.items.length > 0 ? (
                            invoiceModalOrder.items.map((it, idx) => {
                              const qtyDeliv = it.qtyDelivered ?? (invoiceModalOrder.status === 'COMPLETED' ? (it.qtyApproved || it.qtyRequested) : (it.qtyApproved ?? it.qtyRequested));

                              return (
                                <tr key={it.id || idx} className="hover:bg-slate-50">
                                  <td className="p-2.5 text-center font-bold text-slate-500 border-r border-slate-200">{idx + 1}</td>
                                  <td className="p-2.5 font-mono font-bold text-slate-700 border-r border-slate-200 text-[11px]">{it.item?.code || '-'}</td>
                                  <td className="p-2.5 border-r border-slate-200">
                                    <div className="font-extrabold text-slate-800">{it.item?.name || 'Barang Logistik'}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">{it.item?.category?.name || 'Umum'}</div>
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-slate-700 border-r border-slate-200 bg-slate-50/50">
                                    {it.qtyRequested}
                                  </td>
                                  <td className="p-2.5 text-center font-black text-emerald-700 border-r border-slate-200 bg-emerald-50/40">
                                    {qtyDeliv}
                                  </td>
                                  <td className="p-2.5 text-center text-slate-600 font-semibold border-r border-slate-200">
                                    {it.item?.unit || 'Pcs'}
                                  </td>
                                  <td className="p-2.5 text-center border-r border-slate-200">
                                    <span className="inline-block px-2 py-0.5 bg-emerald-100/80 text-emerald-800 border border-emerald-300 rounded-md text-[10px] font-bold">
                                      ✓ Baik & Lengkap
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-slate-600 text-[11px] italic">
                                    {it.note || '-'}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="8" className="p-6 text-center text-slate-400 italic">
                                Tidak ada item barang pada dokumen ini.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                            <td colSpan="3" className="p-2.5 text-right uppercase tracking-wider text-[10px] border-r border-slate-200">
                              Total Kuantitas Fisik :
                            </td>
                            <td className="p-2.5 text-center font-mono font-extrabold border-r border-slate-200">{totalReq}</td>
                            <td className="p-2.5 text-center font-mono font-black text-emerald-700 border-r border-slate-200">
                              {totalDel || (invoiceModalOrder.status === 'COMPLETED' ? totalReq : totalApp || totalReq)}
                            </td>
                            <td className="p-2.5 text-center text-slate-500 font-medium text-[10px] border-r border-slate-200">Unit</td>
                            <td colSpan="2" className="p-2.5 text-left text-[10.5px] text-emerald-800 font-semibold">
                              ✓ Seluruh barang telah diverifikasi secara fisik
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* KLAUSUL PENUTUP BAST */}
                    <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl text-[11px] text-slate-600 italic leading-relaxed">
                      Demikian Berita Acara Serah Terima (BAST) ini dibuat dan ditandatangani oleh para pihak dengan sadar dan tanpa paksaan dari pihak manapun, untuk dipergunakan sebagai bukti fisik pertanggungjawaban penyerahan logistik dan inventarisasi aset Yayasan Dar el-Iman.
                    </div>

                    {/* TANDA TANGAN BAST 3 PIHAK: PENERIMA, PENYERAH, DAN KEPALA BIDANG SARANA */}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="grid grid-cols-3 gap-3 text-center text-xs">
                        
                        {/* KOLOM 1: PIHAK KEDUA (YANG MENERIMA) */}
                        <div className="flex flex-col justify-between min-h-[140px] p-2 bg-slate-50/50 rounded-xl border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-700 block text-[11px]">PIHAK KEDUA (Yang Menerima),</span>
                            <span className="text-[10px] text-slate-400">Unit Pemohon / Pemesan</span>
                          </div>

                          <div className="my-2 flex-1 flex flex-col items-center justify-center min-h-[60px]">
                            {signatures.requester?.signatureData ? (
                              <div className="flex flex-col items-center">
                                <img 
                                  src={signatures.requester.signatureData} 
                                  alt="TTD Pemohon" 
                                  className="h-14 max-w-[130px] object-contain" 
                                />
                                <span className="text-[8.5px] text-emerald-700 font-bold mt-0.5">✓ TTD Digital</span>
                                <span className="text-[7.5px] text-slate-400 font-mono">
                                  {new Date(signatures.requester.signedAt).toLocaleDateString('id-ID')}
                                </span>
                                <button 
                                  type="button" 
                                  onClick={() => handleResetSignature(invoiceModalOrder, 'requester')} 
                                  className="text-[9px] text-rose-500 hover:underline print:hidden mt-0.5 cursor-pointer"
                                >
                                  Hapus TTD
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openSignatureModal('requester', invoiceModalOrder)}
                                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 shadow-2xs transition cursor-pointer print:hidden"
                                  title="Goreskan Tanda Tangan Pemohon"
                                >
                                  <PenTool size={11} />
                                  <span>Input TTD</span>
                                </button>
                                <div className="h-10 hidden print:block"></div>
                              </>
                            )}
                          </div>

                          <div>
                            <div className="font-extrabold text-slate-800 uppercase underline text-[11px]">
                              {signatures.requester?.name || invoiceModalOrder.requesterName || '( ..................................... )'}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{invoiceModalOrder.requesterUnit || 'Pemohon'}</div>
                          </div>
                        </div>

                        {/* KOLOM 2: PIHAK PERTAMA (YANG MENYERAHKAN) */}
                        <div className="flex flex-col justify-between min-h-[140px] p-2 bg-slate-50/50 rounded-xl border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-700 block text-[11px]">PIHAK PERTAMA (Yang Menyerahkan),</span>
                            <span className="text-[10px] text-slate-400">Staf Logistik & Pergudangan</span>
                          </div>

                          <div className="my-2 flex-1 flex flex-col items-center justify-center min-h-[60px]">
                            {signatures.deliverer?.signatureData ? (
                              <div className="flex flex-col items-center">
                                <img 
                                  src={signatures.deliverer.signatureData} 
                                  alt="TTD Petugas" 
                                  className="h-14 max-w-[130px] object-contain" 
                                />
                                <span className="text-[8.5px] text-emerald-700 font-bold mt-0.5">✓ TTD Digital</span>
                                <span className="text-[7.5px] text-slate-400 font-mono">
                                  {new Date(signatures.deliverer.signedAt).toLocaleDateString('id-ID')}
                                </span>
                                <button 
                                  type="button" 
                                  onClick={() => handleResetSignature(invoiceModalOrder, 'deliverer')} 
                                  className="text-[9px] text-rose-500 hover:underline print:hidden mt-0.5 cursor-pointer"
                                >
                                  Hapus TTD
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openSignatureModal('deliverer', invoiceModalOrder)}
                                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 shadow-2xs transition cursor-pointer print:hidden"
                                  title="Goreskan Tanda Tangan Petugas Gudang"
                                >
                                  <PenTool size={11} />
                                  <span>Input TTD</span>
                                </button>
                                <div className="h-10 hidden print:block"></div>
                              </>
                            )}
                          </div>

                          <div>
                            <div className="font-extrabold text-slate-800 uppercase underline text-[11px]">
                              {signatures.deliverer?.name || '( Petugas Logistik DEI )'}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Staff Sarpras & Logistik</div>
                          </div>
                        </div>

                        {/* KOLOM 3: MENGETAHUI & MENYETUJUI (KEPALA BIDANG SARANA) */}
                        <div className="flex flex-col justify-between min-h-[140px] p-2 bg-slate-50/50 rounded-xl border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-700 block text-[11px]">Mengetahui & Menyetujui,</span>
                            <span className="text-[10px] text-blue-700 font-extrabold uppercase">Kepala Bidang Sarana</span>
                          </div>

                          <div className="my-2 flex-1 flex flex-col items-center justify-center min-h-[60px]">
                            {signatures.kabid?.approved ? (
                              <div className="p-2 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500 rounded-xl text-center shadow-2xs w-full max-w-[160px]">
                                <div className="flex items-center justify-center gap-1 text-emerald-800 font-black text-[9px] uppercase tracking-wider">
                                  <ShieldCheck size={12} className="text-emerald-600" />
                                  <span>ACC RESMI DIGITAL</span>
                                </div>
                                <div className="text-[8px] font-black text-slate-800 mt-0.5 uppercase">
                                  KEPALA BIDANG SARANA
                                </div>
                                <div className="text-[7.5px] text-slate-500 font-mono mt-0.5">
                                  {new Date(signatures.kabid.signedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                                <div className="text-[7px] text-emerald-700 font-mono font-bold truncate">
                                  {signatures.kabid.authHash || 'ACC-VALID'}
                                </div>
                                {isKabid && (
                                  <button 
                                    type="button" 
                                    onClick={() => handleKabidAcc(invoiceModalOrder, true)} 
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
                                    onClick={() => handleKabidAcc(invoiceModalOrder, false)}
                                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-[10.5px] font-black shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer print:hidden"
                                    title="ACC & Berikan Tanda Tangan Pengesahan Kepala Bidang Sarana"
                                  >
                                    <ShieldCheck size={13} />
                                    <span>ACC & Sahkan</span>
                                  </button>
                                ) : (
                                  <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-xl text-center print:hidden max-w-[150px]">
                                    <div className="text-[9px] font-bold text-amber-800 flex items-center justify-center gap-1">
                                      <Clock size={11} className="text-amber-600" />
                                      <span>Menunggu ACC</span>
                                    </div>
                                    <p className="text-[7.5px] text-slate-500 mt-0.5 leading-tight">
                                      Melalui Akun Resmi Jabatan Kepala Bidang Sarana
                                    </p>
                                  </div>
                                )}
                                <div className="h-10 hidden print:block"></div>
                              </>
                            )}
                          </div>

                          <div>
                            <div className="font-extrabold text-slate-800 uppercase underline text-[11px]">
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
                <div className="flex flex-col sm:flex-row justify-between items-center pt-3 border-t border-slate-100 text-[10px] text-slate-400 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-white border border-slate-200 rounded shadow-2xs">
                      <QRCode value={qrData} size={36} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 text-[10px]">Dokumen Digital Resmi</p>
                      <p className="text-slate-400 text-[9px]">Validasi sistem Sarpras Yayasan Dar el-Iman.</p>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[10px]">
                    Dicetak: {new Date().toLocaleDateString('id-ID')}
                  </div>
                </div>

              </div>

              {/* Modal Bottom Close */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => setInvoiceModalOrder(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL INPUT TANDA TANGAN (SIGNATURE PAD) */}
      {/* ========================================================================= */}
      {signatureModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95 duration-150">
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
                onClick={() => setSignatureModal({ isOpen: false, type: '', title: '', order: null, signerName: '' })}
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
                onCancel={() => setSignatureModal({ isOpen: false, type: '', title: '', order: null, signerName: '' })}
                onSave={handleSaveSignature}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ATUR STATUS PEMBAYARAN & DEADLINE JATUH TEMPO */}
      {/* ========================================================================= */}
      {paymentModal.isOpen && paymentModal.order && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base">
                    Atur Status Pembayaran & Deadline
                  </h3>
                  <div className="text-[11px] text-blue-100 flex items-center gap-2 mt-0.5 font-mono">
                    <span>{paymentModal.order.code}</span>
                    <span>•</span>
                    <span>{paymentModal.order.requesterName}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPaymentModal(prev => ({ ...prev, isOpen: false, order: null }))}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePayment} className="p-5 space-y-4 text-xs">
              
              {/* Total Tagihan Box */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Tagihan (Harga Jual):</span>
                  <div className="font-mono font-black text-blue-800 text-base">
                    {formatRupiah(calculateOrderTotal(paymentModal.order))}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kuantitas:</span>
                  <div className="font-bold text-slate-700">
                    {paymentModal.order.items?.length || 0} Jenis Barang
                  </div>
                </div>
              </div>

              {/* Status Pembayaran Toggle */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Pelunasan Faktur:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentModal(prev => ({ ...prev, paymentStatus: 'UNPAID' }))}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-black transition cursor-pointer ${
                      paymentModal.paymentStatus === 'UNPAID'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm ring-2 ring-amber-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200'
                    }`}
                  >
                    <Clock size={16} className={paymentModal.paymentStatus === 'UNPAID' ? 'text-amber-600' : 'text-slate-400'} />
                    <span>BELUM LUNAS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentModal(prev => ({ ...prev, paymentStatus: 'PAID' }))}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-black transition cursor-pointer ${
                      paymentModal.paymentStatus === 'PAID'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200'
                    }`}
                  >
                    <CheckCircle size={16} className={paymentModal.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span>✓ SUDAH LUNAS</span>
                  </button>
                </div>
              </div>

              {/* Batas Waktu / Jatuh Tempo (Deadline) */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Deadline Jatuh Tempo Pembayaran:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Batas akhir pembayaran faktur</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    value={paymentModal.dueDate}
                    onChange={e => setPaymentModal(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {[
                    { label: 'Hari Ini', days: 0 },
                    { label: '7 Hari', days: 7 },
                    { label: '14 Hari', days: 14 },
                    { label: '30 Hari', days: 30 }
                  ].map(opt => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + opt.days);
                        setPaymentModal(prev => ({ ...prev, dueDate: d.toISOString().split('T')[0] }));
                      }}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-md text-[10px] font-bold border border-slate-200 transition cursor-pointer"
                    >
                      + {opt.label}
                    </button>
                  ))}
                  {paymentModal.dueDate && (
                    <button
                      type="button"
                      onClick={() => setPaymentModal(prev => ({ ...prev, dueDate: '' }))}
                      className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md text-[10px] font-bold border border-rose-200 transition cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  )}
                </div>
              </div>

              {/* Conditional Fields if LUNAS */}
              {paymentModal.paymentStatus === 'PAID' && (
                <div className="space-y-3 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200 animate-in fade-in">
                  <div className="font-extrabold text-emerald-900 text-xs flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <span>Rincian Pembayaran Lunas:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Tanggal Bayar:
                      </label>
                      <input
                        type="date"
                        required
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                        value={paymentModal.paidAt}
                        onChange={e => setPaymentModal(prev => ({ ...prev, paidAt: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Metode Pembayaran:
                      </label>
                      <select
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                        value={paymentModal.paymentMethod}
                        onChange={e => setPaymentModal(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      >
                        <option value="Tunai / Kasir">Tunai / Kasir Logistik</option>
                        <option value="Transfer Bank BSI">Transfer Bank BSI</option>
                        <option value="Transfer Bank Mandiri">Transfer Bank Mandiri</option>
                        <option value="Transfer Bank Lainnya">Transfer Bank Lainnya</option>
                        <option value="Potong Anggaran Unit">Potong Anggaran Unit</option>
                        <option value="Potong Gaji Karyawan">Potong Gaji Karyawan</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Catatan Pembayaran */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                  Catatan / Keterangan Pembayaran (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Dibayar lunas via kasir / No. ref transfer 9871..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  value={paymentModal.paymentNote}
                  onChange={e => setPaymentModal(prev => ({ ...prev, paymentNote: e.target.value }))}
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModal(prev => ({ ...prev, isOpen: false, order: null }))}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  {savingPayment ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} /> Simpan Perubahan
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
