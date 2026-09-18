import User from "../user/user_schema.js";
import Role from "../roles/role_schema.js";

// Or if you want to ensure associations are available in this module:
export const getProfileAssociations = () => {
  return {
    userRole: {
      model: Role,
      as: 'userRole',
      attributes: ['role_id', 'role_name']
    }
  };
};

export default User;
