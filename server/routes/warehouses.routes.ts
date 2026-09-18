import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../auth.js';

const router = Router();

router.use(requireAuth);

// GET /api/warehouses
router.get('/', async (_req, res: Response) => {
  try {
    const warehouses = await db.getWarehouses();
    const shelves = await db.getShelves();

    // Attach shelves count
    const enriched = warehouses.map((wh) => ({
      ...wh,
      shelvesCount: shelves.filter((s) => s.warehouseId === wh.id).length,
    }));

    res.json({ warehouses: enriched });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت لیست انبارها.' });
  }
});

// POST /api/warehouses (ADMIN only)
router.post('/', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'نام انبار و کد انبار الزامی هستند.' });
    }

    const warehouse = await db.createWarehouse({ name, code, description });

    await db.logAudit({
      userId: req.user!.userId,
      action: 'CREATE_WAREHOUSE',
      entity: 'Warehouse',
      entityId: warehouse.id,
      details: `ایجاد انبار جدید «${warehouse.name}» با کد ${warehouse.code}`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.status(201).json({ warehouse });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ایجاد انبار.' });
  }
});

// PUT /api/warehouses/:id (ADMIN only)
router.put('/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;

    const warehouse = await db.updateWarehouse(id, { name, code, description, isActive });

    await db.logAudit({
      userId: req.user!.userId,
      action: 'EDIT_WAREHOUSE',
      entity: 'Warehouse',
      entityId: id,
      details: `ویرایش انبار «${warehouse.name}» (کد: ${warehouse.code})`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.json({ warehouse });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ویرایش انبار.' });
  }
});

// GET /api/warehouses/:id/shelves
router.get('/:id/shelves', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const shelves = await db.getShelves(id);
    res.json({ shelves });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت لیست قفسه‌ها.' });
  }
});

// GET /api/shelves
router.get('/all-shelves/list', async (req, res: Response) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    const shelves = await db.getShelves(warehouseId);
    const warehouses = await db.getWarehouses();

    const enriched = shelves.map((s) => {
      const wh = warehouses.find((w) => w.id === s.warehouseId);
      return {
        ...s,
        warehouseName: wh ? wh.name : 'نامشخص',
        warehouseCode: wh ? wh.code : '',
      };
    });

    res.json({ shelves: enriched });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت لیست قفسه‌ها.' });
  }
});

// POST /api/shelves (ADMIN only)
router.post('/shelves', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, warehouseId, description } = req.body;
    if (!name || !code || !warehouseId) {
      return res.status(400).json({ error: 'نام قفسه، کد قفسه و انبار الزامی هستند.' });
    }

    const shelf = await db.createShelf({ name, code, warehouseId, description });

    await db.logAudit({
      userId: req.user!.userId,
      action: 'CREATE_SHELF',
      entity: 'Shelf',
      entityId: shelf.id,
      details: `ایجاد قفسه جدید «${shelf.name}» (کد: ${shelf.code})`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.status(201).json({ shelf });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ایجاد قفسه.' });
  }
});

// PUT /api/shelves/:id (ADMIN only)
router.put('/shelves/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, warehouseId, description, status } = req.body;

    const shelf = await db.updateShelf(id, { name, code, warehouseId, description, status });

    await db.logAudit({
      userId: req.user!.userId,
      action: 'EDIT_SHELF',
      entity: 'Shelf',
      entityId: id,
      details: `ویرایش قفسه «${shelf.name}» (کد: ${shelf.code})`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.json({ shelf });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ویرایش قفسه.' });
  }
});

// DELETE /api/warehouses/:id (ADMIN only)
router.delete('/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const warehouse = await db.deleteWarehouse(id);

    await db.logAudit({
      userId: req.user!.userId,
      action: 'DELETE_WAREHOUSE',
      entity: 'Warehouse',
      entityId: id,
      details: `حذف انبار «${warehouse.name}» (کد: ${warehouse.code}) و قفسه‌های آن`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.json({ success: true, message: 'انبار با موفقیت حذف شد.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در حذف انبار.' });
  }
});

// DELETE /api/warehouses/shelves/:id (ADMIN only)
router.delete('/shelves/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const shelf = await db.deleteShelf(id);

    await db.logAudit({
      userId: req.user!.userId,
      action: 'DELETE_SHELF',
      entity: 'Shelf',
      entityId: id,
      details: `حذف قفسه «${shelf.name}» (کد: ${shelf.code})`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.json({ success: true, message: 'قفسه با موفقیت حذف شد.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در حذف قفسه.' });
  }
});

export default router;
