import 'dotenv/config';
import '../src/config/sqlite-compat.js';
import models from "../src/models/model.js";

(async () => {
  try {
    await models.sequelize.authenticate();
    console.log("✅ DB connected");

    const Feature = models.Feature;

    const commFeature = await Feature.findOne({ where: { feature_name: 'Communication' } });
    if (!commFeature) {
      console.error("❌ Communication feature not found!");
      process.exit(1);
    }

    console.log(`ℹ️ Found Communication feature with ID: ${commFeature.feature_name} (${commFeature.feature_id})`);

    const [calUpdated] = await Feature.update(
      {
        parent_feature_id: commFeature.feature_id,
        router_link: '/communication/calendar'
      },
      { where: { feature_name: 'Calendar' } }
    );
    console.log(`✅ Updated Calendar feature: ${calUpdated}`);

    const [conUpdated] = await Feature.update(
      {
        parent_feature_id: commFeature.feature_id,
        router_link: '/communication/contacts'
      },
      { where: { feature_name: 'Contacts' } }
    );
    console.log(`✅ Updated Contacts feature: ${conUpdated}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed", err);
    process.exit(1);
  }
})();
