import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AssetList from './pages/AssetList';
import AssetForm from './pages/AssetForm';
import AssetDetail from './pages/AssetDetail';
import MasterData from './pages/MasterData';
import RKBList from './pages/RKBList';
import RKBDetail from './pages/RKBDetail';
import ProcurementList from './pages/ProcurementList';
import ProcurementForm from './pages/ProcurementForm';
import ProcurementDetail from './pages/ProcurementDetail';
import MaintenanceList from './pages/MaintenanceList';
import MaintenanceForm from './pages/MaintenanceForm';
import MaintenanceDetail from './pages/MaintenanceDetail';
import WarehouseDashboard from './pages/WarehouseDashboard';
import WarehouseStock from './pages/WarehouseStock';
import WarehouseStockForm from './pages/WarehouseStockForm';
import WarehouseTransactions from './pages/WarehouseTransactions';
import WarehouseTransactionForm from './pages/WarehouseTransactionForm';
import Settings from './pages/Settings';
import UniformOrderPage from './pages/UniformOrderPage';
import UniformOrderAdmin from './pages/UniformOrderAdmin';
import UnitOrderForm from './pages/UnitOrderForm';
import VehicleDashboard from './pages/VehicleDashboard';
import PersonnelDashboard from './pages/PersonnelDashboard';
import VehicleList from './pages/VehicleList';
import VehicleForm from './pages/VehicleForm';
import VehicleBooking from './pages/VehicleBooking';
import BusBooking from './pages/BusBooking';
import BusBookingPublic from './pages/BusBookingPublic';
import BusInvoicePublic from './pages/BusInvoicePublic';
import BusInvoiceBatchPrint from './pages/BusInvoiceBatchPrint';
import BusConfirmationPublic from './pages/BusConfirmationPublic';
import BusInvoiceVerify from './pages/BusInvoiceVerify';

import WorkshopDashboard from './pages/WorkshopDashboard';
import WorkshopOrderList from './pages/WorkshopOrderList';
import WorkshopOrderForm from './pages/WorkshopOrderForm';
import WorkshopOrderDetail from './pages/WorkshopOrderDetail';

import VehicleMaintenanceList from './pages/VehicleMaintenanceList';
import VehicleMaintenanceForm from './pages/VehicleMaintenanceForm';
import VehicleMaintenanceDetail from './pages/VehicleMaintenanceDetail';
import VehicleWeeklyReport from './pages/VehicleWeeklyReport';
import VehicleInspectionForm from './pages/VehicleInspectionForm';
import VehicleInspectionList from './pages/VehicleInspectionList';
import VehicleReminderDashboard from './pages/VehicleReminderDashboard';
import LoginPage from './pages/LoginPage';
import PublicAssetView from './pages/PublicAssetView';
import MutationList from './pages/MutationList';
import MutationForm from './pages/MutationForm';
import StaffPerformance from './pages/StaffPerformance';
import PersonnelRoutine from './pages/PersonnelRoutine';
import DisposalList from './pages/DisposalList';
import LoanList from './pages/LoanList';
import SarprasRules from './pages/SarprasRules';
import SarprasCalendar from './pages/SarprasCalendar';
import VendorManagement from './pages/VendorManagement';
import ReportPage from './pages/ReportPage';
import ModulePlaceholder from './components/ModulePlaceholder';
import OfficialResidence from './pages/OfficialResidence';
import QuickComplete from './pages/QuickComplete';
import EOffice from './pages/EOffice';
import PublicVerify from './pages/PublicVerify';
import AssetStandardCatalog from './pages/AssetStandardCatalog';
import AssetStandardForm from './pages/AssetStandardForm';
import AuditList from './pages/AuditList';
import AuditSessionDetail from './pages/AuditSessionDetail';
import ConstructionDashboard from './pages/ConstructionDashboard';
import ContractorList from './pages/ContractorList';
import ProtectedRoute from './components/ProtectedRoute';

import PublicSurvey from './pages/PublicSurvey';
import SurveyManager from './pages/SurveyManager';
import SurveyDashboard from './pages/SurveyDashboard';


function App() {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
        if (['e', 'E', '+', '-'].includes(e.key)) {
          e.preventDefault();
        }
      }
    };

    const handleWheel = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
        e.target.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  let user = {};
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser && storedUser !== 'undefined') {
      user = JSON.parse(storedUser);
    }
  } catch (e) {
    console.error('Error parsing user data', e);
  }
  const isGlobalAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'KABID_SARPRAS'].includes(user?.role);
  const sarprasKeywords = [
      'sarana dan prasarana',
      'manajemen aset',
      'gudang dan logistik',
      'teknisi',
      'keuangan dan administrasi',
      'kendaraan'
  ];
  const isStaffSarpras = isGlobalAdmin || sarprasKeywords.some(kw => user?.position && user.position.toLowerCase().includes(kw));

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pesan-seragam" element={<UniformOrderPage />} />
        <Route path="/public/asset/:id" element={<PublicAssetView />} />
        <Route path="/public/booking-bus" element={<BusBookingPublic />} />
        <Route path="/public/invoice-bus/batch" element={<BusInvoiceBatchPrint />} />
        <Route path="/public/invoice-bus/:id" element={<BusInvoicePublic />} />
        <Route path="/public/confirm-bus/:id/:token" element={<BusConfirmationPublic />} />
        <Route path="/q/:token" element={<QuickComplete />} />
        <Route path="/verify/:uuid" element={<PublicVerify />} />
        <Route path="/verify/bus-invoice/:id" element={<BusInvoiceVerify />} />
        <Route path="/public/survey" element={<PublicSurvey />} />

        {/* Semua route di dalam sini diproteksi */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to={Capacitor.isNativePlatform() ? "/kendaraan/peminjaman" : "/dashboard"} />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="aset" element={<AssetList />} />
          <Route path="aset/view/:id" element={<AssetDetail />} />
          <Route path="aset/input" element={<AssetForm />} />
          <Route path="aset/edit/:id" element={<AssetForm />} />
          <Route path="aset/katalog-standar" element={<AssetStandardCatalog />} />
          <Route path="aset/katalog-standar/new" element={<AssetStandardForm />} />
          <Route path="aset/katalog-standar/edit/:id" element={<AssetStandardForm />} />
          <Route path="aset/audit" element={<AuditList />} />
          <Route path="aset/audit/:id" element={<AuditSessionDetail />} />
          <Route path="master" element={<MasterData />} />
          <Route path="rkb" element={<RKBList />} />
          <Route path="rkb/:id" element={<RKBDetail />} />
          <Route path="prasarana/proyek" element={<ConstructionDashboard />} />
          <Route path="prasarana/tukang" element={<ContractorList />} />
          <Route path="pemeliharaan" element={<MaintenanceList />} />
          <Route path="pemeliharaan/input" element={<MaintenanceForm />} />
          <Route path="pemeliharaan/:id" element={<MaintenanceDetail />} />
          <Route path="procurements" element={<ProcurementList />} />
          <Route path="procurements/new" element={<ProcurementForm />} />
          <Route path="procurements/:id" element={<ProcurementDetail />} />
          <Route path="vendors" element={<VendorManagement />} />
          
          {/* Modul Manajemen Workshop */}
          <Route path="workshop/dashboard" element={<WorkshopDashboard />} />
          <Route path="workshop/orders" element={<WorkshopOrderList />} />
          <Route path="workshop/orders/new" element={<WorkshopOrderForm />} />
          <Route path="workshop/orders/:id" element={<WorkshopOrderDetail />} />

          <Route path="settings" element={<Settings />} />
          <Route path="mutasi" element={<MutationList />} />
          
          {/* Module: Survey Kepuasan */}
          <Route path="survey/manage" element={
            ['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS'].includes(user?.role) ? <SurveyManager /> : <Navigate to="/dashboard" />
          } />
          <Route path="survey/results" element={
            ['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS'].includes(user?.role) ? <SurveyDashboard /> : <Navigate to="/dashboard" />
          } />
          <Route path="mutasi/request" element={<MutationForm />} />
          <Route path="penghapusan" element={<DisposalList />} />
          <Route path="peminjaman" element={<LoanList />} />

          <Route path="rumah-dinas" element={<OfficialResidence />} />

          {/* Module: Manajemen Kendaraan */}
          <Route path="kendaraan/dashboard" element={<VehicleDashboard />} />
          <Route path="kendaraan/data" element={<VehicleList />} />
          <Route path="kendaraan/data/new" element={<VehicleForm />} />
          <Route path="kendaraan/data/edit/:id" element={<VehicleForm />} />
          <Route path="kendaraan/peminjaman" element={<VehicleBooking />} />
          <Route path="kendaraan/booking-bus" element={<BusBooking />} />
          <Route path="kendaraan/pemeliharaan" element={<VehicleMaintenanceList />} />
          <Route path="kendaraan/pemeliharaan/new" element={<VehicleMaintenanceForm />} />
          <Route path="kendaraan/pemeliharaan/edit/:id" element={<VehicleMaintenanceForm />} />
          <Route path="kendaraan/pemeliharaan/view/:id" element={<VehicleMaintenanceDetail />} />
          <Route path="kendaraan/pemeliharaan/reminder" element={<VehicleReminderDashboard />} />
          <Route path="kendaraan/laporan-mingguan/:id" element={<VehicleWeeklyReport />} />
          <Route path="kendaraan/inspeksi/:id" element={<VehicleInspectionForm />} />
          <Route path="kendaraan/inspeksi/riwayat/:id" element={<VehicleInspectionList />} />

          {/* Module: Manajemen Gudang */}
          <Route path="gudang/dashboard" element={<WarehouseDashboard />} />
          <Route path="gudang/stok" element={<WarehouseStock />} />
          <Route path="gudang/stok/input" element={<WarehouseStockForm />} />
          <Route path="gudang/stok/edit/:id" element={<WarehouseStockForm />} />
          <Route path="gudang/transaksi" element={<WarehouseTransactions />} />
          <Route path="gudang/transaksi/input" element={<WarehouseTransactionForm />} />
          <Route path="gudang/pesanan" element={<UniformOrderAdmin />} />
          <Route path="gudang/pesanan/unit" element={<UnitOrderForm />} />

          {/* Module: Manajemen Personalia */}
          <Route path="personalia/dashboard" element={
            ['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS'].includes(user?.role)
              ? <PersonnelDashboard />
              : <Navigate to="/dashboard" />
          } />
          <Route path="personalia/kinerja" element={<StaffPerformance />} />
          <Route path="personalia/kalender" element={<SarprasCalendar />} />
          <Route path="personalia/rutin" element={<PersonnelRoutine />} />
          <Route path="personalia/kpi" element={<Navigate to="/personalia/kinerja?tab=KPI" replace />} />
          <Route path="laporan" element={<ReportPage />} />

          {/* Module: E-Office */}
          <Route path="e-office" element={
            isStaffSarpras ? <EOffice /> : <Navigate to="/dashboard" />
          } />
          <Route path="e-office/:tab" element={
            isStaffSarpras ? <EOffice /> : <Navigate to="/dashboard" />
          } />


          <Route path="*" element={<div className="p-8 text-center text-slate-500">Feature Under Development</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;
