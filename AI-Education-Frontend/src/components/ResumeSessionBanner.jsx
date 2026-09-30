import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { getValidStudySession, dismissStudySession, isStudySessionDismissed } from '../utils/studySession';

const ResumeSessionBanner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStudySessionDismissed()) {
      setVisible(false);
      return;
    }

    const currentSession = getValidStudySession();
    // Only show if session exists and student isn't already on that exact page path
    if (currentSession && location.pathname !== currentSession.path) {
      setSession(currentSession);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [location.pathname]);

  if (!visible || !session) return null;

  const handleResume = () => {
    dismissStudySession();
    setVisible(false);
    navigate(session.path);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    dismissStudySession();
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-20 right-4 sm:right-6 md:bottom-6 md:right-24 z-30 max-w-sm w-[calc(100vw-2rem)] sm:w-96 bg-white/95 dark:bg-[#152238]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-xl p-3.5 flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
              <span className="material-symbols-outlined text-[20px]">
                {session.type === 'quiz' ? 'quiz' : session.type === 'practice' ? 'edit_note' : 'auto_stories'}
              </span>
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary dark:text-primary-fixed">
                  Resume Learning
                </span>
                {session.progress > 0 && (
                  <span className="text-[10px] font-semibold text-slate-400">
                    • {session.progress}% done
                  </span>
                )}
              </div>
              <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate mt-0.5">
                {session.title}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {session.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleResume}
              className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer flex items-center gap-1 active:scale-95"
            >
              Resume
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              title="Dismiss"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ResumeSessionBanner;
