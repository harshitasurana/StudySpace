import { CategoryType, Category } from './category_schema.js';
import { Op } from 'sequelize';
import User from '../../user/user_schema.js';

const creatorInclude = {
  model: User,
  as: 'creator',
  attributes: ['user_id', 'first_name', 'last_name'],
  required: false,
};

const mapCreatedByName = (record) => {
  if (!record) return record;
  const json = record.toJSON ? record.toJSON() : record;
  return { ...json, created_by_name: json.creator ? `${json.creator.first_name} ${json.creator.last_name}`.trim() : null };
};

export const findCategoryTypeByCode = async (code) => {
  return CategoryType.findOne({
    where: {
      code,
      is_active: true
    }
  });
};

export const createCategoryType = async (data) => {
  return CategoryType.create(data);
};

export const updateCategoryType = async (id, data) => {
  const [updated] = await CategoryType.update(data, {
    where: { category_type_id: id }
  });
  return updated > 0;
};

export const deleteCategoryType = async (id) => {
  const [deleted] = await CategoryType.update({ is_active: false }, {
    where: { category_type_id: id }
  });
  return deleted > 0;
};

export const findAllCategoryTypes = async () => {
  const rows = await CategoryType.findAll({
    where: { is_active: true },
    include: [creatorInclude],
    order: [['name', 'ASC']]
  });
  return rows.map(mapCreatedByName);
};

export const findCategoriesByTypeCode = async (typeCode) => {
  const type = await findCategoryTypeByCode(typeCode);
  if (!type) return [];
  const rows = await Category.findAll({
    where: {
      category_type_id: type.category_type_id,
      is_active: true
    },
    include: [creatorInclude],
    order: [
      ['display_order', 'ASC'],
      ['name', 'ASC']
    ]
  });
  return rows.map(mapCreatedByName);
};

export const createCategory = async (data) => {
  return Category.create(data);
};

export const findAllCategories = async () => {
  const rows = await Category.findAll({
    where: { is_active: true },
    include: [
      { model: CategoryType, attributes: ['name', 'code'] },
      creatorInclude,
    ],
    order: [['display_order', 'ASC']]
  });
  return rows.map(mapCreatedByName);
};

export const findCategoryById = async (id) => {
  const record = await Category.findOne({
    where: { category_id: id, is_active: true },
    include: [
      { model: CategoryType },
      creatorInclude,
    ]
  });
  return mapCreatedByName(record);
};

export const updateCategory = async (id, data) => {
  const [updated] = await Category.update(data, { where: { category_id: id } });
  return updated > 0;
};

export const deleteCategory = async (id) => {
  const [deleted] = await Category.update({ is_active: false }, { where: { category_id: id } });
  return deleted > 0;
};
