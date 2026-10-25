import { apiRequest } from "./axios.js";

export const searchUsers = async (params = {}) => {
  const res = await apiRequest.get("/users/get-all-users", { params });
  return res.data;
};
