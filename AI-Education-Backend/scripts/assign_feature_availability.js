import sequelize from '../src/config/database.js';
import Feature from '../src/api/feature/feature_schema.js';
import AvailabilityType from '../src/api/feature/feature_availability_schema.js';
import FeatureAvailability from '../src/api/feature/feature_availability_model.js';

const REACT_ONLY_NAMES = [
  // Dashboard
  'Dashboard',

  // Settings
  'Settings',

  // Patient Management
  'Patient', 'Patient List',

  // Doctor Management
  'Doctor List', 'Add Doctor', 'Manage Doctor',

  // Appointment
  'Appointments', 'All Appointments',

  // Staff
  'Staff', 'All Staff',

  // Admin / Management
  'Admin', 'Features', 'Add Feature', 'Edit Feature',
  'Role Management', 'Feature Orderlist',
  'Organization ', 'Organization List', 'Organization Group',
  'user-assignments', 'Feature Permissions',
  'Industy Management', 'Organization Admin Page',

  // Products / Billing
  'Product ', 'Product Management', 'Subscription',
  'Billing enterprise', 'Customer Page',

  // New availability features
  'Feature Availability', 'Feature availability mapping',
];

async function assign() {
  try {
    const react = await AvailabilityType.findOne({ where: { code: 'REACT' } });
    const angular = await AvailabilityType.findOne({ where: { code: 'ANGULAR' } });

    if (!react || !angular) {
      console.error('REACT or ANGULAR type not found. Run migration first.');
      process.exit(1);
    }

    const allFeatures = await Feature.findAll({
      where: { is_deleted: false },
      attributes: ['feature_id', 'feature_name'],
    });

    const reactIds = allFeatures
      .filter(f => REACT_ONLY_NAMES.includes(f.feature_name.trim()))
      .map(f => f.feature_id);

    const reactSet = new Set(reactIds);
    const angularFeatures = allFeatures.filter(f => !reactSet.has(f.feature_id));

    console.log(`REACT ID: ${react.availability_type_id}`);
    console.log(`ANGULAR ID: ${angular.availability_type_id}`);
    console.log(`\nREACT features (${reactIds.length}):`);
    for (const f of allFeatures.filter(f => reactSet.has(f.feature_id))) {
      console.log(`  ${String(f.feature_id).padStart(3)}: ${f.feature_name}`);
    }
    console.log(`\nANGULAR features (${angularFeatures.length}):`);
    for (const f of angularFeatures) {
      console.log(`  ${String(f.feature_id).padStart(3)}: ${f.feature_name}`);
    }

    await FeatureAvailability.destroy({ where: {} });

    const rows = [
      ...reactIds.map(fid => ({ feature_id: fid, availability_type_id: react.availability_type_id })),
      ...angularFeatures.map(f => ({ feature_id: f.feature_id, availability_type_id: angular.availability_type_id })),
    ];

    await FeatureAvailability.bulkCreate(rows, { ignoreDuplicates: true });
    console.log('\nDone.');
  } catch (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

await assign();
