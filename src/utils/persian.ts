export function toPersianDigits(n: number | string): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return n
    .toString()
    .replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)]);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(n);
}

export function formatShamsiDate(isoDate?: string | null): string {
  if (!isoDate) return '-';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoDate;
  }
}

export function formatShamsiDateOnly(isoDate?: string | null): string {
  if (!isoDate) return '-';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return isoDate;
  }
}

export function getTransactionTypeBadge(type: string): { label: string; color: string } {
  switch (type) {
    case 'STOCK_IN':
      return { label: 'ورود کالا', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    case 'STOCK_OUT':
      return { label: 'خروج کالا', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    case 'TRANSFER':
      return { label: 'انتقال کالا', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
    case 'ADJUSTMENT':
      return { label: 'تراکنش اصلاحی', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    default:
      return { label: type, color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  }
}

export function getRoleBadge(role: string): { label: string; color: string } {
  switch (role) {
    case 'ADMIN':
      return { label: 'مدیر ارشد (ADMIN)', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    case 'WAREHOUSE_USER':
      return { label: 'کاربر انبار (WAREHOUSE)', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    default:
      return { label: role, color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  }
}
