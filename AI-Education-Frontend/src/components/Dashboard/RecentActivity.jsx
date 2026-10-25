import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { History, Zap, Award, BookOpen, ArrowRight, ChevronDown, ExternalLink, Clock } from 'lucide-react';
import { itemVariants, expandVariants } from '../../animations/variants';
import { transitions } from '../../animations/transitions';

const RecentActivity = ({
  recentActivity,
  ATTEMPT_TYPE_LABEL,
  formatRelativeTime,
  recentActivityTarget,
}) => {
  const navigate = useNavigate();
  const [expandedIndex, setExpandedIndex] = useState(null);

  const toggleExpand = (idx, e) => {
    e.stopPropagation();
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const getScoreBadgeStyle = (percent) => {
    if (percent >= 80) {
      return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
    }
    if (percent >= 50) {
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
    }
    return 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30';
  };

  const getActivityConfig = (type) => {
    if (type === 'mock_test') return { icon: Award, label: 'Mock Test', bg: 'bg-[#D9785B]/15 text-[#D9785B]' };
    if (type === 'quiz') return { icon: Zap, label: 'Practice Quiz', bg: 'bg-[#D9A441]/15 text-[#D9A441]' };
    return { icon: BookOpen, label: 'Pre-Assessment', bg: 'bg-[#168A78]/15 text-[#168A78]' };
  };

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col space-y-4"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#123B35] text-white flex items-center justify-center font-bold shadow-xs">
            <History size={18} />
          </div>
          <div>
            <h2 className="font-black text-lg sm:text-xl text-slate-900 dark:text-white">Recent Activity</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Your latest quiz attempts & practice history</p>
          </div>
        </div>
        {recentActivity?.length > 0 && (
          <button
            onClick={() => navigate('/mock-tests/history')}
            className="text-xs sm:text-sm font-extrabold text-[#168A78] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>View All</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Empty State */}
      {(!recentActivity || recentActivity.length === 0) ? (
        <div className="bg-[#F7F3EA]/70 dark:bg-slate-800/40 rounded-2xl p-6 text-center border border-dashed border-[#E6E0D5] dark:border-slate-700 space-y-2">
          <div className="w-10 h-10 rounded-full bg-[#123B35]/10 text-[#123B35] dark:text-emerald-400 flex items-center justify-center mx-auto">
            <History size={20} />
          </div>
          <p className="text-sm font-black text-slate-900 dark:text-white">No recent activity yet</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Attempt a quiz or test to see your performance breakdown here.</p>
          <button
            onClick={() => navigate('/practice')}
            className="mt-2 inline-flex items-center gap-1.5 bg-[#123B35] hover:bg-[#123B35]/90 text-white px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-xs"
          >
            <span>Start Practice</span>
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        /* Activity Stream (Max 4 items to maintain perfect column balance) */
        <div className="space-y-2.5">
          {recentActivity.slice(0, 4).map((item, idx) => {
            const isExpanded = expandedIndex === idx;
            const percent = Math.round(item.percentage);
            const { icon: ActivityIcon, bg: iconBg, label: fallbackLabel } = getActivityConfig(item.attempt_type);
            const typeLabel = (ATTEMPT_TYPE_LABEL && ATTEMPT_TYPE_LABEL[item.attempt_type]) || fallbackLabel;

            return (
              <div
                key={idx}
                className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 rounded-2xl overflow-hidden transition-all hover:border-[#168A78]/50 group"
              >
                <div
                  onClick={(e) => toggleExpand(idx, e)}
                  className="p-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                      <ActivityIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-[#168A78] transition-colors">
                        {typeLabel} · {item.chapter_name || 'Chapter'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        <Clock size={12} className="text-slate-400 shrink-0" />
                        <span>{formatRelativeTime ? formatRelativeTime(item.submitted_at) : 'Recently'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${getScoreBadgeStyle(percent)}`}>
                      {percent}%
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 group-hover:text-[#123B35] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded Details Panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      variants={expandVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="px-4 py-3 bg-white/90 dark:bg-slate-900/60 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">Accuracy:</span>
                          <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden inline-block">
                            <div
                              className="h-full bg-[#168A78] rounded-full"
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                          <span className="font-extrabold text-slate-900 dark:text-white">{percent}%</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium capitalize">
                          Attempt type: {typeLabel}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (recentActivityTarget) navigate(recentActivityTarget(item.attempt_type));
                          else navigate('/mock-tests/history');
                        }}
                        className="bg-[#123B35] hover:bg-[#123B35]/90 text-white text-xs px-3.5 py-1.5 rounded-xl font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs transition-all active:scale-95"
                      >
                        <span>Open Attempt</span>
                        <ExternalLink size={13} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default RecentActivity;
