import React, { useState, useEffect } from 'react';
import { ArrowUpFromLine, CheckCircle2, AlertCircle, Package, Lock } from 'lucide-react';
import { api } from '../services/api.js';
import { Item, Warehouse, Shelf, StockTransaction, InventoryItem } from '../types/index.js';
import { formatNumber, formatShamsiDate } from '../utils/persian.js';

export const StockOutView: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<StockTransaction[]>([]);
  const [nextDocNumber, setNextDocNumber] = useState<string>('1001');

  // Form
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedShelfId, setSelectedShelfId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadNextDocNumber = async () => {
    try {
      const num = await api.getNextDocNumber();
      if (num) setNextDocNumber(num);
    } catch {
      // fallback
    }
  };

  const loadBaseData = async () => {
    try {
      const [itRes, whRes, invRes, txRes, nextDoc] = await Promise.all([
        api.getItems(),
        api.getWarehouses(),
        api.getInventory(),
        api.getTransactions({ type: 'STOCK_OUT', limit: 5 }),
        api.getNextDocNumber().catch(() => '1001'),
      ]);
      setItems(itRes.items);
      setWarehouses(whRes.warehouses);
      setInventories(invRes.inventories);
      setRecentTransactions(txRes.transactions);
      if (nextDoc) setNextDocNumber(nextDoc);

      if (whRes.warehouses.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(whRes.warehouses[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) {
      api.getShelves(selectedWarehouseId).then((res) => {
        setShelves(res.shelves);
        if (res.shelves.length > 0) {
          setSelectedShelfId(res.shelves[0].id);
        } else {
          setSelectedShelfId('');
        }
      });
    }
  }, [selectedWarehouseId]);

  // Find available stock for the selected (item, warehouse, shelf)
  const currentInventoryRow = inventories.find(
    (inv) =>
      inv.itemId === selectedItemId &&
      inv.warehouseId === selectedWarehouseId &&
      inv.shelfId === selectedShelfId
  );
  const availableStock = currentInventoryRow ? currentInventoryRow.quantity : 0;

  const enteredQty = parseInt(quantity, 10) || 0;
  const isInsufficient = enteredQty > availableStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !selectedWarehouseId || !selectedShelfId || !quantity) {
      setError('لطفاً کالا، انبار، قفسه و تعداد خروجی را وارد نمایید.');
      return;
    }

    if (enteredQty <= 0) {
      setError('تعداد خروجی باید یک عدد مثبت باشد.');
      return;
    }

    if (enteredQty > availableStock) {
      setError('موجودی کافی نیست.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.stockOut({
        itemId: selectedItemId,
        warehouseId: selectedWarehouseId,
        shelfId: selectedShelfId,
        quantity: enteredQty,
        notes,
      });

      const assignedDoc = res.transaction?.referenceNo || nextDocNumber;
      setSuccessMsg(
        `حواله خروج با شماره سند ${assignedDoc} با موفقیت صادر شد. موجودی باقیمانده: ${formatNumber(res.remainingQuantity)} عدد`
      );
      setQuantity('');
      setNotes('');

      // Refresh inventory, transactions and advance next doc number
      const [invRes, txRes, nextDoc] = await Promise.all([
        api.getInventory(),
        api.getTransactions({ type: 'STOCK_OUT', limit: 5 }),
        api.getNextDocNumber().catch(() => ''),
      ]);
      setInventories(invRes.inventories);
      setRecentTransactions(txRes.transactions);
      if (nextDoc) setNextDocNumber(nextDoc);
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت خروج کالا.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItem = items.find((i) => i.id === selectedItemId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
          <ArrowUpFromLine className="w-5 h-5 text-rose-400" />
          <span>حواله و ثبت خروج کالا از انبار (Stock Out)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          تحویل قطعات و دتکتورها به خطوط تولید، نورد، کوره بلند یا پیمانکاران ایمنی ذوب‌آهن
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Container */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-bold">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Item Selector */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                انتخاب قطعه برای خروج <span className="text-rose-400">*</span>
              </label>
              <select
                id="stock-out-item"
                required
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-rose-500 text-xs"
              >
                <option value="">
                  {items.length === 0 ? '-- ابتدا کالا را در بخش کاتالوگ ثبت فرمایید --' : '-- لطفاً قطعه را انتخاب نمایید --'}
                </option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} [{it.code}] - {it.brand} {it.model}
                  </option>
                ))}
              </select>
              {items.length === 0 && (
                <p className="text-[11px] text-amber-400 mt-1.5 font-medium">
                  توجه: هنوز کالایی در سامانه تعریف نشده است. لطفاً ابتدا از منوی «کاتالوگ و کالاها» قطعه مورد نظر را ایجاد کنید.
                </p>
              )}
            </div>

            {/* Warehouse & Shelf */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  انبار مبدا خروج <span className="text-rose-400">*</span>
                </label>
                <select
                  id="stock-out-warehouse"
                  required
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-rose-500 text-xs"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  قفسه مبدا خروج <span className="text-rose-400">*</span>
                </label>
                <select
                  id="stock-out-shelf"
                  required
                  value={selectedShelfId}
                  onChange={(e) => setSelectedShelfId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-rose-500 text-xs"
                >
                  {shelves.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stock Level Live Indicator */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                availableStock === 0
                  ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <span className="font-semibold">موجودی فعلی در این قفسه:</span>
              </div>
              <div className="text-left font-black text-sm">
                <span className={availableStock === 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {formatNumber(availableStock)}
                </span>{' '}
                <span className="text-xs text-slate-400">
                  {selectedItem ? selectedItem.unit : 'عدد'}
                </span>
              </div>
            </div>

            {/* Quantity & Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  تعداد خروجی <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={availableStock > 0 ? availableStock : 1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={`حداکثر ${availableStock}`}
                  className={`w-full px-3 py-2.5 rounded-xl bg-slate-800 border text-slate-100 text-left font-mono text-xs font-bold focus:outline-none ${
                    isInsufficient
                      ? 'border-rose-500 ring-1 ring-rose-500'
                      : 'border-slate-700 focus:border-rose-500'
                  }`}
                />
                {isInsufficient && (
                  <p className="mt-1 text-rose-400 text-[11px] font-bold">
                    موجودی کافی نیست.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                    <span>شماره سند / حواله خروج</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      صدور خودکار سیستم
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    غیرقابل ویرایش دستی
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={nextDocNumber ? `سند شماره ${nextDocNumber}` : 'در حال تخصیص شماره سند...'}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-rose-400 font-mono text-xs font-bold cursor-not-allowed select-none pl-8"
                    title="شماره سند به صورت خودکار و متوالی توسط سیستم تخصیص داده می‌شود"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  توالی مشترک و خودکار از شماره ۱۰۰۱ برای کلیه اسناد ورود، خروج و جابه‌جایی
                </p>
              </div>
            </div>

            {/* Destination Unit & Notes */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                واحد متقاضی / محل نصب در کارخانه / نام تحویل‌گیرنده
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: تحویل به آقای مهندس رضایی جهت نصب در پست برق شماره ۳ نورد ۵۰۰"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-rose-500 text-xs"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isInsufficient || availableStock <= 0}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpFromLine className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'در حال صدور حواله...'
                    : isInsufficient
                    ? 'موجودی کافی نیست'
                    : 'صدور و ثبت قطعی حواله خروج'}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* Side Panel: Recent Outflows */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-200 mb-3 flex items-center gap-2">
              <ArrowUpFromLine className="w-4 h-4 text-rose-400" />
              <span>آخرین حواله‌های خروجی</span>
            </h3>

            {recentTransactions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">هنوز حواله‌ای ثبت نشده است.</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-slate-800/50 rounded-xl border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-100">{tx.itemName}</span>
                      <span className="text-rose-400 font-bold">
                        -{formatNumber(tx.quantity)} {tx.itemUnit}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      از: {tx.sourceWarehouseName} / {tx.sourceShelfName}
                    </div>
                    {tx.notes && (
                      <div className="text-[10px] text-slate-300 truncate bg-slate-800 px-2 py-0.5 rounded">
                        {tx.notes}
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                      <span>تحویل: {tx.userName}</span>
                      <span>{formatShamsiDate(tx.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-rose-950/20 border border-rose-800/30 rounded-xl text-[11px] text-rose-300">
            سیستم به طور خودکار از هرگونه موجودی منفی جلوگیری می‌کند و مانع از ثبت سند غیرمجاز می‌گردد.
          </div>
        </div>
      </div>
    </div>
  );
};
