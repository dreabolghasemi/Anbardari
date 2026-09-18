import { db } from './db.js';

async function runSeed() {
  console.log('Seeding warehouse database for Isfahan Steel Company...');
  console.log('App: نرم‌افزار انبارداری واحد اعلام حریق ذوب‌آهن اصفهان');
  console.log('Designer: دکتر احسان ابوالقاسمی');

  const warehouses = await db.getWarehouses();
  console.log(`Warehouses seeded: ${warehouses.length}`);

  const items = await db.getItems();
  console.log(`Items seeded: ${items.length}`);

  const users = await db.getUsers();
  console.log(`Users seeded: ${users.length} (Admin: admin)`);

  const metrics = await db.getDashboardMetrics();
  console.log(`Total inventory count: ${metrics.totalInventoryCount}`);

  console.log('Seed completed successfully!');
}

runSeed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
