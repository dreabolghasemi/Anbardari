import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Upload,
  Trash2,
  ExternalLink,
  Download,
  Eye,
  Layers,
  History,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatNumber, formatShamsiDate, getTransactionTypeBadge } from '../utils/persian.js';
import { useAuth } from '../context/AuthContext.js';

interface ItemDetailModalProps {
  itemId: string;
  onClose: () => void;
  onItemUpdated?: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  itemId,
  onClose,
  onItemUpdated,
}) => {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [attToDelete, setAttToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingAtt, setIsDeletingAtt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItem = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getItemById(itemId);
      setData(res.item);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      setError('فقط فایل‌های PDF کاتالوگ یا تصاویر دیتاشیت مجاز هستند.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadSuccess(null);

    try {
      await api.uploadItemPdf(itemId, file);
      setUploadSuccess('کاتالوگ PDF با موفقیت آپلود شد.');
      await loadItem();
      if (onItemUpdated) onItemUpdated();
    } catch (err: any) {
      setError(err.message || 'خطا در آپلود کاتالوگ.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDeleteAttachment = async () => {
    if (!attToDelete) return;
    setIsDeletingAtt(true);
    setError(null);
    try {
      await api.deleteItemAttachment(itemId, attToDelete.id);
      setAttToDelete(null);
      setUploadSuccess('کاتالوگ یا پیوست با موفقیت حذف شد.');
      await loadItem();
      if (onItemUpdated) onItemUpdated();
    } catch (err: any) {
      setError(err.message || 'خطا در حذف فایل.');
    } finally {
      setIsDeletingAtt(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl relative text-slate-100 my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">
                {data ? data.name : 'مشخصات و کاتالوگ فنی کالا'}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {data ? `کد کالا: ${data.code}` : 'بارگذاری...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {isLoading ? (
            <div className="p-12 text-center text-slate-400">در حال دریافت مشخصات...</div>
          ) : data ? (
            <>
              {/* Technical Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-400 block">دسته‌بندی:</span>
                  <span className="font-semibold text-slate-200">{data.category}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">برند سازنده:</span>
                  <span className="font-semibold text-slate-200">{data.brand}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">مدل دستگاه:</span>
                  <span className="font-semibold text-slate-200">{data.model}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">موجودی کل انبارها:</span>
                  <span className="font-black text-emerald-400 text-base">
                    {formatNumber(data.totalStock || 0)} {data.unit}
                  </span>
                </div>
              </div>

              {data.description && (
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                  <span className="font-semibold text-slate-400 block mb-1">توضیحات و کاربرد فنی:</span>
                  <p className="leading-relaxed">{data.description}</p>
                </div>
              )}

              {/* Location Breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <h4 className="font-bold text-xs sm:text-sm text-slate-200">
                    تفکیک موجودی در انبارها و قفسه‌ها
                  </h4>
                </div>
                {data.inventories.length === 0 ? (
                  <div className="p-4 bg-slate-800/40 rounded-xl text-center text-xs text-slate-400 border border-slate-800">
                    موجودی فعلی این کالا صفر است.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-800/70 text-slate-400 text-[11px]">
                        <tr>
                          <th className="p-2.5">نام انبار</th>
                          <th className="p-2.5">قفسه</th>
                          <th className="p-2.5">تعداد در این قفسه</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {data.inventories.map((inv: any) => (
                          <tr key={inv.id} className="hover:bg-slate-800/40">
                            <td className="p-2.5 text-slate-300 font-medium">
                              {inv.warehouseName}
                            </td>
                            <td className="p-2.5 text-slate-300 font-mono">
                              {inv.shelfName} ({inv.shelfCode})
                            </td>
                            <td className="p-2.5 font-bold text-emerald-400">
                              {formatNumber(inv.quantity)} {data.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* PDF Catalogs / Datasheets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <h4 className="font-bold text-xs sm:text-sm text-slate-200">
                      کاتالوگ‌ها و دیتاشیت‌های فنی (PDF)
                    </h4>
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="application/pdf,image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-semibold transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploading ? 'در حال آپلود...' : 'آپلود کاتالوگ PDF'}</span>
                    </button>
                  </div>
                </div>

                {data.attachments && data.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {data.attachments.map((att: any) => (
                      <div
                        key={att.id}
                        className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <FileText className="w-5 h-5 text-rose-400 shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-200 block truncate">
                              {att.originalName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {(att.size / 1024).toFixed(1)} کیلوبایت • {formatShamsiDate(att.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs flex items-center gap-1.5 border border-sky-500/30 transition"
                            title="مشاهده و باز کردن در تب جدید"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>مشاهده</span>
                          </a>

                          <a
                            href={att.url}
                            download={att.originalName || 'catalog.pdf'}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs flex items-center gap-1.5 border border-amber-500/30 transition font-semibold"
                            title="دانلود فایل کاتالوگ PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>دانلود</span>
                          </a>

                          <button
                            onClick={() => setAttToDelete({ id: att.id, name: att.originalName })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="حذف فایل کاتالوگ (در صورت بارگذاری اشتباه)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-800/30 rounded-xl text-center text-xs text-slate-400 border border-slate-800">
                    هنوز کاتالوگ PDF برای این قطعه آپلود نشده است.
                  </div>
                )}
              </div>

              {/* Transaction History for this Item */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-4 h-4 text-purple-400" />
                  <h4 className="font-bold text-xs sm:text-sm text-slate-200">
                    تاریخچه تراکنش‌های این کالا
                  </h4>
                </div>
                {data.transactions && data.transactions.length > 0 ? (
                  <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-800/70 text-slate-400 text-[11px] sticky top-0">
                        <tr>
                          <th className="p-2">عملیات</th>
                          <th className="p-2">تعداد</th>
                          <th className="p-2">مبدا / مقصد</th>
                          <th className="p-2">تاریخ</th>
                          <th className="p-2">سند</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {data.transactions.map((tx: any) => {
                          const badge = getTransactionTypeBadge(tx.type);
                          return (
                            <tr key={tx.id} className="hover:bg-slate-800/40">
                              <td className="p-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] border ${badge.color}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="p-2 font-bold text-slate-100">
                                {formatNumber(tx.quantity)}
                              </td>
                              <td className="p-2 text-[11px] text-slate-400">
                                {tx.type === 'STOCK_IN' && `${tx.destWarehouseName} / ${tx.destShelfName}`}
                                {tx.type === 'STOCK_OUT' && `${tx.sourceWarehouseName} / ${tx.sourceShelfName}`}
                                {tx.type === 'TRANSFER' && `${tx.sourceShelfName} ➔ ${tx.destShelfName}`}
                                {tx.type === 'ADJUSTMENT' && 'اصلاح موجودی'}
                              </td>
                              <td className="p-2 text-slate-400 whitespace-nowrap">
                                {formatShamsiDate(tx.createdAt)}
                              </td>
                              <td className="p-2 font-mono text-slate-400">
                                {tx.referenceNo || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-800/30 rounded-xl text-center text-xs text-slate-400 border border-slate-800">
                    تراکنشی برای این کالا ثبت نشده است.
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
          >
            بستن پنجره
          </button>
        </div>
      </div>

      {/* Confirmation Modal for deleting Catalog PDF */}
      {attToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-sm w-full p-5 text-slate-100 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">حذف فایل کاتالوگ / پیوست</h4>
                <p className="text-[11px] text-slate-400">حذف در صورت بارگذاری اشتباه</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1.5">
              <p className="text-slate-300">
                آیا می‌خواهید فایل زیر را حذف نمایید؟
              </p>
              <p className="font-semibold text-rose-300 truncate" title={attToDelete.name}>
                {attToDelete.name}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAttToDelete(null)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={confirmDeleteAttachment}
                disabled={isDeletingAtt}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition disabled:opacity-50"
              >
                {isDeletingAtt ? 'در حال حذف...' : 'بله، حذف شود'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
