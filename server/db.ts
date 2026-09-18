import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  User,
  Warehouse,
  Shelf,
  Item,
  StockTransaction,
  AuditLog,
  Attachment,
  Role,
  TransactionType,
} from './types.js';
import { runMigrations } from './db/migrator.js';

/**
 * سامانه مدیریت پایگاه داده متمرکز PostgreSQL
 * واحد مهندسی اعلام حریق شرکت سهامی ذوب‌آهن اصفهان
 * 
 * بر اساس الزامات سیستمی:
 * - پایگاه داده PostgreSQL تنها و یگانه Source of Truth است.
 * - تمام تراکنش‌های ورود، خروج، انتقال و اصلاح موجودی اتمیک بوده و با SELECT ... FOR UPDATE قفل می‌شوند.
 * - در صورت عدم دسترسی به دیتابیس، خطا برگردانده شده و هیچ دیتابیس موقت یا فایلی وجود ندارد.
 */
export class PostgresDatabaseService {
  private pool: Pool;
  private isInitialized = false;

  constructor(connectionString?: string) {
    const connStr = connectionString || process.env.DATABASE_URL;

    if (!connStr || connStr.trim() === '') {
      throw new Error(
        '[PostgreSQL Error] DATABASE_URL environment variable is missing or empty. Server cannot initialize without valid PostgreSQL configuration.'
      );
    }

    const isSslNeeded =
      process.env.DATABASE_SSL === 'true' ||
      (!connStr.includes('localhost') &&
        !connStr.includes('127.0.0.1') &&
        process.env.NODE_ENV === 'production');

    this.pool = new Pool({
      connectionString: connStr.trim(),
      ssl: isSslNeeded ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]:', err.message);
    });
  }

  /**
   * راه‌اندازی اولیه و اعمال خودکار مایگریشن‌ها
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      console.log('[PostgreSQL] Connecting to central PostgreSQL database...');
      // Test basic connection
      const testClient = await this.pool.connect();
      testClient.release();
      console.log('[PostgreSQL] Connection established. Running migrations...');

      await runMigrations(this.pool);
      this.isInitialized = true;
      console.log('[PostgreSQL] Database initialized, schema verified, and admin configured.');
    } catch (err: any) {
      console.error('[PostgreSQL] Critical database initialization error:', err.message);
      // We do NOT initialize any fallback. The system must fail safe.
      throw new Error(`دیتابیس سرور در دسترس نیست: ${err.message}`);
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.pool.query('SELECT 1 as alive');
      return res.rows.length > 0 && res.rows[0].alive === 1;
    } catch {
      return false;
    }
  }

  // ====================================================================
  // USERS OPERATIONS
  // ====================================================================

  async getUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    const res = await this.pool.query(
      `SELECT id, username, full_name AS "fullName", role, is_active AS "isActive",
              token_version AS "tokenVersion", created_at AS "createdAt", last_login AS "lastLogin"
       FROM users
       ORDER BY created_at ASC`
    );
    return res.rows;
  }

  async getUserById(id: string): Promise<User | null> {
    const res = await this.pool.query(
      `SELECT id, username, full_name AS "fullName", password_hash AS "passwordHash",
              role, is_active AS "isActive", token_version AS "tokenVersion",
              created_at AS "createdAt", last_login AS "lastLogin"
       FROM users
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const res = await this.pool.query(
      `SELECT id, username, full_name AS "fullName", password_hash AS "passwordHash",
              role, is_active AS "isActive", token_version AS "tokenVersion",
              created_at AS "createdAt", last_login AS "lastLogin"
       FROM users
       WHERE LOWER(username) = LOWER($1)`,
      [username.trim()]
    );
    return res.rows[0] || null;
  }

  async createUser(data: {
    username: string;
    fullName: string;
    password: string;
    role: Role;
  }): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.getUserByUsername(data.username);
    if (existing) {
      throw new Error('کاربری با این نام کاربری قبلاً در سامانه ثبت شده است.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const id = 'usr-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const res = await this.pool.query(
      `INSERT INTO users (id, username, full_name, password_hash, role, is_active, token_version, created_at)
       VALUES ($1, $2, $3, $4, $5, true, 1, $6)
       RETURNING id, username, full_name AS "fullName", role, is_active AS "isActive", token_version AS "tokenVersion", created_at AS "createdAt"`,
      [id, data.username.trim(), data.fullName.trim(), passwordHash, data.role, now]
    );

    return res.rows[0];
  }

  async updateUser(
    id: string,
    data: {
      fullName?: string;
      role?: Role;
      isActive?: boolean;
      password?: string;
    }
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.getUserById(id);
    if (!user) throw new Error('کاربر مورد نظر یافت نشد.');

    let passwordHash = user.passwordHash;
    const isPasswordChanged = !!(data.password && data.password.trim().length > 0);
    if (isPasswordChanged) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(data.password!, salt);
    }

    const fullName = data.fullName !== undefined ? data.fullName.trim() : user.fullName;
    const role = data.role !== undefined ? data.role : user.role;
    const isActive = data.isActive !== undefined ? data.isActive : user.isActive;

    // Revoke previous sessions by bumping token_version if password changed, account deactivated, or role changed
    const shouldBumpTokenVersion =
      isPasswordChanged ||
      (data.isActive !== undefined && data.isActive === false) ||
      (data.role !== undefined && data.role !== user.role);

    const res = await this.pool.query(
      `UPDATE users
       SET full_name = $1, role = $2, is_active = $3, password_hash = $4,
           token_version = CASE WHEN $6::boolean THEN token_version + 1 ELSE token_version END
       WHERE id = $5
       RETURNING id, username, full_name AS "fullName", role, is_active AS "isActive",
                 token_version AS "tokenVersion", created_at AS "createdAt", last_login AS "lastLogin"`,
      [fullName, role, isActive, passwordHash, id, shouldBumpTokenVersion]
    );

    return res.rows[0];
  }

  async incrementTokenVersion(userId: string): Promise<number> {
    const res = await this.pool.query(
      `UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version AS "tokenVersion"`,
      [userId]
    );
    return res.rows[0]?.tokenVersion || 1;
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.getUserById(id);
    if (!user) throw new Error('کاربر یافت نشد.');
    if (user.username.toLowerCase() === 'admin') {
      throw new Error('حساب کاربری مدیر ارشد سیستم (admin) قابل حذف نیست.');
    }

    await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
    return true;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [id]);
  }

  // ====================================================================
  // ROLES & PERMISSIONS
  // ====================================================================

  async getRoles() {
    const res = await this.pool.query('SELECT * FROM roles ORDER BY id ASC');
    return res.rows;
  }

  async getPermissions() {
    const res = await this.pool.query('SELECT * FROM permissions ORDER BY id ASC');
    return res.rows;
  }

  async getRolePermissions(roleId: string) {
    const res = await this.pool.query(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [roleId]
    );
    return res.rows;
  }

  // ====================================================================
  // WAREHOUSES OPERATIONS
  // ====================================================================

  async getWarehouses(): Promise<Warehouse[]> {
    const res = await this.pool.query(
      `SELECT id, name, code, description, is_active AS "isActive",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM warehouses
       ORDER BY code ASC`
    );
    return res.rows;
  }

  async getWarehouseById(id: string): Promise<Warehouse | null> {
    const res = await this.pool.query(
      `SELECT id, name, code, description, is_active AS "isActive",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM warehouses
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async createWarehouse(data: {
    name: string;
    code: string;
    description?: string;
  }): Promise<Warehouse> {
    const code = data.code.trim().toUpperCase();
    const existing = await this.pool.query('SELECT id FROM warehouses WHERE UPPER(code) = $1', [code]);
    if (existing.rows.length > 0) {
      throw new Error(`انباری با کد «${code}» قبلاً تعریف شده است.`);
    }

    const id = 'wh-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const res = await this.pool.query(
      `INSERT INTO warehouses (id, name, code, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, $5, $5)
       RETURNING id, name, code, description, is_active AS "isActive",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, data.name.trim(), code, data.description?.trim() || '', now]
    );

    return res.rows[0];
  }

  async updateWarehouse(
    id: string,
    data: { name?: string; code?: string; description?: string; isActive?: boolean }
  ): Promise<Warehouse> {
    const wh = await this.getWarehouseById(id);
    if (!wh) throw new Error('انبار مورد نظر یافت نشد.');

    let newCode = wh.code;
    if (data.code && data.code.trim().toUpperCase() !== wh.code) {
      newCode = data.code.trim().toUpperCase();
      const existing = await this.pool.query(
        'SELECT id FROM warehouses WHERE UPPER(code) = $1 AND id != $2',
        [newCode, id]
      );
      if (existing.rows.length > 0) {
        throw new Error(`انبار دیگری با کد «${newCode}» در سیستم موجود است.`);
      }
    }

    const name = data.name !== undefined ? data.name.trim() : wh.name;
    const description = data.description !== undefined ? data.description.trim() : wh.description;
    const isActive = data.isActive !== undefined ? data.isActive : wh.isActive;
    const now = new Date().toISOString();

    const res = await this.pool.query(
      `UPDATE warehouses
       SET name = $1, code = $2, description = $3, is_active = $4, updated_at = $5
       WHERE id = $6
       RETURNING id, name, code, description, is_active AS "isActive",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, newCode, description, isActive, now, id]
    );

    return res.rows[0];
  }

  async deleteWarehouse(id: string): Promise<Warehouse> {
    const wh = await this.getWarehouseById(id);
    if (!wh) throw new Error('انبار مورد نظر یافت نشد.');

    const invCheck = await this.pool.query(
      'SELECT SUM(quantity) as total FROM inventories WHERE warehouse_id = $1',
      [id]
    );
    const totalQty = parseInt(invCheck.rows[0]?.total || '0', 10);
    if (totalQty > 0) {
      throw new Error(`انبار دارای موجودی کالا (${totalQty} عدد) است و امکان حذف آن وجود ندارد.`);
    }

    await this.pool.query('DELETE FROM warehouses WHERE id = $1', [id]);
    return wh;
  }

  // ====================================================================
  // SHELVES OPERATIONS
  // ====================================================================

  async getShelves(warehouseId?: string): Promise<Shelf[]> {
    let query = `
      SELECT id, warehouse_id AS "warehouseId", name, code, description,
             status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM shelves
    `;
    const params: any[] = [];
    if (warehouseId) {
      query += ' WHERE warehouse_id = $1';
      params.push(warehouseId);
    }
    query += ' ORDER BY code ASC';

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async getShelfById(id: string): Promise<Shelf | null> {
    const res = await this.pool.query(
      `SELECT id, warehouse_id AS "warehouseId", name, code, description,
              status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM shelves
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async createShelf(data: {
    warehouseId: string;
    name: string;
    code: string;
    description?: string;
  }): Promise<Shelf> {
    const warehouse = await this.getWarehouseById(data.warehouseId);
    if (!warehouse) throw new Error('انبار مشخص شده وجود ندارد.');

    const code = data.code.trim().toUpperCase();
    const existing = await this.pool.query(
      'SELECT id FROM shelves WHERE warehouse_id = $1 AND UPPER(code) = $2',
      [data.warehouseId, code]
    );
    if (existing.rows.length > 0) {
      throw new Error(`قفسه‌ای با کد «${code}» قبلاً در این انبار تعریف شده است.`);
    }

    const id = 'shf-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const res = await this.pool.query(
      `INSERT INTO shelves (id, warehouse_id, name, code, description, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $6)
       RETURNING id, warehouse_id AS "warehouseId", name, code, description,
                 status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, data.warehouseId, data.name.trim(), code, data.description?.trim() || '', now]
    );

    return res.rows[0];
  }

  async updateShelf(
    id: string,
    data: { name?: string; code?: string; description?: string; status?: string; warehouseId?: string }
  ): Promise<Shelf> {
    const shelf = await this.getShelfById(id);
    if (!shelf) throw new Error('قفسه مورد نظر یافت نشد.');

    let newCode = shelf.code;
    const warehouseId = data.warehouseId || shelf.warehouseId;
    if (data.code && data.code.trim().toUpperCase() !== shelf.code) {
      newCode = data.code.trim().toUpperCase();
      const existing = await this.pool.query(
        'SELECT id FROM shelves WHERE warehouse_id = $1 AND UPPER(code) = $2 AND id != $3',
        [warehouseId, newCode, id]
      );
      if (existing.rows.length > 0) {
        throw new Error(`قفسه دیگری با کد «${newCode}» در این انبار موجود است.`);
      }
    }

    const name = data.name !== undefined ? data.name.trim() : shelf.name;
    const description = data.description !== undefined ? data.description.trim() : shelf.description;
    const status = data.status !== undefined ? data.status : shelf.status;
    const now = new Date().toISOString();

    const res = await this.pool.query(
      `UPDATE shelves
       SET name = $1, code = $2, description = $3, status = $4, warehouse_id = $5, updated_at = $6
       WHERE id = $7
       RETURNING id, warehouse_id AS "warehouseId", name, code, description,
                 status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, newCode, description, status, warehouseId, now, id]
    );

    return res.rows[0];
  }

  async deleteShelf(id: string): Promise<Shelf> {
    const shelf = await this.getShelfById(id);
    if (!shelf) throw new Error('قفسه مورد نظر یافت نشد.');

    const invCheck = await this.pool.query(
      'SELECT SUM(quantity) as total FROM inventories WHERE shelf_id = $1',
      [id]
    );
    const totalQty = parseInt(invCheck.rows[0]?.total || '0', 10);
    if (totalQty > 0) {
      throw new Error(`قفسه دارای موجودی کالا (${totalQty} عدد) است و امکان حذف آن وجود ندارد.`);
    }

    await this.pool.query('DELETE FROM shelves WHERE id = $1', [id]);
    return shelf;
  }

  // ====================================================================
  // ITEMS & CATEGORIES OPERATIONS
  // ====================================================================

  async getCategories() {
    const res = await this.pool.query('SELECT * FROM categories ORDER BY name ASC');
    return res.rows;
  }

  async getItems(filters?: string | { category?: string; search?: string }): Promise<Item[]> {
    let query = `
      SELECT id, name, code, category, brand, model, unit, description,
             image_url AS "imageUrl", min_quantity AS "minQuantity",
             storage_location AS "storageLocation",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM items
      WHERE 1=1
    `;
    const params: any[] = [];

    const category = typeof filters === 'string' ? filters : filters?.category;
    const search = typeof filters === 'object' ? filters?.search : undefined;

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(code) LIKE $${params.length} OR LOWER(brand) LIKE $${params.length} OR LOWER(model) LIKE $${params.length})`;
    }

    query += ' ORDER BY name ASC';
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async getItemById(id: string): Promise<Item | null> {
    const res = await this.pool.query(
      `SELECT id, name, code, category, brand, model, unit, description,
              image_url AS "imageUrl", min_quantity AS "minQuantity",
              storage_location AS "storageLocation",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM items
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async getItemByCode(code: string): Promise<Item | null> {
    const res = await this.pool.query(
      `SELECT id, name, code, category, brand, model, unit, description,
              image_url AS "imageUrl", min_quantity AS "minQuantity",
              storage_location AS "storageLocation",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM items
       WHERE UPPER(code) = UPPER($1)`,
      [code.trim()]
    );
    return res.rows[0] || null;
  }

  async createItem(data: {
    name: string;
    code: string;
    category: string;
    brand?: string;
    model?: string;
    unit?: string;
    description?: string;
    imageUrl?: string;
    minQuantity?: number;
    storageLocation?: string;
  }): Promise<Item> {
    const code = data.code.trim().toUpperCase();
    const existing = await this.getItemByCode(code);
    if (existing) {
      throw new Error(`کالایی با کد فنی «${code}» قبلاً در سامانه ثبت شده است.`);
    }

    const id = 'itm-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const res = await this.pool.query(
      `INSERT INTO items (id, name, code, category, brand, model, unit, description, image_url, min_quantity, storage_location, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING id, name, code, category, brand, model, unit, description,
                 image_url AS "imageUrl", min_quantity AS "minQuantity",
                 storage_location AS "storageLocation",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        data.name.trim(),
        code,
        data.category.trim(),
        data.brand?.trim() || '',
        data.model?.trim() || '',
        data.unit?.trim() || 'عدد',
        data.description?.trim() || '',
        data.imageUrl || null,
        data.minQuantity || 0,
        data.storageLocation?.trim() || '',
        now,
      ]
    );

    return res.rows[0];
  }

  async updateItem(
    id: string,
    data: {
      name?: string;
      code?: string;
      category?: string;
      brand?: string;
      model?: string;
      unit?: string;
      description?: string;
      imageUrl?: string;
      minQuantity?: number;
      storageLocation?: string;
    }
  ): Promise<Item> {
    const item = await this.getItemById(id);
    if (!item) throw new Error('کالای مورد نظر یافت نشد.');

    let newCode = item.code;
    if (data.code && data.code.trim().toUpperCase() !== item.code) {
      newCode = data.code.trim().toUpperCase();
      const existing = await this.pool.query(
        'SELECT id FROM items WHERE UPPER(code) = $1 AND id != $2',
        [newCode, id]
      );
      if (existing.rows.length > 0) {
        throw new Error(`کالای دیگری با کد «${newCode}» در سیستم موجود است.`);
      }
    }

    const name = data.name !== undefined ? data.name.trim() : item.name;
    const category = data.category !== undefined ? data.category.trim() : item.category;
    const brand = data.brand !== undefined ? data.brand.trim() : item.brand;
    const model = data.model !== undefined ? data.model.trim() : item.model;
    const unit = data.unit !== undefined ? data.unit.trim() : item.unit;
    const description = data.description !== undefined ? data.description.trim() : item.description;
    const imageUrl = data.imageUrl !== undefined ? data.imageUrl : item.imageUrl;
    const minQuantity = data.minQuantity !== undefined ? data.minQuantity : (item as any).minQuantity || 0;
    const storageLocation = data.storageLocation !== undefined ? data.storageLocation : (item as any).storageLocation || '';
    const now = new Date().toISOString();

    const res = await this.pool.query(
      `UPDATE items
       SET name = $1, code = $2, category = $3, brand = $4, model = $5,
           unit = $6, description = $7, image_url = $8, min_quantity = $9,
           storage_location = $10, updated_at = $11
       WHERE id = $12
       RETURNING id, name, code, category, brand, model, unit, description,
                 image_url AS "imageUrl", min_quantity AS "minQuantity",
                 storage_location AS "storageLocation",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, newCode, category, brand, model, unit, description, imageUrl, minQuantity, storageLocation, now, id]
    );

    return res.rows[0];
  }

  async deleteItem(id: string): Promise<Item> {
    const item = await this.getItemById(id);
    if (!item) throw new Error('کالای مورد نظر یافت نشد.');

    const invRes = await this.pool.query(
      'SELECT SUM(quantity) as total FROM inventories WHERE item_id = $1',
      [id]
    );
    const totalQty = parseInt(invRes.rows[0]?.total || '0', 10);
    if (totalQty > 0) {
      throw new Error(`این کالا دارای موجودی (${totalQty} عدد) در انبار است و حذف آن مجاز نمی‌باشد.`);
    }

    await this.pool.query('DELETE FROM items WHERE id = $1', [id]);
    return item;
  }

  // ====================================================================
  // INVENTORY & STOCK OPERATIONS (ACID TRANSACTIONS WITH ROW LOCKING)
  // ====================================================================

  async getInventories(filters?: { warehouseId?: string; shelfId?: string; itemId?: string }) {
    return this.getInventoryDetails(filters);
  }

  async getInventoryDetails(filters?: { warehouseId?: string; shelfId?: string; itemId?: string }) {
    let query = `
      SELECT inv.id, inv.item_id AS "itemId", inv.warehouse_id AS "warehouseId",
             inv.shelf_id AS "shelfId", inv.quantity, inv.updated_at AS "updatedAt",
             i.name AS "itemName", i.code AS "itemCode", i.brand AS "itemBrand",
             i.model AS "itemModel", i.category AS "itemCategory", i.unit AS "itemUnit",
             w.name AS "warehouseName", w.code AS "warehouseCode",
             s.name AS "shelfName", s.code AS "shelfCode"
      FROM inventories inv
      JOIN items i ON i.id = inv.item_id
      JOIN warehouses w ON w.id = inv.warehouse_id
      JOIN shelves s ON s.id = inv.shelf_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (filters?.warehouseId) {
      params.push(filters.warehouseId);
      query += ` AND inv.warehouse_id = $${params.length}`;
    }
    if (filters?.shelfId) {
      params.push(filters.shelfId);
      query += ` AND inv.shelf_id = $${params.length}`;
    }
    if (filters?.itemId) {
      params.push(filters.itemId);
      query += ` AND inv.item_id = $${params.length}`;
    }

    query += ' ORDER BY i.name ASC, w.name ASC, s.name ASC';
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async getInventoryByItem(itemId: string) {
    return this.getInventoryDetails({ itemId });
  }

  async getNextDocNumber(client?: PoolClient): Promise<string> {
    const dbClient = client || this.pool;
    try {
      await dbClient.query('CREATE SEQUENCE IF NOT EXISTS stock_doc_number_seq START WITH 1001 INCREMENT BY 1');
      const maxRes = await dbClient.query(
        "SELECT reference_no FROM stock_transactions WHERE reference_no ~ '^\\d+$' ORDER BY CAST(reference_no AS BIGINT) DESC LIMIT 1"
      );
      if (maxRes.rows.length > 0 && maxRes.rows[0].reference_no) {
        const lastNum = parseInt(maxRes.rows[0].reference_no, 10);
        if (!isNaN(lastNum) && lastNum >= 1000) {
          await dbClient.query(`SELECT setval('stock_doc_number_seq', GREATEST(1000, ${lastNum}), true)`);
        }
      }
      const res = await dbClient.query("SELECT nextval('stock_doc_number_seq') as next_doc");
      return String(res.rows[0].next_doc);
    } catch {
      const res = await dbClient.query(
        "SELECT reference_no FROM stock_transactions WHERE reference_no ~ '^\\d+$' ORDER BY CAST(reference_no AS BIGINT) DESC LIMIT 1"
      );
      if (res.rows.length > 0 && res.rows[0].reference_no) {
        const lastNum = parseInt(res.rows[0].reference_no, 10);
        return String(Math.max(1000, lastNum) + 1);
      }
      return '1001';
    }
  }

  async peekNextDocNumber(): Promise<string> {
    try {
      const res = await this.pool.query(
        "SELECT reference_no FROM stock_transactions WHERE reference_no ~ '^\\d+$' ORDER BY CAST(reference_no AS BIGINT) DESC LIMIT 1"
      );
      if (res.rows.length > 0 && res.rows[0].reference_no) {
        const lastNum = parseInt(res.rows[0].reference_no, 10);
        return String(Math.max(1000, lastNum) + 1);
      }
      return '1001';
    } catch {
      return '1001';
    }
  }

  /**
   * عملیات ورود کالا (STOCK_IN) به صورت کاملاً Transactional با قفل ردیفی
   */
  async stockIn(params: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    userId: string;
    referenceNo?: string;
    notes?: string;
    ipAddress?: string;
  }) {
    if (params.quantity <= 0) {
      throw new Error('تعداد ورودی کالا باید بزرگتر از صفر باشد.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const itemRes = await client.query('SELECT name, code FROM items WHERE id = $1', [params.itemId]);
      if (itemRes.rows.length === 0) throw new Error('کالای مورد نظر یافت نشد.');
      const item = itemRes.rows[0];

      // Row locking on inventory record
      const invCheck = await client.query(
        `SELECT id, quantity FROM inventories
         WHERE item_id = $1 AND warehouse_id = $2 AND shelf_id = $3
         FOR UPDATE`,
        [params.itemId, params.warehouseId, params.shelfId]
      );

      let newQuantity: number;
      if (invCheck.rows.length > 0) {
        newQuantity = invCheck.rows[0].quantity + params.quantity;
        await client.query(
          `UPDATE inventories SET quantity = $1, updated_at = NOW() WHERE id = $2`,
          [newQuantity, invCheck.rows[0].id]
        );
      } else {
        newQuantity = params.quantity;
        await client.query(
          `INSERT INTO inventories (id, item_id, warehouse_id, shelf_id, quantity, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [crypto.randomUUID(), params.itemId, params.warehouseId, params.shelfId, newQuantity]
        );
      }

      // Record transaction
      const txId = crypto.randomUUID();
      const trackingCode = 'IN-' + Date.now().toString().slice(-6);
      const docNo = params.referenceNo || (await this.getNextDocNumber(client));

      await client.query(
        `INSERT INTO stock_transactions
          (id, tracking_code, type, item_id, quantity, dest_warehouse_id, dest_shelf_id, user_id, reference_no, notes, created_at)
         VALUES ($1, $2, 'STOCK_IN', $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          txId,
          trackingCode,
          params.itemId,
          params.quantity,
          params.warehouseId,
          params.shelfId,
          params.userId,
          docNo,
          params.notes || null,
        ]
      );

      // Record audit log
      const userRes = await client.query('SELECT username, full_name FROM users WHERE id = $1', [params.userId]);
      const username = userRes.rows[0]?.username || 'system';

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, 'STOCK_IN', 'Item', $4, $5, $6, NOW())`,
        [
          crypto.randomUUID(),
          params.userId,
          username,
          params.itemId,
          `ورود ${params.quantity} عدد کالای «${item.name}» (سند: ${docNo})`,
          params.ipAddress || '127.0.0.1',
        ]
      );

      await client.query('COMMIT');

      const fullTx = await this.getTransactionById(txId);
      return {
        transaction: fullTx,
        newStock: newQuantity,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * عملیات خروج کالا (STOCK_OUT) با قفل ردیفی FOR UPDATE جهت جلوگیری از Race Condition و موجودی منفی
   */
  async stockOut(params: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    userId: string;
    referenceNo?: string;
    notes?: string;
    ipAddress?: string;
  }) {
    if (params.quantity <= 0) {
      throw new Error('تعداد خروجی کالا باید بزرگتر از صفر باشد.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const itemRes = await client.query('SELECT name, code FROM items WHERE id = $1', [params.itemId]);
      if (itemRes.rows.length === 0) throw new Error('کالای مورد نظر یافت نشد.');
      const item = itemRes.rows[0];

      // Critical row lock with SELECT ... FOR UPDATE
      const invRes = await client.query(
        `SELECT id, quantity FROM inventories
         WHERE item_id = $1 AND warehouse_id = $2 AND shelf_id = $3
         FOR UPDATE`,
        [params.itemId, params.warehouseId, params.shelfId]
      );

      if (invRes.rows.length === 0 || invRes.rows[0].quantity < params.quantity) {
        const currentQty = invRes.rows[0]?.quantity || 0;
        throw new Error(`موجودی کافی نیست. موجودی فعلی در این قفسه ${currentQty} عدد است.`);
      }

      const newQuantity = invRes.rows[0].quantity - params.quantity;
      await client.query(
        'UPDATE inventories SET quantity = $1, updated_at = NOW() WHERE id = $2',
        [newQuantity, invRes.rows[0].id]
      );

      const txId = crypto.randomUUID();
      const trackingCode = 'OUT-' + Date.now().toString().slice(-6);
      const docNo = params.referenceNo || (await this.getNextDocNumber(client));

      await client.query(
        `INSERT INTO stock_transactions
          (id, tracking_code, type, item_id, quantity, source_warehouse_id, source_shelf_id, user_id, reference_no, notes, created_at)
         VALUES ($1, $2, 'STOCK_OUT', $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          txId,
          trackingCode,
          params.itemId,
          params.quantity,
          params.warehouseId,
          params.shelfId,
          params.userId,
          docNo,
          params.notes || null,
        ]
      );

      // Audit log
      const userRes = await client.query('SELECT username FROM users WHERE id = $1', [params.userId]);
      const username = userRes.rows[0]?.username || 'system';

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, 'STOCK_OUT', 'Item', $4, $5, $6, NOW())`,
        [
          crypto.randomUUID(),
          params.userId,
          username,
          params.itemId,
          `خروج ${params.quantity} عدد کالای «${item.name}» (سند: ${docNo})`,
          params.ipAddress || '127.0.0.1',
        ]
      );

      await client.query('COMMIT');

      const fullTx = await this.getTransactionById(txId);
      return {
        transaction: fullTx,
        remainingStock: newQuantity,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * عملیات انتقال کالا (TRANSFER) بین قفسه‌ها/انبارها - کاملاً اتمیک با قفل ردیفی در مبدا و مقصد
   */
  async transfer(params: {
    itemId: string;
    sourceWarehouseId: string;
    sourceShelfId: string;
    destWarehouseId: string;
    destShelfId: string;
    quantity: number;
    userId: string;
    referenceNo?: string;
    notes?: string;
    ipAddress?: string;
  }) {
    if (params.quantity <= 0) {
      throw new Error('تعداد انتقالی باید بزرگتر از صفر باشد.');
    }
    if (params.sourceWarehouseId === params.destWarehouseId && params.sourceShelfId === params.destShelfId) {
      throw new Error('انبار و قفسه مبدا و مقصد نمی‌توانند کاملاً یکسان باشند.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const itemRes = await client.query('SELECT name, code FROM items WHERE id = $1', [params.itemId]);
      if (itemRes.rows.length === 0) throw new Error('کالای مورد نظر یافت نشد.');
      const item = itemRes.rows[0];

      // 1. Lock and deduct from source
      const srcRes = await client.query(
        `SELECT id, quantity FROM inventories
         WHERE item_id = $1 AND warehouse_id = $2 AND shelf_id = $3
         FOR UPDATE`,
        [params.itemId, params.sourceWarehouseId, params.sourceShelfId]
      );

      if (srcRes.rows.length === 0 || srcRes.rows[0].quantity < params.quantity) {
        const currentQty = srcRes.rows[0]?.quantity || 0;
        throw new Error(`موجودی در قفسه مبدا کافی نیست. موجودی فعلی: ${currentQty} عدد.`);
      }

      await client.query(
        'UPDATE inventories SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2',
        [params.quantity, srcRes.rows[0].id]
      );

      // 2. Lock and add to destination
      const destRes = await client.query(
        `SELECT id, quantity FROM inventories
         WHERE item_id = $1 AND warehouse_id = $2 AND shelf_id = $3
         FOR UPDATE`,
        [params.itemId, params.destWarehouseId, params.destShelfId]
      );

      if (destRes.rows.length > 0) {
        await client.query(
          'UPDATE inventories SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2',
          [params.quantity, destRes.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO inventories (id, item_id, warehouse_id, shelf_id, quantity, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [crypto.randomUUID(), params.itemId, params.destWarehouseId, params.destShelfId, params.quantity]
        );
      }

      // 3. Record in transfers and stock_transactions
      const txId = crypto.randomUUID();
      const trackingCode = 'TRF-' + Date.now().toString().slice(-6);
      const docNo = params.referenceNo || (await this.getNextDocNumber(client));

      await client.query(
        `INSERT INTO stock_transactions
          (id, tracking_code, type, item_id, quantity, source_warehouse_id, source_shelf_id,
           dest_warehouse_id, dest_shelf_id, user_id, reference_no, notes, created_at)
         VALUES ($1, $2, 'TRANSFER', $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          txId,
          trackingCode,
          params.itemId,
          params.quantity,
          params.sourceWarehouseId,
          params.sourceShelfId,
          params.destWarehouseId,
          params.destShelfId,
          params.userId,
          docNo,
          params.notes || null,
        ]
      );

      await client.query(
        `INSERT INTO transfers
          (id, tracking_code, item_id, quantity, source_warehouse_id, source_shelf_id,
           dest_warehouse_id, dest_shelf_id, user_id, reference_no, notes, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'COMPLETED', NOW())`,
        [
          txId,
          trackingCode,
          params.itemId,
          params.quantity,
          params.sourceWarehouseId,
          params.sourceShelfId,
          params.destWarehouseId,
          params.destShelfId,
          params.userId,
          docNo,
          params.notes || null,
        ]
      );

      // 4. Audit log
      const userRes = await client.query('SELECT username FROM users WHERE id = $1', [params.userId]);
      const username = userRes.rows[0]?.username || 'system';

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, 'TRANSFER', 'Item', $4, $5, $6, NOW())`,
        [
          crypto.randomUUID(),
          params.userId,
          username,
          params.itemId,
          `انتقال ${params.quantity} عدد کالای «${item.name}» بین قفسه‌ها (سند: ${docNo})`,
          params.ipAddress || '127.0.0.1',
        ]
      );

      await client.query('COMMIT');

      const fullTx = await this.getTransactionById(txId);
      return {
        transaction: fullTx,
        transferredQuantity: params.quantity,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * اصلاح دستی موجودی با ثبت صورتجلسه
   */
  async adjustInventory(params: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    newTargetQuantity: number;
    userId: string;
    reason: string;
    ipAddress?: string;
  }) {
    if (params.newTargetQuantity < 0) {
      throw new Error('موجودی نمی‌تواند منفی باشد.');
    }
    if (!params.reason || params.reason.trim().length < 3) {
      throw new Error('علت اصلاح موجودی و شماره صورتجلسه الزامی است.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const itemRes = await client.query('SELECT name FROM items WHERE id = $1', [params.itemId]);
      if (itemRes.rows.length === 0) throw new Error('کالای مورد نظر یافت نشد.');
      const item = itemRes.rows[0];

      const invRes = await client.query(
        `SELECT id, quantity FROM inventories
         WHERE item_id = $1 AND warehouse_id = $2 AND shelf_id = $3
         FOR UPDATE`,
        [params.itemId, params.warehouseId, params.shelfId]
      );

      let oldQuantity = 0;
      if (invRes.rows.length > 0) {
        oldQuantity = invRes.rows[0].quantity;
        await client.query(
          'UPDATE inventories SET quantity = $1, updated_at = NOW() WHERE id = $2',
          [params.newTargetQuantity, invRes.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO inventories (id, item_id, warehouse_id, shelf_id, quantity, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [crypto.randomUUID(), params.itemId, params.warehouseId, params.shelfId, params.newTargetQuantity]
        );
      }

      const diff = params.newTargetQuantity - oldQuantity;
      const txId = crypto.randomUUID();
      const trackingCode = 'ADJ-' + Date.now().toString().slice(-6);
      const docNo = await this.getNextDocNumber(client);

      await client.query(
        `INSERT INTO stock_transactions
          (id, tracking_code, type, item_id, quantity, source_warehouse_id, source_shelf_id,
           dest_warehouse_id, dest_shelf_id, user_id, reference_no, notes, created_at)
         VALUES ($1, $2, 'ADJUSTMENT', $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          txId,
          trackingCode,
          params.itemId,
          Math.abs(diff) || params.newTargetQuantity,
          diff < 0 ? params.warehouseId : null,
          diff < 0 ? params.shelfId : null,
          diff > 0 ? params.warehouseId : null,
          diff > 0 ? params.shelfId : null,
          params.userId,
          docNo,
          params.reason,
        ]
      );

      const userRes = await client.query('SELECT username FROM users WHERE id = $1', [params.userId]);
      const username = userRes.rows[0]?.username || 'system';

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, 'ADJUST_INVENTORY', 'Inventory', $4, $5, $6, NOW())`,
        [
          crypto.randomUUID(),
          params.userId,
          username,
          params.itemId,
          `اصلاح موجودی کالای «${item.name}» از ${oldQuantity} به ${params.newTargetQuantity}. دلیل: ${params.reason}`,
          params.ipAddress || '127.0.0.1',
        ]
      );

      await client.query('COMMIT');

      const fullTx = await this.getTransactionById(txId);
      return {
        transaction: fullTx,
        newQuantity: params.newTargetQuantity,
        difference: diff,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // ====================================================================
  // TRANSACTIONS & AUDIT LOGS
  // ====================================================================

  async getTransactions(filters?: {
    type?: TransactionType;
    itemId?: string;
    warehouseId?: string;
    shelfId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<StockTransaction[]> {
    let query = `
      SELECT t.id, t.tracking_code AS "trackingCode", t.type, t.item_id AS "itemId",
             t.quantity, t.source_warehouse_id AS "sourceWarehouseId",
             t.source_shelf_id AS "sourceShelfId", t.dest_warehouse_id AS "destWarehouseId",
             t.dest_shelf_id AS "destShelfId", t.user_id AS "userId",
             t.reference_no AS "referenceNo", t.notes, t.created_at AS "createdAt",
             i.name AS "itemName", i.code AS "itemCode", i.unit AS "itemUnit",
             sw.name AS "sourceWarehouseName", dw.name AS "destWarehouseName",
             ss.name AS "sourceShelfName", ds.name AS "destShelfName",
             u.full_name AS "userFullName", u.username AS "username"
      FROM stock_transactions t
      JOIN items i ON i.id = t.item_id
      LEFT JOIN warehouses sw ON sw.id = t.source_warehouse_id
      LEFT JOIN warehouses dw ON dw.id = t.dest_warehouse_id
      LEFT JOIN shelves ss ON ss.id = t.source_shelf_id
      LEFT JOIN shelves ds ON ds.id = t.dest_shelf_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.type) {
      params.push(filters.type);
      query += ` AND t.type = $${params.length}`;
    }
    if (filters?.itemId) {
      params.push(filters.itemId);
      query += ` AND t.item_id = $${params.length}`;
    }
    if (filters?.warehouseId) {
      params.push(filters.warehouseId);
      query += ` AND (t.source_warehouse_id = $${params.length} OR t.dest_warehouse_id = $${params.length})`;
    }
    if (filters?.shelfId) {
      params.push(filters.shelfId);
      query += ` AND (t.source_shelf_id = $${params.length} OR t.dest_shelf_id = $${params.length})`;
    }
    if (filters?.userId) {
      params.push(filters.userId);
      query += ` AND t.user_id = $${params.length}`;
    }
    if (filters?.startDate) {
      params.push(filters.startDate);
      query += ` AND t.created_at >= $${params.length}`;
    }
    if (filters?.endDate) {
      params.push(filters.endDate);
      query += ` AND t.created_at <= $${params.length}`;
    }

    query += ' ORDER BY t.created_at DESC';

    const limit = filters?.limit || 200;
    params.push(limit);
    query += ` LIMIT $${params.length}`;

    if (filters?.offset) {
      params.push(filters.offset);
      query += ` OFFSET $${params.length}`;
    }

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async getTransactionById(id: string): Promise<StockTransaction | null> {
    const list = await this.getTransactions({ limit: 1 });
    const res = await this.pool.query(
      `SELECT t.id, t.tracking_code AS "trackingCode", t.type, t.item_id AS "itemId",
              t.quantity, t.source_warehouse_id AS "sourceWarehouseId",
              t.source_shelf_id AS "sourceShelfId", t.dest_warehouse_id AS "destWarehouseId",
              t.dest_shelf_id AS "destShelfId", t.user_id AS "userId",
              t.reference_no AS "referenceNo", t.notes, t.created_at AS "createdAt",
              i.name AS "itemName", i.code AS "itemCode", i.unit AS "itemUnit",
              sw.name AS "sourceWarehouseName", dw.name AS "destWarehouseName",
              ss.name AS "sourceShelfName", ds.name AS "destShelfName",
              u.full_name AS "userFullName", u.username AS "username"
       FROM stock_transactions t
       JOIN items i ON i.id = t.item_id
       LEFT JOIN warehouses sw ON sw.id = t.source_warehouse_id
       LEFT JOIN warehouses dw ON dw.id = t.dest_warehouse_id
       LEFT JOIN shelves ss ON ss.id = t.source_shelf_id
       LEFT JOIN shelves ds ON ds.id = t.dest_shelf_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async getTransfers(limit = 100) {
    const res = await this.pool.query(
      `SELECT t.*, i.name as "itemName", i.code as "itemCode",
              sw.name as "sourceWarehouseName", dw.name as "destWarehouseName",
              ss.name as "sourceShelfName", ds.name as "destShelfName",
              u.full_name as "userFullName"
       FROM transfers t
       JOIN items i ON i.id = t.item_id
       JOIN warehouses sw ON sw.id = t.source_warehouse_id
       JOIN warehouses dw ON dw.id = t.dest_warehouse_id
       JOIN shelves ss ON ss.id = t.source_shelf_id
       JOIN shelves ds ON ds.id = t.dest_shelf_id
       LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  async getAuditLogs(filters?: { userId?: string; action?: string; entity?: string; limit?: number }) {
    let query = `
      SELECT id, user_id AS "userId", username, action, entity, entity_id AS "entityId",
             details, ip_address AS "ipAddress", created_at AS "createdAt"
      FROM audit_logs
      WHERE 1=1
    `;
    const params: any[] = [];
    if (filters?.userId) {
      params.push(filters.userId);
      query += ` AND user_id = $${params.length}`;
    }
    if (filters?.action) {
      params.push(filters.action);
      query += ` AND action = $${params.length}`;
    }
    if (filters?.entity) {
      params.push(filters.entity);
      query += ` AND entity = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    const limit = filters?.limit || 100;
    params.push(limit);
    query += ` LIMIT $${params.length}`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async addAuditLog(entry: {
    userId?: string;
    username?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
  }) {
    let username = entry.username || 'system';
    if (entry.userId && !entry.username) {
      const u = await this.getUserById(entry.userId);
      if (u) username = u.username;
    }

    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        id,
        entry.userId || null,
        username,
        entry.action,
        entry.entity,
        entry.entityId || null,
        entry.details || '',
        entry.ipAddress || '127.0.0.1',
      ]
    );
  }

  async logAudit(entry: {
    userId?: string;
    username?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
  }) {
    return this.addAuditLog(entry);
  }

  // ====================================================================
  // DASHBOARD & REPORTS METRICS
  // ====================================================================

  async getDashboardMetrics() {
    const [itemsRes, whRes, invRes, txRes, lowRes] = await Promise.all([
      this.pool.query('SELECT COUNT(*) as count FROM items'),
      this.pool.query('SELECT COUNT(*) as count FROM warehouses WHERE is_active = true'),
      this.pool.query('SELECT COALESCE(SUM(quantity), 0) as total FROM inventories'),
      this.pool.query('SELECT COUNT(*) as count FROM stock_transactions'),
      this.pool.query(`
        SELECT COUNT(*) as count FROM (
          SELECT i.id, i.min_quantity, COALESCE(SUM(inv.quantity), 0) as current_qty
          FROM items i
          LEFT JOIN inventories inv ON inv.item_id = i.id
          WHERE i.min_quantity > 0
          GROUP BY i.id, i.min_quantity
          HAVING COALESCE(SUM(inv.quantity), 0) <= i.min_quantity
        ) as sub
      `),
    ]);

    const recentTx = await this.getTransactions({ limit: 8 });
    const recentAudit = await this.getAuditLogs({ limit: 8 });

    return {
      totalItemsCount: parseInt(itemsRes.rows[0].count, 10),
      totalWarehousesCount: parseInt(whRes.rows[0].count, 10),
      totalInventoryCount: parseInt(invRes.rows[0].total, 10),
      totalTransactionsCount: parseInt(txRes.rows[0].count, 10),
      lowStockItemsCount: parseInt(lowRes.rows[0].count, 10),
      recentTransactions: recentTx,
      recentAuditLogs: recentAudit,
    };
  }

  async getInventoryReport(warehouseId?: string) {
    let query = `
      SELECT i.id as "itemId", i.name as "itemName", i.code as "itemCode",
             i.category as "category", i.brand as "brand", i.model as "model", i.unit as "unit",
             w.name as "warehouseName", w.code as "warehouseCode",
             s.name as "shelfName", s.code as "shelfCode",
             inv.quantity, inv.updated_at as "updatedAt"
      FROM inventories inv
      JOIN items i ON i.id = inv.item_id
      JOIN warehouses w ON w.id = inv.warehouse_id
      JOIN shelves s ON s.id = inv.shelf_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (warehouseId) {
      params.push(warehouseId);
      query += ` AND inv.warehouse_id = $${params.length}`;
    }
    query += ' ORDER BY w.code ASC, s.code ASC, i.name ASC';

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async getStockMovementReport(filters?: {
    startDate?: string;
    endDate?: string;
    type?: TransactionType;
    itemId?: string;
  }) {
    let query = `
      SELECT t.id, t.tracking_code AS "trackingCode", t.type, t.quantity,
             t.reference_no AS "referenceNo", t.notes, t.created_at AS "createdAt",
             i.name AS "itemName", i.code AS "itemCode",
             sw.name AS "sourceWarehouseName", dw.name AS "destWarehouseName",
             ss.name AS "sourceShelfName", ds.name AS "destShelfName",
             u.full_name AS "userFullName"
      FROM stock_transactions t
      JOIN items i ON i.id = t.item_id
      LEFT JOIN warehouses sw ON sw.id = t.source_warehouse_id
      LEFT JOIN warehouses dw ON dw.id = t.dest_warehouse_id
      LEFT JOIN shelves ss ON ss.id = t.source_shelf_id
      LEFT JOIN shelves ds ON ds.id = t.dest_shelf_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.type) {
      params.push(filters.type);
      query += ` AND t.type = $${params.length}`;
    }
    if (filters?.itemId) {
      params.push(filters.itemId);
      query += ` AND t.item_id = $${params.length}`;
    }
    if (filters?.startDate) {
      params.push(filters.startDate);
      query += ` AND t.created_at >= $${params.length}`;
    }
    if (filters?.endDate) {
      params.push(filters.endDate);
      query += ` AND t.created_at <= $${params.length}`;
    }

    query += ' ORDER BY t.created_at DESC';
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  // ====================================================================
  // BACKUP & RESTORE (EXCLUSIVELY EXPORT/IMPORT ON POSTGRESQL)
  // ====================================================================

  async exportBackup() {
    const [roles, users, categories, warehouses, shelves, items, inventories, transactions, transfers, attachments, auditLogs, settings] =
      await Promise.all([
        this.pool.query('SELECT * FROM roles'),
        this.pool.query('SELECT id, username, full_name, role, is_active, created_at, last_login FROM users'),
        this.pool.query('SELECT * FROM categories'),
        this.pool.query('SELECT * FROM warehouses'),
        this.pool.query('SELECT * FROM shelves'),
        this.pool.query('SELECT * FROM items'),
        this.pool.query('SELECT * FROM inventories'),
        this.pool.query('SELECT * FROM stock_transactions'),
        this.pool.query('SELECT * FROM transfers'),
        this.pool.query('SELECT * FROM attachments'),
        this.pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 2000'),
        this.pool.query('SELECT * FROM settings'),
      ]);

    return {
      version: '2.0.0-postgresql',
      exportedAt: new Date().toISOString(),
      source: 'PostgreSQL Central Database (ZobAhan Fire Alarm WMS)',
      data: {
        roles: roles.rows,
        users: users.rows,
        categories: categories.rows,
        warehouses: warehouses.rows,
        shelves: shelves.rows,
        items: items.rows,
        inventories: inventories.rows,
        transactions: transactions.rows,
        transfers: transfers.rows,
        attachments: attachments.rows,
        auditLogs: auditLogs.rows,
        settings: settings.rows,
      },
    };
  }

  async restoreBackup(backupData: any, adminUserId: string, ipAddress?: string): Promise<boolean> {
    const data = backupData.data || backupData;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Categories
      for (const c of data.categories || []) {
        await client.query(
          `INSERT INTO categories (id, name, description, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET name = $2, description = $3`,
          [c.id, c.name, c.description || '', c.created_at || new Date()]
        );
      }

      // 2. Warehouses
      for (const w of data.warehouses || []) {
        await client.query(
          `INSERT INTO warehouses (id, name, code, description, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET name = $2, code = $3, description = $4, is_active = $5`,
          [w.id, w.name, w.code, w.description || '', w.is_active ?? w.isActive ?? true, w.created_at || new Date(), w.updated_at || new Date()]
        );
      }

      // 3. Shelves
      for (const s of data.shelves || []) {
        await client.query(
          `INSERT INTO shelves (id, warehouse_id, name, code, description, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET name = $3, code = $4, description = $5, status = $6`,
          [s.id, s.warehouse_id || s.warehouseId, s.name, s.code, s.description || '', s.status || 'ACTIVE', s.created_at || new Date(), s.updated_at || new Date()]
        );
      }

      // 4. Items
      for (const i of data.items || []) {
        await client.query(
          `INSERT INTO items (id, name, code, category, brand, model, unit, description, image_url, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET name = $2, code = $3, category = $4, brand = $5, model = $6, unit = $7, description = $8, image_url = $9`,
          [i.id, i.name, i.code, i.category, i.brand || '', i.model || '', i.unit || 'عدد', i.description || '', i.image_url || i.imageUrl || null, i.created_at || new Date(), i.updated_at || new Date()]
        );
      }

      // 5. Inventories
      for (const inv of data.inventories || []) {
        await client.query(
          `INSERT INTO inventories (id, item_id, warehouse_id, shelf_id, quantity, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (item_id, warehouse_id, shelf_id) DO UPDATE SET quantity = $5`,
          [inv.id, inv.item_id || inv.itemId, inv.warehouse_id || inv.warehouseId, inv.shelf_id || inv.shelfId, inv.quantity, inv.updated_at || new Date()]
        );
      }

      // 6. Transactions
      for (const t of data.transactions || []) {
        await client.query(
          `INSERT INTO stock_transactions (id, tracking_code, type, item_id, quantity, source_warehouse_id, source_shelf_id, dest_warehouse_id, dest_shelf_id, user_id, reference_no, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [
            t.id,
            t.tracking_code || t.trackingCode || null,
            t.type,
            t.item_id || t.itemId,
            t.quantity,
            t.source_warehouse_id || t.sourceWarehouseId || null,
            t.source_shelf_id || t.sourceShelfId || null,
            t.dest_warehouse_id || t.destWarehouseId || null,
            t.dest_shelf_id || t.destShelfId || null,
            t.user_id || t.userId || null,
            t.reference_no || t.referenceNo || null,
            t.notes || null,
            t.created_at || new Date(),
          ]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, 'admin', 'RESTORE_BACKUP', 'System', 'SYSTEM', 'بازیابی پایگاه داده از روی فایل پشتیبان در PostgreSQL', $3, NOW())`,
        [crypto.randomUUID(), adminUserId, ipAddress || '127.0.0.1']
      );

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async migrateFromLocal(localData: any, adminUserId: string, ipAddress?: string) {
    if (!localData) {
      throw new Error('داده‌های محلی ارسال نشده است.');
    }

    const client = await this.pool.connect();
    let importedWarehouses = 0;
    let importedShelves = 0;
    let importedItems = 0;
    let importedInventories = 0;
    let importedTransactions = 0;

    try {
      await client.query('BEGIN');

      // 1. Warehouses
      for (const w of localData.warehouses || []) {
        if (!w.id || !w.name || !w.code) continue;
        const res = await client.query(
          `INSERT INTO warehouses (id, name, code, description, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())
           ON CONFLICT (code) DO UPDATE SET name = $2, description = $4
           RETURNING id`,
          [w.id, w.name.trim(), w.code.trim().toUpperCase(), w.description || '']
        );
        if (res.rowCount && res.rowCount > 0) importedWarehouses++;
      }

      // 2. Shelves
      for (const s of localData.shelves || []) {
        if (!s.id || !s.warehouseId || !s.code || !s.name) continue;
        const whCheck = await client.query('SELECT id FROM warehouses WHERE id = $1', [s.warehouseId]);
        if (whCheck.rows.length === 0) continue;

        const res = await client.query(
          `INSERT INTO shelves (id, warehouse_id, name, code, description, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())
           ON CONFLICT (warehouse_id, code) DO UPDATE SET name = $3, description = $5
           RETURNING id`,
          [s.id, s.warehouseId, s.name.trim(), s.code.trim().toUpperCase(), s.description || '']
        );
        if (res.rowCount && res.rowCount > 0) importedShelves++;
      }

      // 3. Items
      for (const i of localData.items || []) {
        if (!i.id || !i.name || !i.code) continue;
        const res = await client.query(
          `INSERT INTO items (id, name, code, category, brand, model, unit, description, image_url, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
           ON CONFLICT (code) DO UPDATE SET name = $2, category = $4, brand = $5, model = $6, unit = $7, description = $8, image_url = $9
           RETURNING id`,
          [
            i.id,
            i.name.trim(),
            i.code.trim().toUpperCase(),
            i.category || 'تجهیزات اعلام حریق',
            i.brand || '',
            i.model || '',
            i.unit || 'عدد',
            i.description || '',
            i.imageUrl || null,
          ]
        );
        if (res.rowCount && res.rowCount > 0) importedItems++;
      }

      // 4. Inventories
      for (const inv of localData.inventories || []) {
        if (!inv.itemId || !inv.warehouseId || !inv.shelfId) continue;
        const validItem = await client.query('SELECT id FROM items WHERE id = $1', [inv.itemId]);
        const validWh = await client.query('SELECT id FROM warehouses WHERE id = $1', [inv.warehouseId]);
        const validShelf = await client.query('SELECT id FROM shelves WHERE id = $1', [inv.shelfId]);

        if (validItem.rows.length > 0 && validWh.rows.length > 0 && validShelf.rows.length > 0) {
          await client.query(
            `INSERT INTO inventories (id, item_id, warehouse_id, shelf_id, quantity, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (item_id, warehouse_id, shelf_id) DO UPDATE SET quantity = $5`,
            [inv.id || crypto.randomUUID(), inv.itemId, inv.warehouseId, inv.shelfId, inv.quantity || 0]
          );
          importedInventories++;
        }
      }

      // 5. Stock Transactions
      for (const t of localData.transactions || []) {
        if (!t.id || !t.itemId || !t.type) continue;
        const validItem = await client.query('SELECT id FROM items WHERE id = $1', [t.itemId]);
        if (validItem.rows.length === 0) continue;

        await client.query(
          `INSERT INTO stock_transactions
            (id, tracking_code, type, item_id, quantity, source_warehouse_id, source_shelf_id,
             dest_warehouse_id, dest_shelf_id, user_id, reference_no, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [
            t.id,
            t.tracking_code || t.trackingCode || 'TRX-MIG',
            t.type,
            t.itemId,
            t.quantity || 1,
            t.sourceWarehouseId || null,
            t.sourceShelfId || null,
            t.destWarehouseId || null,
            t.destShelfId || null,
            t.userId || adminUserId,
            t.referenceNo || null,
            t.notes || null,
            t.createdAt || new Date().toISOString(),
          ]
        );
        importedTransactions++;
      }

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, 'admin', 'MIGRATE_FROM_LOCAL', 'System', 'SYSTEM', $3, $4, NOW())`,
        [
          crypto.randomUUID(),
          adminUserId,
          `انتقال داده‌های پایگاه محلی به سرور مرکزی PostgreSQL: ${importedWarehouses} انبار، ${importedShelves} قفسه، ${importedItems} کالا، ${importedInventories} رکورد موجودی و ${importedTransactions} تراکنش`,
          ipAddress || '127.0.0.1',
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        importedWarehouses,
        importedShelves,
        importedItems,
        importedInventories,
        importedTransactions,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // ====================================================================
  // ATTACHMENTS & SETTINGS
  // ====================================================================

  async getAttachments(itemId?: string): Promise<Attachment[]> {
    let query = `
      SELECT id, item_id AS "itemId", filename, original_name AS "originalName",
             mime_type AS "mimeType", size, storage_key AS "storageKey",
             url, uploaded_by_id AS "uploadedById", created_at AS "createdAt"
      FROM attachments
    `;
    const params: any[] = [];
    if (itemId) {
      query += ' WHERE item_id = $1';
      params.push(itemId);
    }
    query += ' ORDER BY created_at DESC';

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async createAttachment(data: {
    itemId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    storageKey: string;
    url: string;
    uploadedById?: string;
  }): Promise<Attachment> {
    const id = 'att-' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const res = await this.pool.query(
      `INSERT INTO attachments (id, item_id, filename, original_name, mime_type, size, storage_key, url, uploaded_by_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, item_id AS "itemId", filename, original_name AS "originalName",
                 mime_type AS "mimeType", size, storage_key AS "storageKey",
                 url, uploaded_by_id AS "uploadedById", created_at AS "createdAt"`,
      [
        id,
        data.itemId,
        data.filename,
        data.originalName,
        data.mimeType,
        data.size,
        data.storageKey,
        data.url,
        data.uploadedById || null,
        now,
      ]
    );

    return res.rows[0];
  }

  async addAttachment(data: {
    itemId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    storageKey: string;
    url: string;
    uploadedById?: string;
  }): Promise<Attachment> {
    return this.createAttachment(data);
  }

  async getAttachmentById(id: string): Promise<Attachment | null> {
    const res = await this.pool.query(
      `SELECT id, item_id AS "itemId", filename, original_name AS "originalName",
              mime_type AS "mimeType", size, storage_key AS "storageKey",
              url, uploaded_by_id AS "uploadedById", created_at AS "createdAt"
       FROM attachments
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async deleteAttachment(id: string): Promise<boolean> {
    await this.pool.query('DELETE FROM attachments WHERE id = $1', [id]);
    return true;
  }

  async transferStock(params: {
    itemId: string;
    sourceWarehouseId: string;
    sourceShelfId: string;
    destWarehouseId: string;
    destShelfId: string;
    quantity: number;
    userId: string;
    referenceNo?: string;
    notes?: string;
    ipAddress?: string;
  }) {
    return this.transfer(params);
  }

  async correctiveAdjustment(params: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    newTargetQuantity: number;
    userId: string;
    reason: string;
    ipAddress?: string;
  }) {
    return this.adjustInventory(params);
  }

  async getSettings(): Promise<Record<string, any>> {
    const res = await this.pool.query('SELECT key, value FROM settings');
    const settings: Record<string, any> = {};
    for (const row of res.rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }

  async updateSetting(key: string, value: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  }
}

// Instantiate PostgreSQL database service
export const db = new PostgresDatabaseService();
export const isPostgres = () => true;
export default db;
