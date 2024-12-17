// src/db/migrations/004_add_usage_counter.js

async function up(db) {
  await db.exec(`
    -- Erstelle usage_counter Tabelle
    CREATE TABLE IF NOT EXISTS usage_counter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, year, month)
    );

    -- Erstelle Index für schnellere Abfragen
    CREATE INDEX IF NOT EXISTS idx_usage_counter_user_date 
    ON usage_counter(user_id, year, month);
  `);

  // Füge diese Migration zur migrations Tabelle hinzu
  await db.run('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)', [
    4,
    '004_add_usage_counter.js',
    new Date().toISOString(),
  ]);

  console.log('Added usage_counter table');
}

async function down(db) {
  await db.exec(`
    DROP TABLE IF EXISTS usage_counter;
  `);

  await db.run('DELETE FROM migrations WHERE version = 4');

  console.log('Removed usage_counter table');
}

module.exports = { up, down };
