import React, { useState } from 'react';
import { Download, CheckCircle2, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.js';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, triggerInstall } = usePWAInstall();
  const [showIosModal, setShowIosModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await triggerInstall();
    } else if (isIOS) {
      setShowIosModal(true);
    } else {
      // General prompt for desktop or Android browser menu
      setShowIosModal(true);
    }
  };

  return (
    <>
      <button
        id="pwa-install-btn"
        onClick={handleClick}
        title="نصب نرم‌افزار روی ویندوز، تبلت یا موبایل به صورت PWA"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 transition shadow-sm ${className}`}
      >
        <Download className="w-3.5 h-3.5 animate-bounce" />
        <span>نصب نرم‌افزار (PWA)</span>
      </button>

      {/* Installation Guide Modal (iOS / Desktop instruction fallback) */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative">
            <button
              onClick={() => setShowIosModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">راهنمای نصب نرم‌افزار انبارداری</h3>
                <p className="text-xs text-slate-400">واحد اعلام حریق ذوب‌آهن اصفهان</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <p>این سامانه به صورت PWA استاندارد طراحی شده و بدون نیاز به دانلود از استور قابل اجراست:</p>

              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60 space-y-2">
                <p className="font-semibold text-amber-300">در گوشی و تبلت اپل (iPhone / iPad):</p>
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>۱. دکمه <b>Share</b> در پایین مرورگر سافاری را لمس کنید.</span>
                </div>
                <div className="flex items-center gap-2">
                  <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>۲. گزینه <b>Add to Home Screen</b> را انتخاب کنید.</span>
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60 space-y-2">
                <p className="font-semibold text-amber-300">در ویندوز، لپ‌تاپ و اندروید:</p>
                <p>در مرورگر Chrome یا Edge، روی آیکون نصب در نوار آدرس یا منوی سه‌نقطه مرورگر کلیک کرده و «نصب برنامه (Install App)» را انتخاب کنید.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowIosModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
