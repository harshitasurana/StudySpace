import { DataTypes } from "sequelize";

/**
 * Standard 6 audit field attributes for Sequelize model definitions:
 * - created_at
 * - updated_at
 * - created_by
 * - updated_by
 * - created_by_name
 * - updated_by_name
 */
export const auditModelAttributes = {
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
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
};

/**
 * Standard filter fields for audit schema queries
 */
export const AUDIT_FILTER_FIELDS = {
  exact: ["created_by", "updated_by"],
  rangeDate: ["created_at", "updated_at"],
  rangeNumber: ["created_by", "updated_by"],
  sortable: ["created_at", "updated_at", "created_by", "updated_by", "created_by_name", "updated_by_name"],
  searchable: ["created_by_name", "updated_by_name"],
};

export default auditModelAttributes;
