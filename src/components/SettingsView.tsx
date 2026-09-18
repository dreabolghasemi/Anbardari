import React, { useState, useEffect } from 'react';
import { Settings, KeyRound, CheckCircle2, AlertCircle, Server, Info, Network, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api, SERVER_DISCONNECTED_MESSAGE } from '../services/api.js';

interface SettingsViewProps {
  onNavigateServerInfo?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigateServerInfo }) => {
  const { user, isAdmin, serverConnected, checkServerHealth } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Server Base URL (for connecting to a custom server IP on LAN)
  const [apiUrl, setApiUrl] = useState(api.getApiBaseUrl());
  const [apiSaveSuccess, setApiSaveSuccess] = useState(false);
  const [healthInfo, setHealthInfo] = useState<{
    databaseEngine?: string;
    database?: string;
    warehousesCount?: number;
  } | null>(null);

  useEffect(() => {
    if (serverConnected) {
      api.getHealth().then((res) => {
        setHealthInfo({
          databaseEngine: res.databaseEngine,
          database: res.database,
          warehousesCount: res.warehousesCount,
        });
      }).catch(() => {});
    }
  }, [serverConnected]);

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    api.setApiBaseUrl(apiUrl);
    setApiSaveSuccess(true);
    setTimeout(() => setApiSaveSuccess(false), 3000);
    checkServerHealth();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('کلمه عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('تکرار کلمه عبور جدید مطابقت ندارد.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (user) {
        await api.updateUser(user.id, { password: newPassword });
        setSuccess('کلمه عبور با موفقیت به‌روزرسانی شد.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setError(err.message === SERVER_DISCONNECTED_MESSAGE ? 'شبکه قطع است' : err.message || 'خطا در تغییر کلمه عبور.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <span>تنظیمات سامانه و امنیت کاربر</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت امنیت کلمه عبور و مشاهده مشخصات اتصال به سرور مرکزی شبکه محلی
          </p>
        </div>

        {isAdmin && onNavigateServerInfo && (
          <button
            onClick={onNavigateServerInfo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer self-start md:self-auto shadow-md shadow-amber-500/20"
          >
            <Network className="w-4 h-4" />
            <span>مشاهده اطلاعات سرور و QR Code</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Change Password Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 font-bold text-slate-200 text-sm pb-2 border-b border-slate-800">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>تغییر کلمه عبور کاربری</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                کلمه عبور جدید <span className="text-rose-400">*</span>
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="حداقل ۶ کاراکتر"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono text-left focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                تکرار کلمه عبور جدید <span className="text-rose-400">*</span>
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="تکرار کلمه عبور جدید"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono text-left focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !serverConnected}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-2 cursor-pointer"
            >
              {isLoading ? 'در حال ثبت در سرور...' : 'ذخیره کلمه عبور جدید'}
            </button>
          </form>
        </div>

        {/* Server & LAN Architecture Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
              <Server className="w-4 h-4 text-amber-400" />
              <span>معماری شبکه محلی (LAN / Workgroup)</span>
            </div>
            <span
              className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                serverConnected
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${serverConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              <span>{serverConnected ? '🟢 سرور متصل است' : '🔴 شبکه قطع است'}</span>
            </span>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <div className="font-bold text-slate-200 flex items-center gap-2">
              <span>اصل معماری: SERVER = مرجع حقیقت داده‌ها</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              تمامی اطلاعات کالاها، تراکنش‌های ورود/خروج، کاربران و گزارش‌ها منحصراً روی کامپیوتر سرور مرکزی ذخیره می‌شوند. کلاینت‌ها تنها رابط کاربری هستند و هیچ دیتابیس جداگانه‌ای روی کلاینت وجود ندارد.
            </p>
          </div>

          {/* Custom Server IP form */}
          <form onSubmit={handleSaveApiUrl} className="space-y-3 pt-1">
            <div>
              <label className="block text-slate-400 mb-1.5 font-medium">
                آدرس اختصاصی سرور شبکه محلی (اختیاری برای کلاینت‌ها):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="مثال: http://192.168.1.10:3000 (پیش‌فرض: خودکار)"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  dir="ltr"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition cursor-pointer text-xs"
                >
                  ثبت
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                اگر از روی کلاینت متصل شده‌اید، این آدرس به صورت خودکار شناسایی می‌شود و نیازی به تغییر ندارد.
              </p>
            </div>
            {apiSaveSuccess && (
              <div className="text-emerald-400 text-xs flex items-center gap-1.5 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                <span>آدرس سرور با موفقیت ثبت شد. ارتباط بررسی می‌گردد.</span>
              </div>
            )}
          </form>

          {/* Database Info */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">موتور دیتابیس سرور:</span>
            <span className="font-bold text-amber-300 font-mono">
              {healthInfo?.databaseEngine || 'PostgreSQL Central Multi-Device'}
            </span>
          </div>
        </div>

        {/* Technical Specification Card */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-200 text-sm pb-2 border-b border-slate-800">
            <Info className="w-4 h-4 text-amber-400" />
            <span>مشخصات فنی سامانه انبارداری واحد اعلام حریق</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-400 block text-[11px]">سامانه:</span>
              <span className="font-bold text-slate-100 text-xs">انبارداری واحد اعلام حریق</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">طراح و توسعه‌دهنده:</span>
              <span className="font-bold text-amber-400 text-xs">دکتر احسان ابوالقاسمی</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">نوع نرم‌افزار:</span>
              <span className="font-semibold text-emerald-400 text-xs">Full-Stack PWA (LAN Dedicated)</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">تضمین همزمانی:</span>
              <span className="font-semibold text-sky-400 text-xs">PostgreSQL ACID Transactions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
