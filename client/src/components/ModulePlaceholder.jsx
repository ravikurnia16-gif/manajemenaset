import { Construction } from 'lucide-react';

const ModulePlaceholder = ({ title, moduleName }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
            <div className="bg-slate-100 p-6 rounded-full mb-6 animate-pulse">
                <Construction size={64} className="text-slate-400" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">{title}</h1>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
                Modul <span className="font-semibold text-blue-600">{moduleName}</span> sedang dalam tahap pengembangan.
                Fitur ini akan segera tersedia di pembaruan berikutnya.
            </p>
            <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                Status: In Development
            </div>
        </div>
    );
};

export default ModulePlaceholder;
