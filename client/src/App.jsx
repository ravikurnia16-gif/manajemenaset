import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AssetList from './pages/AssetList';
import AssetForm from './pages/AssetForm';
import MasterData from './pages/MasterData';
import RKBList from './pages/RKBList';
import ProcurementList from './pages/ProcurementList';
import ProcurementForm from './pages/ProcurementForm';
import ProcurementDetail from './pages/ProcurementDetail';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';

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
          <Route path="procurements" element={<ProcurementList />} />
          <Route path="procurements/new" element={<ProcurementForm />} />
          <Route path="procurements/:id" element={<ProcurementDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<div className="p-8 text-center text-slate-500">Feature Under Development</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;
