import * as RoleTemplateModel from "./role_template_model.js";

export const getAllRoleTemplatesService = async () => {
  return await RoleTemplateModel.getAllRoleTemplates();
};

export const getRoleTemplatesWithPaginationService = async (queryOptions = {}) => {
  return await RoleTemplateModel.getRoleTemplatesWithPagination(queryOptions);
};

export const getRoleTemplateByIdService = async (template_id) => {
  return await RoleTemplateModel.getRoleTemplateById(template_id);
};

export const createRoleTemplateService = async (data) => {
  if (data.category_id) {
    const { Category } = await import('../metadata/category/category_schema.js');
    const categoryExists = await Category.findByPk(data.category_id);
    if (!categoryExists) throw new Error('Category not found');
  }
  return await RoleTemplateModel.createRoleTemplate(data);
};

export const updateRoleTemplateService = async (template_id, data) => {
  if (data.category_id) {
    const { Category } = await import('../metadata/category/category_schema.js');
    const categoryExists = await Category.findByPk(data.category_id);
    if (!categoryExists) throw new Error('Category not found');
  }
  return await RoleTemplateModel.updateRoleTemplate(template_id, data);
};

export const deleteRoleTemplateService = async (template_id) => {
  return await RoleTemplateModel.deleteRoleTemplate(template_id);
};
