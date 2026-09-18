import React from 'react';
import { 
    X, 
    CheckCircle2, 
    Info, 
    Trash2, 
    Plus, 
    Search 
} from 'lucide-react';

export default function MaintenanceActionModal({
    actionModal,
    onClose,
    onSubmit,
    report,
    units = [],
    users = [],
    contractors = [],
    // Form States
    actionNote,
    setActionNote,
    technicianType,
    setTechnicianType,
    technicianName,
    setTechnicianName,
    technicianPhone,
    setTechnicianPhone,
    userSearchQuery,
    setUserSearchQuery,
    assignUnitId,
    setAssignUnitId,
    createWorkshopOrder,
    setCreateWorkshopOrder,
    progressNote,
    setProgressNote,
    actionMode,
    setActionMode,
    bulkAllCondition,
    setBulkAllCondition,
    assetActionItems,
    setAssetActionItems,
    bulkSelectedAction,
    setBulkSelectedAction,
    bulkSelectedCondition,
    setBulkSelectedCondition,
    costItems,
    setCostItems,
    setReceiptFile,
    setCompletionPhoto,
    onToggleSelectAllAssets,
    onApplyToSelectedAssets
}) {
    if (!actionModal.show) return null;

    const filteredAssignableUsers = users.filter(u => {
        if (assignUnitId && u.unitId !== parseInt(assignUnitId)) return false;
        if (userSearchQuery.trim()) {
            const q = userSearchQuery.toLowerCase();
            const name = (u.name || '').toLowerCase();
            const username = (u.username || '').toLowerCase();
            const position = (u.position || '').toLowerCase();
            const unitName = (units.find(un => un.id === u.unitId)?.name || '').toLowerCase();
            return name.includes(q) || username.includes(q) || position.includes(q) || unitName.includes(q);
        }
        return true;
    });

    const isCompletion = actionModal.type === 'completion';
    const isProgress = actionModal.type === 'progress';
    const isAssignment = actionModal.type === 'assignment';
    const isStart = actionModal.type === 'start';
    const isRejection = actionModal.type === 'rejection';

    const getModalTitle = () => {
        if (isAssignment) return 'Penugasan Teknisi';
        if (isStart) return 'Mulai Pengerjaan';
        if (isProgress) return 'Pembaruan Progres Pekerjaan';
        if (isCompletion) return 'Selesaikan Pekerjaan';
        if (isRejection) return 'Tolak / Batalkan Laporan';
        return 'Tindakan Pemeliharaan';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-800">
                        {getModalTitle()}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* ASSIGNMENT MODE */}
                    {isAssignment && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Pilih Pelaksana
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTechnicianType('internal');
                                            setTechnicianName('');
                                            setTechnicianPhone('');
                                        }}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                                            technicianType === 'internal'
                                                ? 'bg-blue-50 border-blue-500 text-blue-700'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Pegawai Internal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTechnicianType('external');
                                            setTechnicianName('');
                                            setTechnicianPhone('');
                                        }}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                                            technicianType === 'external'
                                                ? 'bg-blue-50 border-blue-500 text-blue-700'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {report?.targetDept === 'PEMBANGUNAN' ? 'Tukang / Kontraktor' : 'Vendor Eksternal'}
                                    </button>
                                </div>
                            </div>

                            {technicianType === 'internal' ? (
                                <div className="space-y-2.5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={userSearchQuery}
                                                onChange={e => setUserSearchQuery(e.target.value)}
                                                placeholder="Cari nama atau username..."
                                                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <select
                                            value={assignUnitId}
                                            onChange={e => setAssignUnitId(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Semua Unit</option>
                                            {units.map(un => (
                                                <option key={un.id} value={un.id}>{un.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* List User */}
                                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                                        {filteredAssignableUsers.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-slate-400">Pegawai tidak ditemukan</div>
                                        ) : (
                                            filteredAssignableUsers.map(u => {
                                                const uName = u.name || u.username;
                                                const isSelected = technicianName === uName;
                                                const uUnit = units.find(un => un.id === u.unitId);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={u.id}
                                                        onClick={() => {
                                                            setTechnicianName(uName);
                                                            setTechnicianPhone(u.phone || '');
                                                        }}
                                                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                                            isSelected ? 'bg-blue-50 text-blue-900 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                                                isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                                                            }`}>
                                                                {uName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold truncate text-slate-800">{uName}</p>
                                                                <p className="text-[11px] text-slate-400 truncate">
                                                                    {u.position || 'Pegawai'} {uUnit ? `— ${uUnit.name}` : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {isSelected ? (
                                                            <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                                                        ) : (
                                                            <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {technicianName && (
                                        <div className="p-3 bg-blue-50/90 rounded-xl border border-blue-200 text-xs text-blue-900 flex justify-between items-center">
                                            <div>
                                                <div className="font-bold">Teknisi: {technicianName}</div>
                                                <span className="text-[11px] text-blue-700">
                                                    {technicianPhone ? `No WA: ${technicianPhone}` : 'Nomor WhatsApp belum diisi'}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTechnicianName('');
                                                    setTechnicianPhone('');
                                                }}
                                                className="p-1 text-slate-400 hover:text-red-600"
                                            >
                                                <X size={15} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                        Nama Teknisi / Vendor Eksternal *
                                    </label>
                                    {report?.targetDept === 'PEMBANGUNAN' ? (
                                        <select
                                            value={technicianName}
                                            onChange={e => {
                                                const selectedName = e.target.value;
                                                setTechnicianName(selectedName);
                                                const c = contractors.find(ct => ct.name === selectedName);
                                                setTechnicianPhone(c?.phone || '');
                                            }}
                                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">-- Pilih Tukang dari Database --</option>
                                            {contractors.map(c => (
                                                <option key={c.id} value={c.name}>{c.name} {c.specialty ? `(${c.specialty})` : ''}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={technicianName}
                                            onChange={e => setTechnicianName(e.target.value)}
                                            placeholder="Misal: CV Mitra Mandiri / Pak Ahmad"
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    )}

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                            Nomor WhatsApp
                                        </label>
                                        <input
                                            type="text"
                                            value={technicianPhone}
                                            onChange={e => setTechnicianPhone(e.target.value)}
                                            placeholder="Misal: 08123456789"
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                        <input
                                            type="checkbox"
                                            id="createWorkshopOrder"
                                            checked={createWorkshopOrder}
                                            onChange={e => setCreateWorkshopOrder(e.target.checked)}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                        />
                                        <label htmlFor="createWorkshopOrder" className="text-xs font-bold text-blue-900 cursor-pointer">
                                            Buat Pesanan Otomatis ke Workshop Terkait
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* COMPLETION / PROGRESS MODE */}
                    {(isCompletion || isProgress) && (
                        <div className="space-y-4">
                            {report?.assets && report.assets.length > 1 ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                            Metode Tindakan Aset ({report.assets.length} Aset Terdata)
                                        </label>
                                        <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setActionMode('ALL')}
                                                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                                    actionMode === 'ALL'
                                                        ? 'bg-white text-blue-600 shadow-xs'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                <span>Sama untuk Semua</span>
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-extrabold">{report.assets.length}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActionMode('PER_ASSET')}
                                                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                                    actionMode === 'PER_ASSET'
                                                        ? 'bg-white text-blue-600 shadow-xs'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                <span>Berbeda / Pilih per Aset</span>
                                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-extrabold">Fleksibel</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mode 1: Sama untuk Semua */}
                                    {actionMode === 'ALL' ? (
                                        <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                                    {isCompletion ? 'Tindakan Penyelesaian (Semua Aset) *' : 'Update Progres (Semua Aset) *'}
                                                </label>
                                                <textarea
                                                    value={progressNote}
                                                    onChange={e => setProgressNote(e.target.value)}
                                                    placeholder="Contoh: Servis cuci rutin, pembersihan filter, dan cek freon pada seluruh unit AC..."
                                                    rows={3}
                                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs resize-none focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                                    Perbarui Kondisi Semua Aset Sekaligus
                                                </label>
                                                <select
                                                    value={bulkAllCondition}
                                                    onChange={e => setBulkAllCondition(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">-- Tetap / Jangan Ubah Kondisi Fisik --</option>
                                                    <option value="BAIK">Semua Kembali BAIK (Normal / Siap Pakai)</option>
                                                    <option value="RUSAK_RINGAN">Semua RUSAK RINGAN (Butuh Pemantauan)</option>
                                                    <option value="RUSAK_BERAT">Semua RUSAK BERAT (Tidak Dapat Digunakan)</option>
                                                </select>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Mode 2: Berbeda / Pilih per Aset */
                                        <div className="space-y-3">
                                            <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-900 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={assetActionItems.length > 0 && assetActionItems.every(i => i.selected)}
                                                            onChange={e => onToggleSelectAllAssets(e.target.checked)}
                                                            className="rounded text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span>Pilih Beberapa Aset ({assetActionItems.filter(i => i.selected).length} dipilih)</span>
                                                    </label>
                                                    <span className="text-[10px] text-amber-700 font-medium">Terapkan tindakan ke aset tercentang</span>
                                                </div>

                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input
                                                        type="text"
                                                        value={bulkSelectedAction}
                                                        onChange={e => setBulkSelectedAction(e.target.value)}
                                                        placeholder="Tindakan bersama..."
                                                        className="flex-1 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs"
                                                    />
                                                    <select
                                                        value={bulkSelectedCondition}
                                                        onChange={e => setBulkSelectedCondition(e.target.value)}
                                                        className="px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-semibold text-slate-700"
                                                    >
                                                        <option value="">Kondisi...</option>
                                                        <option value="BAIK">BAIK</option>
                                                        <option value="RUSAK_RINGAN">RUSAK RINGAN</option>
                                                        <option value="RUSAK_BERAT">RUSAK BERAT</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={onApplyToSelectedAssets}
                                                        disabled={assetActionItems.filter(i => i.selected).length === 0}
                                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                                                    >
                                                        Terapkan
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                                {assetActionItems.map((item, idx) => (
                                                    <div key={item.assetId} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                                        <div className="flex justify-between items-center gap-2">
                                                            <label className="flex items-center gap-2 cursor-pointer min-w-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={item.selected}
                                                                    onChange={e => {
                                                                        const newItems = [...assetActionItems];
                                                                        newItems[idx].selected = e.target.checked;
                                                                        setAssetActionItems(newItems);
                                                                    }}
                                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="font-bold text-xs text-blue-600 font-mono">{item.code}</span>
                                                                <span className="text-xs font-semibold text-slate-800 truncate">{item.name}</span>
                                                            </label>

                                                            <select
                                                                value={item.condition}
                                                                onChange={e => {
                                                                    const newItems = [...assetActionItems];
                                                                    newItems[idx].condition = e.target.value;
                                                                    setAssetActionItems(newItems);
                                                                }}
                                                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border outline-none ${
                                                                    item.condition === 'BAIK' 
                                                                        ? 'bg-green-50 border-green-200 text-green-800' 
                                                                        : item.condition === 'RUSAK_RINGAN' 
                                                                            ? 'bg-amber-50 border-amber-200 text-amber-800' 
                                                                            : 'bg-red-50 border-red-200 text-red-800'
                                                                }`}
                                                            >
                                                                <option value="BAIK">Kondisi: BAIK</option>
                                                                <option value="RUSAK_RINGAN">Kondisi: RUSAK RINGAN</option>
                                                                <option value="RUSAK_BERAT">Kondisi: RUSAK BERAT</option>
                                                            </select>
                                                        </div>

                                                        <input
                                                            type="text"
                                                            value={item.actionTaken}
                                                            onChange={e => {
                                                                const newItems = [...assetActionItems];
                                                                newItems[idx].actionTaken = e.target.value;
                                                                setAssetActionItems(newItems);
                                                            }}
                                                            placeholder={`Tindakan untuk ${item.code}...`}
                                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                                    Catatan Umum Tambahan (Opsional)
                                                </label>
                                                <textarea
                                                    value={progressNote}
                                                    onChange={e => setProgressNote(e.target.value)}
                                                    placeholder="Catatan tambahan untuk keseluruhan pekerjaan..."
                                                    rows={2}
                                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Single Asset / Non-Asset */
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            {isCompletion ? 'Tindakan Penyelesaian (Final) *' : 'Update Progres Pekerjaan *'}
                                        </label>
                                        <textarea
                                            value={progressNote}
                                            onChange={e => setProgressNote(e.target.value)}
                                            placeholder="Ketik apa yang telah dikerjakan atau diselesaikan..."
                                            rows={3}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                            required
                                        />
                                    </div>

                                    {report?.assets && report.assets.length === 1 && (
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                                Kondisi Akhir Aset ({report.assets[0].code})
                                            </label>
                                            <select
                                                value={bulkAllCondition}
                                                onChange={e => setBulkAllCondition(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="BAIK">Kondisi: BAIK (Normal / Siap Digunakan)</option>
                                                <option value="RUSAK_RINGAN">Kondisi: RUSAK RINGAN (Butuh Pemantauan)</option>
                                                <option value="RUSAK_BERAT">Kondisi: RUSAK BERAT (Tidak Dapat Digunakan)</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Cost Items for Completion */}
                            {isCompletion && (
                                <div className="border-t border-slate-100 pt-3 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Rincian Biaya (Rp)
                                        </label>
                                        <span className="text-xs font-extrabold text-slate-800">
                                            Total: Rp {costItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString('id-ID')}
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        {costItems.map((item, idx) => (
                                            <div key={item.id} className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    value={item.label}
                                                    onChange={e => {
                                                        const newItems = [...costItems];
                                                        newItems[idx].label = e.target.value;
                                                        setCostItems(newItems);
                                                    }}
                                                    placeholder="Nama Komponen / Material"
                                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                                                />
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={e => {
                                                        const newItems = [...costItems];
                                                        newItems[idx].price = parseFloat(e.target.value) || 0;
                                                        setCostItems(newItems);
                                                    }}
                                                    placeholder="Harga"
                                                    className="w-28 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                                                />
                                                <button 
                                                    onClick={() => setCostItems(prev => prev.filter(p => p.id !== item.id))} 
                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setCostItems(prev => [...prev, { id: Math.random().toString(), label: '', price: 0, assetId: report.assets?.[0]?.id || null }])}
                                            className="w-full py-2 border border-dashed border-slate-300 hover:border-blue-500 text-slate-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Plus size={14} /> Tambah Rincian Biaya
                                        </button>
                                    </div>

                                    {/* Upload Nota & Bukti Selesai */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                                Upload Nota Pembayaran
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={e => setReceiptFile(e.target.files[0])}
                                                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                                Foto Bukti Selesai
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*,video/*"
                                                onChange={e => setCompletionPhoto(e.target.files[0])}
                                                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* START MODE */}
                    {isStart && (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex items-start gap-3">
                            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-800 leading-relaxed">
                                Status laporan akan berubah menjadi <strong>Sedang Dikerjakan</strong>. Pelapor dan tim akan menerima notifikasi bahwa perbaikan telah dimulai.
                            </p>
                        </div>
                    )}

                    {/* REJECTION OR ADDITIONAL NOTE */}
                    {!isStart && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                {isRejection ? 'Alasan Penolakan / Pembatalan *' : 'Catatan Tambahan (Opsional)'}
                            </label>
                            <textarea
                                value={actionNote}
                                onChange={e => setActionNote(e.target.value)}
                                placeholder={isRejection ? 'Jelaskan alasan penolakan...' : 'Catatan persetujuan / verifikasi...'}
                                rows={2}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex gap-3 pt-3 border-t border-slate-100">
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={onSubmit}
                            disabled={isAssignment && !technicianName.trim()}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors shadow-sm ${
                                isRejection
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : (isAssignment && !technicianName.trim())
                                        ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                                        : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            Konfirmasi
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
