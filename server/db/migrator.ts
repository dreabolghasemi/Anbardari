import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function runMigrations(pool: Pool): Promise<void> {
  console.log('[PostgreSQL] Starting database migration & schema verification...');
  
  const client = await pool.connect();
  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Discover migration SQL files in server/migrations
    const migrationsDir = path.resolve(process.cwd(), 'server', 'migrations');
    let migrationFiles: string[] = [];
    if (fs.existsSync(migrationsDir)) {
      migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith('.sql'))
        .sort();
    }

    // Fallback to server/db/schema.sql if migrations folder is empty
    if (migrationFiles.length === 0) {
      const schemaPath = path.resolve(process.cwd(), 'server', 'db', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        console.log('[PostgreSQL] Running baseline schema from server/db/schema.sql');
        const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
        await client.query('BEGIN');
        await client.query(sqlContent);
        await client.query(
          `INSERT INTO migrations (name) VALUES ('001_initial_schema.sql') ON CONFLICT (name) DO NOTHING`
        );
        await client.query('COMMIT');
      }
    } else {
      // Execute unapplied migrations in alphabetical order
      const appliedRes = await client.query('SELECT name FROM migrations');
      const appliedSet = new Set(appliedRes.rows.map((r: { name: string }) => r.name));

      for (const file of migrationFiles) {
        if (!appliedSet.has(file)) {
          console.log(`[PostgreSQL] Applying pending migration: ${file}...`);
          const filePath = path.join(migrationsDir, file);
          const sqlContent = fs.readFileSync(filePath, 'utf-8');

          await client.query('BEGIN');
          await client.query(sqlContent);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');

          console.log(`[PostgreSQL] Successfully applied migration: ${file}`);
        } else {
          console.log(`[PostgreSQL] Migration already applied: ${file}`);
        }
      }
    }

    // 3. Ensure initial Admin account exists if users table is empty
    const usersCountResult = await client.query('SELECT COUNT(*) as count FROM users');
    const usersCount = parseInt(usersCountResult.rows[0].count, 10);

    if (usersCount === 0) {
      console.log('[PostgreSQL] Users table is empty. Initializing primary administrative account...');
      
      const salt = await bcrypt.genSalt(10);
      const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
      const adminFullName = (process.env.ADMIN_FULLNAME || 'مدیر سیستم انبارداری').trim();

      // Read password strictly from environment variable, or generate secure random one if unset
      let adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
      if (!adminPassword) {
        const randomSecret = crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + 'A1!';
        adminPassword = randomSecret;
        console.warn('================================================================');
        console.warn('[SECURITY] ADMIN_INITIAL_PASSWORD was not defined in environment.');
        console.warn(`[SECURITY] Temporary Admin Password generated: ${adminPassword}`);
        console.warn('Please change this password immediately upon first login!');
        console.warn('================================================================');
      }

      const adminPasswordHash = await bcrypt.hash(adminPassword, salt);
      const adminId = 'usr-admin-' + crypto.randomBytes(4).toString('hex');
      const now = new Date().toISOString();

      await client.query(
        `INSERT INTO users (id, username, full_name, password_hash, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, 'ADMIN', true, $5)
         ON CONFLICT (username) DO NOTHING`,
        [adminId, adminUsername, adminFullName, adminPasswordHash, now]
      );

      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, 'SYSTEM_INIT', 'System', 'SYSTEM', 'راه‌اندازی اولیه پایگاه داده مرکزی PostgreSQL', '127.0.0.1', $4)`,
        [crypto.randomUUID(), adminId, adminUsername, now]
      );

      console.log(`[PostgreSQL] Initial Admin created with username: "${adminUsername}".`);
    } else {
      console.log(`[PostgreSQL] Database contains ${usersCount} users.`);
    }

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[PostgreSQL] Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
