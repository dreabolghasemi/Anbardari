import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { TransactionType } from '../types.js';

const router = Router();

router.use(requireAuth);

// GET /api/stock/next-doc-number (پیش‌نمایش شماره سند بعدی)
router.get('/next-doc-number', async (_req, res: Response) => {
  try {
    const nextDocNumber = await db.peekNextDocNumber();
    res.json({ nextDocNumber: String(nextDocNumber || '1001') });
  } catch (error: any) {
    res.json({ nextDocNumber: '1001' });
  }
});

// POST /api/stock/in (ورود کالا)
router.post('/in', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemId, warehouseId, shelfId, quantity, referenceNo, notes } = req.body;

    if (!itemId || !warehouseId || !shelfId || quantity === undefined) {
      return res.status(400).json({ error: 'اطلاعات کالا، انبار، قفسه و تعداد ورودی الزامی هستند.' });
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      return res.status(400).json({ error: 'تعداد ورودی باید یک عدد صحیح مثبت بزرگتر از صفر باشد.' });
    }

    const result = await db.stockIn({
      itemId,
      warehouseId,
      shelfId,
      quantity: qtyNum,
      userId: req.user!.userId,
      referenceNo,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'ورود کالا با موفقیت در سیستم ثبت گردید.',
      ...result,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ثبت ورود کالا.' });
  }
});

// POST /api/stock/out (خروج کالا)
router.post('/out', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemId, warehouseId, shelfId, quantity, referenceNo, notes } = req.body;

    if (!itemId || !warehouseId || !shelfId || quantity === undefined) {
      return res.status(400).json({ error: 'اطلاعات کالا، انبار، قفسه و تعداد خروجی الزامی است.' });
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      return res.status(400).json({ error: 'تعداد خروجی باید یک عدد مثبت باشد.' });
    }

    const result = await db.stockOut({
      itemId,
      warehouseId,
      shelfId,
      quantity: qtyNum,
      userId: req.user!.userId,
      referenceNo,
      notes,
    });

    res.json({
      success: true,
      message: 'خروج کالا با موفقیت ثبت شد.',
      ...result,
    });
  } catch (error: any) {
    // If insufficient stock, error.message will be "موجودی کافی نیست."
    res.status(400).json({ error: error.message || 'خطا در ثبت خروج کالا.' });
  }
});

// POST /api/stock/transfer (انتقال کالا - ATOMIC)
router.post('/transfer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      itemId,
      sourceWarehouseId,
      sourceShelfId,
      destWarehouseId,
      destShelfId,
      quantity,
      referenceNo,
      notes,
    } = req.body;

    if (
      !itemId ||
      !sourceWarehouseId ||
      !sourceShelfId ||
      !destWarehouseId ||
      !destShelfId ||
      quantity === undefined
    ) {
      return res.status(400).json({ error: 'تمام اطلاعات مبدا، مقصد، کالا و تعداد الزامی هستند.' });
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      return res.status(400).json({ error: 'تعداد انتقال باید یک عدد مثبت باشد.' });
    }

    const result = await db.transferStock({
      itemId,
      sourceWarehouseId,
      sourceShelfId,
      destWarehouseId,
      destShelfId,
      quantity: qtyNum,
      userId: req.user!.userId,
      referenceNo,
      notes,
    });

    res.json({
      success: true,
      message: 'انتقال کالا با موفقیت به صورت یکپارچه (Atomic) انجام گردید.',
      ...result,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در انجام فرآیند انتقال کالا.' });
  }
});

// POST /api/stock/adjust (تراکنش اصلاحی برای اصلاح موجودی بدون حذف سابقه)
router.post('/adjust', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemId, warehouseId, shelfId, newTargetQuantity, reason } = req.body;

    if (!itemId || !warehouseId || !shelfId || newTargetQuantity === undefined || !reason) {
      return res.status(400).json({ error: 'اطلاعات کالا، انبار، قفسه، موجودی واقعی جدید و علت اصلاح الزامی است.' });
    }

    const targetQty = parseInt(newTargetQuantity, 10);
    if (isNaN(targetQty) || targetQty < 0) {
      return res.status(400).json({ error: 'موجودی جدید نمی‌تواند منفی باشد.' });
    }

    const result = await db.correctiveAdjustment({
      itemId,
      warehouseId,
      shelfId,
      newTargetQuantity: targetQty,
      userId: req.user!.userId,
      reason,
    });

    res.json({
      success: true,
      message: 'تراکنش اصلاحی موجودی با موفقیت در سیستم ثبت گردید.',
      ...result,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ثبت تراکنش اصلاحی.' });
  }
});

// GET /api/stock/transactions (تاریخچه تراکنش‌ها)
router.get('/transactions', async (req, res: Response) => {
  try {
    const { itemId, type, warehouseId, shelfId, userId, startDate, endDate, limit } = req.query;

    const transactions = await db.getTransactions({
      itemId: itemId as string,
      type: type as TransactionType,
      warehouseId: warehouseId as string,
      shelfId: shelfId as string,
      userId: userId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string, 10) : 200,
    });

    res.json({ transactions });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت تاریخچه تراکنش‌ها.' });
  }
});

export default router;
