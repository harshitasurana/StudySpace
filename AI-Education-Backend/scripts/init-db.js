import 'dotenv/config';
import models from '../src/models/model.js';
import { logInfo, logError } from '../src/common/utils/logger.js';

const initializeDatabase = async () => {
  try {
    await models.sequelize.authenticate();
    logInfo('✅ DB connected');

    // Force recreate all tables - this is useful for fresh start or testing
    logInfo('⏳ Dropping all existing tables...');
    await models.sequelize.sync({ force: true });
    logInfo('✅ Database initialization completed - all tables recreated from scratch');

    process.exit(0);
  } catch (err) {
    logError('❌ Database initialization failed', err);
    process.exit(1);
  }
};

initializeDatabase();
