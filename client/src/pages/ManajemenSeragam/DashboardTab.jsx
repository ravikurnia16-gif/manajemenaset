import { Shirt, Package, AlertCircle, ShoppingCart } from 'lucide-react';
import { StatCard, Badge } from './UIComponents';

export const DashboardTab = ({ stats }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Item" value={stats.totalItems || 0} icon={<Shirt size={20} />} color="bg-blue-500" sub={`${stats.totalVariants || 0} variasi ukuran`} />
            <StatCard title="Total Stok" value={(stats.totalStock || 0).toLocaleString('id-ID')} icon={<Package size={20} />} color="bg-green-500" sub={`${stats.warehouses || 0} gudang aktif`} />
            <StatCard title="Stok Menipis" value={stats.lowStockCount || 0} icon={<AlertCircle size={20} />} color="bg-orange-500" sub="Perlu restock" />
            <StatCard title="Pesanan" value={stats.totalSales || 0} icon={<ShoppingCart size={20} />} color="bg-purple-500" sub={`${stats.pendingSales || 0} pending`} />
        </div>

        {stats.lowStockItems && stats.lowStockItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                    <AlertCircle size={16} className="text-orange-500" />
                    <h3 className="font-bold text-slate-700 text-sm">Peringatan Stok Menipis</h3>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="p-3 text-left">Barang</th>
                            <th className="p-3 text-center">Ukuran</th>
                            <th className="p-3 text-center">Gudang</th>
                            <th className="p-3 text-center">Stok</th>
                            <th className="p-3 text-center">Min</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {stats.lowStockItems.map((s, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-800">{s.itemName}</td>
                                <td className="p-3 text-center"><Badge>{s.sizeName}</Badge></td>
                                <td className="p-3 text-center text-slate-500 text-xs">{s.warehouseName}</td>
                                <td className="p-3 text-center"><span className="text-red-600 font-extrabold">{Number(s.quantity)}</span></td>
                                <td className="p-3 text-center text-slate-400">{Number(s.minStock)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);
