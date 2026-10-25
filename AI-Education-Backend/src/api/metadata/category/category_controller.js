import * as service from './category_service.js';
import { validationResult } from 'express-validator';
import { createCategoryTypeSchema, updateCategoryTypeSchema, createCategorySchema, updateCategorySchema, categoryTypeParamsSchema, categoryParamsSchema } from './category_validation.js';

export const createCategoryTypeController = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const data = await service.createCategoryTypeService(req.body);
    res.status(201).json({ success: true, data, message: 'Category type created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAllCategoryTypesController = async (req, res) => {
  try {
    const data = await service.getAllCategoryTypesService();
    res.json({ success: true, data, message: 'Category types retrieved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategoryTypeController = async (req, res) => {
  try {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const updated = await service.updateCategoryTypeService(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Category type not found' });
    }
    res.json({ success: true, message: 'Category type updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteCategoryTypeController = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await service.deleteCategoryTypeService(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Category type not found' });
    }
    res.json({ success: true, message: 'Category type deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategoriesController = async (req, res) => {
  try {
    const { type } = req.query;
    let data;
    if (type) {
      data = await service.getCategoriesByTypeService(type);
    } else {
      data = await service.getAllCategoriesService();
    }
    res.json({ success: true, data, message: 'Categories retrieved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategoryController = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const data = await service.createCategoryService(req.body);
    res.status(201).json({ success: true, data, message: 'Category created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getCategoryController = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await service.getCategoryByIdService(id);
    res.json({ success: true, data, message: 'Category retrieved successfully' });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

export const updateCategoryController = async (req, res) => {
  try {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const updated = await service.updateCategoryService(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, message: 'Category updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteCategoryController = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await service.deleteCategoryService(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

