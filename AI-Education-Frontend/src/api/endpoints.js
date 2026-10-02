// Central place for every backend route path. Services import from here
// instead of hardcoding strings so a backend path change is a one-line fix.

export const ENDPOINTS = {
  auth: {
    login: '/api/users/login',
    logout: '/api/users/logout',
    refreshToken: '/api/users/refresh-token',
    signup: '/api/users/register',
    forgotPassword: '/api/users/forgot-password',
    resetPassword: '/api/users/reset-password',
    // There is no /api/users/me route on the backend. Session verification
    // is GET /api/users/verify, which returns { success, user } from the
    // decoded access token.
    verify: '/api/users/verify',
  },
  // Real self-service profile endpoints (GET/PATCH /api/users/me), added
  // alongside the notification-service work — there was previously no
  // backend route at all behind /api/user/profile*, so every "Edit
  // Profile" save silently 404'd and only ever looked like it worked
  // because UserContext.jsx applies the change optimistically before the
  // (failing) request resolves.
  profile: {
    get: '/api/users/me',
    update: '/api/users/me',
  },
  preferences: {
    get: '/api/user-preferences',
    update: '/api/user-preferences',
  },
  security: {
    // OTP/2FA was removed from the backend entirely - only self-service
    // password change remains under /api/users.
    changePassword: '/api/users/change-password',
  },
  roles: {
    list: '/api/roles',
    permissions: (role) => `/api/roles/${role}/permissions`,
  },
  featurePermissions: {
    // authenticate only, no admin gate - confirmed in
    // feature_permissions_routes.js. Safe for any logged-in role to call
    // for its own role_id. Do NOT use /api/features (the full catalog) -
    // that route is admin-only.
    byRole: (roleId) => `/api/feature-permissions/role/${roleId}`,
  },
  menu: {
    get: '/api/menu',
  },
};

export default ENDPOINTS;