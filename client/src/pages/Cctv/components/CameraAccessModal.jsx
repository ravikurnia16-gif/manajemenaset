import { useMemo, useState } from 'react';
import { X, Save, Search, ShieldCheck, Users, CheckSquare, Square } from 'lucide-react';

const CameraAccessModalInner = ({ onClose, camera, users = [], onSave, saving = false }) => {
    const [selectedUserIds, setSelectedUserIds] = useState(
        () => (Array.isArray(camera.accessUserIds) ? camera.accessUserIds : [])
    );
    const [search, setSearch] = useState('');

    const selectableUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter((u) => {
            if (u.isCctvManager) return false; // Kepala Bidang Sarana otomatis akses semua
            if (!q) return true;
            return (
                (u.name || '').toLowerCase().includes(q) ||
                (u.username || '').toLowerCase().includes(q) ||
                (u.position || '').toLowerCase().includes(q) ||
                (u.unit?.name || '').toLowerCase().includes(q)
            );
        });
    }, [users, search]);

    const toggleUser = (userId) => {
        setSelectedUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleSelectAllFiltered = () => {
        const filteredIds = selectableUsers.map((u) => u.id);
        setSelectedUserIds((prev) => [...new Set([...prev, ...filteredIds])]);
    };

    const handleClearAll = () => {
        setSelectedUserIds([]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl">
                            <Users size={18} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 truncate">
                                Atur Pengguna untuk Kamera Ini
                            </h3>
                            <p className="text-xs text-slate-500 truncate">
                                {camera.name} {camera.unit?.name ? `• ${camera.unit.name}` : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
                    <div className="flex items-center gap-2 text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                        <ShieldCheck size={15} className="shrink-0" />
                        <span>
                            <strong>Kepala Bidang Sarana</strong> otomatis memiliki akses penuh. Pengguna lain di bawah baru akan melihat menu Management CCTV setelah dicentang.
                        </span>
                    </div>

                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nama, username, jabatan, atau unit..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600">
                            Dipilih: <strong className="text-indigo-600">{selectedUserIds.length}</strong> pengguna
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAllFiltered}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                            >
                                Pilih Semua
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold"
                            >
                                Kosongkan
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {selectableUsers.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-8">Tidak ada pengguna yang cocok dengan pencarian.</p>
                    ) : (
                        selectableUsers.map((u) => {
                            const checked = selectedUserIds.includes(u.id);
                            return (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => toggleUser(u.id)}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                                        checked
                                            ? 'bg-indigo-50 border-indigo-300'
                                            : 'bg-white border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="min-w-0 pr-3">
                                        <p className="text-xs font-bold text-slate-800 truncate">
                                            {u.name || u.username}
                                        </p>
                                        <p className="text-[11px] text-slate-500 truncate">
                                            {u.position || u.role} {u.unit?.name ? `• ${u.unit.name}` : ''}
                                        </p>
                                    </div>
                                    {checked ? (
                                        <CheckSquare size={18} className="text-indigo-600 shrink-0" />
                                    ) : (
                                        <Square size={18} className="text-slate-300 shrink-0" />
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-white"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave(camera.id, selectedUserIds)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                    >
                        <Save size={14} />
                        {saving ? 'Menyimpan...' : 'Simpan Akses'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CameraAccessModal = ({ isOpen, camera, ...props }) => {
    if (!isOpen || !camera) return null;
    const modalKey = `${camera.id}-${(camera.accessUserIds || []).join(',')}`;
    return <CameraAccessModalInner key={modalKey} camera={camera} {...props} />;
};

export default CameraAccessModal;
