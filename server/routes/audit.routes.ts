import { Router, Response } from 'express';
import * as XLSX from 'xlsx';
import { db } from '../db.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['ADMIN']));

function formatShamsiDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

// GET /api/audit-logs
router.get('/', async (req, res: Response) => {
  try {
    const { action, entity, userId, limit } = req.query;
    const logs = await db.getAuditLogs({
      action: action as string,
      entity: entity as string,
      userId: userId as string,
      limit: limit ? parseInt(limit as string, 10) : 500,
    });
    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت وقایع امنیتی و ممیزی.' });
  }
});

// GET /api/audit-logs/export-excel
router.get('/export-excel', async (_req, res: Response) => {
  try {
    const logs = await db.getAuditLogs({ limit: 5000 });
    const rows = logs.map((log, idx) => ({
      'ردیف': idx + 1,
      'کاربر': log.username,
      'عملیات': log.action,
      'موجودیت': log.entity,
      'شناسه رکورد': log.entityId || '-',
      'شرح واقعه': log.details || '-',
      'آدرس IP': log.ipAddress || '-',
      'زمان ثبت': formatShamsiDate(log.createdAt),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ rightToLeft: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ممیزی وقایع');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `ممیزی_وقایع_سامانه_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در صدور فایل اکسل وقایع ممیزی.' });
  }
});

export default router;
