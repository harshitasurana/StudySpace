import { apiRequest } from "./axios";

const CLIENT_TYPE = import.meta.env.VITE_CLIENT_TYPE || "REACT";

export const searchService = {
  search: (params = {}) =>
    apiRequest.get("/search", { params: { ...params, client_type: CLIENT_TYPE } }).then((res) => res.data.data),

  getFilters: () =>
    apiRequest.get("/search/filters", { params: { client_type: CLIENT_TYPE } }).then((res) => res.data.data),
};
