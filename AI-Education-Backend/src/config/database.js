import Sequelize, { DataTypes } from "sequelize";
import { logError, logInfo } from "../common/utils/logger.js";

// ── SQLite compatibility patches ─────────────────────────────────────────────
// SQLite does not natively support ARRAY, ENUM, or JSONB. When USE_SQLITE=true
// we monkey-patch DataTypes in-place before any model is loaded so that all
// schemas work transparently on SQLite without changing individual schema files.
if (process.env.USE_SQLITE === 'true') {
  // ── ENUM → VARCHAR(255) ────────────────────────────────────────────────────
  // Subclass ENUM so `instanceof DataTypes.ENUM` checks still pass (required
  // by Sequelize's normalizeAttribute), but toSql emits VARCHAR(255).
  const OriginalEnum = DataTypes.ENUM;
  class SqliteEnum extends OriginalEnum {
    toSql() { return 'VARCHAR(255)'; }
    static get key() { return 'ENUM'; }
  }
  // Allow calling without `new`, matching Sequelize's classToInvokable pattern
  const EnumProxy = new Proxy(SqliteEnum, {
    apply(target, _thisArg, args) { return new target(...args); },
    construct(target, args) { return new target(...args); },
    get(target, prop) {
      // instanceof checks rely on Symbol.hasInstance on the original class
      if (prop === Symbol.hasInstance) {
        return (inst) => inst instanceof OriginalEnum;
      }
      return Reflect.get(target, prop);
    },
  });
  DataTypes.ENUM = EnumProxy;

  // ── ARRAY → TEXT ───────────────────────────────────────────────────────────
  // Subclass ARRAY so `instanceof DataTypes.ARRAY` checks still pass, but
  // toSql emits TEXT (values stored/retrieved as JSON strings).
  const OriginalArray = DataTypes.ARRAY;
  class SqliteArray extends OriginalArray {
    constructor(type) {
      // Provide a dummy TEXT sub-type so Sequelize's !type.type guard passes
      super(type || DataTypes.TEXT);
    }
    toSql() { return 'TEXT'; }
    static get key() { return 'ARRAY'; }
  }
  const ArrayProxy = new Proxy(SqliteArray, {
    apply(target, _thisArg, args) { return new target(...args); },
    construct(target, args) { return new target(...args); },
    get(target, prop) {
      if (prop === Symbol.hasInstance) {
        return (inst) => inst instanceof OriginalArray;
      }
      return Reflect.get(target, prop);
    },
  });
  DataTypes.ARRAY = ArrayProxy;

  // ── JSONB → JSON ───────────────────────────────────────────────────────────
  // JSONB is PostgreSQL-only; Sequelize's JSON type works fine with SQLite.
  DataTypes.JSONB = DataTypes.JSON;
}
// ─────────────────────────────────────────────────────────────────────────────



import path from "path";
import { fileURLToPath } from "url";

const useSqlite = process.env.USE_SQLITE === 'true';
const databaseUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqliteStoragePath = path.resolve(__dirname, "../../healthcare.db");

const sequelize = useSqlite
  ? new Sequelize({
      dialect: "sqlite",
      storage: sqliteStoragePath,
      logging: false,
      foreignKeys: false,
      dialectOptions: {
        timeout: 15000 // 15 seconds busy timeout
      }
    })
  : new Sequelize(databaseUrl, {
      dialect: "postgres",
      logging: false, 
    });


// ── SQLite: relax NOT NULL and strip FK references on all models ──────────────
// 1. created_by is often allowNull:false but must be nullable for seed ordering.
// 2. The `references` key in attribute definitions causes SQLite to generate
//    REFERENCES clauses in DDL which then enforces FK constraints at insert time,
//    causing errors when parent rows don't exist yet. Removing `references` keeps
//    the column but drops the DB-level FK — associations still work via Sequelize.
if (process.env.USE_SQLITE === 'true') {
  sequelize.addHook('afterDefine', (model) => {
    for (const attr of Object.values(model.rawAttributes || {})) {
      // Relax created_by NOT NULL
      if (attr.fieldName === 'created_by') {
        attr.allowNull = true;
      }
      // Remove DB-level FK references so SQLite doesn't enforce them
      if (attr.references) {
        delete attr.references;
      }
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// Test the connection
sequelize.authenticate()
  .then(async () => {
    logInfo(`✅ Sequelize connected to Database`);
    if (useSqlite) {
      await sequelize.query('PRAGMA journal_mode=WAL;');
      logInfo('SQLite: journal_mode set to WAL');
    }
  })
  .catch((err) => {
    console.error("❌ Sequelize connection error:", err);
  });

export default sequelize;