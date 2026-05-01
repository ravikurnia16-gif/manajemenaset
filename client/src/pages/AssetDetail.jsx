import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Box, ArrowLeft, Calendar, MapPin, Building2, User,
    DollarSign, Tag, FileText, ArrowLeftRight, Wrench,
    Trash2, Plus, CheckCircle, Clock, Loader2
} from 'lucide-react';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import { getMediaUrl } from '../lib/media';

const AssetDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const fetchAsset = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/assets/${id}`);
                setAsset(res.data);
            } catch (err) {
                console.error(err);
                alert('Gagal mengambil data aset');
                navigate('/aset');
            } finally {
                setLoading(false);
            }
        };
        fetchAsset();
    }, [id]);

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
    );

    if (!asset) return null;

    const getIcon = (type) => {
        switch (type) {
            case 'CREATION': return <Plus className="text-green-600" size={16} />;
            case 'MOVEMENT': return <ArrowLeftRight className="text-blue-600" size={16} />;
            case 'MAINTENANCE': return <Wrench className="text-orange-600" size={16} />;
            case 'DISPOSAL': return <Trash2 className="text-red-600" size={16} />;
            default: return <Clock className="text-slate-400" size={16} />;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/aset')} className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{asset.name}</h1>
                    <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
                        <Tag size={14} className="text-blue-500" /> {asset.code}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Information Sidebar */}
                <div className="lg:col-span-1 space-y-6">

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Informasi Dasar</h3>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Unit / Bidang</p>
                                    <p className="text-sm font-bold text-slate-700">{asset.unit?.name || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Ruangan / Lokasi</p>
                                    <p className="text-sm font-bold text-slate-700">{asset.room?.name || '-'}</p>
                                    <p className="text-[10px] text-slate-400 font-medium italic">
                                        {asset.room?.unit?.name || '-'} | {asset.room?.building || '-'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                                    <User size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">PIC Aset</p>
                                    <p className="text-sm font-bold text-slate-700">{asset.pic?.name || asset.picName || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Tgl Perolehan</p>
                                    <p className="text-sm font-bold text-slate-700">{new Date(asset.purchaseDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Harga Perolehan</p>
                                    <p className="text-sm font-bold text-slate-700">Rp {asset.price.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Spesifikasi</h3>
                        <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 leading-relaxed font-medium">
                            {asset.specification || 'Tidak ada keterangan spesifikasi tambahan.'}
                        </div>
                    </div>

                    {/* Asset Image Card - Moved Below Specs */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group cursor-pointer" onClick={() => asset.image && setIsModalOpen(true)}>
                        <div className="min-h-[300px] max-h-[600px] bg-slate-50 relative flex items-center justify-center overflow-hidden p-2">
                            {asset.image ? (
                                <img
                                    src={getMediaUrl(asset.image)}
                                    alt={asset.name}
                                    className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-slate-300 py-10">
                                    <Box size={64} strokeWidth={1} />
                                    <span className="text-xs font-medium mt-2 italic text-slate-400">Tidak ada foto</span>
                                </div>
                            )}
                        </div>
                        {asset.image && (
                            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Klik untuk memperbesar</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Timeline Main View */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-white">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <Clock className="text-blue-600" size={20} /> Riwayat Perjalanan Aset (Timeline)
                            </h3>
                            <p className="text-xs text-slate-400 font-medium italic mt-1">Lifecycle lengkap dari awal perolehan hingga penghapusan</p>
                        </div>

                        <div className="p-8">
                            <div className="relative">
                                {/* Vertical Line */}
                                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100"></div>

                                <div className="space-y-12">
                                    {asset.timeline?.map((event, idx) => (
                                        <div key={idx} className="relative pl-12">
                                            {/* Event Dot */}
                                            <div className={cn(
                                                "absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm z-10 transition-transform hover:scale-110",
                                                event.type === 'CREATION' ? 'bg-green-100' :
                                                    event.type === 'MOVEMENT' ? 'bg-blue-100' :
                                                        event.type === 'MAINTENANCE' ? 'bg-orange-100' : 'bg-red-100'
                                            )}>
                                                {getIcon(event.type)}
                                            </div>

                                            {/* Content Card */}
                                            <div className="bg-white rounded-xl lg:p-5 p-4 border border-slate-50 shadow-sm hover:shadow-md transition-shadow group">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                                                    <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded uppercase tracking-widest group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                        {new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </span>
                                                    {event.status && (
                                                        <span className={cn(
                                                            "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight",
                                                            event.status === 'COMPLETED' || event.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                                event.status === 'PENDING' || event.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-slate-100 text-slate-600'
                                                        )}>
                                                            {event.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-800 mb-1">{event.title}</h4>
                                                <p className="text-sm text-slate-500 font-medium leading-relaxed">{event.description}</p>
                                                {event.subTitle && (
                                                    <p className="text-xs text-slate-400 mt-2 italic font-medium">{event.subTitle}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Modal */}
            {isModalOpen && asset.image && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-300"
                    onClick={() => setIsModalOpen(false)}
                >
                    <button 
                        className="absolute top-6 right-6 text-white hover:text-blue-400 transition-colors"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <Plus className="rotate-45" size={32} />
                    </button>
                    <img
                        src={getMediaUrl(asset.image)}
                        alt={asset.name}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                    />
                </div>
            )}
        </div>
    );
};

export default AssetDetail;
