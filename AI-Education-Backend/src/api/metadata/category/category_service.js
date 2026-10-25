import * as model from './category_model.js';

export const createCategoryTypeService = async (data) => {
  const existing = await model.findCategoryTypeByCode(data.code);
  if (existing) throw new Error('Category type code already exists');
  return model.createCategoryType(data);
};

export const getAllCategoryTypesService = async () => {
  return model.findAllCategoryTypes();
};

export const updateCategoryTypeService = async (id, data) => {
  return model.updateCategoryType(id, data);
};

export const deleteCategoryTypeService = async (id) => {
  return model.deleteCategoryType(id);
};

export const getCategoriesByTypeService = async (typeCode) => {
  return model.findCategoriesByTypeCode(typeCode);
};

export const getAllCategoriesService = async () => {
  return model.findAllCategories();
};

export const createCategoryService = async (data) => {
  const type = await model.findCategoryTypeByCode(data.type);
  if (!type) throw new Error('Category type not found');
  return model.createCategory({
    ...data,
    category_type_id: type.category_type_id,
    code: data.code || data.name.toLowerCase().replace(/\\s+/g, '_')
  });
};

export const getCategoryByIdService = async (id) => {
  const cat = await model.findCategoryById(id);
  if (!cat) throw new Error('Category not found');
  return cat;
};

export const updateCategoryService = async (id, data) => {
  const cat = await model.findCategoryById(id);
  if (!cat) throw new Error('Category not found');
  if (data.type) {
    const type = await model.findCategoryTypeByCode(data.type);
    if (!type) throw new Error('Category type not found');
    data.category_type_id = type.category_type_id;
  }
  return model.updateCategory(id, data);
};

export const deleteCategoryService = async (id) => {
  return model.deleteCategory(id);
};
