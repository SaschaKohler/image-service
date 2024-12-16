// src/db/migrations/003_add_image_storage.js
async function up(db) {
  await db.exec(`
    -- Erstelle generated_images Tabelle
    CREATE TABLE IF NOT EXISTS generated_images (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      created_at TEXT NOT NULL,
      file_size INTEGER,
      width INTEGER,
      height INTEGER,
      format TEXT DEFAULT 'png',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Erstelle usage_stats Tabelle
    CREATE TABLE IF NOT EXISTS usage_stats (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      month TEXT,
      image_count INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, month)
    );

    -- Erstelle plan_limits Tabelle
    CREATE TABLE IF NOT EXISTS plan_limits (
      plan TEXT PRIMARY KEY,
      monthly_image_limit INTEGER
    );

    -- Füge Standardlimits ein
    INSERT INTO plan_limits (plan, monthly_image_limit) VALUES
      ('FREE', 50),
      ('BASIC', 500),
      ('PRO', 1000);

    -- Erstelle Indizes für bessere Performance
    CREATE INDEX IF NOT EXISTS idx_generated_images_user_id 
    ON generated_images(user_id);

    CREATE INDEX IF NOT EXISTS idx_generated_images_created 
    ON generated_images(created_at);
  `);

  // Füge diese Migration zur migrations Tabelle hinzu
  await db.run('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)', [
    3,
    '003_add_image_storage.js',
    new Date().toISOString(),
  ]);

  console.log('Added image storage and usage tracking tables');
}

async function down(db) {
  await db.exec(`
    DROP TABLE IF EXISTS generated_images;
    DROP TABLE IF EXISTS usage_stats;
    DROP TABLE IF EXISTS plan_limits;
  `);

  // Entferne die Migration aus der migrations Tabelle
  await db.run('DELETE FROM migrations WHERE version = 3');

  console.log('Removed image storage and usage tracking tables');
}

module.exports = { up, down };
