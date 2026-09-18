import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../auth.js';

const router = Router();

// All user management routes require ADMIN role
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

// GET /api/users
router.get('/', async (_req, res: Response) => {
  try {
    const users = await db.getUsers();
    res.json({ users });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت لیست کاربران.' });
  }
});

// POST /api/users
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, fullName, password, role } = req.body;
    if (!username || !fullName || !password || !role) {
      return res.status(400).json({ error: 'تمام فیلدها (نام کاربری، نام و نام خانوادگی، رمز عبور، نقش) الزامی هستند.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
    }
    if (!['ADMIN', 'WAREHOUSE_USER'].includes(role)) {
      return res.status(400).json({ error: 'نقش کاربری نامعتبر است.' });
    }

    const newUser = await db.createUser({
      username,
      fullName,
      password,
      role,
    });

    await db.logAudit({
      userId: req.user!.userId,
      action: 'CREATE_USER',
      entity: 'User',
      entityId: newUser.id,
      details: `ایجاد کاربر جدید «${newUser.fullName}» با نام کاربری ${newUser.username} و نقش ${newUser.role}`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.status(201).json({ user: newUser });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ایجاد کاربر.' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, role, isActive, password } = req.body;

    const updatedUser = await db.updateUser(id, {
      fullName,
      role,
      isActive,
      password,
    });

    await db.logAudit({
      userId: req.user!.userId,
      action: 'EDIT_USER',
      entity: 'User',
      entityId: id,
      details: `ویرایش مشخصات یا وضعیت کاربر «${updatedUser.fullName}» (${updatedUser.username})`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.json({ user: updatedUser });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'خطا در ویرایش کاربر.' });
  }
});

export default router;
