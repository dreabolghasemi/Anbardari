export type Role = 'ADMIN' | 'WAREHOUSE_USER';

export type TransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'TRANSFER' | 'ADJUSTMENT';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string | null;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  shelvesCount?: number;
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
  warehouseName?: string;
  warehouseCode?: string;
  createdAt: string;
  updatedAt: string;
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
  totalStock?: number;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  itemId: string;
  warehouseId: string;
  shelfId: string;
  quantity: number;
  itemName: string;
  itemCode: string;
  itemBrand: string;
  itemModel: string;
  itemCategory: string;
  itemUnit: string;
  warehouseName: string;
  warehouseCode: string;
  shelfName: string;
  shelfCode: string;
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
  createdAt: string;
  itemName: string;
  itemCode: string;
  itemBrand: string;
  itemModel: string;
  itemUnit: string;
  userName: string;
  sourceWarehouseName?: string | null;
  sourceWarehouseCode?: string | null;
  sourceShelfName?: string | null;
  sourceShelfCode?: string | null;
  destWarehouseName?: string | null;
  destWarehouseCode?: string | null;
  destShelfName?: string | null;
  destShelfCode?: string | null;
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

export interface DashboardMetrics {
  totalWarehouses: number;
  totalShelves: number;
  totalItems: number;
  totalUsers: number;
  totalInventoryCount: number;
  latestStockIn?: StockTransaction | null;
  latestStockOut?: StockTransaction | null;
  latestTransfer?: StockTransaction | null;
}

export interface DatabaseSchema {
  users: (User & { passwordHash?: string })[];
  warehouses: Warehouse[];
  shelves: Shelf[];
  items: Item[];
  inventories: {
    id: string;
    itemId: string;
    warehouseId: string;
    shelfId: string;
    quantity: number;
    updatedAt: string;
  }[];
  transactions: {
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
    createdAt: string;
  }[];
  auditLogs: AuditLog[];
  attachments?: any[];
}
