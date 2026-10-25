import sequelize from '../src/config/database.js';
import Feature from '../src/api/feature/feature_schema.js';
import { Category } from '../src/api/metadata/category/category_schema.js';
import { CategoryType } from '../src/api/metadata/category/category_schema.js';
import { CATEGORY_TYPES } from '../src/common/constants/category_types.js';
import { Op } from 'sequelize';

// Define the desired hierarchy for features
const featureHierarchy = {
  // Core Features
  'Core': {
    parent: null,
    children: [
      'Dashboard',
      'Product',
      'Product Management',
      'Billing',
      'Inventory',
      'Supplier List',
      'Stock Alerts',
      'Add Item',
      'Tasks',
      'Contacts',
      'Email',
      'Chat',
      'Product Services',
      'Features',
      'Add Feature',
      'Edit Feature',
      'Feature Orderlist',
      'Medicine Templates',
      'Add Medicine Template',
      'Edit Medicine Template',
      'Doctor List',
      'Manage Doctor',
      'Add Doctor',
      'Edit Doctor',
      'Specialization',
      'Attendance',
      'Industry Management',
      'Inventory Reports',
      'Tests'
    ]
  },
  
  // User Management
  'User Management': {
    parent: null,
    children: [
      'Admin',
      'Admin Dashboard',
      'Admin Roles',
      'Organization',
      'Organization List',
      'Organization Group',
      'Organization Admin Page',
      'user-assignments',
      'Staff',
      'All Staff',
      'Add Staff',
      'Edit Staff',
      'Role Management',
      'Roles',
      'Add Role',
      'Edit Role',
      'Role Profile',
      'Role Template',
      'Permissions',
      'Feature Permissions'
    ]
  },
  
  // Department Management
  'Department Management': {
    parent: null,
    children: [
      'Department',
      'Department List',
      'Add Department',
      'Department Services',
      'Rooms by Department'
    ]
  },
  
  // Patient Management
  'Patient Management': {
    parent: null,
    children: [
      'Patient',
      'Patient List',
      'Add Patient',
      'Edit Patient',
      'Patient Dashboard',
      'Patient Records',
      'patient_records',
      'Patient Appointments',
      'Patient Visit Reports',
      'Medical History',
      'Doctor Profile Patients',
      'Customer Page',
      'Reviews',
      'Doctor Reviews',
      'Patient Reviews',
      'Overview'
    ]
  },
  
  // Medical
  'Medical': {
    parent: null,
    children: [
      'Prescriptions',
      'Prescription List',
      'Add Prescription',
      'prescriptions',
      'Pharmacy',
      'Blood Bank',
      'Blood Stock',
      'Blood Donor'
    ]
  },
  
  // Financial
  'Financial': {
    parent: null,
    children: [
      'Billing enterprise',
      'Subscription',
      'Invoices List',
      'Create Invoice',
      'Payments History',
      'Insurance Claims',
      'Financial Reports'
    ]
  },
  
  // Scheduling
  'Scheduling': {
    parent: null,
    children: [
      'Appointments',
      'All Appointments',
      'Add Appointment',
      'Appointment Request',
      'Calendar View',
      'Calendar',
      'Working Hours',
      'Doctor Schedule',
      'Doctor Profile Appointments',
      'Appointment Reports'
    ]
  },
  
  // Settings
  'Settings': {
    parent: null,
    children: [
      'Settings',
      'General Settings',
      'System Settings',
      'Security Settings',
      'Branding Settings',
      'Preference Settings',
      'Preferences',
      'Profile',
      'Profile Activity',
      'Profile Security',
      'Profile Preferences',
      'Profile Notifications',
      'Manage Preferences',
      'Preferences Manager',
      'Clinic Settings',
      'Doctor Profile Overview',
      'Doctor Profile Performance',
      'Doctor Profile',
      'Configurator',
      'Floating Configurator',
      'Notification'
    ]
  },
  
  // Reporting
  'Reporting': {
    parent: null,
    children: [
      'Reports',
      'reports',
      'Doctor Dashboard',
      'Dashboard'
    ]
  },
  
  // Support
  'Support': {
    parent: null,
    children: [
      'Support Center',
      'Feedback',
      'Language Support'
    ]
  },
  
  // Services
  'Services': {
    parent: null,
    children: [
      'Ambulance',
      'Ambulance List',
      'Ambulance Details',
      'Ambulance Call List',
      'Room Allotment',
      'Alloted Rooms',
      'New Allotment',
      'Add New Room'
    ]
  },
  
  // Records
  'Records': {
    parent: null,
    children: [
      'Record',
      'Birth Record',
      'Death Record'
    ]
  },
  
  // Feature Management
  'Feature Management': {
    parent: null,
    children: []
  },
  
  // Error Pages
  'Error': {
    parent: null,
    children: [
      'Not Found',
      'Access Denied'
    ]
  },
  
  // Layout
  'Layout': {
    parent: null,
    children: [
      'Sidebar',
      'Topbar',
      'Menu',
      'Breadcrumb',
      'Footer'
    ]
  },
  
  // UI
  'UI': {
    parent: null,
    children: [
      'Toast Notifications'
    ]
  },
  
  // Internationalization
  'Internationalization': {
    parent: null,
    children: [
      'Date/Time Formatting',
      'Currency Formatting'
    ]
  },
  
  // Administration
  'Administration': {
    parent: null,
    children: [
      'Audit Logs'
    ]
  }
};

async function reorganizeFeatures() {
  const transaction = await sequelize.transaction();
  
  try {
    // Get all feature categories
    const categoryType = await CategoryType.findOne({
      where: { code: CATEGORY_TYPES.FEATURE, is_active: true },
      transaction
    });

    if (!categoryType) {
      console.error(`Category type '${CATEGORY_TYPES.FEATURE}' not found`);
      process.exit(1);
    }

    const categories = await Category.findAll({
      where: { 
        is_active: true,
        category_type_id: categoryType.category_type_id
      },
      attributes: ['category_id', 'code', 'name'],
      raw: true,
      transaction
    });

    // Create category lookup
    const categoryLookup = {};
    categories.forEach(cat => {
      categoryLookup[cat.name] = cat.category_id;
    });

    // Get all features
    const features = await Feature.findAll({
      where: { is_deleted: false },
      attributes: ['feature_id', 'feature_name', 'category_id', 'menu_order'],
      transaction
    });

    // Create feature lookup
    const featureLookup = {};
    features.forEach(f => {
      featureLookup[f.feature_name] = f.feature_id;
    });

    console.log('🔄 Reorganizing features...');
    let updated = 0;
    let errors = [];

    // Process each category
    for (const [categoryName, data] of Object.entries(featureHierarchy)) {
      const categoryId = categoryLookup[categoryName];
      
      if (!categoryId) {
        console.warn(`⚠️ Category "${categoryName}" not found in database`);
        continue;
      }

      console.log(`\n📁 Processing: ${categoryName}`);
      
      // Get the parent feature if exists
      let parentFeatureId = null;
      if (data.parent) {
        parentFeatureId = featureLookup[data.parent];
        if (!parentFeatureId) {
          console.warn(`⚠️ Parent feature "${data.parent}" not found`);
        }
      }

      // Process each child feature
      for (let i = 0; i < data.children.length; i++) {
        const featureName = data.children[i];
        const featureId = featureLookup[featureName];
        
        if (!featureId) {
          console.warn(`   ❌ Feature "${featureName}" not found`);
          errors.push(`Feature "${featureName}" not found`);
          continue;
        }

        // Update the feature
        await Feature.update(
          {
            category_id: categoryId,
            parent_feature_id: parentFeatureId,
            menu_order: i,
            updated_at: new Date()
          },
          {
            where: { feature_id: featureId },
            transaction
          }
        );
        updated++;
        console.log(`   ✅ ${featureName} → ${categoryName} (order: ${i})`);
      }
    }

    await transaction.commit();
    console.log('\n✅ Transaction committed successfully');
    console.log(`\n📊 Summary:`);
    console.log(`   Total features updated: ${updated}`);
    console.log(`   Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(err => console.log(`   - ${err}`));
    }

  } catch (error) {
    console.error('Error:', error);
    if (transaction) {
      await transaction.rollback();
      console.log('🔄 Transaction rolled back');
    }
    throw error;
  }
}

async function previewReorganization() {
  try {
    console.log('\n🔍 Preview of Feature Reorganization');
    console.log('='.repeat(80));

    for (const [categoryName, data] of Object.entries(featureHierarchy)) {
      console.log(`\n📁 ${categoryName}`);
      console.log('   ' + '-'.repeat(60));
      
      if (data.parent) {
        console.log(`   Parent: ${data.parent}`);
      }
      
      console.log(`   Features (${data.children.length}):`);
      data.children.forEach((feature, index) => {
        console.log(`   ${index + 1}. ${feature}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Execute
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.includes('--preview')) {
    await previewReorganization();
  } else {
    await reorganizeFeatures();
  }
}

export default reorganizeFeatures;