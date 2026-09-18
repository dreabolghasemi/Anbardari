import { Router, Response } from 'express';
import * as XLSX from 'xlsx';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { TransactionType } from '../types.js';

const router = Router();

router.use(requireAuth);

// Helper to format ISO date to Jalali / Shamsi string
function formatShamsiDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

// GET /api/reports/data
router.get('/data', async (req, res: Response) => {
  try {
    const reportType = req.query.reportType as string;
    const { itemId, warehouseId, shelfId, userId, startDate, endDate } = req.query;

    if (reportType === 'INVENTORY') {
      const list = await db.getInventoryDetails({
        warehouseId: warehouseId as string,
        shelfId: shelfId as string,
        itemId: itemId as string,
      });
      return res.json({ data: list });
    }

    let txType: TransactionType | undefined;
    if (reportType === 'STOCK_IN') txType = 'STOCK_IN';
    if (reportType === 'STOCK_OUT') txType = 'STOCK_OUT';
    if (reportType === 'TRANSFER') txType = 'TRANSFER';

    const transactions = await db.getTransactions({
      type: txType,
      itemId: itemId as string,
      warehouseId: warehouseId as string,
      shelfId: shelfId as string,
      userId: userId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.json({ data: transactions });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در بارگذاری اطلاعات گزارش.' });
  }
});

// GET /api/reports/export-excel
router.get('/export-excel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reportType = (req.query.reportType as string) || 'INVENTORY';
    const { itemId, warehouseId, shelfId, userId, startDate, endDate } = req.query;

    let excelRows: any[] = [];
    let fileName = `گزارش_${reportType}_${Date.now()}.xlsx`;

    if (reportType === 'INVENTORY') {
      fileName = `گزارش_موجودی_کالاها_${Date.now()}.xlsx`;
      const invList = await db.getInventoryDetails({
        warehouseId: warehouseId as string,
        shelfId: shelfId as string,
        itemId: itemId as string,
      });

      excelRows = invList.map((row, idx) => ({
        'ردیف': idx + 1,
        'کد کالا': row.itemCode,
        'نام کالا': row.itemName,
        'برند': row.itemBrand,
        'مدل': row.itemModel,
        'دسته‌بندی': row.itemCategory,
        'انبار': row.warehouseName,
        'قفسه': row.shelfName,
        'موجودی': row.quantity,
        'واحد شمارش': row.itemUnit,
        'تاریخ آخرین به‌روزرسانی': formatShamsiDate(row.updatedAt),
      }));
    } else if (reportType === 'USER_ACTIVITY') {
      fileName = `گزارش_فعالیت_کاربران_${Date.now()}.xlsx`;
      const auditLogs = await db.getAuditLogs({
        userId: userId as string,
        limit: 1000,
      });

      excelRows = auditLogs.map((log, idx) => ({
        'ردیف': idx + 1,
        'کاربر': log.username,
        'نوع عملیات': log.action,
        'موجودیت': log.entity,
        'توضیحات': log.details || '-',
        'آدرس IP': log.ipAddress || '-',
        'تاریخ و زمان': formatShamsiDate(log.createdAt),
      }));
    } else {
      // Transactions (STOCK_IN, STOCK_OUT, TRANSFER, ITEM_HISTORY)
      let txType: TransactionType | undefined;
      if (reportType === 'STOCK_IN') txType = 'STOCK_IN';
      else if (reportType === 'STOCK_OUT') txType = 'STOCK_OUT';
      else if (reportType === 'TRANSFER') txType = 'TRANSFER';

      const txList = await db.getTransactions({
        type: txType,
        itemId: itemId as string,
        warehouseId: warehouseId as string,
        shelfId: shelfId as string,
        userId: userId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        limit: 5000,
      });

      fileName = `گزارش_تراکنش_${reportType}_${Date.now()}.xlsx`;

      excelRows = txList.map((tx, idx) => ({
        'ردیف': idx + 1,
        'شماره سند/عطف': tx.referenceNo || '-',
        'نوع تراکنش':
          tx.type === 'STOCK_IN'
            ? 'ورود کالا'
            : tx.type === 'STOCK_OUT'
            ? 'خروج کالا'
            : tx.type === 'TRANSFER'
            ? 'انتقال کالا'
            : 'اصلاح موجودی',
        'کد کالا': tx.itemCode,
        'نام کالا': tx.itemName,
        'برند': tx.itemBrand,
        'تعداد': tx.quantity,
        'واحد': tx.itemUnit,
        'انبار مبدا': tx.sourceWarehouseName || '-',
        'قفسه مبدا': tx.sourceShelfName || '-',
        'انبار مقصد': tx.destWarehouseName || '-',
        'قفسه مقصد': tx.destShelfName || '-',
        'ثبت‌کننده': tx.userName,
        'توضیحات': tx.notes || '-',
        'تاریخ و زمان': formatShamsiDate(tx.createdAt),
      }));
    }

    // Generate Excel worksheet and workbook
    const ws = XLSX.utils.json_to_sheet(excelRows);
    // RTL sheet view
    ws['!views'] = [{ rightToLeft: true }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'گزارش');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'خطا در صدور گزارش اکسل.' });
  }
});

export default router;
