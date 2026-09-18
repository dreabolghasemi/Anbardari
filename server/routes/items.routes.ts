import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../auth.js';
import { upload, deleteFile } from '../storage.js';

const router = Router();

router.use(requireAuth);

// GET /api/items?search=...
router.get('/', async (req, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const items = await db.getItems(search);
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت کالاها.' });
  }
});

// GET /api/items/:id
router.get('/:id', async (req, res: Response) => {
  try {
    const item = await db.getItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'کالای مورد نظر یافت نشد.' });
    }
    res.json({ item });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت مشخصات کالا.' });
  }
});

// POST /api/items
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, category, brand, model, unit, description, imageUrl } = req.body;
    if (!name || !code || !category || !brand || !model) {
      return res.status(400).json({ error: 'نام، کد کالا، دسته‌بندی، برند و مدل الزامی هستند.' });
    }

    const item = await db.createItem({
      name,
      code,
      category,
      brand,
      model,
      unit,
      description,
      imageUrl,
    });

    await db.logAudit({
      userId: req.user!.userId,
      action: 'CREATE_ITEM',
      entity: 'Item',
      entityId: item.id,
      details: `ثبت کالای جدید «${item.name}» با کد فنی ${item.code}`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.status(201).json({ item });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ایجاد کالا.' });
  }
});

// PUT /api/items/:id
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await db.updateItem(req.params.id, req.body);

    await db.logAudit({
      userId: req.user!.userId,
      action: 'EDIT_ITEM',
      entity: 'Item',
      entityId: item.id,
      details: `ویرایش مشخصات کالای «${item.name}» (کد: ${item.code})`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.json({ item });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ویرایش کالا.' });
  }
});

// DELETE /api/items/:id (ADMIN only)
router.delete('/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const item = await db.deleteItem(id);

    await db.logAudit({
      userId: req.user!.userId,
      action: 'DELETE_ITEM',
      entity: 'Item',
      entityId: id,
      details: `حذف کالای «${item.name}» با کد فنی ${item.code}`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.json({ success: true, message: 'کالا با موفقیت حذف شد.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در حذف کالا.' });
  }
});

// POST /api/items/:id/upload-pdf (Upload PDF catalog datasheet)
router.post(
  '/:id/upload-pdf',
  upload.single('catalogPdf'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'هیچ فایلی ارسال نشده است.' });
      }

      const item = await db.getItemById(id);
      if (!item) {
        return res.status(404).json({ error: 'کالا یافت نشد.' });
      }

      const fileUrl = `/api/files/${file.filename}`;

      const attachment = await db.addAttachment({
        itemId: id,
        filename: file.filename,
        originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'), // handle utf-8 filename
        mimeType: file.mimetype,
        size: file.size,
        storageKey: file.filename,
        url: fileUrl,
        uploadedById: req.user!.userId,
      });

      await db.logAudit({
        userId: req.user!.userId,
        action: 'UPLOAD_PDF',
        entity: 'Item',
        entityId: id,
        details: `آپلود کاتالوگ PDF برای کالای «${item.name}»: ${attachment.originalName}`,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      });

      res.status(201).json({ attachment });
    } catch (error: any) {
      console.error('PDF upload error:', error);
      res.status(400).json({ error: error.message || 'خطا در آپلود کاتالوگ PDF.' });
    }
  }
);

// DELETE /api/items/:id/attachments/:attachmentId
router.delete(
  '/:id/attachments/:attachmentId',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { attachmentId } = req.params;
      const att = await db.getAttachmentById(attachmentId);
      if (!att) {
        return res.status(404).json({ error: 'فایل پیوست یافت نشد.' });
      }

      deleteFile(att.storageKey);
      await db.deleteAttachment(attachmentId);

      await db.logAudit({
        userId: req.user!.userId,
        action: 'DELETE_PDF',
        entity: 'Item',
        entityId: req.params.id,
        details: `حذف کاتالوگ پیوست ${att.originalName}`,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      });

      res.json({ success: true, message: 'فایل پیوست حذف شد.' });
    } catch (error: any) {
      res.status(500).json({ error: 'خطا در حذف فایل.' });
    }
  }
);

export default router;
