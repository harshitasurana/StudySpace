/**
 * Migration: Dynamic Feature Availability Types
 *
 * Migrates from the static feature_availability STRING column to a FK reference
 * to the new availability_types table.
 *
 * Usage:
 *   node scripts/migrate_feature_availability.js
 *   docker exec -it test-api node scripts/migrate_feature_availability.js
 */

import sequelize from '../src/config/database.js';
import Feature from '../src/api/feature/feature_schema.js';
import AvailabilityType from '../src/api/feature/feature_availability_schema.js';
import { Op } from 'sequelize';

const DEFAULT_TYPES = [
  { code: 'REACT',   name: 'React Web App',   description: 'Available in React web application',     display_order: 1 },
  { code: 'ANGULAR', name: 'Angular Web App',  description: 'Available in Angular web application',   display_order: 2 },
  { code: 'MOBILE',  name: 'Mobile App',       description: 'Available in mobile application',        display_order: 3 },
  { code: 'DESKTOP', name: 'Desktop App',      description: 'Available in desktop application',       display_order: 4 },
  { code: 'API',     name: 'API Only',         description: 'Available only via API',                 display_order: 5 },
];

async function migrateFeatureAvailability() {
  const transaction = await sequelize.transaction();

  try {
    console.log('🔄 Starting migration: Dynamic Availability Types');
    console.log('='.repeat(60));

    // ── Step 1: Sync availability_types table ─────────────────────────
    console.log('\n📝 Step 1: Syncing availability_types table...');
    await AvailabilityType.sync({ alter: false });
    console.log('   ✅ Table ready');

    // ── Step 2: Seed default availability types ───────────────────────
    console.log('\n📝 Step 2: Creating default availability types...');
    const typeMap = {};
    for (const type of DEFAULT_TYPES) {
      const [created, isNew] = await AvailabilityType.findOrCreate({
        where: { code: type.code },
        defaults: {
          ...type,
          created_at: new Date(),
          updated_at: new Date(),
          is_active: true,
        },
        transaction,
      });
      typeMap[type.code] = created.availability_type_id;
      console.log(`   ${isNew ? '✅ Created' : '⏭️  Exists'}: ${type.code} (ID: ${created.availability_type_id})`);
    }

    // ── Step 3: Add availability_type_id column if missing ────────────
    console.log('\n📝 Step 3: Adding availability_type_id column (if not exists)...');
    try {
      await sequelize.query(
        `ALTER TABLE features
           ADD COLUMN IF NOT EXISTS availability_type_id INTEGER
           REFERENCES feature_availability_types(availability_type_id)`,
        { transaction }
      );
      console.log('   ✅ Column added');
    } catch (error) {
      if (error.message.toLowerCase().includes('already exists')) {
        console.log('   ⏭️  Column already exists');
      } else {
        throw error;
      }
    }

    // ── Step 4: Check if old column exists before migrating ──────────
    console.log('\n📝 Step 4: Checking for old feature_availability column...');
    const [colResult] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'features' AND column_name = 'feature_availability'`,
      { transaction }
    );
    const hasOldColumn = colResult.length > 0;
    console.log(`   ${hasOldColumn ? '✅ Found' : '⏭️  Not found'} — old feature_availability column`);

    let updated = 0;
    let skipped = 0;

    if (hasOldColumn) {
      // ── Step 5: Migrate existing feature_availability → FK ────────────
      console.log('\n📝 Step 5: Migrating existing feature_availability values...');
      const [rows] = await sequelize.query(
        `SELECT feature_id, feature_availability
           FROM features
          WHERE feature_availability IS NOT NULL`,
        { transaction }
      );
      console.log(`   Found ${rows.length} feature(s) with availability data`);

      for (const row of rows) {
        const code    = row.feature_availability;
        const typeId  = typeMap[code];

        if (typeId) {
          await sequelize.query(
            `UPDATE features SET availability_type_id = :typeId, updated_at = NOW()
              WHERE feature_id = :featureId`,
            { replacements: { typeId, featureId: row.feature_id }, transaction }
          );
          updated++;
          console.log(`   ✅ Feature ${row.feature_id}: ${code} → availability_type_id ${typeId}`);
        } else {
          skipped++;
          console.warn(`   ⚠️  Feature ${row.feature_id}: no match for code '${code}'`);
        }
      }

      // ── Step 6: Drop the old column ───────────────────────────────────
      console.log('\n📝 Step 6: Dropping old feature_availability column...');
      await sequelize.query(
        'ALTER TABLE features DROP COLUMN IF EXISTS feature_availability',
        { transaction }
      );
      console.log('   ✅ Column removed');

    } else {
      console.log('   ⏭️  Skipping data migration — column already removed');
    }

    await transaction.commit();

    console.log('\n✅ Migration completed successfully!');
    console.log('='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Availability types created/found : ${Object.keys(typeMap).length}`);
    console.log(`   Features updated                : ${updated}`);
    console.log(`   Features skipped (unknown code) : ${skipped}`);

  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ Migration failed — rolled back:', error.message);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

// Execute when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await migrateFeatureAvailability();
}

export default migrateFeatureAvailability;
