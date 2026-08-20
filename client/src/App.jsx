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
import ManajemenSeragamDashboard from './pages/ManajemenSeragam/pages/DashboardPage';
import ManajemenSeragamMaster from './pages/ManajemenSeragam/pages/MasterDataPage';
import ManajemenSeragamStock from './pages/ManajemenSeragam/pages/StockPage';
import ManajemenSeragamSales from './pages/ManajemenSeragam/pages/SalesPage';
import ManajemenSeragamVendor from './pages/ManajemenSeragam/pages/VendorPage';
import UniformFinancePage from './pages/ManajemenSeragam/pages/UniformFinancePage';
import UnitOrderForm from './pages/UnitOrderForm';
import VehicleDashboard from './pages/VehicleDashboard';
import PersonnelDashboard from './pages/PersonnelDashboard';
import VehicleList from './pages/VehicleList';
import VehicleForm from './pages/VehicleForm';
import VehicleBooking from './pages/VehicleBooking';
import BusBooking from './pages/BusBooking';
import BusBookingPublic from './pages/BusBookingPublic';
import BusInvoicePublic from './pages/BusInvoicePublic';
import UniformInvoicePublic from './pages/UniformInvoicePublic';
import UniformOrderPublic from './pages/UniformOrderPublic';
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
import LaporanStaff from './pages/LaporanStaff';
import LaporanKabid from './pages/LaporanKabid';
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

// import SecurityDashboard from './pages/Security/SecurityDashboard';
// import SecurityPosts from './pages/Security/SecurityPosts';
// import SecurityGuards from './pages/Security/SecurityGuards';
// import SecuritySchedule from './pages/Security/SecuritySchedule';
import ProtectedRoute from './components/ProtectedRoute';

import PublicSurvey from './pages/PublicSurvey';
import SurveyManager from './pages/SurveyManager';
import SurveyDashboard from './pages/SurveyDashboard';

// Inventory (Gudang Baru)
import InventoryDashboard from './pages/Inventory/InventoryDashboard';
import InventoryMaster from './pages/Inventory/InventoryMaster';
import InventoryStock from './pages/Inventory/InventoryStock';
import InventoryTransactions from './pages/Inventory/InventoryTransactions';
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

          {/* Module: Manajemen Gudang Baru (Inventory) */}
          <Route path="inventory/dashboard" element={<InventoryDashboard />} />
          <Route path="inventory/master" element={<InventoryMaster />} />
          <Route path="inventory/stok" element={<InventoryStock />} />
          <Route path="inventory/transaksi" element={<InventoryTransactions />} />
          <Route path="inventory/pesanan" element={<InventoryOrders />} />
          <Route path="inventory/vendor" element={<InventoryVendorPage />} />

          {/* Module: Manajemen Gudang (Lama) */}
          <Route path="gudang/dashboard" element={<WarehouseDashboard />} />
          <Route path="gudang/stok" element={<WarehouseStock />} />
          <Route path="gudang/stok/input" element={<WarehouseStockForm />} />
          <Route path="gudang/stok/edit/:id" element={<WarehouseStockForm />} />
          <Route path="gudang/transaksi" element={<WarehouseTransactions />} />
          <Route path="gudang/transaksi/input" element={<WarehouseTransactionForm />} />
          <Route path="gudang/pesanan" element={<UniformOrderAdmin />} />
          <Route path="gudang/pesanan/unit" element={<UnitOrderForm />} />
          <Route path="gudang/seragam" element={<Navigate to="/gudang/seragam/dashboard" replace />} />
          <Route path="gudang/seragam/dashboard" element={<ManajemenSeragamDashboard />} />
          <Route path="gudang/seragam/master" element={<ManajemenSeragamMaster />} />
          <Route path="gudang/seragam/stok" element={<ManajemenSeragamStock />} />
          <Route path="gudang/seragam/penjualan" element={<ManajemenSeragamSales />} />
          <Route path="gudang/seragam/vendor" element={<ManajemenSeragamVendor />} />
          <Route path="gudang/seragam/keuangan" element={<UniformFinancePage />} />

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
          
          {/* <Route path="security/dashboard" element={<SecurityDashboard />} />
          <Route path="security/pos" element={<SecurityPosts />} />
          <Route path="security/anggota" element={<SecurityGuards />} />
          <Route path="security/jadwal" element={<SecuritySchedule />} /> */}
          
          <Route path="laporan" element={<ReportPage />} />
          <Route path="laporan/kabid" element={
            isStaffSarpras ? <LaporanKabid /> : <Navigate to="/dashboard" />
          } />
          <Route path="laporan/:category" element={
            isStaffSarpras ? <LaporanStaff /> : <Navigate to="/dashboard" />
          } />

          {/* Module: E-Office */}
          <Route path="e-office" element={
            canViewEOffice ? <EOffice /> : <Navigate to="/dashboard" />
          } />
          <Route path="e-office/:tab" element={
            canViewEOffice ? <EOffice /> : <Navigate to="/dashboard" />
          } />


          <Route path="*" element={<div className="p-8 text-center text-slate-500">Feature Under Development</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;

