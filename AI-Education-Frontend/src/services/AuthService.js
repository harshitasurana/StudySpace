import apiClient, { tokenStore } from './apiClient';
import { ENDPOINTS } from '../api/endpoints';

/**
 * Every call here goes through the single apiClient instance.
 * On success, login()/refresh() store the returned access token in memory
 * via tokenStore; the refresh token itself is an httpOnly cookie the
 * backend manages, never touched by JS.
 */
const AuthService = {
  async login({ email, password, rememberMe }) {
    // No role is sent here - the backend authenticates the credentials
    // and returns the user's role as part of the response. The frontend
    // never asks the user to pick a role before logging in.
    const { data } = await apiClient.post(ENDPOINTS.auth.login, { email, password, rememberMe });
    if (data?.accessToken) tokenStore.set(data.accessToken);
    return data; // { user, accessToken, ... }
  },

  // registerUserController issues real tokens directly (no email/OTP
  // challenge step - that flow was removed from the backend entirely), so
  // this mirrors login()'s token-storing behavior.
  async signup(payload) {
    const { data } = await apiClient.post(ENDPOINTS.auth.signup, payload);
    if (data?.accessToken) tokenStore.set(data.accessToken);
    return data; // { user, accessToken, ... }
  },

  async logout() {
    try {
      await apiClient.post(ENDPOINTS.auth.logout);
    } finally {
      tokenStore.clear();
    }
  },

  async refreshToken() {
    const { data } = await apiClient.post(ENDPOINTS.auth.refreshToken);
    if (data?.accessToken) tokenStore.set(data.accessToken);
    return data;
  },

  async getCurrentUser() {
    // GET /api/users/verify - requires a valid access token (cookie or
    // Authorization header) and returns { success, user }.
    const { data } = await apiClient.get(ENDPOINTS.auth.verify);
    return data;
  },

  async forgotPassword(email) {
    const { data } = await apiClient.post(ENDPOINTS.auth.forgotPassword, { email });
    return data;
  },

  // Backend's resetPasswordSchema requires { token, newPassword, confirmPassword }.
  async resetPassword({ token, newPassword, confirmPassword }) {
    const { data } = await apiClient.post(ENDPOINTS.auth.resetPassword, {
      token,
      newPassword,
      confirmPassword,
    });
    return data;
  },
};

export default AuthService;