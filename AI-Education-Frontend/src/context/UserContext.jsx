import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import ProfileService from '../services/ProfileService';
import { useAuthContext } from './AuthContext';

const UserContext = createContext(null);

/**
 * Holds the editable profile view of the logged-in user (name, email,
 * language, avatar, ...). Seeded from AuthContext.user whenever the
 * session user changes, and kept in sync with the backend through
 * ProfileService.
 */
export const UserProvider = ({ children }) => {
  const { user: authUser, isAuthenticated } = useAuthContext();
  const [profile, setProfile] = useState(authUser);

  useEffect(() => {
    setProfile(authUser);
  }, [authUser]);

  // authUser comes straight from the login/verify response, which never
  // includes `language` (or a computed `name`) - only GET /api/users/me
  // does (see getMyProfileService vs. buildUserProfile in
  // user_service.js). Without this, every fresh page load silently reset
  // the student's saved language back to the 'en' default everywhere that
  // reads profile.language (Topbar, Sidebar), even though the real value
  // was persisted correctly. Best-effort background enrichment - a
  // failure here just means the UI keeps using whatever authUser already
  // had, same as before this existed.
  useEffect(() => {
    if (!isAuthenticated || !authUser?.user_id) return;
    let cancelled = false;
    ProfileService.getProfile()
      .then((res) => {
        if (cancelled) return;
        const fresh = res?.data;
        if (!fresh) return;
        setProfile((prev) => ({ ...prev, ...fresh }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authUser?.user_id]);

  const updateProfile = useCallback(async (changes) => {
    const optimistic = { ...profile, ...changes };
    setProfile(optimistic);
    try {
      const res = await ProfileService.updateProfile(changes);
      const saved = res?.data || {};
      setProfile((prev) => ({ ...prev, ...saved }));
      return saved;
    } catch (err) {
      // Keep the optimistic update - backend may be unreachable in dev;
      // callers can inspect the thrown error if they need to react.
      throw err;
    }
  }, [profile]);

  const value = {
    profile,
    isProfileReady: isAuthenticated && !!profile,
    updateProfile,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUserContext = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used within a UserProvider');
  return ctx;
};

export default UserContext;
