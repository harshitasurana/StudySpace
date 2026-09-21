import {
  upsertStudentProfileService,
  completeStudentProfileService,
  getStudentProfileForUserService,
  markGuidedWalkthroughSeenService,
} from "./student_profile_service.js";

// userId is taken ONLY from the authenticated session (req.user.user_id),
// never from req.body or req.params — see student_profile_service.js for
// why. This mirrors the same rule used for PUT /api/users/me/role.

export const createStudentProfileController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const roleId = req.user.role_id || null;
    const profile = await upsertStudentProfileService(userId, roleId, req.body);
    return res.status(201).json({ success: true, message: "Student profile saved successfully", data: profile });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to save student profile" });
  }
};

export const completeStudentProfileController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const profile = await completeStudentProfileService(userId);
    return res.status(200).json({ success: true, message: "Onboarding completed", data: profile });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to complete onboarding" });
  }
};

export const markGuidedWalkthroughSeenController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const profile = await markGuidedWalkthroughSeenService(userId);
    return res.status(200).json({ success: true, message: "Guided Walkthrough marked as seen", data: profile });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to update Guided Walkthrough status" });
  }
};

export const getMyStudentProfileController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const profile = await getStudentProfileForUserService(userId);
    if (!profile) {
      return res.status(404).json({ success: false, message: "No student profile found" });
    }
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch student profile" });
  }
};
