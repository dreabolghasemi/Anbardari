import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AuthTokenPayload, Role } from './types.js';
import { db } from './db.js';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('[Security Error] JWT_SECRET environment variable is required.');
  }
  return secret.trim();
}

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

/**
 * استخراج IP واقعی کلاینت در شبکه محلی یا پشت Reverse Proxy معتبر
 */
export function getClientIp(req: Request): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const candidate = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
      if (candidate) return candidate.replace(/^::ffff:/, '');
    }
  }

  const rawIp = req.ip || req.socket?.remoteAddress || '';
  return rawIp.replace(/^::ffff:/, '') || '127.0.0.1';
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
  } catch {
    return null;
  }
}

/**
 * احراز اصالت کاربر در هر Request:
 * 1. توکن فقط و فقط از Authorization: Bearer خوانده می‌شود (پذیرش توکن از Query String حذف شد).
 * 2. اعتبارسنجی JWT با کلید اختصاصی سرور.
 * 3. بازیابی وضعیت لحظه‌ای کاربر از دیتابیس PostgreSQL (عدم اتکا صرف به دیتای داخل توکن).
 * 4. بررسی فعال بودن حساب کاربر (user.is_active = true).
 * 5. بررسی نسخه توکن (token_version) برای ابطال فوری نشست‌های منسوخ‌شده پس از تغییر رمز یا غیرفعال‌سازی حساب.
 * 6. تعیین Role کاربر بر اساس مقدار ذخیره‌شده در PostgreSQL.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // پذیرش توکن از query string یا cookie کاملاً ممنوع است
  if (!token) {
    return res.status(401).json({ error: 'لطفاً ابتدا وارد سیستم شوید.' });
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return res.status(401).json({ error: 'نشست کاربری شما نامعتبر یا منقضی شده است. مجدداً وارد شوید.' });
  }

  try {
    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'کاربر مورد نظر در سیستم یافت نشد.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.' });
    }

    const dbTokenVersion = user.tokenVersion ?? 1;
    const clientTokenVersion = decoded.tokenVersion ?? 1;

    if (clientTokenVersion !== dbTokenVersion) {
      return res.status(401).json({ error: 'نشست کاربری شما باطل شده است. لطفاً مجدداً وارد شوید.' });
    }

    // Role از دیتابیس دریافت و به ریکوئست الصاق می‌شود
    req.user = {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      tokenVersion: dbTokenVersion,
    };

    next();
  } catch (error: any) {
    console.error('[requireAuth Database Error]:', error.message);
    return res.status(503).json({ error: 'دیتابیس سرور در دسترس نیست' });
  }
}

/**
 * کنترل مجوز دسترسی بر اساس نقش کاربری (Server-Side Role-Based Access Control)
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'عدم دسترسی. لطفاً ابتدا وارد سیستم شوید.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'شما مجوز دسترسی به این بخش را ندارید.' });
    }
    next();
  };
}
