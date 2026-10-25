import sequelize from '../src/config/database.js';
import Feature from '../src/api/feature/feature_schema.js';
import { Category } from '../src/api/metadata/category/category_schema.js';
import { CategoryType } from '../src/api/metadata/category/category_schema.js';
import { CATEGORY_TYPES } from '../src/common/constants/category_types.js';
import { Op } from 'sequelize';

async function viewFeaturesByCategory() {
  try {
    // Get feature category type
    const categoryType = await CategoryType.findOne({
      where: { code: CATEGORY_TYPES.FEATURE, is_active: true }
    });

    if (!categoryType) {
      console.error(`Category type '${CATEGORY_TYPES.FEATURE}' not found`);
      process.exit(1);
    }

    // Get all feature categories
    const categories = await Category.findAll({
      where: { 
        is_active: true,
        category_type_id: categoryType.category_type_id
      },
      attributes: ['category_id', 'code', 'name', 'display_order'],
      order: [['display_order', 'ASC']],
      raw: true
    });

    // Get all features with their categories
    const features = await Feature.findAll({
      where: { is_deleted: false },
      attributes: [
        'feature_id', 
        'feature_name', 
        'category_id',
        'is_active',
        'show_in_menu',
        'menu_order',
        'parent_feature_id',
        'description'
      ],
      order: [
        ['category_id', 'ASC'],
        ['menu_order', 'ASC'],
        ['feature_name', 'ASC']
      ],
      raw: true
    });

    // Group features by category
    const groupedFeatures = {};
    const uncategorized = [];

    features.forEach(feature => {
      if (feature.category_id) {
        if (!groupedFeatures[feature.category_id]) {
          groupedFeatures[feature.category_id] = [];
        }
        groupedFeatures[feature.category_id].push(feature);
      } else {
        uncategorized.push(feature);
      }
    });

    // Display results
    console.log('\n📊 FEATURES BY CATEGORY');
    console.log('='.repeat(80));
    console.log(`Total Features: ${features.length}`);
    console.log(`Total Categories: ${categories.length}`);
    console.log('='.repeat(80));

    let totalByCategory = 0;

    // Display categorized features
    categories.forEach(category => {
      const catFeatures = groupedFeatures[category.category_id] || [];
      totalByCategory += catFeatures.length;

      console.log(`\n📁 ${category.name} (${category.code})`);
      console.log(`   Features: ${catFeatures.length}`);
      console.log('   ' + '-'.repeat(60));

      if (catFeatures.length === 0) {
        console.log('   ⚠️  No features in this category');
        return;
      }

      // Show parent features first
      const parentFeatures = catFeatures.filter(f => !f.parent_feature_id);
      const childFeatures = catFeatures.filter(f => f.parent_feature_id);

      // Display parent features
      parentFeatures.forEach(f => {
        console.log(`   📌 ${f.feature_name} ${f.is_active ? '✅' : '❌'} ${f.show_in_menu ? '👁️' : '🔒'}`);
        if (f.description) {
          console.log(`      📝 ${f.description.substring(0, 60)}${f.description.length > 60 ? '...' : ''}`);
        }
        // Find and display children
        const children = childFeatures.filter(c => c.parent_feature_id === f.feature_id);
        children.forEach(child => {
          console.log(`      └─ ${child.feature_name} ${child.is_active ? '✅' : '❌'}`);
          if (child.description) {
            console.log(`         📝 ${child.description.substring(0, 50)}${child.description.length > 50 ? '...' : ''}`);
          }
        });
      });

      // Display child features without parent (orphans)
      const orphans = childFeatures.filter(c => !parentFeatures.some(p => p.feature_id === c.parent_feature_id));
      if (orphans.length > 0) {
        console.log(`   📌 Orphaned features (no parent):`);
        orphans.forEach(f => {
          console.log(`      └─ ${f.feature_name} ${f.is_active ? '✅' : '❌'}`);
        });
      }
    });

    // Display uncategorized features
    if (uncategorized.length > 0) {
      console.log(`\n📂 Uncategorized Features (${uncategorized.length})`);
      console.log('   ' + '-'.repeat(60));
      uncategorized.forEach(f => {
        console.log(`   📌 ${f.feature_name} ${f.is_active ? '✅' : '❌'}`);
      });
    }

    // Summary
    console.log('\n📈 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Features: ${features.length}`);
    console.log(`Categorized: ${totalByCategory}`);
    console.log(`Uncategorized: ${uncategorized.length}`);
    console.log(`Categories used: ${Object.keys(groupedFeatures).filter(id => groupedFeatures[id].length > 0).length}`);
    console.log(`Empty categories: ${categories.length - Object.keys(groupedFeatures).filter(id => groupedFeatures[id].length > 0).length}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Execute
if (import.meta.url === `file://${process.argv[1]}`) {
  await viewFeaturesByCategory();
}

export default viewFeaturesByCategory;