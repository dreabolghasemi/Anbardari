import React, { useState, useEffect } from 'react';
import {
  Package,
  Warehouse as WarehouseIcon,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Search,
  ExternalLink,
  Flame,
  Activity,
} from 'lucide-react';
import { api } from '../services/api.js';
import { DashboardMetrics, StockTransaction, Item } from '../types/index.js';
import { formatNumber, formatShamsiDate, getTransactionTypeBadge } from '../utils/persian.js';
import { NavView } from './Sidebar.js';

interface DashboardViewProps {
  onNavigate: (view: NavView) => void;
  onSelectItem: (itemId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onSelectItem }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [m, t, it] = await Promise.all([
        api.getDashboardMetrics(),
        api.getTransactions({ limit: 8 }),
        api.getItems(),
      ]);
      setMetrics(m);
      setTransactions(t.transactions);
      setItems(it.items);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = searchTerm.trim()
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          i.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          i.brand.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Search Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
              <Flame className="w-4 h-4" />
              <span>سامانه مرکزی مدیریت انبار اعلام حریق ذوب‌آهن اصفهان</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              میز کار و داشبورد عملیات انبارداری
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              کنترل یکپارچه، ثبت آنی تراکنش‌های ورودی، خروجی و انتقال بدون کسری موجودی
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('stock-in')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-900/30"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>ثبت ورود کالا</span>
            </button>
            <button
              onClick={() => onNavigate('stock-out')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-900/30"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>ثبت خروج کالا</span>
            </button>
            <button
              onClick={() => onNavigate('transfer')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-900/30"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>انتقال بین انبار</span>
            </button>
          </div>
        </div>

        {/* Fast Search Input */}
        <div className="mt-5 relative">
          <div className="relative">
            <Search className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              id="dashboard-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی سریع کالا (نام دتکتور، کد فنی، برند یا مدل)..."
              className="w-full pr-11 pl-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-100 placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Search Results Dropdown */}
          {searchTerm.trim() && (
            <div className="absolute z-20 top-full mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto p-2 space-y-1">
              {filteredItems.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">
                  هیچ کالایی با مشخصات وارد شده یافت نشد.
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectItem(item.id);
                      setSearchTerm('');
                    }}
                    className="p-2.5 rounded-lg hover:bg-slate-800 flex items-center justify-between cursor-pointer border border-transparent hover:border-slate-700 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100">{item.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono border border-slate-700">
                          {item.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        برند: {item.brand} | مدل: {item.model} | دسته: {item.category}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-emerald-400">
                        موجودی کل: {formatNumber(item.totalStock || 0)} {item.unit}
                      </div>
                      <span className="text-[10px] text-sky-400 flex items-center gap-1 mt-0.5">
                        مشاهده جزئیات <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">تعداد انبارها</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <WarehouseIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100">
              {metrics ? formatNumber(metrics.totalWarehouses) : '-'}
            </span>
            <span className="text-xs text-slate-400">انبار فعال</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">تعداد قفسه‌ها</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100">
              {metrics ? formatNumber(metrics.totalShelves) : '-'}
            </span>
            <span className="text-xs text-slate-400">قفسه استاندارد</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">اقلام کاتالوگ</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100">
              {metrics ? formatNumber(metrics.totalItems) : '-'}
            </span>
            <span className="text-xs text-slate-400">قلم کالای تعریف‌شده</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">کل موجودی قطعات</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100">
              {metrics ? formatNumber(metrics.totalInventoryCount) : '-'}
            </span>
            <span className="text-xs text-slate-400">قطعه در قفسه‌ها</span>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">آخرین تراکنش‌های انبار اعلام حریق</h3>
          </div>
          <button
            onClick={() => onNavigate('reports')}
            className="text-xs text-amber-400 hover:text-amber-300 font-medium"
          >
            مشاهده گزارش کامل و اکسل &larr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 text-[11px] font-bold">
              <tr>
                <th className="p-3">نوع عملیات</th>
                <th className="p-3">نام و کد کالا</th>
                <th className="p-3">تعداد</th>
                <th className="p-3">مبدا / مقصد</th>
                <th className="p-3">ثبت‌کننده</th>
                <th className="p-3">تاریخ و زمان</th>
                <th className="p-3">سند / عطف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    در حال بارگذاری تراکنش‌ها...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    هنوز تراکنشی ثبت نشده است.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const badge = getTransactionTypeBadge(tx.type);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-100">{tx.itemName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{tx.itemCode}</div>
                      </td>
                      <td className="p-3 font-bold text-slate-100">
                        {formatNumber(tx.quantity)} {tx.itemUnit}
                      </td>
                      <td className="p-3 text-[11px]">
                        {tx.type === 'STOCK_IN' && (
                          <span className="text-emerald-400">
                            به: {tx.destWarehouseName} / {tx.destShelfName}
                          </span>
                        )}
                        {tx.type === 'STOCK_OUT' && (
                          <span className="text-rose-400">
                            از: {tx.sourceWarehouseName} / {tx.sourceShelfName}
                          </span>
                        )}
                        {tx.type === 'TRANSFER' && (
                          <span className="text-sky-400">
                            از: {tx.sourceShelfName} &rarr; به: {tx.destShelfName}
                          </span>
                        )}
                        {tx.type === 'ADJUSTMENT' && (
                          <span className="text-amber-400">اصلاح موجودی قفسه</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">{tx.userName}</td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {formatShamsiDate(tx.createdAt)}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {tx.referenceNo || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
