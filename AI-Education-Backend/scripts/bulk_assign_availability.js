import sequelize from '../src/config/database.js';
import Feature from '../src/api/feature/feature_schema.js';
import AvailabilityType from '../src/api/feature/feature_availability_schema.js';
import FeatureAvailability from '../src/api/feature/feature_availability_model.js';

// ── EDIT THIS LIST ───────────────────────────────────
// Feature IDs that should be REACT-only (not available in Angular)
const REACT_ONLY_IDS = [
  // Add feature IDs here, e.g. 1, 2, 3
];
// ─────────────────────────────────────────────────────

async function bulkAssignAvailability() {
  try {
    const react = await AvailabilityType.findOne({ where: { code: 'REACT' } });
    const angular = await AvailabilityType.findOne({ where: { code: 'ANGULAR' } });

    if (!react || !angular) {
      console.error('REACT or ANGULAR type not found. Run the migration first.');
      process.exit(1);
    }

    console.log(`REACT ID: ${react.availability_type_id}, ANGULAR ID: ${angular.availability_type_id}`);

    const allFeatures = await Feature.findAll({
      where: { is_deleted: false },
      attributes: ['feature_id', 'feature_name'],
    });

    const bothIds = allFeatures
      .map(f => f.feature_id)
      .filter(id => !REACT_ONLY_IDS.includes(id));

    console.log(`Total features: ${allFeatures.length}`);
    console.log(`REACT only: ${REACT_ONLY_IDS.length}`);
    console.log(`REACT + ANGULAR: ${bothIds.length}`);

    await FeatureAvailability.destroy({ where: {} });

    const rows = [
      ...REACT_ONLY_IDS.map(fid => ({ feature_id: fid, availability_type_id: react.availability_type_id })),
      ...bothIds.flatMap(fid => [
        { feature_id: fid, availability_type_id: react.availability_type_id },
        { feature_id: fid, availability_type_id: angular.availability_type_id },
      ]),
    ];

    await FeatureAvailability.bulkCreate(rows, { ignoreDuplicates: true });
    console.log(`Done — ${REACT_ONLY_IDS.length} REACT-only, ${bothIds.length} REACT+ANGULAR`);
  } catch (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

await bulkAssignAvailability();
