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
} from '../types.js';
import { runMigrations } from './migrator.js';

export class PostgresDatabaseService {
  private pool: Pool;
  private isInitialized = false;

  constructor(connectionString: string) {
    const isSslNeeded =
      process.env.DATABASE_SSL === 'true' ||
      !connectionString.includes('localhost') &&
      !connectionString.includes('127.0.0.1');

    this.pool = new Pool({
      connectionString,
      ssl: isSslNeeded ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected pool error on idle client:', err);
    });
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      console.log('[PostgreSQL] Connecting to central PostgreSQL database...');
      await runMigrations(this.pool);
      this.isInitialized = true;
      console.log('[PostgreSQL] Database initialized and verified.');
    } catch (err) {
      console.error('[PostgreSQL] Initialization error:', err);
      throw err;
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  // ==========================================
  // USERS OPERATIONS
  // ==========================================

  async getUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    const res = await this.pool.query(
      `SELECT id, username, full_name AS "fullName", role, is_active AS "isActive",
              created_at AS "createdAt", last_login AS "lastLogin"
       FROM users
       ORDER BY created_at ASC`
    );
    return res.rows;
  }

  async getUserById(id: string): Promise<User | null> {
    const res = await this.pool.query(
      `SELECT id, username, full_name AS "fullName", password_hash AS "passwordHash",
              role, is_active AS "isActive", created_at AS "createdAt", last_login AS "lastLogin"
       FROM users
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const res = await this.pool.query(
      `SELECT id, username, full_name AS "fullName", password_hash AS "passwordHash",
              role, is_active AS "isActive", created_at AS "createdAt", last_login AS "lastLogin"
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
      throw new Error('نام کاربری وارد شده تکراری است.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const res = await this.pool.query(
      `INSERT INTO users (id, username, full_name, password_hash, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING id, username, full_name AS "fullName", role, is_active AS "isActive",
                 created_at AS "createdAt", last_login AS "lastLogin"`,
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
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(data.password, salt);
    }

    const fullName = data.fullName !== undefined ? data.fullName.trim() : user.fullName;
    const role = data.role !== undefined ? data.role : user.role;
    const isActive = data.isActive !== undefined ? data.isActive : user.isActive;

    const res = await this.pool.query(
      `UPDATE users
       SET full_name = $1, role = $2, is_active = $3, password_hash = $4
       WHERE id = $5
       RETURNING id, username, full_name AS "fullName", role, is_active AS "isActive",
                 created_at AS "createdAt", last_login AS "lastLogin"`,
      [fullName, role, isActive, passwordHash, id]
    );

    return res.rows[0];
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [id]
    );
  }

  // ==========================================
  // WAREHOUSES OPERATIONS
  // ==========================================

  async getWarehouses(): Promise<Warehouse[]> {
    const res = await this.pool.query(
      `SELECT w.id, w.name, w.code, w.description, w.is_active AS "isActive",
              w.created_at AS "createdAt", w.updated_at AS "updatedAt",
              COUNT(s.id)::int AS "shelvesCount"
       FROM warehouses w
       LEFT JOIN shelves s ON s.warehouse_id = w.id
       GROUP BY w.id
       ORDER BY w.name ASC`
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
    const existing = await this.pool.query(
      'SELECT id FROM warehouses WHERE UPPER(code) = $1',
      [code]
    );
    if (existing.rows.length > 0) {
      throw new Error('کد انبار تکراری است.');
    }

    const id = crypto.randomUUID();
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
    const current = await this.getWarehouseById(id);
    if (!current) throw new Error('انبار یافت نشد.');

    let code = current.code;
    if (data.code) {
      code = data.code.trim().toUpperCase();
      const existing = await this.pool.query(
        'SELECT id FROM warehouses WHERE UPPER(code) = $1 AND id != $2',
        [code, id]
      );
      if (existing.rows.length > 0) {
        throw new Error('کد انبار تکراری است.');
      }
    }

    const name = data.name !== undefined ? data.name.trim() : current.name;
    const description = data.description !== undefined ? data.description.trim() : current.description;
    const isActive = data.isActive !== undefined ? data.isActive : current.isActive;

    const res = await this.pool.query(
      `UPDATE warehouses
       SET name = $1, code = $2, description = $3, is_active = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, code, description, is_active AS "isActive",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, code, description, isActive, id]
    );
    return res.rows[0];
  }

  async deleteWarehouse(id: string): Promise<Warehouse> {
    // Check if there is active inventory
    const activeInv = await this.pool.query(
      'SELECT SUM(quantity)::int AS total FROM inventories WHERE warehouse_id = $1 AND quantity > 0',
      [id]
    );
    const total = activeInv.rows[0]?.total || 0;
    if (total > 0) {
      throw new Error(
        `امکان حذف انبار وجود ندارد زیرا هنوز ${total} عدد کالا در قفسه‌های آن موجود است. ابتدا موجودی را خارج یا منتقل فرمایید.`
      );
    }

    const current = await this.getWarehouseById(id);
    if (!current) throw new Error('انبار یافت نشد.');

    await this.pool.query('DELETE FROM warehouses WHERE id = $1', [id]);
    return current;
  }

  // ==========================================
  // SHELVES OPERATIONS
  // ==========================================

  async getShelves(warehouseId?: string): Promise<Shelf[]> {
    let query = `
      SELECT s.id, s.name, s.code, s.description, s.status,
             s.warehouse_id AS "warehouseId",
             s.created_at AS "createdAt", s.updated_at AS "updatedAt",
             w.name AS "warehouseName", w.code AS "warehouseCode"
      FROM shelves s
      JOIN warehouses w ON w.id = s.warehouse_id
    `;
    const params: any[] = [];
    if (warehouseId) {
      query += ' WHERE s.warehouse_id = $1';
      params.push(warehouseId);
    }
    query += ' ORDER BY s.name ASC';

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async getShelfById(id: string): Promise<Shelf | null> {
    const res = await this.pool.query(
      `SELECT s.id, s.name, s.code, s.description, s.status,
              s.warehouse_id AS "warehouseId",
              s.created_at AS "createdAt", s.updated_at AS "updatedAt",
              w.name AS "warehouseName", w.code AS "warehouseCode"
       FROM shelves s
       JOIN warehouses w ON w.id = s.warehouse_id
       WHERE s.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async createShelf(data: {
    name: string;
    code: string;
    warehouseId: string;
    description?: string;
  }): Promise<Shelf> {
    const wh = await this.getWarehouseById(data.warehouseId);
    if (!wh) throw new Error('انبار مشخص‌شده معتبر نیست.');

    const code = data.code.trim().toUpperCase();
    const existing = await this.pool.query(
      'SELECT id FROM shelves WHERE warehouse_id = $1 AND UPPER(code) = $2',
      [data.warehouseId, code]
    );
    if (existing.rows.length > 0) {
      throw new Error('کد قفسه در این انبار تکراری است.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await this.pool.query(
      `INSERT INTO shelves (id, warehouse_id, name, code, description, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $6)
       RETURNING id, warehouse_id AS "warehouseId", name, code, description, status,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, data.warehouseId, data.name.trim(), code, data.description?.trim() || '', now]
    );

    return {
      ...res.rows[0],
      warehouseName: wh.name,
      warehouseCode: wh.code,
    };
  }

  async updateShelf(
    id: string,
    data: { name?: string; code?: string; description?: string; status?: 'ACTIVE' | 'INACTIVE'; warehouseId?: string }
  ): Promise<Shelf> {
    const current = await this.getShelfById(id);
    if (!current) throw new Error('قفسه یافت نشد.');

    const warehouseId = data.warehouseId || current.warehouseId;
    let code = current.code;
    if (data.code) {
      code = data.code.trim().toUpperCase();
      const existing = await this.pool.query(
        'SELECT id FROM shelves WHERE warehouse_id = $1 AND UPPER(code) = $2 AND id != $3',
        [warehouseId, code, id]
      );
      if (existing.rows.length > 0) {
        throw new Error('کد قفسه در این انبار تکراری است.');
      }
    }

    const name = data.name !== undefined ? data.name.trim() : current.name;
    const description = data.description !== undefined ? data.description.trim() : current.description;
    const status = data.status !== undefined ? data.status : current.status;

    const res = await this.pool.query(
      `UPDATE shelves
       SET warehouse_id = $1, name = $2, code = $3, description = $4, status = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, warehouse_id AS "warehouseId", name, code, description, status,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [warehouseId, name, code, description, status, id]
    );

    const wh = await this.getWarehouseById(warehouseId);
    return {
      ...res.rows[0],
      warehouseName: wh?.name || '',
      warehouseCode: wh?.code || '',
    };
  }

  async deleteShelf(id: string): Promise<Shelf> {
    const activeInv = await this.pool.query(
      'SELECT SUM(quantity)::int AS total FROM inventories WHERE shelf_id = $1 AND quantity > 0',
      [id]
    );
    const total = activeInv.rows[0]?.total || 0;
    if (total > 0) {
      throw new Error(`امکان حذف قفسه وجود ندارد؛ هنوز ${total} عدد کالا در آن موجود است.`);
    }

    const current = await this.getShelfById(id);
    if (!current) throw new Error('قفسه یافت نشد.');

    await this.pool.query('DELETE FROM shelves WHERE id = $1', [id]);
    return current;
  }

  // ==========================================
  // ITEMS / PRODUCTS OPERATIONS
  // ==========================================

  async getItems(): Promise<Item[]> {
    const res = await this.pool.query(
      `SELECT i.id, i.name, i.code, i.category, i.brand, i.model, i.unit,
              i.description, i.image_url AS "imageUrl",
              i.created_at AS "createdAt", i.updated_at AS "updatedAt",
              COALESCE(SUM(inv.quantity), 0)::int AS "totalStock"
       FROM items i
       LEFT JOIN inventories inv ON inv.item_id = i.id
       GROUP BY i.id
       ORDER BY i.name ASC`
    );

    // Get attachments for all items
    const attRes = await this.pool.query(
      `SELECT id, item_id AS "itemId", filename, original_name AS "originalName",
              mime_type AS "mimeType", size, storage_key AS "storageKey", url,
              uploaded_by_id AS "uploadedById", created_at AS "createdAt"
       FROM attachments`
    );

    const attMap = new Map<string, Attachment[]>();
    for (const att of attRes.rows) {
      if (!attMap.has(att.itemId)) attMap.set(att.itemId, []);
      attMap.get(att.itemId)!.push(att);
    }

    return res.rows.map((item) => ({
      ...item,
      attachments: attMap.get(item.id) || [],
    }));
  }

  async getItemById(id: string): Promise<Item | null> {
    const res = await this.pool.query(
      `SELECT i.id, i.name, i.code, i.category, i.brand, i.model, i.unit,
              i.description, i.image_url AS "imageUrl",
              i.created_at AS "createdAt", i.updated_at AS "updatedAt",
              COALESCE(SUM(inv.quantity), 0)::int AS "totalStock"
       FROM items i
       LEFT JOIN inventories inv ON inv.item_id = i.id
       WHERE i.id = $1
       GROUP BY i.id`,
      [id]
    );

    if (res.rows.length === 0) return null;
    const item = res.rows[0];

    const attRes = await this.pool.query(
      `SELECT id, item_id AS "itemId", filename, original_name AS "originalName",
              mime_type AS "mimeType", size, storage_key AS "storageKey", url,
              uploaded_by_id AS "uploadedById", created_at AS "createdAt"
       FROM attachments
       WHERE item_id = $1`,
      [id]
    );
    item.attachments = attRes.rows;
    return item;
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
  }): Promise<Item> {
    const code = data.code.trim().toUpperCase();
    const existing = await this.pool.query(
      'SELECT id FROM items WHERE UPPER(code) = $1',
      [code]
    );
    if (existing.rows.length > 0) {
      throw new Error('کد کالای وارد شده تکراری است.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await this.pool.query(
      `INSERT INTO items (id, name, code, category, brand, model, unit, description, image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id, name, code, category, brand, model, unit, description,
                 image_url AS "imageUrl", created_at AS "createdAt", updated_at AS "updatedAt"`,
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
        now,
      ]
    );

    return {
      ...res.rows[0],
      totalStock: 0,
      attachments: [],
    };
  }

  async updateItem(id: string, data: Partial<Item>): Promise<Item> {
    const current = await this.getItemById(id);
    if (!current) throw new Error('کالای مورد نظر یافت نشد.');

    let code = current.code;
    if (data.code) {
      code = data.code.trim().toUpperCase();
      const existing = await this.pool.query(
        'SELECT id FROM items WHERE UPPER(code) = $1 AND id != $2',
        [code, id]
      );
      if (existing.rows.length > 0) {
        throw new Error('کد کالای وارد شده تکراری است.');
      }
    }

    const name = data.name !== undefined ? data.name.trim() : current.name;
    const category = data.category !== undefined ? data.category.trim() : current.category;
    const brand = data.brand !== undefined ? data.brand.trim() : current.brand;
    const model = data.model !== undefined ? data.model.trim() : current.model;
    const unit = data.unit !== undefined ? data.unit.trim() : current.unit;
    const description = data.description !== undefined ? data.description.trim() : current.description;
    const imageUrl = data.imageUrl !== undefined ? data.imageUrl : current.imageUrl;

    const res = await this.pool.query(
      `UPDATE items
       SET name = $1, code = $2, category = $3, brand = $4, model = $5,
           unit = $6, description = $7, image_url = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING id, name, code, category, brand, model, unit, description,
                 image_url AS "imageUrl", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, code, category, brand, model, unit, description, imageUrl, id]
    );

    return {
      ...res.rows[0],
      totalStock: current.totalStock,
      attachments: current.attachments,
    };
  }

  async deleteItem(id: string): Promise<Item> {
    const activeInv = await this.pool.query(
      'SELECT SUM(quantity)::int AS total FROM inventories WHERE item_id = $1 AND quantity > 0',
      [id]
    );
    const total = activeInv.rows[0]?.total || 0;
    if (total > 0) {
      throw new Error(
        `امکان حذف این کالا وجود ندارد زیرا دارای موجودی فعال (${total} عدد) در انبار است. ابتدا موجودی آن را خارج نمایید.`
      );
    }

    const current = await this.getItemById(id);
    if (!current) throw new Error('کالای مورد نظر یافت نشد.');

    await this.pool.query('DELETE FROM items WHERE id = $1', [id]);
    return current;
  }

  // ==========================================
  // ATTACHMENTS
  // ==========================================

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
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await this.pool.query(
      `INSERT INTO attachments (id, item_id, filename, original_name, mime_type, size, storage_key, url, uploaded_by_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, item_id AS "itemId", filename, original_name AS "originalName",
                 mime_type AS "mimeType", size, storage_key AS "storageKey", url,
                 uploaded_by_id AS "uploadedById", created_at AS "createdAt"`,
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

  async getAttachmentById(id: string): Promise<Attachment | null> {
    const res = await this.pool.query(
      `SELECT id, item_id AS "itemId", filename, original_name AS "originalName",
              mime_type AS "mimeType", size, storage_key AS "storageKey", url,
              uploaded_by_id AS "uploadedById", created_at AS "createdAt"
       FROM attachments
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async deleteAttachment(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM attachments WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ==========================================
  // INVENTORY & STOCK OPERATIONS (ACID + ROW LOCKS)
  // ==========================================

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

  // Generate next document number starting from 1001
  async getNextDocNumber(client?: any): Promise<string> {
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
    } catch (err) {
      console.warn('[PostgreSQL] Sequence query error, falling back to max reference_no:', err);
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
    } catch (err) {
      return '1001';
    }
  }

  // Stock In (ورود کالا) - Transaction safe with row lock
  async stockIn(params: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    userId: string;
    referenceNo?: string;
    notes?: string;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const itemRes = await client.query('SELECT name, code FROM items WHERE id = $1', [params.itemId]);
      if (itemRes.rows.length === 0) throw new Error('کالا یافت نشد.');
      const item = itemRes.rows[0];

      // Lock row if exists
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
          `UPDATE inventories SET quantity = $1, updated_at = NOW()
           WHERE id = $2`,
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
      const docNo = await this.getNextDocNumber(client);
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

      // Audit log
      const userRes = await client.query('SELECT username FROM users WHERE id = $1', [params.userId]);
      const username = userRes.rows[0]?.username || 'system';

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, 'STOCK_IN', 'Item', $4, $5, '127.0.0.1', NOW())`,
        [
          crypto.randomUUID(),
          params.userId,
          username,
          params.itemId,
          `ثبت ورود ${params.quantity} عدد کالای «${item.name}» به انبار مرکزی`,
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

  // Stock Out (خروج کالا) - Transaction safe with FOR UPDATE lock preventing negative stock
  async stockOut(params: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    userId: string;
    referenceNo?: string;
    notes?: string;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const itemRes = await client.query('SELECT name, code FROM items WHERE id = $1', [params.itemId]);
      if (itemRes.rows.length === 0) throw new Error('کالا یافت نشد.');
      const item = itemRes.rows[0];

      // Lock row to prevent race condition
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

      // Record transaction
      const txId = crypto.randomUUID();
      const trackingCode = 'OUT-' + Date.now().toString().slice(-6);
      const docNo = await this.getNextDocNumber(client);
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
         VALUES ($1, $2, $3, 'STOCK_OUT', 'Item', $4, $5, '127.0.0.1', NOW())`,
        [
          crypto.randomUUID(),
          params.userId,
          username,
          params.itemId,
          `ثبت خروج ${params.quantity} عدد کالای «${item.name}» (حواله: ${params.referenceNo || 'ندارد'})`,
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

  // Stock Transfer (انتقال بین انبارها/قفسه‌ها) - Completely Atomic
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
  }) {
    if (params.sourceWarehouseId === params.destWarehouseId && params.sourceShelfId === params.destShelfId) {
      throw new Error('انبار و قفسه مبدا و مقصد نمی‌توانند کاملاً یکسان باشند.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const itemRes = await client.query('SELECT name, code FROM items WHERE id = $1', [params.itemId]);
      if (itemRes.rows.length === 0) throw new Error('کالا یافت نشد.');
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

      // 3. Record transfer transaction
      const txId = crypto.randomUUID();
      const trackingCode = 'TRF-' + Date.now().toString().slice(-6);
      const docNo = await this.getNextDocNumber(client);
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

      // 4. Audit log
      const userRes = await client.query('SELECT username FROM users WHERE id = $1', [params.userId]);
      const username = userRes.rows[0]?.username || 'system';

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, 'TRANSFER', 'Item', $4, $5, '127.0.0.1', NOW())`,
        [
          crypto.randomUUID(),
          params.userId,
          username,
          params.itemId,
          `انتقال ${params.quantity} عدد کالای «${item.name}» بین قفسه‌ها`,
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

  // Adjust Inventory (اصلاح موجودی)
  async adjustInventory(params: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    newTargetQuantity: number;
    userId: string;
    reason: string;
  }) {
    if (params.newTargetQuantity < 0) {
      throw new Error('موجودی نمی‌تواند منفی باشد.');
    }
    if (!params.reason || params.reason.trim().length < 5) {
      throw new Error('علت اصلاح موجودی و شماره صورتجلسه الزامی است.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const itemRes = await client.query('SELECT name FROM items WHERE id = $1', [params.itemId]);
      if (itemRes.rows.length === 0) throw new Error('کالا یافت نشد.');
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

      const difference = params.newTargetQuantity - oldQuantity;
      const txId = crypto.randomUUID();
      const docNo = await this.getNextDocNumber(client);

      await client.query(
        `INSERT INTO stock_transactions
          (id, tracking_code, type, item_id, quantity,
           source_warehouse_id, source_shelf_id, dest_warehouse_id, dest_shelf_id,
           user_id, reference_no, notes, created_at)
         VALUES ($1, $2, 'ADJUSTMENT', $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          txId,
          'ADJ-' + Date.now().toString().slice(-6),
          params.itemId,
          Math.abs(difference),
          difference < 0 ? params.warehouseId : null,
          difference < 0 ? params.shelfId : null,
          difference > 0 ? params.warehouseId : null,
          difference > 0 ? params.shelfId : null,
          params.userId,
          docNo,
          `تراکنش اصلاحی موجودی: از ${oldQuantity} به ${params.newTargetQuantity}. علت: ${params.reason.trim()}`,
        ]
      );

      const userRes = await client.query('SELECT username FROM users WHERE id = $1', [params.userId]);
      const username = userRes.rows[0]?.username || 'system';

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, 'ADJUSTMENT', 'Item', $4, $5, '127.0.0.1', NOW())`,
        [
          crypto.randomUUID(),
          params.userId,
          username,
          params.itemId,
          `اصلاح دستی موجودی کالای «${item.name}» از ${oldQuantity} به ${params.newTargetQuantity}. علت: ${params.reason}`,
        ]
      );

      await client.query('COMMIT');

      const fullTx = await this.getTransactionById(txId);
      return {
        transaction: fullTx,
        difference,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // Aliases for compatibility with stock.routes.ts
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
  }) {
    return this.adjustInventory(params);
  }

  // ==========================================
  // TRANSACTIONS & AUDIT LOGS QUERYING
  // ==========================================

  private async getTransactionById(id: string) {
    const list = await this.getTransactions({ limit: 1 });
    const res = await this.pool.query(
      `SELECT t.id, t.type, t.item_id AS "itemId", t.quantity,
              t.source_warehouse_id AS "sourceWarehouseId", t.source_shelf_id AS "sourceShelfId",
              t.dest_warehouse_id AS "destWarehouseId", t.dest_shelf_id AS "destShelfId",
              t.user_id AS "userId", t.notes, t.reference_no AS "referenceNo",
              t.created_at AS "createdAt",
              i.name AS "itemName", i.code AS "itemCode", i.brand AS "itemBrand",
              i.model AS "itemModel", i.unit AS "itemUnit",
              u.full_name AS "userName",
              sw.name AS "sourceWarehouseName", sw.code AS "sourceWarehouseCode",
              ss.name AS "sourceShelfName", ss.code AS "sourceShelfCode",
              dw.name AS "destWarehouseName", dw.code AS "destWarehouseCode",
              ds.name AS "destShelfName", ds.code AS "destShelfCode"
       FROM stock_transactions t
       JOIN items i ON i.id = t.item_id
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN warehouses sw ON sw.id = t.source_warehouse_id
       LEFT JOIN shelves ss ON ss.id = t.source_shelf_id
       LEFT JOIN warehouses dw ON dw.id = t.dest_warehouse_id
       LEFT JOIN shelves ds ON ds.id = t.dest_shelf_id
       WHERE t.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async getTransactions(filters?: {
    itemId?: string;
    type?: TransactionType;
    warehouseId?: string;
    shelfId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    let query = `
      SELECT t.id, t.type, t.item_id AS "itemId", t.quantity,
              t.source_warehouse_id AS "sourceWarehouseId", t.source_shelf_id AS "sourceShelfId",
              t.dest_warehouse_id AS "destWarehouseId", t.dest_shelf_id AS "destShelfId",
              t.user_id AS "userId", t.notes, t.reference_no AS "referenceNo",
              t.created_at AS "createdAt",
              i.name AS "itemName", i.code AS "itemCode", i.brand AS "itemBrand",
              i.model AS "itemModel", i.unit AS "itemUnit",
              u.full_name AS "userName",
              sw.name AS "sourceWarehouseName", sw.code AS "sourceWarehouseCode",
              ss.name AS "sourceShelfName", ss.code AS "sourceShelfCode",
              dw.name AS "destWarehouseName", dw.code AS "destWarehouseCode",
              ds.name AS "destShelfName", ds.code AS "destShelfCode"
       FROM stock_transactions t
       JOIN items i ON i.id = t.item_id
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN warehouses sw ON sw.id = t.source_warehouse_id
       LEFT JOIN shelves ss ON ss.id = t.source_shelf_id
       LEFT JOIN warehouses dw ON dw.id = t.dest_warehouse_id
       LEFT JOIN shelves ds ON ds.id = t.dest_shelf_id
       WHERE 1=1
    `;

    const params: any[] = [];
    if (filters?.itemId) {
      params.push(filters.itemId);
      query += ` AND t.item_id = $${params.length}`;
    }
    if (filters?.type) {
      params.push(filters.type);
      query += ` AND t.type = $${params.length}`;
    }
    if (filters?.userId) {
      params.push(filters.userId);
      query += ` AND t.user_id = $${params.length}`;
    }
    if (filters?.warehouseId) {
      params.push(filters.warehouseId);
      query += ` AND (t.source_warehouse_id = $${params.length} OR t.dest_warehouse_id = $${params.length})`;
    }
    if (filters?.shelfId) {
      params.push(filters.shelfId);
      query += ` AND (t.source_shelf_id = $${params.length} OR t.dest_shelf_id = $${params.length})`;
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

    if (filters?.limit && filters.limit > 0) {
      params.push(filters.limit);
      query += ` LIMIT $${params.length}`;
    }

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async logAudit(entry: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
  }) {
    let username = 'system';
    if (entry.userId) {
      const userRes = await this.pool.query('SELECT username FROM users WHERE id = $1', [entry.userId]);
      if (userRes.rows.length > 0) {
        username = userRes.rows[0].username;
      }
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
        entry.details || null,
        entry.ipAddress || '127.0.0.1',
      ]
    );
  }

  async getAuditLogs(filters?: {
    action?: string;
    entity?: string;
    userId?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    let query = `
      SELECT id, user_id AS "userId", username, action, entity,
             entity_id AS "entityId", details, ip_address AS "ipAddress",
             created_at AS "createdAt"
      FROM audit_logs
      WHERE 1=1
    `;
    const params: any[] = [];
    if (filters?.action) {
      params.push(filters.action);
      query += ` AND action = $${params.length}`;
    }
    if (filters?.entity) {
      params.push(filters.entity);
      query += ` AND entity = $${params.length}`;
    }
    if (filters?.userId) {
      params.push(filters.userId);
      query += ` AND user_id = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 100;
    params.push(limit);
    query += ` LIMIT $${params.length}`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  // ==========================================
  // DASHBOARD SUMMARY METRICS
  // ==========================================

  async getDashboardMetrics() {
    const countsRes = await this.pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM warehouses) AS "totalWarehouses",
        (SELECT COUNT(*)::int FROM shelves) AS "totalShelves",
        (SELECT COUNT(*)::int FROM items) AS "totalItems",
        (SELECT COUNT(*)::int FROM users) AS "totalUsers",
        (SELECT COALESCE(SUM(quantity), 0)::int FROM inventories) AS "totalInventoryCount"
    `);

    const latestTx = await this.getTransactions({ limit: 10 });
    const latestStockIn = latestTx.find((t) => t.type === 'STOCK_IN') || null;
    const latestStockOut = latestTx.find((t) => t.type === 'STOCK_OUT') || null;
    const latestTransfer = latestTx.find((t) => t.type === 'TRANSFER') || null;

    return {
      ...countsRes.rows[0],
      latestStockIn,
      latestStockOut,
      latestTransfer,
    };
  }

  // ==========================================
  // BACKUP, RESTORE & LOCAL-TO-POSTGRES MIGRATION
  // ==========================================

  async exportBackup() {
    const [users, warehouses, shelves, items, inventories, transactions, auditLogs, attachments] =
      await Promise.all([
        this.pool.query('SELECT * FROM users').then((r) => r.rows),
        this.pool.query('SELECT * FROM warehouses').then((r) => r.rows),
        this.pool.query('SELECT * FROM shelves').then((r) => r.rows),
        this.pool.query('SELECT * FROM items').then((r) => r.rows),
        this.pool.query('SELECT * FROM inventories').then((r) => r.rows),
        this.pool.query('SELECT * FROM stock_transactions').then((r) => r.rows),
        this.pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5000').then((r) => r.rows),
        this.pool.query('SELECT * FROM attachments').then((r) => r.rows),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      version: '2.0.0-postgresql',
      appName: 'نرم‌افزار انبارداری واحد اعلام حریق ذوب‌آهن اصفهان',
      designer: 'دکتر احسان ابوالقاسمی',
      database: 'PostgreSQL',
      data: {
        users,
        warehouses,
        shelves,
        items,
        inventories,
        transactions,
        auditLogs,
        attachments,
      },
    };
  }

  async restoreBackup(backupData: any, adminUserId: string) {
    if (!backupData || !backupData.data) {
      throw new Error('فرمت فایل پشتیبان نامعتبر است.');
    }
    const data = backupData.data;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Clear dependent tables
      await client.query('DELETE FROM stock_transactions');
      await client.query('DELETE FROM inventories');
      await client.query('DELETE FROM attachments');
      await client.query('DELETE FROM items');
      await client.query('DELETE FROM shelves');
      await client.query('DELETE FROM warehouses');

      // Insert warehouses
      for (const w of data.warehouses || []) {
        await client.query(
          `INSERT INTO warehouses (id, name, code, description, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET name = $2, code = $3, description = $4, is_active = $5`,
          [w.id, w.name, w.code, w.description || '', w.is_active ?? w.isActive ?? true, w.created_at || new Date(), w.updated_at || new Date()]
        );
      }

      // Insert shelves
      for (const s of data.shelves || []) {
        await client.query(
          `INSERT INTO shelves (id, warehouse_id, name, code, description, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET name = $3, code = $4, description = $5, status = $6`,
          [s.id, s.warehouse_id || s.warehouseId, s.name, s.code, s.description || '', s.status || 'ACTIVE', s.created_at || new Date(), s.updated_at || new Date()]
        );
      }

      // Insert items
      for (const i of data.items || []) {
        await client.query(
          `INSERT INTO items (id, name, code, category, brand, model, unit, description, image_url, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET name = $2, code = $3, category = $4, brand = $5, model = $6, unit = $7, description = $8, image_url = $9`,
          [i.id, i.name, i.code, i.category, i.brand || '', i.model || '', i.unit || 'عدد', i.description || '', i.image_url || i.imageUrl || null, i.created_at || new Date(), i.updated_at || new Date()]
        );
      }

      // Insert inventories
      for (const inv of data.inventories || []) {
        await client.query(
          `INSERT INTO inventories (id, item_id, warehouse_id, shelf_id, quantity, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (item_id, warehouse_id, shelf_id) DO UPDATE SET quantity = $5`,
          [inv.id, inv.item_id || inv.itemId, inv.warehouse_id || inv.warehouseId, inv.shelf_id || inv.shelfId, inv.quantity, inv.updated_at || new Date()]
        );
      }

      // Insert transactions
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
         VALUES ($1, $2, 'admin', 'RESTORE_BACKUP', 'System', 'SYSTEM', 'بازیابی پایگاه داده از روی فایل پشتیبان', '127.0.0.1', NOW())`,
        [crypto.randomUUID(), adminUserId]
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

  // Migrate local IndexedDB data to PostgreSQL
  async migrateFromLocal(localData: any, adminUserId: string) {
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
        // Verify warehouse exists
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
        // check foreign keys
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

      // Log migration in audit
      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, 'admin', 'MIGRATE_FROM_LOCAL', 'System', 'SYSTEM', $3, '127.0.0.1', NOW())`,
        [
          crypto.randomUUID(),
          adminUserId,
          `انتقال داده‌های پایگاه محلی به سرور مرکزی: ${importedWarehouses} انبار، ${importedShelves} قفسه، ${importedItems} کالا، ${importedInventories} رکورد موجودی و ${importedTransactions} تراکنش`,
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
}
