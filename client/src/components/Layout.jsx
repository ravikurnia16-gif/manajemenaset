import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { Menu, Bell, X, Check, Clock, ExternalLink, Loader2, Truck, Box, ShoppingCart, AlertCircle } from 'lucide-react';
import Sidebar from './Sidebar';
import api from '../lib/axios';
import { cn } from '../lib/utils';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingNotif, setLoadingNotif] = useState(false);
    const [selectedNotif, setSelectedNotif] = useState(null);
    const [hasReported, setHasReported] = useState(true); // default true to prevent flash
    const [reportWarningType, setReportWarningType] = useState('');
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

    useEffect(() => {
        const checkReportStatus = async () => {
            const sarprasKeywords = ['manajemen aset', 'admin aset', 'gudang dan logistik', 'teknisi', 'keuangan dan administrasi', 'kendaraan', 'kepala bidang sarana'];
            const isSarpras = user?.position && sarprasKeywords.some(kw => user.position.toLowerCase().includes(kw));
            if (!isSarpras) return;

            try {
                const res = await api.get('/laporan/status');
                
                const now = new Date();
                const hour = now.getHours();
                const minute = now.getMinutes();
                const currentTime = hour + (minute / 60);

                let shouldWarn = false;
                let warningType = '';

                // Laporan Pagi: check if missing after 12:00
                if (currentTime >= 12 && !res.data.hasMorning) {
                    shouldWarn = true;
                    warningType = 'Pagi';
                }

                // Laporan Siang: check if missing after 16:16
                // 16.16 in decimal is 16 + 16/60 = 16.266...
                if (currentTime >= 16.266 && !res.data.hasAfternoon) {
                    shouldWarn = true;
                    warningType = warningType ? 'Pagi & Siang' : 'Siang';
                }

                setHasReported(!shouldWarn);
                if (shouldWarn) setReportWarningType(warningType);

            } catch (err) {
                console.error('Failed to fetch report status', err);
            }
        };
        checkReportStatus();
    }, [location.pathname]);

    // --- PUSH NOTIFICATION REGISTRATION ---
    useEffect(() => {
        const registerPush = async () => {
            try {
                if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

                // Register Service Worker
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('[Push] SW registered');

                // Check permission
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return;

                // Get VAPID public key from server
                const vapidRes = await api.get('/push/vapid-public-key');
                const vapidKey = vapidRes.data.publicKey;
                if (!vapidKey) return;

                // Convert VAPID key to Uint8Array
                const urlBase64ToUint8Array = (base64String) => {
                    const padding = '='.repeat((4 - base64String.length % 4) % 4);
                    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                    const rawData = window.atob(base64);
                    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
                };

                // Subscribe
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey)
                });

                // Send subscription to server
                await api.post('/push/subscribe', { subscription: subscription.toJSON() });
                console.log('[Push] Subscribed successfully');
            } catch (err) {
                console.error('[Push] Registration failed:', err);
            }
        };

        // Delay registration slightly to not block initial render
        const timer = setTimeout(registerPush, 3000);
        return () => clearTimeout(timer);
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
        setSelectedNotif(notif);
        setIsNotifOpen(false);
    };

    const handleNotifNavigate = () => {
        if (selectedNotif?.link) navigate(selectedNotif.link);
        setSelectedNotif(null);
    };

    // Initial check for mobile
    useEffect(() => {
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
    }, []);

    const navItems = [
        { label: 'Kendaraan', icon: Truck, path: '/kendaraan/peminjaman' },
        { label: 'Aset', icon: Box, path: '/peminjaman' },
        { label: 'Pesanan', icon: ShoppingCart, path: '/gudang/pesanan' },
    ];

    return (
        <div className="flex bg-slate-50 h-screen font-sans text-slate-900 overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 z-30">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
                        >
                            <Menu size={24} />
                        </button>
                        <h2 className="text-xl font-bold text-slate-800 hidden sm:block tracking-tight">BIDANG SARANA</h2>
                        <h2 className="text-lg font-bold text-slate-800 sm:hidden">BIDANG SARANA</h2>
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
                
                {!hasReported && !location.pathname.startsWith('/laporan') && (
                    <div className="bg-rose-500 text-white px-4 py-2 flex items-center justify-between shadow-md shrink-0 z-20 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 text-sm font-bold">
                            <AlertCircle size={18} className="animate-pulse" />
                            Anda belum mengisi Laporan Kegiatan {reportWarningType || ''} hari ini!
                        </div>
                        <Link 
                            to="/laporan/umum" 
                            className="bg-white text-rose-600 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-rose-50 transition-colors shadow-sm"
                        >
                            Isi Sekarang
                        </Link>
                    </div>
                )}

                <main className="flex-1 overflow-auto p-4 lg:p-8 relative custom-scrollbar pb-16 lg:pb-8 flex flex-col justify-between">
                    <div>
                        <Outlet />
                    </div>
                    <footer className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-400 font-medium shrink-0">
                        &copy; Kepala Bidang Sarana 2025/2027 x PT. Nusantara Insan Olahkarya
                    </footer>
                </main>

                {/* Mobile Bottom Navigation */}
                <nav className="sm:hidden fixed bottom-1 left-2 right-2 bg-white/95 backdrop-blur-sm border border-slate-200 px-4 py-2 z-40 flex items-center justify-around rounded-2xl shadow-xl">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex flex-col items-center gap-0.5 transition-all duration-300 flex-1",
                                    isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <div className={cn(
                                    "p-1.5 rounded-lg transition-all",
                                    isActive ? "bg-blue-50" : ""
                                )}>
                                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-tight">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Notification Detail Modal */}
            {selectedNotif && (
                <>
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-in fade-in duration-200" onClick={() => setSelectedNotif(null)} />
                    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4 pointer-events-none">
                        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md pointer-events-auto animate-in zoom-in-95 fade-in duration-300 overflow-hidden">
                            {/* Modal Header */}
                            <div className={`p-5 border-b border-slate-100 ${selectedNotif.type === 'WARNING' ? 'bg-amber-50' : selectedNotif.type === 'SUCCESS' ? 'bg-green-50' : selectedNotif.type === 'URGENT' ? 'bg-red-50' : 'bg-blue-50'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${selectedNotif.type === 'WARNING' ? 'bg-amber-200 text-amber-800' : selectedNotif.type === 'SUCCESS' ? 'bg-green-200 text-green-800' : selectedNotif.type === 'URGENT' ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'}`}>
                                        {selectedNotif.type || 'INFO'}
                                    </span>
                                    <button onClick={() => setSelectedNotif(null)} className="p-1 hover:bg-white/50 rounded-lg transition-colors">
                                        <X size={16} className="text-slate-500" />
                                    </button>
                                </div>
                                <h3 className="text-lg font-black text-slate-800 leading-tight">{selectedNotif.title}</h3>
                                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                    <Clock size={10} />
                                    {new Date(selectedNotif.createdAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            {/* Modal Body */}
                            <div className="p-5">
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedNotif.message}</p>
                            </div>
                            {/* Modal Footer */}
                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedNotif(null)}
                                    className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-white transition-colors"
                                >
                                    Tutup
                                </button>
                                {selectedNotif.link && (
                                    <button
                                        onClick={handleNotifNavigate}
                                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink size={14} /> Lihat Data
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
export default Layout;

