import React, { useEffect, useState } from 'react';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { User } from '../types/index.js';
import { ZobAhanLogo } from './ZobAhanLogo.js';

interface WelcomeSlideProps {
  user: User;
  onComplete: () => void;
}

export const WelcomeSlide: React.FC<WelcomeSlideProps> = ({ user, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState<number>(3);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    // 3-second timer
    const totalDuration = 3000;
    const intervalTime = 50;
    const step = (intervalTime / totalDuration) * 100;

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(progressTimer);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    const countdownTimer = setInterval(() => {
      setTimeLeft((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    const completionTimer = setTimeout(() => {
      onComplete();
    }, totalDuration);

    return () => {
      clearInterval(progressTimer);
      clearInterval(countdownTimer);
      clearTimeout(completionTimer);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950 overflow-hidden"
      dir="rtl"
    >
      {/* Ambient background glows */}
      <div className="absolute top-1/3 -right-20 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/3 -left-20 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Center Slide Card */}
      <div className="max-w-lg w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 text-center space-y-6 backdrop-blur-xl">
        {/* Animated Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 rounded-3xl bg-slate-950 border border-slate-700/80 p-2 flex items-center justify-center shadow-xl shadow-amber-500/10">
            <ZobAhanLogo className="w-16 h-16" />
          </div>
          <div className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg border-2 border-slate-900">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Welcome Title as requested */}
        <div className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
            {user.fullName} عزیز به سیستم انبار داری خوش امدید
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            اطلاعات کاربری با موفقیت تأیید شد. در حال انتقال به پیشخوان...
          </p>
        </div>

        {/* 3-Second Progress Bar */}
        <div className="space-y-2 pt-2">
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>انتقال به سامانه در {timeLeft} ثانیه</span>
            <span className="text-amber-400 font-mono font-bold">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Quick entry button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 text-xs font-bold transition border border-slate-700/80 hover:border-amber-500/40"
          >
            <span>ورود مستقیم</span>
            <ArrowLeft className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
