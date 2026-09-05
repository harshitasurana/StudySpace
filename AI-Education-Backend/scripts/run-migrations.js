import 'dotenv/config';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Sequelize } from 'sequelize';
import sequelize from '../src/config/database.js';
import { logInfo, logError } from '../src/common/utils/logger.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);
const MIGRATIONS_DIR = join(__dirname, '..', 'db', 'migrations');

const ensureMetaTable = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('SequelizeMeta')) {
    await queryInterface.createTable('SequelizeMeta', {
      name: { type: 'VARCHAR(255)', primaryKey: true, allowNull: false },
    });
  }
};

const getRunMigrations = async (queryInterface) => {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT name FROM "SequelizeMeta" ORDER BY name'
  );
  return new Set(rows.map((r) => r.name));
};

const loadMigration = async (filePath) => {
  try {
    const mod = await import(filePath);
    return mod.default || mod;
  } catch (_esmErr) {
    return require(filePath);
  }
};

const runMigrations = async () => {
  try {
    await sequelize.authenticate();
    logInfo("✅ DB connected");

    const queryInterface = sequelize.getQueryInterface();
    await ensureMetaTable(queryInterface);
    const run = await getRunMigrations(queryInterface);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.js') || f.endsWith('.cjs'))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (run.has(file)) continue;

      const filePath = join(MIGRATIONS_DIR, file);
      const mod = await loadMigration(filePath);
      const handler = mod.up;
      if (typeof handler !== 'function') continue;

      logInfo(`▶ Running migration: ${file}`);
      try {
        await handler(queryInterface, Sequelize);
        await queryInterface.sequelize.query(
          'INSERT INTO "SequelizeMeta" (name) VALUES (?)',
          { replacements: [file] }
        );
        logInfo(`✓ Completed: ${file}`);
        ran++;
      } catch (err) {
        if (err.message?.includes('current transaction is aborted')) {
          logInfo(`⏭ Skipping (already applied): ${file}`);
        } else {
          logError(`✗ Migration failed: ${file}`, err);
          throw err;
        }
      }
    }

    if (ran === 0) {
      logInfo("✅ All migrations already applied");
    } else {
      logInfo(`✅ ${ran} migration(s) completed`);
    }
    process.exit(0);
  } catch (err) {
    logError("❌ Migration run failed", err);
    process.exit(1);
  }
};

runMigrations();
