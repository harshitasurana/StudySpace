import jwt from "jsonwebtoken";
import User from "../../api/user/user_schema.js";
import Role from "../../api/roles/role_schema.js";
import { logInfo, logError } from "../utils/logger.js";

// 🔹 Authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "") || req.cookies?.accessToken;
    if (!token) {
      throw new Error("Authentication required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Define role mappings (adjust based on your database)
    const roleMappings = {
      1: 'super_admin', // Map integer to string
      2: 'hospital_admin',
      3: 'doctor'
      // Add other mappings as needed
    };

    // Convert role to string/int and normalize role_id
    const userRoleString = roleMappings[decoded.role] || decoded.role;

    // Resolve numeric role_id if token provided role name
    let resolvedRoleId = null;
    if (typeof decoded.role === 'number') {
      resolvedRoleId = decoded.role;
    } else if (typeof decoded.role === 'string' && /^\d+$/.test(decoded.role)) {
      resolvedRoleId = Number(decoded.role);
    } else if (typeof userRoleString === 'string') {
      // Try to look up role id from Role table
      try {
        const roleRow = await Role.findOne({ where: { role_name: userRoleString } });
        if (roleRow && roleRow.role_id) resolvedRoleId = roleRow.role_id;
      } catch (e) {
        // ignore and leave resolvedRoleId null
      }
    }

    let user;

    user = await User.findByPk(decoded.id);
    if (!user) {
      throw new Error("User not found");
    }

    // Prepare user data for request
    // `name`/`email` used to read user.name/user.email directly — neither
    // attribute exists on the User model (it's first_name/last_name and
    // account_email), so req.user.name and req.user.email have always
    // been undefined for every session, silently. Every frontend page
    // reading profile.name/profile.email (Topbar, SelfDashboard's
    // greeting, the Edit Profile modal's email field, etc.) was
    // depending on its own local fallback text instead of a real value.
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
    const userData = {
      user_id: user.user_id,
      name: fullName || user.username || null,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.account_email,
      role: userRoleString, // Use the string role
      role_id: resolvedRoleId || decoded.role,
    };

    req.user = userData;

    next();
  } catch (error) {
    res.status(401).json({
      error: "Please authenticate",
      details: error.message,
    });
  }
};

// 🔹 Role-based authorization middleware
export const authorize = (roles = []) => {
  return (req, res, next) => {
    logInfo("User role check:", { userRole: req.user?.role, allowedRoles: roles });

    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Define role mappings (adjust based on your database)
    const roleMappings = {
      1: 'super_admin', // Map integer to string
      2: 'hospital_admin',
      3: 'department_admin'
      // Add other mappings as needed
    };

    // Convert integer role to string
    const userRoleString = roleMappings[req.user.role] || req.user.role;

    // Super admin bypasses all role checks
    if (userRoleString === 'super_admin') {
      return next();
    }

    // If roles is a string, convert to array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRoleString)) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    next();
  };
};

// 🔹 Feature-based authorization middleware
export const authorizeFeature = (featureName, permissionType) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Import the dynamic permission checker
      const { checkUserFeaturePermission } = await import("../../api/feature/feature_permissions_model.js");

      // Get user role ID - assuming it's stored in req.user.role_id or similar
      // You may need to adjust this based on your user object structure
      const userRoleId = req.user.role_id || req.user.role;

      if (!userRoleId) {
        return res.status(403).json({ error: "User role not found" });
      }

      // Check if user has the required permission for the feature
      const hasPermission = await checkUserFeaturePermission(req.user.user_id, userRoleId, featureName, permissionType, req.user.organization_id);

      if (!hasPermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: `${featureName}:${permissionType}`
        });
      }

      next();
    } catch (error) {
    logError("Feature authorization error:", error);
      res.status(500).json({
        error: "Authorization check failed",
        message: error.message
      });
    }
  };
};

// Gates a student-only route behind having completed onboarding — the
// single place this rule lives now, instead of ~20 separate service
// functions each re-deriving it. Attaches req.studentScope so handlers
// never need a second lookup. Dynamic import mirrors authorizeFeature's
// own pattern above, avoiding a static circular import with
// curriculum_service.js.
//
// Deliberately NOT applied blanket-wide: resolveStudentClassId returning
// null isn't always an error (GET /api/curriculum/chapters treats it as
// "this caller is staff, use query params instead"), and
// GET/PUT /api/curriculum/progress/:studentProfileId enforces a
// different rule (owns this profile ID) with a different error contract
// (403 FORBIDDEN_PROFILE_MISMATCH) — both routes must never get this
// middleware. Apply it per-route on genuinely student-only endpoints.
export const requireStudentProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    const { resolveStudentClassId } = await import("../../api/curriculum/curriculum_service.js");
    const studentScope = await resolveStudentClassId(req.user.user_id);
    if (!studentScope) {
      return res.status(404).json({ success: false, message: "No student profile found — complete onboarding first" });
    }
    req.studentScope = studentScope;
    next();
  } catch (error) {
    logError("Student profile check error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to verify student profile" });
  }
};

// Subscription/paywall usage gating has been removed — this deployment is
// fully local and unpaywalled, so every student gets unlimited usage and
// every chapter unlocked. These are kept as no-op pass-throughs (rather
// than deleted) so the route files that reference them by name below don't
// need to change.
export const requireWithinUsageLimit = () => async (req, res, next) => next();

export const requireChapterUnlocked = async (req, res, next) => next();
