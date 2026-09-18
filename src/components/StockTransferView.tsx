import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, CheckCircle2, AlertCircle, Package, Lock } from 'lucide-react';
import { api } from '../services/api.js';
import { Item, Warehouse, Shelf, StockTransaction, InventoryItem } from '../types/index.js';
import { formatNumber, formatShamsiDate } from '../utils/persian.js';

export const StockTransferView: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sourceShelves, setSourceShelves] = useState<Shelf[]>([]);
  const [destShelves, setDestShelves] = useState<Shelf[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<StockTransaction[]>([]);
  const [nextDocNumber, setNextDocNumber] = useState<string>('1001');

  // Form
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>('');
  const [sourceShelfId, setSourceShelfId] = useState<string>('');
  const [destWarehouseId, setDestWarehouseId] = useState<string>('');
  const [destShelfId, setDestShelfId] = useState<string>('');
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
        api.getTransactions({ type: 'TRANSFER', limit: 5 }),
        api.getNextDocNumber().catch(() => '1001'),
      ]);
      setItems(itRes.items);
      setWarehouses(whRes.warehouses);
      setInventories(invRes.inventories);
      setRecentTransactions(txRes.transactions);
      if (nextDoc) setNextDocNumber(nextDoc);

      if (whRes.warehouses.length > 0) {
        setSourceWarehouseId(whRes.warehouses[0].id);
        setDestWarehouseId(whRes.warehouses[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  // Load shelves for source warehouse
  useEffect(() => {
    if (sourceWarehouseId) {
      api.getShelves(sourceWarehouseId).then((res) => {
        setSourceShelves(res.shelves);
        if (res.shelves.length > 0) {
          setSourceShelfId(res.shelves[0].id);
        } else {
          setSourceShelfId('');
        }
      });
    }
  }, [sourceWarehouseId]);

  // Load shelves for destination warehouse
  useEffect(() => {
    if (destWarehouseId) {
      api.getShelves(destWarehouseId).then((res) => {
        setDestShelves(res.shelves);
        if (res.shelves.length > 0) {
          // If in same warehouse, default to a different shelf if possible
          const diff = res.shelves.find((s) => s.id !== sourceShelfId);
          setDestShelfId(diff ? diff.id : res.shelves[0].id);
        } else {
          setDestShelfId('');
        }
      });
    }
  }, [destWarehouseId, sourceShelfId]);

  // Calculate available stock at source
  const currentInv = inventories.find(
    (inv) =>
      inv.itemId === selectedItemId &&
      inv.warehouseId === sourceWarehouseId &&
      inv.shelfId === sourceShelfId
  );
  const availableStock = currentInv ? currentInv.quantity : 0;

  const enteredQty = parseInt(quantity, 10) || 0;
  const isInsufficient = enteredQty > availableStock;
  const isSameLocation =
    sourceWarehouseId === destWarehouseId && sourceShelfId === destShelfId && sourceShelfId !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItemId || !sourceWarehouseId || !sourceShelfId || !destWarehouseId || !destShelfId || !quantity) {
      setError('لطفاً همه فیلدهای کالا، مبدا، مقصد و تعداد را کامل کنید.');
      return;
    }

    if (isSameLocation) {
      setError('مبدا و مقصد انتقال نمی‌تواند دقیقاً یکسان باشد.');
      return;
    }

    if (enteredQty <= 0) {
      setError('تعداد انتقال باید یک عدد مثبت باشد.');
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
      const res = await api.transferStock({
        itemId: selectedItemId,
        sourceWarehouseId,
        sourceShelfId,
        destWarehouseId,
        destShelfId,
        quantity: enteredQty,
        notes,
      });

      const assignedDoc = res.transaction?.referenceNo || nextDocNumber;
      setSuccessMsg(
        `انتقال یکپارچه با سند شماره ${assignedDoc} با موفقیت ثبت شد. باقیمانده مبدا: ${formatNumber(res.sourceRemaining)} | موجودی جدید مقصد: ${formatNumber(res.destNewQuantity)}`
      );
      setQuantity('');
      setNotes('');

      // Refresh inventories, transactions and advance next doc number
      const [invRes, txRes, nextDoc] = await Promise.all([
        api.getInventory(),
        api.getTransactions({ type: 'TRANSFER', limit: 5 }),
        api.getNextDocNumber().catch(() => ''),
      ]);
      setInventories(invRes.inventories);
      setRecentTransactions(txRes.transactions);
      if (nextDoc) setNextDocNumber(nextDoc);
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت انتقال کالا.');
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
          <ArrowLeftRight className="w-5 h-5 text-sky-400" />
          <span>انتقال کالا بین انبارها و قفسه‌ها (Stock Transfer)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          جابه‌جایی کالا بین قفسه‌های یک انبار یا بین دو انبار مجزا به صورت کاملاً یکپارچه و اتمیک (Atomic)
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
                انتخاب کالا جهت انتقال <span className="text-rose-400">*</span>
              </label>
              <select
                id="transfer-item"
                required
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500 text-xs"
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

            {/* Source Warehouse & Shelf */}
            <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-3">
              <span className="font-bold text-slate-300 block text-xs">
                موقعیت مبدا (کسر موجودی از اینجا):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">انبار مبدا</label>
                  <select
                    value={sourceWarehouseId}
                    onChange={(e) => setSourceWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">قفسه مبدا</label>
                  <select
                    value={sourceShelfId}
                    onChange={(e) => setSourceShelfId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    {sourceShelves.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Source Live Stock Badge */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                <span className="text-slate-400">موجودی فعلی در این موقعیت مبدا:</span>
                <span className="font-bold text-sky-400">
                  {formatNumber(availableStock)} {selectedItem ? selectedItem.unit : 'عدد'}
                </span>
              </div>
            </div>

            {/* Destination Warehouse & Shelf */}
            <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-3">
              <span className="font-bold text-slate-300 block text-xs">
                موقعیت مقصد (افزایش موجودی در اینجا):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">انبار مقصد</label>
                  <select
                    value={destWarehouseId}
                    onChange={(e) => setDestWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">قفسه مقصد</label>
                  <select
                    value={destShelfId}
                    onChange={(e) => setDestShelfId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    {destShelves.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {isSameLocation && (
              <p className="text-rose-400 text-xs font-semibold">
                خطا: انبار و قفسه مبدا و مقصد نباید کاملاً یکسان باشند.
              </p>
            )}

            {/* Quantity & Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  تعداد انتقال <span className="text-rose-400">*</span>
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
                      : 'border-slate-700 focus:border-sky-500'
                  }`}
                />
                {isInsufficient && (
                  <p className="mt-1 text-rose-400 text-[11px] font-bold">موجودی کافی نیست.</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                    <span>شماره سند / حواله انتقال</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30">
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
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-sky-400 font-mono text-xs font-bold cursor-not-allowed select-none pl-8"
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

            {/* Notes */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">علت و توضیحات انتقال</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="توضیح دلایل بهینه‌سازی چیدمان، انتقال به انبار کوره یا پشتیبان..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500 text-xs"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isInsufficient || isSameLocation || availableStock <= 0}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow-lg shadow-sky-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'در حال انجام انتقال اتمیک...'
                    : isInsufficient
                    ? 'موجودی کافی نیست'
                    : 'ثبت قطعی انتقال بین قفسه‌ها'}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* Side Panel: Recent Transfers */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-200 mb-3 flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-sky-400" />
              <span>آخرین انتقالات انبار</span>
            </h3>

            {recentTransactions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">انتقالی ثبت نشده است.</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-slate-800/50 rounded-xl border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-100">{tx.itemName}</span>
                      <span className="text-sky-400 font-bold">
                        {formatNumber(tx.quantity)} {tx.itemUnit}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {tx.sourceShelfName} &rarr; {tx.destShelfName}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                      <span>کاربر: {tx.userName}</span>
                      <span>{formatShamsiDate(tx.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-sky-950/20 border border-sky-800/30 rounded-xl text-[11px] text-sky-300">
            عملیات انتقال به صورت یکپارچه (Atomic) انجام می‌پذیرد تا هرگز هیچ مغایرتی در موجودی ایجاد نشود.
          </div>
        </div>
      </div>
    </div>
  );
};
