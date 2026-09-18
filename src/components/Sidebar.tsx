import React from 'react';
import {
  LayoutDashboard,
  Warehouse as WarehouseIcon,
  Layers,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  FileSpreadsheet,
  Users,
  ShieldAlert,
  Database,
  Server,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export type NavView =
  | 'dashboard'
  | 'warehouses'
  | 'items'
  | 'inventory'
  | 'stock-in'
  | 'stock-out'
  | 'transfer'
  | 'reports'
  | 'users'
  | 'audit'
  | 'backup'
  | 'server-info'
  | 'settings';

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpen,
  onClose,
}) => {
  const { isAdmin } = useAuth();

  const navItems: { id: NavView; label: string; icon: React.FC<{ className?: string }>; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'داشبورد اصلی', icon: LayoutDashboard },
    { id: 'items', label: 'کاتالوگ و کالاها', icon: Package },
    { id: 'inventory', label: 'موجودی مکان‌محور', icon: Layers },
    { id: 'stock-in', label: 'ورود کالا (رسید)', icon: ArrowDownToLine },
    { id: 'stock-out', label: 'خروج کالا (حواله)', icon: ArrowUpFromLine },
    { id: 'transfer', label: 'انتقال انبار / قفسه', icon: ArrowLeftRight },
    { id: 'warehouses', label: 'انبارها و قفسه‌ها', icon: WarehouseIcon },
    { id: 'reports', label: 'گزارش‌ها و خروجی اکسل', icon: FileSpreadsheet },
    { id: 'users', label: 'مدیریت کاربران', icon: Users, adminOnly: true },
    { id: 'audit', label: 'ممیزی و وقایع سیستم', icon: ShieldAlert, adminOnly: true },
    { id: 'backup', label: 'پشتیبان‌گیری و بازیابی', icon: Database, adminOnly: true },
    { id: 'server-info', label: 'اطلاعات سرور و شبکه', icon: Server, adminOnly: true },
    { id: 'settings', label: 'تنظیمات و امنیت', icon: Settings },
  ];

  const handleItemClick = (id: NavView) => {
    onSelectView(id);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 right-0 z-50 h-screen w-64 bg-slate-900 border-l border-slate-800 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Header with Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 lg:hidden">
          <span className="font-bold text-sm text-slate-200">منوی ناوبری سیستم</span>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-400 tracking-wider">
            عملیات انبارداری و کالا
          </div>

          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition text-right ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-center space-y-1">
          <div className="text-[11px] text-amber-400 font-bold tracking-wide">
            طراح : دکتر احسان ابوالقاسمی
          </div>
          <div className="text-[11px] font-semibold text-slate-300">
            واحد اعلام حریق ذوب‌آهن اصفهان
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">
            نسخه استاندارد صنعتی ۱.۰.۰
          </div>
        </div>
      </aside>
    </>
  );
};
