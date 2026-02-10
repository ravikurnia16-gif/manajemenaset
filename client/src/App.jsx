import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AssetList from './pages/AssetList';
import AssetForm from './pages/AssetForm';
import MasterData from './pages/MasterData';
import RKBList from './pages/RKBList';
import RKBDetail from './pages/RKBDetail';
import ProcurementList from './pages/ProcurementList';
import ProcurementForm from './pages/ProcurementForm';
import ProcurementDetail from './pages/ProcurementDetail';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';
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

        {/* Semua route di dalam sini diproteksi */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="aset" element={<AssetList />} />
          <Route path="aset/input" element={<AssetForm />} />
          <Route path="aset/edit/:id" element={<AssetForm />} />
          <Route path="master" element={<MasterData />} />
          <Route path="rkb" element={<RKBList />} />
          <Route path="rkb/:id" element={<RKBDetail />} />
          <Route path="procurements" element={<ProcurementList />} />
          <Route path="procurements/new" element={<ProcurementForm />} />
          <Route path="procurements/:id" element={<ProcurementDetail />} />
          <Route path="settings" element={<Settings />} />

          {/* Module: Manajemen Kendaraan */}
          <Route path="kendaraan/dashboard" element={<ModulePlaceholder title="Dashboard Kendaraan" moduleName="Manajemen Kendaraan" />} />
          <Route path="kendaraan/data" element={<ModulePlaceholder title="Data Kendaraan" moduleName="Manajemen Kendaraan" />} />
          <Route path="kendaraan/peminjaman" element={<ModulePlaceholder title="Peminjaman Kendaraan" moduleName="Manajemen Kendaraan" />} />
          <Route path="kendaraan/pemeliharaan" element={<ModulePlaceholder title="Pemeliharaan Kendaraan" moduleName="Manajemen Kendaraan" />} />

          {/* Module: Manajemen Gudang */}
          <Route path="gudang/dashboard" element={<ModulePlaceholder title="Dashboard Gudang" moduleName="Manajemen Gudang & Logistik" />} />
          <Route path="gudang/stok" element={<ModulePlaceholder title="Stok Barang" moduleName="Manajemen Gudang & Logistik" />} />
          <Route path="gudang/masuk-keluar" element={<ModulePlaceholder title="Masuk & Keluar Barang" moduleName="Manajemen Gudang & Logistik" />} />

          {/* Module: Manajemen Personalia */}
          <Route path="personalia/struktur" element={<ModulePlaceholder title="Struktur Organisasi" moduleName="Manajemen Personalia" />} />
          <Route path="personalia/staf" element={<ModulePlaceholder title="Data Staf" moduleName="Manajemen Personalia" />} />
          <Route path="personalia/detail/:id" element={<ModulePlaceholder title="Detail Staf" moduleName="Manajemen Personalia" />} />

          <Route path="*" element={<div className="p-8 text-center text-slate-500">Feature Under Development</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;
