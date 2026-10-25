import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import EducationService from '../services/EducationService';
import { useAuthContext } from './AuthContext';

const StudentModeContext = createContext(null);

/**
 * Fetches the logged-in student's learning_mode ('self' | 'school') once
 * per session, for mode-aware routing (Sprint 1 Track B of the EduAI
 * dashboards plan — splitting /self/* vs /school/* route trees).
 *
 * Same fetch-on-auth, swallow-and-null-on-failure pattern used elsewhere in
 * this app's context providers — only fetches for role === 'student'
 * or 'school student' since learning_mode is meaningless for every other
 * role.
 *
 * `mode` stays null while loading OR if the student hasn't created a
 * profile yet (still mid-onboarding) — callers should treat null as
 * "unknown yet", not "self" by default, to avoid misrouting a school
 * student into the self-mode tree during the gap between login and their
 * profile actually existing.
 */
export const StudentModeProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuthContext();
  const role = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : user?.role;
  const [mode, setMode] = useState(null);
  // Starts true, not false: closes a race where a consumer (RootRedirect)
  // renders in the single tick between isAuthenticated becoming true and
  // this provider's own effect actually running — during that tick,
  // mode is null AND isLoading would still read false if it started
  // false, making "still loading" indistinguishable from "no profile,
  // never mind waiting". Starting true means any consumer that gates on
  // isLoading correctly waits through that whole window, not just the
  // part of it after the effect has fired at least once.
  const [isLoading, setIsLoading] = useState(true);

  const refreshMode = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await EducationService.getMyProfile();
      setMode(res?.data?.learning_mode || null);
    } catch (err) {
      // 404 (no profile yet) is expected mid-onboarding — not an error
      // worth logging, just means mode isn't known yet.
      setMode(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && (role === 'student' || role === 'school student')) {
      refreshMode();
    } else {
      // Not a student (or not authenticated) - mode genuinely doesn't
      // apply, so isLoading must resolve to false here too, or a
      // consumer gating on isLoading would wait forever for a fetch
      // that will never happen.
      setMode(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, role, refreshMode]);

  const value = { mode, isLoading, refreshMode };

  return <StudentModeContext.Provider value={value}>{children}</StudentModeContext.Provider>;
};

export const useStudentModeContext = () => {
  const ctx = useContext(StudentModeContext);
  if (!ctx) {
    throw new Error('useStudentModeContext must be used within a StudentModeProvider');
  }
  return ctx;
};

export default StudentModeContext;