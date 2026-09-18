import React, { useState } from 'react';
import { Menu, LogOut, WifiOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { PWAInstallButton } from './PWAInstallButton.js';
import { getRoleBadge } from '../utils/persian.js';
import { ZobAhanLogo } from './ZobAhanLogo.js';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigateSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onNavigateSettings }) => {
  const { user, logout, serverConnected, checkServerHealth } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const roleInfo = user ? getRoleBadge(user.role) : null;

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md">
      {/* Offline/Disconnected Warning Banner */}
      {!serverConnected && (
        <div className="bg-rose-600 text-white text-xs font-bold px-4 py-2 text-center flex items-center justify-center gap-3 shadow-inner">
          <WifiOff className="w-4 h-4 shrink-0 animate-bounce" />
          <span>«شبکه قطع است» — ارتباط با سرور مرکزی برقرار نیست. اطلاعات اصلی در سرور ذخیره می‌شوند.</span>
          <button
            onClick={() => checkServerHealth()}
            className="px-2.5 py-0.5 rounded-md bg-white text-rose-700 font-bold hover:bg-rose-50 text-[11px] transition shadow-xs"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left Side: Brand & Mobile Toggle */}
        <div className="flex items-center gap-3">
          <button
            id="btn-toggle-sidebar"
            onClick={onToggleSidebar}
            aria-label="منوی اصلی"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-0.5 rounded-xl bg-slate-950/80 border border-slate-700/80 shadow-md shadow-black/40 flex items-center justify-center">
              <ZobAhanLogo className="w-9 h-9" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-100 tracking-tight leading-tight">
                نرم‌افزار انبارداری واحد اعلام حریق
              </h1>
            </div>
          </div>
        </div>

        {/* Right Side: Network Status, PWA Install, User info, Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Server Connection Indicator Button */}
          {serverConnected ? (
            <button
              onClick={() => checkServerHealth()}
              title="سرور مرکزی آنلاین و متصل است (کلیک برای بررسی مجدد)"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <span>🟢 سرور متصل است</span>
            </button>
          ) : (
            <button
              onClick={() => checkServerHealth()}
              title="شبکه قطع است (کلیک برای تلاش مجدد و اتصال مجدد)"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25 transition cursor-pointer animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>🔴 شبکه قطع است</span>
            </button>
          )}

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* User Profile Badge */}
          {user && (
            <button
              onClick={onNavigateSettings}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-slate-800 transition text-right"
              title="تنظیمات حساب کاربری"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400">
                {user.fullName.charAt(0)}
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-semibold text-slate-200">{user.fullName}</p>
                {roleInfo && (
                  <span className={`inline-block px-1.5 py-0.2 text-[10px] rounded border ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                )}
              </div>
            </button>
          )}

          {/* Logout Button (Step 1) */}
          <button
            id="btn-logout"
            onClick={() => setShowLogoutConfirm(true)}
            title="خروج از سامانه"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Two-step Logout Confirmation Modal (Step 2) */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-6 text-slate-100 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">تایید خروج از سامانه</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">مرحله دوم: تایید نهایی</p>
              </div>
            </div>

            <p className="text-slate-300 leading-relaxed text-xs">
              آیا برای خروج از سامانه انبارداری اطمینان دارید؟ برای ورود مجدد نیاز به نام کاربری و رمز عبور خواهد بود.
            </p>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold transition shadow-lg shadow-rose-900/30"
              >
                <LogOut className="w-4 h-4" />
                <span>تایید و خروج از حساب</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
