import { useState, useEffect, useCallback } from 'react';
import { Users, FileText, FileSignature, Star } from 'lucide-react';
import api from '../../../lib/axios';
import { Modal } from '../UIComponents';
import { SimpleForm } from '../Forms';
import { VendorsTab } from '../VendorsTab';
import { VendorProjectTab } from '../tabs/VendorProjectTab';
import { VendorMoUTab } from '../tabs/VendorMoUTab';
import { VendorEvaluationTab } from '../tabs/VendorEvaluationTab';
import { ProjectForm, VendorSelectionForm, VendorMoUForm, VendorEvaluationForm } from '../tabs/VendorForms';

const TABS = [
    { key: 'profile', label: 'Profil Vendor', icon: <Users size={16} /> },
    { key: 'projects', label: 'Proyek & Seleksi', icon: <FileText size={16} /> },
    { key: 'mou', label: 'MoU & Kontrak', icon: <FileSignature size={16} /> },
    { key: 'evaluation', label: 'Evaluasi Vendor', icon: <Star size={16} /> }
];

export default function VendorPage() {
    const [activeTab, setActiveTab] = useState('profile');
    const [vendors, setVendors] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [vRes, pRes] = await Promise.all([
                api.get('/uniforms/vendors'),
                api.get('/uniforms/projects')
            ]);
            setVendors(vRes.data);
            setProjects(pRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openModal = (type, data = null) => setModal({ open: true, type, data });
    const closeModal = () => setModal({ open: false, type: '', data: null });

    const handleSaveVendor = async (formData) => {
        try {
            if (formData.id) await api.put(`/uniforms/vendors/${formData.id}`, formData);
            else await api.post('/uniforms/vendors', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan vendor'); }
    };

    const handleSaveProject = async (formData) => {
        try {
            if (formData.id) await api.put(`/uniforms/projects/${formData.id}`, formData);
            else await api.post('/uniforms/projects', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan proyek'); }
    };

    const handleSaveVendorSelection = async (formData, id) => {
        try {
            if (id) await api.put(`/uniforms/vendor-selections/${id}`, formData);
            else await api.post('/uniforms/vendor-selections', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan seleksi'); }
    };

    const handleSaveVendorMoU = async (formData, id) => {
        try {
            if (id) await api.put(`/uniforms/vendor-mous/${id}`, formData);
            else await api.post('/uniforms/vendor-mous', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan MoU'); }
    };

    const handleSaveVendorEvaluation = async (formData) => {
        try {
            if (formData.id) await api.put(`/uniforms/vendor-evaluations/${formData.id}`, formData);
            else await api.post('/uniforms/vendor-evaluations', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan evaluasi'); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <Users size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manajemen Vendor Seragam</h1>
                    <p className="text-slate-500">Kelola profil, proyek pengadaan, kontrak, dan kinerja vendor</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex overflow-x-auto border-b border-slate-100 px-2 scrollbar-hide">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-4 sm:p-5">
                    {loading ? (
                        <div className="text-center p-8 text-slate-400">Memuat data vendor...</div>
                    ) : (
                        <>
                            {activeTab === 'profile' && <VendorsTab vendors={vendors} openModal={openModal} />}
                            {activeTab === 'projects' && <VendorProjectTab projects={projects} openModal={openModal} />}
                            {activeTab === 'mou' && <VendorMoUTab projects={projects} openModal={openModal} />}
                            {activeTab === 'evaluation' && <VendorEvaluationTab projects={projects} openModal={openModal} />}
                        </>
                    )}
                </div>
            </div>

            <Modal isOpen={modal.open} onClose={closeModal} title={
                modal.type === 'vendor' ? (modal.data ? 'Edit Vendor' : 'Tambah Vendor') :
                modal.type === 'project' ? (modal.data ? 'Edit Proyek Pengadaan' : 'Buat Proyek Pengadaan') :
                modal.type === 'vendor-selection' ? (modal.data?.id ? 'Edit Data Seleksi' : 'Pilih Vendor Peserta') :
                modal.type === 'vendor-mou' ? (modal.data?.id ? 'Edit MoU' : 'Buat MoU Baru') :
                modal.type === 'vendor-evaluation' ? (modal.data?.id ? 'Edit Penilaian' : 'Beri Penilaian') : ''
            }>
                {modal.type === 'vendor' && (
                    <SimpleForm
                        fields={[
                            { name: 'name', label: 'Nama Vendor', type: 'text', required: true },
                            { name: 'phone', label: 'No. HP / WA', type: 'text' },
                            { name: 'contactPerson', label: 'Nama Kontak (CP)', type: 'text' }
                        ]}
                        initialData={modal.data}
                        onSubmit={handleSaveVendor}
                        onCancel={closeModal}
                    />
                )}
                {modal.type === 'project' && (
                    <ProjectForm initialData={modal.data} onSave={handleSaveProject} onCancel={closeModal} />
                )}
                {modal.type === 'vendor-selection' && (
                    <VendorSelectionForm vendors={vendors} initialData={modal.data} onSave={handleSaveVendorSelection} onCancel={closeModal} />
                )}
                {modal.type === 'vendor-mou' && (
                    <VendorMoUForm vendors={vendors} projects={projects} initialData={modal.data} onSave={handleSaveVendorMoU} onCancel={closeModal} />
                )}
                {modal.type === 'vendor-evaluation' && (
                    <VendorEvaluationForm vendors={vendors} projects={projects} initialData={modal.data} onSave={handleSaveVendorEvaluation} onCancel={closeModal} />
                )}
            </Modal>
        </div>
    );
}
