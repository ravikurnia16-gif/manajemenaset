import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AssetList from './pages/AssetList';
import AssetForm from './pages/AssetForm';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="aset" element={<AssetList />} />
          <Route path="aset/input" element={<AssetForm />} />
          <Route path="*" element={<div className="p-8 text-center text-slate-500">Feature Under Development</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;
