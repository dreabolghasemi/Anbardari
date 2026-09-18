import { Router, Response } from 'express';
import { db } from '../db.js';
import { comparePassword, generateToken, requireAuth, hashPassword, AuthenticatedRequest } from '../auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است.' });
    }

    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }

    await db.updateLastLogin(user.id);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    });

    await db.logAudit({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      details: `ورود موفق کاربر «${user.fullName}» (${user.username}) به سامانه`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'خطای سرور در فرآیند ورود. مجدداً تلاش نمایید.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await db.getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد.' });
    }
    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در دریافت اطلاعات کاربر.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'کلمه عبور فعلی و جدید الزامی هستند.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'کلمه عبور جدید باید حداقل ۶ کاراکتر باشد.' });
    }

    const user = await db.getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'کاربر یافت نشد.' });
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'کلمه عبور فعلی نادرست است.' });
    }

    await db.updateUser(user.id, { password: newPassword });

    await db.logAudit({
      userId: user.id,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: user.id,
      details: `تغییر رمز عبور توسط کاربر «${user.fullName}»`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });

    res.json({ success: true, message: 'کلمه عبور با موفقیت تغییر یافت.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'خطا در تغییر کلمه عبور.' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.logAudit({
      userId: req.user!.userId,
      action: 'LOGOUT',
      entity: 'User',
      entityId: req.user!.userId,
      details: `خروج کاربر «${req.user!.fullName}» از سامانه`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });
    res.json({ success: true, message: 'با موفقیت خارج شدید.' });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در خروج از سیستم.' });
  }
});

export default router;
