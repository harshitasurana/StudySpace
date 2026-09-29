/**
 * Utility for persisting and retrieving the student's last active study session.
 * Used by ChapterReader, Quiz, Practice, and PreAssessment to track progress
 * and by ResumeSessionBanner to offer 1-click session resume.
 */

const STORAGE_KEY = 'eduai_last_study_session';
const DISMISS_KEY = 'eduai_dismissed_resume';

export const saveStudySession = ({ title, subtitle, path, progress = 0, type = 'chapter' }) => {
  if (!title || !path) return;
  try {
    const sessionData = {
      title,
      subtitle: subtitle || 'Active Study Session',
      path,
      progress: Math.min(100, Math.max(0, Math.round(progress))),
      type,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
  } catch (err) {
    console.warn('Failed to save study session to localStorage', err);
  }
};

export const getValidStudySession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    
    // Validate session data & check expiry (max 7 days)
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (!data.title || !data.path || (Date.now() - data.timestamp) > SEVEN_DAYS_MS) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const dismissStudySession = () => {
  try {
    sessionStorage.setItem(DISMISS_KEY, 'true');
  } catch {}
};

export const isStudySessionDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
};
