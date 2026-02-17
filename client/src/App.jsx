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
import VehicleList from './pages/VehicleList';
import VehicleForm from './pages/VehicleForm';
import VehicleMaintenanceList from './pages/VehicleMaintenanceList';
import VehicleMaintenanceForm from './pages/VehicleMaintenanceForm';
import VehicleWeeklyReport from './pages/VehicleWeeklyReport';
import LoginPage from './pages/LoginPage';
import PublicAssetView from './pages/PublicAssetView';
import MutationList from './pages/MutationList';
import MutationForm from './pages/MutationForm';
import PersonnelReports from './pages/PersonnelReports';
import PersonnelAssignments from './pages/PersonnelAssignments';
import DisposalList from './pages/DisposalList';
import SarprasRules from './pages/SarprasRules';
import SarprasCalendar from './pages/SarprasCalendar';
import FloorPlan from './pages/FloorPlan';
import ModulePlaceholder from './components/ModulePlaceholder';

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
          <Route path="pemeliharaan" element={<MaintenanceList />} />
          <Route path="pemeliharaan/input" element={<MaintenanceForm />} />
          <Route path="pemeliharaan/:id" element={<MaintenanceDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="mutasi" element={<MutationList />} />
          <Route path="mutasi/request" element={<MutationForm />} />
          <Route path="penghapusan" element={<DisposalList />} />
          <Route path="denah" element={<FloorPlan />} />
          <Route path="sarpras/rules" element={<SarprasRules />} />

          {/* Module: Manajemen Kendaraan */}
          <Route path="kendaraan/dashboard" element={<ModulePlaceholder title="Dashboard Kendaraan" moduleName="Manajemen Kendaraan" />} />
          <Route path="kendaraan/data" element={<VehicleList />} />
          <Route path="kendaraan/data/new" element={<VehicleForm />} />
          <Route path="kendaraan/data/edit/:id" element={<VehicleForm />} />
          <Route path="kendaraan/peminjaman" element={<ModulePlaceholder title="Peminjaman Kendaraan" moduleName="Manajemen Kendaraan" />} />
          <Route path="kendaraan/pemeliharaan" element={<VehicleMaintenanceList />} />
          <Route path="kendaraan/pemeliharaan/new" element={<VehicleMaintenanceForm />} />
          <Route path="kendaraan/pemeliharaan/edit/:id" element={<VehicleMaintenanceForm />} />
          <Route path="kendaraan/laporan-mingguan/:id" element={<VehicleWeeklyReport />} />

          {/* Module: Manajemen Gudang */}
          <Route path="gudang/dashboard" element={<WarehouseDashboard />} />
          <Route path="gudang/stok" element={<WarehouseStock />} />
          <Route path="gudang/stok/input" element={<WarehouseStockForm />} />
          <Route path="gudang/stok/edit/:id" element={<WarehouseStockForm />} />
          <Route path="gudang/transaksi" element={<WarehouseTransactions />} />
          <Route path="gudang/transaksi/input" element={<WarehouseTransactionForm />} />
          <Route path="gudang/pesanan" element={<UniformOrderAdmin />} />

          {/* Module: Manajemen Personalia */}
          <Route path="personalia/laporan" element={<PersonnelReports />} />
          <Route path="personalia/penugasan" element={<PersonnelAssignments />} />
          <Route path="personalia/struktur" element={<ModulePlaceholder title="Struktur Organisasi" moduleName="Manajemen Personalia" />} />
          <Route path="personalia/staf" element={<ModulePlaceholder title="Data Staf" moduleName="Manajemen Personalia" />} />
          <Route path="personalia/detail/:id" element={<ModulePlaceholder title="Detail Staf" moduleName="Manajemen Personalia" />} />
          <Route path="personalia/kalender" element={<SarprasCalendar />} />

          <Route path="*" element={<div className="p-8 text-center text-slate-500">Feature Under Development</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;
