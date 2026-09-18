-- Migration 002: افزودن فیلد token_version برای ابطال فوری نشست‌های نامعتبر یا غیرفعال‌شده
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
