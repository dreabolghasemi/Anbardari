import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  UserCheck,
  Search,
  Filter,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Item, Warehouse, Shelf, User } from '../types/index.js';
import { formatNumber, formatShamsiDate, getTransactionTypeBadge } from '../utils/persian.js';

type ReportType = 'INVENTORY' | 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER' | 'USER_ACTIVITY';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportType>('INVENTORY');
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter options
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Selected filters
  const [filterItem, setFilterItem] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterShelf, setFilterShelf] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Load filter lists
  useEffect(() => {
    api.getItems().then((r) => setItems(r.items));
    api.getWarehouses().then((r) => setWarehouses(r.warehouses));
    api.getShelves().then((r) => setShelves(r.shelves));
    api.getUsers().then((r) => setUsers(r.users)).catch(() => {});
  }, []);

  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getReportData(activeTab, {
        itemId: filterItem,
        warehouseId: filterWarehouse,
        shelfId: filterShelf,
        userId: filterUser,
      });
      setData(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [activeTab, filterItem, filterWarehouse, filterShelf, filterUser]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await api.exportExcel(activeTab, {
        itemId: filterItem,
        warehouseId: filterWarehouse,
        shelfId: filterShelf,
        userId: filterUser,
      });
    } catch (err: any) {
      alert(err.message || 'خطا در دانلود فایل اکسل');
    } finally {
      setIsExporting(false);
    }
  };

  const tabs = [
    { id: 'INVENTORY' as ReportType, label: 'گزارش موجودی کالاها', icon: Layers },
    { id: 'STOCK_IN' as ReportType, label: 'گزارش ورود قطعات (رسید)', icon: ArrowDownToLine },
    { id: 'STOCK_OUT' as ReportType, label: 'گزارش خروج قطعات (حواله)', icon: ArrowUpFromLine },
    { id: 'TRANSFER' as ReportType, label: 'گزارش انتقالات بین انبار', icon: ArrowLeftRight },
    { id: 'USER_ACTIVITY' as ReportType, label: 'گزارش فعالیت کاربران', icon: UserCheck },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <span>مرکز گزارش‌ها و خروجی اکسل (Excel Reports)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            تهیه گزارش‌های رسمی انبارداری همراه با خروجی استاندارد .xlsx با جهت راست‌به‌چپ (RTL)
          </p>
        </div>

        <button
          id="btn-export-excel"
          onClick={handleExportExcel}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-900/30"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>دانلود فایل اکسل (.xlsx)</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-xs space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-300">
          <Filter className="w-4 h-4 text-amber-400" />
          <span>فیلترهای گزارش:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-slate-400 mb-1 text-[11px]">انتخاب کالا</label>
            <select
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
            >
              <option value="">همه کالاها</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 text-[11px]">انتخاب انبار</label>
            <select
              value={filterWarehouse}
              onChange={(e) => setFilterWarehouse(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
            >
              <option value="">همه انبارها</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 text-[11px]">انتخاب قفسه</label>
            <select
              value={filterShelf}
              onChange={(e) => setFilterShelf(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
            >
              <option value="">همه قفسه‌ها</option>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 text-[11px]">کاربر ثبت‌کننده</label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
            >
              <option value="">همه کاربران</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.username})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* Report Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">
            تعداد ردیف‌های گزارش: <b className="text-amber-400">{data.length}</b> رکورد
          </span>
          <span className="text-[11px] text-slate-400">
            جهت مشاهده در اکسل روی دکمه «دانلود فایل اکسل» کلیک کنید.
          </span>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'INVENTORY' ? (
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-800/70 text-slate-400 text-[11px] font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">کد کالا</th>
                  <th className="p-3">نام کالا</th>
                  <th className="p-3">برند / مدل</th>
                  <th className="p-3">انبار</th>
                  <th className="p-3">قفسه</th>
                  <th className="p-3">موجودی</th>
                  <th className="p-3">آخرین تغییر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">
                      در حال بارگذاری گزارش...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">
                      داده‌ای یافت نشد.
                    </td>
                  </tr>
                ) : (
                  data.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-3 font-mono text-amber-400 font-semibold">{row.itemCode}</td>
                      <td className="p-3 font-bold text-slate-100">{row.itemName}</td>
                      <td className="p-3 text-slate-400">{row.itemBrand} {row.itemModel}</td>
                      <td className="p-3 text-slate-300">{row.warehouseName}</td>
                      <td className="p-3 text-slate-300">{row.shelfName}</td>
                      <td className="p-3 font-bold text-emerald-400">
                        {formatNumber(row.quantity)} {row.itemUnit}
                      </td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {formatShamsiDate(row.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'USER_ACTIVITY' ? (
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-800/70 text-slate-400 text-[11px] font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">کاربر</th>
                  <th className="p-3">نوع عملیات</th>
                  <th className="p-3">شرح واقعه</th>
                  <th className="p-3">آدرس IP</th>
                  <th className="p-3">تاریخ و زمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      در حال دریافت گزارش...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      رکوردی یافت نشد.
                    </td>
                  </tr>
                ) : (
                  data.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-200">{log.username}</td>
                      <td className="p-3 font-mono text-[11px] text-amber-400">{log.action}</td>
                      <td className="p-3 text-slate-300">{log.details || '-'}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">{log.ipAddress}</td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {formatShamsiDate(log.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-800/70 text-slate-400 text-[11px] font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">نوع</th>
                  <th className="p-3">کالا</th>
                  <th className="p-3">تعداد</th>
                  <th className="p-3">موقعیت مبدا</th>
                  <th className="p-3">موقعیت مقصد</th>
                  <th className="p-3">ثبت‌کننده</th>
                  <th className="p-3">تاریخ</th>
                  <th className="p-3">سند</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400">
                      در حال دریافت گزارش...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400">
                      رکوردی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  data.map((tx, idx) => {
                    const badge = getTransactionTypeBadge(tx.type);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/40">
                        <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-100">{tx.itemName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{tx.itemCode}</div>
                        </td>
                        <td className="p-3 font-bold text-slate-100">
                          {formatNumber(tx.quantity)} {tx.itemUnit}
                        </td>
                        <td className="p-3 text-slate-400">
                          {tx.sourceWarehouseName ? `${tx.sourceWarehouseName} / ${tx.sourceShelfName}` : '-'}
                        </td>
                        <td className="p-3 text-slate-400">
                          {tx.destWarehouseName ? `${tx.destWarehouseName} / ${tx.destShelfName}` : '-'}
                        </td>
                        <td className="p-3 text-slate-300">{tx.userName}</td>
                        <td className="p-3 text-slate-400 whitespace-nowrap">
                          {formatShamsiDate(tx.createdAt)}
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[11px]">
                          {tx.referenceNo || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
