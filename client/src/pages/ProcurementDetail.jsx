import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    CheckCircle, XCircle, FileText, Upload, DollarSign, Store,
    ArrowLeft, Plus, Trash2, ShoppingCart, UserCheck, Camera,
    Image, MapPin, ChevronRight, AlertCircle, Package, QrCode,
    MessageSquare, Clock, Save, Send, Loader2, ChevronDown, ChevronUp,
    Building2, ExternalLink, Eye, ClipboardCheck, Sparkles, Check, Layers,
    PenTool, Printer, RotateCcw, User, ShieldCheck, CheckSquare, X
} from 'lucide-react';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';
import SearchableSelect from '../components/SearchableSelect';
import SignaturePad from '../components/SignaturePad';
import ProcurementLetterModal from '../components/ProcurementLetterModal';
import ProcurementAssignmentOrderModal from '../components/ProcurementAssignmentOrderModal';
import ProcurementPriceComparisonModal from '../components/ProcurementPriceComparisonModal';
import ProcurementPurchaseOrderModal from '../components/ProcurementPurchaseOrderModal';
import QRCode from 'react-qr-code';

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
const getSteps = (type) => {
    const list = [
        { step: 1, label: 'Verifikasi', sub: 'Tinjau & Setujui', icon: FileText },
        { step: 2, label: 'Penugasan', sub: 'Petugas Internal', icon: UserCheck },
        { step: 3, label: 'Pemilihan Vendor', sub: 'Kandidat Vendor', icon: Store },
        { step: 4, label: 'Finalisasi', sub: 'Harga & Rekanan', icon: DollarSign },
        { step: 5, label: 'Serah Terima (BAST)', sub: 'Fisik & Dokumen', icon: Package },
    ];
    if (type === 'ASSET') {
        list.push({ step: 6, label: 'Pemilihan Ruangan', sub: 'Alokasi & Aset', icon: MapPin });
    }
    return list;
};

const Stepper = ({ active, req, onSwitch, loading }) => {
    const steps = getSteps(req?.type);

    const isDone = (step) => {
        if (step === 1) return ['APPROVED', 'PROCESS', 'COMPLETED'].includes(req?.status);
        if (step === 2) return ['PROCESS', 'COMPLETED'].includes(req?.status);
        if (step === 3) return ['PROCESS', 'COMPLETED'].includes(req?.status);
        if (step === 4) return ['PROCESS', 'COMPLETED'].includes(req?.status);
        if (step === 5) return req?.status === 'COMPLETED';
        if (step === 6) return req?.status === 'COMPLETED';
        return false;
    };
    const isDisabled = (step) => {
        if (req?.status === 'REJECTED' && step >= 2) return true;
        if (step >= 2 && req?.status === 'SUBMITTED') return true;
        if (step >= 4 && req?.status === 'APPROVED') return true;
        if ((step === 5 || step === 6) && req?.status === 'APPROVED') return true;
        if (step === 6 && req?.type !== 'ASSET') return true;
        return false;
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'stretch',
            background: T.white, borderRadius: 16,
            border: `1px solid ${T.border}`,
            boxShadow: '0 4px 20px rgba(15,31,61,0.06)',
            overflow: 'hidden'
        }}>
            {steps.map((s, i) => {
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
                            flex: 1, padding: '16px 10px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                            border: 'none', borderRight: i < steps.length - 1 ? `1px solid ${T.creamDk}` : 'none',
                            borderBottom: isActive ? `3px solid ${T.gold}` : '3px solid transparent',
                            background: isActive
                                ? `linear-gradient(to bottom, ${T.goldSoft}40, ${T.white})`
                                : done ? '#fafcfb' : T.white,
                            cursor: dis ? 'not-allowed' : 'pointer',
                            opacity: dis ? 0.38 : 1,
                            transition: 'all .25s ease',
                            position: 'relative'
                        }}
                    >
                        <div style={{
                            width: 38, height: 38, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: done
                                ? T.success
                                : isActive
                                    ? `linear-gradient(135deg, ${T.navy}, ${T.navyMid})`
                                    : T.creamDk,
                            boxShadow: isActive
                                ? `0 4px 14px rgba(15,31,61,0.28)`
                                : done ? '0 2px 8px rgba(45,122,95,0.2)' : 'none',
                            transform: isActive ? 'scale(1.06)' : 'none',
                            transition: 'all .25s',
                        }}>
                            {done
                                ? <CheckCircle size={18} color={T.white} />
                                : <Icon size={16} color={isActive ? T.gold : T.slate} />
                            }
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                fontSize: 11.5, fontWeight: isActive ? 700 : 600,
                                color: isActive ? T.navy : done ? T.success : '#475569',
                                letterSpacing: '0.01em', lineHeight: 1.3
                            }}>
                                {s.label}
                            </div>
                            <div style={{
                                fontSize: 9.5, color: isActive ? T.gold : T.slate,
                                fontWeight: 500, marginTop: 2
                            }}>
                                {s.sub}
                            </div>
                        </div>
                        {i < steps.length - 1 && (
                            <ChevronRight size={13} color={T.border} style={{
                                position: 'absolute', right: -7, top: '50%',
                                transform: 'translateY(-50%)', zIndex: 2
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
        danger: { bg: T.dangerBg, border: '#f5c2c2', color: T.danger, icon: XCircle },
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
    SUB-COMPONENTS
───────────────────────────────────────────── */
const AssetImageUpload = ({ value, onChange, label = 'Foto Aset', disabled }) => {
    const handleFile = (e) => {
        if (disabled) return;
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return alert('File terlalu besar (maks 5MB)');

        const reader = new FileReader();
        reader.onloadend = () => onChange(reader.result);
        reader.readAsDataURL(file);
    };
    return (
        <div>
            <Label style={{ fontSize: 11, marginBottom: 4 }}>{label}</Label>
            <div style={{
                width: '100%', height: 70, borderRadius: 10, border: `1.5px dashed ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden', background: value ? 'transparent' : (disabled ? T.creamDk : T.white),
                transition: 'all 0.2s ease',
                cursor: disabled ? 'not-allowed' : 'pointer'
            }}>
                {value ? (
                    <>
                        <img src={value} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: disabled ? 0.7 : 1 }} />
                        {!disabled && (
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null); }}
                                style={{
                                    position: 'absolute', top: 4, right: 4,
                                    background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                                    border: 'none', borderRadius: '50%', width: 18, height: 18,
                                    cursor: 'pointer', fontSize: 10, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                }}
                            >×</button>
                        )}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', color: T.border }}>
                        <Camera size={18} style={{ marginBottom: 2 }} />
                        <div style={{ fontSize: 9, fontWeight: 600 }}>UPLOAD</div>
                    </div>
                )}
                <input
                    type="file" accept="image/*"
                    disabled={disabled}
                    onChange={handleFile}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
                />
            </div>
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

    // BAST Signatures & Receiver States
    const [receiverName, setReceiverName] = useState('');
    const [receiverSignature, setReceiverSignature] = useState(null);
    const [staffName, setStaffName] = useState('');
    const [staffSignature, setStaffSignature] = useState(null);
    const [bastNotes, setBastNotes] = useState('');
    const [sigModal, setSigModal] = useState({ open: false, type: null, title: '' });
    const [showBastDocModal, setShowBastDocModal] = useState(false);
    const [bastDoc, setBastDoc] = useState(null);
    const [loadingBastDoc, setLoadingBastDoc] = useState(false);
    const [isSavingSignatures, setIsSavingSignatures] = useState(false);
    const [rooms, setRooms] = useState([]);
    const [allRooms, setAllRooms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [assetDetails, setAssetDetails] = useState({}); // { itemId: { categoryId, roomId, picId, condition, isLendable } }
    const [settings, setSettings] = useState(null);
    const [notifying, setNotifying] = useState(false);
    const [selectedUnits, setSelectedUnits] = useState({});
    const [activeTab, setActiveTab] = useState(1);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [draftSavedToast, setDraftSavedToast] = useState(false);
    const [savingItems, setSavingItems] = useState({}); // { itemId: boolean }
    const [progressLogs, setProgressLogs] = useState([]);
    const [newProgressMessage, setNewProgressMessage] = useState('');
    const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);

    // Tabbed Progress & Chat States
    const [activeProgressTab, setActiveProgressTab] = useState('timeline'); // 'timeline' | 'chat'
    const [showAddStageNote, setShowAddStageNote] = useState(false);
    const [newStageNumber, setNewStageNumber] = useState(1);
    const [newStageMessage, setNewStageMessage] = useState('');
    const [isSubmittingStageNote, setIsSubmittingStageNote] = useState(false);
    
    // Mention States
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);

    // Workshop Integration States
    const [showWorkshopModal, setShowWorkshopModal] = useState(false);
    const [selectedWorkshopItems, setSelectedWorkshopItems] = useState({});
    const [workshopOrderPriority, setWorkshopOrderPriority] = useState('NORMAL');
    const [workshopOrderDeadline, setWorkshopOrderDeadline] = useState('');
    const [workshopOrderNotes, setWorkshopOrderNotes] = useState('');

    // ─── Warehouse Fulfillment States ───
    // warehouseFulfillments: { [procItemId]: { enabled, invItemId, warehouseId, quantity } }
    const [warehouseFulfillments, setWarehouseFulfillments] = useState({});
    const [invItems, setInvItems] = useState([]);          // All InvItems with stocks
    const [invWarehouses, setInvWarehouses] = useState([]); // All warehouses

    const updateWarehouseFulfillment = (itemId, updates) => {
        setWarehouseFulfillments(prev => {
            const next = {
                ...prev,
                [itemId]: {
                    ...prev[itemId],
                    ...updates
                }
            };
            try {
                localStorage.setItem(`wh_fulfillments_${id}`, JSON.stringify(next));
            } catch (e) {}
            return next;
        });
    };

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const userPos = (user?.position || '').toLowerCase();
    const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'ADMIN_UNIT', 'KEPALA_BIDANG'].includes(user?.role);
    const isKabid = user?.role === 'SUPER_ADMIN' || userPos.includes('kepala bidang sarana') || user?.role === 'KEPALA_BIDANG';
    const isStaffAset = user?.role === 'ADMIN_ASET' || userPos.includes('staff manajemen aset');
    const canIssueAssignmentOrder = isKabid || isStaffAset;
    const isAssignedToAny = req?.items?.some(i => i.assignedToId === user?.id) || false;
    const isAssignedToItem = (item) => item.assignedToId === user?.id;
    const isRequester = req?.userId === user?.id;

    // Unit Request Letter States
    const [showRequestLetterModal, setShowRequestLetterModal] = useState(false);
    const [isSigningKabidTte, setIsSigningKabidTte] = useState(false);

    // Assignment Orders (Surat Perintah Pengadaan) States
    const [assignmentOrders, setAssignmentOrders] = useState([]);
    const [selectedAssignmentOrder, setSelectedAssignmentOrder] = useState(null);
    const [showAssignmentOrderModal, setShowAssignmentOrderModal] = useState(false);
    const [issuingOrderForStaffId, setIssuingOrderForStaffId] = useState(null);

    // Price Comparison Sheet (Lembar Perbandingan Harga) States
    const [showPriceComparisonModal, setShowPriceComparisonModal] = useState(false);
    const [showPoModal, setShowPoModal] = useState(false);

    const hasPriceComparison = Boolean(
        req?.items && req.items.some(i => i.needComparison || (i.comparisonVendors && i.comparisonVendors.length > 0))
    );

    const fetchAssignmentOrders = async () => {
        try {
            const res = await api.get(`/procurements/${id}/assignment-orders`);
            const list = Array.isArray(res.data) ? res.data : (res.data?.orders || []);
            setAssignmentOrders(list);
        } catch (e) {
            console.error('fetchAssignmentOrders error', e);
        }
    };

    const handleCreateAssignmentOrder = async (assigneeId, customNotes = '') => {
        if (!confirm('Terbitkan Surat Perintah Pengadaan resmi (E-Office) untuk petugas ini?')) return;
        setIssuingOrderForStaffId(assigneeId);
        try {
            const res = await api.post(`/procurements/${id}/assignment-orders`, {
                assigneeId,
                notes: customNotes
            });
            alert('Surat Perintah Pengadaan berhasil diterbitkan dan dicatat di E-Office Surat Keluar.');
            await fetchAssignmentOrders();
            if (res.data?.order) {
                setSelectedAssignmentOrder(res.data.order);
                setShowAssignmentOrderModal(true);
            }
        } catch (err) {
            console.error('handleCreateAssignmentOrder error', err);
            alert(err.response?.data?.error || 'Gagal menerbitkan Surat Perintah Pengadaan.');
        } finally {
            setIssuingOrderForStaffId(null);
        }
    };

    const handleKabidTte = async () => {
        if (!confirm('Berikan TTE (Tanda Tangan Elektronik) Kepala Bidang Sarana pada Surat Permohonan ini?')) return;
        setIsSigningKabidTte(true);
        try {
            const res = await api.put(`/procurements/${id}/request-letter`, {
                kabidTte: true,
                kabidName: user.name || user.username || 'Ravi Kurnia, S.T.'
            });
            setReq(prev => ({
                ...prev,
                requestLetter: res.data.requestLetter
            }));
            alert('TTE Kepala Bidang Sarana berhasil dibubuhkan.');
        } catch (e) {
            console.error('handleKabidTte error', e);
            alert(e.response?.data?.error || 'Gagal membubuhkan TTE.');
        } finally {
            setIsSigningKabidTte(false);
        }
    };

    useEffect(() => { 
        fetchDetail(); 
        fetchUsers(); 
        fetchUnits(); 
        fetchCategories(); 
        fetchSettings(); 
        fetchInvItems(); 
        fetchInvWarehouses();
        fetchAssignmentOrders();
    }, [id]);

    const fetchSettings = async () => {
        try { const res = await api.get('/settings'); setSettings(res.data); }
        catch (e) { console.error(e); }
    };

    const fetchInvItems = async () => {
        try {
            const res = await api.get('/inventory/items?includeStocks=true');
            setInvItems(res.data || []);
        } catch (e) { console.error('fetchInvItems error', e); }
    };

    const fetchInvWarehouses = async () => {
        try {
            const res = await api.get('/inventory/warehouses');
            setInvWarehouses(res.data || []);
        } catch (e) { console.error('fetchInvWarehouses error', e); }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data.map(u => ({
                id: u.id,
                name: u.name || u.username,
                username: u.username,
                mentionName: (u.name || u.username).replace(/\s+/g, '_'),
                unitId: u.unitId,
                position: u.position,
                nip: u.nip,
                role: u.role
            })));
        } catch (e) { console.error(e); }
    };

    const fetchUnits = async () => {
        try { const res = await api.get('/master/units'); setUnits(res.data); }
        catch (e) { console.error(e); }
    };

    const fetchCategories = async () => {
        try { const res = await api.get('/master/categories'); setCategories(res.data); }
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
            data.items = (data.items || []).map(item => {
                let cleanSpec = item.spec || '';
                let itemNotes = item.notes || '';
                if (cleanSpec) {
                    const match = cleanSpec.match(/\[Catatan:\s*([\s\S]*?)\]$/);
                    if (match) {
                        if (!itemNotes) itemNotes = match[1].trim();
                        cleanSpec = cleanSpec.replace(/\[Catatan:\s*[\s\S]*?\]$/, '').trim();
                    }
                }
                return {
                    ...item,
                    spec: cleanSpec,
                    notes: itemNotes,
                    newVendorName: '',
                    brand: item.brand || '',
                    usefulLife: item.usefulLife || (data.type === 'ASSET' ? 4 : 0),
                    finalPrice: item.finalPrice || item.estPrice,
                    fundingSource: (item.fundingSource && item.fundingSource !== 'Mandiri') ? item.fundingSource : 'Yayasan',
                    vendorId: (item.vendorId === 'GUDANG' || item.vendorName === 'Bidang Sarana' || item.vendorName === 'Gudang Sarpras (Internal)' || item.vendorName === 'Gudang Sarpras')
                        ? 'GUDANG'
                        : (item.vendorId || (item.vendorName ? `CV-${item.vendorName}` : '')),
                    vendorName: (item.vendorId === 'GUDANG' || item.vendorName === 'Bidang Sarana' || item.vendorName === 'Gudang Sarpras (Internal)' || item.vendorName === 'Gudang Sarpras')
                        ? 'Bidang Sarana'
                        : (item.vendorName || ''),
                    comparisonVendors: safeJSON(item.comparisonVendors),
                    needComparison: item.needComparison !== false,
                    assignedTo: item.assignedTo || '',
                    assignedToId: item.assignedToId || null,
                    assignmentNote: item.assignmentNote || ''
                };
            });
            setReq(data);
            setAllRooms(roomsRes.data || []);
            setRooms((roomsRes.data || []).filter(r => r.unitId === data.unitId));
            if (data.type === 'ASSET' && data.items.length > 0) {
                const initDetails = {};
                const savedDraftStr = localStorage.getItem(`bast_draft_${id}`);
                const savedDraft = savedDraftStr ? JSON.parse(savedDraftStr) : {};

                data.items.forEach(it => {
                    const existingDraft = savedDraft[it.id] || {};
                    const defaultCatId = existingDraft.categoryId || it.categoryId || '';
                    const defaultTargetUnitId = existingDraft.targetUnitId || data.unitId;
                    const defaultIsEntrusted = existingDraft.isEntrusted || (defaultTargetUnitId !== data.unitId);

                    const units = [];
                    for (let i = 0; i < it.qty; i++) {
                        const uDraft = existingDraft.units?.[i] || {};
                        const uTargetUnitId = uDraft.targetUnitId || data.unitId;
                        units.push({
                            targetUnitId: uTargetUnitId,
                            isEntrusted: uDraft.isEntrusted || (uTargetUnitId !== data.unitId),
                            roomId: uDraft.roomId || '',
                            picId: uDraft.picId || '',
                            image: uDraft.image || null
                        });
                    }

                    initDetails[it.id] = {
                        categoryId: defaultCatId,
                        targetUnitId: defaultTargetUnitId,
                        isEntrusted: defaultIsEntrusted,
                        roomId: existingDraft.roomId || '',
                        picId: existingDraft.picId || '',
                        image: existingDraft.image || null,
                        condition: existingDraft.condition || 'BAIK',
                        isLendable: existingDraft.isLendable || false,
                        needsRoutineMaintenance: existingDraft.needsRoutineMaintenance || false,
                        maintenanceInterval: existingDraft.maintenanceInterval || 3,
                        intervalUnit: existingDraft.intervalUnit || 'MONTHS',
                        allocationType: existingDraft.allocationType || 'SAME',
                        units: units
                    };
                });
                setAssetDetails(initDetails);
            }

            // Restore warehouse fulfillments draft
            const savedWhStr = localStorage.getItem(`wh_fulfillments_${id}`);
            let initialWh = {};
            if (savedWhStr) {
                try { initialWh = JSON.parse(savedWhStr) || {}; } catch (e) {}
            }
            (data.items || []).forEach(it => {
                const isWh = it.vendorId === 'GUDANG' || it.vendorName === 'Bidang Sarana' || it.vendorName === 'Gudang Sarpras (Internal)' || it.vendorName === 'Gudang Sarpras';
                if (isWh) {
                    if (!initialWh[it.id]) {
                        initialWh[it.id] = { enabled: true, quantity: it.qty };
                    }
                }
            });
            setWarehouseFulfillments(initialWh);

            if (data.progress) {
                setProgressLogs(data.progress);
            }

            // Hydrate BAST Fields & Signatures
            if (data.bastDate) {
                setBastDate(data.bastDate.split('T')[0]);
            }
            const parsedSigs = data.bastSignatures || (() => {
                if (typeof data.bastFile === 'string' && data.bastFile.trim().startsWith('{')) {
                    try { return JSON.parse(data.bastFile); } catch (e) { return null; }
                }
                return null;
            })();

            const defaultReceiver = data.user?.name || data.user?.username || '';
            const defaultStaff = user?.name || user?.username || 'Staff Manajemen Aset';

            if (parsedSigs) {
                if (parsedSigs.fileUrl) setHandoverPhoto(parsedSigs.fileUrl);
                setReceiverName(parsedSigs.receiverName || defaultReceiver);
                setStaffName(parsedSigs.staffName || defaultStaff);
                if (parsedSigs.receiverSignature) setReceiverSignature(parsedSigs.receiverSignature);
                if (parsedSigs.staffSignature) setStaffSignature(parsedSigs.staffSignature);
                if (parsedSigs.notes) setBastNotes(parsedSigs.notes);
            } else {
                if (data.bastFile) setHandoverPhoto(data.bastFile);
                setReceiverName(defaultReceiver);
                setStaffName(defaultStaff);
            }

            if (data.bastDoc) {
                setBastDoc(data.bastDoc);
            }

            // Smart activeTab default based on procurement status
            if (data.status === 'COMPLETED') {
                setActiveTab(5);
            } else if (data.status === 'PROCESS') {
                const allFinalized = (data.items || []).every(i => (i.vendorId || i.vendorName) && i.finalPrice);
                setActiveTab(allFinalized ? 5 : 4);
            } else if (data.status === 'APPROVED') {
                const allAssigned = (data.items || []).every(i => i.assignedToId);
                setActiveTab(allAssigned ? 3 : 2);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleOpenBastDocModal = async () => {
        setShowBastDocModal(true);
        setLoadingBastDoc(true);
        try {
            const res = await api.post(`/procurements/${id}/bast-document`, {
                bastDate: bastDate || new Date().toISOString(),
                receiverName: receiverName || req?.user?.name || req?.user?.username || 'Penerima Barang'
            });
            if (res.data?.bastDoc) {
                setBastDoc(res.data.bastDoc);
            }
        } catch (e) {
            console.error('Failed to get/create BAST document:', e);
        } finally {
            setLoadingBastDoc(false);
        }
    };

    const handleSaveItem = async (item, silent = false) => {
        try {
            if (!silent) setSavingItems(prev => ({ ...prev, [item.id]: true }));

            // Resolve vendor name from selection
            let resolvedVendorName = item.vendorName || null;
            if (item.vendorId === 'OTHER') {
                resolvedVendorName = item.newVendorName || null;
            } else if (
                item.vendorId === 'GUDANG' || 
                item.vendorId === 'Gudang Sarpras' || 
                warehouseFulfillments[item.id]?.enabled || 
                resolvedVendorName === 'Bidang Sarana' || 
                resolvedVendorName === 'Gudang Sarpras (Internal)' || 
                resolvedVendorName === 'Gudang Sarpras'
            ) {
                resolvedVendorName = 'Bidang Sarana';
            } else if (typeof item.vendorId === 'string' && item.vendorId.startsWith('CV-')) {
                resolvedVendorName = item.vendorId.replace('CV-', '');
            }

            await api.put(`/procurements/items/${item.id}`, {
                fundingSource: item.fundingSource, brand: item.brand,
                usefulLife: item.usefulLife, finalPrice: item.finalPrice,
                vendorId: null,
                vendorName: resolvedVendorName,
                comparisonVendors: item.comparisonVendors,
                needComparison: item.needComparison,
                assignedTo: item.assignedTo, assignedToId: item.assignedToId,
                assignmentNote: item.assignmentNote,
                spec: item.spec,
                notes: item.notes,
                categoryId: item.categoryId ? parseInt(item.categoryId) : null
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

    const handleItemChange = (index, fieldOrObj, value) => {
        setReq(prev => {
            if (!prev || !prev.items || !prev.items[index]) return prev;
            const nextItems = [...prev.items];
            if (typeof fieldOrObj === 'object' && fieldOrObj !== null) {
                nextItems[index] = { ...nextItems[index], ...fieldOrObj };
            } else {
                nextItems[index] = { ...nextItems[index], [fieldOrObj]: value };
            }
            return { ...prev, items: nextItems };
        });
    };

    const handleSelectWinnerVendor = async (itemIndex, cvIndex) => {
        const next = { ...req };
        const item = next.items[itemIndex];
        const vendors = (item.comparisonVendors || []).map((v, i) => ({
            ...v,
            selected: i === cvIndex
        }));
        const chosen = vendors[cvIndex];
        item.comparisonVendors = vendors;
        if (chosen && chosen.name) {
            item.vendorName = chosen.name;
            item.vendorId = `CV-${chosen.name}`;
            if (chosen.price) {
                item.finalPrice = parseFloat(chosen.price) || 0;
            }
        }
        setReq(next);
        await handleSaveItem(item, true);
    };

    const handleApplyAllComparisons = async () => {
        if (!req?.items) return;
        const next = { ...req };
        next.items = [...next.items];
        let appliedCount = 0;
        const updatedItems = [];

        for (let i = 0; i < next.items.length; i++) {
            const item = { ...next.items[i] };
            const isWh = item.vendorId === 'GUDANG' || item.vendorName === 'Bidang Sarana' || item.vendorName === 'Gudang Sarpras (Internal)' || warehouseFulfillments[item.id]?.enabled;
            if (isWh) continue;

            const cvs = item.comparisonVendors || [];
            if (cvs.length > 0) {
                // Cari vendor yang ditandai selected atau vendor dengan harga termurah (> 0)
                const chosen = cvs.find(v => v.selected) ||
                    [...cvs].filter(v => parseFloat(v.price) > 0).sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0] ||
                    cvs[0];
                if (chosen && chosen.name) {
                    item.vendorName = chosen.name;
                    item.vendorId = `CV-${chosen.name}`;
                    if (chosen.price) {
                        item.finalPrice = parseFloat(chosen.price) || 0;
                    }
                    next.items[i] = item;
                    updatedItems.push(item);
                    appliedCount++;
                }
            }
        }
        setReq(next);
        if (appliedCount > 0) {
            setLoading(true);
            try {
                for (const it of updatedItems) {
                    await handleSaveItem(it, true);
                }
                alert(`Berhasil menerapkan vendor & harga terpilih/termurah untuk ${appliedCount} item.`);
            } catch (e) {
                alert('Sebagian data gagal disimpan ke server, silakan periksa kembali.');
            } finally {
                setLoading(false);
            }
        } else {
            alert('Tidak ditemukan item yang memerlukan penerapan vendor pembanding.');
        }
    };

    const handleSaveDraftItem = (itemId) => {
        const draftStr = localStorage.getItem(`bast_draft_${id}`);
        const draft = draftStr ? JSON.parse(draftStr) : {};
        draft[itemId] = assetDetails[itemId];
        localStorage.setItem(`bast_draft_${id}`, JSON.stringify(draft));
        setDraftSavedToast('Detail alokasi item berhasil disimpan sebagai draft.');
        setTimeout(() => setDraftSavedToast(false), 3000);
    };

    const handleSaveDraftAll = () => {
        const draftStr = localStorage.getItem(`bast_draft_${id}`);
        const draft = draftStr ? JSON.parse(draftStr) : {};
        const updatedDraft = { ...draft, ...assetDetails };
        localStorage.setItem(`bast_draft_${id}`, JSON.stringify(updatedDraft));
        setDraftSavedToast('Semua detail alokasi ruangan berhasil disimpan sebagai draft.');
        setTimeout(() => setDraftSavedToast(false), 3000);
    };

    const handleBAST = async () => {
        if (!bastDate) return alert('Pilih tanggal serah terima');
        if (req.type === 'ASSET') {
            for (const item of req.items) {
                const fulfillment = warehouseFulfillments[item.id];
                // Skip BAST detail validation if using warehouse fulfillment
                if (fulfillment?.enabled) continue;

                const det = assetDetails[item.id] || {};
                const finalCatId = det.categoryId || item.categoryId;
                if (!finalCatId) return alert(`Pilih Kategori untuk item: ${item.name}`);

                if (det.allocationType === 'SAME') {
                    if (!det.roomId) return alert(`Pilih Ruangan untuk item: ${item.name}`);
                } else {
                    const missing = (det.units || []).some(u => !u.roomId);
                    if (missing) return alert(`Lengkapi Ruangan untuk setiap unit item: ${item.name}`);
                }
            }
        }

        // Validate warehouse fulfillment selections
        const fulfillmentList = [];
        for (const [procItemId, f] of Object.entries(warehouseFulfillments)) {
            if (!f.enabled) continue;
            if (!f.invItemId) return alert('Pilih barang gudang untuk item yang menggunakan pemenuhan gudang');
            if (!f.warehouseId) return alert('Pilih gudang untuk item yang menggunakan pemenuhan gudang');
            if (!f.quantity || parseInt(f.quantity) <= 0) return alert('Masukkan jumlah yang valid untuk pemenuhan gudang');
            fulfillmentList.push({
                procurementItemId: parseInt(procItemId),
                invItemId: parseInt(f.invItemId),
                warehouseId: parseInt(f.warehouseId),
                quantity: parseInt(f.quantity)
            });
        }

        try {
            setLoading(true);
            const formData = new FormData();
            formData.append('bastDate', bastDate);
            formData.append('assetDetails', JSON.stringify(req.type === 'ASSET' ? assetDetails : {}));
            formData.append('warehouseFulfillments', JSON.stringify(fulfillmentList));

            if (handoverFile) {
                formData.append('bastFile', handoverFile);
            } else if (handoverPhoto && typeof handoverPhoto === 'string' && !handoverPhoto.startsWith('data:')) {
                formData.append('bastPhotoUrl', handoverPhoto);
            }

            formData.append('receiverName', receiverName || '');
            formData.append('staffName', staffName || '');
            if (receiverSignature) formData.append('receiverSignature', receiverSignature);
            if (staffSignature) formData.append('staffSignature', staffSignature);
            if (bastNotes) formData.append('bastNotes', bastNotes);
            formData.append('bastSignatures', JSON.stringify({
                receiverName: receiverName || '',
                staffName: staffName || '',
                receiverSignature: receiverSignature || null,
                staffSignature: staffSignature || null,
                notes: bastNotes || '',
                fileUrl: typeof handoverPhoto === 'string' && !handoverPhoto.startsWith('data:') ? handoverPhoto : null
            }));

            await api.post(`/procurements/${id}/bast`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            localStorage.removeItem(`bast_draft_${id}`); // Bersihkan draft jika BAST sukses
            localStorage.removeItem(`wh_fulfillments_${id}`);

            const hasWarehouseFulfillment = fulfillmentList.length > 0;
            alert(hasWarehouseFulfillment
                ? 'BAST Berhasil. Stok gudang telah berkurang otomatis.'
                : 'BAST Berhasil. Aset telah dibuat.');
            window.location.reload();
        } catch (e) {
            console.error("BAST Error:", e);
            alert(e.response?.data?.error || e.response?.data?.message || e.message || "Gagal menyimpan BAST.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSignaturesOnly = async () => {
        try {
            setIsSavingSignatures(true);
            const payload = {
                receiverName: receiverName || '',
                staffName: staffName || '',
                receiverSignature: receiverSignature || null,
                staffSignature: staffSignature || null,
                bastNotes: bastNotes || '',
                bastDate: bastDate || null,
                photoUrl: typeof handoverPhoto === 'string' && !handoverPhoto.startsWith('data:') ? handoverPhoto : null
            };
            await api.put(`/procurements/${id}/bast-signatures`, payload);
            alert('Tanda tangan dan data penerima BAST berhasil disimpan!');
        } catch (e) {
            console.error('Error saving signatures:', e);
            alert(e.response?.data?.error || e.message || 'Gagal menyimpan tanda tangan.');
        } finally {
            setIsSavingSignatures(false);
        }
    };

    const formatIndonesianDate = (dateStr) => {
        if (!dateStr) return { dayName: '', dateNum: '', monthName: '', year: '', full: '—' };
        const d = new Date(dateStr);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const dayName = days[d.getDay()] || '';
        const dateNum = d.getDate();
        const monthName = months[d.getMonth()] || '';
        const year = d.getFullYear();
        return { dayName, dateNum, monthName, year, full: `${dayName}, ${dateNum} ${monthName} ${year}` };
    };

    const getPreviewCode = (categoryId) => {
        if (!req || !categoryId) return '';
        const prefix = settings?.assetCodePrefix || 'AST';
        const unitCode = req.unit?.code || 'UNIT';
        const category = categories.find(c => c.id === parseInt(categoryId));
        const catCode = category?.code || '???';
        const year = new Date(bastDate).getFullYear();
        return `${prefix}.${unitCode}.${catCode}.${year}.xxxx`;
    };

    const handleAddProgress = async () => {
        if (!newProgressMessage.trim()) return;
        setIsSubmittingProgress(true);
        try {
            const res = await api.post(`/procurements/${id}/progress`, {
                message: newProgressMessage,
                stage: activeTab
            });
            setProgressLogs([res.data, ...progressLogs]);
            setNewProgressMessage('');
        } catch (e) {
            alert('Gagal menambahkan catatan progress: ' + (e.response?.data?.error || e.message));
        } finally {
            setIsSubmittingProgress(false);
        }
    };

    const handleChatChange = (e) => {
        const val = e.target.value;
        setNewProgressMessage(val);
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPos);
        const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_.-]*)$/);
        if (mentionMatch) {
            setMentionFilter(mentionMatch[1]);
            setShowMentionList(true);
            setMentionIndex(0);
        } else {
            setShowMentionList(false);
        }
    };

    const handleSelectMention = (username) => {
        const input = document.getElementById('chat-input-proc');
        const cursorPos = input ? input.selectionStart : newProgressMessage.length;
        const textBeforeCursor = newProgressMessage.slice(0, cursorPos);
        const textAfterCursor = newProgressMessage.slice(cursorPos);
        const newTextBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_.-]*)$/, `@${username} `);
        setNewProgressMessage(newTextBefore + textAfterCursor);
        setShowMentionList(false);
        setTimeout(() => {
            if (input) {
                input.focus();
                input.setSelectionRange(newTextBefore.length, newTextBefore.length);
            }
        }, 0);
    };

    const handleChatKeyDown = (e) => {
        if (showMentionList) {
            const filteredUsers = users.filter(u => (u.mentionName||'').toLowerCase().includes(mentionFilter.toLowerCase()) || (u.name||'').toLowerCase().includes(mentionFilter.toLowerCase()));
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredUsers.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredUsers[mentionIndex]) {
                    handleSelectMention(filteredUsers[mentionIndex].mentionName);
                }
            } else if (e.key === 'Escape') {
                setShowMentionList(false);
            }
        } else {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddProgress();
            }
        }
    };

    const renderChatMessage = (text) => {
        if (!text) return null;
        const parts = text.split(/(@[a-zA-Z0-9_.-]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return <span key={i} className="font-bold text-blue-700 bg-blue-100 px-1 rounded mx-0.5">{part}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    const handleAddStageNote = async () => {
        if (!newStageMessage.trim()) return;
        setIsSubmittingStageNote(true);
        try {
            const res = await api.post(`/procurements/${id}/progress`, {
                message: newStageMessage.trim(),
                stage: newStageNumber,
                type: 'STAGE_PROGRESS'
            });
            setProgressLogs([res.data, ...progressLogs]);
            setNewStageMessage('');
            setShowAddStageNote(false);
        } catch (e) {
            alert('Gagal menambahkan update tahap: ' + (e.response?.data?.error || e.message));
        } finally {
            setIsSubmittingStageNote(false);
        }
    };

    const isSystemDoc = (msg) => {
        const text = msg?.message || '';
        return (
            msg?.type === 'ASSIGNMENT_ORDER' ||
            msg?.type === 'LETTER' ||
            msg?.type === 'SYSTEM' ||
            msg?.type === 'STAGE_PROGRESS' ||
            text.startsWith('[SURAT_PERINTAH]') ||
            text.startsWith('[SURAT_PERMOHONAN]') ||
            text.startsWith('{"orderId"') ||
            text.startsWith('[Catatan Pemohon untuk Admin Aset]')
        );
    };

    // Chat Logs: HANYA percakapan murni
    const chatLogs = progressLogs.filter(msg => !isSystemDoc(msg));

    // Timeline / Update Tahap Logs:
    const timelineLogs = progressLogs.filter(msg => {
        return isSystemDoc(msg) || Boolean(msg.stage);
    });

    const renderTimelineItem = (item, idx) => {
        const msg = item.message || '';
        const isOrderDoc = item.type === 'ASSIGNMENT_ORDER' || msg.startsWith('[SURAT_PERINTAH]') || msg.startsWith('{"orderId"');
        const isLetterDoc = item.type === 'LETTER' || msg.startsWith('[SURAT_PERMOHONAN]');
        const isInitialNote = msg.startsWith('📋 [Catatan Pemohon') || msg.startsWith('[Catatan Pemohon');

        if (isOrderDoc) {
            let order = null;
            try {
                order = JSON.parse(msg.replace('[SURAT_PERINTAH]', '').trim());
            } catch (e) { }

            const isSigned = Boolean(order?.assigneeSignature);
            return (
                <div key={item.id || idx} className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            <FileText size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-extrabold text-blue-950 uppercase tracking-wide">
                                    Surat Perintah Tugas (SPO)
                                </span>
                                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                                    isSigned ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}>
                                    {isSigned ? '✓ Sudah Ditandatangani' : '⏳ Menunggu TTD Petugas'}
                                </span>
                            </div>
                            <div className="text-xs font-semibold text-slate-800 mt-1">
                                No. Surat: <span className="font-mono text-blue-700">{order?.orderNumber || '-'}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                                Ditugaskan kepada: <b className="text-slate-800">{order?.assignee?.name || 'Petugas'}</b> ({order?.assignee?.position || 'Staff'})
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                {new Date(item.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-center">
                        <button
                            type="button"
                            onClick={() => {
                                const foundOrder = assignmentOrders.find(o => o.orderId === order?.orderId) || order;
                                setSelectedAssignmentOrder(foundOrder);
                                setShowAssignmentOrderModal(true);
                            }}
                            className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        >
                            <Eye size={13} /> Lihat / Cetak SPO
                        </button>
                    </div>
                </div>
            );
        }

        if (isLetterDoc) {
            let letter = null;
            try {
                letter = JSON.parse(msg.replace('[SURAT_PERMOHONAN]', '').trim());
            } catch (e) { }

            return (
                <div key={item.id || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            <FileText size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                                    Surat Permohonan Pengadaan Unit
                                </span>
                                {letter?.headUnitSignature && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        ✓ Disetujui Kepala Unit
                                    </span>
                                )}
                            </div>
                            <div className="text-xs font-semibold text-slate-800 mt-1">
                                No. Surat: <span className="font-mono text-slate-700">{letter?.letterNumber || '-'}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                                Pemohon: <b>{letter?.requesterName || '-'}</b> • Kepala Unit: <b>{letter?.headUnitName || '-'}</b>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                {new Date(item.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            </div>
                        </div>
                    </div>
                    {req?.requestLetter && (
                        <button
                            type="button"
                            onClick={() => setShowRequestLetterModal(true)}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-800 hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 self-end md:self-center"
                        >
                            <Eye size={13} /> Lihat Surat
                        </button>
                    )}
                </div>
            );
        }

        if (isInitialNote) {
            const cleanNote = msg.replace('📋 [Catatan Pemohon untuk Admin Aset]:\n', '').replace('[Catatan Pemohon untuk Admin Aset]:', '').trim();
            return (
                <div key={item.id || idx} className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-950 shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-amber-900 flex items-center gap-1">
                            📋 Catatan Awal Pemohon
                        </span>
                        <span className="text-[10px] text-amber-700/80">
                            {new Date(item.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                    </div>
                    <div className="whitespace-pre-wrap font-medium">{cleanNote}</div>
                </div>
            );
        }

        // Regular stage note / system event
        return (
            <div key={item.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-colors shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                        {item.stage && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">
                                Tahap {item.stage}
                            </span>
                        )}
                        <span className="text-xs font-bold text-slate-800">
                            {item.user?.name || item.user?.username || 'Sistem'}
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                        {new Date(item.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                    </span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap m-0 leading-relaxed font-normal">
                    {renderChatMessage(item.message)}
                </p>
            </div>
        );
    };

    const handleCreateWorkshopOrder = async (e) => {
        e.preventDefault();
        const itemIds = Object.keys(selectedWorkshopItems).filter(k => selectedWorkshopItems[k]).map(Number);
        if (itemIds.length === 0) return alert('Pilih minimal 1 item untuk dikirim ke Workshop');
        try {
            setLoading(true);
            await api.post('/workshop/orders/from-procurement', {
                procurementId: id,
                priority: workshopOrderPriority,
                deadline: workshopOrderDeadline || null,
                notes: workshopOrderNotes,
                itemsIds: itemIds
            });
            alert('Pesanan workshop berhasil dibuat!');
            setShowWorkshopModal(false);
            // reset selection
            setSelectedWorkshopItems({});
            navigate('/workshop/orders');
        } catch (e) {
            alert(e.response?.data?.error || e.message);
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

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {req.requestLetter && (
                        <button
                            onClick={() => setShowRequestLetterModal(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: '#ffffff', border: '1.5px solid #cbd5e1',
                                borderRadius: 8, padding: '5px 12px', fontSize: 12,
                                fontWeight: 700, color: '#1e293b', cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                            }}
                        >
                            <FileText size={14} color="#2563eb" />
                            Surat Permohonan Unit
                            {req.requestLetter.kabidTte ? (
                                <span style={{ background: '#dcfce7', color: '#15803d', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                                    TTE ✓
                                </span>
                            ) : (
                                <span style={{ background: '#fef3c7', color: '#b45309', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                                    Menunggu TTE
                                </span>
                            )}
                        </button>
                    )}
                    {hasPriceComparison && (
                        <button
                            onClick={() => setShowPriceComparisonModal(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: '#ffffff', border: '1.5px solid #0d9488',
                                borderRadius: 8, padding: '5px 12px', fontSize: 12,
                                fontWeight: 700, color: '#0f766e', cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                            }}
                            title="Buka & Cetak Lembar Perbandingan Harga Resmi"
                        >
                            <Store size={14} color="#0d9488" />
                            Lembar Perbandingan Harga
                        </button>
                    )}
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

            {/* ── CATATAN PEMOHON UNTUK ADMIN ASET ── */}
            {req.notes && (
                <div style={{
                    background: '#fef9ed',
                    border: '1.5px solid #f2e2ba',
                    borderRadius: 14,
                    padding: '16px 20px',
                    marginBottom: 24,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    boxShadow: '0 2px 8px rgba(176,125,42,0.06)'
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: '#c9a453', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        color: '#ffffff'
                    }}>
                        <FileText size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#8a6519', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                            Catatan / Keterangan Pemohon untuk Admin Aset
                        </div>
                        <div style={{ fontSize: 13, color: '#453310', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontWeight: 500 }}>
                            {req.notes}
                        </div>
                    </div>
                </div>
            )}

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
                            const incomplete = req.items.find(i => {
                                const isWh = i.vendorId === 'GUDANG' || i.vendorName === 'Bidang Sarana' || i.vendorName === 'Gudang Sarpras (Internal)' || warehouseFulfillments[i.id]?.enabled;
                                if (isWh) {
                                    const f = warehouseFulfillments[i.id];
                                    return !f?.enabled || !f?.invItemId || !f?.warehouseId || !f?.quantity;
                                }
                                return (!i.vendorId && !i.vendorName) || !i.finalPrice;
                            });
                            if (incomplete) {
                                const isWh = incomplete.vendorId === 'GUDANG' || incomplete.vendorName === 'Bidang Sarana' || incomplete.vendorName === 'Gudang Sarpras (Internal)' || warehouseFulfillments[incomplete.id]?.enabled;
                                if (isWh) return alert(`Lengkapi data barang gudang & lokasi gudang untuk: ${incomplete.name}`);
                                return alert(`Lengkapi Vendor & Harga untuk: ${incomplete.name}`);
                            }
                            setLoading(true);
                            try { for (const item of req.items) await handleSaveItem(item, true); }
                            catch { setLoading(false); return alert('Gagal simpan otomatis.'); }
                            setLoading(false);
                        }
                        if (targetStep === 6 && !bastDate) {
                            return alert('Harap tentukan tanggal BAST (Serah Terima) terlebih dahulu di Tahap 5.');
                        }
                        setActiveTab(targetStep);
                    }}
                />
            </div>

            {/* ── RIWAYAT TAHAPAN & DISKUSI (DIPISAH DENGAN TAB) ── */}
            {req.status !== 'REJECTED' && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{
                        background: T.white,
                        borderRadius: 14,
                        border: `1px solid ${T.border}`,
                        boxShadow: '0 2px 10px rgba(15,31,61,0.04)',
                        overflow: 'hidden'
                    }}>
                        {/* Header Bar with Tab Switches and Collapse Toggle */}
                        <div
                            style={{
                                padding: '12px 20px',
                                background: isChatOpen ? T.cream : T.white,
                                borderBottom: isChatOpen ? `1px solid ${T.border}` : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 12,
                                userSelect: 'none',
                                transition: 'background .2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                {/* Tab Selector: Update Tahap vs Diskusi */}
                                <div className="inline-flex bg-slate-200/80 p-1 rounded-xl gap-1">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveProgressTab('timeline');
                                            if (!isChatOpen) setIsChatOpen(true);
                                        }}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            activeProgressTab === 'timeline'
                                                ? 'bg-white text-blue-900 shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <Clock size={14} className={activeProgressTab === 'timeline' ? 'text-blue-600' : 'text-slate-500'} />
                                        <span>Update Tahap &amp; Riwayat</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                            activeProgressTab === 'timeline' ? 'bg-blue-100 text-blue-700' : 'bg-slate-300 text-slate-700'
                                        }`}>
                                            {timelineLogs.length}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveProgressTab('chat');
                                            if (!isChatOpen) setIsChatOpen(true);
                                        }}
                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            activeProgressTab === 'chat'
                                                ? 'bg-white text-blue-900 shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <MessageSquare size={14} className={activeProgressTab === 'chat' ? 'text-blue-600' : 'text-slate-500'} />
                                        <span>Diskusi &amp; Catatan</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                            activeProgressTab === 'chat' ? 'bg-blue-100 text-blue-700' : 'bg-slate-300 text-slate-700'
                                        }`}>
                                            {chatLogs.length}
                                        </span>
                                    </button>
                                </div>

                                {!isChatOpen && (
                                    <div style={{ fontSize: 11.5, color: T.slate, marginLeft: 6 }}>
                                        {activeProgressTab === 'timeline' ? (
                                            <span>Riwayat tahapan pengadaan ({timelineLogs.length} catatan)</span>
                                        ) : (
                                            <span>
                                                {chatLogs.length > 0 
                                                    ? `Pesan terakhir: ${chatLogs[0]?.user?.name || chatLogs[0]?.user?.username}: "${chatLogs[0]?.message?.slice(0, 50)}..."` 
                                                    : 'Belum ada pesan diskusi'}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div 
                                onClick={() => setIsChatOpen(!isChatOpen)}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.slate, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            >
                                <span>{isChatOpen ? 'Sembunyikan' : 'Tampilkan'}</span>
                                {isChatOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                        </div>

                        {/* Collapsible Content */}
                        {isChatOpen && (
                            <div>
                                {/* ── TAB 1: UPDATE TAHAP & RIWAYAT PROGRESS ── */}
                                {activeProgressTab === 'timeline' && (
                                    <div className="flex flex-col max-h-[500px]">
                                        {/* Sub-header with Add Stage Note Button for Staff/Admin */}
                                        {(isAdmin || isKabid || isStaffAset) && (
                                            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                                                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                                                    <Sparkles size={14} className="text-amber-500" />
                                                    <span>Kelola &amp; pantau alur tahapan pengadaan dari awal hingga selesai</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNewStageNumber(activeTab || 1);
                                                        setShowAddStageNote(!showAddStageNote);
                                                    }}
                                                    className="px-3 py-1 bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-lg text-xs font-bold text-slate-700 transition-all shadow-xs flex items-center gap-1"
                                                >
                                                    <Plus size={13} /> {showAddStageNote ? 'Tutup Form' : 'Catat Update Tahap'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Form Tambah Catatan Tahap (if open) */}
                                        {showAddStageNote && (
                                            <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex flex-col gap-2.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-bold text-blue-950">Pilih Tahapan Terkait:</span>
                                                    <select
                                                        value={newStageNumber}
                                                        onChange={(e) => setNewStageNumber(parseInt(e.target.value))}
                                                        className="px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-lg font-bold text-blue-900 outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value={1}>Tahap 1 — Verifikasi Permohonan</option>
                                                        <option value={2}>Tahap 2 — Penugasan Internal (SPO)</option>
                                                        <option value={3}>Tahap 3 — Survei &amp; Perbandingan Harga</option>
                                                        <option value={4}>Tahap 4 — Purchase Order (PO)</option>
                                                        <option value={5}>Tahap 5 — Serah Terima Barang (BAST)</option>
                                                        <option value={6}>Tahap 6 — Selesai &amp; Distribusi Ruangan</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-end gap-2">
                                                    <textarea
                                                        value={newStageMessage}
                                                        onChange={(e) => setNewStageMessage(e.target.value)}
                                                        placeholder="Tuliskan catatan kemajuan progres tahapan ini... (misal: penawaran vendor telah lengkap / barang sedang dipacking)"
                                                        rows={2}
                                                        className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-y"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddStageNote}
                                                        disabled={isSubmittingStageNote || !newStageMessage.trim()}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm shrink-0"
                                                    >
                                                        {isSubmittingStageNote ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                        <span>Simpan Progres</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Timeline Content */}
                                        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                                            {timelineLogs.length > 0 ? (
                                                timelineLogs.map((item, idx) => renderTimelineItem(item, idx))
                                            ) : (
                                                <div className="text-center py-8 text-sm text-slate-400 italic">
                                                    Belum ada catatan tahapan pengadaan tercatat.
                                                </div>
                                            )}

                                            {/* Milestone Awal: Dibuatnya Pengadaan */}
                                            {req.createdAt && (
                                                <div className="p-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2 text-xs text-slate-500">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                                                        <span>
                                                            Permintaan diajukan oleh <b className="text-slate-700">{req.user?.name || req.user?.username}</b> ({req.unit?.name || 'Unit'})
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400">
                                                        {new Date(req.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ── TAB 2: DISKUSI & CHAT (HANYA PESAN PERCAKAPAN) ── */}
                                {activeProgressTab === 'chat' && (
                                    <div className="flex flex-col h-[400px]">
                                        <div className="flex-1 p-4 space-y-3.5 overflow-y-auto">
                                            {chatLogs.length > 0 ? (
                                                chatLogs.slice().reverse().map((msg, idx) => {
                                                    const isMine = msg.userId === user?.id;
                                                    const isStaff = msg.user?.role !== 'USER' && msg.user?.role !== 'ADMIN_UNIT';

                                                    return (
                                                        <div key={msg.id || idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`text-[10px] font-bold ${isMine ? 'text-blue-600' : (isStaff ? 'text-orange-600' : 'text-slate-500')}`}>
                                                                    {isMine ? 'Anda' : (msg.user?.name || msg.user?.username)} {isStaff && !isMine && '(Admin/Petugas)'}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400">
                                                                    {new Date(msg.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                                                </span>
                                                            </div>
                                                            <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                                                                isMine 
                                                                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                                                                    : (isStaff ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-tl-sm' : 'bg-slate-100 text-slate-700 border border-slate-200 rounded-tl-sm')
                                                            }`}>
                                                                <p className="whitespace-pre-wrap m-0 leading-relaxed">{renderChatMessage(msg.message)}</p>
                                                                {msg.stage && (
                                                                    <div className="mt-2 inline-block px-2 py-0.5 bg-white/20 rounded text-[10px] font-semibold opacity-80">
                                                                        Tahap {msg.stage}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="text-center py-10 text-sm text-slate-400 italic flex items-center justify-center h-full">
                                                    Belum ada pesan obrolan. Gunakan kolom di bawah untuk berdiskusi.
                                                </div>
                                            )}
                                        </div>

                                        {/* Input Chat */}
                                        {req.status !== 'COMPLETED' && (
                                            <div className="p-4 bg-white border-t flex items-end gap-2 relative">
                                                {showMentionList && (
                                                    <div className="absolute bottom-full left-4 mb-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 flex flex-col max-h-48">
                                                        {users.filter(u => (u.mentionName||'').toLowerCase().includes(mentionFilter.toLowerCase()) || (u.name||'').toLowerCase().includes(mentionFilter.toLowerCase())).length === 0 ? (
                                                            <div className="p-3 text-sm text-slate-500 italic text-center">User tidak ditemukan</div>
                                                        ) : (
                                                            users.filter(u => (u.mentionName||'').toLowerCase().includes(mentionFilter.toLowerCase()) || (u.name||'').toLowerCase().includes(mentionFilter.toLowerCase())).map((u, i) => (
                                                                <button
                                                                    key={u.id}
                                                                    onClick={() => handleSelectMention(u.mentionName)}
                                                                    className={`px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${i === mentionIndex ? 'bg-blue-50' : ''}`}
                                                                >
                                                                    <div className="font-bold text-slate-800">{u.name}</div>
                                                                    <div className="text-[10px] text-slate-500">{u.username}</div>
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                                <textarea
                                                    id="chat-input-proc"
                                                    value={newProgressMessage}
                                                    onChange={handleChatChange}
                                                    onKeyDown={handleChatKeyDown}
                                                    placeholder="Ketik pesan diskusi... (@username untuk mention)"
                                                    rows={1}
                                                    className="flex-1 max-h-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-y focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                />
                                                <button
                                                    onClick={handleAddProgress}
                                                    disabled={isSubmittingProgress || !newProgressMessage.trim()}
                                                    className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0 flex items-center justify-center"
                                                >
                                                    {isSubmittingProgress ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════
                STAGE 1 – VERIFIKASI
            ════════════════════════════════════════ */}
            {activeTab === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <Card>
                        <CardHeader icon={FileText} title="Tahap 1 — Verifikasi Request" />

                        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Surat Permohonan Unit Card */}
                            {req.requestLetter && (
                                <div style={{
                                    background: '#f8fafc', border: '1.5px solid #cbd5e1',
                                    borderRadius: 12, padding: '16px 20px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    flexWrap: 'wrap', gap: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 10,
                                            background: '#eff6ff', color: '#2563eb',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <FileText size={22} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>
                                                Surat Permohonan Unit: {req.requestLetter.letterNumber || '-'}
                                            </div>
                                            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                                                Pemohon: <b style={{ color: '#334155' }}>{req.requestLetter.requesterName}</b> • Menyetujui: <b style={{ color: '#334155' }}>{req.requestLetter.headUnitName || 'Kepala Unit'}</b>
                                                {req.requestLetter.headUnitSignature ? (
                                                    <span style={{ color: '#16a34a', fontWeight: 700, marginLeft: 8 }}>✓ TTD Kepala Unit Ada</span>
                                                ) : (
                                                    <span style={{ color: '#d97706', fontWeight: 700, marginLeft: 8 }}>⏳ Menunggu TTD Kepala Unit</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {isKabid && !req.requestLetter.kabidTte && (
                                            <button
                                                onClick={handleKabidTte}
                                                disabled={isSigningKabidTte}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    background: '#059669', color: '#fff', border: 'none',
                                                    borderRadius: 8, padding: '8px 14px', fontSize: 12,
                                                    fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(5,150,105,0.2)'
                                                }}
                                            >
                                                <ShieldCheck size={15} />
                                                {isSigningKabidTte ? 'Memproses TTE...' : 'Beri TTE Kabid Sarana'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowRequestLetterModal(true)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                background: '#fff', color: '#334155', border: '1px solid #cbd5e1',
                                                borderRadius: 8, padding: '8px 14px', fontSize: 12,
                                                fontWeight: 700, cursor: 'pointer'
                                            }}
                                        >
                                            <Printer size={15} /> Lihat / Cetak Surat
                                        </button>
                                    </div>
                                </div>
                            )}

                            {req.status === 'SUBMITTED' && (
                                <Notice type="warning">
                                    <strong>Menunggu persetujuan.</strong> Request ini belum diproses. Silakan tinjau dan setujui or tolak.
                                </Notice>
                            )}
                            {req.status === 'REJECTED' && (
                                <Notice type="danger">
                                    <strong>Request ditolak.</strong> Pengadaan ini tidak disetujui. Alasan: {req.rejectionReason || 'Tidak ada keterangan tambahan.'}
                                </Notice>
                            )}
                            {!['SUBMITTED', 'REJECTED'].includes(req.status) && (
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
                            {isAdmin && ['APPROVED', 'PROCESS', 'VALIDATED'].includes(req.status) && (
                                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                                    <Btn variant="danger" style={{ flex: 1, justifyContent: 'center', padding: '12px 20px' }}
                                        onClick={() => { const r = prompt('Alasan Pembatalan:'); if (r) handleStatus('REJECTED', '', r); }}>
                                        <XCircle size={16} /> Batalkan Pengadaan
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
                                            <td style={{ padding: '14px 20px', fontWeight: 600, color: T.navy, fontSize: 13 }}>
                                                <div>{item.name}</div>
                                                {item.notes && (
                                                    <div style={{
                                                        marginTop: 5,
                                                        fontSize: 11,
                                                        color: '#8a6519',
                                                        background: '#fef9ed',
                                                        padding: '3px 8px',
                                                        borderRadius: 6,
                                                        border: '1px solid #f2e2ba',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4
                                                    }}>
                                                        <span style={{ fontWeight: 700 }}>Catatan:</span>
                                                        <span>{item.notes}</span>
                                                    </div>
                                                )}
                                            </td>
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
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {assignmentOrders.length > 0 && (
                                <Btn
                                    variant="outline"
                                    onClick={() => {
                                        const myOrder = assignmentOrders.find(o => o.assignee?.id === user?.id) || assignmentOrders[0];
                                        setSelectedAssignmentOrder(myOrder);
                                        setShowAssignmentOrderModal(true);
                                    }}
                                >
                                    <FileText size={14} /> Surat Tugas ({assignmentOrders.length})
                                </Btn>
                            )}
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
                        </div>
                    </CardHeader>

                    <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Notice type="info">
                            Tentukan staf yang bertanggung jawab atas setiap item pengadaan ini.
                        </Notice>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {req.items.map((item, index) => {
                                const itemUnitId = selectedUnits[index] || users.find(u => u.id === item.assignedToId)?.unitId || '';
                                const filteredUsers = users.filter(u => 
                                    (u.id === item.assignedToId || u.unitId !== 21) &&
                                    (!itemUnitId || u.unitId === parseInt(itemUnitId))
                                );
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
                                                <p style={{ fontSize: 11.5, color: T.slate, marginLeft: 34 }}>{item.spec || '—'}</p>
                                                {item.notes && (
                                                    <div style={{
                                                        marginLeft: 34,
                                                        marginTop: 4,
                                                        fontSize: 11,
                                                        color: '#8a6519',
                                                        background: '#fef9ed',
                                                        padding: '2px 8px',
                                                        borderRadius: 6,
                                                        border: '1px solid #f2e2ba',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4
                                                    }}>
                                                        <span style={{ fontWeight: 700 }}>Catatan Pemohon:</span>
                                                        <span>{item.notes}</span>
                                                    </div>
                                                )}
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
                                                    {units
                                                        .filter(u => u.id !== 21 && !u.name?.toLowerCase().includes('workshop'))
                                                        .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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

                        {/* SURAT PERINTAH PENGADAAN (ASSIGNMENT ORDERS) SECTION */}
                        {req.items.some(i => i.assignedToId) && (
                            <div style={{
                                marginTop: 10,
                                padding: 20,
                                borderRadius: 14,
                                border: '1.5px solid #dbeafe',
                                background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 16
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            padding: 8,
                                            borderRadius: 10,
                                            background: '#2563eb',
                                            color: '#ffffff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>
                                                Surat Perintah Tugas Pengadaan
                                            </h4>
                                            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#64748b' }}>
                                                Pemberi perintah: <strong style={{ color: '#1e293b' }}>Kepala Bidang Sarana</strong> atau <strong style={{ color: '#1e293b' }}>Staff Manajemen Aset</strong> (TTE &amp; Terhubung E-Office).
                                            </p>
                                        </div>
                                    </div>
                                    {assignmentOrders.length > 0 && (
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '4px 12px',
                                            borderRadius: 20,
                                            background: '#dcfce7',
                                            border: '1px solid #86efac',
                                            color: '#15803d',
                                            fontSize: 11,
                                            fontWeight: 700
                                        }}>
                                            <ShieldCheck size={14} />
                                            {assignmentOrders.length} Surat Perintah Aktif
                                        </div>
                                    )}
                                </div>

                                {/* List of distinct assigned staff members */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {Array.from(new Map(req.items.filter(it => it.assignedToId).map(it => [it.assignedToId, { id: it.assignedToId, name: it.assignedTo }])).values()).map(staff => {
                                        const staffItems = req.items.filter(it => it.assignedToId === staff.id);
                                        const order = assignmentOrders.find(o => o.assignee?.id === staff.id);
                                        const isCurrentAssignee = user?.id === staff.id;

                                        return (
                                            <div
                                                key={staff.id}
                                                style={{
                                                    background: '#ffffff',
                                                    border: order ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                                                    borderRadius: 12,
                                                    padding: '16px 20px',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                    gap: 14
                                                }}
                                            >
                                                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                                    <div style={{
                                                        width: 42,
                                                        height: 42,
                                                        borderRadius: 10,
                                                        background: order ? '#eff6ff' : '#f1f5f9',
                                                        color: order ? '#2563eb' : '#64748b',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        border: order ? '1px solid #bfdbfe' : '1px solid #cbd5e1'
                                                    }}>
                                                        <UserCheck size={22} />
                                                    </div>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                                                                {staff.name}
                                                            </span>
                                                            {isCurrentAssignee && (
                                                                <span style={{
                                                                    fontSize: 10,
                                                                    fontWeight: 700,
                                                                    padding: '2px 8px',
                                                                    background: '#dbeafe',
                                                                    color: '#1e40af',
                                                                    borderRadius: 12
                                                                }}>
                                                                    Anda
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                                                            Ditugaskan untuk <strong>{staffItems.length} barang</strong>: {staffItems.map(i => i.name).join(', ')}
                                                        </div>
                                                        {order && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                                                                <span style={{
                                                                    fontSize: 11,
                                                                    fontFamily: 'monospace',
                                                                    fontWeight: 700,
                                                                    color: '#1e40af',
                                                                    background: '#eff6ff',
                                                                    padding: '2px 8px',
                                                                    borderRadius: 6,
                                                                    border: '1px solid #bfdbfe'
                                                                }}>
                                                                    No: {order.orderNumber}
                                                                </span>
                                                                <span style={{
                                                                    fontSize: 11,
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 4,
                                                                    color: '#15803d',
                                                                    fontWeight: 600
                                                                }}>
                                                                    <ShieldCheck size={13} /> TTE: {order.assigner?.name || 'Kabid Sarana'}
                                                                </span>
                                                                {order.assigneeSignature ? (
                                                                    <span style={{
                                                                        fontSize: 11,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 4,
                                                                        color: '#15803d',
                                                                        fontWeight: 600
                                                                    }}>
                                                                        <CheckCircle size={13} /> TTD Petugas Sah
                                                                    </span>
                                                                ) : (
                                                                    <span style={{
                                                                        fontSize: 11,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 4,
                                                                        color: '#b45309',
                                                                        fontWeight: 600
                                                                    }}>
                                                                        <Clock size={13} /> Menunggu TTD Petugas
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action buttons */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    {order ? (
                                                        <>
                                                            {isCurrentAssignee && !order.assigneeSignature && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedAssignmentOrder(order);
                                                                        setShowAssignmentOrderModal(true);
                                                                    }}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 6,
                                                                        padding: '8px 14px',
                                                                        background: '#2563eb',
                                                                        color: '#ffffff',
                                                                        borderRadius: 8,
                                                                        fontSize: 12,
                                                                        fontWeight: 700,
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
                                                                    }}
                                                                >
                                                                    <PenTool size={14} /> Tandatangani
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedAssignmentOrder(order);
                                                                    setShowAssignmentOrderModal(true);
                                                                }}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 6,
                                                                    padding: '8px 14px',
                                                                    background: '#f8fafc',
                                                                    color: '#0f172a',
                                                                    borderRadius: 8,
                                                                    fontSize: 12,
                                                                    fontWeight: 600,
                                                                    border: '1px solid #cbd5e1',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <Eye size={14} /> Lihat Surat Tugas
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {canIssueAssignmentOrder ? (
                                                                <button
                                                                    disabled={issuingOrderForStaffId === staff.id}
                                                                    onClick={() => handleCreateAssignmentOrder(staff.id)}
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 6,
                                                                        padding: '8px 16px',
                                                                        background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                                                                        color: '#ffffff',
                                                                        borderRadius: 8,
                                                                        fontSize: 12,
                                                                        fontWeight: 700,
                                                                        border: 'none',
                                                                        cursor: issuingOrderForStaffId === staff.id ? 'not-allowed' : 'pointer',
                                                                        boxShadow: '0 2px 8px rgba(30,58,138,0.25)',
                                                                        opacity: issuingOrderForStaffId === staff.id ? 0.7 : 1
                                                                    }}
                                                                >
                                                                    {issuingOrderForStaffId === staff.id ? (
                                                                        <>
                                                                            <Loader2 size={14} className="animate-spin" /> Menerbitkan…
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <FileText size={14} /> Terbitkan Surat Perintah (E-Office)
                                                                        </>
                                                                    )}
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                                                                    Menunggu penerbitan Surat Tugas
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* ════════════════════════════════════════
                STAGE 3 – VENDOR PEMBANDING
            ════════════════════════════════════════ */}
            {activeTab === 3 && (
                <Card>
                    <CardHeader icon={Store} title="Tahap 3 — Pemilihan Vendor Pembanding">
                        {assignmentOrders.length > 0 && (
                            <Btn variant="outline" onClick={() => {
                                const myOrder = assignmentOrders.find(o => o.assignee?.id === user?.id) || assignmentOrders[0];
                                setSelectedAssignmentOrder(myOrder);
                                setShowAssignmentOrderModal(true);
                            }}>
                                <FileText size={14} /> Surat Tugas ({assignmentOrders.length})
                            </Btn>
                        )}
                        {hasPriceComparison && (
                            <Btn
                                variant="outline"
                                onClick={() => setShowPriceComparisonModal(true)}
                                style={{ borderColor: '#0d9488', color: '#0f766e', background: '#f0fdfa' }}
                            >
                                <Printer size={14} /> Cetak Lembar Perbandingan
                            </Btn>
                        )}
                        {req.status === 'APPROVED' && (isAdmin || isAssignedToAny) && (
                            <>
                                <Btn variant="gold" onClick={() => {
                                    const initSelected = {};
                                    req.items.forEach(item => {
                                        initSelected[item.id] = true;
                                    });
                                    setSelectedWorkshopItems(initSelected);
                                    setShowWorkshopModal(true);
                                }}>
                                    Pesan ke Workshop
                                </Btn>
                                <Btn variant="primary" onClick={() => { handleStatus('PROCESS', 'Lanjut ke Finalisasi'); setActiveTab(4); }}>
                                    Lanjut ke Finalisasi <ChevronRight size={14} />
                                </Btn>
                            </>
                        )}
                    </CardHeader>

                    {(() => {
                        const comparisonItems = (req.items || []).filter(i => i.needComparison);
                        const totalSurveyed = (req.items || []).reduce((acc, it) => acc + (it.comparisonVendors || []).length, 0);
                        const totalPaguComp = comparisonItems.reduce((acc, it) => acc + ((parseFloat(it.qty) || 1) * (parseFloat(it.estPrice) || 0)), 0);

                        let totalBestOffer = 0;
                        comparisonItems.forEach(it => {
                            const q = parseFloat(it.qty) || 1;
                            const vendors = it.comparisonVendors || [];
                            const chosen = vendors.find(v => v.selected);
                            if (chosen && parseFloat(chosen.price) > 0) {
                                totalBestOffer += q * parseFloat(chosen.price);
                            } else if (vendors.length > 0) {
                                const valid = vendors.map(v => parseFloat(v.price) || 0).filter(p => p > 0);
                                totalBestOffer += valid.length > 0 ? q * Math.min(...valid) : q * (parseFloat(it.estPrice) || 0);
                            } else {
                                totalBestOffer += q * (parseFloat(it.estPrice) || 0);
                            }
                        });

                        const hematComp = totalPaguComp > totalBestOffer ? (totalPaguComp - totalBestOffer) : 0;
                        const persenHematComp = totalPaguComp > 0 ? Math.round((hematComp / totalPaguComp) * 100) : 0;

                        return (
                            <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {/* Top Summary Banner */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #f0fdfa 0%, #e6fffa 100%)',
                                    border: '1.5px solid #99f6e4',
                                    borderRadius: 14, padding: '16px 20px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    flexWrap: 'wrap', gap: 14
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div style={{
                                            width: 42, height: 42, borderRadius: 12,
                                            background: '#0d9488', color: '#ffffff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, boxShadow: '0 4px 12px rgba(13,148,136,0.2)'
                                        }}>
                                            <Store size={20} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: 14.5, color: '#134e4a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                Evaluasi &amp; Komparasi Penawaran Vendor
                                                <span style={{ fontSize: 11, background: '#ccfbf1', color: '#0f766e', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                                                    {comparisonItems.length} dari {req.items.length} Item Dibandingkan
                                                </span>
                                            </div>
                                            <p style={{ fontSize: 12, color: '#115e59', margin: '4px 0 0 0' }}>
                                                {totalSurveyed} penawaran vendor tercatat
                                                {hematComp > 0 && (
                                                    <span style={{ marginLeft: 8, fontWeight: 700, color: '#047857' }}>
                                                        · Potensi Efisiensi: Rp {hematComp.toLocaleString('id-ID')} ({persenHematComp}%)
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        {isAdmin && req.status === 'APPROVED' && (
                                            <button
                                                onClick={() => {
                                                    const allNeeded = req.items.every(i => i.needComparison);
                                                    const nextState = !allNeeded;
                                                    const next = { ...req };
                                                    next.items.forEach(i => { i.needComparison = nextState; });
                                                    setReq(next);
                                                    next.items.forEach(i => handleSaveItem(i, true));
                                                }}
                                                style={{
                                                    background: '#ffffff', border: '1px solid #cbd5e1',
                                                    borderRadius: 8, padding: '6px 12px', fontSize: 11.5,
                                                    fontWeight: 600, color: '#475569', cursor: 'pointer'
                                                }}
                                            >
                                                {req.items.every(i => i.needComparison) ? 'Batalkan Semua Perbandingan' : 'Bandingkan Semua Item'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowPriceComparisonModal(true)}
                                            style={{
                                                background: '#0d9488', border: 'none',
                                                borderRadius: 8, padding: '6px 14px', fontSize: 12,
                                                fontWeight: 700, color: '#ffffff', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                boxShadow: '0 2px 6px rgba(13,148,136,0.3)',
                                                transition: 'all .2s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = '#0f766e'}
                                            onMouseOut={e => e.currentTarget.style.background = '#0d9488'}
                                        >
                                            <Printer size={14} /> Cetak Lembar Perbandingan
                                        </button>
                                    </div>
                                </div>

                                {/* Items List */}
                                {req.items.map((item, index) => {
                                    const qty = parseFloat(item.qty || item.quantity || 1) || 1;
                                    const estPrice = parseFloat(item.estPrice || item.estimatedPrice || 0) || 0;
                                    const estTotal = qty * estPrice;
                                    const vendors = item.comparisonVendors || [];
                                    const validPrices = vendors.map(v => parseFloat(v.price) || 0).filter(p => p > 0);
                                    const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
                                    const chosenVendor = vendors.find(v => v.selected) || vendors.find(v => item.vendorName && item.vendorName.trim().toLowerCase() === (v.name || '').trim().toLowerCase());

                                    return (
                                        <div key={item.id} style={{
                                            border: `1px solid ${item.needComparison ? '#cbd5e1' : T.border}`,
                                            borderRadius: 14, overflow: 'hidden',
                                            background: '#ffffff',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
                                        }}>
                                            {/* Item Header */}
                                            <div style={{
                                                padding: '16px 20px', background: item.needComparison ? '#f8fafc' : T.cream,
                                                borderBottom: `1px solid ${T.border}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                flexWrap: 'wrap', gap: 12
                                            }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 800, fontSize: 14, color: T.navy }}>{item.name}</span>
                                                        <span style={{ fontSize: 12, color: T.slate }}>
                                                            {item.spec || '—'} · {qty} {item.unit}
                                                        </span>
                                                        {estPrice > 0 && (
                                                            <span style={{
                                                                fontSize: 11.5, fontWeight: 700, color: '#0f766e',
                                                                background: '#f0fdfa', border: '1px solid #ccfbf1',
                                                                padding: '2px 8px', borderRadius: 6
                                                            }}>
                                                                Pagu: Rp {estPrice.toLocaleString('id-ID')}
                                                                <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 4 }}>
                                                                    (Total: Rp {estTotal.toLocaleString('id-ID')})
                                                                </span>
                                                            </span>
                                                        )}
                                                        {chosenVendor && (
                                                            <span style={{
                                                                fontSize: 11, fontWeight: 700, color: '#166534',
                                                                background: '#dcfce7', border: '1px solid #bbf7d0',
                                                                padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4
                                                            }}>
                                                                <CheckCircle size={12} />
                                                                Vendor Terpilih: {chosenVendor.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.notes && (
                                                        <div style={{
                                                            marginTop: 6,
                                                            fontSize: 11,
                                                            color: '#8a6519',
                                                            background: '#fef9ed',
                                                            padding: '2px 8px',
                                                            borderRadius: 6,
                                                            border: '1px solid #f2e2ba',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4
                                                        }}>
                                                            <span style={{ fontWeight: 700 }}>Catatan Kebutuhan:</span>
                                                            <span>{item.notes}</span>
                                                        </div>
                                                    )}
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
                                                                        const next = [...(item.comparisonVendors || []), { name: '', price: 0, notes: '', contact: '', selected: false }];
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

                                            {/* Item Body: Candidate Vendor Cards */}
                                            <div style={{ padding: 20 }}>
                                                {item.needComparison ? (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                                        {(item.comparisonVendors || []).map((cv, cvIndex) => {
                                                            const cvPrice = parseFloat(cv.price) || 0;
                                                            const cvTotal = qty * cvPrice;
                                                            const isMin = cvPrice > 0 && cvPrice === minPrice;
                                                            const isChosen = cv.selected || (item.vendorName && item.vendorName.trim().toLowerCase() === (cv.name || '').trim().toLowerCase());
                                                            const diff = estPrice - cvPrice;

                                                            return (
                                                                <div key={cvIndex} style={{
                                                                    background: isChosen ? '#f0fdf4' : (isMin ? '#f0fdfa' : '#ffffff'),
                                                                    border: `1.5px solid ${isChosen ? '#059669' : (isMin ? '#0d9488' : '#e2e8f0')}`,
                                                                    borderRadius: 12, padding: 16, position: 'relative',
                                                                    boxShadow: isChosen ? '0 4px 14px rgba(5,150,105,0.12)' : '0 1px 6px rgba(15,31,61,0.04)',
                                                                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                                                    transition: 'all .2s'
                                                                }}>
                                                                    <div>
                                                                        {/* Top Badges & Trash */}
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                                                <span style={{
                                                                                    width: 22, height: 22, borderRadius: '50%',
                                                                                    background: isChosen ? '#059669' : '#e2e8f0',
                                                                                    color: isChosen ? '#ffffff' : '#334155',
                                                                                    fontSize: 11, fontWeight: 700,
                                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                                }}>
                                                                                    {String.fromCharCode(65 + cvIndex)}
                                                                                </span>
                                                                                {isChosen ? (
                                                                                    <span style={{ fontSize: 10.5, fontWeight: 800, background: '#059669', color: '#ffffff', padding: '2px 8px', borderRadius: 6 }}>
                                                                                        TERPILIH
                                                                                    </span>
                                                                                ) : isMin ? (
                                                                                    <span style={{ fontSize: 10.5, fontWeight: 800, background: '#0d9488', color: '#ffffff', padding: '2px 8px', borderRadius: 6 }}>
                                                                                        ⭐ TERMURAH
                                                                                    </span>
                                                                                ) : null}
                                                                            </div>

                                                                            {(isAdmin || isAssignedToItem(item)) && req.status === 'APPROVED' && (
                                                                                <div style={{
                                                                                    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                    borderRadius: 6, background: '#fee2e2', cursor: 'pointer', transition: 'background .2s'
                                                                                }}
                                                                                    title="Hapus Vendor Ini"
                                                                                    onClick={() => {
                                                                                        if (!confirm(`Hapus vendor ${cv.name || 'ini'} dari perbandingan?`)) return;
                                                                                        const next = item.comparisonVendors.filter((_, i) => i !== cvIndex);
                                                                                        handleItemChange(index, 'comparisonVendors', next);
                                                                                        handleSaveItem({ ...item, comparisonVendors: next }, true);
                                                                                    }}>
                                                                                    <Trash2 size={13} color="#dc2626" />
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Field: Nama Vendor */}
                                                                        <div style={{ marginBottom: 12 }}>
                                                                            <Label>Nama Vendor / Penyedia *</Label>
                                                                            <input
                                                                                style={{
                                                                                    width: '100%', border: '1px solid #cbd5e1',
                                                                                    borderRadius: 6, padding: '7px 10px',
                                                                                    fontSize: 13, fontWeight: 600, color: T.navy,
                                                                                    background: '#ffffff', outline: 'none',
                                                                                    transition: 'border-color .2s'
                                                                                }}
                                                                                value={cv.name || ''}
                                                                                placeholder="contoh: CV. Sumber Makmur"
                                                                                disabled={!(isAdmin || isAssignedToItem(item)) || req.status !== 'APPROVED'}
                                                                                onFocus={e => e.target.style.borderColor = '#0d9488'}
                                                                                onBlur={e => { e.target.style.borderColor = '#cbd5e1'; handleSaveItem(item, true); }}
                                                                                onChange={e => {
                                                                                    const next = (item.comparisonVendors || []).map((v, i) => i === cvIndex ? { ...v, name: e.target.value } : v);
                                                                                    handleItemChange(index, 'comparisonVendors', next);
                                                                                }}
                                                                            />
                                                                        </div>

                                                                        {/* Field: Penawaran Harga */}
                                                                        <div style={{ marginBottom: 12 }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                                                <Label>Penawaran Satuan (Rp) *</Label>
                                                                                {cvPrice > 0 && (
                                                                                    <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#0f766e', fontWeight: 700 }}>
                                                                                        Rp {cvPrice.toLocaleString('id-ID')}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <input
                                                                                type="number"
                                                                                style={{
                                                                                    width: '100%', border: '1px solid #cbd5e1',
                                                                                    borderRadius: 6, padding: '7px 10px',
                                                                                    fontFamily: "'DM Mono', monospace", fontSize: 13, color: T.navy,
                                                                                    background: '#ffffff', outline: 'none',
                                                                                    transition: 'border-color .2s'
                                                                                }}
                                                                                value={cv.price || ''}
                                                                                placeholder="0"
                                                                                disabled={!(isAdmin || isAssignedToItem(item)) || req.status !== 'APPROVED'}
                                                                                onFocus={e => e.target.style.borderColor = '#0d9488'}
                                                                                onBlur={e => { e.target.style.borderColor = '#cbd5e1'; handleSaveItem(item, true); }}
                                                                                onChange={e => {
                                                                                    const next = (item.comparisonVendors || []).map((v, i) => i === cvIndex ? { ...v, price: e.target.value } : v);
                                                                                    handleItemChange(index, 'comparisonVendors', next);
                                                                                }}
                                                                            />
                                                                            {/* Subtotal & Deviation */}
                                                                            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, flexWrap: 'wrap', gap: 4 }}>
                                                                                <span style={{ color: '#64748b' }}>
                                                                                    Subtotal: <strong style={{ color: '#1e293b' }}>Rp {cvTotal.toLocaleString('id-ID')}</strong>
                                                                                </span>
                                                                                {diff > 0 ? (
                                                                                    <span style={{ color: '#059669', fontWeight: 700 }}>
                                                                                        Hemat Rp {diff.toLocaleString('id-ID')}/unit
                                                                                    </span>
                                                                                ) : diff < 0 ? (
                                                                                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                                                                                        +Rp {Math.abs(diff).toLocaleString('id-ID')}/unit
                                                                                    </span>
                                                                                ) : null}
                                                                            </div>
                                                                        </div>

                                                                        {/* Field: Catatan / Keterangan Penawaran */}
                                                                        <div style={{ marginBottom: 12 }}>
                                                                            <Label>Catatan / Garansi / Waktu Kirim</Label>
                                                                            <input
                                                                                style={{
                                                                                    width: '100%', border: '1px solid #e2e8f0',
                                                                                    borderRadius: 6, padding: '6px 10px',
                                                                                    fontSize: 12, color: '#334155',
                                                                                    background: '#ffffff', outline: 'none'
                                                                                }}
                                                                                value={cv.notes || ''}
                                                                                placeholder="misal: Garansi 1 thn, gratis ongkir…"
                                                                                disabled={!(isAdmin || isAssignedToItem(item)) || req.status !== 'APPROVED'}
                                                                                onBlur={() => handleSaveItem(item, true)}
                                                                                onChange={e => {
                                                                                    const next = (item.comparisonVendors || []).map((v, i) => i === cvIndex ? { ...v, notes: e.target.value } : v);
                                                                                    handleItemChange(index, 'comparisonVendors', next);
                                                                                }}
                                                                            />
                                                                        </div>

                                                                        {/* Field: Kontak / Info Toko */}
                                                                        <div style={{ marginBottom: 14 }}>
                                                                            <Label>Kontak / Link Toko (Opsional)</Label>
                                                                            <input
                                                                                style={{
                                                                                    width: '100%', border: '1px solid #e2e8f0',
                                                                                    borderRadius: 6, padding: '6px 10px',
                                                                                    fontSize: 12, color: '#334155',
                                                                                    background: '#ffffff', outline: 'none'
                                                                                }}
                                                                                value={cv.contact || ''}
                                                                                placeholder="No HP / link online shop…"
                                                                                disabled={!(isAdmin || isAssignedToItem(item)) || req.status !== 'APPROVED'}
                                                                                onBlur={() => handleSaveItem(item, true)}
                                                                                onChange={e => {
                                                                                    const next = (item.comparisonVendors || []).map((v, i) => i === cvIndex ? { ...v, contact: e.target.value } : v);
                                                                                    handleItemChange(index, 'comparisonVendors', next);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Bottom Action: Pilih Sebagai Pemenang */}
                                                                    {(isAdmin || isAssignedToItem(item)) && req.status === 'APPROVED' && (
                                                                        <div style={{ paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                                                                            {isChosen ? (
                                                                                <div style={{
                                                                                    background: '#dcfce7', color: '#15803d',
                                                                                    padding: '7px 12px', borderRadius: 8,
                                                                                    fontSize: 12, fontWeight: 700, textAlign: 'center',
                                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                                                                                }}>
                                                                                    <CheckCircle size={14} /> Terpilih untuk Finalisasi
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => handleSelectWinnerVendor(index, cvIndex)}
                                                                                    style={{
                                                                                        width: '100%', background: '#0f766e', color: '#ffffff',
                                                                                        padding: '7px 12px', borderRadius: 8,
                                                                                        fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                                                        transition: 'background .2s'
                                                                                    }}
                                                                                    onMouseOver={e => e.currentTarget.style.background = '#115e59'}
                                                                                    onMouseOut={e => e.currentTarget.style.background = '#0f766e'}
                                                                                >
                                                                                    <Check size={14} /> Pilih Vendor Ini
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                        {(item.comparisonVendors || []).length === 0 && (
                                                            <div style={{
                                                                padding: '36px 20px', textAlign: 'center',
                                                                border: `2px dashed ${T.border}`, borderRadius: 12,
                                                                color: T.slate, fontSize: 13, gridColumn: '1/-1',
                                                                background: '#fafafa'
                                                            }}>
                                                                <Store size={28} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                                                                <div style={{ fontWeight: 600, color: '#475569' }}>Belum ada kandidat vendor pembanding</div>
                                                                <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 12px 0' }}>
                                                                    Tambahkan minimal 2–3 penyedia untuk mendapatkan perbandingan harga terbaik.
                                                                </p>
                                                                {(isAdmin || isAssignedToItem(item)) && req.status === 'APPROVED' && (
                                                                    <Btn variant="primary" style={{ padding: '6px 14px', fontSize: 12 }}
                                                                        onClick={() => {
                                                                            const next = [{ name: '', price: 0, notes: '', contact: '', selected: false }];
                                                                            handleItemChange(index, 'comparisonVendors', next);
                                                                            handleSaveItem({ ...item, comparisonVendors: next }, true);
                                                                        }}>
                                                                        <Plus size={13} /> Tambah Vendor Pertama
                                                                    </Btn>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        padding: '24px 20px', textAlign: 'center',
                                                        border: `1px dashed ${T.border}`, borderRadius: 10,
                                                        color: T.slate, fontSize: 12.5,
                                                        background: '#fafafa',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                                                    }}>
                                                        <span>Perbandingan harga tidak diperlukan untuk item ini.</span>
                                                        {(isAdmin || isAssignedToItem(item)) && req.status === 'APPROVED' && (
                                                            <button
                                                                onClick={() => {
                                                                    handleItemChange(index, 'needComparison', true);
                                                                    handleSaveItem({ ...item, needComparison: true }, true);
                                                                }}
                                                                style={{
                                                                    background: 'transparent', border: '1px solid #0d9488',
                                                                    borderRadius: 6, padding: '4px 10px', fontSize: 11.5,
                                                                    color: '#0f766e', fontWeight: 600, cursor: 'pointer'
                                                                }}
                                                            >
                                                                Aktifkan Perbandingan
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </Card>
            )}

            {/* ════════════════════════════════════════
                STAGE 4 – FINALISASI
            ════════════════════════════════════════ */}
            {activeTab === 4 && (
                <Card>
                    <CardHeader icon={DollarSign} title="Tahap 4 — Finalisasi Harga & Vendor">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Btn
                                variant="outline"
                                style={{ borderColor: T.navy, color: T.navy, background: '#fff', fontSize: 12, padding: '7px 12px' }}
                                onClick={() => setShowPoModal(true)}
                                title="Cetak Surat Pesanan (PO) resmi untuk vendor penyedia"
                            >
                                <Printer size={14} style={{ color: T.gold }} />
                                Cetak PO (Surat Pesanan)
                            </Btn>

                            {isAdmin && req.status === 'PROCESS' && (
                                <Btn variant="primary"
                                    onClick={async () => {
                                        const inc = req.items.find(i => {
                                            const isWh = i.vendorId === 'GUDANG' || i.vendorName === 'Bidang Sarana' || i.vendorName === 'Gudang Sarpras (Internal)' || warehouseFulfillments[i.id]?.enabled;
                                            if (isWh) {
                                                const f = warehouseFulfillments[i.id];
                                                return !f?.enabled || !f?.invItemId || !f?.warehouseId || !f?.quantity;
                                            }
                                            return (!i.vendorId && !i.vendorName) || !i.finalPrice;
                                        });
                                        if (inc) {
                                            const isWh = inc.vendorId === 'GUDANG' || inc.vendorName === 'Bidang Sarana' || inc.vendorName === 'Gudang Sarpras (Internal)' || warehouseFulfillments[inc.id]?.enabled;
                                            if (isWh) return alert(`Lengkapi data barang gudang & lokasi gudang untuk: ${inc.name}`);
                                            return alert(`Lengkapi Vendor & Harga untuk: ${inc.name}`);
                                        }
                                        setLoading(true);
                                        try { for (const item of req.items) await handleSaveItem(item, true); setActiveTab(5); }
                                        catch { alert('Gagal menyimpan.'); }
                                        finally { setLoading(false); }
                                    }}>
                                    Lanjut ke Serah Terima <ChevronRight size={14} />
                                </Btn>
                            )}
                        </div>
                    </CardHeader>

                    <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* ── FINANCIAL SUMMARY & QUICK ACTIONS BANNER ── */}
                        {(() => {
                            const totalPagu = (req.items || []).reduce((sum, it) => sum + ((parseFloat(it.estPrice) || 0) * (parseFloat(it.qty) || 1)), 0);
                            const totalFinal = (req.items || []).reduce((sum, it) => {
                                const isWh = it.vendorId === 'GUDANG' || it.vendorName === 'Bidang Sarana' || it.vendorName === 'Gudang Sarpras (Internal)' || warehouseFulfillments[it.id]?.enabled;
                                if (isWh) return sum;
                                const p = parseFloat(it.finalPrice) || parseFloat(it.estPrice) || 0;
                                return sum + (p * (parseFloat(it.qty) || 1));
                            }, 0);
                            const diff = totalPagu - totalFinal;
                            const isEfficient = diff >= 0;
                            const percent = totalPagu > 0 ? Math.abs((diff / totalPagu) * 100).toFixed(1) : '0';

                            const readyCount = (req.items || []).filter(it => {
                                const isWh = it.vendorId === 'GUDANG' || it.vendorName === 'Bidang Sarana' || it.vendorName === 'Gudang Sarpras (Internal)' || warehouseFulfillments[it.id]?.enabled;
                                if (isWh) return warehouseFulfillments[it.id]?.invItemId && warehouseFulfillments[it.id]?.warehouseId;
                                return (it.vendorName || it.vendorId) && parseFloat(it.finalPrice) > 0;
                            }).length;
                            const isAllReady = readyCount === (req.items || []).length;
                            const hasAnyComparison = (req.items || []).some(it => it.comparisonVendors && it.comparisonVendors.length > 0);

                            return (
                                <div style={{
                                    background: 'linear-gradient(135deg, #0f1f3d 0%, #1a3160 100%)',
                                    borderRadius: 14,
                                    padding: '18px 22px',
                                    color: '#fff',
                                    boxShadow: '0 4px 14px rgba(15,31,61,0.12)',
                                    marginBottom: 6
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#f5e9cc' }}>
                                                <DollarSign size={16} /> Ikhtisar Anggaran & Realisasi Belanja
                                            </div>
                                            <div style={{ fontSize: 11.5, color: '#a0aec0', marginTop: 2 }}>
                                                Perbandingan total pagu estimasi awal vs total harga belanja realisasi final
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            {hasAnyComparison && req.status === 'PROCESS' && (
                                                <button
                                                    type="button"
                                                    onClick={handleApplyAllComparisons}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        background: 'rgba(201, 164, 83, 0.2)',
                                                        border: '1px solid #c9a453',
                                                        color: '#f5e9cc',
                                                        borderRadius: 8,
                                                        padding: '6px 12px',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    title="Terapkan vendor terpilih atau harga termurah dari Tahap 3 ke seluruh item"
                                                >
                                                    <Sparkles size={13} style={{ color: '#c9a453' }} /> Terapkan Hasil Perbandingan
                                                </button>
                                            )}
                                            <div style={{
                                                background: isAllReady ? 'rgba(45, 122, 95, 0.35)' : 'rgba(176, 125, 42, 0.35)',
                                                border: `1px solid ${isAllReady ? '#4ade80' : '#fcd34d'}`,
                                                borderRadius: 20,
                                                padding: '4px 12px',
                                                fontSize: 11.5,
                                                fontWeight: 700,
                                                color: isAllReady ? '#86efac' : '#fde68a',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 5
                                            }}>
                                                {isAllReady ? <Check size={13} /> : <AlertCircle size={13} />}
                                                {readyCount} dari {(req.items || []).length} Item Siap
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3 Metric Boxes */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <div style={{ fontSize: 11, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Pagu (Est. Awal)</div>
                                            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#ffffff', marginTop: 4 }}>
                                                Rp {totalPagu.toLocaleString('id-ID')}
                                            </div>
                                            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>{(req.items || []).length} item pengadaan</div>
                                        </div>

                                        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <div style={{ fontSize: 11, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Belanja Final</div>
                                            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#67e8f9', marginTop: 4 }}>
                                                Rp {totalFinal.toLocaleString('id-ID')}
                                            </div>
                                            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>Biaya belanja eksternal vendor</div>
                                        </div>

                                        <div style={{
                                            background: isEfficient ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                            border: `1px solid ${isEfficient ? 'rgba(74, 222, 128, 0.4)' : 'rgba(248, 113, 113, 0.4)'}`
                                        }}>
                                            <div style={{ fontSize: 11, color: isEfficient ? '#bbf7d0' : '#fecaca', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                {isEfficient ? 'Efisiensi / Penghematan' : 'Kelebihan dari Pagu'}
                                            </div>
                                            <div style={{
                                                fontSize: 16,
                                                fontWeight: 700,
                                                fontFamily: "'DM Mono', monospace",
                                                color: isEfficient ? '#4ade80' : '#f87171',
                                                marginTop: 4
                                            }}>
                                                {isEfficient ? '+ ' : '- '}Rp {Math.abs(diff).toLocaleString('id-ID')}
                                            </div>
                                            <div style={{ fontSize: 10.5, color: isEfficient ? '#86efac' : '#fca5a5', marginTop: 2 }}>
                                                {isEfficient ? `Hemat ${percent}% dari estimasi` : `Melebihi estimasi sebesar ${percent}%`}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        {req.items.map((item, index) => {
                            const disabled = req.status === 'COMPLETED' || !(isAdmin || isAssignedToItem(item));
                            const isWarehouseFulfilled = warehouseFulfillments[item.id]?.enabled || 
                                                         item.vendorId === 'GUDANG' || 
                                                         item.vendorName === 'Bidang Sarana' || 
                                                         item.vendorName === 'Gudang Sarpras (Internal)';
                            return (
                                <div key={item.id} style={{
                                    border: `1.5px solid ${isWarehouseFulfilled ? '#a3d9c0' : ((item.vendorName || item.vendorId) && item.finalPrice ? '#bbf7d0' : T.border)}`,
                                    borderRadius: 12, padding: '20px',
                                    background: isWarehouseFulfilled
                                        ? 'linear-gradient(to right, #f0fdf4, #ffffff)'
                                        : ((item.vendorName || item.vendorId) && item.finalPrice ? `linear-gradient(to right, ${T.successBg}50, ${T.white})` : T.cream)
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: T.navy }}>{item.name}</div>
                                        {isWarehouseFulfilled && (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                padding: '3px 10px', borderRadius: 20,
                                                background: '#dcfce7', color: '#166534',
                                                fontSize: 11, fontWeight: 700
                                            }}>
                                                <Package size={12} /> Dari Stok Gudang
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: T.slate, marginBottom: item.notes ? 6 : 16 }}>{item.spec || '—'}</div>
                                    {item.notes && (
                                        <div style={{
                                            marginBottom: 16,
                                            fontSize: 11,
                                            color: '#8a6519',
                                            background: '#fef9ed',
                                            padding: '3px 8px',
                                            borderRadius: 6,
                                            border: '1px solid #f2e2ba',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4
                                        }}>
                                            <span style={{ fontWeight: 700 }}>Catatan Pemohon:</span>
                                            <span>{item.notes}</span>
                                        </div>
                                    )}

                                    {/* ── PEMENUHAN DARI STOK GUDANG (Tahap 4) ── */}
                                    <div style={{
                                        marginBottom: 16, padding: 14, borderRadius: 10,
                                        background: isWarehouseFulfilled
                                            ? 'linear-gradient(135deg, #edf7f2, #d9f0e8)'
                                            : '#f8fafc',
                                        border: `1.5px solid ${isWarehouseFulfilled ? '#a3d9c0' : '#e2e8f0'}`,
                                        transition: 'all 0.3s ease'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 8,
                                                    background: isWarehouseFulfilled ? T.success : T.navy,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    <Package size={16} color="#fff" />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 13, color: T.navy }}>
                                                        Penuhi dari Stok Gudang (Bidang Sarana)
                                                    </div>
                                                    <div style={{ fontSize: 11, color: T.slate }}>
                                                        Ambil barang dari inventaris gudang yang ada (Vendor: Bidang Sarana), otomatis potong stok gudang saat BAST
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Switch Button */}
                                            <button
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => {
                                                    const nextEnabled = !isWarehouseFulfilled;
                                                    updateWarehouseFulfillment(item.id, {
                                                        enabled: nextEnabled,
                                                        quantity: warehouseFulfillments[item.id]?.quantity || item.qty
                                                    });
                                                    if (nextEnabled) {
                                                        handleItemChange(index, 'vendorId', 'GUDANG');
                                                        handleItemChange(index, 'vendorName', 'Bidang Sarana');
                                                        if (!item.finalPrice) handleItemChange(index, 'finalPrice', 0);
                                                    } else {
                                                        if (item.vendorId === 'GUDANG' || item.vendorName === 'Bidang Sarana') {
                                                            handleItemChange(index, 'vendorId', '');
                                                            handleItemChange(index, 'vendorName', '');
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    width: 46, height: 24, borderRadius: 12,
                                                    background: isWarehouseFulfilled ? T.success : T.border,
                                                    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative',
                                                    transition: 'background 0.25s', flexShrink: 0
                                                }}
                                            >
                                                <div style={{
                                                    position: 'absolute', top: 2,
                                                    left: isWarehouseFulfilled ? 24 : 2,
                                                    width: 20, height: 20, borderRadius: '50%',
                                                    background: '#fff', transition: 'left 0.25s',
                                                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                                                }} />
                                            </button>
                                        </div>

                                        {/* Warehouse Fulfillment Subform */}
                                        {isWarehouseFulfilled && (
                                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #a3d9c0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                                <div>
                                                    <Label>Pilih Barang di Gudang *</Label>
                                                    <select
                                                        disabled={disabled}
                                                        value={warehouseFulfillments[item.id]?.invItemId || ''}
                                                        onChange={e => {
                                                            const newInvId = e.target.value;
                                                            updateWarehouseFulfillment(item.id, { invItemId: newInvId, warehouseId: '' });
                                                        }}
                                                        style={{
                                                            width: '100%', padding: '9px 10px',
                                                            border: `1.5px solid ${warehouseFulfillments[item.id]?.invItemId ? '#86efac' : T.border}`,
                                                            borderRadius: 8, fontSize: 12.5, background: disabled ? T.creamDk : '#fff', color: T.text,
                                                            cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif"
                                                        }}
                                                    >
                                                        <option value="">— Pilih Barang Gudang —</option>
                                                        {invItems.filter(inv => req?.type === 'ASSET' ? !!inv.isAsset : true).map(inv => {
                                                            const totalStock = (inv.stocks || []).reduce((s, st) => s + (st.quantity || 0), 0);
                                                            return (
                                                                <option key={inv.id} value={inv.id}>
                                                                    {inv.name} (Stok: {totalStock} {inv.unit}) {inv.isAsset ? '🏷️ [Aset]' : ''}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>

                                                <div>
                                                    <Label>Pilih Lokasi Gudang *</Label>
                                                    <select
                                                        disabled={disabled}
                                                        value={warehouseFulfillments[item.id]?.warehouseId || ''}
                                                        onChange={e => updateWarehouseFulfillment(item.id, { warehouseId: e.target.value })}
                                                        style={{
                                                            width: '100%', padding: '9px 10px',
                                                            border: `1.5px solid ${warehouseFulfillments[item.id]?.warehouseId ? '#86efac' : T.border}`,
                                                            borderRadius: 8, fontSize: 12.5, background: disabled ? T.creamDk : '#fff', color: T.text,
                                                            cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif"
                                                        }}
                                                    >
                                                        <option value="">— Pilih Gudang —</option>
                                                        {invWarehouses.map(w => {
                                                            const currentInv = invItems.find(inv => String(inv.id) === String(warehouseFulfillments[item.id]?.invItemId));
                                                            const stockObj = currentInv?.stocks?.find(s => String(s.warehouseId) === String(w.id));
                                                            const stockInWh = stockObj ? (stockObj.quantity || 0) : 0;
                                                            return (
                                                                <option key={w.id} value={w.id}>
                                                                    {w.name} {currentInv ? `(Stok: ${stockInWh} ${currentInv.unit || 'unit'})` : ''}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>

                                                    {/* Keterangan Angka Stok di Lokasi Gudang Terpilih */}
                                                    {(() => {
                                                        const currentInv = invItems.find(inv => String(inv.id) === String(warehouseFulfillments[item.id]?.invItemId));
                                                        const currentWhId = warehouseFulfillments[item.id]?.warehouseId;
                                                        if (!currentWhId) return null;
                                                        const currentWh = invWarehouses.find(w => String(w.id) === String(currentWhId));
                                                        if (!currentInv) {
                                                            return (
                                                                <div style={{ marginTop: 6, fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                                                                    Pilih barang gudang terlebih dahulu untuk melihat angka stok di {currentWh?.name || 'gudang ini'}.
                                                                </div>
                                                            );
                                                        }
                                                        const stockObj = currentInv.stocks?.find(s => String(s.warehouseId) === String(currentWhId));
                                                        const stockQty = stockObj ? (stockObj.quantity || 0) : 0;
                                                        const neededQty = parseInt(warehouseFulfillments[item.id]?.quantity || item.qty) || 0;
                                                        const isInsufficient = stockQty < neededQty;

                                                        return (
                                                            <div style={{
                                                                marginTop: 6, padding: '6px 10px', borderRadius: 6,
                                                                background: stockQty === 0 ? '#fef2f2' : (isInsufficient ? '#fffbeb' : '#f0fdf4'),
                                                                border: `1px solid ${stockQty === 0 ? '#fecaca' : (isInsufficient ? '#fef3c7' : '#bbf7d0')}`,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6
                                                            }}>
                                                                <div style={{ fontSize: 11.5, fontWeight: 700, color: stockQty === 0 ? '#b91c1c' : (isInsufficient ? '#b45309' : '#15803d') }}>
                                                                    Stok di {currentWh?.name || 'Gudang'}: <span style={{ fontSize: 13, textDecoration: stockQty === 0 ? 'line-through' : 'none' }}>{stockQty}</span> {currentInv.unit || 'unit'}
                                                                </div>
                                                                {stockQty === 0 ? (
                                                                    <span style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>
                                                                        STOK KOSONG
                                                                    </span>
                                                                ) : isInsufficient ? (
                                                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>
                                                                        Kurang {neededQty - stockQty} {currentInv.unit || 'unit'}
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: 4 }}>
                                                                        ✓ Stok Tersedia
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                <div>
                                                    <Label>Jumlah Diambil dari Gudang *</Label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        disabled={disabled}
                                                        value={warehouseFulfillments[item.id]?.quantity || item.qty}
                                                        onChange={e => updateWarehouseFulfillment(item.id, { quantity: e.target.value })}
                                                        style={{
                                                            width: '100%', padding: '9px 10px',
                                                            border: `1.5px solid ${T.border}`, borderRadius: 8,
                                                            fontSize: 12.5, background: disabled ? T.creamDk : '#fff', color: T.text,
                                                            fontFamily: "'DM Sans', sans-serif"
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                                        {/* Vendor */}
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <Label>Vendor Terpilih *</Label>
                                            <Select value={item.vendorId || ''} disabled={disabled}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === 'GUDANG') {
                                                        updateWarehouseFulfillment(item.id, {
                                                            enabled: true,
                                                            quantity: warehouseFulfillments[item.id]?.quantity || item.qty
                                                        });
                                                        handleItemChange(index, {
                                                            vendorId: 'GUDANG',
                                                            vendorName: 'Bidang Sarana',
                                                            finalPrice: item.finalPrice || 0
                                                        });
                                                    } else {
                                                        if (warehouseFulfillments[item.id]?.enabled) {
                                                            updateWarehouseFulfillment(item.id, { enabled: false });
                                                        }
                                                        if (typeof val === 'string' && val.startsWith('CV-')) {
                                                            const candidateName = val.replace('CV-', '');
                                                            const chosenCv = (item.comparisonVendors || []).find(cv => cv.name === candidateName);
                                                            handleItemChange(index, {
                                                                vendorId: val,
                                                                vendorName: candidateName,
                                                                finalPrice: chosenCv?.price ? (parseFloat(chosenCv.price) || 0) : (item.finalPrice || 0)
                                                            });
                                                        } else {
                                                            handleItemChange(index, {
                                                                vendorId: val,
                                                                vendorName: val === 'OTHER' ? (item.newVendorName || '') : ''
                                                            });
                                                        }
                                                    }
                                                }}>
                                                <option value="">— Pilih Vendor —</option>
                                                <option value="GUDANG">📦 Ambil dari Stok Gudang (Bidang Sarana)</option>
                                                {item.needComparison && (item.comparisonVendors || []).map((cv, i) => (
                                                    <option key={i} value={`CV-${cv.name}`}>{cv.name} (Kandidat)</option>
                                                ))}
                                                <option value="OTHER">+ Input Manual</option>
                                            </Select>
                                            {item.vendorId === 'OTHER' && (
                                                <Input style={{ marginTop: 8 }}
                                                    placeholder="Ketik nama vendor…"
                                                    value={item.newVendorName || ''}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        handleItemChange(index, { newVendorName: val, vendorName: val });
                                                    }}
                                                />
                                            )}

                                            {/* Quick-Fill Chips dari Hasil Perbandingan Tahap 3 */}
                                            {item.comparisonVendors && item.comparisonVendors.length > 0 && (
                                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: T.slate, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Sparkles size={12} style={{ color: T.gold }} /> Kandidat Tahap 3:
                                                    </span>
                                                    {item.comparisonVendors.map((cv, cvIdx) => {
                                                        const isSelected = (item.vendorName === cv.name) || (item.vendorId === `CV-${cv.name}`);
                                                        const validPrices = item.comparisonVendors.map(v => parseFloat(v.price) || 0).filter(p => p > 0);
                                                        const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
                                                        const isCheapest = cv.price && parseFloat(cv.price) === minPrice;

                                                        return (
                                                            <button
                                                                key={cvIdx}
                                                                type="button"
                                                                disabled={disabled}
                                                                onClick={() => {
                                                                    handleItemChange(index, {
                                                                        vendorId: `CV-${cv.name}`,
                                                                        vendorName: cv.name,
                                                                        finalPrice: cv.price ? (parseFloat(cv.price) || 0) : item.finalPrice
                                                                    });
                                                                }}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 5,
                                                                    padding: '4px 10px',
                                                                    borderRadius: 20,
                                                                    fontSize: 11,
                                                                    cursor: disabled ? 'default' : 'pointer',
                                                                    border: `1px solid ${isSelected ? T.navy : isCheapest ? '#86efac' : T.border}`,
                                                                    background: isSelected ? T.navy : isCheapest ? '#f0fdf4' : '#fff',
                                                                    color: isSelected ? '#fff' : isCheapest ? '#166534' : T.text,
                                                                    fontWeight: isSelected || isCheapest ? 700 : 500,
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                title={`Klik untuk mengisi ${cv.name} (Rp ${(parseFloat(cv.price) || 0).toLocaleString('id-ID')})`}
                                                            >
                                                                <span>{cv.name}</span>
                                                                <span style={{ opacity: 0.85, fontFamily: "'DM Mono', monospace" }}>
                                                                    · Rp {(parseFloat(cv.price) || 0).toLocaleString('id-ID')}
                                                                </span>
                                                                {isCheapest && <span style={{ fontSize: 10 }}>⭐ Termurah</span>}
                                                                {isSelected && <Check size={12} style={{ color: '#fff' }} />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
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
                                                value={(item.fundingSource && item.fundingSource !== 'Mandiri') ? item.fundingSource : 'Yayasan'}
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
                STAGE 5 – SERAH TERIMA (BAST)
            ════════════════════════════════════════ */}
            {activeTab === 5 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <Card>
                        <CardHeader icon={Package} title="Tahap 5 — Berita Acara Serah Terima (BAST)">
                            {req.status === 'COMPLETED' ? (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '6px 14px', borderRadius: 20, background: T.successBg,
                                    color: T.success, fontSize: 12, fontWeight: 700
                                }}>
                                    <CheckCircle size={15} /> Serah Terima Selesai
                                </span>
                            ) : req.type === 'ASSET' ? (
                                <Btn variant="primary" onClick={() => {
                                    if (!bastDate) return alert('Pilih tanggal serah terima (BAST) terlebih dahulu');
                                    setActiveTab(6);
                                }}>
                                    Lanjut ke Pemilihan Ruangan <ChevronRight size={14} />
                                </Btn>
                            ) : (
                                <Btn variant="success" onClick={handleBAST} disabled={loading}>
                                    {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                    Selesaikan Pengadaan
                                </Btn>
                            )}
                        </CardHeader>

                        <div style={{ padding: '24px 28px' }}>
                            {req.status !== 'COMPLETED' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    {/* Notice banner */}
                                    <Notice type="info">
                                        <strong>Penerimaan Fisik &amp; Dokumen BAST:</strong> Pastikan fisik barang telah diterima dari rekanan/gudang dan sesuai dengan pesanan. Tentukan tanggal kedatangan, unggah bukti fisik serah terima, dan kelola dokumen BAST resmi melalui modul E-Office.
                                    </Notice>

                                    {/* 2-Column Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
                                        {/* Column 1: Formulir Serah Terima Fisik */}
                                        <div style={{
                                            background: T.white, borderRadius: 14,
                                            border: `1.5px solid ${T.border}`, padding: 22,
                                            display: 'flex', flexDirection: 'column', gap: 18,
                                            boxShadow: '0 2px 10px rgba(15,31,61,0.03)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: `1px solid ${T.creamDk}` }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eef3fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <ClipboardCheck size={16} color="#2563eb" />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.navy }}>Bukti Serah Terima Fisik</div>
                                                    <div style={{ fontSize: 11, color: T.slate }}>Tanggal kedatangan &amp; bukti foto/scan serah terima</div>
                                                </div>
                                            </div>

                                            {/* Tanggal BAST */}
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <Label style={{ marginBottom: 0 }}>Tanggal Serah Terima (BAST) *</Label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setBastDate(new Date().toISOString().split('T')[0])}
                                                        style={{
                                                            background: 'none', border: 'none', color: T.gold,
                                                            fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0
                                                        }}
                                                    >
                                                        Gunakan Hari Ini
                                                    </button>
                                                </div>
                                                <Input
                                                    type="date"
                                                    disabled={req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)}
                                                    value={bastDate}
                                                    onChange={e => setBastDate(e.target.value)}
                                                />
                                            </div>

                                            {/* Photo / File Upload */}
                                            <div>
                                                <Label>Foto Bukti / Scan Berkas Serah Terima</Label>
                                                <div style={{
                                                    border: `2px dashed ${handoverPhoto ? T.success : T.border}`,
                                                    borderRadius: 12, padding: handoverPhoto ? 14 : 32,
                                                    background: handoverPhoto ? T.successBg : T.cream,
                                                    textAlign: 'center', position: 'relative',
                                                    cursor: (req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)) ? 'not-allowed' : 'pointer',
                                                    transition: 'all .25s'
                                                }}>
                                                    {handoverPhoto ? (
                                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                                            <img
                                                                src={getMediaUrl(handoverPhoto)}
                                                                alt="Bukti Serah Terima"
                                                                style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}
                                                            />
                                                            {!(req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); setHandoverPhoto(null); setHandoverFile(null); }}
                                                                    style={{
                                                                        position: 'absolute', top: -10, right: -10,
                                                                        width: 26, height: 26, borderRadius: '50%',
                                                                        background: T.danger, color: T.white, border: 'none',
                                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                                                    }}
                                                                    title="Hapus foto"
                                                                >
                                                                    <XCircle size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Camera size={36} color={T.slate} style={{ marginBottom: 8 }} />
                                                            <p style={{ color: T.text, fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
                                                                Unggah Foto Bukti atau Scan BAST
                                                            </p>
                                                            <p style={{ color: T.slate, fontSize: 11, margin: 0 }}>
                                                                Klik atau seret file gambar ke area ini (Maks. 5MB)
                                                            </p>
                                                        </>
                                                    )}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        disabled={req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)}
                                                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: (req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)) ? 'not-allowed' : 'pointer' }}
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

                                            {/* Status Checklist Serah Terima */}
                                            <div style={{
                                                background: T.cream, borderRadius: 10, padding: '12px 16px',
                                                border: `1px solid ${T.creamDk}`, display: 'flex', flexDirection: 'column', gap: 8
                                            }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: T.slate, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Kelayakan Serah Terima
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                    {bastDate ? <CheckCircle size={15} color={T.success} /> : <AlertCircle size={15} color={T.warn} />}
                                                    <span style={{ color: bastDate ? T.text : T.warn, fontWeight: bastDate ? 600 : 700 }}>
                                                        {bastDate ? `Tanggal BAST: ${new Date(bastDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Tanggal BAST belum ditentukan'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                    {staffSignature ? <CheckCircle size={15} color={T.success} /> : <AlertCircle size={15} color={T.warn} />}
                                                    <span style={{ color: staffSignature ? T.text : T.warn, fontWeight: staffSignature ? 600 : 700 }}>
                                                        {staffSignature ? `TTD Staff Aset: (${staffName || 'Staff'})` : 'TTD Staff Manajemen Aset belum ada'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                    {receiverSignature ? <CheckCircle size={15} color={T.success} /> : <AlertCircle size={15} color={T.warn} />}
                                                    <span style={{ color: receiverSignature ? T.text : T.warn, fontWeight: receiverSignature ? 600 : 700 }}>
                                                        {receiverSignature ? `TTD Penerima: (${receiverName || 'Penerima'})` : 'TTD Penerima Barang belum ada'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                    {handoverPhoto ? <CheckCircle size={15} color={T.success} /> : <Clock size={15} color={T.slate} />}
                                                    <span style={{ color: handoverPhoto ? T.text : T.slate }}>
                                                        {handoverPhoto ? 'Foto/berkas bukti fisik telah diunggah' : 'Foto bukti fisik belum diunggah (bisa menyusul)'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 2: Verifikasi Barang & Dokumen E-Office */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                            {/* Card Verifikasi Barang */}
                                            <div style={{
                                                background: T.white, borderRadius: 14,
                                                border: `1.5px solid ${T.border}`, padding: 22,
                                                boxShadow: '0 2px 10px rgba(15,31,61,0.03)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${T.creamDk}` }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <ShoppingCart size={16} color="#b45309" />
                                                        </div>
                                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.navy }}>Barang yang Diserahterimakan</div>
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: T.slate }}>
                                                        {req.items.length} Item
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto' }}>
                                                    {req.items.map((item, idx) => (
                                                        <div key={item.id} style={{
                                                            padding: '10px 14px', borderRadius: 8,
                                                            background: T.cream, border: `1px solid ${T.creamDk}`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                                                        }}>
                                                            <div>
                                                                <div style={{ fontSize: 13, fontWeight: 700, color: T.navy }}>
                                                                    {idx + 1}. {item.name}
                                                                </div>
                                                                <div style={{ fontSize: 11, color: T.slate }}>
                                                                    {item.qty} {item.unit} {item.brand ? `· ${item.brand}` : ''} · {item.vendorName || (item.vendorId === 'GUDANG' ? 'Bidang Sarana' : 'Vendor Terpilih')}
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                                <div style={{ fontSize: 12, fontWeight: 700, color: T.navy, fontFamily: "'DM Mono', monospace" }}>
                                                                    Rp {((item.finalPrice || item.estPrice || 0) * item.qty).toLocaleString('id-ID')}
                                                                </div>
                                                                <span style={{
                                                                    display: 'inline-block', fontSize: 10, fontWeight: 700,
                                                                    padding: '2px 6px', borderRadius: 4,
                                                                    background: '#dcfce7', color: '#15803d'
                                                                }}>
                                                                    Siap Diterima
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div style={{
                                                    marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${T.border}`,
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                }}>
                                                    <span style={{ fontSize: 12, color: T.slate, fontWeight: 600 }}>Total Realisasi Nilai:</span>
                                                    <span style={{ fontSize: 14, fontWeight: 800, color: T.navy, fontFamily: "'DM Mono', monospace" }}>
                                                        Rp {req.items.reduce((s, it) => s + (it.qty || 0) * (it.finalPrice || it.estPrice || 0), 0).toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Card Dokumen Resmi BAST */}
                                            <div style={{
                                                background: `linear-gradient(135deg, #f8fafc, #f1f5f9)`,
                                                borderRadius: 14, border: `1.5px solid #cbd5e1`,
                                                padding: 20, display: 'flex', flexDirection: 'column', gap: 10
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: T.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <FileText size={15} color={T.gold} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: T.navy }}>Dokumen BAST Resmi</div>
                                                        <div style={{ fontSize: 11, color: T.slate }}>Pratinjau, cetak langsung, atau kelola di E-Office</div>
                                                    </div>
                                                </div>
                                                <p style={{ fontSize: 11.5, color: '#475569', margin: '2px 0 6px', lineHeight: 1.5 }}>
                                                    Dokumen Berita Acara Serah Terima (BAST) otomatis memuat rincian barang, tanggal serah terima, dan tanda tangan sah kedua belah pihak.
                                                </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    <Btn
                                                        variant="primary"
                                                        style={{ width: '100%', justifyContent: 'center', fontSize: 12.5 }}
                                                        onClick={handleOpenBastDocModal}
                                                    >
                                                        <Printer size={14} /> Lihat &amp; Cetak Dokumen BAST Resmi
                                                    </Btn>
                                                    <Btn
                                                        variant="ghost"
                                                        style={{ width: '100%', justifyContent: 'center', background: T.white, borderColor: '#cbd5e1', fontSize: 12 }}
                                                        onClick={() => {
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
                                                                    subject: `BAST Pengadaan: ${req.title || req.code}`,
                                                                    party1Name: staffName || 'Staff Manajemen Aset',
                                                                    party1Title: 'Pemberi',
                                                                    party2Name: receiverName || req.user?.name || req.user?.username || 'Penerima Barang',
                                                                    party2Title: 'Penerima',
                                                                    bastItems
                                                                }
                                                            });
                                                        }}
                                                    >
                                                        <QrCode size={14} /> Terbitkan / Kelola di E-Office
                                                    </Btn>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ─── AREA TANDA TANGAN DIGITAL BAST ─── */}
                                    <div style={{
                                        background: T.white, borderRadius: 14,
                                        border: `1.5px solid ${T.border}`, padding: '24px 26px',
                                        boxShadow: '0 2px 12px rgba(15,31,61,0.04)',
                                        display: 'flex', flexDirection: 'column', gap: 18
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 14, borderBottom: `1px solid ${T.creamDk}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <PenTool size={18} color="#b45309" />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: T.navy }}>Tanda Tangan Berita Acara (BAST)</div>
                                                    <div style={{ fontSize: 11.5, color: T.slate }}>
                                                        Tanda tangan digital antara Staff Manajemen Aset dan Penerima Barang (nama penerima dapat diganti/disesuaikan jika diwakilkan)
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <Btn
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={handleOpenBastDocModal}
                                                    style={{ fontSize: 12, padding: '7px 14px' }}
                                                >
                                                    <Printer size={14} /> Pratinjau Dokumen BAST
                                                </Btn>
                                                <Btn
                                                    type="button"
                                                    variant="secondary"
                                                    disabled={isSavingSignatures || !(isAdmin || isAssignedToAny || isRequester)}
                                                    onClick={handleSaveSignaturesOnly}
                                                    style={{ fontSize: 12, padding: '7px 14px' }}
                                                >
                                                    {isSavingSignatures ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                                    Simpan TTD
                                                </Btn>
                                            </div>
                                        </div>

                                        {/* 2 Kolom: Pihak Pertama (Staff Aset) & Pihak Kedua (Penerima) */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                                            {/* KARTU 1: PIHAK PERTAMA (STAFF MANAJEMEN ASET) */}
                                            <div style={{
                                                background: T.cream, borderRadius: 12,
                                                border: `1.5px solid ${staffSignature ? '#a3d9c0' : T.border}`,
                                                padding: 18, display: 'flex', flexDirection: 'column', gap: 12
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.navy }}>
                                                        Pihak Pertama (Yang Menyerahkan)
                                                    </span>
                                                    <span style={{
                                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                                                        background: staffSignature ? '#dcfce7' : '#fef3c7',
                                                        color: staffSignature ? '#15803d' : '#b45309',
                                                        display: 'flex', alignItems: 'center', gap: 4
                                                    }}>
                                                        {staffSignature ? <Check size={11} /> : <Clock size={11} />}
                                                        {staffSignature ? 'Sudah TTD' : 'Belum TTD'}
                                                    </span>
                                                </div>

                                                <div>
                                                    <Label style={{ marginBottom: 4 }}>Nama Staff Manajemen Aset</Label>
                                                    <Input
                                                        value={staffName}
                                                        onChange={e => setStaffName(e.target.value)}
                                                        placeholder="Nama Staff Manajemen Aset..."
                                                        disabled={req.status === 'COMPLETED' && !(isAdmin || isAssignedToAny)}
                                                    />
                                                    <span style={{ fontSize: 10.5, color: T.slate, marginTop: 4, display: 'block' }}>
                                                        Jabatan: Staff Manajemen Aset / Sarana Prasarana
                                                    </span>
                                                </div>

                                                {/* Kotak Tanda Tangan Staff */}
                                                <div>
                                                    <Label style={{ marginBottom: 6 }}>Goresan Tanda Tangan Staff</Label>
                                                    {staffSignature ? (
                                                        <div style={{
                                                            background: T.white, borderRadius: 10,
                                                            border: '1.5px solid #a3d9c0', padding: 12,
                                                            textAlign: 'center', position: 'relative'
                                                        }}>
                                                            <img
                                                                src={staffSignature}
                                                                alt="TTD Staff"
                                                                style={{ maxHeight: 110, maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }}
                                                            />
                                                            <div style={{ borderTop: `1px solid ${T.creamDk}`, marginTop: 8, paddingTop: 6, fontSize: 12, fontWeight: 700, color: T.navy }}>
                                                                {staffName || 'Staff Manajemen Aset'}
                                                            </div>
                                                            {(req.status !== 'COMPLETED' || (isAdmin || isAssignedToAny)) && (
                                                                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSigModal({ open: true, type: 'STAFF', title: 'Tanda Tangan Staff Manajemen Aset' })}
                                                                        style={{
                                                                            background: 'none', border: `1px solid ${T.border}`, borderRadius: 6,
                                                                            padding: '4px 10px', fontSize: 11, fontWeight: 600, color: T.navy, cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        Ubah TTD
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setStaffSignature(null)}
                                                                        style={{
                                                                            background: 'none', border: 'none', fontSize: 11,
                                                                            color: T.danger, cursor: 'pointer', padding: '4px 8px'
                                                                        }}
                                                                    >
                                                                        Hapus
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{
                                                            border: `2px dashed ${T.border}`, borderRadius: 10,
                                                            padding: '20px 16px', textAlign: 'center', background: T.white
                                                        }}>
                                                            <PenTool size={26} color={T.slate} style={{ margin: '0 auto 6px', opacity: 0.7 }} />
                                                            <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 8 }}>
                                                                Belum ada tanda tangan Staff Manajemen Aset
                                                            </div>
                                                            <Btn
                                                                type="button"
                                                                variant="secondary"
                                                                style={{ margin: '0 auto', fontSize: 12, padding: '5px 12px' }}
                                                                disabled={req.status === 'COMPLETED' && !(isAdmin || isAssignedToAny)}
                                                                onClick={() => setSigModal({ open: true, type: 'STAFF', title: 'Tanda Tangan Staff Manajemen Aset' })}
                                                            >
                                                                <PenTool size={12} /> Goreskan TTD Staff
                                                            </Btn>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* KARTU 2: PIHAK KEDUA (PENERIMA BARANG) */}
                                            <div style={{
                                                background: T.cream, borderRadius: 12,
                                                border: `1.5px solid ${receiverSignature ? '#a3d9c0' : T.border}`,
                                                padding: 18, display: 'flex', flexDirection: 'column', gap: 12
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.navy }}>
                                                        Pihak Kedua (Yang Menerima)
                                                    </span>
                                                    <span style={{
                                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                                                        background: receiverSignature ? '#dcfce7' : '#fef3c7',
                                                        color: receiverSignature ? '#15803d' : '#b45309',
                                                        display: 'flex', alignItems: 'center', gap: 4
                                                    }}>
                                                        {receiverSignature ? <Check size={11} /> : <Clock size={11} />}
                                                        {receiverSignature ? 'Sudah TTD' : 'Belum TTD'}
                                                    </span>
                                                </div>

                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                        <Label style={{ marginBottom: 0 }}>Nama Penerima Barang *</Label>
                                                        {req?.user?.name && receiverName !== req.user.name && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setReceiverName(req.user.name || req.user.username)}
                                                                style={{
                                                                    background: 'none', border: 'none', color: T.gold,
                                                                    fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0
                                                                }}
                                                                title="Kembalikan ke nama pemohon asli"
                                                            >
                                                                Gunakan Pemohon ({req.user.name})
                                                            </button>
                                                        )}
                                                    </div>
                                                    <Input
                                                        value={receiverName}
                                                        onChange={e => setReceiverName(e.target.value)}
                                                        placeholder="Nama lengkap penerima barang (bisa diganti jika diwakilkan)..."
                                                        disabled={req.status === 'COMPLETED' && !(isAdmin || isAssignedToAny || isRequester)}
                                                    />
                                                    <span style={{ fontSize: 10.5, color: T.slate, marginTop: 4, display: 'block' }}>
                                                        Unit: {req?.unit?.name || 'Unit Pemohon'} · Diambil dari nama user pemohon, bisa diubah jika diwakilkan
                                                    </span>
                                                </div>

                                                {/* Kotak Tanda Tangan Penerima */}
                                                <div>
                                                    <Label style={{ marginBottom: 6 }}>Goresan Tanda Tangan Penerima</Label>
                                                    {receiverSignature ? (
                                                        <div style={{
                                                            background: T.white, borderRadius: 10,
                                                            border: '1.5px solid #a3d9c0', padding: 12,
                                                            textAlign: 'center', position: 'relative'
                                                        }}>
                                                            <img
                                                                src={receiverSignature}
                                                                alt="TTD Penerima"
                                                                style={{ maxHeight: 110, maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }}
                                                            />
                                                            <div style={{ borderTop: `1px solid ${T.creamDk}`, marginTop: 8, paddingTop: 6, fontSize: 12, fontWeight: 700, color: T.navy }}>
                                                                {receiverName || req?.user?.name || req?.user?.username || 'Penerima Barang'}
                                                            </div>
                                                            {(req.status !== 'COMPLETED' || (isAdmin || isAssignedToAny || isRequester)) && (
                                                                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSigModal({ open: true, type: 'RECEIVER', title: 'Tanda Tangan Penerima Barang' })}
                                                                        style={{
                                                                            background: 'none', border: `1px solid ${T.border}`, borderRadius: 6,
                                                                            padding: '4px 10px', fontSize: 11, fontWeight: 600, color: T.navy, cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        Ubah TTD
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setReceiverSignature(null)}
                                                                        style={{
                                                                            background: 'none', border: 'none', fontSize: 11,
                                                                            color: T.danger, cursor: 'pointer', padding: '4px 8px'
                                                                        }}
                                                                    >
                                                                        Hapus
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{
                                                            border: `2px dashed ${T.border}`, borderRadius: 10,
                                                            padding: '20px 16px', textAlign: 'center', background: T.white
                                                        }}>
                                                            <PenTool size={26} color={T.slate} style={{ margin: '0 auto 6px', opacity: 0.7 }} />
                                                            <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 8 }}>
                                                                Belum ada tanda tangan Penerima Barang
                                                            </div>
                                                            <Btn
                                                                type="button"
                                                                variant="secondary"
                                                                style={{ margin: '0 auto', fontSize: 12, padding: '5px 12px' }}
                                                                disabled={req.status === 'COMPLETED' && !(isAdmin || isAssignedToAny || isRequester)}
                                                                onClick={() => setSigModal({ open: true, type: 'RECEIVER', title: 'Tanda Tangan Penerima Barang' })}
                                                            >
                                                                <PenTool size={12} /> Goreskan TTD Penerima
                                                            </Btn>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Banner to Step 6 */}
                                    <div style={{
                                        marginTop: 8, padding: '18px 24px', borderRadius: 14,
                                        background: `linear-gradient(135deg, ${T.navy}, ${T.navyMid})`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        flexWrap: 'wrap', gap: 14, color: T.white,
                                        boxShadow: '0 4px 16px rgba(15,31,61,0.18)'
                                    }}>
                                        <div style={{ flex: '1 1 300px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <Sparkles size={16} color={T.gold} />
                                                <span style={{ fontWeight: 700, fontSize: 14, color: T.white }}>
                                                    {req.type === 'ASSET' ? 'Lanjut ke Tahap 6: Pemilihan Ruangan' : 'Selesaikan Pengadaan'}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>
                                                {req.type === 'ASSET'
                                                    ? 'Setelah tanggal BAST diverifikasi, tentukan lokasi penempatan ruangan, PIC, dan kode inventaris untuk masing-masing unit aset.'
                                                    : 'Barang non-aset/jasa tidak dialokasikan ke ruangan. Anda dapat langsung menyelesaikan pengadaan ini.'}
                                            </p>
                                        </div>

                                        {req.type === 'ASSET' ? (
                                            <Btn
                                                variant="gold"
                                                style={{ padding: '12px 24px', fontSize: 13.5, flexShrink: 0 }}
                                                onClick={() => {
                                                    if (!bastDate) return alert('Pilih tanggal serah terima (BAST) terlebih dahulu');
                                                    setActiveTab(6);
                                                }}
                                            >
                                                Lanjut ke Pemilihan Ruangan <ChevronRight size={16} />
                                            </Btn>
                                        ) : (
                                            <Btn
                                                variant="success"
                                                style={{ padding: '12px 24px', fontSize: 13.5, flexShrink: 0 }}
                                                onClick={handleBAST}
                                                disabled={loading}
                                            >
                                                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                                Selesaikan Pengadaan (BAST)
                                            </Btn>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* COMPLETED STATE IN STAGE 5 */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div style={{
                                        background: T.successBg, borderRadius: 14,
                                        border: `1px solid #a3d9c0`, padding: '36px 28px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{
                                            width: 60, height: 60, borderRadius: '50%',
                                            background: `linear-gradient(135deg, ${T.success}, #3a9a72)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            margin: '0 auto 14px',
                                            boxShadow: '0 6px 20px rgba(45,122,95,0.25)'
                                        }}>
                                            <CheckCircle size={28} color={T.white} />
                                        </div>
                                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: T.success, margin: '0 0 6px' }}>
                                            Berita Acara Serah Terima Selesai
                                        </h3>
                                        <p style={{ color: '#3a7a5c', fontSize: 13.5, margin: 0 }}>
                                            Proses serah terima fisik barang telah berhasil diverifikasi dan dicatat.
                                        </p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                                        <div style={{ background: T.cream, borderRadius: 12, border: `1px solid ${T.border}`, padding: 20 }}>
                                            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.slate, marginBottom: 12 }}>
                                                Detail Serah Terima
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                    <span style={{ color: T.slate }}>Tanggal BAST</span>
                                                    <span style={{ fontWeight: 700, color: T.navy }}>
                                                        {req.bastDate ? new Date(req.bastDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                    <span style={{ color: T.slate }}>Status</span>
                                                    <StatusBadge status="COMPLETED" />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                    <span style={{ color: T.slate }}>Total Nilai Pengadaan</span>
                                                    <span style={{ fontWeight: 700, color: T.navy, fontFamily: "'DM Mono', monospace" }}>
                                                        Rp {req.items.reduce((s, it) => s + (it.qty || 0) * (it.finalPrice || it.estPrice || 0), 0).toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ background: T.cream, borderRadius: 12, border: `1px solid ${T.border}`, padding: 20 }}>
                                            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.slate, marginBottom: 12 }}>
                                                Bukti Foto / Berkas Serah Terima
                                            </div>
                                            {handoverPhoto ? (
                                                <img
                                                    src={getMediaUrl(handoverPhoto)}
                                                    alt="Bukti BAST"
                                                    style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 8, border: `1px solid ${T.border}` }}
                                                />
                                            ) : (
                                                <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.creamDk, borderRadius: 8, color: T.slate, fontSize: 12, fontStyle: 'italic' }}>
                                                    Tidak ada foto bukti.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Tanda Tangan Sah BAST (Completed) */}
                                    <div style={{
                                        background: T.white, borderRadius: 12,
                                        border: `1.5px solid ${T.border}`, padding: '20px 24px',
                                        boxShadow: '0 2px 10px rgba(15,31,61,0.03)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${T.creamDk}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eef3fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <PenTool size={15} color="#2563eb" />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.navy }}>Tanda Tangan Pengesahan BAST</div>
                                                    <div style={{ fontSize: 11, color: T.slate }}>Tanda tangan digital sah Pihak Pertama (Staff) dan Pihak Kedua (Penerima)</div>
                                                </div>
                                            </div>
                                            {(isAdmin || isAssignedToAny || isRequester) && (
                                                <Btn
                                                    type="button"
                                                    variant="secondary"
                                                    style={{ fontSize: 11, padding: '5px 12px' }}
                                                    onClick={() => setSigModal({ open: true, type: 'STAFF', title: 'Perbarui Tanda Tangan Staff' })}
                                                >
                                                    <PenTool size={12} /> Ubah TTD Staff
                                                </Btn>
                                            )}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                                            {/* Box Staff */}
                                            <div style={{
                                                background: T.cream, borderRadius: 10, border: `1px solid ${T.creamDk}`,
                                                padding: '16px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
                                            }}>
                                                <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: T.slate, marginBottom: 8, letterSpacing: '0.06em' }}>
                                                    PIHAK PERTAMA (STAFF MANAJEMEN ASET)
                                                </span>
                                                <div style={{ height: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                                    {staffSignature ? (
                                                        <img src={staffSignature} alt="TTD Staff" style={{ maxHeight: 75, maxWidth: '85%', objectFit: 'contain' }} />
                                                    ) : (
                                                        <span style={{ fontSize: 11.5, color: T.slate, fontStyle: 'italic' }}>Belum Ditandatangani</span>
                                                    )}
                                                </div>
                                                <div style={{ borderTop: `1px solid ${T.border}`, width: '100%', paddingTop: 8, marginTop: 4 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 800, color: T.navy }}>
                                                        {staffName || 'Staff Manajemen Aset'}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: T.slate }}>Staff Manajemen Aset</div>
                                                </div>
                                                {(isAdmin || isAssignedToAny) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSigModal({ open: true, type: 'STAFF', title: 'Tanda Tangan Staff Manajemen Aset' })}
                                                        style={{ marginTop: 8, background: 'none', border: 'none', color: T.navyMid, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                                    >
                                                        {staffSignature ? 'Ubah TTD Staff' : '+ Bubuhkan TTD Staff'}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Box Penerima */}
                                            <div style={{
                                                background: T.cream, borderRadius: 10, border: `1px solid ${T.creamDk}`,
                                                padding: '16px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                                    <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: T.slate, letterSpacing: '0.06em' }}>
                                                        PIHAK KEDUA (PENERIMA BARANG)
                                                    </span>
                                                </div>
                                                <div style={{ height: 85, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                                    {receiverSignature ? (
                                                        <img src={receiverSignature} alt="TTD Penerima" style={{ maxHeight: 75, maxWidth: '85%', objectFit: 'contain' }} />
                                                    ) : (
                                                        <span style={{ fontSize: 11.5, color: T.slate, fontStyle: 'italic' }}>Belum Ditandatangani</span>
                                                    )}
                                                </div>
                                                <div style={{ borderTop: `1px solid ${T.border}`, width: '100%', paddingTop: 8, marginTop: 4 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 800, color: T.navy }}>
                                                        {receiverName || req.user?.name || req.user?.username || 'Penerima Barang'}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: T.slate }}>{req.unit?.name || 'Unit Pemohon'}</div>
                                                </div>
                                                {(isAdmin || isAssignedToAny || isRequester) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSigModal({ open: true, type: 'RECEIVER', title: 'Tanda Tangan Penerima Barang' })}
                                                        style={{ marginTop: 8, background: 'none', border: 'none', color: T.navyMid, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                                    >
                                                        {receiverSignature ? 'Ubah TTD Penerima' : '+ Bubuhkan TTD Penerima'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        <Btn
                                            variant="gold"
                                            style={{ flex: 1, justifyContent: 'center', minWidth: 220 }}
                                            onClick={handleOpenBastDocModal}
                                        >
                                            <Printer size={15} /> Cetak / Lihat Dokumen BAST Resmi
                                        </Btn>
                                        <Btn
                                            variant="ghost"
                                            style={{ flex: 1, justifyContent: 'center', minWidth: 220 }}
                                            onClick={() => {
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
                                                        subject: `BAST Pengadaan: ${req.title || req.code}`,
                                                        party1Name: staffName || 'Staff Manajemen Aset',
                                                        party1Title: 'Pemberi',
                                                        party2Name: receiverName || req.user?.name || req.user?.username || 'Penerima Barang',
                                                        party2Title: 'Penerima',
                                                        bastItems
                                                    }
                                                });
                                            }}
                                        >
                                            <QrCode size={15} /> Buat Ulang / Kelola di E-Office
                                        </Btn>
                                        {req.type === 'ASSET' && (
                                            <Btn
                                                variant="primary"
                                                style={{ flex: 1, justifyContent: 'center', minWidth: 220 }}
                                                onClick={() => setActiveTab(6)}
                                            >
                                                Lihat Penempatan Ruangan Aset (Tahap 6) <ChevronRight size={15} />
                                            </Btn>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* ════════════════════════════════════════
                STAGE 6 – PEMILIHAN RUANGAN & ALOKASI ASET
            ════════════════════════════════════════ */}
            {activeTab === 6 && req.type === 'ASSET' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <Card>
                        <CardHeader icon={MapPin} title="Tahap 6 — Pemilihan Ruangan &amp; Alokasi Aset">
                            {req.status === 'COMPLETED' ? (
                                <Btn variant="ghost" onClick={() => setActiveTab(5)}>
                                    <ArrowLeft size={14} /> Lihat Berita Acara (BAST)
                                </Btn>
                            ) : (
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <Btn variant="ghost" onClick={() => setActiveTab(5)}>
                                        <ArrowLeft size={14} /> Kembali ke BAST
                                    </Btn>
                                    <Btn
                                        variant="success"
                                        onClick={handleBAST}
                                        disabled={loading || !(isAdmin || isAssignedToAny || isRequester)}
                                    >
                                        {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                        Selesaikan &amp; Buat Aset
                                    </Btn>
                                </div>
                            )}
                        </CardHeader>

                        <div style={{ padding: '24px 28px' }}>
                            {req.status !== 'COMPLETED' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    {/* Notice / Guidance */}
                                    <Notice type="info">
                                        <strong>Alokasi Penempatan Aset:</strong> Tentukan ruangan penempatan dan PIC penanggung jawab untuk setiap aset. Sistem akan secara otomatis menerbitkan nomor kode aset resmi berbasis unit dan kategori, lalu mendaftarkannya ke modul Inventaris Aset.
                                    </Notice>

                                    {/* Status bar: berapa item yang sudah dialokasikan */}
                                    <div style={{
                                        background: T.cream, borderRadius: 12, border: `1px solid ${T.border}`,
                                        padding: '14px 20px', display: 'flex', alignItems: 'center',
                                        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Layers size={16} color={T.gold} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: T.navy }}>Status Alokasi Ruangan</div>
                                                <div style={{ fontSize: 11, color: T.slate }}>
                                                    {(() => {
                                                        const allocatedCount = req.items.filter(it => {
                                                            const det = assetDetails[it.id] || {};
                                                            if (det.allocationType === 'SAME') return !!det.roomId;
                                                            return (det.units || []).length > 0 && (det.units || []).every(u => !!u.roomId);
                                                        }).length;
                                                        return `${allocatedCount} dari ${req.items.length} item telah ditentukan ruangannya`;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSaveDraftAll}
                                            disabled={loading || !(isAdmin || isAssignedToAny || isRequester)}
                                            style={{
                                                padding: '8px 16px', borderRadius: 8,
                                                background: T.white, border: `1.5px solid ${T.border}`,
                                                color: T.navy, fontSize: 12, fontWeight: 700,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                            }}
                                        >
                                            <Save size={14} color={T.gold} /> Simpan Draft Semua Item
                                        </button>
                                    </div>

                                    {/* Items List for Room Allocation */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        {req.items.map((it, idx) => {
                                            const itemDisabled = req.status === 'COMPLETED' || !(isAdmin || isAssignedToItem(it) || isRequester);
                                            const det = assetDetails[it.id] || {};
                                            const updateDet = (field, val) => {
                                                if (itemDisabled) return;
                                                setAssetDetails(p => ({
                                                    ...p,
                                                    [it.id]: { ...p[it.id], [field]: val }
                                                }));
                                            };

                                            const isWarehouseFulfilled = warehouseFulfillments[it.id]?.enabled || 
                                                                         it.vendorId === 'GUDANG' || 
                                                                         it.vendorName === 'Bidang Sarana' || 
                                                                         it.vendorName === 'Gudang Sarpras (Internal)';
                                            const isRoomReady = det.allocationType === 'SAME' ? !!det.roomId : (det.units || []).length > 0 && (det.units || []).every(u => !!u.roomId);

                                            return (
                                                <div key={it.id} style={{
                                                    background: T.white, borderRadius: 14,
                                                    border: `1.5px solid ${isRoomReady ? '#bbf7d0' : T.border}`,
                                                    overflow: 'hidden',
                                                    boxShadow: '0 2px 10px rgba(15,31,61,0.04)',
                                                    transition: 'border-color .2s'
                                                }}>
                                                    {/* Item Header */}
                                                    <div style={{
                                                        padding: '16px 22px', background: isRoomReady ? '#f8fdfa' : T.cream,
                                                        borderBottom: `1px solid ${T.border}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        flexWrap: 'wrap', gap: 12
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <span style={{
                                                                width: 28, height: 28, borderRadius: 8,
                                                                background: isRoomReady ? T.success : T.navy,
                                                                color: T.white, display: 'flex', alignItems: 'center',
                                                                justifyContent: 'center', fontSize: 12, fontWeight: 700
                                                            }}>
                                                                {idx + 1}
                                                            </span>
                                                            <div>
                                                                <div style={{ fontSize: 14, fontWeight: 700, color: T.navy }}>{it.name}</div>
                                                                <div style={{ fontSize: 11.5, color: T.slate }}>
                                                                    {it.spec ? `${it.spec} · ` : ''}{it.qty} {it.unit} · Realisasi: Rp {(it.finalPrice || it.estPrice || 0).toLocaleString('id-ID')}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Status Chip */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            {isWarehouseFulfilled && (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                                    padding: '4px 10px', borderRadius: 12,
                                                                    background: '#eff6ff', color: '#1d4ed8',
                                                                    fontSize: 11, fontWeight: 700
                                                                }}>
                                                                    📦 Dari Gudang
                                                                </span>
                                                            )}
                                                            {isRoomReady ? (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                                    padding: '4px 10px', borderRadius: 12,
                                                                    background: T.successBg, color: T.success,
                                                                    fontSize: 11, fontWeight: 700
                                                                }}>
                                                                    <CheckCircle size={13} /> Ruangan Siap
                                                                </span>
                                                            ) : (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                                    padding: '4px 10px', borderRadius: 12,
                                                                    background: T.warnBg, color: T.warn,
                                                                    fontSize: 11, fontWeight: 700
                                                                }}>
                                                                    <AlertCircle size={13} /> Belum Pilih Ruangan
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
                                                        {/* Warehouse fulfillment info banner in Stage 6 */}
                                                        {isWarehouseFulfilled && (
                                                            <div style={{
                                                                padding: '12px 16px', borderRadius: 10,
                                                                background: '#edf7f2', border: '1px solid #a3d9c0',
                                                                display: 'flex', alignItems: 'center', gap: 10
                                                            }}>
                                                                <div style={{
                                                                    width: 28, height: 28, borderRadius: 8,
                                                                    background: T.success, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    flexShrink: 0
                                                                }}>
                                                                    <Package size={15} color="#fff" />
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#166534' }}>
                                                                        Dipenuhi dari Stok Gudang ({warehouseFulfillments[it.id]?.quantity || it.qty} {it.unit})
                                                                    </div>
                                                                    <div style={{ fontSize: 11, color: '#15803d' }}>
                                                                        Barang telah dialokasikan dari stok gudang di Tahap 4. Silakan tentukan ruangan penempatan di bawah ini:
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                                                                    {/* Kategori Aset */}
                                                                    <div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                                            <Label style={{ marginBottom: 0 }}>Kategori Aset *</Label>
                                                                            {(det.categoryId || it.categoryId) && (
                                                                                <span style={{ fontSize: 10, color: T.gold, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                                                    <CheckCircle size={11} /> Terpilih
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <Select
                                                                            disabled={itemDisabled}
                                                                            value={det.categoryId || it.categoryId || ''}
                                                                            onChange={e => {
                                                                                const newCat = e.target.value;
                                                                                updateDet('categoryId', newCat);
                                                                                setReq(prev => ({
                                                                                    ...prev,
                                                                                    items: prev.items.map(itItem => itItem.id === it.id ? { ...itItem, categoryId: newCat ? parseInt(newCat) : null } : itItem)
                                                                                }));
                                                                            }}
                                                                        >
                                                                            <option value="">— Pilih Kategori Aset —</option>
                                                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                                        </Select>
                                                                        {(det.categoryId || it.categoryId) && (
                                                                            <div style={{
                                                                                marginTop: 6, fontSize: 10, color: T.gold,
                                                                                fontWeight: 700, fontFamily: "'DM Mono', monospace",
                                                                                background: T.cream, padding: '3px 8px', borderRadius: 6,
                                                                                border: `1px solid ${T.creamDk}`, display: 'inline-block'
                                                                            }}>
                                                                                KODE: {getPreviewCode(det.categoryId || it.categoryId)}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Kondisi Awal */}
                                                                    <div>
                                                                        <Label>Kondisi Awal Fisik</Label>
                                                                        <Select
                                                                            disabled={itemDisabled}
                                                                            value={det.condition || 'BAIK'}
                                                                            onChange={e => updateDet('condition', e.target.value)}
                                                                        >
                                                                            <option value="BAIK">Baik (Siap Pakai)</option>
                                                                            <option value="RUSAK_RINGAN">Rusak Ringan</option>
                                                                            <option value="RUSAK_BERAT">Rusak Berat</option>
                                                                        </Select>
                                                                    </div>
                                                                </div>

                                                                {/* Metode Alokasi Ruangan (if qty > 1) */}
                                                                {it.qty > 1 && (
                                                                    <div>
                                                                        <Label>Metode Penempatan Ruangan ({it.qty} {it.unit})</Label>
                                                                        <div style={{ display: 'flex', gap: 10, maxWidth: 440 }}>
                                                                            {[
                                                                                ['SAME', 'Sama untuk Semua Unit'],
                                                                                ['INDIVIDUAL', 'Berbeda per Unit (Distribusi Pecah)']
                                                                            ].map(([val, label]) => (
                                                                                <button
                                                                                    key={val}
                                                                                    type="button"
                                                                                    disabled={itemDisabled}
                                                                                    onClick={() => updateDet('allocationType', val)}
                                                                                    style={{
                                                                                        flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                                                                                        border: `1.5px solid ${det.allocationType === val ? T.navy : T.border}`,
                                                                                        background: det.allocationType === val ? T.navy : (itemDisabled ? T.creamDk : T.white),
                                                                                        color: det.allocationType === val ? T.white : T.slate,
                                                                                        cursor: itemDisabled ? 'not-allowed' : 'pointer',
                                                                                        transition: 'all .2s'
                                                                                    }}
                                                                                >
                                                                                    {label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* SAME ALLOCATION MODE */}
                                                                {det.allocationType === 'SAME' ? (
                                                                    <div style={{
                                                                        background: '#f8fafc', padding: 18,
                                                                        borderRadius: 12, border: '1.5px solid #e2e8f0',
                                                                        display: 'flex', flexDirection: 'column', gap: 14
                                                                    }}>
                                                                        {/* Pill Switch: Unit Pemohon vs Titip di Unit Lain */}
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                                                            <Label style={{ marginBottom: 0, color: '#1e293b' }}>Lokasi Penempatan Ruangan *</Label>
                                                                            <div style={{ display: 'inline-flex', background: '#e2e8f0', borderRadius: 8, padding: 3 }}>
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={itemDisabled}
                                                                                    onClick={() => {
                                                                                        updateDet('isEntrusted', false);
                                                                                        updateDet('targetUnitId', req.unitId);
                                                                                        updateDet('roomId', '');
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none',
                                                                                        background: !det.isEntrusted ? '#fff' : 'transparent',
                                                                                        color: !det.isEntrusted ? T.navy : T.slate,
                                                                                        boxShadow: !det.isEntrusted ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                                                        cursor: itemDisabled ? 'not-allowed' : 'pointer'
                                                                                    }}
                                                                                >
                                                                                    🏢 Unit Pemohon ({req.unit?.name || 'Unit Ini'})
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={itemDisabled}
                                                                                    onClick={() => {
                                                                                        updateDet('isEntrusted', true);
                                                                                        updateDet('roomId', '');
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none',
                                                                                        background: det.isEntrusted ? T.warn : 'transparent',
                                                                                        color: det.isEntrusted ? '#fff' : T.slate,
                                                                                        boxShadow: det.isEntrusted ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                                                                                        cursor: itemDisabled ? 'not-allowed' : 'pointer'
                                                                                    }}
                                                                                >
                                                                                    🔄 Titip di Unit Lain
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        {/* Target Unit Dropdown (if entrusted) */}
                                                                        {det.isEntrusted && (
                                                                            <div>
                                                                                <Label>Pilih Unit Tujuan Penitipan *</Label>
                                                                                <Select
                                                                                    disabled={itemDisabled}
                                                                                    value={det.targetUnitId || ''}
                                                                                    onChange={e => {
                                                                                        updateDet('targetUnitId', parseInt(e.target.value));
                                                                                        updateDet('roomId', '');
                                                                                    }}
                                                                                    style={{ background: '#fff', border: `1.5px solid ${T.warn}` }}
                                                                                >
                                                                                    <option value="">— Pilih Unit Lain —</option>
                                                                                    {units.filter(u => u.id !== req.unitId).map(u => (
                                                                                        <option key={u.id} value={u.id}>
                                                                                            {u.name} ({u.code})
                                                                                        </option>
                                                                                    ))}
                                                                                </Select>
                                                                            </div>
                                                                        )}

                                                                        {/* Filtered Rooms Dropdown */}
                                                                        {(() => {
                                                                            const activeUnitId = det.targetUnitId || req.unitId;
                                                                            const availableRooms = allRooms.filter(r => r.unitId === activeUnitId);
                                                                            const activeUnitName = units.find(u => u.id === activeUnitId)?.name || (activeUnitId === req.unitId ? req.unit?.name : 'Unit Terpilih');

                                                                            return (
                                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                                                                                    <div>
                                                                                        <Label>Pilih Ruangan di {activeUnitName} *</Label>
                                                                                        <Select
                                                                                            disabled={itemDisabled}
                                                                                            value={det.roomId || ''}
                                                                                            onChange={e => updateDet('roomId', e.target.value)}
                                                                                            style={{
                                                                                                background: '#fff',
                                                                                                borderColor: det.roomId ? '#86efac' : T.border
                                                                                            }}
                                                                                        >
                                                                                            <option value="">— Pilih Ruangan —</option>
                                                                                            {availableRooms.map(r => (
                                                                                                <option key={r.id} value={r.id}>
                                                                                                    {r.name} {r.building ? `— ${r.building}` : ''} {r.floor ? `(Lt. ${r.floor})` : ''}
                                                                                                </option>
                                                                                            ))}
                                                                                        </Select>
                                                                                        {availableRooms.length === 0 && (
                                                                                            <div style={{ marginTop: 6, fontSize: 11, color: T.warn, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                                                <AlertCircle size={12} />
                                                                                                Belum ada data ruangan terdaftar untuk <b>{activeUnitName}</b> di Master Data.
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* PIC Selection */}
                                                                                    <div>
                                                                                        <Label>Penanggung Jawab / PIC Ruangan</Label>
                                                                                        <Select
                                                                                            disabled={itemDisabled}
                                                                                            value={det.picId || ''}
                                                                                            onChange={e => updateDet('picId', e.target.value)}
                                                                                            style={{ background: '#fff' }}
                                                                                        >
                                                                                            <option value="">— Tidak Ada / Umum —</option>
                                                                                            {users.map(u => (
                                                                                                <option key={u.id} value={u.id}>{u.name}</option>
                                                                                            ))}
                                                                                        </Select>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })()}

                                                                        {/* Foto Aset (SAME ALLOCATION) */}
                                                                        <div>
                                                                            <AssetImageUpload
                                                                                disabled={itemDisabled}
                                                                                value={det.image}
                                                                                onChange={val => updateDet('image', val)}
                                                                                label="Foto Aset Fisik (Sama untuk semua unit item ini)"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* INDIVIDUAL ALLOCATION MODE */
                                                                    <div style={{
                                                                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                                                        gap: 14, background: T.cream, padding: 16, borderRadius: 12
                                                                    }}>
                                                                        {det.units.map((u, uIdx) => {
                                                                            const updateUnit = (field, val) => {
                                                                                if (itemDisabled) return;
                                                                                const nextUnits = [...det.units];
                                                                                nextUnits[uIdx] = { ...nextUnits[uIdx], [field]: val };
                                                                                updateDet('units', nextUnits);
                                                                            };
                                                                            const activeUnitId = u.targetUnitId || req.unitId;
                                                                            const availableRooms = allRooms.filter(r => r.unitId === activeUnitId);
                                                                            const activeUnitName = units.find(u => u.id === activeUnitId)?.name || (activeUnitId === req.unitId ? req.unit?.name : 'Unit Terpilih');

                                                                            return (
                                                                                <div key={uIdx} style={{
                                                                                    background: T.white, padding: 14, borderRadius: 10,
                                                                                    border: `1px solid ${u.roomId ? '#86efac' : T.border}`,
                                                                                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
                                                                                }}>
                                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                                                        <Label style={{ fontWeight: 800, marginBottom: 0, color: T.navy }}>Unit #{uIdx + 1}</Label>
                                                                                        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 6, padding: 1 }}>
                                                                                            <button
                                                                                                type="button"
                                                                                                disabled={itemDisabled}
                                                                                                onClick={() => {
                                                                                                    updateUnit('isEntrusted', false);
                                                                                                    updateUnit('targetUnitId', req.unitId);
                                                                                                    updateUnit('roomId', '');
                                                                                                }}
                                                                                                style={{
                                                                                                    padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 5, border: 'none',
                                                                                                    background: !u.isEntrusted ? '#fff' : 'transparent',
                                                                                                    color: !u.isEntrusted ? T.navy : T.slate,
                                                                                                    cursor: itemDisabled ? 'not-allowed' : 'pointer'
                                                                                                }}
                                                                                            >
                                                                                                Sendiri
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                disabled={itemDisabled}
                                                                                                onClick={() => {
                                                                                                    updateUnit('isEntrusted', true);
                                                                                                    updateUnit('roomId', '');
                                                                                                }}
                                                                                                style={{
                                                                                                    padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 5, border: 'none',
                                                                                                    background: u.isEntrusted ? T.warn : 'transparent',
                                                                                                    color: u.isEntrusted ? '#fff' : T.slate,
                                                                                                    cursor: itemDisabled ? 'not-allowed' : 'pointer'
                                                                                                }}
                                                                                            >
                                                                                                Titip
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>

                                                                                    {u.isEntrusted && (
                                                                                        <div style={{ marginBottom: 8 }}>
                                                                                            <Select
                                                                                                disabled={itemDisabled}
                                                                                                value={u.targetUnitId || ''}
                                                                                                onChange={e => {
                                                                                                    updateUnit('targetUnitId', parseInt(e.target.value));
                                                                                                    updateUnit('roomId', '');
                                                                                                }}
                                                                                                style={{ fontSize: 11, padding: '6px 8px', border: `1px solid ${T.warn}` }}
                                                                                            >
                                                                                                <option value="">— Pilih Unit —</option>
                                                                                                {units.filter(un => un.id !== req.unitId).map(un => (
                                                                                                    <option key={un.id} value={un.id}>{un.name}</option>
                                                                                                ))}
                                                                                            </Select>
                                                                                        </div>
                                                                                    )}

                                                                                    <Select
                                                                                        disabled={itemDisabled}
                                                                                        value={u.roomId || ''}
                                                                                        onChange={e => updateUnit('roomId', e.target.value)}
                                                                                        style={{ fontSize: 11, padding: '7px 10px', marginBottom: 10, borderColor: u.roomId ? '#86efac' : T.border }}
                                                                                    >
                                                                                        <option value="">— Pilih Ruangan ({activeUnitName}) —</option>
                                                                                        {availableRooms.map(r => (
                                                                                            <option key={r.id} value={r.id}>
                                                                                                {r.name} {r.building ? `— ${r.building}` : ''}
                                                                                            </option>
                                                                                        ))}
                                                                                    </Select>

                                                                                    <AssetImageUpload
                                                                                        disabled={itemDisabled}
                                                                                        value={u.image}
                                                                                        onChange={val => updateUnit('image', val)}
                                                                                        label={`Foto Unit #${uIdx + 1}`}
                                                                                    />
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                                {/* Advanced Settings: Lendable & Routine Maintenance */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                                                                    <div style={{
                                                                        display: 'flex', alignItems: 'center', gap: 10,
                                                                        background: T.cream, padding: '12px 16px', borderRadius: 10,
                                                                        border: `1px solid ${T.creamDk}`
                                                                    }}>
                                                                        <input
                                                                            type="checkbox"
                                                                            disabled={itemDisabled}
                                                                            id={`lendable-${it.id}`}
                                                                            checked={det.isLendable || false}
                                                                            onChange={e => updateDet('isLendable', e.target.checked)}
                                                                            style={{ cursor: itemDisabled ? 'not-allowed' : 'pointer', width: 16, height: 16 }}
                                                                        />
                                                                        <label htmlFor={`lendable-${it.id}`} style={{ fontSize: 12, fontWeight: 600, color: T.text, cursor: itemDisabled ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                                                                            Aset ini dapat dipinjam oleh unit lain
                                                                        </label>
                                                                    </div>

                                                                    <div style={{
                                                                        background: '#eef3fc', padding: '12px 16px',
                                                                        borderRadius: 10, border: '1px solid #bfd0f5'
                                                                    }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: det.needsRoutineMaintenance ? 10 : 0 }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: det.needsRoutineMaintenance ? '#2c5fc4' : T.border }} />
                                                                                <label htmlFor={`maint-${it.id}`} style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', cursor: itemDisabled ? 'not-allowed' : 'pointer' }}>
                                                                                    Perlu Pemeliharaan Rutin?
                                                                                </label>
                                                                            </div>
                                                                            <input
                                                                                type="checkbox"
                                                                                disabled={itemDisabled}
                                                                                id={`maint-${it.id}`}
                                                                                checked={det.needsRoutineMaintenance || false}
                                                                                onChange={e => updateDet('needsRoutineMaintenance', e.target.checked)}
                                                                                style={{ cursor: itemDisabled ? 'not-allowed' : 'pointer', width: 16, height: 16 }}
                                                                            />
                                                                        </div>
                                                                        {det.needsRoutineMaintenance && (
                                                                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                                                <div style={{ flex: 1 }}>
                                                                                    <Label>Interval</Label>
                                                                                    <Input
                                                                                        type="number"
                                                                                        disabled={itemDisabled}
                                                                                        value={det.maintenanceInterval || 3}
                                                                                        onChange={e => updateDet('maintenanceInterval', e.target.value)}
                                                                                        style={{ padding: '6px 10px', fontSize: 12 }}
                                                                                    />
                                                                                </div>
                                                                                <div style={{ flex: 1 }}>
                                                                                    <Label>Satuan</Label>
                                                                                    <Select
                                                                                        disabled={itemDisabled}
                                                                                        value={det.intervalUnit || 'MONTHS'}
                                                                                        onChange={e => updateDet('intervalUnit', e.target.value)}
                                                                                        style={{ padding: '6px 10px', fontSize: 12 }}
                                                                                    >
                                                                                        <option value="MONTHS">Bulan</option>
                                                                                        <option value="DAYS">Hari</option>
                                                                                    </Select>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Item Draft Save */}
                                                                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: `1px dashed ${T.creamDk}` }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSaveDraftItem(it.id)}
                                                                        disabled={itemDisabled}
                                                                        style={{
                                                                            padding: '8px 14px', borderRadius: 8,
                                                                            background: itemDisabled ? T.creamDk : T.goldSoft,
                                                                            color: itemDisabled ? T.slate : T.warn,
                                                                            fontWeight: 700, border: 'none',
                                                                            cursor: itemDisabled ? 'not-allowed' : 'pointer',
                                                                            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12
                                                                        }}
                                                                    >
                                                                        <Save size={14} /> Simpan Draft Item Ini
                                                                    </button>
                                                                </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Bottom Sticky Action Bar */}
                                    <div style={{
                                        position: 'sticky', bottom: 16, zIndex: 10,
                                        background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
                                        border: `1.5px solid ${T.border}`, borderRadius: 16,
                                        padding: '16px 24px', boxShadow: '0 8px 30px rgba(15,31,61,0.12)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        flexWrap: 'wrap', gap: 14
                                    }}>
                                        <Btn variant="ghost" onClick={() => setActiveTab(5)} style={{ padding: '12px 20px' }}>
                                            <ArrowLeft size={16} /> Kembali ke Tahap BAST
                                        </Btn>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <Btn
                                                variant="ghost"
                                                onClick={handleSaveDraftAll}
                                                disabled={loading || !(isAdmin || isAssignedToAny || isRequester)}
                                                style={{ padding: '12px 18px', borderColor: T.gold, color: T.warn }}
                                            >
                                                <Save size={16} color={T.gold} /> Simpan Draft Semua
                                            </Btn>
                                            <Btn
                                                variant="success"
                                                onClick={handleBAST}
                                                disabled={loading || !(isAdmin || isAssignedToAny || isRequester)}
                                                style={{ padding: '12px 28px', fontSize: 14, fontWeight: 700 }}
                                            >
                                                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                                Selesaikan Pengadaan &amp; Daftarkan Aset
                                            </Btn>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* COMPLETED STATE IN STAGE 6 */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div style={{
                                        background: T.cream, borderRadius: 14,
                                        border: `1px solid ${T.border}`, padding: '28px',
                                        display: 'flex', flexDirection: 'column', gap: 16
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: T.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <CheckCircle size={20} color={T.white} />
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.navy }}>
                                                    Aset Telah Berhasil Ditempatkan ke Ruangan
                                                </h4>
                                                <p style={{ margin: 0, fontSize: 12, color: T.slate }}>
                                                    Seluruh aset dari pengadaan ini telah terdaftar di sistem inventaris dengan kode aset resmi.
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: T.white, borderBottom: `1px solid ${T.border}` }}>
                                                        {['No', 'Nama Barang', 'Jumlah', 'Unit Tujuan', 'Status Alokasi'].map(h => (
                                                            <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: T.slate, textAlign: 'left', textTransform: 'uppercase' }}>
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {req.items.map((it, idx) => (
                                                        <tr key={it.id} style={{ borderBottom: `1px solid ${T.creamDk}` }}>
                                                            <td style={{ padding: '12px 14px', fontSize: 12, color: T.slate }}>{idx + 1}</td>
                                                            <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: T.navy }}>{it.name}</td>
                                                            <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700 }}>{it.qty} {it.unit}</td>
                                                            <td style={{ padding: '12px 14px', fontSize: 12, color: T.navy }}>{req.unit?.name || 'Unit Pemohon'}</td>
                                                            <td style={{ padding: '12px 14px', fontSize: 12 }}>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.success, fontWeight: 700 }}>
                                                                    <CheckCircle size={13} /> Terdaftar di Inventaris
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        <Btn variant="ghost" onClick={() => setActiveTab(5)} style={{ flex: 1, justifyContent: 'center' }}>
                                            <ArrowLeft size={15} /> Lihat Kembali Bukti BAST (Tahap 5)
                                        </Btn>
                                        <Btn variant="primary" onClick={() => navigate('/assets')} style={{ flex: 1, justifyContent: 'center' }}>
                                            <ExternalLink size={15} /> Buka Modul Data Aset (Inventaris)
                                        </Btn>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* Floating Toast Notification when Draft is Saved */}
            {draftSavedToast && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
                    background: T.navy, color: T.white, padding: '12px 20px',
                    borderRadius: 10, boxShadow: '0 6px 20px rgba(15,31,61,0.25)',
                    display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600,
                    animation: 'fadeIn 0.25s ease-out'
                }}>
                    <CheckCircle size={18} color={T.gold} />
                    <span>{draftSavedToast}</span>
                </div>
            )}

            {/* Modal Kirim ke Workshop */}
            {showWorkshopModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(15,31,61,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
                }}>
                    <div style={{
                        background: T.white, borderRadius: 16, width: '100%', maxWidth: 600,
                        maxHeight: '90vh', overflowY: 'auto', padding: 30, position: 'relative'
                    }}>
                        <button onClick={() => setShowWorkshopModal(false)} style={{
                            position: 'absolute', top: 20, right: 20, background: 'none',
                            border: 'none', cursor: 'pointer', color: T.slate
                        }}>
                            <XCircle size={24} />
                        </button>

                        <h2 style={{ fontSize: 20, color: T.navy, marginBottom: 8, fontFamily: "'Playfair Display', serif" }}>
                            Buat Pesanan Workshop
                        </h2>
                        <p style={{ color: T.slate, fontSize: 13, marginBottom: 24 }}>
                            Pilih item dari pengadaan ini untuk dikirimkan sebagai permintaan ke Unit Workshop.
                        </p>

                        <form onSubmit={handleCreateWorkshopOrder} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <Label>Pilih Item</Label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, background: T.cream }}>
                                    {req.items.map((item, idx) => (
                                        <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={!!selectedWorkshopItems[item.id]}
                                                onChange={(e) => setSelectedWorkshopItems(prev => ({ ...prev, [item.id]: e.target.checked }))}
                                                style={{ marginTop: 2 }}
                                            />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: T.navy }}>{item.name}</div>
                                                <div style={{ fontSize: 11, color: T.slate }}>{item.qty} {item.unit} | Rp {(item.estPrice || 0).toLocaleString('id-ID')}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div>
                                    <Label>Prioritas</Label>
                                    <Select value={workshopOrderPriority} onChange={e => setWorkshopOrderPriority(e.target.value)}>
                                        <option value="LOW">Low</option>
                                        <option value="NORMAL">Normal</option>
                                        <option value="HIGH">High</option>
                                        <option value="URGENT">Urgent</option>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Deadline (Opsional)</Label>
                                    <Input type="date" value={workshopOrderDeadline} onChange={e => setWorkshopOrderDeadline(e.target.value)} />
                                </div>
                            </div>

                            <div>
                                <Label>Catatan Tambahan (Opsional)</Label>
                                <Textarea rows={3} value={workshopOrderNotes} onChange={e => setWorkshopOrderNotes(e.target.value)} placeholder="Tambahkan instruksi khusus..." />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
                                <Btn type="button" variant="ghost" onClick={() => setShowWorkshopModal(false)}>Batal</Btn>
                                <Btn type="submit" variant="gold">
                                    Kirim Pesanan
                                </Btn>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                MODAL TANDA TANGAN DIGITAL (CANVAS SIGNATURE PAD)
            ══════════════════════════════════════════════════════════════════ */}
            {sigModal.open && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    background: 'rgba(15,31,61,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 16
                }}>
                    <div style={{ width: '100%', maxWidth: 440 }}>
                        <SignaturePad
                            title={sigModal.title}
                            onCancel={() => setSigModal({ open: false, type: null, title: '' })}
                            onSave={(dataUrl) => {
                                if (sigModal.type === 'STAFF') {
                                    setStaffSignature(dataUrl);
                                } else if (sigModal.type === 'RECEIVER') {
                                    setReceiverSignature(dataUrl);
                                }
                                setSigModal({ open: false, type: null, title: '' });
                            }}
                        />
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                MODAL DOKUMEN CETAK BAST RESMI
            ══════════════════════════════════════════════════════════════════ */}
            {showBastDocModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(15,31,61,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '20px 10px', overflowY: 'auto'
                }}>
                    {/* Action Bar (hidden when printing) */}
                    <div className="no-print" style={{
                        width: '100%', maxWidth: 850,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 16, background: T.white, padding: '12px 20px',
                        borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FileText size={20} color={T.navy} />
                            <span style={{ fontWeight: 800, fontSize: 15, color: T.navy }}>
                                Pratinjau Berita Acara Serah Terima (BAST)
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <Btn
                                variant="primary"
                                onClick={() => window.print()}
                                style={{ padding: '8px 18px', fontSize: 13 }}
                            >
                                <Printer size={15} /> Cetak Dokumen / Simpan PDF
                            </Btn>
                            <Btn
                                variant="ghost"
                                onClick={() => setShowBastDocModal(false)}
                                style={{ padding: '8px 14px', fontSize: 13 }}
                            >
                                <X size={16} /> Tutup
                            </Btn>
                        </div>
                    </div>

                    {/* Printable Paper */}
                    {(() => {
                        const kabidUser = users.find(u =>
                            (u.position && (u.position.toLowerCase().includes('sarana') || u.position.toLowerCase().includes('kabid'))) ||
                            u.role === 'KEPALA_BIDANG' || u.role === 'KABID_SARPRAS'
                        ) || { name: 'Ravi Kurnia', position: 'Kepala Bidang Sarana', nip: '-' };

                        const effectiveBastDate = bastDoc?.date || bastDate || bastSignatures?.bastDate || req.bastDate || req.createdAt;
                        const bastDateParsed = formatIndonesianDate(effectiveBastDate);

                        const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
                        const bastDateObj = new Date(effectiveBastDate);
                        const bastSeq = String(req.id || 1).padStart(3, '0');
                        const bastRomanMonth = romanMonths[bastDateObj.getMonth()] || 'IX';
                        const bastYear = bastDateObj.getFullYear() || 2026;
                        const fallbackBastNumber = `${bastSeq}/BA/SRN/${bastRomanMonth}/${bastYear}`;
                        const displayBastNumber = bastDoc?.number || fallbackBastNumber;
                        const verifyUrl = bastDoc?.uuid ? `https://sarpras.dareliman.or.id/verify/${bastDoc.uuid}` : `https://sarpras.dareliman.or.id/verify/BAST-${req.code}`;

                        return (
                            <div id="bast-print-sheet" style={{
                                width: '100%', maxWidth: 850,
                                background: '#ffffff', color: '#111827',
                                padding: '36px 44px', borderRadius: 4,
                                boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                                fontFamily: "'Times New Roman', Times, serif",
                                lineHeight: 1.5, fontSize: 13
                            }}>
                                {/* Header / Kop Surat dengan 2 Logo: Yayasan & Bidang Sarana (SIMAS Dihilangkan) */}
                                <div style={{ paddingBottom: 10, marginBottom: 16, borderBottom: '3px double #111827' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                                        <div style={{ width: 85, flexShrink: 0, textAlign: 'left' }}>
                                            <img
                                                src="/logo_yayasan.jpg"
                                                alt="Logo Yayasan"
                                                style={{ height: 64, width: 'auto', objectFit: 'contain' }}
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
                                            <div style={{ fontSize: 15.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#065f46', fontFamily: 'sans-serif' }}>
                                                YAYASAN DAR EL-IMAN
                                            </div>
                                            <div style={{ fontSize: 19, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#b45309', fontFamily: 'sans-serif', marginTop: 1 }}>
                                                BIDANG SARANA
                                            </div>
                                            <div style={{ fontSize: 10.5, fontStyle: 'italic', color: '#4b5563', marginTop: 1, fontFamily: "'Times New Roman', serif" }}>
                                                &ldquo;Merawat dengan Ikhlas, Melayani dengan Sunnah&rdquo;
                                            </div>
                                            <div style={{ fontSize: 9.5, color: '#4b5563', fontFamily: 'sans-serif', marginTop: 2, lineHeight: 1.3 }}>
                                                Komplek Islamic Center, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat 25173
                                            </div>
                                            <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'sans-serif' }}>
                                                WA: 0895-3202-42508 • Email: dar.el.imansarpras@gmail.com
                                            </div>
                                        </div>
                                        <div style={{ width: 85, flexShrink: 0, textAlign: 'right' }}>
                                            <img
                                                src="/Sarpras.jpeg"
                                                alt="Logo Sarpras"
                                                style={{ height: 64, width: 'auto', objectFit: 'contain', marginLeft: 'auto' }}
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Document Title & E-Office Number (Perihal Dihilangkan) */}
                                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                                    <div style={{ fontSize: 15, fontWeight: 900, textDecoration: 'underline', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                        BERITA ACARA SERAH TERIMA BARANG (BAST)
                                    </div>
                                    <div style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace', marginTop: 3 }}>
                                        Nomor : {displayBastNumber}
                                    </div>
                                </div>

                                {/* Pembuka (Tanggal disesuaikan dengan awal penandatanganan) */}
                                <p style={{ textIndent: 36, textAlign: 'justify', margin: '0 0 12px' }}>
                                    Pada hari ini, <strong>{bastDateParsed.dayName || '—'}</strong> tanggal <strong>{bastDateParsed.dateNum || '—'}</strong> bulan <strong>{bastDateParsed.monthName || '—'}</strong> tahun <strong>{bastDateParsed.year || '—'}</strong> ({new Date(effectiveBastDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}), kami yang bertanda tangan di bawah ini:
                                </p>

                                {/* Pihak 1 & Pihak 2 List */}
                                <div style={{ marginLeft: 16, marginBottom: 14 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ width: 22, verticalAlign: 'top', fontWeight: 'bold' }}>1.</td>
                                                <td style={{ width: 140, verticalAlign: 'top', fontWeight: 'bold' }}>Nama</td>
                                                <td style={{ width: 12, verticalAlign: 'top' }}>:</td>
                                                <td style={{ verticalAlign: 'top', fontWeight: 'bold' }}>{bastDoc?.party1Name || kabidUser.name || 'Kepala Bidang Sarana'}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td style={{ verticalAlign: 'top' }}>Jabatan</td>
                                                <td style={{ verticalAlign: 'top' }}>:</td>
                                                <td style={{ verticalAlign: 'top' }}>{bastDoc?.party1Title || kabidUser.position || 'Kepala Bidang Sarana'}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td style={{ verticalAlign: 'top' }}>Unit Kerja</td>
                                                <td style={{ verticalAlign: 'top' }}>:</td>
                                                <td style={{ verticalAlign: 'top' }}>{bastDoc?.party1Org || 'Bidang Sarana'}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td colSpan={3} style={{ fontStyle: 'italic', paddingTop: 2, paddingBottom: 8 }}>
                                                    Selanjutnya disebut sebagai <strong>PIHAK PERTAMA</strong> (Yang Menyerahkan).
                                                </td>
                                            </tr>

                                            <tr>
                                                <td style={{ verticalAlign: 'top', fontWeight: 'bold' }}>2.</td>
                                                <td style={{ verticalAlign: 'top', fontWeight: 'bold' }}>Nama</td>
                                                <td style={{ verticalAlign: 'top' }}>:</td>
                                                <td style={{ verticalAlign: 'top', fontWeight: 'bold' }}>{receiverName || req.user?.name || req.user?.username || 'Penerima Barang'}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td style={{ verticalAlign: 'top' }}>Jabatan / Status</td>
                                                <td style={{ verticalAlign: 'top' }}>:</td>
                                                <td style={{ verticalAlign: 'top' }}>Penerima / Pemohon Barang</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td style={{ verticalAlign: 'top' }}>Unit Kerja / Divisi</td>
                                                <td style={{ verticalAlign: 'top' }}>:</td>
                                                <td style={{ verticalAlign: 'top' }}>{req.unit?.name || '—'}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td colSpan={3} style={{ fontStyle: 'italic', paddingTop: 2 }}>
                                                    Selanjutnya disebut sebagai <strong>PIHAK KEDUA</strong> (Yang Menerima).
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <p style={{ textAlign: 'justify', margin: '0 0 12px' }}>
                                    Dengan ini menyatakan bahwa <strong>PIHAK PERTAMA</strong> telah menyerahkan barang pengadaan kepada <strong>PIHAK KEDUA</strong>, dan <strong>PIHAK KEDUA</strong> telah memeriksa serta menerima barang tersebut dalam keadaan baik, lengkap, dan sesuai spesifikasi dengan rincian sebagai berikut:
                                </p>

                                {/* Tabel Rincian Barang */}
                                <table style={{
                                    width: '100%', borderCollapse: 'collapse', marginBottom: 14,
                                    fontSize: 12, border: '1px solid #111827'
                                }}>
                                    <thead>
                                        <tr style={{ background: '#f3f4f6' }}>
                                            <th style={{ border: '1px solid #111827', padding: '5px 8px', width: 34, textAlign: 'center' }}>No</th>
                                            <th style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'left' }}>Nama Barang</th>
                                            <th style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'left' }}>Spesifikasi / Merk</th>
                                            <th style={{ border: '1px solid #111827', padding: '5px 8px', width: 55, textAlign: 'center' }}>Qty</th>
                                            <th style={{ border: '1px solid #111827', padding: '5px 8px', width: 60, textAlign: 'center' }}>Satuan</th>
                                            <th style={{ border: '1px solid #111827', padding: '5px 8px', width: 80, textAlign: 'center' }}>Kondisi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {req.items.map((it, idx) => (
                                            <tr key={it.id}>
                                                <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'center' }}>{idx + 1}</td>
                                                <td style={{ border: '1px solid #111827', padding: '5px 8px', fontWeight: 'bold' }}>{it.name}</td>
                                                <td style={{ border: '1px solid #111827', padding: '5px 8px' }}>
                                                    {it.spec || '—'} {it.brand ? `(${it.brand})` : ''}
                                                </td>
                                                <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'center' }}>{it.qty}</td>
                                                <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'center' }}>{it.unit}</td>
                                                <td style={{ border: '1px solid #111827', padding: '5px 8px', textAlign: 'center', color: '#15803d', fontWeight: 600 }}>Baik</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Penutup */}
                                <p style={{ textIndent: 36, textAlign: 'justify', margin: '0 0 20px' }}>
                                    Demikian Berita Acara Serah Terima (BAST) ini dibuat dan ditandatangani oleh kedua belah pihak dengan sebenar-benarnya tanpa adanya paksaan dari pihak manapun, untuk dapat dipergunakan sebagaimana mestinya.
                                </p>

                                {/* Kolom Tanda Tangan */}
                                <div style={{ pageBreakInside: 'avoid' }}>
                                    <div style={{ textAlign: 'right', fontSize: 12.5, marginBottom: 8 }}>
                                        Padang, {new Date(effectiveBastDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        {/* Pihak Pertama (TTE Elektronik Terverifikasi) */}
                                        <div style={{ width: '48%', textAlign: 'center' }}>
                                            <div style={{ fontWeight: 'bold' }}>PIHAK PERTAMA</div>
                                            <div style={{ fontSize: 11.5, color: '#374151' }}>Yang Menyerahkan,</div>
                                            <div style={{
                                                minHeight: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                margin: '6px 0', padding: '4px 6px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
                                                    <div style={{ padding: 2, background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 4, display: 'inline-block' }}>
                                                        <QRCode
                                                            value={verifyUrl}
                                                            size={64}
                                                            level="M"
                                                        />
                                                    </div>
                                                    <div style={{ textAlign: 'left', fontFamily: 'sans-serif' }}>
                                                        <div style={{ color: '#15803d', fontWeight: 'bold', fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                            <ShieldCheck size={12} color="#16a34a" /> TTE SAH ELEKTRONIK
                                                        </div>
                                                        <div style={{ fontSize: 7.5, color: '#4b5563', lineHeight: 1.2, marginTop: 1 }}>
                                                            Tercatat pada E-Office
                                                        </div>
                                                        <div style={{ fontSize: 7, fontFamily: 'monospace', color: '#6b7280', marginTop: 1 }}>
                                                            UUID: {(bastDoc?.uuid || req.code)?.substring(0, 13)}...
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: 13 }}>
                                                {bastDoc?.party1Name || kabidUser.name || 'Kepala Bidang Sarana'}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#4b5563' }}>
                                                {bastDoc?.party1Title || kabidUser.position || 'Kepala Bidang Sarana'}
                                            </div>
                                            <div style={{ fontSize: 10, color: '#6b7280' }}>
                                                {bastDoc?.party1Org || 'Bidang Sarana'}
                                            </div>
                                        </div>

                                        {/* Pihak Kedua */}
                                        <div style={{ width: '48%', textAlign: 'center' }}>
                                            <div style={{ fontWeight: 'bold' }}>PIHAK KEDUA</div>
                                            <div style={{ fontSize: 11.5, color: '#374151' }}>Yang Menerima,</div>
                                            <div style={{
                                                minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                margin: '6px 0'
                                            }}>
                                                {receiverSignature ? (
                                                    <img src={receiverSignature} alt="TTD Penerima" style={{ maxHeight: 80, maxWidth: '90%', objectFit: 'contain' }} />
                                                ) : (
                                                    <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', borderBottom: '1px dashed #d1d5db', padding: '10px 20px' }}>
                                                        (Belum Ditandatangani)
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: 13 }}>
                                                {receiverName || req.user?.name || req.user?.username || 'Penerima Barang'}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#4b5563' }}>Penerima / Pemohon Barang</div>
                                            <div style={{ fontSize: 10, color: '#6b7280' }}>{req.unit?.name || 'Unit Pemohon'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Procurement Request Letter Modal */}
            {req?.requestLetter && (
                <ProcurementLetterModal
                    isOpen={showRequestLetterModal}
                    onClose={() => setShowRequestLetterModal(false)}
                    letterData={req.requestLetter}
                    isKabidUser={isKabid}
                    onKabidTte={handleKabidTte}
                />
            )}

            {/* Procurement Assignment Order Modal (Surat Perintah Pengadaan) */}
            {selectedAssignmentOrder && (
                <ProcurementAssignmentOrderModal
                    isOpen={showAssignmentOrderModal}
                    onClose={() => setShowAssignmentOrderModal(false)}
                    order={selectedAssignmentOrder}
                    currentUser={user}
                    onOrderUpdated={(updatedOrder) => {
                        setSelectedAssignmentOrder(updatedOrder);
                        setAssignmentOrders(prev => prev.map(o => o.orderId === updatedOrder.orderId ? updatedOrder : o));
                    }}
                />
            )}

            {/* Price Comparison Sheet Modal (Lembar Perbandingan Harga) */}
            <ProcurementPriceComparisonModal
                isOpen={showPriceComparisonModal}
                onClose={() => setShowPriceComparisonModal(false)}
                req={req}
                currentUser={user}
            />

            {/* Purchase Order (PO) Modal (Surat Pesanan Vendor) */}
            <ProcurementPurchaseOrderModal
                isOpen={showPoModal}
                onClose={() => setShowPoModal(false)}
                req={req}
                currentUser={user}
            />

            {/* Print CSS Styles for BAST Modal */}
            {showBastDocModal && (
                <style>{`
                    @media print {
                        body * {
                            visibility: hidden !important;
                        }
                        #bast-print-sheet, #bast-print-sheet * {
                            visibility: visible !important;
                        }
                        #bast-print-sheet {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            padding: 20px 25px !important;
                            box-shadow: none !important;
                            border: none !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                `}</style>
            )}
        </div>
    );
};

export default ProcurementDetail;
