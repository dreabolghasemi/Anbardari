import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { db, isPostgres } from './server/db.js';
import { getFilePath } from './server/storage.js';

// Route handlers
import authRoutes from './server/routes/auth.routes.js';
import usersRoutes from './server/routes/users.routes.js';
import warehousesRoutes from './server/routes/warehouses.routes.js';
import itemsRoutes from './server/routes/items.routes.js';
import stockRoutes from './server/routes/stock.routes.js';
import inventoryRoutes from './server/routes/inventory.routes.js';
import reportsRoutes from './server/routes/reports.routes.js';
import auditRoutes from './server/routes/audit.routes.js';
import backupRoutes from './server/routes/backup.routes.js';
import networkRoutes from './server/routes/network.routes.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  // Initialize Database (runs migrations if PostgreSQL is active)
  if (typeof (db as any).init === 'function') {
    try {
      await (db as any).init();
    } catch (dbErr) {
      console.error('[Server] Database initialization failed:', dbErr);
    }
  }

  const app = express();
  const server = http.createServer(app);

  // CORS configuration (supports external devices, tablets, and LAN)
  app.use(
    cors({
      origin: (_origin, callback) => {
        // Allow all origins (mobile browsers, tablets, LAN IPs, desktop)
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Basic security headers & body parsers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 1. Health Check Endpoints (for monitoring central PostgreSQL status)
  const healthCheckHandler = async (_req: Request, res: Response) => {
    try {
      const warehouses = await db.getWarehouses();
      res.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        service: 'نرم‌افزار انبارداری واحد اعلام حریق ذوب‌آهن اصفهان',
        designer: 'دکتر احسان ابوالقاسمی',
        databaseEngine: 'PostgreSQL Central Database (Single Source of Truth)',
        multiDeviceReady: true,
        warehousesCount: warehouses.length,
        uptime: process.uptime(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        error: 'دیتابیس سرور در دسترس نیست',
        details: err.message || 'Database check failed',
      });
    }
  };

  app.get('/health', healthCheckHandler);
  app.get('/api/health', healthCheckHandler);

  // 2. Static file serving for PDF Catalogs and Uploads
  app.get('/api/files/:filename', (req: Request, res: Response) => {
    const filename = req.params.filename;
    const fullPath = getFilePath(filename);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'فایل مورد نظر یافت نشد.' });
    }
    res.sendFile(fullPath);
  });

  // 3. Mount REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/warehouses', warehousesRoutes);
  app.use('/api/items', itemsRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/backup', backupRoutes);
  app.use('/api/network', networkRoutes);

  // 4. Vite Middleware for Development / Static serving for Production
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'مسیر API مورد نظر یافت نشد.' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    if (
      err.code === 'ECONNREFUSED' ||
      err.message?.includes('PostgreSQL') ||
      err.message?.includes('database') ||
      err.message?.includes('دیتابیس')
    ) {
      return res.status(503).json({
        error: 'دیتابیس سرور در دسترس نیست',
        details: err.message,
      });
    }
    res.status(500).json({ error: err.message || 'خطای غیرمنتظره در سرور رخ داده است.' });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[WMS] Warehouse Management Server running on port ${PORT}`);
    console.log(`[WMS] App: نرم‌افزار انبارداری واحد اعلام حریق ذوب‌آهن اصفهان`);
    console.log(`[WMS] Designer: دکتر احسان ابوالقاسمی`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
