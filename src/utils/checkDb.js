// src/utils/checkDb.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function checkDatabase() {
  const db = await open({
    filename: path.join(__dirname, '..', 'templates.db'),
    driver: sqlite3.Database,
  });

  console.log('Checking database tables...');

  // Check tables
  const tables = await db.all(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `);

  console.log('\nExisting tables:');
  console.log(tables.map(t => t.name).join('\n'));

  // Check plan_limits
  console.log('\nChecking plan_limits:');
  const limits = await db.all('SELECT * FROM plan_limits');
  console.log(limits);

  // Check if admin user exists
  console.log('\nChecking admin user:');
  const admin = await db.get('SELECT email, plan FROM users WHERE email = ?', [
    'admin@example.com',
  ]);
  console.log(admin);

  await db.close();
}

checkDatabase().catch(console.error);
