import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleBasedRoute from './RoleBasedRoute';
import useAuth from '../hooks/useAuth';
import useStudentMode from '../hooks/useStudentMode';
import { authRoutes, protectedRoutes, defaultRouteForRole } from './routeConfig';

const RouteFallback = () => (
  <div className="flex items-center justify-center py-24 text-on-surface-variant">
    <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span>
    Loading…
  </div>
);

const RootRedirect = () => {
  const { isAuthenticated, user } = useAuth();
  const { mode, isLoading: modeLoading } = useStudentMode();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Wait for StudentModeContext to resolve before deciding where to send a
  // student — otherwise this fires on the very first render right after
  // login, while `mode` is still null (the profile fetch hasn't completed
  // yet), permanently landing on the onboarding fallback since
  // <Navigate> only fires once and this component then unmounts. Only
  // gate on this for role === 'student'/'school student' — every other
  // role has no mode concept and would wait forever on a fetch that never
  // happens.
  const role = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : user?.role;
  if ((role === 'student' || role === 'school student') && mode === null && modeLoading) {
    return <RouteFallback />;
  }

  return <Navigate to={defaultRouteForRole(user?.role, mode)} replace />;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        {/* Authentication Layout */}
        <Route element={<AuthLayout />}>
          {authRoutes.map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
        </Route>

        {/* Protected Layout -> Role Based Routing -> Lazy Loading */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {protectedRoutes.map(({ path, Component, roles, modes }) => (
            <Route
              key={path}
              path={path}
              element={
                <RoleBasedRoute path={path} roles={roles} modes={modes}>
                  <Component />
                </RoleBasedRoute>
              }
            />
          ))}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;