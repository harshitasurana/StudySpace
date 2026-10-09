import React from 'react';
import StudentDashboardBase from '../../shared/StudentDashboardBase';

const renderIdentityLine = (dashboard) =>
  dashboard?.board?.name && dashboard?.class?.name
    ? `${dashboard.board.name} · ${dashboard.class.name}`
    : 'Your personal learning dashboard.';

const SelfDashboard = () => (
  <StudentDashboardBase
    dashboardLabel="Self Dashboard"
    onboardingPath="/education/onboarding/student/self/class"
    renderIdentityLine={renderIdentityLine}
  />
);

export default SelfDashboard;
