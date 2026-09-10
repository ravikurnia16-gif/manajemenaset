import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Shirt, Wrench, ChevronRight } from 'lucide-react';

export default function OrdersNavTabs({ activeTab = 'logistik' }) {
  const location = useLocation();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user && ['SUPER_ADMIN', 'ADMIN_ASET', 'KABID_SARPRAS'].includes(user.role);

  const tabs = [
    {
      id: 'logistik',
      label: 'Pesanan Logistik (Gudang)',
      shortLabel: 'Logistik',
      path: '/inventory/pesanan',
      icon: <Box size={17} />
    },
    {
      id: 'seragam',
      label: 'Pesanan Seragam',
      shortLabel: 'Seragam',
      path: '/gudang/seragam/penjualan',
      icon: <Shirt size={17} />
    },
    {
      id: 'workshop',
      label: 'Pesanan Workshop',
      shortLabel: 'Workshop',
      path: '/workshop/orders',
      icon: <Wrench size={17} />,
      badge: !isAdmin ? 'Hanya Lihat' : null
    }
  ];

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-1.5 sm:p-2 shadow-xs mb-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-2 pt-1 pb-2 sm:py-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="font-bold text-slate-700">Layanan Pesanan Unit</span>
          <ChevronRight size={13} className="text-slate-400" />
          <span className="text-blue-600 font-semibold">
            {tabs.find(t => t.id === activeTab)?.label || 'Pesanan'}
          </span>
        </div>
        {!isAdmin && (
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
            Unit: {user?.unit?.name || 'Unit Pemohon'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={`flex items-center justify-center gap-2 py-2.5 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 text-center ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-slate-50 border border-slate-100'
              }`}
            >
              <span className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`}>
                {tab.icon}
              </span>
              <span className="hidden sm:inline truncate">{tab.label}</span>
              <span className="sm:hidden truncate">{tab.shortLabel}</span>
              {tab.badge && (
                <span
                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md shrink-0 hidden md:inline-block ${
                    isActive
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
