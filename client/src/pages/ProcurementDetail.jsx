import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    CheckCircle, XCircle, FileText, Upload, DollarSign, Store,
    ArrowLeft, Plus, Trash2, ShoppingCart, UserCheck, Camera,
    Image, MapPin, ChevronRight, AlertCircle, Package
} from 'lucide-react';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';
import SearchableSelect from '../components/SearchableSelect';

/* ─────────────────────────────────────────────
   DESIGN TOKENS  (inline style helpers)
───────────────────────────────────────────── */
const T = {
    navy: '#0f1f3d',
    navyMid: '#1a3160',
    gold: '#c9a453',
    goldSoft: '#f5e9cc',
    cream: '#faf8f4',
    creamDk: '#f0ece4',
    slate: '#8292b1',
    text: '#1c2b4a',
    white: '#ffffff',
    success: '#2d7a5f',
    successBg: '#edf7f2',
    warn: '#b07d2a',
    warnBg: '#fef9ed',
    danger: '#b83232',
    dangerBg: '#fdf2f2',
    border: '#e4ddd0',
};

/* ─── Shared micro-components ─── */
const Label = ({ children }) => (
    <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: T.slate, display: 'block', marginBottom: 6
    }}>{children}</span>
);

const Input = ({ style = {}, ...props }) => (
    <input
        style={{
            width: '100%', padding: '10px 12px',
            border: `1.5px solid ${T.border}`,
            borderRadius: 8, fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            color: T.text, background: T.white,
            outline: 'none', transition: 'border-color .2s',
            ...style
        }}
        onFocus={e => e.target.style.borderColor = T.navy}
        onBlur={e => e.target.style.borderColor = T.border}
        {...props}
    />
);

const Select = ({ style = {}, ...props }) => (
    <select
        style={{
            width: '100%', padding: '10px 12px',
            border: `1.5px solid ${T.border}`,
            borderRadius: 8, fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            color: T.text, background: T.white,
            outline: 'none', transition: 'border-color .2s',
            cursor: 'pointer',
            ...style
        }}
        onFocus={e => e.target.style.borderColor = T.navy}
        onBlur={e => e.target.style.borderColor = T.border}
        {...props}
    />
);

const Textarea = ({ style = {}, ...props }) => (
    <textarea
        style={{
            width: '100%', padding: '10px 12px',
            border: `1.5px solid ${T.border}`,
            borderRadius: 8, fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
            color: T.text, background: T.cream,
            outline: 'none', resize: 'vertical',
            transition: 'border-color .2s',
            ...style
        }}
        onFocus={e => e.target.style.borderColor = T.navy}
        onBlur={e => e.target.style.borderColor = T.border}
        {...props}
    />
);

const Card = ({ children, style = {} }) => (
    <div style={{
        background: T.white,
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        boxShadow: '0 2px 16px rgba(15,31,61,0.06)',
        overflow: 'hidden',
        ...style
    }}>
        {children}
    </div>
);

const CardHeader = ({ icon: Icon, title, badge, children }) => (
    <div style={{
        padding: '20px 28px',
        borderBottom: `1px solid ${T.creamDk}`,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 16,
        background: T.cream, flexWrap: 'wrap'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {Icon && (
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: T.navy, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                    <Icon size={16} color={T.gold} />
                </div>
            )}
            <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: T.navy }}>
                    {title}
                </div>
                {badge && <div style={{ marginTop: 2 }}>{badge}</div>}
            </div>
        </div>
        {children}
    </div>
);

const Btn = ({ variant = 'primary', children, style = {}, ...props }) => {
    const variants = {
        primary: { background: T.navy, color: T.white, border: 'none' },
        gold: { background: `linear-gradient(135deg, ${T.gold}, #e0b96a)`, color: T.navy, border: 'none', fontWeight: 700 },
        ghost: { background: 'transparent', color: T.navy, border: `1.5px solid ${T.border}` },
        success: { background: T.success, color: T.white, border: 'none' },
        danger: { background: T.dangerBg, color: T.danger, border: `1.5px solid ${T.danger}` },
    };
    return (
        <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 20px', borderRadius: 9,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, fontWeight: 600,
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            opacity: props.disabled ? 0.45 : 1,
            transition: 'all .2s',
            whiteSpace: 'nowrap',
            ...variants[variant],
            ...style
        }} {...props}>
            {children}
        </button>
    );
};

const StatusBadge = ({ status }) => {
    const map = {
        SUBMITTED: { label: 'Menunggu Verifikasi', bg: T.warnBg, color: T.warn, dot: T.warn },
        APPROVED: { label: 'Disetujui', bg: '#eef3fc', color: '#2c5fc4', dot: '#2c5fc4' },
        PROCESS: { label: 'Sedang Berjalan', bg: T.goldSoft, color: T.warn, dot: T.gold },
        COMPLETED: { label: 'Selesai', bg: T.successBg, color: T.success, dot: T.success },
        REJECTED: { label: 'Ditolak', bg: T.dangerBg, color: T.danger, dot: T.danger },
    };
    const s = map[status] || map.SUBMITTED;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 20,
            background: s.bg, color: s.color,
            fontSize: 11.5, fontWeight: 600, letterSpacing: '0.03em'
        }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
            {s.label}
        </span>
    );
};

/* ─────────────────────────────────────────────
   STEPPER
───────────────────────────────────────────── */
const STEPS = [
    { step: 1, label: 'Verifikasi', icon: FileText },
    { step: 2, label: 'Penugasan', icon: UserCheck },
    { step: 3, label: 'Pemilihan Vendor', icon: Store },
    { step: 4, label: 'Finalisasi', icon: DollarSign },
    { step: 5, label: 'Serah Terima', icon: Package },
];

const Stepper = ({ active, req, onSwitch, loading }) => {
    const isDone = (step) => {
        if (step === 1) return req.status !== 'SUBMITTED';
        if (step === 2) return ['PROCESS', 'COMPLETED'].includes(req.status);
        if (step === 3) return ['PROCESS', 'COMPLETED'].includes(req.status);
        if (step === 4) return ['PROCESS', 'COMPLETED'].includes(req.status);
        if (step === 5) return req.status === 'COMPLETED';
        return false;
    };
    const isDisabled = (step) => {
        if (step >= 2 && req.status === 'SUBMITTED') return true;
        if (step >= 4 && req.status === 'APPROVED') return true;
        if (step === 5 && req.status === 'APPROVED') return true;
        return false;
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'stretch',
            background: T.white, borderRadius: 14,
            border: `1px solid ${T.border}`,
            boxShadow: '0 2px 12px rgba(15,31,61,0.05)',
            overflow: 'hidden'
        }}>
            {STEPS.map((s, i) => {
                const done = isDone(s.step);
                const dis = isDisabled(s.step);
                const isActive = active === s.step;
                const Icon = s.icon;

                return (
                    <button
                        key={s.step}
                        disabled={dis}
                        onClick={() => !dis && onSwitch(s.step)}
                        style={{
                            flex: 1, padding: '16px 8px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                            border: 'none', borderRight: i < 4 ? `1px solid ${T.creamDk}` : 'none',
                            borderBottom: isActive ? `3px solid ${T.gold}` : '3px solid transparent',
                            background: isActive ? `linear-gradient(to bottom, ${T.goldSoft}, ${T.white})` : T.white,
                            cursor: dis ? 'not-allowed' : 'pointer',
                            opacity: dis ? 0.35 : 1,
                            transition: 'all .2s',
                            position: 'relative'
                        }}
                    >
                        <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: done ? T.success : isActive ? T.navy : T.creamDk,
                            boxShadow: isActive ? `0 4px 12px rgba(15,31,61,0.25)` : 'none',
                            transition: 'all .25s',
                        }}>
                            {done
                                ? <CheckCircle size={16} color={T.white} />
                                : <Icon size={14} color={isActive ? T.gold : T.slate} />
                            }
                        </div>
                        <span style={{
                            fontSize: 11, fontWeight: isActive ? 700 : 500,
                            color: isActive ? T.navy : done ? T.success : T.slate,
                            letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.3
                        }}>
                            {s.label}
                        </span>
                        {i < 4 && (
                            <ChevronRight size={12} color={T.border} style={{
                                position: 'absolute', right: -7, top: '50%',
                                transform: 'translateY(-50%)', zIndex: 1
                            }} />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

/* ─────────────────────────────────────────────
   NOTICE BOX
───────────────────────────────────────────── */
const Notice = ({ type = 'info', children }) => {
    const styles = {
        info: { bg: '#eef3fc', border: '#bfd0f5', color: '#1e3a8a', icon: AlertCircle },
        warning: { bg: T.warnBg, border: '#f0d08a', color: T.warn, icon: AlertCircle },
        success: { bg: T.successBg, border: '#a3d9c0', color: T.success, icon: CheckCircle },
    };
    const s = styles[type];
    const Icon = s.icon;
    return (
        <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 16px', borderRadius: 10,
            background: s.bg, border: `1px solid ${s.border}`,
            color: s.color, fontSize: 12.5, lineHeight: 1.6
        }}>
            <Icon size={15} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{children}</span>
        </div>
    );
};

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const ProcurementDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [req, setReq] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bastDate, setBastDate] = useState(new Date().toISOString().split('T')[0]);
    const [users, setUsers] = useState([]);
    const [units, setUnits] = useState([]);
    const [handoverPhoto, setHandoverPhoto] = useState(null);
    const [handoverFile, setHandoverFile] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [roomAllocation, setRoomAllocation] = useState({ type: 'SAME', roomId: '', itemRooms: {} });
    const [notifying, setNotifying] = useState(false);
    const [selectedUnits, setSelectedUnits] = useState({});
    const [activeTab, setActiveTab] = useState(1);
    const [picId, setPicId] = useState('');
    const [savingItems, setSavingItems] = useState({}); // { itemId: boolean }

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'ADMIN_UNIT', 'KEPALA_BIDANG'].includes(user?.role);
    const isAssignedToAny = req?.items?.some(i => i.assignedToId === user?.id) || false;
    const isAssignedToItem = (item) => item.assignedToId === user?.id;

    useEffect(() => { fetchDetail(); fetchUsers(); fetchUnits(); }, [id]);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data.map(u => ({ id: u.id, name: u.name || u.username, unitId: u.unitId })));
        } catch (e) { console.error(e); }
    };

    const fetchUnits = async () => {
        try { const res = await api.get('/master/units'); setUnits(res.data); }
        catch (e) { console.error(e); }
    };

    const fetchDetail = async () => {
        try {
            const [procRes, roomsRes] = await Promise.all([
                api.get(`/procurements/${id}`),
                api.get('/master/rooms')
            ]);
            const data = procRes.data;
            const safeJSON = (str) => {
                if (!str) return [];
                try { const p = JSON.parse(str); return Array.isArray(p) ? p : []; }
                catch { return []; }
            };
            data.items = (data.items || []).map(item => ({
                ...item,
                brand: item.brand || '',
                usefulLife: item.usefulLife || (data.type === 'ASSET' ? 4 : 0),
                finalPrice: item.finalPrice || item.estPrice,
                fundingSource: item.fundingSource || 'Mandiri',
                vendorId: item.vendorId || '',
                comparisonVendors: safeJSON(item.comparisonVendors),
                needComparison: item.needComparison !== false,
                assignedTo: item.assignedTo || '',
                assignedToId: item.assignedToId || null,
                assignmentNote: item.assignmentNote || ''
            }));
            setReq(data);
            setRooms(roomsRes.data.filter(r => r.unitId === data.unitId));
            if (data.type === 'ASSET' && data.items.length > 1) {
                const init = {};
                data.items.forEach(it => init[it.id] = '');
                setRoomAllocation(prev => ({ ...prev, itemRooms: init }));
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSaveItem = async (item, silent = false) => {
        try {
            if (!silent) setSavingItems(prev => ({ ...prev, [item.id]: true }));

            let vendorId = item.vendorId, newVendorName = null;
            if (item.vendorId === 'OTHER') { vendorId = null; newVendorName = item.newVendorName; }
            else if (typeof item.vendorId === 'string' && item.vendorId.startsWith('CV-')) {
                vendorId = null; newVendorName = item.vendorId.replace('CV-', '');
            }

            await api.put(`/procurements/items/${item.id}`, {
                fundingSource: item.fundingSource, brand: item.brand,
                usefulLife: item.usefulLife, finalPrice: item.finalPrice,
                vendorId, newVendorName,
                comparisonVendors: item.comparisonVendors,
                needComparison: item.needComparison,
                assignedTo: item.assignedTo, assignedToId: item.assignedToId,
                assignmentNote: item.assignmentNote,
                spec: item.spec
            });

            if (!silent) {
                setSavingItems(prev => ({ ...prev, [item.id]: 'done' }));
                setTimeout(() => {
                    setSavingItems(prev => {
                        const next = { ...prev };
                        delete next[item.id];
                        return next;
                    });
                }, 2000);
                // fetchDetail(); // Optional if we trust optimistic state
            }
        } catch (e) {
            if (!silent) {
                setSavingItems(prev => ({ ...prev, [item.id]: false }));
                alert('Gagal menyimpan');
            }
        }
    };

    const handleStatus = async (newStatus, note = '', reason = '') => {
        if (!confirm('Apakah Anda yakin?')) return;
        try {
            await api.put(`/procurements/${id}/status`, { status: newStatus, validationNote: note, rejectionReason: reason });
            fetchDetail();
        } catch (e) { alert(e.response?.data?.error); }
    };

    const handleItemChange = (index, field, value) => {
        const next = { ...req };
        next.items[index][field] = value;
        setReq(next);
    };

    const handleBAST = async () => {
        if (!bastDate) return alert('Pilih tanggal serah terima');
        if (req.type === 'ASSET') {
            if (roomAllocation.type === 'SAME' && !roomAllocation.roomId) return alert('Pilih Ruangan Aset');
            if (roomAllocation.type === 'INDIVIDUAL' && !req.items.every(it => roomAllocation.itemRooms[it.id])) return alert('Pilih Ruangan untuk setiap item');
        }

        try {
            setLoading(true);
            const formData = new FormData();
            formData.append('bastDate', bastDate);
            formData.append('roomAllocation', JSON.stringify(req.type === 'ASSET' ? roomAllocation : null));
            formData.append('picId', picId ? picId : '');

            if (handoverFile) {
                formData.append('bastFile', handoverFile);
            }

            await api.post(`/procurements/${id}/bast`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('BAST Berhasil. Aset telah dibuat.');
            window.location.reload();
        } catch (e) {
            console.error("BAST Error:", e);
            alert(e.response?.data?.error || e.response?.data?.message || e.message || "Gagal menyimpan BAST.");
        } finally {
            setLoading(false);
        }
    };

    /* ── Loading / Error ── */
    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    border: `3px solid ${T.border}`, borderTopColor: T.navy,
                    animation: 'spin 0.8s linear infinite', margin: '0 auto 12px'
                }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <p style={{ color: T.slate, fontSize: 13 }}>Memuat data pengadaan…</p>
            </div>
        </div>
    );
    if (!req) return (
        <div style={{ padding: 40, textAlign: 'center', color: T.slate }}>
            Data tidak ditemukan
        </div>
    );

    /* ═══════════════════════════════════════════
       RENDER
    ═══════════════════════════════════════════ */
    return (
        <div style={{
            maxWidth: 1100, margin: '0 auto',
            padding: '24px 20px 80px',
            fontFamily: "'DM Sans', sans-serif"
        }}>
            {/* Google Fonts */}
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');`}</style>

            {/* ── TOP NAV ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <button
                    onClick={() => navigate('/procurements')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: T.slate, fontSize: 13, fontWeight: 500, padding: 0,
                        transition: 'color .2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.color = T.navy}
                    onMouseOut={e => e.currentTarget.style.color = T.slate}
                >
                    <ArrowLeft size={15} /> Kembali ke Daftar
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.slate, letterSpacing: '0.05em' }}>
                        {req.code}
                    </span>
                    <StatusBadge status={req.status} />
                </div>
            </div>

            {/* ── HERO HEADER ── */}
            <div style={{
                background: `linear-gradient(135deg, ${T.navy} 0%, ${T.navyMid} 100%)`,
                borderRadius: 16, padding: '28px 32px', marginBottom: 20,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: 20, position: 'relative', overflow: 'hidden'
            }}>
                {/* decorative */}
                <div style={{
                    position: 'absolute', right: -40, top: -40,
                    width: 200, height: 200, borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(201,164,83,0.12) 0%, transparent 70%)`
                }} />
                <div style={{
                    position: 'absolute', right: 60, bottom: -30,
                    width: 120, height: 120, borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(201,164,83,0.07) 0%, transparent 70%)`
                }} />

                <div style={{ flex: 1, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                        <span style={{
                            display: 'inline-block', padding: '3px 10px',
                            background: 'rgba(201,164,83,0.2)',
                            border: '1px solid rgba(201,164,83,0.35)',
                            borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                            color: T.gold, letterSpacing: '0.08em', textTransform: 'uppercase'
                        }}>
                            {req.type}
                        </span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                            {req.unit?.name} · {req.user?.username}
                        </span>
                    </div>
                    <h1 style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 24, fontWeight: 700, color: T.white,
                        margin: 0, lineHeight: 1.3
                    }}>
                        {req.title || '—'}
                    </h1>
                </div>
            </div>

            {/* ── STEPPER ── */}
            <div style={{ marginBottom: 24 }}>
                <Stepper
                    active={activeTab}
                    req={req}
                    loading={loading}
                    onSwitch={async (targetStep) => {
                        if (activeTab === 2 && targetStep > 2) {
                            const missing = req.items.find(i => !i.assignedToId);
                            if (missing) return alert(`Harap pilih petugas untuk: ${missing.name}`);
                            setLoading(true);
                            try { for (const item of req.items) await handleSaveItem(item, true); }
                            catch { setLoading(false); return alert('Gagal simpan otomatis.'); }
                            setLoading(false);
                        }
                        if (activeTab === 4 && targetStep > 4) {
                            const incomplete = req.items.find(i => !i.vendorId || !i.finalPrice);
                            if (incomplete) return alert(`Lengkapi Vendor & Harga untuk: ${incomplete.name}`);
                            setLoading(true);
                            try { for (const item of req.items) await handleSaveItem(item, true); }
                            catch { setLoading(false); return alert('Gagal simpan otomatis.'); }
                            setLoading(false);
                        }
                        setActiveTab(targetStep);
                    }}
                />
            </div>

            {/* ════════════════════════════════════════
                STAGE 1 – VERIFIKASI
            ════════════════════════════════════════ */}
            {activeTab === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <Card>
                        <CardHeader icon={FileText} title="Tahap 1 — Verifikasi Request" />

                        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {req.status === 'SUBMITTED' && (
                                <Notice type="warning">
                                    <strong>Menunggu persetujuan.</strong> Request ini belum diproses. Silakan tinjau dan setujui atau tolak.
                                </Notice>
                            )}
                            {req.status !== 'SUBMITTED' && (
                                <Notice type="success">
                                    <strong>Request telah diverifikasi dan disetujui.</strong> Silakan lanjutkan ke tahap berikutnya.
                                </Notice>
                            )}

                            {isAdmin && req.status === 'SUBMITTED' && (
                                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                                    <Btn variant="success" style={{ flex: 1, justifyContent: 'center', padding: '12px 20px' }}
                                        onClick={() => { handleStatus('APPROVED'); setActiveTab(2); }}>
                                        <CheckCircle size={16} /> Setujui Request
                                    </Btn>
                                    <Btn variant="danger" style={{ flex: 1, justifyContent: 'center', padding: '12px 20px' }}
                                        onClick={() => { const r = prompt('Alasan Penolakan:'); if (r) handleStatus('REJECTED', '', r); }}>
                                        <XCircle size={16} /> Tolak
                                    </Btn>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Items Summary */}
                    <Card>
                        <CardHeader icon={ShoppingCart} title="Daftar Barang yang Diajukan" />
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                                <thead>
                                    <tr style={{ background: T.cream }}>
                                        {['No', 'Nama Barang', 'Spesifikasi', 'Jml', 'Satuan', 'Est. Harga', 'Subtotal'].map(h => (
                                            <th key={h} style={{
                                                padding: '12px 20px', textAlign: h === 'No' ? 'center' : h === 'Est. Harga' || h === 'Subtotal' ? 'right' : 'left',
                                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                                letterSpacing: '0.07em', color: T.slate,
                                                borderBottom: `1px solid ${T.border}`
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {req.items.map((item, i) => (
                                        <tr key={item.id}
                                            style={{ borderBottom: `1px solid ${T.creamDk}` }}
                                            onMouseOver={e => e.currentTarget.style.background = T.cream}
                                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '14px 20px', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.slate }}>{i + 1}</td>
                                            <td style={{ padding: '14px 20px', fontWeight: 600, color: T.navy, fontSize: 13 }}>{item.name}</td>
                                            <td style={{ padding: '14px 20px', fontSize: 12, color: T.slate }}>{item.spec || '—'}</td>
                                            <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700 }}>{item.qty}</td>
                                            <td style={{ padding: '14px 20px', fontSize: 12, color: T.slate }}>{item.unit}</td>
                                            <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                                                Rp {(item.estPrice || 0).toLocaleString('id-ID')}
                                            </td>
                                            <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 12, color: T.navy }}>
                                                Rp {((item.qty || 0) * (item.estPrice || 0)).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: T.navy }}>
                                        <td colSpan={6} style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>Total Estimasi</td>
                                        <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontWeight: 700, color: T.gold, fontSize: 13 }}>
                                            Rp {req.items.reduce((s, it) => s + (it.qty || 0) * (it.estPrice || 0), 0).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* ════════════════════════════════════════
                STAGE 2 – PENUGASAN
            ════════════════════════════════════════ */}
            {activeTab === 2 && (
                <Card>
                    <CardHeader icon={UserCheck} title="Tahap 2 — Penugasan Internal">
                        {isAdmin && ['APPROVED', 'PROCESS'].includes(req.status) && (
                            <Btn variant="primary"
                                onClick={async () => {
                                    const missing = req.items.find(i => !i.assignedToId);
                                    if (missing) return alert(`Harap pilih petugas untuk: ${missing.name}`);
                                    setLoading(true);
                                    try { for (const item of req.items) await handleSaveItem(item, true); setActiveTab(3); }
                                    catch { alert('Gagal menyimpan.'); }
                                    finally { setLoading(false); }
                                }}>
                                {loading ? 'Memproses…' : <>Lanjut ke Pemilihan Vendor <ChevronRight size={14} /></>}
                            </Btn>
                        )}
                    </CardHeader>

                    <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Notice type="info">
                            Tentukan staf yang bertanggung jawab atas setiap item pengadaan ini.
                        </Notice>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {req.items.map((item, index) => {
                                const itemUnitId = selectedUnits[index] || users.find(u => u.id === item.assignedToId)?.unitId || '';
                                const filteredUsers = users.filter(u => !itemUnitId || u.unitId === parseInt(itemUnitId));
                                return (
                                    <div key={item.id} style={{
                                        border: `1px solid ${T.border}`,
                                        borderRadius: 12, padding: 20,
                                        background: item.assignedToId ? `linear-gradient(to right, ${T.successBg}, ${T.white})` : T.cream,
                                        transition: 'all .2s'
                                    }}>
                                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                            {/* Item info */}
                                            <div style={{ flex: '1 1 200px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                    <span style={{
                                                        width: 26, height: 26, borderRadius: 7,
                                                        background: T.navy, color: T.white,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 11, fontWeight: 700, flexShrink: 0
                                                    }}>{index + 1}</span>
                                                    <span style={{ fontWeight: 700, fontSize: 14, color: T.navy }}>{item.name}</span>
                                                </div>
                                                <p style={{ fontSize: 11.5, color: T.slate, marginLeft: 34 }}>{item.spec}</p>
                                            </div>

                                            {/* Filter Unit */}
                                            <div style={{ flex: '1 1 160px' }}>
                                                <Label>Filter Unit</Label>
                                                <Select
                                                    value={itemUnitId}
                                                    disabled={req.status === 'COMPLETED' || !isAdmin}
                                                    onChange={e => {
                                                        setSelectedUnits(prev => ({ ...prev, [index]: e.target.value }));
                                                        handleItemChange(index, 'assignedToId', null);
                                                        handleItemChange(index, 'assignedTo', '');
                                                    }}>
                                                    <option value="">— Semua Unit —</option>
                                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                </Select>
                                            </div>

                                            {/* Select Staff */}
                                            <div style={{ flex: '1 1 200px' }}>
                                                <Label>Ditugaskan Kepada *</Label>
                                                <Select
                                                    value={item.assignedToId || ''}
                                                    disabled={req.status === 'COMPLETED' || !isAdmin}
                                                    onChange={e => {
                                                        const sel = e.target.value ? parseInt(e.target.value) : null;
                                                        const u = users.find(x => x.id === sel);
                                                        handleItemChange(index, 'assignedToId', sel);
                                                        handleItemChange(index, 'assignedTo', u?.name || '');
                                                    }}>
                                                    <option value="">— Pilih Staf —</option>
                                                    {filteredUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                </Select>
                                                {filteredUsers.length === 0 && itemUnitId && (
                                                    <p style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>Belum ada staf di unit ini.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        {item.assignedToId && (
                                            <div style={{ marginTop: 12, marginLeft: 0 }}>
                                                <Label>Catatan Instruksi (Opsional)</Label>
                                                <Textarea
                                                    rows={2}
                                                    placeholder="Contoh: Tolong konfirmasi spesifikasi RAM minimal 16GB sebelum order…"
                                                    value={item.assignmentNote || ''}
                                                    onChange={e => handleItemChange(index, 'assignmentNote', e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Card>
            )}

            {/* ════════════════════════════════════════
                STAGE 3 – VENDOR PEMBANDING
            ════════════════════════════════════════ */}
            {activeTab === 3 && (
                <Card>
                    <CardHeader icon={Store} title="Tahap 3 — Pemilihan Vendor Pembanding">
                        {req.status === 'APPROVED' && (isAdmin || isAssignedToAny) && (
                            <Btn variant="primary" onClick={() => { handleStatus('PROCESS', 'Lanjut ke Finalisasi'); setActiveTab(4); }}>
                                Lanjut ke Finalisasi <ChevronRight size={14} />
                            </Btn>
                        )}
                    </CardHeader>

                    <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {req.items.map((item, index) => (
                            <div key={item.id} style={{
                                border: `1px solid ${T.border}`,
                                borderRadius: 14, overflow: 'hidden'
                            }}>
                                {/* Item header */}
                                <div style={{
                                    padding: '16px 20px', background: T.cream,
                                    borderBottom: `1px solid ${T.border}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    flexWrap: 'wrap', gap: 12
                                }}>
                                    <div>
                                        <span style={{ fontWeight: 700, fontSize: 14, color: T.navy }}>{item.name}</span>
                                        <span style={{ fontSize: 12, color: T.slate, marginLeft: 10 }}>{item.spec} · {item.qty} {item.unit}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {(isAdmin || isAssignedToItem(item)) && req.status === 'APPROVED' && (
                                            <>
                                                <label style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.text
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={item.needComparison}
                                                        onChange={e => {
                                                            handleItemChange(index, 'needComparison', e.target.checked);
                                                            handleSaveItem({ ...item, needComparison: e.target.checked }, true);
                                                        }}
                                                    />
                                                    Perlu Perbandingan
                                                </label>
                                                {item.needComparison && (
                                                    <Btn variant="ghost" style={{ padding: '6px 12px', fontSize: 11.5 }}
                                                        onClick={() => {
                                                            const next = [...(item.comparisonVendors || []), { name: '', price: 0, notes: '' }];
                                                            handleItemChange(index, 'comparisonVendors', next);
                                                            handleSaveItem({ ...item, comparisonVendors: next }, true);
                                                        }}>
                                                        <Plus size={12} /> Tambah Vendor
                                                    </Btn>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div style={{ padding: 20 }}>
                                    {item.needComparison ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                                            {(item.comparisonVendors || []).map((cv, cvIndex) => (
                                                <div key={cvIndex} style={{
                                                    background: T.white, border: `1px solid ${T.border}`,
                                                    borderRadius: 10, padding: 16, position: 'relative',
                                                    boxShadow: '0 1px 6px rgba(15,31,61,0.05)'
                                                }}>
                                                    <div style={{
                                                        position: 'absolute', top: 8, right: 8,
                                                        width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        borderRadius: 6, background: T.creamDk, cursor: 'pointer'
                                                    }}
                                                        onClick={() => {
                                                            const next = item.comparisonVendors.filter((_, i) => i !== cvIndex);
                                                            handleItemChange(index, 'comparisonVendors', next);
                                                            handleSaveItem({ ...item, comparisonVendors: next }, true);
                                                        }}>
                                                        <Trash2 size={11} color={T.danger} />
                                                    </div>

                                                    <div style={{ marginBottom: 12 }}>
                                                        <Label>Nama Vendor</Label>
                                                        <input
                                                            style={{
                                                                width: '100%', border: 'none', borderBottom: `2px solid ${T.creamDk}`,
                                                                background: 'transparent', padding: '4px 0',
                                                                fontSize: 13, fontWeight: 600, color: T.navy,
                                                                outline: 'none', transition: 'border-color .2s'
                                                            }}
                                                            value={cv.name} placeholder="Nama vendor…"
                                                            onFocus={e => e.target.style.borderBottomColor = T.navy}
                                                            onBlur={e => { e.target.style.borderBottomColor = T.creamDk; handleSaveItem(item, true); }}
                                                            onChange={e => {
                                                                const next = [...item.comparisonVendors];
                                                                next[cvIndex].name = e.target.value;
                                                                handleItemChange(index, 'comparisonVendors', next);
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Penawaran Harga (Rp)</Label>
                                                        <input
                                                            type="number"
                                                            style={{
                                                                width: '100%', border: 'none', borderBottom: `2px solid ${T.creamDk}`,
                                                                background: 'transparent', padding: '4px 0',
                                                                fontFamily: "'DM Mono', monospace", fontSize: 13, color: T.navy,
                                                                outline: 'none', transition: 'border-color .2s'
                                                            }}
                                                            value={cv.price} placeholder="0"
                                                            onFocus={e => e.target.style.borderBottomColor = T.navy}
                                                            onBlur={e => { e.target.style.borderBottomColor = T.creamDk; handleSaveItem(item, true); }}
                                                            onChange={e => {
                                                                const next = [...item.comparisonVendors];
                                                                next[cvIndex].price = e.target.value;
                                                                handleItemChange(index, 'comparisonVendors', next);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            {(item.comparisonVendors || []).length === 0 && (
                                                <div style={{
                                                    padding: '32px 20px', textAlign: 'center',
                                                    border: `2px dashed ${T.border}`, borderRadius: 10,
                                                    color: T.slate, fontSize: 13, gridColumn: '1/-1'
                                                }}>
                                                    Belum ada kandidat vendor. Klik "Tambah Vendor" untuk menambahkan.
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{
                                            padding: '20px', textAlign: 'center',
                                            border: `1px dashed ${T.border}`, borderRadius: 10,
                                            color: T.slate, fontSize: 12
                                        }}>
                                            Perbandingan harga tidak diperlukan untuk item ini.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* ════════════════════════════════════════
                STAGE 4 – FINALISASI
            ════════════════════════════════════════ */}
            {activeTab === 4 && (
                <Card>
                    <CardHeader icon={DollarSign} title="Tahap 4 — Finalisasi Harga & Vendor">
                        {isAdmin && req.status === 'PROCESS' && (
                            <Btn variant="primary"
                                onClick={async () => {
                                    const inc = req.items.find(i => !i.vendorId || !i.finalPrice);
                                    if (inc) return alert(`Lengkapi Vendor & Harga untuk: ${inc.name}`);
                                    setLoading(true);
                                    try { for (const item of req.items) await handleSaveItem(item, true); setActiveTab(5); }
                                    catch { alert('Gagal menyimpan.'); }
                                    finally { setLoading(false); }
                                }}>
                                Lanjut ke Serah Terima <ChevronRight size={14} />
                            </Btn>
                        )}
                    </CardHeader>

                    <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {req.items.map((item, index) => {
                            const disabled = req.status === 'COMPLETED' || !(isAdmin || isAssignedToItem(item));
                            return (
                                <div key={item.id} style={{
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 12, padding: '20px',
                                    background: item.vendorId && item.finalPrice ? `linear-gradient(to right, ${T.successBg}50, ${T.white})` : T.cream
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: T.navy, marginBottom: 4 }}>{item.name}</div>
                                    <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 16 }}>{item.spec}</div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                                        {/* Vendor */}
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <Label>Vendor Terpilih *</Label>
                                            <Select value={item.vendorId || ''} disabled={disabled}
                                                onChange={e => handleItemChange(index, 'vendorId', e.target.value)}>
                                                <option value="">— Pilih Vendor —</option>
                                                {item.needComparison && (item.comparisonVendors || []).map((cv, i) => (
                                                    <option key={i} value={`CV-${cv.name}`}>{cv.name} (Kandidat)</option>
                                                ))}
                                                <option value="OTHER">+ Input Manual</option>
                                            </Select>
                                            {item.vendorId === 'OTHER' && (
                                                <Input style={{ marginTop: 8 }}
                                                    placeholder="Ketik nama vendor…"
                                                    value={item.newVendorName || ''}
                                                    onChange={e => handleItemChange(index, 'newVendorName', e.target.value)}
                                                />
                                            )}
                                        </div>

                                        {/* Final Price */}
                                        <div>
                                            <Label>Harga Final (Rp) *</Label>
                                            <Input type="number" disabled={disabled}
                                                value={item.finalPrice || ''}
                                                onChange={e => handleItemChange(index, 'finalPrice', e.target.value)}
                                                style={{ fontFamily: "'DM Mono', monospace" }}
                                            />
                                        </div>

                                        {/* Brand */}
                                        <div>
                                            <Label>Brand / Merk</Label>
                                            <Input disabled={disabled}
                                                placeholder="e.g. Samsung, Lenovo…"
                                                value={item.brand || ''}
                                                onChange={e => handleItemChange(index, 'brand', e.target.value)}
                                            />
                                        </div>

                                        {/* Specification */}
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <Label>Spesifikasi Realisasi (Opsional)</Label>
                                            <Textarea disabled={disabled}
                                                rows={2}
                                                placeholder="Detail spesifikasi barang yang akan direalisasikan / dipesan..."
                                                value={item.spec || ''}
                                                onChange={e => handleItemChange(index, 'spec', e.target.value)}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${T.border}`, outline: 'none', backgroundColor: disabled ? T.creamDk : '#fff', color: disabled ? T.slate : T.navy, fontSize: 13 }}
                                            />
                                        </div>

                                        {/* Useful Life */}
                                        {req.type === 'ASSET' && (
                                            <div>
                                                <Label>Umur Ekonomis (Tahun)</Label>
                                                <Input type="number" disabled={disabled}
                                                    value={item.usefulLife || 4}
                                                    onChange={e => handleItemChange(index, 'usefulLife', e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {/* Funding Source */}
                                        <div>
                                            <Label>Sumber Dana</Label>
                                            <Select disabled={disabled}
                                                value={item.fundingSource || 'Mandiri'}
                                                onChange={e => handleItemChange(index, 'fundingSource', e.target.value)}>
                                                {['Yayasan', 'Hibah', 'Wakaf', 'Cashback', 'BOS', 'Lainnya'].map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Save button per item */}
                                    {!disabled && (
                                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                                            <Btn
                                                variant={savingItems[item.id] === 'done' ? 'success' : 'ghost'}
                                                style={{ fontSize: 12, padding: '7px 14px', minWidth: 100 }}
                                                onClick={() => handleSaveItem(item)}
                                                disabled={savingItems[item.id] === true}
                                            >
                                                {savingItems[item.id] === true ? (
                                                    <><div style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Memproses...</>
                                                ) : savingItems[item.id] === 'done' ? (
                                                    <><CheckCircle size={14} /> Tersimpan</>
                                                ) : (
                                                    'Simpan Item Ini'
                                                )}
                                            </Btn>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* ════════════════════════════════════════
                STAGE 5 – SERAH TERIMA
            ════════════════════════════════════════ */}
            {activeTab === 5 && (
                <Card>
                    <CardHeader icon={Package} title="Tahap 5 — Berita Acara Serah Terima" />

                    <div style={{ padding: '28px' }}>
                        {req.status !== 'COMPLETED' ? (
                            <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

                                {/* Date */}
                                <div>
                                    <Label>Tanggal Serah Terima</Label>
                                    <Input type="date" value={bastDate} onChange={e => setBastDate(e.target.value)} />
                                </div>

                                {/* Photo Upload */}
                                <div>
                                    <Label>Foto Bukti Serah Terima</Label>
                                    <div style={{
                                        border: `2px dashed ${handoverPhoto ? T.success : T.border}`,
                                        borderRadius: 14, padding: handoverPhoto ? 12 : 40,
                                        background: handoverPhoto ? T.successBg : T.cream,
                                        textAlign: 'center', position: 'relative',
                                        cursor: 'pointer', transition: 'all .2s'
                                    }}>
                                        {handoverPhoto ? (
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <img src={getMediaUrl(handoverPhoto)} alt="Bukti"
                                                    style={{ maxHeight: 240, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }} />
                                                <button onClick={e => { e.stopPropagation(); setHandoverPhoto(null); }}
                                                    style={{
                                                        position: 'absolute', top: -10, right: -10,
                                                        width: 28, height: 28, borderRadius: '50%',
                                                        background: T.danger, color: T.white, border: 'none',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                    <XCircle size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <Camera size={40} color={T.border} style={{ marginBottom: 10 }} />
                                                <p style={{ color: T.slate, fontSize: 13 }}>Klik atau seret foto ke sini</p>
                                                <p style={{ color: T.border, fontSize: 11, marginTop: 4 }}>JPG, PNG, WEBP (max 5MB)</p>
                                            </>
                                        )}
                                        <input type="file" accept="image/*"
                                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                            onChange={e => {
                                                const f = e.target.files[0];
                                                if (f) {
                                                    setHandoverFile(f);
                                                    const r = new FileReader();
                                                    r.onloadend = () => setHandoverPhoto(r.result);
                                                    r.readAsDataURL(f);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Room Allocation */}
                                {req.type === 'ASSET' && (
                                    <div style={{
                                        background: '#eef3fc', borderRadius: 14,
                                        border: '1px solid #bfd0f5', padding: 20
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                            <MapPin size={15} color='#2c5fc4' />
                                            <span style={{ fontWeight: 700, fontSize: 13, color: '#1e3a8a' }}>Lokasi Penempatan Aset</span>
                                        </div>

                                        {req.items.length > 1 && (
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                                {[['SAME', 'Satu Ruangan (Sama)'], ['INDIVIDUAL', 'Beda Ruangan (Per Item)']].map(([val, label]) => (
                                                    <button key={val}
                                                        onClick={() => setRoomAllocation(p => ({ ...p, type: val }))}
                                                        style={{
                                                            flex: 1, padding: '9px 12px',
                                                            borderRadius: 9, fontSize: 12, fontWeight: 600,
                                                            border: `1.5px solid ${roomAllocation.type === val ? '#2c5fc4' : T.border}`,
                                                            background: roomAllocation.type === val ? '#2c5fc4' : T.white,
                                                            color: roomAllocation.type === val ? T.white : T.slate,
                                                            cursor: 'pointer', transition: 'all .2s'
                                                        }}>
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {roomAllocation.type === 'SAME' ? (
                                            <div>
                                                <Label>Ruangan</Label>
                                                <Select value={roomAllocation.roomId}
                                                    onChange={e => setRoomAllocation(p => ({ ...p, roomId: e.target.value }))}>
                                                    <option value="">— Pilih Ruangan —</option>
                                                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}{r.building ? ` (${r.building})` : ''}</option>)}
                                                </Select>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {req.items.map(it => (
                                                    <div key={it.id} style={{
                                                        background: T.white, borderRadius: 9, padding: '12px 14px',
                                                        border: `1px solid ${T.border}`
                                                    }}>
                                                        <div style={{ fontSize: 11.5, fontWeight: 600, color: T.navy, marginBottom: 6 }}>{it.name}</div>
                                                        <Select value={roomAllocation.itemRooms[it.id] || ''}
                                                            onChange={e => setRoomAllocation(p => ({ ...p, itemRooms: { ...p.itemRooms, [it.id]: e.target.value } }))}>
                                                            <option value="">— Pilih Ruangan —</option>
                                                            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                        </Select>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* PIC Allocation */}
                                {req.type === 'ASSET' && (
                                    <div style={{
                                        background: T.cream, borderRadius: 14,
                                        border: `1px solid ${T.border}`, padding: 20
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                            <UserCheck size={15} color={T.gold} />
                                            <span style={{ fontWeight: 700, fontSize: 13, color: T.navy }}>Penanggung Jawab Aset (PIC)</span>
                                        </div>
                                        <Label>Pilih PIC Utama untuk semua aset ini (Opsional)</Label>
                                        <Select value={picId} onChange={e => setPicId(e.target.value)}>
                                            <option value="">— Tidak ada / Atur Nanti —</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </Select>
                                    </div>
                                )}

                                <button
                                    disabled={!bastDate}
                                    onClick={handleBAST}
                                    style={{
                                        width: '100%', padding: '16px',
                                        borderRadius: 12, fontFamily: "'DM Sans', sans-serif",
                                        fontSize: 15, fontWeight: 700, border: 'none',
                                        background: bastDate
                                            ? `linear-gradient(135deg, ${T.success}, #3a9a72)`
                                            : T.creamDk,
                                        color: bastDate ? T.white : T.slate,
                                        cursor: bastDate ? 'pointer' : 'not-allowed',
                                        boxShadow: bastDate ? '0 6px 20px rgba(45,122,95,0.3)' : 'none',
                                        transition: 'all .25s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                                    }}>
                                    <CheckCircle size={18} />
                                    Selesaikan Pengadaan &amp; Buat Aset
                                </button>
                                
                                <div style={{ 
                                    padding: '16px', borderRadius: 12, border: `1.5px solid ${T.border}`,
                                    background: T.white, display: 'flex', flexDirection: 'column', gap: 10
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FileText size={16} color={T.navy} />
                                        <span style={{ fontWeight: 700, fontSize: 13, color: T.navy }}>Dokumen E-Office</span>
                                    </div>
                                    <p style={{ fontSize: 11.5, color: T.slate, margin: 0 }}>
                                        Buat dokumen Berita Acara Serah Terima (BAST) resmi di modul E-Office untuk penandatanganan digital.
                                    </p>
                                    <Btn variant="ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
                                        const bastItems = req.items.map(it => ({
                                            name: it.name,
                                            qty: it.qty,
                                            condition: 'Baik'
                                        }));
                                        navigate('/e-office/surat-keluar', { 
                                            state: { 
                                                autoCreate: true,
                                                type: 'SURAT_KELUAR',
                                                category: 'Serah Terima Barang',
                                                subject: `BAST Pengadaan: ${req.title}`,
                                                party1Name: 'Kepala Bidang Sarana Prasarana',
                                                party1Title: 'Pemberi',
                                                party2Name: req.vendor?.name || '',
                                                party2Title: 'Penerima',
                                                bastItems
                                            } 
                                        });
                                    }}>
                                        <QrCode size={14} /> Buat BAST Resmi di E-Office
                                    </Btn>
                                </div>
                            </div>
                        ) : (
                            /* COMPLETED STATE */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div style={{
                                    background: T.successBg, borderRadius: 14,
                                    border: `1px solid #a3d9c0`, padding: '40px 28px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{
                                        width: 64, height: 64, borderRadius: '50%',
                                        background: `linear-gradient(135deg, ${T.success}, #3a9a72)`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 16px',
                                        boxShadow: '0 8px 24px rgba(45,122,95,0.3)'
                                    }}>
                                        <CheckCircle size={30} color={T.white} />
                                    </div>
                                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: T.success, marginBottom: 8 }}>
                                        Pengadaan Selesai
                                    </h3>
                                    <p style={{ color: '#4a9a72', fontSize: 14 }}>Seluruh proses pengadaan telah berhasil diselesaikan.</p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div style={{ background: T.cream, borderRadius: 12, border: `1px solid ${T.border}`, padding: 20 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.slate, marginBottom: 12 }}>
                                            Info Serah Terima
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                <span style={{ color: T.slate }}>Tanggal BAST</span>
                                                <span style={{ fontWeight: 600, color: T.navy }}>
                                                    {new Date(req.bastDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                <span style={{ color: T.slate }}>Status</span>
                                                <StatusBadge status="COMPLETED" />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ background: T.cream, borderRadius: 12, border: `1px solid ${T.border}`, padding: 20 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.slate, marginBottom: 12 }}>
                                            Bukti Foto
                                        </div>
                                        {req.bastFile
                                            ? <img src={getMediaUrl(req.bastFile)} alt="Bukti BAST" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} />
                                            : <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.creamDk, borderRadius: 8, color: T.slate, fontSize: 12, fontStyle: 'italic' }}>
                                                Tidak ada foto bukti.
                                            </div>
                                        }
                                    </div>
                                </div>

                                <Btn variant="ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
                                    const bastItems = req.items.map(it => ({
                                        name: it.name,
                                        qty: it.qty,
                                        condition: 'Baik'
                                    }));
                                    navigate('/e-office/surat-keluar', { 
                                        state: { 
                                            autoCreate: true,
                                            type: 'SURAT_KELUAR',
                                            category: 'Serah Terima Barang',
                                            subject: `BAST Pengadaan: ${req.title}`,
                                            party1Name: 'Kepala Bidang Sarana Prasarana',
                                            party1Title: 'Pemberi',
                                            party2Name: req.vendor?.name || '',
                                            party2Title: 'Penerima',
                                            bastItems
                                        } 
                                    });
                                }}>
                                    <QrCode size={14} /> Buat Ulang / Lihat BAST Resmi di E-Office
                                </Btn>
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default ProcurementDetail;