import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.use(requireAuth);

// GET /api/inventory (detailed location-based list)
router.get('/', async (req, res: Response) => {
  try {
    const { warehouseId, shelfId, itemId } = req.query;
    const inventories = await db.getInventoryDetails({
      warehouseId: warehouseId as string,
      shelfId: shelfId as string,
      itemId: itemId as string,
    });
    res.json({ inventories });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت اطلاعات موجودی.' });
  }
});

// GET /api/inventory/dashboard
router.get('/dashboard', async (_req, res: Response) => {
  try {
    const metrics = await db.getDashboardMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت شاخص‌های داشبورد.' });
  }
});

export default router;
