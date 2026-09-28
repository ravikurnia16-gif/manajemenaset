import { 
    Box, Warehouse, Wrench, Truck, FileSignature, Server, Palette, Layers 
} from 'lucide-react';
import dayjs from 'dayjs';

export const DIVISION_TAGS = [
    { key: 'ASET', label: 'Staff Manajemen Aset', icon: Box, color: 'bg-blue-500' },
    { key: 'GUDANG', label: 'Gudang & Logistik', icon: Warehouse, color: 'bg-amber-500' },
    { key: 'TEKNISI', label: 'Teknisi & Maintenance', icon: Wrench, color: 'bg-emerald-500' },
    { key: 'KENDARAAN', label: 'Armada Kendaraan', icon: Truck, color: 'bg-indigo-500' },
    { key: 'KEUANGAN', label: 'Staff Keuangan & Administrasi', icon: FileSignature, color: 'bg-violet-500' },
    { key: 'IT', label: 'Staff Infrastruktur IT', icon: Server, color: 'bg-cyan-500' },
    { key: 'DESAINER', label: 'Staff Desainer', icon: Palette, color: 'bg-rose-500' },
    { key: 'UMUM', label: 'Operasional Umum', icon: Layers, color: 'bg-slate-500' }
];

export const ROUTINE_TEMPLATES = {
    ASET: [],
    GUDANG: [],
    TEKNISI: [],
    KENDARAAN: [],
    KEUANGAN: [],
    IT: [],
    DESAINER: [],
    UMUM: []
};

export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#f43f5e'];

export const computeMonitoringDateRange = (preset) => {
    const now = dayjs();
    if (preset === 'TODAY') {
        const todayStr = now.format('YYYY-MM-DD');
        return { startDate: todayStr, endDate: todayStr };
    }
    if (preset === 'LAST_7_DAYS') {
        return {
            startDate: now.subtract(6, 'day').format('YYYY-MM-DD'),
            endDate: now.format('YYYY-MM-DD')
        };
    }
    if (preset === 'THIS_WEEK') {
        // Monday as first day of week in Indonesia
        const monday = now.startOf('week').add(1, 'day');
        return {
            startDate: monday.format('YYYY-MM-DD'),
            endDate: now.format('YYYY-MM-DD')
        };
    }
    if (preset === 'THIS_MONTH') {
        return {
            startDate: now.startOf('month').format('YYYY-MM-DD'),
            endDate: now.format('YYYY-MM-DD')
        };
    }
    return { startDate: '', endDate: '' };
};
