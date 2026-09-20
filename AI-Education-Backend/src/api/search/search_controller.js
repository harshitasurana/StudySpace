import { getSearchFilters, searchAllEntities } from "./search_service.js";
import { EducationStudentProfile } from "../student-profile/student_profile_schema.js";

// req.user (built by auth_middleware.js from the JWT) never carries
// student_profile_id — only user_id/role/etc. Owner-scoped entities like
// Notes/Bookmarks/Test History are keyed by student_profile_id though, so
// it's resolved once here and merged onto a copy of the user object before
// it reaches searchAllEntities/getSearchFilters. search_rbac_service.js's
// resolveDynamicValue only does a plain property read (no DB access), so
// this is the one place that lookup can happen.
const withStudentProfileId = async (user) => {
  if (!user || !["Student", "School Student"].includes(user.role)) return user;
  try {
    const profile = await EducationStudentProfile.findOne({
      where: { user_id: user.user_id },
      attributes: ["student_profile_id"],
    });
    return profile ? { ...user, student_profile_id: profile.student_profile_id } : user;
  } catch {
    return user;
  }
};

export const search = async (req, res, next) => {
  try {
    const user = await withStudentProfileId(req.user || null);
    const result = await searchAllEntities({
      ...req.query,
      user,
      clientType: req.query.client_type || req.headers["x-client-type"] || null,
      authHeader: req.headers.authorization || null,
    });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getFilters = async (req, res, next) => {
  try {
    const user = await withStudentProfileId(req.user || null);
    const clientType = req.query.client_type || req.headers["x-client-type"] || null;
    const filters = await getSearchFilters(user, clientType);
    res.status(200).json({
      success: true,
      data: filters,
    });
  } catch (error) {
    next(error);
  }
};
