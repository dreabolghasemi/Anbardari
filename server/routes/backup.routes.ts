import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(['ADMIN']));

// GET /api/backup/export
router.get('/export', async (_req, res: Response) => {
  try {
    const backup = await db.exportBackup();
    const filename = `backup-warehouse-zobahan-${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در تهیه فایل پشتیبان.' });
  }
});

// POST /api/backup/restore
router.post('/restore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { backupData, confirmationCode } = req.body;

    if (confirmationCode !== 'CONFIRM_RESTORE') {
      return res.status(400).json({
        error: 'کد تایید امنیتی بازیابی نادرست است. عبارت CONFIRM_RESTORE را دقیق تایپ نمایید.',
      });
    }

    if (!backupData) {
      return res.status(400).json({ error: 'محتوای فایل پشتیبان ارسال نشده است.' });
    }

    await db.restoreBackup(backupData, req.user!.userId);

    res.json({
      success: true,
      message: 'پایگاه داده سامانه با موفقیت از روی فایل پشتیبان بازیابی گردید.',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در بازیابی پایگاه داده.' });
  }
});

// POST /api/backup/migrate-from-local (انتقال داده‌های محلی کلاینت/IndexedDB به سرور مرکزی)
router.post('/migrate-from-local', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { localData } = req.body;
    if (!localData) {
      return res.status(400).json({ error: 'داده‌های پایگاه محلی ارسال نشده است.' });
    }

    const result = await db.migrateFromLocal(localData, req.user!.userId);
    res.json({
      success: true,
      message: 'انتقال داده‌های پایگاه محلی به سرور مرکزی با موفقیت انجام شد.',
      ...result,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در انتقال داده‌ها به سرور.' });
  }
});

export default router;
