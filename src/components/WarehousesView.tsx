import React, { useState, useEffect } from 'react';
import { Warehouse as WarehouseIcon, Layers, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react';
import { api } from '../services/api.js';
import { Warehouse, Shelf } from '../types/index.js';
import { formatShamsiDate } from '../utils/persian.js';
import { useAuth } from '../context/AuthContext.js';

export const WarehousesView: React.FC = () => {
  const { isAdmin } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Warehouse Modal
  const [showWhModal, setShowWhModal] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [whName, setWhName] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whDescription, setWhDescription] = useState('');

  // Shelf Modal
  const [showShelfModal, setShowShelfModal] = useState(false);
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);
  const [shelfName, setShelfName] = useState('');
  const [shelfCode, setShelfCode] = useState('');
  const [shelfWarehouseId, setShelfWarehouseId] = useState('');
  const [shelfDescription, setShelfDescription] = useState('');

  // Deletion States
  const [whToDelete, setWhToDelete] = useState<Warehouse | null>(null);
  const [isDeletingWh, setIsDeletingWh] = useState(false);
  const [shelfToDelete, setShelfToDelete] = useState<Shelf | null>(null);
  const [isDeletingShelf, setIsDeletingShelf] = useState(false);

  const [formSubmitting, setFormSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [whRes, shRes] = await Promise.all([
        api.getWarehouses(),
        api.getShelves(),
      ]);
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
  }, []);

  const openCreateWh = () => {
    setEditingWh(null);
    setWhName('');
    setWhCode('');
    setWhDescription('');
    setShowWhModal(true);
  };

  const openEditWh = (wh: Warehouse) => {
    setEditingWh(wh);
    setWhName(wh.name);
    setWhCode(wh.code);
    setWhDescription(wh.description || '');
    setShowWhModal(true);
  };

  const handleSaveWh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whCode.trim()) return;
    setFormSubmitting(true);
    setError(null);
    try {
      if (editingWh) {
        await api.updateWarehouse(editingWh.id, {
          name: whName,
          code: whCode,
          description: whDescription,
        });
      } else {
        await api.createWarehouse({
          name: whName,
          code: whCode,
          description: whDescription,
        });
      }
      setShowWhModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteWh = async () => {
    if (!whToDelete) return;
    setIsDeletingWh(true);
    setError(null);
    try {
      await api.deleteWarehouse(whToDelete.id);
      setWhToDelete(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeletingWh(false);
    }
  };

  const openCreateShelf = (whId?: string) => {
    setEditingShelf(null);
    setShelfName('');
    setShelfCode('');
    setShelfWarehouseId(whId || (warehouses[0] ? warehouses[0].id : ''));
    setShelfDescription('');
    setShowShelfModal(true);
  };

  const openEditShelf = (shelf: Shelf) => {
    setEditingShelf(shelf);
    setShelfName(shelf.name);
    setShelfCode(shelf.code);
    setShelfWarehouseId(shelf.warehouseId);
    setShelfDescription(shelf.description || '');
    setShowShelfModal(true);
  };

  const handleSaveShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelfName.trim() || !shelfCode.trim() || !shelfWarehouseId) return;
    setFormSubmitting(true);
    setError(null);
    try {
      if (editingShelf) {
        await api.updateShelf(editingShelf.id, {
          name: shelfName,
          code: shelfCode,
          warehouseId: shelfWarehouseId,
          description: shelfDescription,
        });
      } else {
        await api.createShelf({
          name: shelfName,
          code: shelfCode,
          warehouseId: shelfWarehouseId,
          description: shelfDescription,
        });
      }
      setShowShelfModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteShelf = async () => {
    if (!shelfToDelete) return;
    setIsDeletingShelf(true);
    setError(null);
    try {
      await api.deleteShelf(shelfToDelete.id);
      setShelfToDelete(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeletingShelf(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Warehouses Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <WarehouseIcon className="w-5 h-5 text-amber-400" />
              <span>مدیریت انبارهای واحد اعلام حریق</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              تعریف انبارهای مرکزی، انبارهای پشتیبان کوره و خطوط نورد
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={openCreateWh}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف انبار جدید</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
            در حال بارگذاری اطلاعات انبارها...
          </div>
        ) : warehouses.length === 0 ? (
          <div className="bg-slate-900 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-amber-400 border border-slate-700">
              <WarehouseIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-200">هنوز هیچ انباری در سامانه تعریف نشده است</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              جهت آغاز فرآیند انبارداری، ابتدا با کلیک روی دکمه «تعریف انبار جدید» انبار یا سوله مورد نظر خود را ایجاد نمایید.
            </p>
            {isAdmin && (
              <button
                onClick={openCreateWh}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition mt-2 shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>تعریف اولین انبار</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warehouses.map((wh) => (
              <div
                key={wh.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700 font-bold">
                        {wh.code}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        فعال
                      </span>
                    </div>
                    <h3 className="font-black text-base text-white mt-2">{wh.name}</h3>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditWh(wh)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                        title="ویرایش مشخصات انبار"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setWhToDelete(wh)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                        title="حذف انبار"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {wh.description && (
                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    {wh.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                  <span className="text-slate-400">
                    قفسه‌های تعریف‌شده: <b className="text-slate-100">{wh.shelvesCount || 0}</b> قفسه
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => openCreateShelf(wh.id)}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 text-[11px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن قفسه به این انبار</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shelves Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              <span>مدیریت قفسه‌ها و جایگاه‌های فیزیکی انبار</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              تفکیک قفسه‌ها بر اساس استاندارد اعلام حریق و تخصیص قطعات
            </p>
          </div>

          {isAdmin && warehouses.length > 0 && (
            <button
              onClick={() => openCreateShelf()}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow-lg shadow-sky-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف قفسه جدید</span>
            </button>
          )}
        </div>

        {shelves.length === 0 ? (
          <div className="bg-slate-900 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-sky-400 border border-slate-700">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-200">هنوز هیچ قفسه‌ای تعریف نشده است</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {warehouses.length === 0
                ? 'ابتدا یک انبار ایجاد کنید و سپس قفسه‌های مربوط به آن را تعریف نمایید.'
                : 'برای مشخص نمودن جایگاه نگهداری قطعات و سنسورها، روی «تعریف قفسه جدید» کلیک فرمایید.'}
            </p>
            {isAdmin && warehouses.length > 0 && (
              <button
                onClick={() => openCreateShelf()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition mt-2 shadow-lg shadow-sky-900/30"
              >
                <Plus className="w-4 h-4" />
                <span>تعریف اولین قفسه</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-300">
                <thead className="bg-slate-800/70 text-slate-400 text-[11px] font-bold">
                  <tr>
                    <th className="p-3">ردیف</th>
                    <th className="p-3">کد قفسه</th>
                    <th className="p-3">نام قفسه</th>
                    <th className="p-3">انبار مربوطه</th>
                    <th className="p-3">توضیحات و ردیف</th>
                    <th className="p-3">وضعیت</th>
                    <th className="p-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {shelves.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {s.code}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-100">{s.name}</td>
                      <td className="p-3 text-slate-300">{s.warehouseName}</td>
                      <td className="p-3 text-slate-400">{s.description || '-'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {s.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="p-3">
                        {isAdmin && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditShelf(s)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                              title="ویرایش قفسه"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setShelfToDelete(s)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              title="حذف قفسه"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Warehouse Modal */}
      {showWhModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative text-xs">
            <button
              onClick={() => setShowWhModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-base text-white mb-4">
              {editingWh ? 'ویرایش مشخصات انبار' : 'تعریف انبار جدید'}
            </h3>

            <form onSubmit={handleSaveWh} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  نام کامل انبار <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="مثال: انبار شماره ۱ اعلام حریق"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  کد یکتا انبار <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={whCode}
                  onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                  placeholder="مثال: WH-01"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">توضیحات و آدرس فیزیکی</label>
                <textarea
                  rows={2}
                  value={whDescription}
                  onChange={(e) => setWhDescription(e.target.value)}
                  placeholder="محل استقرار در کارخانه، سرپرست انبار و..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWhModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold"
                >
                  {formSubmitting ? 'در حال ثبت...' : 'ذخیره انبار'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shelf Modal */}
      {showShelfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative text-xs">
            <button
              onClick={() => setShowShelfModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-base text-white mb-4">
              {editingShelf ? 'ویرایش مشخصات قفسه' : 'تعریف قفسه جدید'}
            </h3>

            {warehouses.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-3">
                <p>ابتدا باید حداقل یک انبار ثبت کنید تا بتوانید برای آن قفسه تعریف نمایید.</p>
                <button
                  onClick={() => {
                    setShowShelfModal(false);
                    openCreateWh();
                  }}
                  className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                >
                  تعریف انبار
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveShelf} className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    انبار مربوطه <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={shelfWarehouseId}
                    onChange={(e) => setShelfWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
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
                    نام قفسه <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shelfName}
                    onChange={(e) => setShelfName(e.target.value)}
                    placeholder="مثال: قفسه ۱ (دتکتورها)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    کد فنی قفسه <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shelfCode}
                    onChange={(e) => setShelfCode(e.target.value.toUpperCase())}
                    placeholder="مثال: SH-01-A"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">توضیحات قفسه</label>
                  <textarea
                    rows={2}
                    value={shelfDescription}
                    onChange={(e) => setShelfDescription(e.target.value)}
                    placeholder="ردیف قطعات حساس، طبقه ۲..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowShelfModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold"
                  >
                    {formSubmitting ? 'در حال ثبت...' : 'ذخیره قفسه'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Warehouse Confirmation Modal */}
      {whToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative text-xs space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">تایید حذف انبار</h3>
                <p className="text-slate-400 text-[11px]">این عملیات قابل بازگشت نخواهد بود.</p>
              </div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 space-y-1">
              <p className="font-semibold text-slate-200">
                آیا از حذف انبار «{whToDelete.name}» با کد «{whToDelete.code}» اطمینان دارید؟
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                توجه: در صورتی که این انبار دارای موجودی کالای فعال باشد، سامانه از حذف آن جلوگیری خواهد کرد.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWhToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteWh}
                disabled={isDeletingWh}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition"
              >
                {isDeletingWh ? 'در حال حذف...' : 'بله، انبار حذف شود'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shelf Confirmation Modal */}
      {shelfToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative text-xs space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">تایید حذف قفسه</h3>
                <p className="text-slate-400 text-[11px]">این عملیات قابل بازگشت نخواهد بود.</p>
              </div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 space-y-1">
              <p className="font-semibold text-slate-200">
                آیا از حذف قفسه «{shelfToDelete.name}» با کد «{shelfToDelete.code}» اطمینان دارید؟
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                توجه: قفسه‌هایی که در حال حاضر دارای قطعات و موجودی فعال باشند، قابل حذف نیستند.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShelfToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteShelf}
                disabled={isDeletingShelf}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition"
              >
                {isDeletingShelf ? 'در حال حذف...' : 'بله، قفسه حذف شود'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
