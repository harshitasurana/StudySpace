import User from "./user_schema.js";
import { Op } from "sequelize";
import Role from "../roles/role_schema.js";

const creatorInclude = {
  model: User,
  as: "creator",
  attributes: ["user_id", "first_name", "last_name"],
  required: false,
};

const updaterInclude = {
  model: User,
  as: "updater",
  attributes: ["user_id", "first_name", "last_name"],
  required: false,
};

const roleInclude = {
  model: Role,
  as: "userRole",
  attributes: ["role_id", "role_name"],
  // Same fix as findUserForLogin in user_service.js: without this, a user
  // whose role_id doesn't match a live (non-deleted) role row would be
  // silently excluded from findAllUsersPaginated/findUserByIdForManagement
  // results entirely, due to Role's defaultScope where-clause forcing an
  // INNER JOIN.
  required: false,
};

const SAFE_ATTRIBUTES = [
  "user_id", "is_main_user", "role_id", "account_email",
  "username", "first_name", "last_name", "phone", "initials", "avatar",
  "title", "location", "is_active", "user_type", "permissions",
  "created_by", "updated_by", "created_at", "updated_at", "created_by_name",
  "updated_by_name", "last_login", "staff_id",
];

export const createUser = async (userData) => {
  return await User.create(userData);
};

export const findUserByEmail = async (account_email) => {
  return await User.findOne({ where: { account_email, deleted_at: null }, include: [creatorInclude] });
};

export const findUserById = async (id) => {
  return await User.findOne({ where: { user_id: id, deleted_at: null }, include: [creatorInclude] });
};

export const saveUserRefreshToken = async (userId, token) => {
  await User.update({ refresh_token: token }, { where: { user_id: userId } });
};

export const removeUserRefreshToken = async (refreshToken) => {
  const [updated] = await User.update(
    { refresh_token: null },
    { where: { refresh_token: refreshToken, deleted_at: null } }
  );
  return updated > 0;
};

export const findUserByRefreshToken = async (token) => {
  // roleInclude added: refreshUserTokenController needs user.userRole.role_name
  // to re-sign the access token with the same shape issueUserTokens() uses at
  // login (role name, not role_id) - see user_controller.js.
  return await User.findOne({ where: { refresh_token: token, deleted_at: null }, include: [creatorInclude, roleInclude] });
};

export const updateUserActiveStatus = async (userId, isActive) => {
  const [updated] = await User.update({ is_active: isActive }, { where: { user_id: userId } });
  return updated > 0;
};

export const findAllUsersPaginated = async (filters = {}) => {
  const {
    search,
    page = 1,
    limit = 10,
    sortBy = "created_at",
    sortOrder = "DESC",
    is_active,
    role_id,
    user_type,
  } = filters;

  const offset = (page - 1) * limit;
  const whereClause = { deleted_at: null };

  if (is_active !== undefined) whereClause.is_active = is_active;
  if (role_id) whereClause.role_id = role_id;
  if (user_type) whereClause.user_type = user_type;

  if (search) {
    whereClause[Op.or] = [
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name: { [Op.iLike]: `%${search}%` } },
      { account_email: { [Op.iLike]: `%${search}%` } },
      { username: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
      { staff_id: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where: whereClause,
    attributes: SAFE_ATTRIBUTES,
    include: [roleInclude, creatorInclude, updaterInclude],
    order: [[sortBy, sortOrder]],
    limit,
    offset,
    distinct: true,
  });

  return {
    users: rows,
    total: count,
    page: parseInt(page, 10),
    totalPages: Math.ceil(count / limit),
    limit: parseInt(limit, 10),
  };
};

export const findUserByIdForManagement = async (userId) => {
  return await User.findOne({
    where: { user_id: userId, deleted_at: null },
    attributes: { exclude: ["password", "refresh_token", "two_fa_secret", "two_fa_backup_codes", "password_reset_token", "password_reset_expires"] },
    include: [roleInclude, creatorInclude, updaterInclude],
  });
};

export const getUserStats = async () => {
  const total = await User.count({ where: { deleted_at: null } });
  const active = await User.count({ where: { deleted_at: null, is_active: true } });
  const inactive = await User.count({ where: { deleted_at: null, is_active: false } });

  const internalCount = await User.count({ where: { deleted_at: null, user_type: "Internal" } });
  const externalCount = await User.count({ where: { deleted_at: null, user_type: "External" } });

  const roleCounts = await User.findAll({
    where: { deleted_at: null },
    attributes: [
      "role_id",
      [User.sequelize.fn("COUNT", User.sequelize.col("user_id")), "count"],
    ],
    group: ["role_id"],
    raw: true,
  });

  const roles = await Role.findAll({
    where: { role_id: { [Op.in]: roleCounts.map((r) => r.role_id).filter(Boolean) } },
    attributes: ["role_id", "role_name"],
    raw: true,
  });
  const roleNameMap = {};
  roles.forEach((r) => { roleNameMap[r.role_id] = r.role_name; });

  return {
    total,
    active,
    inactive,
    internal: internalCount,
    external: externalCount,
    by_role: roleCounts.map((r) => ({
      role_id: r.role_id,
      role_name: roleNameMap[r.role_id] || null,
      count: parseInt(r.count, 10),
    })),
  };
};

export const bulkDeleteUsers = async (userIds) => {
  const [updated] = await User.update(
    { deleted_at: new Date() },
    { where: { user_id: { [Op.in]: userIds }, deleted_at: null } }
  );
  return updated;
};