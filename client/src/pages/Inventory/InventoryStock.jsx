import React, { useState, useEffect } from 'react';
import { Search, Filter, Box } from 'lucide-react';
import api from '../../lib/axios';

export default function InventoryStock() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedItemId, setExpandedItemId] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/items');
      setItems(res.data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Box className="w-6 h-6 mr-2 text-blue-600" />
          Stok Barang (Multi-Gudang)
        </h1>
      </div>

      <div className="bg-white shadow rounded-lg mb-6">
        <div className="p-4 border-b flex flex-wrap gap-4 justify-between items-center bg-gray-50 rounded-t-lg">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari nama atau kode barang..."
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-500">
            *Klik baris barang untuk melihat rincian lokasi gudang
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider border-b">
                <th className="p-4">Kode</th>
                <th className="p-4">Nama Barang</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Satuan</th>
                <th className="p-4 text-center">Min. Stok</th>
                <th className="p-4 text-center">Total Stok</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">Memuat data...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">Tidak ada data stok ditemukan.</td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  const isLowStock = item.totalStock <= item.minStock;

                  return (
                    <React.Fragment key={item.id}>
                      <tr 
                        className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${isLowStock ? 'bg-red-50' : ''}`}
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <td className="p-4 font-mono text-sm">{item.code}</td>
                        <td className="p-4 font-medium">{item.name}</td>
                        <td className="p-4">{item.category?.name || '-'}</td>
                        <td className="p-4 text-sm">{item.unit}</td>
                        <td className="p-4 text-center text-sm">{item.minStock}</td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {item.totalStock}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td colSpan="6" className="p-4">
                            <div className="bg-white border rounded-lg p-4 ml-8 shadow-sm">
                              <h4 className="font-semibold text-sm text-gray-700 mb-3 border-b pb-2">Rincian Lokasi Gudang</h4>
                              {item.stocks && item.stocks.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {item.stocks.map((stock) => (
                                    <div key={stock.id} className="flex justify-between items-center p-3 bg-gray-50 border rounded">
                                      <div>
                                        <div className="font-medium text-sm">{stock.warehouse?.name}</div>
                                        {stock.location && <div className="text-xs text-gray-500">Rak: {stock.location}</div>}
                                      </div>
                                      <div className="text-lg font-bold text-gray-800">{stock.quantity}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 italic">Belum ada stok di gudang manapun.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
