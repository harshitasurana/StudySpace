import sequelize from '../src/config/database.js';
import Feature from '../src/api/feature/feature_schema.js';

const features = await Feature.findAll({
  where: { is_deleted: false },
  attributes: ['feature_id', 'feature_name'],
});

console.log('Existing feature IDs:');
for (const f of features) {
  console.log(`  ${String(f.feature_id).padStart(3)}: ${f.feature_name}`);
}

// Check which hardcoded IDs are invalid
const reactOnlyIds = [
  1, 3, 24, 29, 31, 40, 43, 49, 51, 59, 69, 100, 109,
  119, 176, 229, 230, 231, 232, 233, 235, 236, 242, 244, 245, 246,
];

const existingIds = new Set(features.map(f => f.feature_id));
console.log('\nInvalid IDs (not in DB):');
for (const id of reactOnlyIds) {
  if (!existingIds.has(id)) console.log(`  ${id}`);
}

await sequelize.close();
