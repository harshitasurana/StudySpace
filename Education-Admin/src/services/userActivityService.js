import { apiRequest } from "./axios";

const BASE = "/admin/user-activity";

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

export const getUserActivityList = async (params = {}) => {
  const response = await apiRequest.get(BASE, { params });
  return unwrap(response);
};

export const getUserActivityDetail = async (userId, params = {}) => {
  const response = await apiRequest.get(`${BASE}/${userId}`, { params });
  return unwrap(response);
};

export default { getUserActivityList, getUserActivityDetail };
