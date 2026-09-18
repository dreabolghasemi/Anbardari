-- ====================================================================
-- پایگاه داده PostgreSQL سامانه انبارداری واحد اعلام حریق ذوب‌آهن اصفهان
-- ساختار یکپارچه جداول سامانه متمرکز (Central Single Source of Truth)
-- ====================================================================

-- 1. جدول ردیابی مایگریشن‌ها
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. جدول نقش‌های کاربری (Roles)
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (id, name, description)
VALUES 
  ('ADMIN', 'مدیر سیستم', 'دسترسی نامحدود به تمامی بخش‌ها، تعریف انبار، کالا، کاربر و پشتیبان‌گیری'),
  ('WAREHOUSE_USER', 'کارشناس انبار', 'ثبت ورود، خروج، انتقال کالا و مشاهده گزارش‌ها و موجودی')
ON CONFLICT (id) DO NOTHING;

-- 3. جدول دسترسی‌ها (Permissions)
CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO permissions (id, name, description)
VALUES
  ('STOCK_IN', 'ثبت ورود کالا', 'ثبت ورود اقلام و تجهیزات به انبار'),
  ('STOCK_OUT', 'ثبت خروج کالا', 'ثبت حواله و خروج کالا از قفسه و انبار'),
  ('STOCK_TRANSFER', 'انتقال کالا', 'انتقال کالا بین انبارها و قفسه‌ها'),
  ('STOCK_ADJUST', 'اصلاح موجودی', 'اصلاح موجودی با ثبت صورتجلسه'),
  ('VIEW_INVENTORY', 'مشاهده موجودی', 'مشاهده کاردکس و موجودی لحظه‌ای انبارها'),
  ('MANAGE_ITEMS', 'مدیریت کالاها', 'افزودن، ویرایش و حذف مشخصات کالاها'),
  ('MANAGE_WAREHOUSES', 'مدیریت انبارها', 'تعریف انبارها و قفسه‌بندی'),
  ('MANAGE_USERS', 'مدیریت کاربران', 'مدیریت حساب‌های کاربری و نقش‌ها'),
  ('VIEW_AUDIT_LOGS', 'مشاهده لاگ ممیزی', 'مشاهده سوابق امنیتی و لاگ ممیزی سیستم'),
  ('BACKUP_RESTORE', 'پشتیبان‌گیری', 'تهیه و بازیابی نسخه پشتیبان پایگاه داده')
ON CONFLICT (id) DO NOTHING;

-- 4. جدول ارتباط نقش‌ها و دسترسی‌ها (Role Permissions)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(64) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ADMIN', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
VALUES
  ('WAREHOUSE_USER', 'STOCK_IN'),
  ('WAREHOUSE_USER', 'STOCK_OUT'),
  ('WAREHOUSE_USER', 'STOCK_TRANSFER'),
  ('WAREHOUSE_USER', 'VIEW_INVENTORY')
ON CONFLICT DO NOTHING;

-- 5. جدول کاربران سامانه (Users)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL REFERENCES roles(id) ON UPDATE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- 6. جدول دسته‌بندی قطعات و تجهیزات اعلام حریق (Categories)
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(200) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO categories (id, name, description)
VALUES
  ('cat-01', 'دتکتورها و آشکارسازها', 'انواع دتکتور دودی نوری، حرارتی، شعله و گاز'),
  ('cat-02', 'شستی‌های اعلام حریق', 'شستی‌های دستی متعارف و آدرس‌پذیر ضد انفجار'),
  ('cat-03', 'تجهیزات هشداردهنده صوتی و نوری', 'آژیرها، فلاشرها و بوق‌های اعلام خطر صنعتی'),
  ('cat-04', 'ماژول‌ها و اینترفیس‌ها', 'ماژول‌های ورودی/خروجی، ایزولاتور و کنترل فرمان'),
  ('cat-05', 'پانل‌های مرکزی و تکرارکننده‌ها', 'پانل مرکزی اعلام حریق، باتری‌ها و منابع تغذیه')
ON CONFLICT (name) DO NOTHING;

-- 7. جدول انبارها (Warehouses)
CREATE TABLE IF NOT EXISTS warehouses (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses (code);

-- 8. جدول قفسه‌های انبار (Shelves)
CREATE TABLE IF NOT EXISTS shelves (
  id VARCHAR(64) PRIMARY KEY,
  warehouse_id VARCHAR(64) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_warehouse_shelf_code UNIQUE (warehouse_id, code)
);

CREATE INDEX IF NOT EXISTS idx_shelves_warehouse_id ON shelves (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_shelves_code ON shelves (code);

-- 9. جدول اقلام و کالاهای انبار (Items / Products)
CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(150) NOT NULL,
  brand VARCHAR(150) DEFAULT '',
  model VARCHAR(150) DEFAULT '',
  unit VARCHAR(50) NOT NULL DEFAULT 'عدد',
  description TEXT DEFAULT '',
  image_url TEXT,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  storage_location VARCHAR(255) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_code ON items (code);
CREATE INDEX IF NOT EXISTS idx_items_category ON items (category);

-- 10. جدول موجودی لحظه‌ای کالاها در قفسه‌ها (Inventory / Stock)
CREATE TABLE IF NOT EXISTS inventories (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  warehouse_id VARCHAR(64) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  shelf_id VARCHAR(64) NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inventory_item_wh_shelf UNIQUE (item_id, warehouse_id, shelf_id)
);

CREATE INDEX IF NOT EXISTS idx_inventories_item_id ON inventories (item_id);
CREATE INDEX IF NOT EXISTS idx_inventories_warehouse_id ON inventories (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventories_shelf_id ON inventories (shelf_id);

-- 11. توالی شماره سندهای ورود، خروج و انتقال (شروع از 1001)
CREATE SEQUENCE IF NOT EXISTS stock_doc_number_seq START WITH 1001 INCREMENT BY 1;

-- 12. جدول تراکنش‌های ورود، خروج، اصلاح و جابه‌جایی موجودی (Stock Transactions)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id VARCHAR(64) PRIMARY KEY,
  tracking_code VARCHAR(100),
  type VARCHAR(50) NOT NULL, -- 'STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT'
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  source_warehouse_id VARCHAR(64) REFERENCES warehouses(id) ON DELETE SET NULL,
  source_shelf_id VARCHAR(64) REFERENCES shelves(id) ON DELETE SET NULL,
  dest_warehouse_id VARCHAR(64) REFERENCES warehouses(id) ON DELETE SET NULL,
  dest_shelf_id VARCHAR(64) REFERENCES shelves(id) ON DELETE SET NULL,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  reference_no VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_tx_item ON stock_transactions (item_id);
CREATE INDEX IF NOT EXISTS idx_stock_tx_type ON stock_transactions (type);
CREATE INDEX IF NOT EXISTS idx_stock_tx_created_at ON stock_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_tx_user ON stock_transactions (user_id);

-- 13. جدول انتقالات اختصاصی (Transfers Table)
CREATE TABLE IF NOT EXISTS transfers (
  id VARCHAR(64) PRIMARY KEY,
  tracking_code VARCHAR(100) NOT NULL,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  source_warehouse_id VARCHAR(64) NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  source_shelf_id VARCHAR(64) NOT NULL REFERENCES shelves(id) ON DELETE RESTRICT,
  dest_warehouse_id VARCHAR(64) NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  dest_shelf_id VARCHAR(64) NOT NULL REFERENCES shelves(id) ON DELETE RESTRICT,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  reference_no VARCHAR(100),
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_item ON transfers (item_id);
CREATE INDEX IF NOT EXISTS idx_transfers_created ON transfers (created_at DESC);

-- 14. جدول فایل‌های ضمیمه و کاتالوگ‌های فنی (Attachments)
CREATE TABLE IF NOT EXISTS attachments (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  uploaded_by_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_item_id ON attachments (item_id);

-- 15. جدول وقایع‌نگاری و ممیزی سامانه (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(64),
  details TEXT,
  ip_address VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);

-- 16. جدول تنظیمات سیستمی (Settings)
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
