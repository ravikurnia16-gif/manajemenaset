import React, { useState, useEffect, useCallback } from 'react';
import { 
    Target, RefreshCw, Sparkles, Layers, CalendarRange, 
    CheckCircle2, Clock, ShieldCheck, Loader2
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import api from '../lib/axios';
import WorkPlanTab from '../pages/LaporanStaff/tabs/WorkPlanTab';
import { cn } from '../lib/utils';

dayjs.locale('id');

export default function WorkPlanReportTab({ currentUser = {} }) {
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [saving, setSaving] = useState(false);
    const [staffList, setStaffList] = useState([]);

    const fetchPlans = useCallback(async () => {
        try {
            setLoadingPlans(true);
            const res = await api.get('/personnel/reports', {
                params: { limit: 'all' }
            });
            const data = res.data?.data || res.data || [];
            const planList = Array.isArray(data) ? data.filter(r => r.metadata?.isPlan) : [];
            setPlans(planList);
        } catch (err) {
            console.error('Error fetching plans for report page:', err);
        } finally {
            setLoadingPlans(false);
        }
    }, []);

    const fetchStaffList = useCallback(async () => {
        try {
            const res = await api.get('/personnel/staff');
            if (res.data?.success || res.data?.data) {
                setStaffList(res.data.staff || res.data.data || []);
            }
        } catch (e) {
            console.error('Error fetching staff list for report page:', e);
        }
    }, []);

    useEffect(() => {
        fetchPlans();
        fetchStaffList();
    }, [fetchPlans, fetchStaffList]);

    const handleCreateOrUpdatePlan = async (formData) => {
        try {
            setSaving(true);
            const userPos = currentUser.position || '';
            const validCategories = ['KEUANGAN', 'ASET', 'GUDANG', 'KENDARAAN', 'UMUM', 'TEKNISI'];
            const resolvedCat = validCategories.includes(formData.category) ? formData.category : 'UMUM';

            const payload = {
                type: 'WEEKLY',
                category: resolvedCat,
                content: formData.notes || '',
                date: formData.startDate || dayjs().format('YYYY-MM-DD'),
                metadata: {
                    isPlan: true,
                    title: formData.title,
                    position: formData.position || userPos,
                    categoryTag: formData.category || 'UMUM',
                    priority: formData.priority || 'SEDANG',
                    startDate: formData.startDate || dayjs().format('YYYY-MM-DD'),
                    endDate: formData.endDate,
                    status: formData.status || 'PENDING',
                    percentage: formData.percentage !== undefined ? formData.percentage : 0,
                    items: Array.isArray(formData.items) ? formData.items.map(it => ({
                        activity: it.activity,
                        targetDate: it.targetDate || '',
                        status: it.status || 'PENDING',
                        percentage: it.percentage !== undefined ? it.percentage : 0
                    })) : []
                }
            };

            if (formData.id) {
                await api.put(`/personnel/reports/${formData.id}`, payload);
            } else {
                await api.post('/personnel/reports', payload);
            }
            await fetchPlans();
            return true;
        } catch (err) {
            console.error('Error saving plan in report page:', err);
            alert(err.response?.data?.error || 'Gagal menyimpan rencana kerja.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePlanStatus = async (plan, extraMeta = {}) => {
        try {
            const meta = plan.metadata || {};
            const isCurrentlyDone = meta.status === 'SELESAI' || meta.percentage === 100;
            const newStatus = extraMeta.status || (isCurrentlyDone ? 'PENDING' : 'SELESAI');
            const newPercentage = extraMeta.percentage !== undefined ? extraMeta.percentage : (isCurrentlyDone ? 0 : 100);

            const updatedItems = Array.isArray(meta.items)
                ? meta.items.map(it => ({
                    ...it,
                    status: newStatus,
                    percentage: newPercentage
                }))
                : [];

            await api.put(`/personnel/reports/${plan.id}`, {
                type: plan.type,
                category: plan.category,
                content: plan.content,
                date: plan.date,
                metadata: {
                    ...meta,
                    ...extraMeta,
                    status: newStatus,
                    percentage: newPercentage,
                    ...(updatedItems.length > 0 ? { items: updatedItems } : {})
                }
            });
            await fetchPlans();
        } catch (err) {
            console.error('Error toggling plan status in report page:', err);
            alert('Gagal memperbarui status rencana kerja.');
        }
    };

    const handleUpdatePlanItem = async (plan, itemIdx, updates) => {
        try {
            const updatedItems = [...(plan.metadata?.items || [])];
            updatedItems[itemIdx] = { ...updatedItems[itemIdx], ...updates };
            if (updates.percentage === 100) updatedItems[itemIdx].status = 'SELESAI';
            else if (updates.percentage === 0) updatedItems[itemIdx].status = 'PENDING';
            else if (updates.percentage > 0 && updates.percentage < 100 && !updates.status) updatedItems[itemIdx].status = 'PROSES';

            // Recalculate whole plan percentage & status
            const allItemsDone = updatedItems.every(it => it.percentage === 100 || it.status === 'SELESAI');
            const avg = Math.round(updatedItems.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / updatedItems.length);
            const overallStatus = (allItemsDone || avg === 100) ? 'SELESAI' : (avg > 0 ? 'PROSES' : 'PENDING');

            await api.put(`/personnel/reports/${plan.id}`, {
                type: plan.type,
                category: plan.category,
                content: plan.content,
                date: plan.date,
                metadata: {
                    ...plan.metadata,
                    percentage: avg,
                    status: overallStatus,
                    items: updatedItems
                }
            });
            await fetchPlans();
        } catch (err) {
            console.error('Error updating plan item in report page:', err);
            alert('Gagal memperbarui butir rencana kerja.');
        }
    };

    const handleDeletePlan = async (planId) => {
        try {
            await api.delete(`/personnel/reports/${planId}`);
            await fetchPlans();
        } catch (err) {
            console.error('Error deleting plan in report page:', err);
            alert(err.response?.data?.error || 'Gagal menghapus rencana kerja.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Control Bar */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-200">
                        <Target size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                                Perencanaan Kerja (Workplan) Staf & Bidang
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                <Sparkles size={11} className="text-rose-600" /> Target & KPI
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Monitoring eksekutif rencana target mingguan/bulanan, progress persentase, checklist aktivitas, dan audit persetujuan.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={fetchPlans}
                        disabled={loadingPlans}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={13} className={loadingPlans ? 'animate-spin text-rose-600' : ''} />
                        <span>{loadingPlans ? 'Memperbarui...' : 'Sinkronkan Workplan'}</span>
                    </button>
                </div>
            </div>

            {/* WorkPlanTab Content */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6">
                <WorkPlanTab
                    plans={plans}
                    loadingPlans={loadingPlans}
                    fetchPlans={fetchPlans}
                    isKabid={true}
                    user={currentUser}
                    userDivision="UMUM"
                    staffList={staffList}
                    handleCreateOrUpdatePlan={handleCreateOrUpdatePlan}
                    handleUpdatePlanItem={handleUpdatePlanItem}
                    handleTogglePlanStatus={handleTogglePlanStatus}
                    handleDeletePlan={handleDeletePlan}
                    onImportPlanItemToReport={(plan, item) => {
                        console.log('Workplan selected:', plan, item);
                    }}
                    saving={saving}
                />
            </div>
        </div>
    );
}
