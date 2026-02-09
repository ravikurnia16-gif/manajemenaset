import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Box, ShoppingCart, ArrowLeftRight, Trash2, FileCheck, FileText, Database, Settings, LogOut, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [openProcurement, setOpenProcurement] = useState(true);

    const isActive = (path) => location.pathname.startsWith(path);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/login');
    };

    const navItemClass = (path) => cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors mb-1",
        isActive(path) ? "bg-blue-600 text-white shadow-lg" : "text-slate-300 hover:bg-slate-800 hover:text-white"
    );

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'ADMIN_UNIT'].includes(user.role);

    return (
        <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-800 flex flex-col items-center">
                <img src="/logo_sarpras.png" alt="Logo Sarpras" className="w-20 h-20 object-contain mb-2" />
                <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">SARPRAS DEI</div>
                <div className="text-[10px] text-slate-500">Sistem Sarana Prasarana</div>
            </div>

            <nav className="flex-1 p-4 overflow-y-auto">
                <Link to="/dashboard" className={navItemClass('/dashboard')}><LayoutDashboard size={20} /> Dashboard</Link>
                <Link to="/aset" className={navItemClass('/aset')}><Box size={20} /> Data Aset</Link>

                {/* Menu Pengadaan (Collapsible) */}
                <div>
                    <button
                        onClick={() => setOpenProcurement(!openProcurement)}
                        className="flex items-center justify-between w-full p-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white mb-1"
                    >
                        <div className="flex items-center gap-3">
                            <ShoppingCart size={20} />
                            <span>Pengadaan</span>
                        </div>
                        {openProcurement ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {openProcurement && (
                        <div className="ml-4 pl-4 border-l border-slate-700 space-y-1">
                            <Link to="/rkb" className={navItemClass('/rkb').replace('p-3', 'p-2 text-sm')}>
                                <Calendar size={16} /> Perencanaan (RKB)
                            </Link>
                            <Link to="/procurements" className={navItemClass('/procurements').replace('p-3', 'p-2 text-sm')}>
                                <ShoppingCart size={16} /> Request (Pengajuan)
                            </Link>
                        </div>
                    )}
                </div>

                <Link to="/mutasi" className={navItemClass('/mutasi')}><ArrowLeftRight size={20} /> Mutasi</Link>
                <Link to="/penghapusan" className={navItemClass('/penghapusan')}><Trash2 size={20} /> Penghapusan</Link>
                <Link to="/validasi" className={navItemClass('/validasi')}><FileCheck size={20} /> Validasi</Link>

                {(isAdmin || user.role === 'AUDITOR') && (
                    <div className="pt-4 mt-4 border-t border-slate-700">
                        <h3 className="px-3 text-xs uppercase text-slate-500 mb-2 font-semibold">Reports & Master</h3>
                        <Link to="/laporan" className={navItemClass('/laporan')}><FileText size={20} /> Laporan</Link>
                        {isAdmin && (
                            <>
                                <Link to="/master" className={navItemClass('/master')}><Database size={20} /> Master Data</Link>
                                <Link to="/settings" className={navItemClass('/settings')}><Settings size={20} /> Pengaturan</Link>
                            </>
                        )}
                    </div>
                )}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 p-3 w-full rounded-lg text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
                >
                    <LogOut size={20} /> Logout
                </button>
            </div>
        </div>
    );
};
export default Sidebar;
