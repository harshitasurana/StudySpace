import sequelize from '../src/config/database.js';
import Feature from '../src/api/feature/feature_schema.js';
import { Category } from '../src/api/metadata/category/category_schema.js';
import { CategoryType } from '../src/api/metadata/category/category_schema.js';
import { CATEGORY_TYPES } from '../src/common/constants/category_types.js';
import { Op } from 'sequelize';

// Category mapping based on feature name patterns
const categoryMapping = [
  // Core features
  {
    pattern: /^(core|Product|Billing|Subscription|Customer|Supplier|Inventory)/i,
    categoryCode: 'core'
  },
  // User Management
  {
    pattern: /(User|Admin|Organization|Staff|Role|Permission|Feature Permission)/i,
    categoryCode: 'user_management'
  },
  // Department Management
  {
    pattern: /(Department|Team|Group)/i,
    categoryCode: 'department_management'
  },
  // Financial
  {
    pattern: /(Financial|Billing|Payment|Invoice|Revenue|Budget|Accounting)/i,
    categoryCode: 'financial'
  },
  // Patient Management (for healthcare)
  {
    pattern: /(Patient|Visit|Admission|Discharge)/i,
    categoryCode: 'patient_management'
  },
  // Medical
  {
    pattern: /(Medical|Clinical|Diagnosis|Treatment|Prescription|Lab|Radiology)/i,
    categoryCode: 'medical'
  },
  // Scheduling/Appointment
  {
    pattern: /(Schedule|Appointment|Booking|Calendar|Availability)/i,
    categoryCode: 'scheduling'
  },
  // Reporting
  {
    pattern: /(Report|Analytics|Dashboard|Statistic)/i,
    categoryCode: 'reporting'
  },
  // Settings
  {
    pattern: /(Setting|Configuration|Preference|Profile)/i,
    categoryCode: 'settings'
  },
  // Support
  {
    pattern: /(Support|Help|Ticket|Complaint|Feedback)/i,
    categoryCode: 'support'
  },
  // Records
  {
    pattern: /(Record|Document|File|Archive)/i,
    categoryCode: 'records'
  }
];

// Manual assignments for specific features by exact name
const manualAssignments = {
  'Customer Page': 'patient_management',
  'Product Management': 'core',
  'Product ': 'core',
  'Supplier List': 'core',
  'Organization Admin Page': 'user_management',
  'Industry Management': 'user_management',
  'Feature Permissions': 'user_management',
  'TEST2': 'core',
  'Subscription': 'financial',
  'Billing enterprise': 'financial',
  'Billing': 'core', // Keep Billing in Core
};

async function updateFeatureCategories() {
  let transaction;
  
  try {
    // Start transaction
    transaction = await sequelize.transaction();

    // Get feature category type
    const categoryType = await CategoryType.findOne({
      where: { code: CATEGORY_TYPES.FEATURE, is_active: true },
      transaction
    });

    if (!categoryType) {
      console.error(`Category type '${CATEGORY_TYPES.FEATURE}' not found`);
      process.exit(1);
    }

    // Get all feature categories
    const featureCategories = await Category.findAll({
      where: { 
        is_active: true,
        category_type_id: categoryType.category_type_id
      },
      attributes: ['category_id', 'code', 'name'],
      raw: true,
      transaction
    });

    // Create a map for quick lookup
    const categoryMap = {};
    featureCategories.forEach(cat => {
      categoryMap[cat.code] = cat.category_id;
    });

    console.log('Available feature categories:');
    featureCategories.forEach(cat => {
      console.log(`  ${cat.code} (${cat.category_id}): ${cat.name}`);
    });

    // Get all features
    const features = await Feature.findAll({
      where: { is_deleted: false },
      attributes: ['feature_id', 'feature_name', 'category_id'],
      transaction
    });

    console.log(`\nFound ${features.length} features to process`);
    
    let updated = 0;
    let skipped = 0;
    const updates = [];

    for (const feature of features) {
      let newCategoryCode = null;
      let newCategoryId = null;
      
      // Check manual assignments first
      if (manualAssignments[feature.feature_name]) {
        newCategoryCode = manualAssignments[feature.feature_name];
        newCategoryId = categoryMap[newCategoryCode];
      } else {
        // Check pattern matching
        for (const mapping of categoryMapping) {
          if (mapping.pattern.test(feature.feature_name)) {
            newCategoryCode = mapping.categoryCode;
            newCategoryId = categoryMap[newCategoryCode];
            break;
          }
        }
      }

      // Skip if no category found
      if (!newCategoryId) {
        skipped++;
        continue;
      }

      // Only update if category is different
      if (feature.category_id !== newCategoryId) {
        updates.push({
          feature_id: feature.feature_id,
          feature_name: feature.feature_name,
          old_category_id: feature.category_id,
          new_category_id: newCategoryId,
          new_category_code: newCategoryCode
        });
        
        await Feature.update(
          { 
            category_id: newCategoryId,
            updated_at: new Date()
          },
          { 
            where: { feature_id: feature.feature_id },
            transaction 
          }
        );
        updated++;
      }
    }

    // Commit transaction
    await transaction.commit();
    console.log('✅ Transaction committed successfully');

    // Print summary
    console.log('\n=== Category Update Summary ===');
    console.log(`Total features processed: ${features.length}`);
    console.log(`Features updated: ${updated}`);
    console.log(`Features skipped: ${skipped}`);
    
    if (updates.length > 0) {
      console.log('\n=== Updated Features ===');
      updates.forEach(u => {
        const oldCat = featureCategories.find(c => c.category_id === u.old_category_id);
        console.log(`✅ ${u.feature_name}: ${oldCat?.name || 'Uncategorized'} → ${u.new_category_code}`);
      });
    }

    console.log('\n=== Feature Category Distribution ===');
    const distribution = {};
    const allFeatures = await Feature.findAll({
      where: { is_deleted: false },
      attributes: ['category_id'],
      raw: true
    });

    allFeatures.forEach(f => {
      const catId = f.category_id || 'uncategorized';
      distribution[catId] = (distribution[catId] || 0) + 1;
    });

    // Get category names
    const allCategories = await Category.findAll({
      where: { 
        is_active: true,
        category_type_id: categoryType.category_type_id
      },
      attributes: ['category_id', 'name'],
      raw: true
    });

    const catNames = {};
    allCategories.forEach(c => {
      catNames[c.category_id] = c.name;
    });
    catNames['uncategorized'] = 'Uncategorized';

    Object.keys(distribution).sort().forEach(catId => {
      console.log(`${catNames[catId] || catId}: ${distribution[catId]} features`);
    });

  } catch (error) {
    console.error('Error updating feature categories:', error);
    // Only rollback if transaction exists and is not finished
    if (transaction && transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
      try {
        await transaction.rollback();
        console.log('🔄 Transaction rolled back');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
    throw error;
  }
}

// Function to preview changes without updating
async function previewCategoryUpdates() {
  try {
    // Get feature category type
    const categoryType = await CategoryType.findOne({
      where: { code: CATEGORY_TYPES.FEATURE, is_active: true }
    });

    if (!categoryType) {
      console.error(`Category type '${CATEGORY_TYPES.FEATURE}' not found`);
      process.exit(1);
    }

    const featureCategories = await Category.findAll({
      where: { 
        is_active: true,
        category_type_id: categoryType.category_type_id
      },
      attributes: ['category_id', 'code', 'name'],
      raw: true
    });

    const categoryMap = {};
    featureCategories.forEach(cat => {
      categoryMap[cat.code] = cat.category_id;
    });

    const features = await Feature.findAll({
      where: { is_deleted: false },
      attributes: ['feature_id', 'feature_name', 'category_id']
    });

    console.log('\n=== Preview: Suggested Category Changes ===');
    let changes = 0;

    for (const feature of features) {
      let newCategoryCode = null;
      let newCategoryId = null;
      
      if (manualAssignments[feature.feature_name]) {
        newCategoryCode = manualAssignments[feature.feature_name];
        newCategoryId = categoryMap[newCategoryCode];
      } else {
        for (const mapping of categoryMapping) {
          if (mapping.pattern.test(feature.feature_name)) {
            newCategoryCode = mapping.categoryCode;
            newCategoryId = categoryMap[newCategoryCode];
            break;
          }
        }
      }

      if (newCategoryId && feature.category_id !== newCategoryId) {
        const oldCat = featureCategories.find(c => c.category_id === feature.category_id);
        console.log(`🔄 ${feature.feature_name}: ${oldCat?.name || 'Uncategorized'} → ${newCategoryCode}`);
        changes++;
      }
    }

    console.log(`\nTotal suggested changes: ${changes}`);
    console.log('Run without --preview to apply these changes.');
  } catch (error) {
    console.error('Error previewing changes:', error);
  }
}

// Execute
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.includes('--preview')) {
    await previewCategoryUpdates();
  } else {
    await updateFeatureCategories();
  }
}

export default updateFeatureCategories;