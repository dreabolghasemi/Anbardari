import { Router, Request, Response } from 'express';
import os from 'os';
import QRCode from 'qrcode';
import { db, isPostgres } from '../db.js';

const router = Router();

router.get('/info', async (req: Request, res: Response) => {
  try {
    const interfaces = os.networkInterfaces();
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const isHttps = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
    const protocol = isHttps ? 'https' : 'http';

    const localAddresses: Array<{
      name: string;
      ip: string;
      url: string;
      qrCode?: string;
      type: 'ethernet' | 'wifi' | 'virtual' | 'other';
    }> = [];

    for (const [name, ifaceList] of Object.entries(interfaces)) {
      if (!ifaceList) continue;
      for (const iface of ifaceList) {
        // Exclude loopback and non-IPv4
        if (iface.family === 'IPv4' && !iface.internal) {
          const lowerName = name.toLowerCase();
          let type: 'ethernet' | 'wifi' | 'virtual' | 'other' = 'other';
          if (lowerName.includes('wi-fi') || lowerName.includes('wlan') || lowerName.includes('wireless')) {
            type = 'wifi';
          } else if (lowerName.includes('eth') || lowerName.includes('lan') || lowerName.includes('local') || lowerName.includes('ethernet')) {
            type = 'ethernet';
          } else if (lowerName.includes('vethernet') || lowerName.includes('vmware') || lowerName.includes('virtual') || lowerName.includes('docker')) {
            type = 'virtual';
          }

          const url = `${protocol}://${iface.address}:${port}`;
          localAddresses.push({
            name,
            ip: iface.address,
            url,
            type,
          });
        }
      }
    }

    // Sort to prioritize physical ethernet / wifi over virtual adapters
    localAddresses.sort((a, b) => {
      const order = { ethernet: 1, wifi: 2, other: 3, virtual: 4 };
      return (order[a.type] || 5) - (order[b.type] || 5);
    });

    const primaryAddress = localAddresses.length > 0 ? localAddresses[0] : null;
    const primaryUrl = primaryAddress ? primaryAddress.url : `${protocol}://localhost:${port}`;
    const hostname = os.hostname();

    // Generate QR Code data URL for the primary URL
    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await QRCode.toDataURL(primaryUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    } catch (qrErr) {
      console.warn('[NetworkRoutes] Failed to generate primary QR code:', qrErr);
    }

    // Also attach QR code to each address
    for (const addr of localAddresses) {
      try {
        addr.qrCode = await QRCode.toDataURL(addr.url, {
          width: 280,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
      } catch {}
    }

    // Fetch recent client activity from audit logs
    let recentClients: Array<{ ip: string; username: string; lastSeen: string; action: string }> = [];
    try {
      const logs = await db.getAuditLogs({ limit: 50 });
      const ipMap = new Map<string, { ip: string; username: string; lastSeen: string; action: string }>();
      for (const log of logs) {
        const ip = log.ipAddress || '127.0.0.1';
        if (!ipMap.has(ip)) {
          ipMap.set(ip, {
            ip,
            username: log.username || 'کاربر',
            lastSeen: log.createdAt,
            action: log.details || log.action,
          });
        }
      }
      recentClients = Array.from(ipMap.values()).slice(0, 10);
    } catch (logErr) {
      console.warn('[NetworkRoutes] Could not fetch audit logs for clients:', logErr);
    }

    const isPg = isPostgres();

    res.json({
      success: true,
      hostname,
      port,
      protocol,
      primaryIp: primaryAddress ? primaryAddress.ip : 'localhost',
      primaryUrl,
      qrCodeDataUrl,
      addresses: localAddresses,
      isHttps,
      database: {
        engine: 'PostgreSQL Central Database (Single Source of Truth)',
        status: isPg ? 'connected' : 'disconnected',
        isPostgres: true,
        multiUserSafe: true,
        acidTransactions: true,
      },
      system: {
        platform: `${os.type()} ${os.release()} (${os.arch()})`,
        cpus: os.cpus().length,
        totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
        freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
        uptimeSeconds: Math.round(process.uptime()),
      },
      recentClients,
      workgroupGuide: {
        firewallCommand: `netsh advfirewall firewall add rule name="ZobAhan Warehouse WMS" dir=in action=allow protocol=TCP localport=${port}`,
        powershellRule: `New-NetFirewallRule -DisplayName "ZobAhan Warehouse WMS" -Direction Inbound -LocalPort ${port} -Protocol TCP -Action Allow`,
        chromeFlagInstruction: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'خطا در خواندن مشخصات شبکه' });
  }
});

export default router;
