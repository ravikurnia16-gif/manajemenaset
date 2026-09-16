import { useState, useEffect, useCallback } from 'react';
import { Users, FileText, FileSignature, Star } from 'lucide-react';
import api from '../../../lib/axios';
import { Modal } from '../../ManajemenSeragam/UIComponents';
import { SimpleForm } from '../../ManajemenSeragam/Forms';
import { InvVendorsTab } from './InvVendorsTab';
import { InvVendorProjectTab } from './tabs/InvVendorProjectTab';
import { InvVendorMoUTab } from './tabs/InvVendorMoUTab';
import { InvVendorEvaluationTab } from './tabs/InvVendorEvaluationTab';
import { ProjectForm, VendorSelectionForm, VendorMoUForm, VendorEvaluationForm, ProjectReceiveForm } from './tabs/InvVendorForms';
import { ProjectApprovalModal } from '../../../components/ProjectApprovalModal';
import { ProjectPurchaseOrderModal } from '../../../components/ProjectPurchaseOrderModal';
import { ProjectBASTModal } from '../../../components/ProjectBASTModal';

const TABS = [
    { key: 'profile', label: 'Profil Vendor', icon: <Users size={16} /> },
    { key: 'projects', label: 'Proyek & Seleksi', icon: <FileText size={16} /> },
    { key: 'mou', label: 'MoU & Kontrak', icon: <FileSignature size={16} /> },
    { key: 'evaluation', label: 'Evaluasi Vendor', icon: <Star size={16} /> }
];

export default function InventoryVendorPage() {
    const [activeTab, setActiveTab] = useState('profile');
    const [vendors, setVendors] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [vRes, pRes] = await Promise.all([
                api.get('/inventory/vendors'),
                api.get('/inventory/projects')
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
            const payload = {
                name: formData.name,
                phone: formData.phone || '',
                contactPerson: formData.contactPerson || '',
                email: formData.email || '',
                address: formData.address || '',
                mapsUrl: formData.mapsUrl || '',
                description: formData.description || formData.mapsUrl || ''
            };

            if (formData.id) {
                await api.put(`/inventory/vendors/${formData.id}`, payload);
            } else {
                await api.post('/inventory/vendors', payload);
            }
            closeModal();
            fetchData();
        } catch (err) {
            console.error('Error saving vendor:', err);
            alert(err.response?.data?.error || 'Gagal menyimpan vendor');
        }
    };

    const handleSaveProject = async (formData) => {
        try {
            if (formData.id) await api.put(`/inventory/projects/${formData.id}`, formData);
            else await api.post('/inventory/projects', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan proyek'); }
    };

    const handleSaveVendorSelection = async (formData, id) => {
        try {
            if (id) await api.put(`/inventory/vendor-selections/${id}`, formData);
            else await api.post('/inventory/vendor-selections', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan seleksi'); }
    };

    const handleSaveVendorMoU = async (formData, id) => {
        try {
            if (id) await api.put(`/inventory/vendor-mous/${id}`, formData);
            else await api.post('/inventory/vendor-mous', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan MoU'); }
    };

    const handleSaveVendorEvaluation = async (formData) => {
        try {
            if (formData.id) await api.put(`/inventory/vendor-evaluations/${formData.id}`, formData);
            else await api.post('/inventory/vendor-evaluations', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan evaluasi'); }
    };

    const handleSaveProjectReceive = async (payload, projectId) => {
        try {
            const res = await api.post(`/inventory/projects/${projectId}/receive`, payload);
            alert(res.data?.message || 'Barang berhasil diterima, stok gudang terupdate, dan BAST resmi telah terbit.');
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menerima barang'); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <Users size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manajemen Vendor Barang (Logistik)</h1>
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
                            {activeTab === 'profile' && <InvVendorsTab vendors={vendors} openModal={openModal} onRefresh={fetchData} />}
                            {activeTab === 'projects' && <InvVendorProjectTab projects={projects} openModal={openModal} />}
                            {activeTab === 'mou' && <InvVendorMoUTab projects={projects} openModal={openModal} />}
                            {activeTab === 'evaluation' && <InvVendorEvaluationTab projects={projects} openModal={openModal} />}
                        </>
                    )}
                </div>
            </div>

            <Modal isOpen={modal.open} onClose={closeModal} title={
                modal.type === 'vendor' ? (modal.data ? 'Edit Vendor' : 'Tambah Vendor') :
                modal.type === 'project' ? (modal.data ? 'Edit Proyek Pengadaan' : 'Buat Proyek Pengadaan') :
                modal.type === 'vendor-selection' ? (modal.data?.id ? 'Edit Data Seleksi' : 'Pilih Vendor Peserta') :
                modal.type === 'vendor-mou' ? (modal.data?.id ? 'Edit MoU' : 'Buat MoU Baru') :
                modal.type === 'vendor-evaluation' ? (modal.data?.id ? 'Edit Penilaian' : 'Beri Penilaian') :
                modal.type === 'project-receive' ? 'Penerimaan Barang Proyek' : ''
            }>
                {modal.type === 'vendor' && (
                    <SimpleForm
                        fields={[
                            { name: 'name', label: 'Nama Vendor', type: 'text', required: true, placeholder: 'Contoh: PT ATK Nusantara' },
                            { name: 'phone', label: 'No. HP / WA', type: 'text', placeholder: 'Contoh: 08123456789' },
                            { name: 'contactPerson', label: 'Nama Kontak (CP)', type: 'text', placeholder: 'Contoh: Bpk. Kurnia' },
                            { name: 'email', label: 'Email', type: 'email', placeholder: 'vendor@example.com' },
                            { name: 'address', label: 'Alamat Lengkap', type: 'textarea', placeholder: 'Alamat kantor / gudang vendor' },
                            { name: 'mapsUrl', label: 'Link Google Maps', type: 'text', placeholder: 'https://maps.google.com/...' }
                        ]}
                        initialData={modal.data}
                        onSave={handleSaveVendor}
                        onSubmit={handleSaveVendor}
                        onCancel={closeModal}
                    />
                )}
                {modal.type === 'project' && (
                    <ProjectForm vendors={vendors} initialData={modal.data} onSave={handleSaveProject} onCancel={closeModal} />
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
                {modal.type === 'project-receive' && (
                    <ProjectReceiveForm initialData={modal.data} onSave={handleSaveProjectReceive} onCancel={closeModal} />
                )}
            </Modal>

            {/* Modal Lembar Persetujuan Kepala Bidang Sarana */}
            <ProjectApprovalModal
                isOpen={modal.open && modal.type === 'project-approval'}
                onClose={closeModal}
                project={modal.data}
                type="INVENTORY"
                onSuccess={() => {
                    fetchData();
                }}
            />

            {/* Modal Surat Pesanan (PO) */}
            <ProjectPurchaseOrderModal
                isOpen={modal.open && modal.type === 'project-po'}
                onClose={closeModal}
                project={modal.data}
                type="INVENTORY"
                vendors={vendors}
                onSuccess={() => {
                    fetchData();
                }}
            />

            {/* Modal Berita Acara Serah Terima (BAST) */}
            <ProjectBASTModal
                isOpen={modal.open && modal.type === 'project-bast'}
                onClose={closeModal}
                project={modal.data}
            />
        </div>
    );
}




