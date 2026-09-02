import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    CheckCircle, XCircle, FileText, Upload, DollarSign, Store,
    ArrowLeft, Plus, Trash2, ShoppingCart, UserCheck, Camera,
    Image, MapPin, ChevronRight, AlertCircle, Package, QrCode,
    MessageSquare, Clock, Save, Send, Loader2
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
        if (step === 1) return ['APPROVED', 'PROCESS', 'COMPLETED'].includes(req.status);
        if (step === 2) return ['PROCESS', 'COMPLETED'].includes(req.status);
        if (step === 3) return ['PROCESS', 'COMPLETED'].includes(req.status);
        if (step === 4) return ['PROCESS', 'COMPLETED'].includes(req.status);
        if (step === 5) return req.status === 'COMPLETED';
        return false;
    };
    const isDisabled = (step) => {
        if (req.status === 'REJECTED' && step >= 2) return true;
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
    const [rooms, setRooms] = useState([]);
    const [allRooms, setAllRooms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [assetDetails, setAssetDetails] = useState({}); // { itemId: { categoryId, roomId, picId, condition, isLendable } }
    const [settings, setSettings] = useState(null);
    const [notifying, setNotifying] = useState(false);
    const [selectedUnits, setSelectedUnits] = useState({});
    const [activeTab, setActiveTab] = useState(1);
    const [savingItems, setSavingItems] = useState({}); // { itemId: boolean }
    const [progressLogs, setProgressLogs] = useState([]);
    const [newProgressMessage, setNewProgressMessage] = useState('');
    const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);
    
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

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'ADMIN_UNIT', 'KEPALA_BIDANG'].includes(user?.role);
    const isAssignedToAny = req?.items?.some(i => i.assignedToId === user?.id) || false;
    const isAssignedToItem = (item) => item.assignedToId === user?.id;
    const isRequester = req?.userId === user?.id;

    useEffect(() => { fetchDetail(); fetchUsers(); fetchUnits(); fetchCategories(); fetchSettings(); fetchInvItems(); fetchInvWarehouses(); }, [id]);

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
            setUsers(res.data.map(u => ({ id: u.id, name: u.name || u.username, username: u.username, mentionName: (u.name || u.username).replace(/\s+/g, '_'), unitId: u.unitId })));
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
            data.items = (data.items || []).map(item => ({
                ...item,
                newVendorName: '',
                brand: item.brand || '',
                usefulLife: item.usefulLife || (data.type === 'ASSET' ? 4 : 0),
                finalPrice: item.finalPrice || item.estPrice,
                fundingSource: item.fundingSource || 'Mandiri',
                vendorId: item.vendorId || (item.vendorName ? `CV-${item.vendorName}` : ''),
                vendorName: item.vendorName || '',
                comparisonVendors: safeJSON(item.comparisonVendors),
                needComparison: item.needComparison !== false,
                assignedTo: item.assignedTo || '',
                assignedToId: item.assignedToId || null,
                assignmentNote: item.assignmentNote || ''
            }));
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
            if (data.progress) {
                setProgressLogs(data.progress);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSaveItem = async (item, silent = false) => {
        try {
            if (!silent) setSavingItems(prev => ({ ...prev, [item.id]: true }));

            // Resolve vendor name from selection
            let resolvedVendorName = item.vendorName || null;
            if (item.vendorId === 'OTHER') {
                resolvedVendorName = item.newVendorName || null;
            } else if (item.vendorId === 'GUDANG' || item.vendorId === 'Gudang Sarpras') {
                resolvedVendorName = 'Gudang Sarpras (Internal)';
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

    const handleItemChange = (index, field, value) => {
        const next = { ...req };
        next.items[index][field] = value;
        setReq(next);
    };

    const handleSaveDraftItem = (itemId) => {
        const draftStr = localStorage.getItem(`bast_draft_${id}`);
        const draft = draftStr ? JSON.parse(draftStr) : {};
        draft[itemId] = assetDetails[itemId];
        localStorage.setItem(`bast_draft_${id}`, JSON.stringify(draft));
        alert('Detail item berhasil disimpan sebagai draft.');
    };

    const handleSaveDraftAll = () => {
        const draftStr = localStorage.getItem(`bast_draft_${id}`);
        const draft = draftStr ? JSON.parse(draftStr) : {};
        const updatedDraft = { ...draft, ...assetDetails };
        localStorage.setItem(`bast_draft_${id}`, JSON.stringify(updatedDraft));
        alert('Semua detail berhasil disimpan sebagai draft.');
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
            }

            await api.post(`/procurements/${id}/bast`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            localStorage.removeItem(`bast_draft_${id}`); // Bersihkan draft jika BAST sukses

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
                            const incomplete = req.items.find(i => {
                                if (i.vendorId === 'GUDANG' || i.vendorName === 'Gudang Sarpras (Internal)' || warehouseFulfillments[i.id]?.enabled) return false;
                                return (!i.vendorId && !i.vendorName) || !i.finalPrice;
                            });
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

            {/* ── DISKUSI / CHAT ── */}
            {req.status !== 'REJECTED' && (
                <div style={{ marginBottom: 24 }}>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[500px] overflow-hidden">
                        <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
                            <MessageSquare className="text-blue-600" size={18} />
                            <h3 className="text-sm font-semibold text-slate-700 m-0">Diskusi Pengadaan</h3>
                        </div>
                        
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                            {progressLogs.length > 0 ? (
                                progressLogs.slice().reverse().map((msg, idx) => {
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
                                                <p className="whitespace-pre-wrap m-0">{renderChatMessage(msg.message)}</p>
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
                                <div className="text-center py-6 text-sm text-slate-400 italic flex items-center justify-center h-full">
                                    Belum ada pesan diskusi.
                                </div>
                            )}
                        </div>

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
                                    placeholder="Ketik pesan... (@username untuk mention)"
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
                                    const inc = req.items.find(i => {
                                        if (i.vendorId === 'GUDANG' || i.vendorName === 'Gudang Sarpras (Internal)' || warehouseFulfillments[i.id]?.enabled) return false;
                                        return (!i.vendorId && !i.vendorName) || !i.finalPrice;
                                    });
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
                                    background: (item.vendorName || item.vendorId) && item.finalPrice ? `linear-gradient(to right, ${T.successBg}50, ${T.white})` : T.cream
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: T.navy, marginBottom: 4 }}>{item.name}</div>
                                    <div style={{ fontSize: 11.5, color: T.slate, marginBottom: 16 }}>{item.spec}</div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                                        {/* Vendor */}
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <Label>Vendor Terpilih *</Label>
                                            <Select value={item.vendorId || ''} disabled={disabled}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    handleItemChange(index, 'vendorId', val);
                                                    if (val === 'GUDANG') {
                                                        if (!item.finalPrice) handleItemChange(index, 'finalPrice', item.estPrice || 0);
                                                    }
                                                }}>
                                                <option value="">— Pilih Vendor —</option>
                                                <option value="GUDANG">📦 Ambil dari Stok Gudang Sarpras (Internal)</option>
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
                                    <Input type="date" disabled={req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)} value={bastDate} onChange={e => setBastDate(e.target.value)} />
                                </div>

                                {/* Photo Upload */}
                                <div>
                                    <Label>Foto Bukti Serah Terima</Label>
                                    <div style={{
                                        border: `2px dashed ${handoverPhoto ? T.success : T.border}`,
                                        borderRadius: 14, padding: handoverPhoto ? 12 : 40,
                                        background: handoverPhoto ? T.successBg : T.cream,
                                        textAlign: 'center', position: 'relative',
                                        cursor: (req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)) ? 'not-allowed' : 'pointer', transition: 'all .2s'
                                    }}>
                                        {handoverPhoto ? (
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <img src={getMediaUrl(handoverPhoto)} alt="Bukti"
                                                    style={{ maxHeight: 240, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', opacity: (req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)) ? 0.7 : 1 }} />
                                                {!(req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)) && (
                                                    <button onClick={e => { e.stopPropagation(); setHandoverPhoto(null); }}
                                                        style={{
                                                            position: 'absolute', top: -10, right: -10,
                                                            width: 28, height: 28, borderRadius: '50%',
                                                            background: T.danger, color: T.white, border: 'none',
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                        <XCircle size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                <Camera size={40} color={T.border} style={{ marginBottom: 10 }} />
                                                <p style={{ color: T.slate, fontSize: 13 }}>Klik atau seret foto ke sini</p>
                                                <p style={{ color: T.border, fontSize: 11, marginTop: 4 }}>JPG, PNG, WEBP (max 5MB)</p>
                                            </>
                                        )}
                                        <input type="file" accept="image/*"
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

                                {/* Asset Item Details (Card Per Item) */}
                                {req.type === 'ASSET' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Package size={16} color={T.gold} />
                                            <span style={{ fontWeight: 700, fontSize: 14, color: T.navy }}>Detail Aset per Item</span>
                                        </div>
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
                                            return (
                                                <div key={it.id} style={{
                                                    background: T.white, borderRadius: 12, padding: 20,
                                                    border: `1px solid ${T.border}`,
                                                    boxShadow: '0 2px 8px rgba(15,31,61,0.04)'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: `1px dashed ${T.creamDk}` }}>
                                                        <div style={{ fontWeight: 700, fontSize: 14, color: T.navy }}>{idx + 1}. {it.name}</div>
                                                        <div style={{ fontSize: 11, color: T.slate, background: T.cream, padding: '4px 8px', borderRadius: 6 }}>Qty: {it.qty} {it.unit}</div>
                                                    </div>

                                                    {/* ═══ WAREHOUSE FULFILLMENT TOGGLE ═══ */}
                                                    {!itemDisabled && (
                                                        <div style={{
                                                            marginBottom: 16, padding: 14, borderRadius: 10,
                                                            background: warehouseFulfillments[it.id]?.enabled
                                                                ? 'linear-gradient(135deg, #edf7f2, #d9f0e8)'
                                                                : '#f7f5f0',
                                                            border: `1.5px solid ${warehouseFulfillments[it.id]?.enabled ? '#a3d9c0' : T.border}`,
                                                            transition: 'all 0.3s ease'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <div style={{
                                                                        width: 32, height: 32, borderRadius: 8,
                                                                        background: warehouseFulfillments[it.id]?.enabled ? T.success : T.navy,
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        transition: 'background 0.2s'
                                                                    }}>
                                                                        <Package size={15} color="#fff" />
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontWeight: 700, fontSize: 12.5, color: T.navy }}>
                                                                            Penuhi dari Stok Gudang
                                                                        </div>
                                                                        <div style={{ fontSize: 11, color: T.slate }}>
                                                                            Ambil barang yang sudah ada di gudang, stok berkurang otomatis saat BAST
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {/* Toggle Switch */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setWarehouseFulfillments(prev => ({
                                                                            ...prev,
                                                                            [it.id]: {
                                                                                ...prev[it.id],
                                                                                enabled: !prev[it.id]?.enabled,
                                                                                quantity: prev[it.id]?.quantity || it.qty
                                                                            }
                                                                        }));
                                                                    }}
                                                                    style={{
                                                                        width: 48, height: 26, borderRadius: 13,
                                                                        background: warehouseFulfillments[it.id]?.enabled ? T.success : T.border,
                                                                        border: 'none', cursor: 'pointer', position: 'relative',
                                                                        transition: 'background 0.25s', flexShrink: 0
                                                                    }}
                                                                >
                                                                    <div style={{
                                                                        position: 'absolute', top: 3,
                                                                        left: warehouseFulfillments[it.id]?.enabled ? 25 : 3,
                                                                        width: 20, height: 20, borderRadius: '50%',
                                                                        background: '#fff', transition: 'left 0.25s',
                                                                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                                                                    }} />
                                                                </button>
                                                            </div>

                                                            {/* Fulfillment Details Panel */}
                                                            {warehouseFulfillments[it.id]?.enabled && (
                                                                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                                                    {/* Select InvItem */}
                                                                    <div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                                            <Label style={{ marginBottom: 0 }}>Barang Gudang (Khusus Aset) *</Label>
                                                                            <span style={{ fontSize: 10, color: T.gold, fontWeight: 700 }}>Filter: Aset Saja</span>
                                                                        </div>
                                                                        {(() => {
                                                                            const assetOnlyItems = invItems.filter(inv => req?.type === 'ASSET' ? !!inv.isAsset : true);
                                                                            return (
                                                                                <>
                                                                                    <select
                                                                                        value={warehouseFulfillments[it.id]?.invItemId || ''}
                                                                                        onChange={e => setWarehouseFulfillments(prev => ({
                                                                                            ...prev,
                                                                                            [it.id]: { ...prev[it.id], invItemId: e.target.value, warehouseId: '' }
                                                                                        }))}
                                                                                        style={{
                                                                                            width: '100%', padding: '9px 10px',
                                                                                            border: `1.5px solid ${T.border}`, borderRadius: 8,
                                                                                            fontSize: 12.5, background: '#fff', color: T.text,
                                                                                            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                                                                                        }}
                                                                                    >
                                                                                        <option value="">— Pilih Barang Aset di Gudang —</option>
                                                                                        {assetOnlyItems.map(inv => {
                                                                                            const totalStock = (inv.stocks || []).reduce((s, st) => s + (st.quantity || 0), 0);
                                                                                            return (
                                                                                                <option key={inv.id} value={inv.id}>
                                                                                                    {inv.name} (Stok: {totalStock} {inv.unit}) {inv.isAsset ? '🏷️ [Aset]' : ''}
                                                                                                </option>
                                                                                            );
                                                                                        })}
                                                                                    </select>
                                                                                    {assetOnlyItems.length === 0 && (
                                                                                        <div style={{ marginTop: 4, fontSize: 11, color: T.warn, lineHeight: 1.4 }}>
                                                                                            ⚠️ Belum ada barang di Manajemen Gudang yang ditandai sebagai <b>Aset</b>. Silakan atur klasifikasi barang di <i>Master Data Gudang</i> terlebih dahulu.
                                                                                        </div>
                                                                                    )}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </div>

                                                                    {/* Select Warehouse */}
                                                                    <div>
                                                                        <Label>Pilih Gudang *</Label>
                                                                        <select
                                                                            value={warehouseFulfillments[it.id]?.warehouseId || ''}
                                                                            onChange={e => setWarehouseFulfillments(prev => ({
                                                                                ...prev,
                                                                                [it.id]: { ...prev[it.id], warehouseId: e.target.value }
                                                                            }))}
                                                                            style={{
                                                                                width: '100%', padding: '9px 10px',
                                                                                border: `1.5px solid ${T.border}`, borderRadius: 8,
                                                                                fontSize: 12.5, background: '#fff', color: T.text,
                                                                                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                                                                            }}
                                                                        >
                                                                            <option value="">— Pilih Gudang —</option>
                                                                            {(() => {
                                                                                const selectedInvItem = invItems.find(i => String(i.id) === String(warehouseFulfillments[it.id]?.invItemId));
                                                                                const availableStocks = selectedInvItem?.stocks?.filter(s => s.quantity > 0) || [];
                                                                                return availableStocks.length > 0
                                                                                    ? availableStocks.map(s => (
                                                                                        <option key={s.warehouseId} value={s.warehouseId}>
                                                                                            {invWarehouses.find(w => w.id === s.warehouseId)?.name || `Gudang #${s.warehouseId}`} — Stok: {s.quantity}
                                                                                        </option>
                                                                                    ))
                                                                                    : invWarehouses.map(w => (
                                                                                        <option key={w.id} value={w.id}>{w.name}</option>
                                                                                    ));
                                                                            })()}
                                                                        </select>
                                                                        {/* Stock Indicator */}
                                                                        {warehouseFulfillments[it.id]?.invItemId && warehouseFulfillments[it.id]?.warehouseId && (() => {
                                                                            const selItem = invItems.find(i => String(i.id) === String(warehouseFulfillments[it.id]?.invItemId));
                                                                            const selStock = selItem?.stocks?.find(s => String(s.warehouseId) === String(warehouseFulfillments[it.id]?.warehouseId));
                                                                            const qty = selStock?.quantity || 0;
                                                                            return (
                                                                                <div style={{
                                                                                    marginTop: 5, padding: '4px 8px', borderRadius: 6,
                                                                                    background: qty > 0 ? T.successBg : T.dangerBg,
                                                                                    color: qty > 0 ? T.success : T.danger,
                                                                                    fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4
                                                                                }}>
                                                                                    {qty > 0 ? <CheckCircle size={11} /> : <XCircle size={11} />}
                                                                                    {qty > 0 ? `Stok tersedia: ${qty} unit` : 'Stok kosong di gudang ini'}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>

                                                                    {/* Quantity */}
                                                                    <div>
                                                                        <Label>Jumlah Diambil *</Label>
                                                                        <input
                                                                            type="number"
                                                                            min={1}
                                                                            value={warehouseFulfillments[it.id]?.quantity || it.qty}
                                                                            onChange={e => setWarehouseFulfillments(prev => ({
                                                                                ...prev,
                                                                                [it.id]: { ...prev[it.id], quantity: e.target.value }
                                                                            }))}
                                                                            style={{
                                                                                width: '100%', padding: '9px 10px',
                                                                                border: `1.5px solid ${T.border}`, borderRadius: 8,
                                                                                fontSize: 12.5, background: '#fff', color: T.text,
                                                                                fontFamily: "'DM Sans', sans-serif"
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {warehouseFulfillments[it.id]?.enabled && (
                                                                <div style={{
                                                                    marginTop: 10, padding: '8px 12px', borderRadius: 8,
                                                                    background: 'rgba(45,122,95,0.08)', fontSize: 11.5, color: T.success,
                                                                    display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600
                                                                }}>
                                                                    <CheckCircle size={13} />
                                                                    Detail aset di bawah tidak diperlukan saat menggunakan pemenuhan gudang
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}


                                                    {/* Asset detail form – hidden when using warehouse fulfillment */}
                                                    {!warehouseFulfillments[it.id]?.enabled && (
                                                        <>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                                                                {/* Kategori */}
                                                                <div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                                        <Label style={{ marginBottom: 0 }}>Kategori Aset *</Label>
                                                                        {(() => {
                                                                            const currentCatId = det.categoryId || it.categoryId;
                                                                            const isChanged = det.categoryId && it.categoryId && parseInt(det.categoryId) !== parseInt(it.categoryId);
                                                                            if (isChanged) {
                                                                                return (
                                                                                    <span style={{ fontSize: 10, color: T.warn, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                                                        <AlertCircle size={11} /> Kategori Diedit
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            if (currentCatId) {
                                                                                return (
                                                                                    <span style={{ fontSize: 10, color: T.gold, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                                                        <CheckCircle size={11} /> {it.categoryId ? 'Dari Pengadaan' : 'Terpilih'}
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}
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
                                                                        style={{
                                                                            borderColor: (det.categoryId || it.categoryId) ? '#bbf7d0' : T.border,
                                                                            background: (det.categoryId || it.categoryId) ? '#f8fdf9' : '#fff'
                                                                        }}
                                                                    >
                                                                        <option value="">— Pilih Kategori (Koreksi) —</option>
                                                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                                    </Select>
                                                                    {(det.categoryId || it.categoryId) && (
                                                                        <div style={{ marginTop: 4, fontSize: 10, color: T.gold, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                                                                            PREVIEW KODE: {getPreviewCode(det.categoryId || it.categoryId)}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Kondisi Awal */}
                                                                <div>
                                                                    <Label>Kondisi Awal</Label>
                                                                    <Select disabled={itemDisabled} value={det.condition || 'BAIK'} onChange={e => updateDet('condition', e.target.value)}>
                                                                        <option value="BAIK">Baik</option>
                                                                        <option value="RUSAK_RINGAN">Rusak Ringan</option>
                                                                        <option value="RUSAK_BERAT">Rusak Berat</option>
                                                                    </Select>
                                                                </div>

                                                                {/* Alokasi Ruangan Type Selector (if qty > 1) */}
                                                                {it.qty > 1 && (
                                                                    <div style={{ gridColumn: 'span 2' }}>
                                                                        <Label>Metode Alokasi Ruangan</Label>
                                                                        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                                                                            {[['SAME', 'Sama untuk Semua Unit'], ['INDIVIDUAL', 'Berbeda per Unit']].map(([val, label]) => (
                                                                                <button key={val}
                                                                                    type="button"
                                                                                    disabled={itemDisabled}
                                                                                    onClick={() => updateDet('allocationType', val)}
                                                                                    style={{
                                                                                        flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                                                                        border: `1.5px solid ${det.allocationType === val ? T.navy : T.border}`,
                                                                                        background: det.allocationType === val ? T.navy : (itemDisabled ? T.creamDk : T.white),
                                                                                        color: det.allocationType === val ? T.white : T.slate,
                                                                                        cursor: itemDisabled ? 'not-allowed' : 'pointer'
                                                                                    }}>
                                                                                    {label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* ── SAME ALLOCATION MODE ── */}
                                                                {det.allocationType === 'SAME' ? (
                                                                    <div style={{ gridColumn: it.qty > 1 ? 'span 2' : 'auto', background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                                                                            <Label style={{ marginBottom: 0, color: '#1e293b' }}>Lokasi Penempatan Ruangan *</Label>
                                                                            
                                                                            {/* Pill Switch: Unit Pemohon vs Titip di Unit Lain */}
                                                                            <div style={{ display: 'inline-flex', background: '#e2e8f0', borderRadius: 8, padding: 2 }}>
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={itemDisabled}
                                                                                    onClick={() => {
                                                                                        updateDet('isEntrusted', false);
                                                                                        updateDet('targetUnitId', req.unitId);
                                                                                        updateDet('roomId', '');
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none',
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
                                                                                        padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none',
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
                                                                            <div style={{ marginBottom: 10 }}>
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
                                                                                    {units
                                                                                        .filter(u => u.id !== req.unitId)
                                                                                        .map(u => (
                                                                                            <option key={u.id} value={u.id}>
                                                                                                {u.name} ({u.code})
                                                                                            </option>
                                                                                        ))
                                                                                    }
                                                                                </Select>
                                                                            </div>
                                                                        )}

                                                                        {/* Filtered Rooms Dropdown */}
                                                                        {(() => {
                                                                            const activeUnitId = det.targetUnitId || req.unitId;
                                                                            const availableRooms = allRooms.filter(r => r.unitId === activeUnitId);
                                                                            const activeUnitName = units.find(u => u.id === activeUnitId)?.name || (activeUnitId === req.unitId ? req.unit?.name : 'Unit Terpilih');

                                                                            return (
                                                                                <div>
                                                                                    <Label>Pilih Ruangan di {activeUnitName} *</Label>
                                                                                    <Select
                                                                                        disabled={itemDisabled}
                                                                                        value={det.roomId || ''}
                                                                                        onChange={e => updateDet('roomId', e.target.value)}
                                                                                        style={{ background: '#fff' }}
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
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                ) : (
                                                                    /* ── INDIVIDUAL ALLOCATION MODE ── */
                                                                    <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, background: T.cream, padding: 14, borderRadius: 10 }}>
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
                                                                                <div key={uIdx} style={{ background: T.white, padding: 12, borderRadius: 10, border: `1px solid ${T.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                                                        <Label style={{ fontWeight: 800, marginBottom: 0 }}>Unit #{uIdx + 1}</Label>
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
                                                                                                    padding: '2px 6px', fontSize: 9.5, fontWeight: 700, borderRadius: 5, border: 'none',
                                                                                                    background: !u.isEntrusted ? '#fff' : 'transparent',
                                                                                                    color: !u.isEntrusted ? T.navy : T.slate,
                                                                                                    cursor: itemDisabled ? 'not-allowed' : 'pointer'
                                                                                                }}
                                                                                            >
                                                                                                Unit Sendiri
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                disabled={itemDisabled}
                                                                                                onClick={() => {
                                                                                                    updateUnit('isEntrusted', true);
                                                                                                    updateUnit('roomId', '');
                                                                                                }}
                                                                                                style={{
                                                                                                    padding: '2px 6px', fontSize: 9.5, fontWeight: 700, borderRadius: 5, border: 'none',
                                                                                                    background: u.isEntrusted ? T.warn : 'transparent',
                                                                                                    color: u.isEntrusted ? '#fff' : T.slate,
                                                                                                    cursor: itemDisabled ? 'not-allowed' : 'pointer'
                                                                                                }}
                                                                                            >
                                                                                                Titip Unit Lain
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>

                                                                                    {u.isEntrusted && (
                                                                                        <div style={{ marginBottom: 6 }}>
                                                                                            <Select
                                                                                                disabled={itemDisabled}
                                                                                                value={u.targetUnitId || ''}
                                                                                                onChange={e => {
                                                                                                    updateUnit('targetUnitId', parseInt(e.target.value));
                                                                                                    updateUnit('roomId', '');
                                                                                                }}
                                                                                                style={{ fontSize: 11, padding: '5px 8px', border: `1px solid ${T.warn}` }}
                                                                                            >
                                                                                                <option value="">— Pilih Unit Lain —</option>
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
                                                                                        style={{ fontSize: 11, padding: '6px 10px', marginBottom: 8 }}
                                                                                    >
                                                                                        <option value="">— Pilih Ruangan ({activeUnitName}) —</option>
                                                                                        {availableRooms.map(r => (
                                                                                            <option key={r.id} value={r.id}>
                                                                                                {r.name} {r.building ? `— ${r.building}` : ''} {r.floor ? `(Lt. ${r.floor})` : ''}
                                                                                            </option>
                                                                                        ))}
                                                                                    </Select>

                                                                                    <AssetImageUpload
                                                                                        disabled={itemDisabled}
                                                                                        value={u.image}
                                                                                        onChange={val => updateUnit('image', val)}
                                                                                        label="Foto Unit"
                                                                                    />
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                                {/* PIC */}
                                                                <div>
                                                                    <Label>PIC (Opsional)</Label>
                                                                    <Select disabled={itemDisabled} value={det.picId || ''} onChange={e => updateDet('picId', e.target.value)}>
                                                                        <option value="">— Tidak ada —</option>
                                                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                                    </Select>
                                                                </div>

                                                                {/* Foto Aset (SAME ALLOCATION) */}
                                                                {det.allocationType === 'SAME' && (
                                                                    <div>
                                                                        <AssetImageUpload
                                                                            disabled={itemDisabled}
                                                                            value={det.image}
                                                                            onChange={val => updateDet('image', val)}
                                                                            label="Foto Aset (Sama untuk semua)"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.cream, padding: '10px 14px', borderRadius: 8 }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        disabled={itemDisabled}
                                                                        id={`lendable-${it.id}`}
                                                                        checked={det.isLendable || false}
                                                                        onChange={e => updateDet('isLendable', e.target.checked)}
                                                                        style={{ cursor: itemDisabled ? 'not-allowed' : 'pointer', width: 16, height: 16 }}
                                                                    />
                                                                    <label htmlFor={`lendable-${it.id}`} style={{ fontSize: 12, fontWeight: 600, color: T.text, cursor: itemDisabled ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                                                                        Aset ini bisa dipinjam oleh unit lain
                                                                    </label>
                                                                </div>

                                                                <div style={{ background: '#eef3fc', padding: '14px', borderRadius: 10, border: '1px solid #bfd0f5' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: det.needsRoutineMaintenance ? 12 : 0 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: det.needsRoutineMaintenance ? '#2c5fc4' : T.border }} />
                                                                            <label htmlFor={`maint-${it.id}`} style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', cursor: itemDisabled ? 'not-allowed' : 'pointer' }}>
                                                                                Pemeliharaan Rutin?
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

                                                            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${T.creamDk}` }}>
                                                                <button
                                                                    onClick={() => handleSaveDraftItem(it.id)}
                                                                    disabled={itemDisabled}
                                                                    style={{
                                                                        padding: '10px 16px', borderRadius: 8, background: itemDisabled ? T.creamDk : T.goldSoft, color: itemDisabled ? T.slate : T.warn,
                                                                        fontWeight: 700, border: 'none', cursor: itemDisabled ? 'not-allowed' : 'pointer',
                                                                        display: 'flex', alignItems: 'center', gap: 8, fontSize: 13
                                                                    }}
                                                                >
                                                                    <Save size={16} />
                                                                    Simpan Draft Item
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {req.items.length > 0 && (
                                    <button
                                        onClick={handleSaveDraftAll}
                                        disabled={req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)}
                                        style={{
                                            width: '100%', padding: '16px', marginBottom: 12,
                                            borderRadius: 12, fontFamily: "'DM Sans', sans-serif",
                                            fontSize: 15, fontWeight: 700, border: `2px solid ${T.goldSoft}`,
                                            background: T.white,
                                            color: (req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)) ? T.slate : T.warn,
                                            cursor: (req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)) ? 'not-allowed' : 'pointer',
                                            transition: 'all .25s',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                                        }}>
                                        <Save size={18} /> Simpan Draft Semua
                                    </button>
                                )}

                                <button
                                    disabled={!bastDate || (req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester))}
                                    onClick={handleBAST}
                                    style={{
                                        width: '100%', padding: '16px',
                                        borderRadius: 12, fontFamily: "'DM Sans', sans-serif",
                                        fontSize: 15, fontWeight: 700, border: 'none',
                                        background: (bastDate && !(req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester)))
                                            ? `linear-gradient(135deg, ${T.success}, #3a9a72)`
                                            : T.creamDk,
                                        color: (bastDate && !(req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester))) ? T.white : T.slate,
                                        cursor: (bastDate && !(req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester))) ? 'pointer' : 'not-allowed',
                                        boxShadow: (bastDate && !(req.status === 'COMPLETED' || !(isAdmin || isAssignedToAny || isRequester))) ? '0 6px 20px rgba(45,122,95,0.3)' : 'none',
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
                                                party1Name: 'Ravi Kurnia',
                                                party1Title: 'Pemberi',
                                                party2Name: req.items?.[0]?.vendorName || '',
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
                                            party2Name: req.items?.[0]?.vendorName || '',
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
        </div>
    );
};

export default ProcurementDetail;
// Append something to test
