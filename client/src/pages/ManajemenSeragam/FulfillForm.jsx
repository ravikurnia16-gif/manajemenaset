import { useState, useEffect } from 'react';
import { PackageCheck } from 'lucide-react';

export const FulfillForm = ({ sale, warehouses = [], onSave }) => {
    const [itemsToFulfill, setItemsToFulfill] = useState([]);
    const [masterWarehouse, setMasterWarehouse] = useState('');

    useEffect(() => {
        if (sale) {
            let pending = sale.items.filter(i => i.qty > i.qtyDelivered);
            if (sale.selectedPackageId) {
                pending = pending.filter(i => String(i.salePackageId) === String(sale.selectedPackageId));
            }
            
            setItemsToFulfill(pending.map(i => ({
                saleItemId: i.id,
                variantId: i.variantId,
                name: i.itemName,
                size: i.size,
                needed: i.qty - i.qtyDelivered,
                qty: i.qty - i.qtyDelivered,
                warehouseId: ''
            })));
        }
    }, [sale]);

    const handleMasterWarehouseChange = (e) => {
        const whId = e.target.value;
        setMasterWarehouse(whId);
        setItemsToFulfill(prev => prev.map(item => ({ ...item, warehouseId: whId })));
    };

    const updateItem = (id, field, value) => {
        setItemsToFulfill(prev => prev.map(item => 
            item.saleItemId === id ? { ...item, [field]: value } : item
        ));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Filter out items with 0 qty or no warehouse selected
        const validFulfillments = itemsToFulfill.filter(i => i.qty > 0 && i.warehouseId);
        if (validFulfillments.length === 0) {
            alert('Pilih setidaknya 1 gudang pengeluaran untuk barang yang akan diproses.');
            return;
        }
        onSave(validFulfillments);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
                Silakan tentukan gudang pengeluaran untuk setiap barang pada pesanan <strong>{sale?.code}</strong> ({sale?.customerName}).
            </p>
            
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center justify-between gap-4">
                <label className="text-sm font-bold text-blue-800 whitespace-nowrap">Terapkan ke semua barang:</label>
                <select 
                    className="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" 
                    value={masterWarehouse} 
                    onChange={handleMasterWarehouseChange}
                >
                    <option value="">-- Pilih Gudang untuk Semua --</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[40vh] overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                        <tr>
                            <th className="p-3 text-left">Rincian Barang</th>
                            <th className="p-3 text-center w-24">Jumlah</th>
                            <th className="p-3 text-left w-48">Gudang Pengeluaran</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {itemsToFulfill.map(item => (
                            <tr key={item.saleItemId} className="bg-white">
                                <td className="p-3">
                                    <div className="font-bold text-slate-800">{item.name}</div>
                                    <div className="text-xs text-slate-500">Ukuran: {item.size} | Kurang: <span className="font-bold text-rose-500">{item.needed}</span></div>
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="number" 
                                        min="0" 
                                        max={item.needed}
                                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={item.qty} 
                                        onChange={e => updateItem(item.saleItemId, 'qty', parseInt(e.target.value) || 0)}
                                    />
                                </td>
                                <td className="p-3">
                                    <select 
                                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={item.warehouseId} 
                                        onChange={e => updateItem(item.saleItemId, 'warehouseId', e.target.value)}
                                        required={item.qty > 0}
                                    >
                                        <option value="">-- Gudang --</option>
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2">
                <PackageCheck size={18} /> Proses & Keluarkan Stok
            </button>
        </form>
    );
};
