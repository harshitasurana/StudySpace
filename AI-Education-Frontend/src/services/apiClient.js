import axios from 'axios';

/**
 * Single Axios instance that every service in the app must go through.
 * - Base URL comes from the environment (falls back to local backend for dev).
 * - withCredentials lets the backend set/read the httpOnly refresh-token cookie.
 * - The access token (short-lived JWT) is kept in memory (see tokenStore) and
 *   attached to every request.
 * - A response interceptor transparently refreshes the access token on a 401
 *   and retries the original request exactly once.
 */

// A production build with no VITE_API_URL baked in (e.g. a Docker build
// context missing its Vite-mode env file) would otherwise silently fall
// back to localhost:3000, which is unreachable from any deployed
// container. Every API call would
// then fail with a generic network error, with nothing pointing at the
// real cause. Failing loudly here — instead of the frontend module even
// initializing — makes a broken deployment obvious immediately.
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  throw new Error(
    'VITE_API_URL is not set in this production build — the app cannot reach the backend. ' +
    'Check that the Vite-mode env file (e.g. .env.production) was present in the Docker build context.'
  );
}

// Exported so any call site that needs raw fetch() instead of this
// apiClient can share the exact same value/fallback/PROD-guard above,
// rather than re-deriving (and re-risking) its own copy of this
// fallback.
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ---- In-memory access token store -----------------------------------------
// Deliberately NOT localStorage: keeping the JWT out of storage that's
// readable by any injected script reduces XSS blast radius. The refresh
// token itself never touches JS - it lives in an httpOnly cookie set by
// the backend on /api/users/login and rotated by /api/users/refresh-token.
let accessToken = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  },
};

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    // Scopes GET /api/menu (and anything else client-type-aware) to just
    // this app's own features (feature_availability_types code
    // 'REACT_EDUCATION') — without this, the backend's availability-type
    // filter never activates and every show_in_menu feature the role can
    // read leaks in, including admin-only ones (e.g. Feature 308 "Help
    // Center", tagged 'REACT' for Education-Admin, was showing up a second
    // time in this app's sidebar alongside its own hardcoded Help Center
    // link). Must be uppercase — menu_controller.js does
    // code: clientType.toUpperCase() and Postgres string comparison is
    // case-sensitive, so a mixed-case value here would silently match
    // nothing and wipe out the entire menu.
    'X-Client-Type': 'REACT_EDUCATION',
  },
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Handlers the AuthContext registers so the interceptor can react to a
// session that can no longer be refreshed (e.g. force a logout + redirect)
// without this file needing to import React/Context directly.
let onAuthExpired = () => {};
export const registerAuthExpiredHandler = (handler) => {
  onAuthExpired = handler;
};

let refreshPromise = null;

const refreshAccessToken = async () => {
  // De-dupe concurrent 401s into a single refresh call.
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/api/users/refresh-token`, {}, { withCredentials: true })
      .then((res) => {
        const newToken = res.data?.accessToken;
        tokenStore.set(newToken);
        return newToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (!response) {
      // Network error / backend unreachable
      return Promise.reject(error);
    }

    const isAuthEndpoint = config?.url?.includes('/api/users/login') ||
      config?.url?.includes('/api/users/refresh-token');

    if (response.status === 401 && !config._retry && !isAuthEndpoint) {
      config._retry = true;
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          config.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(config);
        }
      } catch (refreshErr) {
        tokenStore.clear();
        onAuthExpired();
        return Promise.reject(refreshErr);
      }
      tokenStore.clear();
      onAuthExpired();
    }

    return Promise.reject(error);
  }
);

export default apiClient;
