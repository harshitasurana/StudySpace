import RoleTemplate from "./role_template_schema.js";
import Feature from "../feature/feature_schema.js";
import User from "../user/user_schema.js";
import { Op } from "sequelize";
import { buildWhere } from "../../common/utils/buildWhere.js";
import { ROLE_TEMPLATE_FILTER_SCHEMA } from "./role_template.filter.schema.js";

const creatorInclude = {
  model: User,
  as: 'creator',
  attributes: ['user_id', 'first_name', 'last_name'],
  required: false,
};

const updaterInclude = {
  model: User,
  as: 'updater',
  attributes: ['user_id', 'first_name', 'last_name'],
  required: false,
};

const mapCreatedByName = (record) => {
  if (!record) return record;
  const json = typeof record.toJSON === 'function' ? record.toJSON() : record;
  return {
    ...json,
    created_by_name: json.creator ? `${json.creator.first_name} ${json.creator.last_name}`.trim() : null,
    updated_by_name: json.updater ? `${json.updater.first_name} ${json.updater.last_name}`.trim() : null,
  };
};

export const getAllRoleTemplates = async () => {
  const { Category } = await import('../metadata/category/category_schema.js');

  const templates = await RoleTemplate.findAll({
    attributes: [
      "template_id",
      "name",
      "category_id",
      "description",
      "permissions",
      "status",
      "created_at",
      "updated_at"
    ],
    include: [{
      model: Category,
      as: 'category',
      attributes: [['name', 'category_name']],
      required: false
    }, creatorInclude, updaterInclude],
    where: { is_deleted: false },
    order: [["template_id", "ASC"]],
  });

  // Enrich permissions with feature_name and flatten category
  const enriched = await enrichPermissionsWithFeatureNames(templates);
  return enriched.map(mapCreatedByName);
};

export const getRoleTemplatesWithPagination = async (queryOptions = {}) => {
  const {
    page = 1,
    limit = 10,
    offset = (page - 1) * limit,
    sort = [['template_id', 'ASC']],
    search,
    filters = {}
  } = queryOptions;

  const where = buildWhere({
    baseWhere: { is_deleted: false },
    search,
    filters,
    schema: ROLE_TEMPLATE_FILTER_SCHEMA
  });

  const { Category } = await import('../metadata/category/category_schema.js');

  const { count, rows } = await RoleTemplate.findAndCountAll({
    where,
    attributes: [
      "template_id",
      "name",
      "category_id",
      "description",
      "permissions",
      "status",
      "created_at",
      "updated_at"
    ],
    include: [{
      model: Category,
      as: 'category',
      attributes: [['name', 'category_name']],
      required: false
    }, creatorInclude, updaterInclude],
    order: sort,
    limit,
    offset,
  });

  const totalPages = Math.ceil(count / limit);

  // Enrich permissions with feature_name and flatten category
  const enrichedTemplates = (await enrichPermissionsWithFeatureNames(rows)).map(mapCreatedByName);

  return {
    templates: enrichedTemplates,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: count,
      itemsPerPage: limit,
    },
  };
};

export const getRoleTemplateById = async (template_id) => {
  const { Category } = await import('../metadata/category/category_schema.js');

  const template = await RoleTemplate.findOne({
    where: { template_id, is_deleted: false },
    attributes: [
      "template_id",
      "name",
      "category_id",
      "description",
      "permissions",
      "status",
      "created_at",
      "updated_at"
    ],
    include: [{
      model: Category,
      as: 'category',
      attributes: [['name', 'category_name']],
      required: false
    }, creatorInclude, updaterInclude],
  });

  if (!template) return null;

  // Enrich permissions with feature_name and flatten category
  const templates = await enrichPermissionsWithFeatureNames([template]);
  return mapCreatedByName(templates[0]);
};

export const createRoleTemplate = async (data) => {
  const template = await RoleTemplate.create(data);
  const record = await RoleTemplate.findByPk(template.template_id, {
    include: [{
      model: (await import('../metadata/category/category_schema.js')).Category,
      as: 'category',
      attributes: [['name', 'category_name']],
      required: false
    }, creatorInclude, updaterInclude]
  });
  // Enrich permissions with feature_name
  const templates = await enrichPermissionsWithFeatureNames([record]);
  return mapCreatedByName(templates[0]);
};

export const updateRoleTemplate = async (template_id, data) => {
  const [updatedCount] = await RoleTemplate.update(data, {
    where: { template_id, is_deleted: false },
  });
  
  if (updatedCount === 0) {
    return [0, []];
  }
  
  const record = await RoleTemplate.findByPk(template_id, {
    include: [{
      model: (await import('../metadata/category/category_schema.js')).Category,
      as: 'category',
      attributes: [['name', 'category_name']],
      required: false
    }, creatorInclude, updaterInclude]
  });
  // Enrich permissions with feature_name
  const enrichedTemplates = await enrichPermissionsWithFeatureNames([record]);
  return [updatedCount, enrichedTemplates.map(mapCreatedByName)];
};

export const deleteRoleTemplate = async (template_id) => {
  return await RoleTemplate.update(
    { is_deleted: true },
    { where: { template_id } }
  );
};

// Helper function to enrich permissions with feature names
const enrichPermissionsWithFeatureNames = async (templates) => {
  if (!templates || templates.length === 0) return templates;

  // Get all unique feature_ids from all templates
  const featureIdsSet = new Set();
  templates.forEach(template => {
    if (template.permissions && Array.isArray(template.permissions)) {
      template.permissions.forEach(perm => {
        if (perm.feature_id) {
          featureIdsSet.add(perm.feature_id);
        }
      });
    }
  });

  const featureIds = Array.from(featureIdsSet);

  // Fetch all features in one query
  let featuresMap = {};
  if (featureIds.length > 0) {
    const features = await Feature.findAll({
      where: {
        feature_id: { [Op.in]: featureIds },
        is_deleted: false,
      },
      attributes: ['feature_id', 'feature_name'],
      raw: true,
    });

    features.forEach(feature => {
      featuresMap[feature.feature_id] = feature.feature_name;
    });
  }

  // Enrich each template's permissions with feature_name and flatten category
  return templates.map(template => {
    const templateData = template.toJSON ? template.toJSON() : template;
    
    // Flatten category_name from the included Category association
    if (templateData.category) {
      templateData.category_name = templateData.category.category_name || null;
      delete templateData.category;
    } else {
      templateData.category_name = null;
    }
    
    if (templateData.permissions && Array.isArray(templateData.permissions)) {
      templateData.permissions = templateData.permissions.map(perm => ({
        ...perm,
        feature_name: perm.feature_id ? featuresMap[perm.feature_id] || null : null,
      }));
    }

    return templateData;
  });
};
