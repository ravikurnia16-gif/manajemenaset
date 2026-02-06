import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
    return (
        <div className="flex bg-slate-50 min-h-screen font-sans text-slate-900">
            <Sidebar />
            <div className="flex-1 max-h-screen overflow-auto">
                <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 sticky top-0 z-10">
                    <h2 className="text-lg font-semibold text-slate-700">Sistem Informasi Manajemen Aset</h2>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">AD</div>
                        <span className="text-sm font-medium text-slate-600">Administrator</span>
                    </div>
                </header>
                <main className="p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
export default Layout;
