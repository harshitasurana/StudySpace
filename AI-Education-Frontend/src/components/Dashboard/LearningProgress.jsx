import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, TrendingUp, ChevronDown, BookOpen, Layers } from 'lucide-react';
import { itemVariants } from '../../animations/variants';

const LearningProgress = ({ loadingSubjectProgress, subjectProgress }) => {
  const [viewMode, setViewMode] = useState('subjects'); // 'subjects' | 'chapters'
  const [timeframe, setTimeframe] = useState('This Week');

  // Compute overall average mastery from real subjectProgress
  const overallProgress = subjectProgress?.length
    ? Math.round(subjectProgress.reduce((acc, s) => acc + (s.mastery || 0), 0) / subjectProgress.length)
    : 0;

  const [activeSubjectId, setActiveSubjectId] = useState(subjectProgress?.[0]?.subject_id || null);

  const currentSubject =
    subjectProgress?.find((s) => s.subject_id === activeSubjectId) || subjectProgress?.[0];

  const strokeDashoffset = 251 - (251 * overallProgress) / 100;

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between"
    >
      {/* Header with View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center">
            <BarChart3 size={16} />
          </div>
          <h2 className="font-black text-lg text-slate-900 dark:text-white">Your Progress</h2>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-700/60 p-1 rounded-full text-xs font-bold">
            <button
              onClick={() => setViewMode('subjects')}
              className={`px-3.5 py-1 rounded-full transition-all cursor-pointer ${
                viewMode === 'subjects'
                  ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Overall
            </button>
            <button
              onClick={() => setViewMode('chapters')}
              className={`px-3.5 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'chapters'
                  ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Layers size={13} /> Chapter Wise
            </button>
          </div>

          <div className="relative">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="text-xs font-extrabold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-full px-3 py-1.5 pr-6 cursor-pointer outline-none appearance-none"
            >
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {loadingSubjectProgress ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">Loading progress...</div>
        ) : viewMode === 'subjects' ? (
          <motion.div
            key="subjects"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center flex-1"
          >
            {/* Donut Gauge Chart (5 cols) */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center text-center p-3 border-r-0 sm:border-r border-slate-100 dark:border-slate-700/50">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-700" fill="transparent" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#0e3b3a"
                    strokeWidth="8"
                    className="transition-all duration-1000 ease-out"
                    fill="transparent"
                    strokeDasharray="251"
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">{overallProgress}%</span>
                </div>
              </div>
              <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300 mt-2.5">Overall Progress</p>
              <div className="flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                <TrendingUp size={12} />
                <span>Overall Mastery</span>
              </div>
            </div>

            {/* Subject Progress Bars List (7 cols) */}
            <div className="sm:col-span-7 space-y-3">
              {subjectProgress?.length > 0 ? (
                subjectProgress.map((sub, idx) => (
                  <div key={sub.subject_id || idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate">{sub.subject_name}</span>
                      <span className="font-black text-slate-900 dark:text-white shrink-0 ml-2">{sub.mastery || 0}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${idx % 2 === 0 ? 'bg-[#e05263]' : 'bg-[#0d9488]'} transition-all duration-700`}
                        style={{ width: `${sub.mastery || 0}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No subject data available.</p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chapters"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="space-y-3 flex-1"
          >
            {/* Subject Selector Pills */}
            {subjectProgress?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1.5 border-b border-slate-100 dark:border-slate-700">
                {subjectProgress.map((sub) => (
                  <button
                    key={sub.subject_id}
                    onClick={() => setActiveSubjectId(sub.subject_id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                      (currentSubject?.subject_id === sub.subject_id)
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {sub.subject_name}
                  </button>
                ))}
              </div>
            )}

            {/* Chapters List with Explicit Chapter Numbers */}
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {currentSubject?.chapters?.length > 0 ? (
                currentSubject.chapters.map((ch, idx) => {
                  const percent = ch.mastery ?? 0;
                  const chapterNum = ch.chapter_number || ch.order || (idx + 1);
                  const statusLabel = percent >= 80 ? 'Mastered' : percent >= 50 ? 'In Progress' : percent > 0 ? 'Needs Practice' : 'Not Started';
                  const badgeColor = percent >= 80 ? 'bg-emerald-100 text-emerald-800' : percent >= 50 ? 'bg-amber-100 text-amber-800' : percent > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600';

                  return (
                    <div
                      key={ch.chapter_id || idx}
                      className="bg-slate-50/70 dark:bg-slate-700/30 border border-slate-200/60 dark:border-slate-700/40 rounded-2xl p-3 space-y-2 hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen size={15} className="text-emerald-600 shrink-0" />
                          <span className="font-black text-slate-800 dark:text-slate-200 truncate">
                            Chapter {chapterNum}: {ch.chapter_name || ch.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${badgeColor}`}>
                            {statusLabel}
                          </span>
                          <span className="font-black text-slate-900 dark:text-white">
                            {percent}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 italic py-6 text-center">
                  No chapters available for this subject yet.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LearningProgress;
