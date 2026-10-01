import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AuthService from '../services/AuthService';
import { registerAuthExpiredHandler, tokenStore } from '../services/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // On app load, try to silently establish a session from the httpOnly
  // refresh cookie so a page refresh doesn't force a fresh login.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await AuthService.refreshToken();
        const { user: currentUser } = await AuthService.getCurrentUser();
        if (!cancelled) setUser(currentUser);
      } catch (err) {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    bootstrap();
    registerAuthExpiredHandler(() => {
      if (!cancelled) setUser(null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Does NOT set the session user itself - login() just forwards the
  // backend response; callers (Login page, AuthModal) apply data.user
  // themselves once the request resolves.
  const login = useCallback(async ({ email, password, rememberMe }) => {
    return AuthService.login({ email, password, rememberMe });
  }, []);

  const logout = useCallback(async () => {
    await AuthService.logout();
    clearSession();
  }, [clearSession]);

  const value = {
    user,
    setUser,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within an AuthProvider');
  return ctx;
};

export default AuthContext;