import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const FeatureAvailability = sequelize.define(
  "FeatureAvailability",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    feature_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "features",
        key: "feature_id",
      },
      onDelete: "CASCADE",
    },
    availability_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "feature_availability_types",
        key: "availability_type_id",
      },
      onDelete: "CASCADE",
    },
  },
  {
    tableName: "feature_availability_map",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["feature_id", "availability_type_id"],
      },
      {
        fields: ["feature_id"],
      },
      {
        fields: ["availability_type_id"],
      },
    ],
  }
);

FeatureAvailability.associate = (models) => {
  FeatureAvailability.belongsTo(models.Feature, {
    foreignKey: "feature_id",
    as: "feature",
  });
  FeatureAvailability.belongsTo(models.AvailabilityType, {
    foreignKey: "availability_type_id",
    as: "availabilityType",
  });
};

export const getLinksByFeatureId = async (featureId) => {
  return await FeatureAvailability.findAll({
    where: { feature_id: featureId },
  });
};

export const getLinksByAvailabilityTypeId = async (availabilityTypeId) => {
  return await FeatureAvailability.findAll({
    where: { availability_type_id: availabilityTypeId },
  });
};

export const createLink = async (featureId, availabilityTypeId) => {
  return await FeatureAvailability.create({
    feature_id: featureId,
    availability_type_id: availabilityTypeId,
  });
};

export const bulkCreateLinks = async (rows) => {
  return await FeatureAvailability.bulkCreate(rows, { ignoreDuplicates: true });
};

export const deleteLinksByFeatureId = async (featureId, transaction = null) => {
  const opts = transaction ? { transaction } : {};
  return await FeatureAvailability.destroy({
    where: { feature_id: featureId },
    ...opts,
  });
};

export const deleteLinksByAvailabilityTypeId = async (availabilityTypeId) => {
  return await FeatureAvailability.destroy({
    where: { availability_type_id: availabilityTypeId },
  });
};

export default FeatureAvailability;
