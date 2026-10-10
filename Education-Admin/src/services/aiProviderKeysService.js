import { apiRequest } from "./axios";

const BASE = "/admin/ai-provider-keys";

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

export const getAiProviderKeys = async () => {
  const response = await apiRequest.get(BASE);
  return unwrap(response) || [];
};

export const getAiProviderKey = async (id) => {
  const response = await apiRequest.get(`${BASE}/${id}`);
  return unwrap(response);
};

export const createAiProviderKey = async (data) => {
  const response = await apiRequest.post(BASE, data);
  return unwrap(response);
};

export const updateAiProviderKey = async (id, data) => {
  const response = await apiRequest.put(`${BASE}/${id}`, data);
  return unwrap(response);
};

export const deleteAiProviderKey = async (id) => {
  const response = await apiRequest.delete(`${BASE}/${id}`);
  return unwrap(response);
};

export const toggleAiProviderKey = async (id) => {
  const response = await apiRequest.post(`${BASE}/${id}/toggle`);
  return unwrap(response);
};

// { gemini: { category, label, requiresApiKey, defaultBaseUrl }, ... }
export const getProviderCatalog = async () => {
  const response = await apiRequest.get(`${BASE}/catalog`);
  return unwrap(response) || {};
};

export const getActiveProvider = async () => {
  const response = await apiRequest.get(`${BASE}/active-provider`);
  return unwrap(response)?.active_provider || null;
};

export const setActiveProvider = async (active_provider) => {
  const response = await apiRequest.put(`${BASE}/active-provider`, { active_provider });
  return unwrap(response)?.active_provider || null;
};

export default {
  getAiProviderKeys,
  getAiProviderKey,
  createAiProviderKey,
  updateAiProviderKey,
  deleteAiProviderKey,
  toggleAiProviderKey,
  getProviderCatalog,
  getActiveProvider,
  setActiveProvider,
};
