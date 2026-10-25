import React from 'react';
import StudentDashboardBase from '../../shared/StudentDashboardBase';

const renderIdentityLine = (dashboard) => {
  const schoolName = dashboard?.school?.name || dashboard?.school_name;
  const parts = [
    schoolName,
    dashboard?.class?.name,
    dashboard?.section ? `Section ${dashboard.section}` : null,
    dashboard?.roll_number ? `Roll No. ${dashboard.roll_number}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Your school learning dashboard.';
};

const SchoolDashboard = () => (
  <StudentDashboardBase
    dashboardLabel="School Dashboard"
    onboardingPath="/education/onboarding/student/school/search"
    renderIdentityLine={renderIdentityLine}
  />
);

export default SchoolDashboard;
