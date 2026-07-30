import { useState, useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import api from '../../../../lib/axios';
import { Modal } from '../UIComponents';
import { SimpleForm } from '../Forms';
import { VendorsTab } from '../VendorsTab';

export default function VendorPage() {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    const fetchVendors = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/uniforms/vendors');
            setVendors(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVendors();
    }, [fetchVendors]);

    const openModal = (type, data = null) => setModal({ open: true, type, data });
    const closeModal = () => setModal({ open: false, type: '', data: null });

    const handleSaveVendor = async (formData) => {
        try {
            if (formData.id) {
                await api.put(`/uniforms/vendors/${formData.id}`, formData);
            } else {
                await api.post('/uniforms/vendors', formData);
            }
            closeModal();
            fetchVendors();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan vendor');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <Users size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Vendor Seragam</h1>
                    <p className="text-slate-500">Kelola data vendor, performa, dan kontak vendor seragam</p>
                </div>
            </div>

            {loading ? (
                <div className="text-slate-500">Memuat data vendor...</div>
            ) : (
                <VendorsTab vendors={vendors} openModal={openModal} />
            )}

            {modal.open && modal.type === 'vendor' && (
                <Modal title={modal.data ? "Edit Vendor" : "Tambah Vendor"} onClose={closeModal}>
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
                </Modal>
            )}
        </div>
    );
}
