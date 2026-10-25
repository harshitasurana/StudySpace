import { apiRequest } from "./axios";

const BASE = "/metadata/category";

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

/* ----------------------------- Category Types ---------------------------- */

/**
 * Get all category types.
 * @param {{ search?: string }} [params]
 */
export const getCategoryTypes = async (params = {}) => {
  const response = await apiRequest.get(`${BASE}/category-types`, { params });
  return unwrap(response) || [];
};

export const createCategoryType = async (data) => {
  const response = await apiRequest.post(`${BASE}/category-types`, data);
  return unwrap(response);
};

export const updateCategoryType = async (id, data) => {
  const response = await apiRequest.put(`${BASE}/category-types/${id}`, data);
  return unwrap(response);
};

export const deleteCategoryType = async (id) => {
  const response = await apiRequest.delete(`${BASE}/category-types/${id}`);
  return unwrap(response);
};

/* -------------------------------- Categories ------------------------------ */

/**
 * Get categories, optionally filtered by category type code.
 * @param {{ type?: string }} [params]
 */
export const getCategories = async (params = {}) => {
  const response = await apiRequest.get(`${BASE}/categories`, { params });
  return unwrap(response) || [];
};

export const getCategoryById = async (id) => {
  const response = await apiRequest.get(`${BASE}/categories/${id}`);
  return unwrap(response);
};

export const createCategory = async (data) => {
  const response = await apiRequest.post(`${BASE}/categories`, data);
  return unwrap(response);
};

export const updateCategory = async (id, data) => {
  const response = await apiRequest.put(`${BASE}/categories/${id}`, data);
  return unwrap(response);
};

export const deleteCategory = async (id) => {
  const response = await apiRequest.delete(`${BASE}/categories/${id}`);
  return unwrap(response);
};

export default {
  getCategoryTypes,
  createCategoryType,
  updateCategoryType,
  deleteCategoryType,
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};