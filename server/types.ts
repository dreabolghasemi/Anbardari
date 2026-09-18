export type Role = 'ADMIN' | 'WAREHOUSE_USER';

export type TransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER' | 'ADJUSTMENT';

export interface User {
  id: string;
  username: string;
  fullName: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  tokenVersion?: number;
  createdAt: string;
  lastLogin?: string | null;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Shelf {
  id: string;
  name: string;
  code: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  warehouseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  name: string;
  code: string;
  category: string;
  brand: string;
  model: string;
  unit: string;
  description: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  totalStock?: number;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  itemId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
  uploadedById?: string | null;
  createdAt: string;
}

export interface Inventory {
  id: string;
  itemId: string;
  warehouseId: string;
  shelfId: string;
  quantity: number;
  updatedAt: string;
}

export interface StockTransaction {
  id: string;
  type: TransactionType;
  itemId: string;
  quantity: number;
  sourceWarehouseId?: string | null;
  sourceShelfId?: string | null;
  destWarehouseId?: string | null;
  destShelfId?: string | null;
  userId: string;
  notes?: string | null;
  referenceNo?: string | null;
  trackingCode?: string | null;
  createdAt: string;
  itemName?: string;
  itemCode?: string;
  itemBrand?: string;
  itemUnit?: string;
  sourceWarehouseName?: string;
  sourceShelfName?: string;
  destWarehouseName?: string;
  destShelfName?: string;
  userName?: string;
  userFullName?: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  username: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  fullName: string;
  role: Role;
  tokenVersion?: number;
}
