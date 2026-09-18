import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Database,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Server,
  Filter,
} from 'lucide-react';
import { api, SERVER_DISCONNECTED_MESSAGE } from '../services/api.js';
import { AuditLog } from '../types/index.js';
import { formatShamsiDate } from '../utils/persian.js';

export const AuditBackupView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'AUDIT' | 'BACKUP'>('AUDIT');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [actionFilter, setActionFilter] = useState('');
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: Record<string, string> = { limit: '100' };
      if (actionFilter) filters.action = actionFilter;
      const res = await api.getAuditLogs(filters);
      setLogs(res.logs);
    } catch (err: any) {
      setError(err.message === SERVER_DISCONNECTED_MESSAGE ? 'شبکه قطع است' : err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const checkHealth = async () => {
    try {
      const health = await api.getHealthStatus();
      setServerHealth(health);
    } catch {
      setServerHealth(null);
    }
  };

  useEffect(() => {
    loadLogs();
    checkHealth();
  }, [actionFilter]);

  const handleDownloadBackup = async () => {
    setIsExporting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const backupData = await api.exportBackup();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zobahan-fire-warehouse-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg('فایل پشتیبان کامل با موفقیت از سرور دریافت و ذخیره شد.');
    } catch (err: any) {
      setError(err.message === SERVER_DISCONNECTED_MESSAGE ? 'شبکه قطع است' : err.message || 'خطا در دریافت پشتیبان.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('هشدار بحرانی: با بازگردانی نسخه پشتیبان روی پایگاه داده سرور، کلیه داده‌های فعلی بازنویسی خواهند شد. آیا مطمئن هستید؟')) {
      if (restoreFileRef.current) restoreFileRef.current.value = '';
      return;
    }

    setIsRestoring(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      await api.restoreBackup(jsonData, 'CONFIRM_RESTORE');
      setSuccessMsg('نسخه پشتیبان با موفقیت در پایگاه داده سرور بازگردانی شد.');
      await loadLogs();
      await checkHealth();
    } catch (err: any) {
      setError(err.message === SERVER_DISCONNECTED_MESSAGE ? 'شبکه قطع است' : err.message || 'خطا در بازگردانی نسخه پشتیبان.');
    } finally {
      setIsRestoring(false);
      if (restoreFileRef.current) restoreFileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            <span>لاگ‌های امنیتی (Audit Logs) و پشتیبان‌گیری سرور</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ثبت غیرقابل تغییر رویدادهای سیستم در سرور، ردیابی فعالیت‌های کاربران و پشتیبان‌گیری
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('AUDIT')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'AUDIT'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            دفتر وقایع سیستم (Audit)
          </button>
          <button
            onClick={() => setActiveSubTab('BACKUP')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'BACKUP'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            پشتیبان‌گیری و بازیابی
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {activeSubTab === 'AUDIT' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200">فیلتر وقایع:</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs"
              >
                <option value="">همه وقایع</option>
                <option value="LOGIN">ورود به سیستم (LOGIN)</option>
                <option value="LOGOUT">خروج از سیستم (LOGOUT)</option>
                <option value="STOCK_IN">ورود کالا (STOCK_IN)</option>
                <option value="STOCK_OUT">خروج کالا (STOCK_OUT)</option>
                <option value="TRANSFER">انتقال کالا (TRANSFER)</option>
                <option value="ADJUST">اصلاح موجودی (ADJUST)</option>
                <option value="ITEM_CREATE">ثبت کالا</option>
                <option value="ITEM_UPDATE">ویرایش کالا</option>
                <option value="ITEM_DELETE">حذف کالا</option>
                <option value="BACKUP_EXPORT">پشتیبان‌گیری</option>
                <option value="BACKUP_RESTORE">بازیابی</option>
              </select>
            </div>

            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>به‌روزرسانی وقایع</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">کاربر</th>
                  <th className="p-3">نوع واقعه</th>
                  <th className="p-3">موجودیت</th>
                  <th className="p-3">جزئیات</th>
                  <th className="p-3">آدرس IP</th>
                  <th className="p-3">تاریخ و ساعت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      در حال بارگذاری لاگ‌های ممیزی از سرور...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      هیچ واقعه‌ای ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-semibold text-slate-200">{log.username}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 font-mono text-[11px] text-amber-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-mono text-[11px]">{log.entity}</td>
                      <td className="p-3 text-slate-300">{log.details || '-'}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-400" dir="ltr">
                        {log.ipAddress || '-'}
                      </td>
                      <td className="p-3 text-slate-400 font-mono whitespace-nowrap">
                        {formatShamsiDate(log.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Server & Central Database Status Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">وضعیت پایگاه داده سرور مرکزی</h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{serverHealth?.databaseEngine || 'PostgreSQL Central Multi-Device'}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  کلیه عملیات‌های پشتیبان‌گیری و بازیابی به صورت مستقیم بر روی دیتابیس سرور اعمال می‌گردند.
                </p>
              </div>
            </div>

            <button
              onClick={checkHealth}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer self-start md:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>بررسی اتصال</span>
            </button>
          </div>

          {/* Action Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Backup Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">پشتیبان‌گیری کامل از پایگاه داده (Export)</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    دریافت فایل یکپارچه JSON از کلیه جداول کالاها، انبارها، قفسه‌ها، سوابق ورود و خروج، کاربران و دفتر ممیزی برای نگهداری ایمن روی فلش یا دیسک خارجی.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  disabled={isExporting}
                  onClick={handleDownloadBackup}
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
                  <span>{isExporting ? 'در حال تهیه خروجی...' : 'دانلود نسخه پشتیبان کامل (JSON)'}</span>
                </button>
              </div>
            </div>

            {/* Restore Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">بازیابی نسخه پشتیبان روی سرور (Restore)</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    آپلود فایل پشتیبان JSON قبلی جهت بازیابی کلیه اطلاعات در پایگاه داده سرور در صورت تعویض سیستم سرور یا بروز خرابی.
                  </p>
                </div>
              </div>

              <input
                type="file"
                ref={restoreFileRef}
                onChange={handleRestoreFileSelected}
                accept=".json,application/json"
                className="hidden"
              />

              <div className="pt-2">
                <button
                  disabled={isRestoring}
                  onClick={() => restoreFileRef.current?.click()}
                  className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Upload className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                  <span>{isRestoring ? 'در حال بازیابی اطلاعات...' : 'انتخاب و بازیابی فایل پشتیبان'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
