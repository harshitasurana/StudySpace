import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

export const apiRequest = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiRequest.interceptors.request.use(
  (config) => {
    config.headers['X-Client-Type'] = 'REACT';
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiRequest.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        await axios.post(`${baseURL}/users/refresh-token`, {}, { withCredentials: true });
        return apiRequest(error.config);
      } catch (refreshError) {
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
