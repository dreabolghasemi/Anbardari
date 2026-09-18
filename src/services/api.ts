import {
  User,
  Warehouse,
  Shelf,
  Item,
  InventoryItem,
  StockTransaction,
  AuditLog,
  DashboardMetrics,
} from '../types/index.js';
import { downloadExcelFile } from '../utils/excelExport.js';
import { formatShamsiDate } from '../utils/persian.js';

/**
 * پیام استاندارد قطعی شبکه بر اساس نیازمندی‌های سیستم
 */
export const SERVER_DISCONNECTED_MESSAGE = 'شبکه قطع است';

export interface NetworkInfoResponse {
  success: boolean;
  hostname: string;
  port: number;
  protocol: string;
  primaryIp: string;
  primaryUrl: string;
  qrCodeDataUrl?: string;
  addresses: Array<{
    name: string;
    ip: string;
    url: string;
    qrCode?: string;
    type: 'ethernet' | 'wifi' | 'virtual' | 'other';
  }>;
  isHttps: boolean;
  database: {
    engine: string;
    status: string;
    isPostgres: boolean;
    multiUserSafe: boolean;
    acidTransactions: boolean;
  };
  system: {
    platform: string;
    cpus: number;
    totalMemoryMb: number;
    freeMemoryMb: number;
    uptimeSeconds: number;
  };
  recentClients: Array<{
    ip: string;
    username: string;
    lastSeen: string;
    action: string;
  }>;
  workgroupGuide: {
    firewallCommand: string;
    powershellRule: string;
    chromeFlagInstruction: string;
  };
}

class ApiService {
  private customBaseUrl: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      this.customBaseUrl = localStorage.getItem('wms_api_base_url') || '';
      // Ensure any legacy client-side database or offline flag is cleared
      localStorage.removeItem('wms_client_database');
      localStorage.removeItem('wms_force_local_mode');
    }
  }

  getApiBaseUrl(): string {
    return this.customBaseUrl;
  }

  setApiBaseUrl(url: string) {
    this.customBaseUrl = url.trim().replace(/\/+$/, '');
    if (this.customBaseUrl) {
      localStorage.setItem('wms_api_base_url', this.customBaseUrl);
    } else {
      localStorage.removeItem('wms_api_base_url');
    }
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('wms_auth_token');
  }

  setToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wms_auth_token', token);
    }
  }

  clearToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wms_auth_token');
    }
  }

  /**
   * هسته مرکزی ارسال درخواست‌ها به سرور با کنترل دقیق وضعیت شبکه
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = this.customBaseUrl || '';
    const url = `${baseUrl}${endpoint}`;
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errMessage = 'خطایی در پردازش درخواست سرور رخ داد.';
        try {
          const errorData = await response.json();
          errMessage = errorData.error || errMessage;
        } catch {
          if (response.status === 404) {
            errMessage = 'آدرس یا منبع درخواستی روی سرور یافت نشد.';
          } else if (response.status === 401) {
            errMessage = 'نشست کاربری منقضی شده است. لطفاً مجدداً وارد شوید.';
          } else if (response.status === 403) {
            errMessage = 'شما مجوز دسترسی به این عملیات را ندارید.';
          } else if (response.status >= 500) {
            errMessage = 'خطای داخلی در سرور یا پایگاه داده رخ داده است.';
          }
        }
        throw new Error(errMessage);
      }

      return await response.json();
    } catch (error: any) {
      // تشخیص دقیق قطعی شبکه یا عدم دسترسی به سرور
      if (
        error.name === 'TypeError' ||
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('Load failed') ||
        error.message?.includes('Connection refused')
      ) {
        throw new Error(SERVER_DISCONNECTED_MESSAGE);
      }
      throw error;
    }
  }

  // --- Health Check & Network Probe ---
  async getHealth(): Promise<{
    status: string;
    database: string;
    databaseEngine?: string;
    multiDeviceReady?: boolean;
    warehousesCount: number;
    service?: string;
    designer?: string;
    uptime?: number;
  }> {
    return this.request<{
      status: string;
      database: string;
      databaseEngine?: string;
      multiDeviceReady?: boolean;
      warehousesCount: number;
      service?: string;
      designer?: string;
      uptime?: number;
    }>('/api/health');
  }

  // --- Network Information for Server / LAN Admin ---
  async getNetworkInfo(): Promise<NetworkInfoResponse> {
    return this.request<NetworkInfoResponse>('/api/network/info');
  }

  // --- Auth (100% Server-Side) ---
  async login(credentials: { username: string; password: string }) {
    const res = await this.request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(res.token);
    return res;
  }

  async getMe() {
    const token = this.getToken();
    if (!token) {
      throw new Error('لطفاً ابتدا با نام کاربری و کلمه عبور وارد سامانه شوید.');
    }
    return await this.request<{ user: User }>('/api/auth/me');
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch {}
    this.clearToken();
  }

  // --- Warehouses & Shelves ---
  async getWarehouses() {
    return this.request<{ warehouses: Warehouse[] }>('/api/warehouses');
  }

  async createWarehouse(data: { name: string; code: string; description?: string }) {
    return this.request<{ warehouse: Warehouse }>('/api/warehouses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWarehouse(id: string, data: Partial<Warehouse>) {
    return this.request<{ warehouse: Warehouse }>(`/api/warehouses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWarehouse(id: string) {
    return this.request<{ success: boolean; message?: string }>(`/api/warehouses/${id}`, {
      method: 'DELETE',
    });
  }

  async getShelves(warehouseId?: string) {
    const query = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : '';
    return this.request<{ shelves: Shelf[] }>(`/api/warehouses/all-shelves/list${query}`);
  }

  async createShelf(data: { name: string; code: string; warehouseId: string; description?: string }) {
    return this.request<{ shelf: Shelf }>('/api/warehouses/shelves', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateShelf(id: string, data: Partial<Shelf>) {
    return this.request<{ shelf: Shelf }>(`/api/warehouses/shelves/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteShelf(id: string) {
    return this.request<{ success: boolean; message?: string }>(`/api/warehouses/shelves/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Items & Catalogs ---
  async getItems(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<{ items: Item[] }>(`/api/items${query}`);
  }

  async getItemById(id: string) {
    return this.request<{
      item: Item & {
        totalStock: number;
        inventories: (InventoryItem & { warehouseName: string; shelfName: string })[];
        attachments?: any[];
        transactions: StockTransaction[];
      };
    }>(`/api/items/${id}`);
  }

  async createItem(data: {
    name: string;
    code: string;
    category: string;
    brand: string;
    model: string;
    unit?: string;
    description?: string;
    imageUrl?: string;
  }) {
    return this.request<{ item: Item }>('/api/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateItem(id: string, data: Partial<Item>) {
    return this.request<{ item: Item }>(`/api/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteItem(id: string) {
    return this.request<{ success: boolean; message?: string }>(`/api/items/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadItemPdf(itemId: string, file: File) {
    const formData = new FormData();
    formData.append('catalogPdf', file);
    return this.request<{ attachment: any }>(`/api/items/${itemId}/upload-pdf`, {
      method: 'POST',
      body: formData,
    });
  }

  async deleteItemAttachment(itemId: string, attachmentId: string) {
    return this.request<{ success: boolean }>(`/api/items/${itemId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  }

  // --- Stock Operations (Atomic on PostgreSQL Server) ---
  async getNextDocNumber(): Promise<string> {
    try {
      const res = await this.request<{ nextDocNumber: string }>('/api/stock/next-doc-number');
      return res.nextDocNumber || '1001';
    } catch {
      return '1001';
    }
  }

  async stockIn(data: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    referenceNo?: string;
    notes?: string;
  }) {
    return this.request<{ success: boolean; transaction: StockTransaction; newQuantity: number }>(
      '/api/stock/in',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async stockOut(data: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    referenceNo?: string;
    notes?: string;
  }) {
    return this.request<{ success: boolean; transaction: StockTransaction; remainingQuantity: number }>(
      '/api/stock/out',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async transferStock(data: {
    itemId: string;
    sourceWarehouseId: string;
    sourceShelfId: string;
    destWarehouseId: string;
    destShelfId: string;
    quantity: number;
    referenceNo?: string;
    notes?: string;
  }) {
    return this.request<{
      success: boolean;
      transaction: StockTransaction;
      sourceRemaining: number;
      destNewQuantity: number;
    }>('/api/stock/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async correctiveAdjustment(data: {
    itemId: string;
    warehouseId: string;
    shelfId: string;
    newTargetQuantity: number;
    reason: string;
  }) {
    return this.request<{ success: boolean; transaction: StockTransaction; difference: number }>(
      '/api/stock/adjust',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async getTransactions(filters?: Record<string, string | number>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.append(k, String(v));
      });
    }
    return this.request<{ transactions: StockTransaction[] }>(`/api/stock/transactions?${params.toString()}`);
  }

  // --- Inventory & Dashboard ---
  async getInventory(filters?: Record<string, string>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
    }
    return this.request<{ inventories: InventoryItem[] }>(`/api/inventory?${params.toString()}`);
  }

  async getDashboardMetrics() {
    return this.request<DashboardMetrics>('/api/inventory/dashboard');
  }

  // --- Users (ADMIN) ---
  async getUsers() {
    return this.request<{ users: User[] }>('/api/users');
  }

  async createUser(data: { username: string; fullName: string; password: string; role: string }) {
    return this.request<{ user: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: Partial<User & { password?: string }>) {
    return this.request<{ user: User }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --- Audit Logs (ADMIN) ---
  async getAuditLogs(filters?: Record<string, string | number>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, String(v));
      });
    }
    return this.request<{ logs: AuditLog[] }>(`/api/audit-logs?${params.toString()}`);
  }

  // --- Reports & Excel Export ---
  async getReportData(reportType: string, filters?: Record<string, string>) {
    const params = new URLSearchParams({ reportType });
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
    }
    return this.request<{ data: any[] }>(`/api/reports/data?${params.toString()}`);
  }

  getExcelExportUrl(reportType: string, filters?: Record<string, string>): string {
    const params = new URLSearchParams({ reportType });
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
    }
    const token = this.getToken();
    if (token) {
      params.append('token', token);
    }
    const base = this.customBaseUrl || '';
    return `${base}/api/reports/export-excel?${params.toString()}`;
  }

  async exportExcel(reportType: string, filters?: Record<string, string>): Promise<void> {
    const res = await this.getReportData(reportType, filters);
    const list = res.data;

    let rows: any[] = [];
    let fileName = `گزارش_${reportType}_${Date.now()}.xlsx`;

    if (reportType === 'INVENTORY') {
      fileName = `گزارش_موجودی_کالاها_${Date.now()}.xlsx`;
      rows = list.map((r: any, idx: number) => ({
        'ردیف': idx + 1,
        'کد کالا': r.itemCode,
        'نام کالا': r.itemName,
        'برند': r.itemBrand,
        'مدل': r.itemModel,
        'دسته‌بندی': r.itemCategory,
        'انبار': r.warehouseName,
        'قفسه': r.shelfName,
        'موجودی': r.quantity,
        'واحد شمارش': r.itemUnit,
        'تاریخ آخرین به‌روزرسانی': formatShamsiDate(r.updatedAt),
      }));
    } else if (reportType === 'USER_ACTIVITY') {
      fileName = `گزارش_فعالیت_کاربران_${Date.now()}.xlsx`;
      rows = list.map((l: any, idx: number) => ({
        'ردیف': idx + 1,
        'کاربر': l.username,
        'نوع عملیات': l.action,
        'موجودیت': l.entity,
        'توضیحات': l.details || '-',
        'آدرس IP': l.ipAddress || '-',
        'تاریخ و زمان': formatShamsiDate(l.createdAt),
      }));
    } else {
      fileName = `گزارش_تراکنش_${reportType}_${Date.now()}.xlsx`;
      rows = list.map((t: any, idx: number) => ({
        'ردیف': idx + 1,
        'شماره سند/عطف': t.referenceNo || '-',
        'نوع تراکنش':
          t.type === 'STOCK_IN'
            ? 'ورود کالا'
            : t.type === 'STOCK_OUT'
            ? 'خروج کالا'
            : t.type === 'TRANSFER'
            ? 'انتقال کالا'
            : 'اصلاح موجودی',
        'کد کالا': t.itemCode,
        'نام کالا': t.itemName,
        'برند': t.itemBrand,
        'تعداد': t.quantity,
        'واحد': t.itemUnit,
        'انبار مبدا': t.sourceWarehouseName || '-',
        'قفسه مبدا': t.sourceShelfName || '-',
        'انبار مقصد': t.destWarehouseName || '-',
        'قفسه مقصد': t.destShelfName || '-',
        'ثبت‌کننده': t.userName,
        'توضیحات': t.notes || '-',
        'تاریخ و زمان': formatShamsiDate(t.createdAt),
      }));
    }

    downloadExcelFile(rows, fileName, 'گزارش');
  }

  // --- Backup & Restore (ADMIN) ---
  getBackupDownloadUrl(): string {
    const base = this.customBaseUrl || '';
    return `${base}/api/backup/export`;
  }

  async exportBackup() {
    return await this.request<any>('/api/backup/export');
  }

  async restoreBackup(backupData: any, confirmationCode = 'CONFIRM_RESTORE') {
    return await this.request<{ success: boolean; message: string }>('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ backupData, confirmationCode }),
    });
  }

  // --- Central Database Verification ---
  async getHealthStatus() {
    try {
      const res = await this.request<{
        status: string;
        database: string;
        databaseEngine?: string;
        multiDeviceReady?: boolean;
        warehousesCount: number;
        service?: string;
        uptime?: number;
      }>('/api/health');
      return res;
    } catch (err: any) {
      return {
        status: 'disconnected',
        database: 'none',
        databaseEngine: 'اتصال به سرور برقرار نیست',
        multiDeviceReady: false,
        warehousesCount: 0,
        service: 'نرم‌افزار انبارداری ذوب‌آهن',
        uptime: 0,
        error: SERVER_DISCONNECTED_MESSAGE,
      };
    }
  }
}

export const api = new ApiService();
