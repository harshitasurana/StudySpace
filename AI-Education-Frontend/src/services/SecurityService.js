import apiClient from './apiClient';
import { ENDPOINTS } from '../api/endpoints';

// Self-service password change (Settings > Security). Implicitly scopes to
// the logged-in user server-side (req.user.user_id) - no user id is ever
// passed from here.
//
// 2FA (setup/status/disable/backup codes) used to live here too, but that
// entire flow was removed from the backend along with OTP/trusted-device
// login verification - there is no /api/users/2fa/* route left to call.
const SecurityService = {
  async changePassword(currentPassword, newPassword, confirmPassword) {
    const { data } = await apiClient.post(ENDPOINTS.security.changePassword, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    return data;
  },
};

export default SecurityService;
