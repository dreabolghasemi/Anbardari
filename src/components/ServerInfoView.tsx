import React, { useState, useEffect } from 'react';
import {
  Server,
  Network,
  QrCode,
  Database,
  Cpu,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  Laptop,
  Smartphone,
  ExternalLink,
  Wifi,
  Terminal,
  Clock,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { api, NetworkInfoResponse } from '../services/api.js';
import { formatShamsiDate } from '../utils/persian.js';

export const ServerInfoView: React.FC = () => {
  const [info, setInfo] = useState<NetworkInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(0);

  const fetchNetworkInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getNetworkInfo();
      setInfo(data);
    } catch (err: any) {
      setError(err.message || 'خطا در دریافت اطلاعات شبکه سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkInfo();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2500);
  };

  const activeAddress =
    info?.addresses && info.addresses.length > selectedAddressIndex
      ? info.addresses[selectedAddressIndex]
      : null;

  const currentQr = activeAddress?.qrCode || info?.qrCodeDataUrl;
  const currentUrl = activeAddress?.url || info?.primaryUrl || '';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Server className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>اطلاعات سرور و شبکه محلی (Server Information)</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                LAN / Workgroup
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              مشخصات اتصال کلاینت‌ها، تبلت‌ها و گوشی‌های موجود در شبکه داخلی به سرور و دیتابیس متمرکز
            </p>
          </div>
        </div>

        <button
          onClick={fetchNetworkInfo}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          <span>به‌روزرسانی وضعیت</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Server Details + QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Fast Connect & QR Code */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center space-y-4">
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-slate-200 text-xs">
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>اتصال سریع موبایل / تبلت</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Scan to Connect</span>
          </div>

          {currentQr ? (
            <div className="p-3 bg-white rounded-2xl shadow-xl shadow-black/50 inline-block border-4 border-slate-800">
              <img
                src={currentQr}
                alt="QR Code for LAN Connection"
                className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
              />
            </div>
          ) : (
            <div className="w-48 h-48 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
              در حال تولید بارکد...
            </div>
          )}

          <div className="w-full space-y-2">
            <div className="text-xs text-slate-300 font-semibold">آدرس انتخابی برای اتصال:</div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-amber-300 select-all justify-between">
              <span className="truncate" dir="ltr">{currentUrl}</span>
              <button
                onClick={() => handleCopy(currentUrl, 'url')}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition shrink-0"
                title="کپی آدرس"
              >
                {copiedKey === 'url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            دوربین گوشی یا تبلت خود را روی بارکد بالا بگیرید یا آدرس را در مرورگر وارد کنید تا بدون نیاز به اینترنت مستقیماً به انبارداری متصل شوید.
          </p>
        </div>

        {/* Card 2: Server Hardware, Hostname & Database */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
                <Server className="w-4 h-4 text-amber-400" />
                <span>مشخصات فنی و وضعیت سرور مرکزی</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>سرور فعال و آماده سرویس‌دهی</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-400">نام سیستم سرور (Hostname)</div>
                <div className="text-sm font-bold text-slate-100 font-mono" dir="ltr">
                  {info?.hostname || 'Windows-Server'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-400">پورت ارتباطی نرم‌افزار</div>
                <div className="text-sm font-bold text-amber-400 font-mono" dir="ltr">
                  Port {info?.port || 3000} (TCP)
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-400">آدرس IP اصلی سرور</div>
                <div className="text-sm font-bold text-emerald-400 font-mono" dir="ltr">
                  {info?.primaryIp || '127.0.0.1'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-400">سیستم عامل سرور</div>
                <div className="text-xs font-semibold text-slate-200 truncate" dir="ltr">
                  {info?.system.platform || 'Windows Server'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-400">پردازنده و حافظه RAM</div>
                <div className="text-xs font-semibold text-slate-200">
                  {info?.system.cpus || 4} هسته | {info?.system.totalMemoryMb || 8192} MB
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-400">مدت زمان فعالیت (Uptime)</div>
                <div className="text-xs font-semibold text-slate-200 font-mono">
                  {info ? `${Math.floor(info.system.uptimeSeconds / 60)} دقیقه` : 'در دسترس'}
                </div>
              </div>
            </div>

            {/* Central Database Section */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-200">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>پایگاه داده متمرکز سیستم (Source of Truth)</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                  {info?.database.status === 'connected' ? '🟢 متصل و همگام' : '🟡 آماده‌باش'}
                </span>
              </div>
              <div className="text-xs text-slate-300 font-medium leading-relaxed">
                موتور فعال: <span className="font-bold text-amber-300">{info?.database.engine || 'PostgreSQL Central Multi-Device'}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                تمام اطلاعات کالاها، انبارها، قفسه‌ها، تراکنش‌های ورود/خروج/انتقال و ممیزی سیستم منحصراً روی پایگاه داده سرور ذخیره می‌شوند و هیچ کلاینتی دیتابیس جداگانه ندارد.
              </p>
            </div>
          </div>

          {/* Network Interfaces List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-slate-200 text-xs">
                <Network className="w-4 h-4 text-amber-400" />
                <span>کارت‌های شبکه و آدرس‌های قابل دسترس (Network Adapters)</span>
              </div>
              <span className="text-[11px] text-slate-400">انتخاب برای نمایش بارکد</span>
            </div>

            <div className="space-y-2">
              {info?.addresses && info.addresses.length > 0 ? (
                info.addresses.map((addr, idx) => {
                  const isSelected = selectedAddressIndex === idx;
                  return (
                    <div
                      key={addr.ip}
                      onClick={() => setSelectedAddressIndex(idx)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 text-white'
                          : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl ${
                            addr.type === 'ethernet'
                              ? 'bg-blue-500/20 text-blue-400'
                              : addr.type === 'wifi'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}
                        >
                          {addr.type === 'wifi' ? (
                            <Wifi className="w-4 h-4" />
                          ) : (
                            <Laptop className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold flex items-center gap-2">
                            <span>{addr.name}</span>
                            <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-400 font-mono uppercase">
                              {addr.type}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                            {addr.url}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(addr.url, `addr-${idx}`);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                          title="کپی آدرس"
                        >
                          {copiedKey === `addr-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 p-4 text-center">
                  در حال استخراج کارت‌های شبکه...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Connected Clients & Recent System Activity */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span>کلاینت‌ها و سیستم‌های متصل به سرور (Active Clients & Terminal Activity)</span>
          </div>
          <span className="text-xs text-slate-400">آخرین وقایع ثبت‌شده در سرور</span>
        </div>

        {info?.recentClients && info.recentClients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">آدرس IP کلاینت</th>
                  <th className="p-3 font-semibold">کاربر ثبت‌کننده</th>
                  <th className="p-3 font-semibold">آخرین عملیات</th>
                  <th className="p-3 font-semibold">زمان واقعه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {info.recentClients.map((client, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono text-amber-400" dir="ltr">
                      {client.ip}
                    </td>
                    <td className="p-3 font-semibold text-slate-200">{client.username}</td>
                    <td className="p-3 text-slate-300">{client.action}</td>
                    <td className="p-3 text-slate-400 font-mono">
                      {formatShamsiDate(client.lastSeen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 p-4 text-center">
            هنوز کلاینت جدیدی تراکنشی ثبت نکرده است. سرور آماده پذیرش کلاینت‌هاست.
          </p>
        )}
      </div>

      {/* Windows LAN Setup & Troubleshooting Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-200 text-sm pb-3 border-b border-slate-800">
          <Terminal className="w-4 h-4 text-amber-400" />
          <span>راهنمای اتصال سایر کامپیوترها در شبکه محلی (Windows Workgroup)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Step 1: Firewall */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-amber-400">۱. باز کردن پورت ۳۰۰۰ در فایروال ویندوز سرور</div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              برای اینکه سایر کلاینت‌ها بتوانند به این کامپیوتر متصل شوند، یکبار دستور زیر را در PowerShell یا Command Prompt به صورت Run as Administrator اجرا کنید:
            </p>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300">
              <span className="truncate" dir="ltr">{info?.workgroupGuide.firewallCommand || 'netsh advfirewall firewall add rule name="WMS" dir=in action=allow protocol=TCP localport=3000'}</span>
              <button
                onClick={() =>
                  handleCopy(
                    info?.workgroupGuide.firewallCommand ||
                      'netsh advfirewall firewall add rule name="WMS" dir=in action=allow protocol=TCP localport=3000',
                    'firewall'
                  )
                }
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition shrink-0"
                title="کپی دستور"
              >
                {copiedKey === 'firewall' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Client Connection */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-amber-400">۲. ورود کلاینت‌ها از طریق مرورگر</div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              کافی است روی کامپیوترها، لپ‌تاپ‌ها یا تبلت‌های متصل به همان مودم/سوئیچ شبکه، مرورگر Chrome یا Edge را باز کرده و آدرس IP سرور را تایپ کنید:
            </p>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-400 font-bold" dir="ltr">
              {currentUrl}
            </div>
          </div>

          {/* Step 3: PWA Installation on HTTP LAN */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-amber-400">۳. نصب اپلیکیشن PWA روی کلاینت‌ها بدون اینترنت</div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              برای نصب به صورت برنامه دسکتاپ و فعال‌سازی قابلیت‌های PWA روی کلاینت‌ها از طریق HTTP، می‌توانید در آدرس مرورگر کلاینت عبارت زیر را وارد کنید و IP سرور را به عنوان مبدا امن اضافه کنید:
            </p>
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300">
              <span className="truncate" dir="ltr">chrome://flags/#unsafely-treat-insecure-origin-as-secure</span>
              <button
                onClick={() =>
                  handleCopy(
                    'chrome://flags/#unsafely-treat-insecure-origin-as-secure',
                    'chromeflag'
                  )
                }
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition shrink-0"
              >
                {copiedKey === 'chromeflag' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Step 4: Full Documentation Link */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-bold text-amber-400">۴. مستندات گام‌به‌گام شبکه ویندوز</div>
              <p className="text-slate-400 leading-relaxed text-[11px] mt-1">
                راهنمای کامل راه‌اندازی دائمی با PostgreSQL و سرویس خودکار ویندوز در فایل <code className="text-amber-300">SETUP-WINDOWS-LAN.md</code> در پوشه پروژه ذخیره شده است.
              </p>
            </div>
            <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-900">
              واحد اعلام حریق ذوب‌آهن اصفهان — طراح : دکتر احسان ابوالقاسمی
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
