// src/db/migrations/004_extend_generated_images.js
async function up(db) {
  await db.exec(`
    -- Erweitere generated_images Tabelle
    ALTER TABLE generated_images ADD COLUMN template_id TEXT;
    ALTER TABLE generated_images ADD COLUMN html TEXT;
    ALTER TABLE generated_images ADD COLUMN css TEXT;
    ALTER TABLE generated_images ADD COLUMN google_fonts TEXT;
    ALTER TABLE generated_images ADD COLUMN viewport_width INTEGER;
    ALTER TABLE generated_images ADD COLUMN viewport_height INTEGER;
    ALTER TABLE generated_images ADD COLUMN device_scale REAL;
    ALTER TABLE generated_images ADD COLUMN template_data TEXT;

    -- Füge Foreign Key für template_id hinzu
    CREATE INDEX IF NOT EXISTS idx_generated_images_template_id 
    ON generated_images(template_id);
  `);

  // Füge diese Migration zur migrations Tabelle hinzu
  await db.run('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)', [
    5,
    '005_extend_generated_images.js',
    new Date().toISOString(),
  ]);

  console.log('Extended generated_images table with template information');
}

async function down(db) {
  // In SQLite können wir Spalten nicht direkt entfernen,
  // daher müssen wir eine neue Tabelle erstellen
  await db.exec(`
    CREATE TABLE generated_images_temp (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      created_at TEXT NOT NULL,
      file_size INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    INSERT INTO generated_images_temp 
    SELECT id, user_id, file_path, original_filename, created_at, file_size
    FROM generated_images;

    DROP TABLE generated_images;
    ALTER TABLE generated_images_temp RENAME TO generated_images;

    -- Entferne die Migration aus der migrations Tabelle
    DELETE FROM migrations WHERE version = 4;
  `);

  console.log('Reverted generated_images table structure');
}

module.exports = { up, down };
