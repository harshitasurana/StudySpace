import apiClient from './apiClient';
import { ENDPOINTS } from '../api/endpoints';

// GET /feature-permissions/role/:roleId - authenticate only, no admin gate
// (confirmed in feature_permissions_routes.js). Returns the caller's own
// role's grants, grouped per feature:
//   { success, message, data: [
//       { role_id, user_id, feature_id,
//         feature: { feature_id, feature_name, description, category_id },
//         permissions: [{ permission_name: "can_read", is_enabled, ... }, ...] }
//   ] }
// Note this response has NO router_link - only /api/menu carries that.
// Callers that need "does path X resolve" should combine this with
// MenuService.getMenu() (see useStudentRBAC / StudentRBACContext).
const FeaturePermissionService = {
  async getByRole(roleId) {
    const { data } = await apiClient.get(ENDPOINTS.featurePermissions.byRole(roleId));
    return data?.data ?? [];
  },
};

export default FeaturePermissionService;