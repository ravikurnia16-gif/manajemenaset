import { X } from 'lucide-react';

export const StatCard = ({ title, value, icon, color, sub }) => (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/0 to-slate-50 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-125" />
        <div className="flex items-center gap-4 relative z-10">
            <div className={`${color} text-white p-3 rounded-xl shadow-inner`}>{icon}</div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{value}</h3>
                {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    </div>
);

export const Badge = ({ children, color = 'slate' }) => {
    const colors = {
        green: 'bg-green-50 text-green-600 border-green-200',
        red: 'bg-red-50 text-red-600 border-red-200',
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        orange: 'bg-orange-50 text-orange-600 border-orange-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
        slate: 'bg-slate-50 text-slate-600 border-slate-200',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    };
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors[color]}`}>{children}</span>;
};

export const Modal = ({ isOpen, onClose, title, children, wide }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className={`bg-white rounded-2xl shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
                    <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
};

export const InputField = ({ label, ...props }) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
        <input className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" {...props} />
    </div>
);

export const SelectField = ({ label, children, ...props }) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
        <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all bg-white" {...props}>
            {children}
        </select>
    </div>
);
