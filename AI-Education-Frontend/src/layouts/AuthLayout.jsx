import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Shell for every unauthenticated screen. Pages render their own cards/
 * forms; this just guarantees a consistent full-height background so
 * individual auth pages don't each redeclare it.
 */
const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Outlet />
    </div>
  );
};

export default AuthLayout;
