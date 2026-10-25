import React from 'react';
import ComingSoonPage from '../../../shared/ComingSoonPage';

// Admin Feature: "Dashboard Education" (feature_id 281, route /dashboard).
// This is the parent/grouping entry in the menu tree - the real per-mode
// dashboards already exist at /self/dashboard and /school/dashboard. The
// "Student Dashboard" child feature's router_link now points straight at
// /self/dashboard in Admin (Phase 0 item 1), so the dynamic menu built
// from GET /api/menu (see Sidebar.jsx) navigates there directly - no
// special-casing needed here anymore. This page only renders if someone
// lands on the bare /dashboard URL itself.
const EducationDashboard = () => (
  <ComingSoonPage
    icon="dashboard"
    title="Dashboard"
    description="Use the sidebar to open your dashboard - Self, School, or Teacher - based on your role."
  />
);

export default EducationDashboard;
