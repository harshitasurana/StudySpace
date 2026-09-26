import 'dotenv/config';
import '../src/config/sqlite-compat.js'; // must be before any model import
import models from "../src/models/model.js";
import { seedDatabase } from "../src/config/seed.js";
import { logInfo, logError } from '../src/common/utils/logger.js';

(async () => {
  try {
    await models.sequelize.authenticate();
    logInfo("✅ DB connected");

    if (process.env.USE_SQLITE === 'true') {
      logInfo("🔄 SQLite detected, syncing database schema...");
      await models.sequelize.sync({ force: true });
      logInfo("✅ Schema synced");
    }

    await seedDatabase();

    logInfo("🌱 Seeding completed");
    logInfo("✅ Models synchronized");
    process.exit(0);
  } catch (err) {
    logError("❌ Seeding failed", err);
    process.exit(1);
  }
})();
