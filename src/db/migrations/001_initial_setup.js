// src/db/migrations/001_initial_setup.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');

async function up(db) {
  // Erstelle users Tabelle
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      api_key TEXT UNIQUE,
      plan TEXT DEFAULT 'FREE',
      created_at TEXT,
      updated_at TEXT
    );

    -- Erstelle templates Tabelle mit allen benötigten Feldern
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      version INTEGER,
      html TEXT,
      css TEXT,
      name TEXT,
      description TEXT,
      google_fonts TEXT,
      viewport_width INTEGER,
      viewport_height INTEGER,
      device_scale REAL,
      created_at TEXT,
      updated_at TEXT,
      user_id TEXT,
      plan TEXT DEFAULT 'FREE',
      example_data TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Erstelle migrations Tabelle zur Verfolgung der Migrationen
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT,
      applied_at TEXT
    );
  `);

  // Erstelle einen initialen Admin-User wenn noch keiner existiert
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminApiKey = crypto.randomBytes(32).toString('hex');
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  try {
    await db.run(
      `
      INSERT INTO users (
        id, email, password_hash, api_key, plan, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        'admin',
        adminEmail,
        adminPasswordHash,
        adminApiKey,
        'PRO',
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    console.log('Initial admin user created:');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('API Key:', adminApiKey);
  } catch (error) {
    if (!error.message.includes('UNIQUE constraint failed')) {
      throw error;
    }
    console.log('Admin user already exists, skipping creation');
  }

  // Füge diese Migration zur migrations Tabelle hinzu
  await db.run('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)', [
    1,
    '001_initial_setup.js',
    new Date().toISOString(),
  ]);
}

async function down(db) {
  await db.exec(`
    DROP TABLE IF EXISTS templates;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS migrations;
  `);
}

module.exports = { up, down };
