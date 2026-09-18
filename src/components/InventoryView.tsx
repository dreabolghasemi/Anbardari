import React, { useState, useEffect } from 'react';
import { Layers, Search, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { InventoryItem, Warehouse, Shelf } from '../types/index.js';
import { formatNumber, formatShamsiDate } from '../utils/persian.js';

export const InventoryView: React.FC = () => {
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedShelf, setSelectedShelf] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [invRes, whRes, shRes] = await Promise.all([
        api.getInventory({
          warehouseId: selectedWarehouse,
          shelfId: selectedShelf,
        }),
        api.getWarehouses(),
        api.getShelves(selectedWarehouse || undefined),
      ]);
      setInventories(invRes.inventories);
      setWarehouses(whRes.warehouses);
      setShelves(shRes.shelves);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouse, selectedShelf]);

  const filteredList = inventories.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.itemName.toLowerCase().includes(term) ||
      item.itemCode.toLowerCase().includes(term) ||
      item.itemBrand.toLowerCase().includes(term) ||
      item.itemModel.toLowerCase().includes(term)
    );
  });

  const totalQuantity = filteredList.reduce((sum, item) => sum + item.quantity, 0);

  const handleExportExcel = () => {
    const url = api.getExcelExportUrl('INVENTORY', {
      warehouseId: selectedWarehouse,
      shelfId: selectedShelf,
    });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            <span>گزارش موجودی مکان‌محور (انبار و قفسه‌ها)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مشاهده دقیق جایگاه فیزیکی قطعات، دتکتورها و قطعات یدکی در قفسه‌های فعال
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-900/30"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>خروجی اکسل موجودی (.xlsx)</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-xs">
        <div className="sm:col-span-2 relative">
          <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="فیلتر بر اساس نام یا کد فنی قطعه..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setSelectedShelf('');
            }}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="">همه انبارها</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedShelf}
            onChange={(e) => setSelectedShelf(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="">همه قفسه‌ها</option>
            {shelves.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
        <span className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          تعداد ردیف‌های موجودی: <b className="text-amber-400">{filteredList.length}</b>
        </span>
        <span className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          مجموع کل اقلام: <b className="text-emerald-400">{formatNumber(totalQuantity)}</b> عدد
        </span>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-800/70 text-slate-400 text-[11px] font-bold">
              <tr>
                <th className="p-3">ردیف</th>
                <th className="p-3">کد کالا</th>
                <th className="p-3">نام و مشخصات کالا</th>
                <th className="p-3">برند / مدل</th>
                <th className="p-3">انبار</th>
                <th className="p-3">قفسه</th>
                <th className="p-3">موجودی فعلی</th>
                <th className="p-3">آخرین به‌روزرسانی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    در حال بارگذاری لیست موجودی...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    موردی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredList.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="p-3">
                      <span className="font-mono text-amber-400 font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                        {row.itemCode}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-100">
                      <div>{row.itemName}</div>
                      <div className="text-[10px] text-slate-400">{row.itemCategory}</div>
                    </td>
                    <td className="p-3 text-slate-400">
                      <div>{row.itemBrand}</div>
                      <div className="text-[10px]">{row.itemModel}</div>
                    </td>
                    <td className="p-3 text-slate-200">
                      {row.warehouseName}
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {row.warehouseCode}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 font-mono font-medium">
                        {row.shelfName} ({row.shelfCode})
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-sm font-black ${
                          row.quantity === 0
                            ? 'text-rose-400'
                            : row.quantity < 10
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {formatNumber(row.quantity)} {row.itemUnit}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">
                      {formatShamsiDate(row.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
