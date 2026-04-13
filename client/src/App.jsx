import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import WaNotificationManagement from './pages/WaNotificationManagement';
import VehicleMaintenanceList from './pages/VehicleMaintenanceList';
import VehicleMaintenanceForm from './pages/VehicleMaintenanceForm';
import VehicleMaintenanceDetail from './pages/VehicleMaintenanceDetail';
import VehicleWeeklyReport from './pages/VehicleWeeklyReport';
import VehicleInspectionForm from './pages/VehicleInspectionForm';
import VehicleInspectionList from './pages/VehicleInspectionList';
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

// Komponen untuk melindungi route yang butuh login
const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
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

        {/* Semua route di dalam sini diproteksi */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="aset" element={<AssetList />} />
          <Route path="aset/view/:id" element={<AssetDetail />} />
          <Route path="aset/input" element={<AssetForm />} />
          <Route path="aset/edit/:id" element={<AssetForm />} />
          <Route path="master" element={<MasterData />} />
          <Route path="rkb" element={<RKBList />} />
          <Route path="rkb/:id" element={<RKBDetail />} />
          <Route path="procurements" element={<ProcurementList />} />
          <Route path="procurements/new" element={<ProcurementForm />} />
          <Route path="procurements/:id" element={<ProcurementDetail />} />
          <Route path="vendors" element={<VendorManagement />} />
          <Route path="pemeliharaan" element={<MaintenanceList />} />
          <Route path="pemeliharaan/input" element={<MaintenanceForm />} />
          <Route path="pemeliharaan/:id" element={<MaintenanceDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="mutasi" element={<MutationList />} />
          <Route path="mutasi/request" element={<MutationForm />} />
          <Route path="penghapusan" element={<DisposalList />} />
          <Route path="peminjaman" element={<LoanList />} />
          <Route path="sarpras/rules" element={<SarprasRules />} />
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
            ['SUPER_ADMIN', 'ADMIN_ASET'].includes(JSON.parse(localStorage.getItem('user'))?.role)
              ? <PersonnelDashboard />
              : <Navigate to="/dashboard" />
          } />
          <Route path="personalia/kinerja" element={<StaffPerformance />} />
          <Route path="personalia/kalender" element={<SarprasCalendar />} />
          <Route path="personalia/rutin" element={<PersonnelRoutine />} />
          <Route path="personalia/kpi" element={<Navigate to="/personalia/kinerja?tab=KPI" replace />} />
          <Route path="laporan" element={<ReportPage />} />

          {/* Module: Manajemen Notifikasi WA (Kabid Sarpras Only) */}
          <Route path="notifikasi-wa" element={
            JSON.parse(localStorage.getItem('user'))?.position === 'Kepala Bidang Sarana dan Prasarana'
              ? <WaNotificationManagement />
              : <Navigate to="/dashboard" />
          } />

          <Route path="*" element={<div className="p-8 text-center text-slate-500">Feature Under Development</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;
