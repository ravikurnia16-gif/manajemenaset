import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Box, ShoppingCart, ArrowLeftRight, Trash2, FileCheck, FileText, Database, Settings, LogOut, Calendar, ChevronDown, ChevronRight, Truck, Warehouse, Users, UserCog, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

const Sidebar = ({ isOpen = true }) => {
    const location = useLocation();
    const navigate = useNavigate();

    // State for collapsible menus
    const [openMenus, setOpenMenus] = useState({
        assets: true,
        vehicles: false,
        warehouse: false,
        personnel: false
    });

    const toggleMenu = (menu) => {
        setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
    };

    const isActive = (path) => location.pathname.startsWith(path);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/login');
    };

    const navItemClass = (path) => cn(
        "flex items-center gap-3 p-2.5 rounded-lg transition-colors mb-1 text-sm font-medium",
        isActive(path) ? "bg-blue-600 text-white shadow-lg" : "text-slate-300 hover:bg-slate-800 hover:text-white"
    );

    const subNavItemClass = (path) => cn(
        "flex items-center gap-3 p-2 rounded-lg transition-colors mb-1 text-sm pl-4 border-l-2 ml-3",
        isActive(path) ? "border-blue-500 text-blue-400 bg-slate-800/50" : "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"
    );

    let user = {};
    try {
        user = JSON.parse(localStorage.getItem('user')) || {};
    } catch (e) {
        console.error("Failed to parse user from localStorage", e);
    }
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG', 'ADMIN_UNIT'].includes(user?.role);

    const renderCollapsible = (key, icon, label, children) => (
        <div className="mb-2">
            <button
                onClick={() => toggleMenu(key)}
                className={cn(
                    "flex items-center justify-between w-full p-2.5 rounded-lg mb-1 transition-colors",
                    openMenus[key] ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    !isOpen && "justify-center px-2"
                )}
                title={!isOpen ? label : ""}
            >
                <div className={cn("flex items-center gap-3 font-semibold", !isOpen && "justify-center w-full")}>
                    {icon}
                    <span className={cn("transition-all duration-300", !isOpen ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100")}>{label}</span>
                </div>
                {isOpen && (openMenus[key] ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
            </button>

            <div className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                (openMenus[key] && isOpen) ? "max-h-[500px] opacity-100 mt-1" : "max-h-0 opacity-0"
            )}>
                <div className="flex flex-col space-y-0.5">
                    {children}
                </div>
            </div>
        </div>
    );

    return (
        <div className={cn(
            "bg-slate-900 text-white min-h-screen flex flex-col shadow-xl z-20 flex-shrink-0 transition-all duration-300 ease-in-out border-r border-slate-800",
            isOpen ? "w-64" : "w-0 overflow-hidden border-none"
        )}>
            <div className={cn(
                "border-b border-slate-800 bg-slate-900 sticky top-0 z-10 flex items-center transition-all duration-300 overflow-hidden whitespace-nowrap",
                isOpen ? "p-5 justify-start h-auto opacity-100" : "p-0 h-0 opacity-0"
            )}>
                <div className="flex items-center gap-3">
                    <img src="/Sarpras.jpeg" className="w-10 h-10 rounded-lg object-cover shadow-lg shadow-blue-500/20 shrink-0" alt="Logo" />
                    <div className="flex flex-col justify-center">
                        <span className={cn(
                            "text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent transition-all duration-300",
                            !isOpen ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
                        )}>SARPRAS DEI</span>
                        <div className={cn(
                            "text-[9px] text-slate-500 tracking-[0.15em] uppercase font-bold transition-all duration-300 whitespace-nowrap overflow-hidden",
                            !isOpen ? "w-0 opacity-0" : "w-auto opacity-100"
                        )}>Sistem Manajemen SarPras</div>
                    </div>
                </div>
            </div>

            <nav className={cn(
                "flex-1 overflow-y-auto custom-scrollbar space-y-4 transition-all duration-300",
                isOpen ? "p-3" : "p-0 overflow-hidden"
            )}>

                <Link to="/dashboard" className={navItemClass('/dashboard')}><LayoutDashboard size={18} /> Dashboard</Link>
                <Link to="/sarpras/rules" className={navItemClass('/sarpras/rules')}><FileText size={18} /> Dokumen Sarpras</Link>

                {/* 1. Manajemen Aset */}
                {renderCollapsible('assets', <Box size={18} />, 'Manajemen Aset', (
                    <>
                        <Link to="/aset" className={subNavItemClass('/aset')}>
                            <Box size={16} /> Data Aset
                        </Link>
                        <Link to="/rkb" className={subNavItemClass('/rkb')}>
                            <Calendar size={16} /> Perencanaan (RKB)
                        </Link>
                        <Link to="/procurements" className={subNavItemClass('/procurements')}>
                            <ShoppingCart size={16} /> Pengadaan
                        </Link>

                        <Link to="/pemeliharaan" className={subNavItemClass('/pemeliharaan')}>
                            <FileCheck size={16} /> Pemeliharaan
                        </Link>

                        <Link to="/mutasi" className={subNavItemClass('/mutasi')}>
                            <ArrowLeftRight size={16} /> Mutasi
                        </Link>
                        <Link to="/penghapusan" className={subNavItemClass('/penghapusan')}>
                            <Trash2 size={16} /> Penghapusan
                        </Link>
                    </>
                ))}

                {/* 2. Manajemen Kendaraan */}
                {renderCollapsible('vehicles', <Truck size={18} />, 'Manajemen Kendaraan', (
                    <>
                        <Link to="/kendaraan/dashboard" className={subNavItemClass('/kendaraan/dashboard')}>
                            <LayoutDashboard size={16} /> Dashboard
                        </Link>
                        <Link to="/kendaraan/data" className={subNavItemClass('/kendaraan/data')}>
                            <Truck size={16} /> Data Kendaraan
                        </Link>
                        <Link to="/kendaraan/peminjaman" className={subNavItemClass('/kendaraan/peminjaman')}>
                            <Calendar size={16} /> Peminjaman
                        </Link>
                        <Link to="/kendaraan/pemeliharaan" className={subNavItemClass('/kendaraan/pemeliharaan')}>
                            <Settings size={16} /> Pemeliharaan
                        </Link>
                    </>
                ))}

                {/* 3. Manajemen Pergudangan */}
                {renderCollapsible('warehouse', <Warehouse size={18} />, 'Gudang & Logistik', (
                    <>
                        <Link to="/gudang/dashboard" className={subNavItemClass('/gudang/dashboard')}>
                            <LayoutDashboard size={16} /> Dashboard
                        </Link>
                        <Link to="/gudang/stok" className={subNavItemClass('/gudang/stok')}>
                            <Box size={16} /> Stok Barang
                        </Link>
                        <Link to="/gudang/transaksi" className={subNavItemClass('/gudang/transaksi')}>
                            <ArrowLeftRight size={16} /> Transaksi
                        </Link>
                        <Link to="/gudang/pesanan" className={subNavItemClass('/gudang/pesanan')}>
                            <ShoppingCart size={16} /> Pesanan Seragam
                        </Link>
                    </>
                ))}

                {/* 4. Manajemen Personalia - Restricted to Global Access or Sarpras Unit */}
                {(['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG'].includes(user.role) ||
                    user.unit?.name?.toLowerCase().includes('sarana dan prasarana')) &&
                    renderCollapsible('personnel', <Users size={18} />, 'Personalia', (
                        <>
                            <Link to="/personalia/staf" className={subNavItemClass('/personalia/staf')}>
                                <UserCog size={16} /> Data Staf
                            </Link>
                            {/* Only Sarpras or SUPER_ADMIN/ADMIN_ASET can see active reports & assignments */}
                            {(['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role) || user.unit?.name?.toLowerCase().includes('sarana dan prasarana')) && (
                                <>
                                    <Link to="/personalia/laporan" className={subNavItemClass('/personalia/laporan')}>
                                        <FileText size={16} /> Laporan Staff
                                    </Link>
                                    <Link to="/personalia/penugasan" className={subNavItemClass('/personalia/penugasan')}>
                                        <FileCheck size={16} /> Penugasan
                                    </Link>
                                </>
                            )}
                            <Link to="/personalia/struktur" className={subNavItemClass('/personalia/struktur')}>
                                <Users size={16} /> Struktur Organisasi
                            </Link>
                        </>
                    ))}

                {/* System & Settings */}
                {(isAdmin || user.role === 'AUDITOR') && (
                    <div className="pt-4 mt-2 border-t border-slate-800">
                        <div className="px-3 text-[10px] uppercase text-slate-500 mb-2 font-bold tracking-wider">System</div>
                        <Link to="/laporan" className={navItemClass('/laporan')}><FileText size={18} /> Laporan</Link>
                        {isAdmin && (
                            <>
                                <Link to="/master" className={navItemClass('/master')}><Database size={18} /> Master Data</Link>
                                <Link to="/settings" className={navItemClass('/settings')}><Settings size={18} /> Pengaturan</Link>
                            </>
                        )}
                    </div>
                )}
            </nav >

            <div className={cn(
                "border-t border-slate-800 bg-slate-900/50 transition-all duration-300 overflow-hidden whitespace-nowrap",
                isOpen ? "p-4 opacity-100" : "p-0 h-0 opacity-0"
            )}>
                <button
                    onClick={handleLogout}
                    className={cn(
                        "flex items-center gap-3 p-3 w-full rounded-lg text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors text-sm font-medium",
                        !isOpen && "justify-center"
                    )}
                    title={!isOpen ? "Logout" : ""}
                >
                    <LogOut size={18} />
                    <span className={cn("transition-all duration-300", !isOpen ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100")}>Logout</span>
                </button>
            </div>
        </div>
    );
};
export default Sidebar;
