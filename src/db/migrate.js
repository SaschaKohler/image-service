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
      .sort((a, b) => {
        const versionA = parseInt(a.split('_')[0]);
        const versionB = parseInt(b.split('_')[0]);
        return versionA - versionB;
      })
      .map(f => ({
        version: parseInt(f.split('_')[0]),
        path: path.join(migrationsDir, f),
        name: f,
      }));
  } catch (error) {
    console.error('Error reading migrations directory:', error);
    return [];
  }
}

async function initializeDatabase(dbPath) {
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, '');
  }

  return await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
}

async function getAppliedMigrations(db) {
  try {
    const migrations = await db.all('SELECT version FROM migrations ORDER BY version');
    return new Set(migrations.map(m => m.version));
  } catch (error) {
    return new Set();
  }
}

async function migrate(direction = 'up') {
  const dbPath = await ensureDbDirectory();
  console.log(`Using database at: ${dbPath}`);

  let db;
  try {
    db = await initializeDatabase(dbPath);
    const migrationFiles = await getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations(db);

    if (direction === 'up') {
      console.log('Running migrations...');

      for (const migration of migrationFiles) {
        if (!appliedMigrations.has(migration.version)) {
          console.log(`Applying migration ${migration.name}...`);
          const module = require(migration.path);

          try {
            await module.up(db);
            console.log(`Migration ${migration.name} completed successfully`);
          } catch (error) {
            console.error(`Error applying migration ${migration.name}:`, error);
            throw error;
          }
        } else {
          console.log(`Skipping migration ${migration.name} - already applied`);
        }
      }
    } else if (direction === 'down') {
      // Get the last applied migration
      const lastApplied = Math.max(...Array.from(appliedMigrations));
      const migrationToRollback = migrationFiles.find(m => m.version === lastApplied);

      if (migrationToRollback) {
        console.log(`Rolling back migration ${migrationToRollback.name}...`);
        const module = require(migrationToRollback.path);
        await module.down(db);
        console.log('Rollback completed successfully');
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
