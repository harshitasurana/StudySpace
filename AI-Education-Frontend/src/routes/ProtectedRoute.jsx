import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const FullScreenSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-on-surface">
    <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullScreenSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
