import React from 'react';

/**
 * Sprint 1 exit criteria: a student without a real feature_permissions
 * grant on a route must see an in-app message, not a silent redirect or a
 * 404. Rendered by RoleBasedRoute.jsx when useStudentRBAC().canRoute(path)
 * comes back false for a path listed in routeFeatureMap.js.
 *
 * Deliberately friendlier copy than Education-Admin's equivalent inline
 * block (`Access Denied — You do not have permission to access {title}.`)
 * - this app's audience is students, not admin staff.
 */
const AccessDenied = ({ featureName }) => (
  <main className="flex-grow flex items-center justify-center py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
    <div className="text-center max-w-md">
      <span className="material-symbols-outlined text-4xl text-outline mb-3 inline-block">lock</span>
      <p className="text-headline-sm font-bold text-on-surface mb-2">Not available yet</p>
      <p className="text-body-md text-on-surface-variant">
        {featureName
          ? `This isn't unlocked for your account yet: ${featureName}.`
          : "This isn't unlocked for your account yet."}
      </p>
    </div>
  </main>
);

export default AccessDenied;
