import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';

const UPLOADS_DIR = process.env.UPLOADS_DIR_PATH || path.resolve(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('فرمت فایل مجاز نیست. فقط فایل‌های PDF و تصاویر پشتیبانی می‌شوند.'));
    }
  },
});

export function getFilePath(storageKey: string): string | null {
  const safeFilename = path.basename(storageKey);
  const fullPath = path.join(UPLOADS_DIR, safeFilename);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

export function deleteFile(storageKey: string): boolean {
  try {
    const safeFilename = path.basename(storageKey);
    const fullPath = path.join(UPLOADS_DIR, safeFilename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
  return false;
}
