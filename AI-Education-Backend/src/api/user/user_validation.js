import Joi from "joi";

export const loginSchema = Joi.object({
  email: Joi.string().email().max(255),
  account_email: Joi.string().email().max(255),
  username: Joi.string().min(3).max(50),
  password: Joi.string().min(6).max(255).required(),
}).or("email", "account_email", "username");

export const registerSchema = Joi.object({
  account_email: Joi.string().email().max(255).required(),
  username: Joi.string().min(3).max(50),
  password: Joi.string().min(8).max(255).required(),
  first_name: Joi.string().max(100).required(),
  last_name: Joi.string().max(100).required(),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .max(20)
    .allow(null, ""),
  is_active: Joi.boolean().default(true),
});

// Schema for admin/super_admin creating users
export const createUserSchema = Joi.object({
  is_main_user: Joi.boolean().default(false),
  role_id: Joi.number().integer().required(),
  email: Joi.string().email().max(255),
  account_email: Joi.string().email().max(255),
  username: Joi.string().min(3).max(50),
  personal_email: Joi.string().email().max(255).allow(null, ""),
  password: Joi.string().min(8).max(255).required(),
  first_name: Joi.string().max(100).required(),
  last_name: Joi.string().max(100).required(),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .max(20)
    .allow(null, ""),
  initials: Joi.string().max(10).allow(null, ""),
  avatar: Joi.string().allow(null, ""),
  title: Joi.string().max(100).allow(null, ""),
  location: Joi.string().max(255).allow(null, ""),
  department_name: Joi.string().max(100).allow(null, ""),
  user_type: Joi.string().valid("Internal", "External").default("Internal"),
  permissions: Joi.array().items(Joi.string().max(255)).allow(null),
  two_fa: Joi.boolean().default(false),
  last_password_change: Joi.date().allow(null),
  security_score: Joi.number().integer().min(0).max(100).default(0),
  is_active: Joi.boolean().default(true),
  created_by: Joi.number().integer().optional().allow(null),
  updated_by: Joi.number().integer().optional().allow(null),
  created_by_name: Joi.string().optional().allow(null),
  updated_by_name: Joi.string().optional().allow(null),
}).custom((obj, helpers) => {
  if (!obj.account_email && obj.email) obj.account_email = obj.email;
  if (!obj.account_email) return helpers.error('any.required');
  delete obj.email;
  return obj;
});

export const updateUserSchema = Joi.object({
  is_main_user: Joi.boolean(),
  role_id: Joi.number().integer(),
  email: Joi.string().email().max(255),
  account_email: Joi.string().email().max(255),
  username: Joi.string().min(3).max(50),
  password: Joi.string().min(8).max(255),
  first_name: Joi.string().max(100),
  last_name: Joi.string().max(100),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .max(20)
    .allow(null, ""),
  initials: Joi.string().max(10).allow(null, ""),
  avatar: Joi.string().allow(null, ""),
  title: Joi.string().max(100).allow(null, ""),
  location: Joi.string().max(255).allow(null, ""),
  department_name: Joi.string().max(100).allow(null, ""),
  user_type: Joi.string().valid("Internal", "External"),
  permissions: Joi.array().items(Joi.string().max(255)).allow(null),
  two_fa: Joi.boolean(),
  last_password_change: Joi.date().allow(null),
  security_score: Joi.number().integer().min(0).max(100),
  is_active: Joi.boolean(),
  created_by: Joi.number().integer().optional().allow(null),
  updated_by: Joi.number().integer().optional().allow(null),
  created_by_name: Joi.string().optional().allow(null),
  updated_by_name: Joi.string().optional().allow(null),
}).min(1).custom((obj, helpers) => {
  if (!obj.account_email && obj.email) obj.account_email = obj.email;
  delete obj.email;
  return obj;
});

export const updateUserStatusSchema = Joi.object({
  is_active: Joi.boolean().required(),
});

// Used by PUT /api/users/me/role — a user setting their OWN role (e.g.
// during onboarding). Deliberately just a role_id: the target user is taken
// from the authenticated session, never from a client-supplied user id, and
// the service layer additionally checks the role is is_self_assignable
// before writing it.
export const selfAssignRoleSchema = Joi.object({
  role_id: Joi.number().integer().required(),
});

export const updateMyProfileSchema = Joi.object({
  first_name: Joi.string().trim().min(1).max(255).optional(),
  last_name: Joi.string().trim().min(1).max(255).optional(),
  // Topbar.jsx's Edit Profile modal sends a single combined `name` field
  // instead of first_name/last_name — see updateMyProfileService's split
  // logic in user_service.js.
  name: Joi.string().trim().min(1).max(255).optional(),
  email: Joi.string().email().max(255).optional(),
  phone: Joi.string().trim().max(50).allow("", null).optional(),
  language: Joi.string().trim().max(10).optional(),
  // Sent by the same legacy modal payload but never honored — silently
  // accepted and discarded here (rather than failing validation) so the
  // rest of a legitimate self-edit still goes through; updateMyProfileService
  // never reads it.
  role: Joi.string().optional(),
}).min(1);

export const changeMyPasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).max(255).required(),
  confirmPassword: Joi.string().required().valid(Joi.ref("newPassword")).messages({
    "any.only": "Confirm New Password must match New Password",
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).max(255).required(),
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
    'any.only': 'Confirm New Password must match New Password'
  }),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().optional(),
});

export const adminResetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).max(255).required(),
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
    'any.only': 'Confirm Password must match New Password',
  }),
});

export const bulkDeleteSchema = Joi.object({
  user_ids: Joi.array().items(Joi.number().integer().positive()).min(1).max(100).required(),
});

export const userListQuerySchema = Joi.object({
  search: Joi.string().max(255).allow("").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid("first_name", "last_name", "account_email", "created_at", "updated_at", "last_login", "is_active", "user_type", "created_by_name", "updated_by_name").default("created_at"),
  sortOrder: Joi.string().valid("ASC", "DESC").default("DESC"),
  is_active: Joi.boolean().optional(),
  role_id: Joi.number().integer().optional(),
  user_type: Joi.string().valid("Internal", "External").optional(),
});