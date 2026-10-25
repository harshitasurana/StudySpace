import sequelize from '../../../config/database.js';
import { DataTypes } from 'sequelize';
import User from '../../user/user_schema.js';

export const CategoryType = sequelize.define('CategoryType', {
  category_type_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "users",
      key: "user_id",
    },
  },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_by_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    updated_by_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
  tableName: 'category_types',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export const Category = sequelize.define('Category', {
  category_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  category_type_id: {
    type: DataTypes.INTEGER,
    references: {
      model: CategoryType,
      key: 'category_type_id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(50)
  },
  description: {
    type: DataTypes.TEXT
  },
  display_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "users",
      key: "user_id",
    },
  },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_by_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    updated_by_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
  tableName: 'categories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

CategoryType.hasMany(Category, { foreignKey: 'category_type_id' });
Category.belongsTo(CategoryType, { foreignKey: 'category_type_id' });

CategoryType.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator',
  targetKey: 'user_id'
});
Category.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator',
  targetKey: 'user_id'
});
