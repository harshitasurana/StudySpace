import React from 'react';
import { motion } from 'motion/react';
import { BookmarkCheck, Clock, BookOpen, ArrowRight } from 'lucide-react';
import { itemVariants } from '../../animations/variants';

const ContinueLearningCard = ({
  loadingProgress,
  progressError,
  continueChapter,
  formatLastStudied,
  onContinue,
}) => {
  const percent = continueChapter?.progressRow
    ? Math.round(Number(continueChapter.progressRow.progress_percent))
    : 65;

  const chapterTitle = continueChapter?.name || 'Number Systems';
  const subjectSubtitle = continueChapter?.subjectName
    ? `${continueChapter.subjectName} • Chapter 1`
    : 'Mathematics • Chapter 1';

  return (
    <motion.div variants={itemVariants} data-tour="dashboard-continue-learning">
      <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
            <BookmarkCheck size={16} />
          </div>
          <h2 className="font-black text-lg text-slate-900 dark:text-white">Continue Learning</h2>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Chalkboard Graphic Box (4 cols) */}
          <div className="md:col-span-4 bg-[#0e3b3a] rounded-2xl p-4 text-white flex flex-col justify-center items-center text-center shadow-inner relative overflow-hidden group">
            <div className="absolute top-2 left-2.5 text-[10px] font-mono text-emerald-300 opacity-60">Math Note</div>
            <p className="font-mono text-lg font-extrabold tracking-widest text-emerald-200 drop-shadow-sm group-hover:scale-105 transition-transform my-1">
              x² + 3x - 4 = 0
            </p>
            <div className="mt-1 text-[11px] bg-emerald-900/80 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-emerald-300 font-sans font-bold">
              Quadratic Formula
            </div>
          </div>

          {/* Details & Action (8 cols) */}
          <div className="md:col-span-8 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40">
                In Progress
              </span>
            </div>

            <div>
              <h3 className="font-black text-lg text-slate-900 dark:text-white leading-tight">{chapterTitle}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{subjectSubtitle}</p>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0e3b3a] dark:bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">{percent}%</span>
            </div>

            {/* Continue Button */}
            <button
              onClick={() => onContinue(continueChapter)}
              className="mt-1.5 bg-[#0e3b3a] hover:bg-[#0a2e2d] text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <span>Continue Learning</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Footer Metrics Row */}
        <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-700/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1 truncate">
            <Clock size={13} className="text-slate-400 shrink-0" />
            <span className="truncate">Last studied {continueChapter?.progressRow?.last_activity_at ? formatLastStudied(continueChapter.progressRow.last_activity_at) : '2 days ago'}</span>
          </div>
          <div className="flex items-center gap-1 truncate">
            <BookOpen size={13} className="text-slate-400 shrink-0" />
            <span className="truncate">Next: Real Numbers</span>
          </div>
          <div className="flex items-center gap-1 truncate">
            <Clock size={13} className="text-slate-400 shrink-0" />
            <span className="truncate">Est: 25 min</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ContinueLearningCard;
