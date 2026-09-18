import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetStorage = () => {
    if (
      window.confirm(
        'آیا از بازنشانی داده‌های موقت مرورگر اطمینان دارید؟ تمامی داده‌های اولیه انبار اعلام حریق مجدداً بارگذاری می‌شوند.'
      )
    ) {
      try {
        localStorage.removeItem('wms_client_database');
        localStorage.removeItem('wms_client_passwords');
        localStorage.removeItem('wms_auth_token');
      } catch (e) {
        console.error('Storage clear error:', e);
      }
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center selection:bg-amber-500 selection:text-slate-950 font-sans"
          dir="rtl"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4 shadow-xl">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white mb-2">
            خطایی در اجرای نرم‌افزار رخ داد
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            سامانه با یک خطای بارگذاری مواجه شده است. با دکمه‌های زیر می‌توانید نرم‌افزار را مجدداً بارگذاری کرده یا حافظه موقت مرورگر را بازنشانی فرمایید.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-xl w-full text-right mb-6 text-xs font-mono text-rose-300 overflow-x-auto shadow-inner" dir="ltr">
            {this.state.error?.message || 'Unknown runtime error'}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>بارگذاری مجدد صفحه</span>
            </button>

            <button
              onClick={this.handleResetStorage}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm transition border border-slate-700 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>بازنشانی حافظه موقت مرورگر</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
