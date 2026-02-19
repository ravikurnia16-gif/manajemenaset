import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, X, Check, Clock, ExternalLink, Loader2 } from 'lucide-react';
import Sidebar from './Sidebar';
import api from '../lib/axios';
import { cn } from '../lib/utils';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingNotif, setLoadingNotif] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : {};

    const fetchNotifications = async () => {
        try {
            setLoadingNotif(true);
            const res = await api.get('/notifications');
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount || 0);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            setLoadingNotif(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every 3 minutes
        const interval = setInterval(fetchNotifications, 180000);
        return () => clearInterval(interval);
    }, []);

    // Close sidebar/notif on mobile route change
    useEffect(() => {
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
        setIsNotifOpen(false);
    }, [location]);

    const handleMarkAsRead = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error(err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error(err);
        }
    };

    const handleNotifClick = (notif) => {
        if (!notif.isRead) handleMarkAsRead(notif.id);
        if (notif.link) navigate(notif.link);
        setIsNotifOpen(false);
    };

    // Initial check for mobile
    useEffect(() => {
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
    }, []);

    return (
        <div className="flex bg-slate-50 min-h-screen font-sans text-slate-900 overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 z-30">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
                        >
                            <Menu size={24} />
                        </button>
                        <h2 className="text-lg font-bold text-slate-800 hidden sm:block tracking-tight">SARANA DAN PRASARANA</h2>
                        <h2 className="text-lg font-bold text-slate-800 sm:hidden">SARPRAS</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className={cn(
                                    "p-2.5 rounded-xl transition-all relative group",
                                    isNotifOpen ? "bg-blue-50 text-blue-600" : "hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                                )}
                            >
                                <Bell size={22} className={cn("transition-transform", isNotifOpen ? "scale-110" : "group-hover:rotate-12")} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce-short">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Notifications Popover */}
                            {isNotifOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)}></div>
                                    <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                        <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0">
                                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Notifikasi</h3>
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={handleMarkAllRead}
                                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md transition-colors"
                                                >
                                                    Tandai Semua Dibaca
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {loadingNotif && notifications.length === 0 ? (
                                                <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                                                    <Loader2 className="animate-spin" size={24} />
                                                    <span className="text-xs font-medium">Memuat pemberitahuan...</span>
                                                </div>
                                            ) : notifications.length === 0 ? (
                                                <div className="p-12 flex flex-col items-center justify-center text-slate-300 gap-2">
                                                    <Bell size={40} className="opacity-20" />
                                                    <span className="text-xs font-bold uppercase tracking-widest">Tidak ada notifikasi</span>
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-slate-50">
                                                    {notifications.map(n => (
                                                        <div
                                                            key={n.id}
                                                            onClick={() => handleNotifClick(n)}
                                                            className={cn(
                                                                "p-4 hover:bg-slate-50 transition-colors cursor-pointer group relative",
                                                                !n.isRead && "bg-blue-50/30"
                                                            )}
                                                        >
                                                            {!n.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}
                                                            <div className="flex justify-between items-start gap-2 mb-1">
                                                                <h4 className={cn("text-xs uppercase tracking-tight", n.isRead ? "text-slate-600 font-bold" : "text-blue-700 font-black")}>
                                                                    {n.title}
                                                                </h4>
                                                                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                                    {new Date(n.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <p className={cn("text-[11px] leading-relaxed mb-2", n.isRead ? "text-slate-500" : "text-slate-700 font-medium")}>
                                                                {n.message}
                                                            </p>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] font-bold text-slate-400 italic flex items-center gap-1">
                                                                    <Clock size={10} /> {new Date(n.createdAt).toLocaleDateString('id-ID')}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    {!n.isRead && (
                                                                        <button
                                                                            onClick={(e) => handleMarkAsRead(n.id, e)}
                                                                            className="p-1 bg-white border border-slate-200 rounded text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                                                            title="Tandai dibaca"
                                                                        >
                                                                            <Check size={12} />
                                                                        </button>
                                                                    )}
                                                                    {n.link && <ExternalLink size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors" />}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pusat Pemberitahuan SARPRAS</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>

                        <div className="flex items-center gap-3 pl-2">
                            <div className="flex flex-col items-end hidden sm:flex">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{user.name || user.username}</span>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-blue-200 ring-2 ring-white">
                                {(user.name || user.username || 'U').substring(0, 1).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-auto p-4 lg:p-8 relative custom-scrollbar">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
export default Layout;
