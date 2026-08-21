import { useState, useEffect } from 'react';
import { PackageCheck } from 'lucide-react';

export const FulfillForm = ({ sale, warehouses = [], onSave }) => {
    const [itemUpdates, setItemUpdates] = useState([]);

    useEffect(() => {
        if (sale) {
            let initialItemUpdates = [];
            
            if (sale.items) {
                initialItemUpdates = sale.items.map(i => {
                    let initialStatus = i.status || 'PENDING';
                    
                    // AUTO-DETEKSI STOK HANYA JIKA STATUS LAMA ADALAH PENDING
                    if (initialStatus === 'PENDING' && i.variant && i.variant.stocks) {
                        const totalStock = i.variant.stocks.reduce((acc, s) => acc + s.quantity, 0);
                        if (totalStock >= i.qty) {
                            initialStatus = 'SEDIA';
                        } else {
                            initialStatus = 'TIDAK_TERSEDIA';
                        }
                    }

                    return {
                        saleItemId: i.id,
                        variantId: i.variantId,
                        name: i.itemName,
                        size: i.size,
                        qty: i.qty,
                        oldStatus: i.status || 'PENDING',
                        status: initialStatus,
                        sourceWarehouseId: '',
                        transitWarehouseId: '',
                        returnWarehouseId: '',
                        isMoved: false,
                        totalStock: i.variant?.stocks?.reduce((acc, s) => acc + s.quantity, 0) || 0,
                        stocks: i.variant?.stocks || []
                    };
                });
            }

            // Append Nama Dada from note if present
            if (sale.note && sale.note.includes('[NAMADADA:')) {
                const match = sale.note.match(/\[NAMADADA:(\d+):(\d+)(?::([A-Z_]+))?\]/);
                if (match) {
                    const ndQty = parseInt(match[1]);
                    const ndStatus = match[3] || 'PENDING';
                    initialItemUpdates.push({
                        saleItemId: 'NAMADADA',
                        name: 'Nama Dada (Bordir)',
                        size: '-',
                        qty: ndQty,
                        oldStatus: ndStatus,
                        status: ndStatus,
                        sourceWarehouseId: '',
                        transitWarehouseId: '',
                        returnWarehouseId: '',
                        isMoved: false,
                        totalStock: 9999, // Nama dada tidak pakai stok
                        stocks: []
                    });
                }
            }
            
            setItemUpdates(initialItemUpdates);
        }
    }, [sale]);

    const handleStatusChange = (index, newStatus) => {
        const newUpdates = [...itemUpdates];
        newUpdates[index].status = newStatus;
        setItemUpdates(newUpdates);
    };

    const handleWhChange = (index, field, value) => {
        const newUpdates = [...itemUpdates];
        newUpdates[index][field] = value;
        setItemUpdates(newUpdates);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validation
        for (const item of itemUpdates) {
            if (item.status === item.oldStatus) continue;
            if (item.saleItemId === 'NAMADADA') continue; // Bypass warehouse validation for Nama Dada

            if (['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA'].includes(item.oldStatus) && item.status === 'SEDIA') {
                if (item.isMoved) {
                    if (!item.sourceWarehouseId || !item.transitWarehouseId) {
                        alert(`Pilih gudang asal dan gudang tujuan untuk memindahkan ${item.name}`);
                        return;
                    }
                } else {
                    if (!item.sourceWarehouseId) {
                        alert(`Pilih gudang tempat pengambilan untuk ${item.name}`);
                        return;
                    }
                }
            } else if (item.status === 'DIAMBIL') {
                // No validation needed for DIAMBIL, backend will handle it based on previous mutation history!
            } else if (item.status === 'BATAL' && item.oldStatus === 'SEDIA') {
                if (!item.transitWarehouseId || !item.returnWarehouseId) {
                    alert(`Pilih gudang transit dan gudang pengembalian untuk membatalkan ${item.name}`);
                    return;
                }
            } else if (item.status === 'BATAL' && item.oldStatus === 'DIAMBIL') {
                if (!item.returnWarehouseId) {
                    alert(`Pilih gudang pengembalian untuk ${item.name}`);
                    return;
                }
            } else if (item.status === 'SEDIA' && item.oldStatus === 'DIAMBIL') {
                if (!item.returnWarehouseId) { // acting as transit
                    alert(`Pilih gudang transit (pengembalian) untuk ${item.name}`);
                    return;
                }
            }
        }

        const payload = itemUpdates
            .filter(i => i.status !== i.oldStatus)
            .map(i => ({
                saleItemId: i.saleItemId,
                status: i.status,
                sourceWarehouseId: i.sourceWarehouseId,
                transitWarehouseId: i.isMoved ? i.transitWarehouseId : (i.status === 'SEDIA' ? i.sourceWarehouseId : (i.transitWarehouseId || i.returnWarehouseId)),
                returnWarehouseId: i.returnWarehouseId
            }));

        if (payload.length === 0) {
            alert('Tidak ada perubahan status item.');
            return;
        }

        onSave(payload);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
                Kelola status setiap barang pada pesanan <strong>{sale?.code}</strong> ({sale?.customerName}).
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto bg-slate-50">
                {itemUpdates.map((item, idx) => {
                    const changed = item.status !== item.oldStatus;
                    return (
                        <div key={item.saleItemId} className={`p-4 border-b border-slate-200 \${changed ? 'bg-blue-50/50' : 'bg-white'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-bold text-slate-800">{item.name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <span>Ukuran: {item.size}</span>
                                        <span>|</span>
                                        <span>Qty: {item.qty}</span>
                                        {item.totalStock !== undefined && item.saleItemId !== 'NAMADADA' && (
                                            <>
                                                <span>|</span>
                                                <span className={`font-medium ${item.totalStock >= item.qty ? 'text-green-600' : 'text-rose-600'}`}>
                                                    Stok: {item.totalStock}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500 mb-1">Status Lama: <span className="font-bold">{item.oldStatus}</span></div>
                                    <select 
                                        className="border border-slate-300 rounded px-2 py-1 text-sm font-bold shadow-sm"
                                        value={item.status}
                                        onChange={(e) => handleStatusChange(idx, e.target.value)}
                                    >
                                        <option value="PENDING">PENDING</option>
                                        <option value="SEDIA">SEDIA (Masuk Transit)</option>
                                        <option value="TIDAK_TERSEDIA">TIDAK TERSEDIA</option>
                                        <option value="INDENT">INDENT</option>
                                        <option value="DIAMBIL">DIAMBIL (Diserahkan)</option>
                                        <option value="BATAL">BATAL</option>
                                    </select>
                                </div>
                            </div>
                            
                            {/* Dynamic Dropdowns Based on Selection */}
                            <div className="mt-3 space-y-2 text-sm">
                                {(item.saleItemId !== 'NAMADADA' && ['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA'].includes(item.oldStatus) && item.status === 'SEDIA') && (
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-2 cursor-pointer bg-slate-100 p-2 rounded w-fit">
                                            <input type="checkbox" checked={item.isMoved} onChange={(e) => handleWhChange(idx, 'isMoved', e.target.checked)} className="rounded" />
                                            <span className="text-xs font-bold text-slate-700">Apakah barang dipindah gudang?</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <select className="flex-1 border border-slate-200 rounded p-1.5" required
                                                value={item.sourceWarehouseId} onChange={(e) => handleWhChange(idx, 'sourceWarehouseId', e.target.value)}>
                                                <option value="">{item.isMoved ? '-- Gudang Asal --' : '-- Gudang Tempat Pengambilan --'}</option>
                                                {warehouses
                                                    .filter(w => {
                                                        const st = item.stocks?.find(s => s.warehouseId === w.id);
                                                        return st && st.quantity > 0;
                                                    })
                                                    .map(w => {
                                                        const st = item.stocks?.find(s => s.warehouseId === w.id);
                                                        return <option key={w.id} value={w.id}>{w.name} (Stok: {st.quantity})</option>;
                                                    })
                                                }
                                            </select>
                                            {item.isMoved && (
                                                <select className="flex-1 border border-slate-200 rounded p-1.5" required={item.isMoved}
                                                    value={item.transitWarehouseId} onChange={(e) => handleWhChange(idx, 'transitWarehouseId', e.target.value)}>
                                                    <option value="">-- Gudang Tujuan --</option>
                                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {item.saleItemId !== 'NAMADADA' && item.status === 'DIAMBIL' && (
                                    <div>
                                        {item.oldStatus === 'SEDIA' ? (
                                            <p className="text-xs text-slate-500 italic mt-1">
                                                *Stok otomatis terpotong dari riwayat gudang asal pengambilan.
                                            </p>
                                        ) : (
                                            <select className="w-full border border-slate-200 rounded p-1.5" required
                                                value={item.sourceWarehouseId} onChange={(e) => handleWhChange(idx, 'sourceWarehouseId', e.target.value)}>
                                                <option value="">-- Terjual Langsung Dari Gudang Mana? --</option>
                                                {warehouses
                                                    .filter(w => {
                                                        const st = item.stocks?.find(s => s.warehouseId === w.id);
                                                        return st && st.quantity > 0;
                                                    })
                                                    .map(w => {
                                                        const st = item.stocks?.find(s => s.warehouseId === w.id);
                                                        return <option key={w.id} value={w.id}>{w.name} (Stok: {st.quantity})</option>;
                                                    })
                                                }
                                            </select>
                                        )}
                                    </div>
                                )}

                                {(item.saleItemId !== 'NAMADADA' && item.status === 'BATAL' && ['SEDIA', 'DIAMBIL'].includes(item.oldStatus)) && (
                                    <div className="flex gap-2">
                                        {item.oldStatus === 'SEDIA' && (
                                            <select className="flex-1 border border-slate-200 rounded p-1.5" required
                                                value={item.transitWarehouseId} onChange={(e) => handleWhChange(idx, 'transitWarehouseId', e.target.value)}>
                                                <option value="">-- Berada di Gudang Transit Mana? --</option>
                                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                            </select>
                                        )}
                                        <select className="flex-1 border border-slate-200 rounded p-1.5" required
                                            value={item.returnWarehouseId} onChange={(e) => handleWhChange(idx, 'returnWarehouseId', e.target.value)}>
                                            <option value="">-- Gudang Tujuan Pengembalian --</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2">
                <PackageCheck size={18} /> Simpan Perubahan Status
            </button>
        </form>
    );
};
