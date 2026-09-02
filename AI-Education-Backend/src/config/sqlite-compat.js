/**
 * SQLite compatibility shim for Sequelize.
 *
 * SQLite does not support DataTypes.ARRAY, DataTypes.ENUM, or DataTypes.JSONB.
 * When USE_SQLITE=true, this module patches the Sequelize DataTypes object so
 * that any schema using those types transparently falls back to SQLite-safe types:
 *   - ARRAY(*)  →  TEXT  (serialised as JSON string on write/read)
 *   - ENUM(...) →  STRING
 *   - JSONB     →  JSON  (Sequelize serialises/deserialises automatically)
 *
 * Import this file ONCE at the very top of server.js / seed-db.js BEFORE any
 * model/schema is imported so the patched DataTypes is picked up everywhere.
 */

import Sequelize from 'sequelize';
const { DataTypes } = Sequelize;

if (process.env.USE_SQLITE === 'true') {
  // ── ARRAY ──────────────────────────────────────────────────────────────────
  // Replace the ARRAY constructor with a function that returns a TEXT type
  // that auto-serialises/deserialises JSON arrays.
  const originalArray = DataTypes.ARRAY;
  DataTypes.ARRAY = function patchedArray() {
    const textType = DataTypes.TEXT.call(this);
    textType.prototype = Object.create(DataTypes.TEXT.prototype);
    return textType;
  };
  // Preserve any static props that might be used elsewhere
  if (originalArray) {
    Object.assign(DataTypes.ARRAY, originalArray);
  }

  // ── ENUM ───────────────────────────────────────────────────────────────────
  // SQLite has no native ENUM; fall back to STRING (varchar).
  const originalEnum = DataTypes.ENUM;
  DataTypes.ENUM = function patchedEnum(...args) {
    // Sequelize uses ENUM.call(this, ...args) in schema definitions;
    // just return a STRING instance instead.
    return DataTypes.STRING.call(this, 255);
  };
  if (originalEnum) {
    Object.assign(DataTypes.ENUM, originalEnum);
  }

  // ── JSONB ──────────────────────────────────────────────────────────────────
  // JSONB is postgres-specific; Sequelize's JSON type works with SQLite.
  DataTypes.JSONB = DataTypes.JSON;
}
