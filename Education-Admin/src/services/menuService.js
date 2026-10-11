import { apiRequest } from "./axios.js";

const normalizeItems = (items = []) =>
  items
    .map((item, index) => ({
      feature_id: Number(item.feature_id ?? item.featureId),
      menu_order: Number(item.menu_order ?? item.menuOrder ?? index + 1),
      parent_feature_id:
        item.parent_feature_id === undefined || item.parent_feature_id === null
          ? null
          : Number(item.parent_feature_id),
      label: item.label || item.menu_label || item.feature || item.feature_name || "Untitled",
      menu_label: item.menu_label || item.label || item.feature || item.feature_name || "Untitled",
      icon: item.icon || item.menu_icon || null,
      menu_icon: item.menu_icon || item.icon || null,
      router_link: Array.isArray(item.routerLink)
        ? item.routerLink[0] || null
        : item.routerLink || item.router_link || null,
      show_in_menu: item.show_in_menu === undefined ? true : Boolean(item.show_in_menu),
      items: normalizeItems(item.items || []),
    }))
    .filter((item) => Number.isFinite(item.feature_id));

export const getMenuTree = async () => {
  const response = await apiRequest.get("/menu");
  return normalizeItems(Array.isArray(response.data) ? response.data : response.data?.data || []);
};

export const updateMenuOrder = async (menu) => {
  const payload = { menu: normalizeItems(menu) };
  const response = await apiRequest.put("/menu/reorder", payload);
  return response.data?.data || response.data;
};

export const updateMenuFeatureDetails = async (featureId, body) => {
  const response = await apiRequest.put(`/features/${featureId}`, body);
  return response.data?.data || response.data;
};

export const getAllFeaturesForMenuEditing = async () => {
  const response = await apiRequest.get("/features");
  const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
  const rows = Array.isArray(data?.data) ? data.data : data;

  return Array.isArray(rows)
    ? rows.map((item) => ({
        feature_id: Number(item.feature_id),
        feature_name: item.feature_name || "",
        description: item.description || "",
        category_id: item.category_id ?? null,
        parent_feature_id: item.parent_feature_id ?? null,
        show_in_menu: item.show_in_menu === undefined ? false : Boolean(item.show_in_menu),
        menu_label: item.menu_label || "",
        menu_icon: item.menu_icon || "",
        router_link: item.router_link || "",
        menu_order: Number(item.menu_order ?? 0),
        is_active: item.is_active === undefined ? true : Boolean(item.is_active),
        permissions: Array.isArray(item.permissions) ? item.permissions : [],
      }))
    : [];
};

export const getFeatureCategoryOptions = async () => {
  const response = await apiRequest.get("/features/categories/dropdown");
  const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
  const rows = Array.isArray(data?.data) ? data.data : data;

  return Array.isArray(rows)
    ? rows.map((item) => ({
        category_id: Number(item.category_id),
        name: item.name || item.category_name || `Category ${item.category_id}`,
      }))
    : [];
};
