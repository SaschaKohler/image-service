// src/db/migrations/002_add_template_data.js
async function up(db) {
  await db.exec(`
    -- Füge template_data Spalte zur templates Tabelle hinzu
    ALTER TABLE templates 
    ADD COLUMN template_data TEXT;
    
    -- Update bestehende Templates, kopiere example_data zu template_data
    UPDATE templates 
    SET template_data = example_data 
    WHERE template_data IS NULL;
  `);

  // Füge diese Migration zur migrations Tabelle hinzu
  await db.run('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)', [
    2,
    '002_add_template_data.js',
    new Date().toISOString(),
  ]);

  console.log('Added template_data column to templates table');
}

async function down(db) {
  // Erstelle temporäre Tabelle ohne template_data
  await db.exec(`
    CREATE TABLE templates_temp (
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

    -- Kopiere Daten in temporäre Tabelle
    INSERT INTO templates_temp 
    SELECT id, version, html, css, name, description, google_fonts,
           viewport_width, viewport_height, device_scale, created_at,
           updated_at, user_id, plan, example_data
    FROM templates;

    -- Lösche alte Tabelle
    DROP TABLE templates;

    -- Benenne temporäre Tabelle um
    ALTER TABLE templates_temp RENAME TO templates;

    -- Entferne die Migration aus der migrations Tabelle
    DELETE FROM migrations WHERE version = 2;
  `);

  console.log('Removed template_data column from templates table');
}

module.exports = { up, down };
