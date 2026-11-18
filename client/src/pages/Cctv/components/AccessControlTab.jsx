import { useMemo, useState } from 'react';
import {
    Search, ShieldCheck, Users, Cctv, CheckSquare, Square,
    Save, Wifi, HardDrive, CheckCircle2, EyeOff, Eye, Building2, Plus
} from 'lucide-react';

const UserAccessEditor = ({
    selectedUser,
    cameras = [],
    onSaveUserAccess,
    saving = false,
    onGoToCameras
}) => {
    const [selectedCameraIds, setSelectedCameraIds] = useState(
        () => (Array.isArray(selectedUser?.grantedCameraIds) ? selectedUser.grantedCameraIds : [])
    );
    const [cameraSearch, setCameraSearch] = useState('');

    const hasUnsavedChanges = useMemo(() => {
        if (!selectedUser || selectedUser.isCctvManager) return false;
        const original = [...(selectedUser.grantedCameraIds || [])].sort((a, b) => a - b);
        const current = [...selectedCameraIds].sort((a, b) => a - b);
        if (original.length !== current.length) return true;
        return original.some((val, idx) => val !== current[idx]);
    }, [selectedUser, selectedCameraIds]);

    const groupedCameras = useMemo(() => {
        const q = cameraSearch.trim().toLowerCase();
        const filtered = cameras.filter((cam) => {
            if (!q) return true;
            return (
                (cam.name || '').toLowerCase().includes(q) ||
                (cam.location || '').toLowerCase().includes(q) ||
                (cam.brand || '').toLowerCase().includes(q) ||
                (cam.unit?.name || '').toLowerCase().includes(q)
            );
        });

        const groupsMap = new Map();
        for (const cam of filtered) {
            const key = cam.unitId ? String(cam.unitId) : 'UMUM';
            const label = cam.unit?.name || 'Umum / Lintas Unit';
            if (!groupsMap.has(key)) {
                groupsMap.set(key, { key, label, cameras: [] });
            }
            groupsMap.get(key).cameras.push(cam);
        }
        return Array.from(groupsMap.values());
    }, [cameras, cameraSearch]);

    const toggleCamera = (cameraId) => {
        setSelectedCameraIds((prev) =>
            prev.includes(cameraId) ? prev.filter((id) => id !== cameraId) : [...prev, cameraId]
        );
    };

    const toggleUnitGroup = (unitCameras) => {
        const ids = unitCameras.map((c) => c.id);
        const allSelected = ids.every((id) => selectedCameraIds.includes(id));
        if (allSelected) {
            setSelectedCameraIds((prev) => prev.filter((id) => !ids.includes(id)));
        } else {
            setSelectedCameraIds((prev) => [...new Set([...prev, ...ids])]);
        }
    };

    const handleSelectAllCameras = () => {
        setSelectedCameraIds(cameras.map((c) => c.id));
    };

    const handleRevokeAll = () => {
        setSelectedCameraIds([]);
    };

    return (
        <>
            {/* Header User Terpilih */}
            <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                            2. Atur Kamera untuk Pengguna Terpilih
                        </span>
                        <h4 className="text-base font-bold text-slate-900">
                            {selectedUser.name || selectedUser.username}
                        </h4>
                        <p className="text-xs text-slate-500">
                            Jabatan: <strong className="text-slate-700">{selectedUser.position || '-'}</strong> •
                            Unit: <strong className="text-slate-700">{selectedUser.unit?.name || 'Global'}</strong>
                        </p>
                    </div>

                    {!selectedUser.isCctvManager && cameras.length > 0 && (
                        <button
                            type="button"
                            disabled={saving || !hasUnsavedChanges}
                            onClick={() => onSaveUserAccess(selectedUser.id, selectedCameraIds)}
                            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm ${
                                hasUnsavedChanges
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            <Save size={15} />
                            {saving ? 'Menyimpan...' : hasUnsavedChanges ? 'Simpan Hak Akses' : 'Tersimpan'}
                        </button>
                    )}
                </div>

                {/* Status Visibilitas Menu */}
                {selectedUser.isCctvManager ? (
                    <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-800 flex items-center gap-2">
                        <ShieldCheck size={16} className="shrink-0" />
                        <span>
                            Pengguna ini memiliki jabatan <strong>Kepala Bidang Sarana</strong>, sehingga otomatis melihat menu <strong>Management CCTV</strong> dan mengakses <strong>seluruh kamera</strong> serta pengaturan hak akses.
                        </span>
                    </div>
                ) : selectedCameraIds.length > 0 ? (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        <span>
                            Menu <strong>Management CCTV MUNCUL</strong> untuk pengguna ini ({selectedCameraIds.length} kamera terpilih).
                        </span>
                    </div>
                ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                        <EyeOff size={16} className="shrink-0 text-amber-600" />
                        <span>
                            Menu <strong>Management CCTV TERSEMBUNYI</strong> untuk pengguna ini. Centang minimal 1 kamera lalu simpan untuk mengaktifkan menunya.
                        </span>
                    </div>
                )}

                {!selectedUser.isCctvManager && cameras.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                value={cameraSearch}
                                onChange={(e) => setCameraSearch(e.target.value)}
                                placeholder="Filter daftar kamera..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={handleSelectAllCameras}
                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                            >
                                Centang Semua
                            </button>
                            <button
                                type="button"
                                onClick={handleRevokeAll}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-colors"
                            >
                                Cabut Semua Akses
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Body Checklist Kamera */}
            <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                {cameras.length === 0 ? (
                    <div className="py-12 px-4 text-center space-y-3 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                        <Cctv size={36} className="mx-auto text-slate-300" />
                        <div>
                            <p className="text-sm font-bold text-slate-700">Belum Ada Kamera CCTV Terdaftar</p>
                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                Tambahkan minimal satu kamera terlebih dahulu agar Kepala Bidang Sarana dapat memilih kamera mana saja yang boleh diakses oleh pengguna.
                            </p>
                        </div>
                        {onGoToCameras && (
                            <button
                                type="button"
                                onClick={onGoToCameras}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
                            >
                                <Plus size={14} /> Tambah Kamera Sekarang
                            </button>
                        )}
                    </div>
                ) : selectedUser.isCctvManager ? (
                    <div className="py-10 text-center text-xs text-slate-500">
                        Semua {cameras.length} kamera aktif maupun nonaktif dapat dipantau langsung oleh Kepala Bidang Sarana.
                    </div>
                ) : groupedCameras.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                        Tidak ada kamera yang sesuai dengan pencarian.
                    </div>
                ) : (
                    groupedCameras.map((group) => {
                        const groupAllSelected = group.cameras.every((c) => selectedCameraIds.includes(c.id));
                        const groupSelectedCount = group.cameras.filter((c) => selectedCameraIds.includes(c.id)).length;

                        return (
                            <div key={group.key} className="border border-slate-200 rounded-2xl overflow-hidden">
                                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Building2 size={15} className="text-slate-500 shrink-0" />
                                        <span className="text-xs font-bold text-slate-800 truncate">{group.label}</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shrink-0">
                                            {groupSelectedCount}/{group.cameras.length}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleUnitGroup(group.cameras)}
                                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 shrink-0"
                                    >
                                        {groupAllSelected ? 'Batal Semua Unit' : 'Pilih Semua Unit Ini'}
                                    </button>
                                </div>

                                <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {group.cameras.map((cam) => {
                                        const checked = selectedCameraIds.includes(cam.id);
                                        return (
                                            <button
                                                key={cam.id}
                                                type="button"
                                                onClick={() => toggleCamera(cam.id)}
                                                className={`flex items-start justify-between gap-2.5 p-3 rounded-xl border text-left transition-all ${
                                                    checked
                                                        ? 'bg-indigo-50/80 border-indigo-300 shadow-xs'
                                                        : 'bg-white border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-bold text-slate-800 truncate">
                                                            {cam.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                                            {cam.brand}
                                                        </span>
                                                        <span className="inline-flex items-center gap-0.5 text-slate-500">
                                                            {cam.deviceType === 'WIFI_CAMERA' ? (
                                                                <><Wifi size={10} /> WiFi</>
                                                            ) : (
                                                                <><HardDrive size={10} /> Ch.{cam.channelNo}</>
                                                            )}
                                                        </span>
                                                        {!cam.isActive && (
                                                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                                                                Nonaktif
                                                            </span>
                                                        )}
                                                    </div>
                                                    {cam.location && (
                                                        <p className="text-[11px] text-slate-500 truncate">{cam.location}</p>
                                                    )}
                                                </div>
                                                {checked ? (
                                                    <CheckSquare size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                                                ) : (
                                                    <Square size={18} className="text-slate-300 shrink-0 mt-0.5" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
};

const AccessControlTab = ({
    users = [],
    cameras = [],
    units = [],
    onSaveUserAccess,
    saving = false,
    onGoToCameras
}) => {
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userSearch, setUserSearch] = useState('');
    const [userFilterStatus, setUserFilterStatus] = useState('ALL'); // ALL | GRANTED | NONE
    const [userUnitFilter, setUserUnitFilter] = useState('');

    const effectiveUser = useMemo(() => {
        if (users.length === 0) return null;
        return (
            users.find((u) => u.id === selectedUserId) ||
            users.find((u) => !u.isCctvManager) ||
            users[0]
        );
    }, [users, selectedUserId]);

    const filteredUsers = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        return users.filter((u) => {
            if (userUnitFilter && String(u.unitId || '') !== userUnitFilter) return false;
            if (userFilterStatus === 'GRANTED' && !u.isCctvManager && u.grantedCount === 0) return false;
            if (userFilterStatus === 'NONE' && (u.isCctvManager || u.grantedCount > 0)) return false;
            if (!q) return true;
            return (
                (u.name || '').toLowerCase().includes(q) ||
                (u.username || '').toLowerCase().includes(q) ||
                (u.position || '').toLowerCase().includes(q) ||
                (u.unit?.name || '').toLowerCase().includes(q)
            );
        });
    }, [users, userSearch, userFilterStatus, userUnitFilter]);

    const grantedUsersCount = useMemo(
        () => users.filter((u) => !u.isCctvManager && u.grantedCount > 0).length,
        [users]
    );

    const editorKey = effectiveUser
        ? `${effectiveUser.id}-${(effectiveUser.grantedCameraIds || []).join(',')}`
        : 'none';

    return (
        <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-violet-600 text-white rounded-xl shadow-sm shrink-0">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">
                            Pengaturan Hak Akses Per Pengguna &amp; Per Kamera
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                            Pilih <strong>1 pengguna</strong> di panel kiri, lalu centang kamera mana saja yang boleh diakses di panel kanan.
                            Selama belum diberi akses oleh <strong>Kepala Bidang Sarana</strong>, menu Management CCTV tidak akan muncul di akun mereka.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1.5 rounded-xl bg-white border border-violet-200 text-xs font-bold text-violet-700 shadow-xs">
                        {grantedUsersCount} Pengguna Diberi Akses
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Panel Kiri: Daftar Pengguna */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/70">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Users size={16} className="text-indigo-600" />
                                1. Pilih Pengguna ({filteredUsers.length})
                            </h4>
                        </div>

                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                placeholder="Cari nama, username, jabatan..."
                                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <select
                                value={userFilterStatus}
                                onChange={(e) => setUserFilterStatus(e.target.value)}
                                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-xl outline-none"
                            >
                                <option value="ALL">Semua Status Akses</option>
                                <option value="GRANTED">Sudah Diberi Akses</option>
                                <option value="NONE">Belum Ada Akses</option>
                            </select>

                            <select
                                value={userUnitFilter}
                                onChange={(e) => setUserUnitFilter(e.target.value)}
                                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-xl outline-none"
                            >
                                <option value="">Semua Unit</option>
                                {units.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
                        {filteredUsers.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-400">
                                Tidak ada pengguna yang cocok.
                            </div>
                        ) : (
                            filteredUsers.map((u) => {
                                const isSelected = effectiveUser?.id === u.id;
                                return (
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => setSelectedUserId(u.id)}
                                        className={`w-full p-3.5 text-left transition-all flex items-center justify-between gap-3 ${
                                            isSelected
                                                ? 'bg-indigo-50/90 border-l-4 border-l-indigo-600'
                                                : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                                    {u.name || u.username}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                                {u.position || u.role} {u.unit?.name ? `• ${u.unit.name}` : ''}
                                            </p>
                                        </div>

                                        <div className="shrink-0">
                                            {u.isCctvManager ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                                                    Pemilik (Penuh)
                                                </span>
                                            ) : u.grantedCount > 0 ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                    <Eye size={10} /> {u.grantedCount} Kamera
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                                    <EyeOff size={10} /> Tersembunyi
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Panel Kanan: Checklist Kamera Untuk User Terpilih */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {!effectiveUser ? (
                        <div className="p-12 text-center text-slate-400 text-sm">
                            Pilih salah satu pengguna di sebelah kiri untuk mengatur akses CCTV.
                        </div>
                    ) : (
                        <UserAccessEditor
                            key={editorKey}
                            selectedUser={effectiveUser}
                            cameras={cameras}
                            onSaveUserAccess={onSaveUserAccess}
                            saving={saving}
                            onGoToCameras={onGoToCameras}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccessControlTab;
