// src/db/migrate.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;

async function ensureDbDirectory() {
  const dbDir = path.join(__dirname, '..');
  try {
    await fs.access(dbDir);
  } catch {
    await fs.mkdir(dbDir, { recursive: true });
  }
  return path.join(dbDir, 'templates.db');
}

async function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');
  try {
    const files = await fs.readdir(migrationsDir);
    return files
      .filter(f => f.endsWith('.js'))
      .sort()
      .map(f => path.join(migrationsDir, f));
  } catch (error) {
    console.error('Error reading migrations directory:', error);
    return [];
  }
}

async function initializeDatabase(dbPath) {
  // Stelle sicher, dass die Datei existiert
  try {
    await fs.access(dbPath);
  } catch {
    // Erstelle eine leere Datei wenn sie nicht existiert
    await fs.writeFile(dbPath, '');
  }

  return await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
}

async function migrate(direction = 'up') {
  const dbPath = await ensureDbDirectory();
  console.log(`Using database at: ${dbPath}`);

  let db;
  try {
    db = await initializeDatabase(dbPath);

    // Migrations-Tabelle wird jetzt in der ersten Migration erstellt
    const migrationFiles = await getMigrationFiles();

    if (direction === 'up') {
      console.log('Running migrations...');

      for (const file of migrationFiles) {
        const migration = require(file);
        const version = parseInt(path.basename(file).split('_')[0]);

        try {
          // Prüfe ob Migration bereits ausgeführt wurde
          const applied = await db
            .get('SELECT version FROM migrations WHERE version = ?', version)
            .catch(() => null);

          if (!applied) {
            console.log(`Applying migration ${path.basename(file)}...`);
            await migration.up(db);
            console.log(`Migration ${path.basename(file)} completed successfully`);
          } else {
            console.log(`Skipping migration ${path.basename(file)} - already applied`);
          }
        } catch (error) {
          console.error(`Error applying migration ${path.basename(file)}:`, error);
          throw error;
        }
      }
    } else if (direction === 'down') {
      // Hole die letzte ausgeführte Migration
      const lastMigration = await db
        .get('SELECT * FROM migrations ORDER BY version DESC LIMIT 1')
        .catch(() => null);

      if (lastMigration) {
        const migrationFile = migrationFiles.find(
          f => parseInt(path.basename(f).split('_')[0]) === lastMigration.version
        );

        if (migrationFile) {
          console.log(`Rolling back migration ${path.basename(migrationFile)}...`);
          const migration = require(migrationFile);
          await migration.down(db);
          await db.run('DELETE FROM migrations WHERE version = ?', lastMigration.version);
          console.log('Rollback completed successfully');
        }
      } else {
        console.log('No migrations to roll back');
      }
    }

    console.log('Migration process completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (db) await db.close();
  }
}

// CLI-Interface
if (require.main === module) {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  migrate(direction).catch(console.error);
}

module.exports = { migrate };
