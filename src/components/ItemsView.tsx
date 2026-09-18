import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  FileText,
  Edit2,
  Trash2,
  ExternalLink,
  Layers,
  AlertCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Item } from '../types/index.js';
import { formatNumber } from '../utils/persian.js';
import { useAuth } from '../context/AuthContext.js';

interface ItemsViewProps {
  onSelectItem: (itemId: string) => void;
}

export const ItemsView: React.FC<ItemsViewProps> = ({ onSelectItem }) => {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal for Create/Edit
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState('دتکتورها');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formUnit, setFormUnit] = useState('عدد');
  const [formDescription, setFormDescription] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal for Delete
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const loadItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getItems();
      setItems(res.items);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const categories = ['ALL', ...Array.from(new Set(items.map((i) => i.category)))];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCode('');
    setFormCategory('دتکتورها');
    setFormBrand('');
    setFormModel('');
    setFormUnit('عدد');
    setFormDescription('');
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCode(item.code);
    setFormCategory(item.category);
    setFormBrand(item.brand);
    setFormModel(item.model);
    setFormUnit(item.unit);
    setFormDescription(item.description || '');
    setFormError(null);
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim() || !formBrand.trim() || !formModel.trim()) {
      setFormError('نام کالا، کد فنی، برند و مدل الزامی هستند.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      if (editingItem) {
        await api.updateItem(editingItem.id, {
          name: formName,
          code: formCode,
          category: formCategory,
          brand: formBrand,
          model: formModel,
          unit: formUnit,
          description: formDescription,
        });
      } else {
        await api.createItem({
          name: formName,
          code: formCode,
          category: formCategory,
          brand: formBrand,
          model: formModel,
          unit: formUnit,
          description: formDescription,
        });
      }
      setShowFormModal(false);
      await loadItems();
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت کالا.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeletingItem(true);
    setError(null);
    try {
      await api.deleteItem(itemToDelete.id);
      setItemToDelete(null);
      await loadItems();
    } catch (err: any) {
      setError(err.message || 'خطا در حذف کالا.');
    } finally {
      setIsDeletingItem(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <span>کاتالوگ و مشخصات تجهیزات اعلام حریق</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت کدهای فنی، برند، مدل، کاتالوگ PDF و بررسی موجودی در قفسه‌ها
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>تعریف کالای جدید</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی نام کالا، کد قطعه، برند سازنده یا مدل..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'همه دسته‌بندی‌ها' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Items Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400 text-xs">
          در حال بارگذاری کاتالوگ کالاها...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-amber-400 mb-1">
            <Package className="w-6 h-6" />
          </div>
          {items.length === 0 ? (
            <>
              <h3 className="font-bold text-sm text-white">انبار خالی است (هیچ کالایی تعریف نشده است)</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                کالاهای پیش‌فرض حذف شده‌اند. می‌توانید با کلیک روی دکمه زیر، مشخصات قطعات و تجهیزات اعلام حریق جدید را به عنوان مدیر سیستم ثبت نمایید.
              </p>
              <button
                onClick={openCreateModal}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>تعریف اولین کالا</span>
              </button>
            </>
          ) : (
            <>
              <h3 className="font-bold text-sm text-white">هیچ کالایی مطابق با فیلتر یافت نشد</h3>
              <p className="text-xs text-slate-400">عبارت جستجو یا دسته‌بندی انتخابی را تغییر دهید.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                    {item.code}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {item.category}
                  </span>
                </div>

                <h3 className="font-bold text-sm sm:text-base text-white mb-2 leading-snug">
                  {item.name}
                </h3>

                <div className="space-y-1 text-xs text-slate-400 mb-4">
                  <div className="flex justify-between">
                    <span>برند سازنده:</span>
                    <span className="text-slate-200 font-semibold">{item.brand}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>مدل دستگاه:</span>
                    <span className="text-slate-200 font-semibold">{item.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>واحد سنجش:</span>
                    <span className="text-slate-300">{item.unit}</span>
                  </div>
                </div>

                {item.description && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-4 bg-slate-800/40 p-2 rounded-lg">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400">موجودی کل انبارها:</span>
                  <span className="text-sm font-black text-emerald-400">
                    {formatNumber(item.totalStock || 0)} {item.unit}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectItem(item.id)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>دیتاشیت و کاتالوگ PDF</span>
                    {item.attachments && item.attachments.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" title="دارای کاتالوگ PDF" />
                    )}
                  </button>

                  <button
                    onClick={() => openEditModal(item)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                    title="ویرایش مشخصات کالا"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setItemToDelete(item)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                    title="حذف کالا"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Creating/Editing Item */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative">
            <button
              onClick={() => setShowFormModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-base text-white mb-4">
              {editingItem ? 'ویرایش اطلاعات کالا' : 'تعریف کالای جدید در سیستم'}
            </h3>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  نام کامل کالا / تجهیز <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: دتکتور دود اپتیکال آدرس‌پذیر"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    کد فنی انبارداری <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="FA-DET-001"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">دسته‌بندی</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="دتکتورها، شستی‌ها، ماژول‌ها..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    برند سازنده <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="Apollo / Hochiki..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    مدل دستگاه <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="XP95 / DCD-1E..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">واحد سنجش</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="عدد">عدد</option>
                    <option value="دستگاه">دستگاه</option>
                    <option value="بسته">بسته</option>
                    <option value="متر">متر</option>
                    <option value="رول">رول</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">توضیحات و مشخصات کاربردی</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="ملاحظات نصب، محیط کاری در ذوب‌آهن، شماره استاندارد و..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {formSubmitting ? 'در حال ذخیره...' : editingItem ? 'به‌روزرسانی کالا' : 'ثبت کالا'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative text-xs space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">تایید حذف کالا</h3>
                <p className="text-slate-400 text-[11px]">این عملیات غیرقابل بازگشت است.</p>
              </div>
            </div>

            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-2">
              <p className="font-semibold text-slate-200">
                آیا از حذف کالای «{itemToDelete.name}» با کد فنی «{itemToDelete.code}» اطمینان دارید؟
              </p>
              {itemToDelete.totalStock > 0 ? (
                <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    توجه: این کالا دارای {formatNumber(itemToDelete.totalStock)} {itemToDelete.unit || 'عدد'} موجودی فعال در انبار است. برای جلوگیری از مغایرت انبارداری، ابتدا باید با حواله خروج یا تعدیل، موجودی آن صفر شود.
                  </span>
                </div>
              ) : (
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  موجودی این کالا صفر است. با تایید حذف، تمام اطلاعات و کاتالوگ‌های مرتبط با آن از سامانه پاک خواهند شد.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={isDeletingItem || itemToDelete.totalStock > 0}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeletingItem ? 'در حال حذف...' : 'بله، کالا حذف شود'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
