import { useState, useRef, useEffect } from 'react';
import { Download, Upload, Plus, Search, Filter, Edit, Trash2, Building2, MapPin, Printer, QrCode } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { LabelPrint, BatchLabelPrint } from '../components/LabelPrint';
import { useReactToPrint } from 'react-to-print';
import api from '../lib/axios';

const AssetList = () => {
    const navigate = useNavigate();
    const [units, setUnits] = useState([]);
    const [rooms, setRooms] = useState([]);
    // Action Modal State
    const [actionModal, setActionModal] = useState({ isOpen: false, type: null }); // type: 'export' | 'print'
    const [targetUnitId, setTargetUnitId] = useState('');

    const getTargetData = () => {
        if (!targetUnitId) return filteredAssets;
        return assets.filter(a => a.unitId === parseInt(targetUnitId));
    };

    const handleActionConfirmation = () => {
        const data = getTargetData();
        if (data.length === 0) {
            alert('Tidak ada data aset untuk unit yang dipilih.');
            return;
        }

        if (actionModal.type === 'export') {
            handleExport(data);
        } else if (actionModal.type === 'print') {
            performBatchPrint(data);
        }
        setActionModal({ isOpen: false, type: null });
    };

    const performBatchPrint = (data) => {
        setBatchPrintAssets(data);
        setTimeout(() => {
            handleBatchPrint();
        }, 500); // Give time for state update and re-render
    };

    // Print Handling
    const [printAsset, setPrintAsset] = useState(null);
    const [batchPrintAssets, setBatchPrintAssets] = useState([]); // State for targeted batch print
    const printRef = useRef();
    const batchPrintRef = useRef();

    const handlePrintSingle = useReactToPrint({
        contentRef: printRef,
        onAfterPrint: () => setPrintAsset(null),
    });

    const handleBatchPrint = useReactToPrint({
        contentRef: batchPrintRef,
        onAfterPrint: () => setBatchPrintAssets([]), // Reset after print
    });

    // ... (rest of code)

    // Update handleExport to accept data
    const handleExport = (dataSource = filteredAssets) => {
        const now = new Date();
        const exportData = dataSource.map((a, index) => {
            // ... existing mapping logic ...
            const purchaseDate = new Date(a.purchaseDate);
            const monthsElapsed = Math.max(0, (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth()));
            const totalMonths = (a.usefulLife || 5) * 12;
            const monthlyDepreciation = Math.round(a.price / totalMonths);
            const accumulatedDepreciation = Math.min(a.price, monthlyDepreciation * monthsElapsed);
            const bookValue = Math.max(0, a.price - accumulatedDepreciation);

            // Days calculation (rough estimation for display)
            const msPerDay = 24 * 60 * 60 * 1000;
            const daysElapsed = Math.max(0, Math.floor((now - purchaseDate) / msPerDay));

            return {
                'No': index + 1,
                'Kode': a.code,
                'Nama': a.name,
                'Merek': a.brand || '-',
                'Vendor': a.vendor?.name || '-',
                'Tanggal Perolehan': a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('id-ID') : '-',
                'Status Perolehan': 'Beli Baru', // Placeholder
                'Harga Perolehan': a.price,
                'Kategori': a.category?.name || '-',
                'Sumber Dana': a.sourceOfFunds || 'Mandiri',
                'Kondisi': a.condition,
                'Nama Ruangan': a.room?.name || '-',
                'Lokasi': a.room?.building || '-',
                'Nama Unit/Bidang': a.unit?.name || '-',
                'Penjual/Penghibah': a.vendor?.name || '-',
                'Umur Ekonomis': a.usefulLife + ' Tahun',
                'Nilai Penyusutan per Bulan': monthlyDepreciation,
                'Jumlah Bulan Penyusutan': Math.min(monthsElapsed, totalMonths),
                'Jurnal Penyusutan (Bulanan)': `D: Beban Penyusutan / K: Akum. Penyusutan (${monthlyDepreciation})`,
                'Jumlah Nominal Penyusutan Terkini': accumulatedDepreciation,
                'Perkiraan Hari Penyusutan Terkini': daysElapsed,
                'Jumlah Hari Penyusutan Terkini': daysElapsed,
                'Nilai Buku': bookValue,
                'Tanggal PHPP': '-',
                'Hari Penyusutan Sebelum PHPP': '-',
                'Nilai Penyusutan Saat PHPP': '-',
                'Nilai Buku Saat PHPP': '-',
                'Status PHPP': '-',
                'No. Bukti PHPP': '-',
                'Nama Penerima/Pembeli': '-',
                'Unit Penerima/Pembeli': '-',
                'Harga Jual': 0,
                'Laba/Rugi Penjualan': 0
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data Aset & Penyusutan");
        XLSX.writeFile(wb, `Laporan_Aset_Unit_${targetUnitId || 'All'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // ... imports ...

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ... Header ... */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    {/* ... Title ... */}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setActionModal({ isOpen: true, type: 'print' })} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 flex items-center gap-2 shadow-sm">
                        <Printer size={16} /> Batch Print QR
                    </button>
                    <button onClick={handleTemplateDownload} className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors">
                        Download Template
                    </button>
                    <button onClick={() => setActionModal({ isOpen: true, type: 'export' })} className="px-4 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2">
                        <Download size={16} /> Export
                    </button>
                    {/* ... Import & Add Buttons ... */}
                </div>
            </div>

            {/* Action Modal */}
            {actionModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">
                            {actionModal.type === 'export' ? 'Export Data Aset' : 'Cetak QR Code Batch'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Pilih Lingkup Data</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                                        <input
                                            type="radio"
                                            name="scope"
                                            checked={targetUnitId === ''}
                                            onChange={() => setTargetUnitId('')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-800">Sesuai Filter Tampilan</div>
                                            <div className="text-xs text-slate-500">Data yang tampil di tabel saat ini ({filteredAssets.length} item)</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                                        <input
                                            type="radio"
                                            name="scope"
                                            checked={targetUnitId !== ''}
                                            onChange={() => {
                                                if (units.length > 0) setTargetUnitId(units[0].id.toString());
                                            }}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-800">Pilih Unit Tertentu</div>
                                            {targetUnitId !== '' && (
                                                <select
                                                    value={targetUnitId}
                                                    onChange={(e) => setTargetUnitId(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="mt-2 w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                                >
                                                    {units.map(u => (
                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setActionModal({ isOpen: false, type: null })}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleActionConfirmation}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-200"
                            >
                                {actionModal.type === 'export' ? 'Download Excel' : 'Cetak QR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {/* ... Filter Bar ... */}

                {/* ... Table ... */}

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span>Tampilkan:</span>
                            <select
                                value={itemsPerPage}
                                onChange={e => setItemsPerPage(parseInt(e.target.value))}
                                className="bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {[10, 25, 50, 100, 500, 1000].map(limit => (
                                    <option key={limit} value={limit}>{limit}</option>
                                ))}
                            </select>
                        </div>
                        <span>Menampilkan {paginatedAssets.length} dari {filteredAssets.length} data</span>
                    </div>

                    {/* ... Pagination Buttons ... */}
                </div>
            </div>

            {/* Hidden Print Components */}
            <div className="hidden">
                {printAsset && <LabelPrint ref={printRef} asset={printAsset} />}
                {/* Use batchPrintAssets if available, else filteredAssets */}
                <BatchLabelPrint ref={batchPrintRef} assets={batchPrintAssets.length > 0 ? batchPrintAssets : filteredAssets} />
            </div>
        </div>
    );
};

export default AssetList;
