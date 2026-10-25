import * as RoleTemplateService from "./role_template_service.js";
import { createRoleTemplateSchema, updateRoleTemplateSchema } from "./role_template_validation.js";

export const getAllRoleTemplates = async (req, res) => {
  try {
    const templates = await RoleTemplateService.getAllRoleTemplatesService();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRoleTemplatesWithPagination = async (req, res) => {
  try {
    const { page, limit } = req.query;
    
    if (!page && !limit) {
      const allTemplates = await RoleTemplateService.getAllRoleTemplatesService();
      return res.json({ templates: allTemplates });
    }

    const result = await RoleTemplateService.getRoleTemplatesWithPaginationService(req.queryOptions);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRoleTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await RoleTemplateService.getRoleTemplateByIdService(id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createRoleTemplate = async (req, res) => {
  try {
    const { error } = createRoleTemplateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const userId = req.user?.user_id || null;
    req.body.created_by = userId;
    req.body.created_by_name = [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ').trim() || null;
    req.body.updated_by = userId;
    req.body.updated_by_name = req.body.created_by_name;
    const template = await RoleTemplateService.createRoleTemplateService(req.body);
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateRoleTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = updateRoleTemplateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const userId = req.user?.user_id || null;
    req.body.updated_by = userId;
    req.body.updated_by_name = [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ').trim() || null;
    const [updatedCount, updatedRows] = await RoleTemplateService.updateRoleTemplateService(id, req.body);
    if (!updatedCount) return res.status(404).json({ error: "Template not found or not updated" });
    res.json(updatedRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteRoleTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const [updatedCount] = await RoleTemplateService.deleteRoleTemplateService(id);
    if (!updatedCount) return res.status(404).json({ error: "Template not found or not deleted" });
    res.json({ message: "Template deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
