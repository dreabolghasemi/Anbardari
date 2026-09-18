import { Router, Response } from 'express';
import { db } from '../db.js';
import {
  comparePassword,
  generateToken,
  requireAuth,
  AuthenticatedRequest,
  getClientIp,
} from '../auth.js';

const router = Router();

// ====================================================================
// مکانیزم محافظت در برابر حملات Brute-force در شبکه محلی (Login Rate Limiter)
// ====================================================================
interface LoginAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const loginAttempts = new Map<string, LoginAttemptRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 دقیقه
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 دقیقه قفل موقت

function checkRateLimit(key: string): { allowed: boolean; remainingMinutes?: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record) return { allowed: true };

  // بررسی قفل موقت
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingMs = record.lockedUntil - now;
    return {
      allowed: false,
      remainingMinutes: Math.ceil(remainingMs / 60000),
    };
  }

  // منقضی شدن پنجره تلاش‌های قبلی
  if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(key);
    return { allowed: true };
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return {
      allowed: false,
      remainingMinutes: Math.ceil(LOCKOUT_DURATION_MS / 60000),
    };
  }

  return { allowed: true };
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: now });
  } else {
    record.count += 1;
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
  }
}

function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
  const clientIp = getClientIp(req);
  const rateLimitKey = `${clientIp}`;

  try {
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `تعداد تلاش‌های ناموفق بیش از حد مجاز است. دسترسی به مدت ${rateCheck.remainingMinutes} دقیقه مسدود شد.`,
      });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است.' });
    }

    const trimmedUsername = username.trim();
    const user = await db.getUserByUsername(trimmedUsername);

    if (!user) {
      recordFailedAttempt(rateLimitKey);
      await db.logAudit({
        username: trimmedUsername,
        action: 'LOGIN_FAILED',
        entity: 'User',
        details: `تلاش ناموفق ورود با نام کاربری «${trimmedUsername}» (کاربر ناموجود)`,
        ipAddress: clientIp,
      });
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.',
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      recordFailedAttempt(rateLimitKey);
      await db.logAudit({
        userId: user.id,
        username: user.username,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        details: `تلاش ناموفق ورود با رمز عبور اشتباه برای کاربر «${user.username}»`,
        ipAddress: clientIp,
      });
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }

    // ورود موفقیت‌آمیز: ریست کردن نرخ تلاش‌های ناموفق
    clearLoginAttempts(rateLimitKey);
    await db.updateLastLogin(user.id);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      tokenVersion: user.tokenVersion || 1,
    });

    await db.logAudit({
      userId: user.id,
      username: user.username,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      details: `ورود موفق کاربر «${user.fullName}» (${user.username}) به سامانه`,
      ipAddress: clientIp,
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
    console.error('[Login Error]:', error.message);
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

    // به‌روزرسانی رمز در دیتابیس (token_version افزایش یافته و نشست‌های دیگر ابطال می‌شوند)
    await db.updateUser(user.id, { password: newPassword });

    await db.logAudit({
      userId: user.id,
      username: user.username,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: user.id,
      details: `تغییر رمز عبور توسط کاربر «${user.fullName}»`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: 'کلمه عبور با موفقیت تغییر یافت.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'خطا در تغییر کلمه عبور.' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // افزایش token_version کاربر جهت ابطال فوری توکن جاری
    await db.incrementTokenVersion(req.user!.userId);

    await db.logAudit({
      userId: req.user!.userId,
      username: req.user!.username,
      action: 'LOGOUT',
      entity: 'User',
      entityId: req.user!.userId,
      details: `خروج کاربر «${req.user!.fullName}» از سامانه`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, message: 'با موفقیت خارج شدید.' });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در خروج از سیستم.' });
  }
});

export default router;
