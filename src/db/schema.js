// src/db/schema.js
async function initializeDb(db) {
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
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}
module.exports = {initializeDb};
