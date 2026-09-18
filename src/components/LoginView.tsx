import React, { useState, useRef, useEffect } from 'react';
import { Lock, User, ShieldCheck, AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { ZobAhanLogo } from './ZobAhanLogo.js';
import { SERVER_DISCONNECTED_MESSAGE } from '../services/api.js';

export const LoginView: React.FC = () => {
  const { login, serverConnected, checkServerHealth } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showError = (message: string) => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    setError(message);
    errorTimeoutRef.current = setTimeout(() => {
      setError(null);
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const handleRetryConnection = async () => {
    setIsCheckingHealth(true);
    const connected = await checkServerHealth();
    setIsCheckingHealth(false);
    if (!connected) {
      showError('شبکه قطع است');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serverConnected) {
      showError('شبکه قطع است');
      return;
    }

    if (!username.trim() || !password.trim()) {
      showError('نام کاربری یا رمز عبور اشتباه است');
      return;
    }

    setIsLoading(true);

    try {
      await login(username.trim(), password);
    } catch (err: any) {
      if (
        err?.message === 'شبکه قطع است' ||
        err?.message === SERVER_DISCONNECTED_MESSAGE ||
        err?.message?.includes('شبکه') ||
        err?.message?.includes('fetch')
      ) {
        showError('شبکه قطع است');
      } else if (err?.message && err.message.includes('غیرفعال')) {
        showError(err.message);
      } else {
        showError('نام کاربری یا رمز عبور اشتباه است');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-amber-500 selection:text-slate-950 relative overflow-hidden">
      {/* Subtle industrial background glow */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Main Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-slate-950/60 border border-slate-800 shadow-xl shadow-black/40">
              <ZobAhanLogo className="w-16 h-16 sm:w-20 sm:h-20" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                واحد اعلام حریق ذوب‌آهن اصفهان
              </h1>
              <p className="text-xs text-amber-400/90 font-bold mt-1">
                سامانه انبارداری متمرکز شبکه محلی (LAN / Workgroup)
              </p>
            </div>
          </div>

          {/* Connection Error Banner when Network/Server is Disconnected */}
          {!serverConnected && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>«شبکه قطع است»</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 font-mono">
                  🔴 Offline
                </span>
              </div>
              <p className="text-[11px] text-rose-200/90 leading-relaxed">
                ارتباط با سرور مرکزی برقرار نیست. اطلاعات در سرور مرکزی ذخیره می‌شود و ورود تنها هنگام اتصال فعال امکان‌پذیر است.
              </p>
              <button
                type="button"
                onClick={handleRetryConnection}
                disabled={isCheckingHealth}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                <span>{isCheckingHealth ? 'در حال بررسی اتصال سرور...' : 'تلاش مجدد برای اتصال'}</span>
              </button>
            </div>
          )}

          {/* Form Error (4-second auto-clearing message) */}
          {error && (
            <div
              id="login-error-banner"
              className="p-3.5 rounded-2xl bg-rose-500/20 border-2 border-rose-500/60 text-rose-200 text-xs flex items-center gap-2.5 shadow-lg shadow-rose-950/50 font-bold"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5" htmlFor="username">
                نام کاربری سیستم
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  autoFocus
                  dir="ltr"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pr-4 pl-10 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 font-mono text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5" htmlFor="password">
                کلمه عبور امنیتی
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-4 pl-10 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 font-mono text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading || !serverConnected}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-sm transition shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>در حال تایید اعتبار در سرور...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>ورود به سامانه انبارداری</span>
                </>
              )}
            </button>
          </form>

          {/* Credits */}
          <div className="pt-2 border-t border-slate-800/80 text-center space-y-1">
            <div className="text-[11px] font-bold text-amber-400">
              طراح : دکتر احسان ابوالقاسمی
            </div>
            <div className="text-[10px] text-slate-400">
              واحد اعلام حریق ذوب‌آهن اصفهان — پایگاه داده متمرکز شبکه محلی
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
