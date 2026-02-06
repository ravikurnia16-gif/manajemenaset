import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Box, ShoppingCart, ArrowLeftRight, Trash2, FileCheck, FileText, Database, Settings, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

const Sidebar = () => {
    const location = useLocation();
    const isActive = (path) => location.pathname.startsWith(path);

    const navItemClass = (path) => cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors mb-1",
        isActive(path) ? "bg-blue-600 text-white shadow-lg" : "text-slate-300 hover:bg-slate-800 hover:text-white"
    );

    return (
        <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-800">
                <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">AMIS</div>
                <div className="text-xs text-slate-500 mt-1">Asset Management System</div>
            </div>

            <nav className="flex-1 p-4 overflow-y-auto">
                <Link to="/dashboard" className={navItemClass('/dashboard')}><LayoutDashboard size={20} /> Dashboard</Link>
                <Link to="/aset" className={navItemClass('/aset')}><Box size={20} /> Data Aset</Link>
                <Link to="/request" className={navItemClass('/request')}><ShoppingCart size={20} /> Pengadaan</Link>
                <Link to="/mutasi" className={navItemClass('/mutasi')}><ArrowLeftRight size={20} /> Mutasi</Link>
                <Link to="/penghapusan" className={navItemClass('/penghapusan')}><Trash2 size={20} /> Penghapusan</Link>
                <Link to="/validasi" className={navItemClass('/validasi')}><FileCheck size={20} /> Validasi</Link>
                <div className="pt-4 mt-4 border-t border-slate-700">
                    <h3 className="px-3 text-xs uppercase text-slate-500 mb-2 font-semibold">Reports & Master</h3>
                    <Link to="/laporan" className={navItemClass('/laporan')}><FileText size={20} /> Laporan</Link>
                    <Link to="/master" className={navItemClass('/master')}><Database size={20} /> Master Data</Link>
                    <Link to="/settings" className={navItemClass('/settings')}><Settings size={20} /> Pengaturan</Link>
                </div>
            </nav>

            <div className="p-4 border-t border-slate-800">
                <button className="flex items-center gap-3 p-3 w-full rounded-lg text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors">
                    <LogOut size={20} /> Logout
                </button>
            </div>
        </div>
    );
};
export default Sidebar;
