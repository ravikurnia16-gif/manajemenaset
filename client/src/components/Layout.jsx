import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();

    // Close sidebar on mobile route change
    useEffect(() => {
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    }, [location]);

    // Initial check for mobile
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };

        // Set initial state
        if (window.innerWidth < 1024) setIsSidebarOpen(false);

        // Optional: Listen to resize if we want dynamic adaptation
        // window.addEventListener('resize', handleResize);
        // return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="flex bg-slate-50 min-h-screen font-sans text-slate-900 overflow-hidden">
            {/* Sidebar with props */}
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        >
                            <Menu size={24} />
                        </button>
                        <h2 className="text-lg font-semibold text-slate-700 hidden sm:block">Sistem Informasi Manajemen Aset</h2>
                        <h2 className="text-lg font-semibold text-slate-700 sm:hidden">SARPRAS</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">AD</div>
                        <span className="text-sm font-medium text-slate-600 hidden sm:inline">Administrator</span>
                    </div>
                </header>
                <main className="flex-1 overflow-auto p-4 lg:p-8 relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
export default Layout;
