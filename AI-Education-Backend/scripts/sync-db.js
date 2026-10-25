import 'dotenv/config';
import models from '../src/models/model.js';
import { logInfo, logError } from '../src/common/utils/logger.js';

const relaxForSync = (sequelize) => {
  const backup = [];
  for (const model of Object.values(sequelize.models)) {
    for (const attr of Object.values(model.rawAttributes || {})) {
      const snap = { attr, references: attr.references, allowNull: attr.allowNull, unique: attr.unique };
      if (attr.references) delete attr.references;
      if (attr.unique) attr.unique = false;
      attr.allowNull = true;
      backup.push(snap);
    }
  }
  return backup;
};

const restoreAfterSync = (backup) => {
  for (const { attr, references, allowNull, unique } of backup) {
    if (references) attr.references = references;
    if (unique) attr.unique = unique;
    attr.allowNull = allowNull;
  }
};

const syncDatabase = async () => {
  try {
    await models.sequelize.authenticate();
    logInfo("✅ DB connected");
    const backup = relaxForSync(models.sequelize);
    logInfo("⏸️  Constraints relaxed for sync");
    await models.sequelize.sync({ alter: true, force: false });
    restoreAfterSync(backup);
    logInfo("✅ Constraints restored");
    logInfo("✅ Models synchronized");
    process.exit(0);
  } catch (err) {
    logError("❌ Sync failed", err);
    process.exit(1);
  }
};

syncDatabase();
