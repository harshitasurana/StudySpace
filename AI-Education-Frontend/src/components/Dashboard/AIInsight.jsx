import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, Target, FileText, CheckSquare, Sparkles, ArrowRight } from 'lucide-react';
import { itemVariants } from '../../animations/variants';

const AIInsight = ({
  loadingRecommendation,
  recommendedNext,
  continueChapter,
  strongestChapter,
  weakestChapter,
  t,
  onRecommendedAction,
}) => {
  const navigate = useNavigate();

  const title = recommendedNext?.chapter_name || weakestChapter?.name || weakestChapter?.chapter_name || 'Practice Quadrilaterals';
  const desc =
    recommendedNext?.reason_text ||
    (weakestChapter
      ? `Based on your recent attempts, ${weakestChapter.name || weakestChapter.chapter_name} needs a little more practice.`
      : 'Based on your recent performance, this concept needs a little more practice.');

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white dark:bg-slate-800 border border-[#E6E0D5] dark:border-slate-700 rounded-3xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-300"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-[#D9A441]/20 text-[#D9A441] dark:text-amber-400 flex items-center justify-center font-bold">
            <Lightbulb size={16} />
          </div>
          <h2 className="font-extrabold text-lg text-[#17212B] dark:text-white">AI Recommends for You</h2>
        </div>
        <button
          onClick={() => navigate('/mastery-analytics')}
          className="text-xs font-extrabold text-[#D9785B] hover:underline cursor-pointer"
        >
          Why this?
        </button>
      </div>

      {/* Main Grid (2 cols) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        {/* Main Recommendation Callout (6 cols) */}
        <div className="md:col-span-6 bg-[#F3B7A8]/20 dark:bg-rose-950/20 border border-[#F3B7A8]/50 dark:border-rose-900/40 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#D9785B] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Target size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#17212B] dark:text-white leading-tight">{title}</h3>
              <p className="text-xs text-[#68737A] dark:text-slate-400 mt-1.5 leading-relaxed font-medium">{desc}</p>
            </div>
          </div>

          <button
            onClick={onRecommendedAction || (() => navigate('/practice'))}
            className="w-full bg-[#D9785B] hover:bg-[#c8664a] text-white px-5 py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm active:scale-95 mt-2"
          >
            <span>Start Challenge</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Secondary Recommendations List (6 cols) */}
        <div className="md:col-span-6 flex flex-col justify-between space-y-3">
          <div
            onClick={() => navigate('/notes')}
            className="flex items-center gap-3 p-3 rounded-xl bg-[#F7F3EA] dark:bg-slate-700/40 border border-[#E6E0D5] dark:border-slate-700 hover:border-[#168A78]/50 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#E9E3F8] text-[#123B35] dark:text-purple-300 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold text-[#17212B] dark:text-white truncate group-hover:text-[#168A78]">Revise key formulas</p>
              <p className="text-xs text-[#68737A] dark:text-slate-400 truncate">For better retention</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/practice/my-quizzes')}
            className="flex items-center gap-3 p-3 rounded-xl bg-[#F7F3EA] dark:bg-slate-700/40 border border-[#E6E0D5] dark:border-slate-700 hover:border-[#168A78]/50 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#E9E3F8] text-[#123B35] dark:text-purple-300 flex items-center justify-center shrink-0">
              <CheckSquare size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold text-[#17212B] dark:text-white truncate group-hover:text-[#168A78]">Take a short quiz</p>
              <p className="text-xs text-[#68737A] dark:text-slate-400 truncate">10 questions • 5 min</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/mind-map')}
            className="flex items-center gap-3 p-3 rounded-xl bg-[#F7F3EA] dark:bg-slate-700/40 border border-[#E6E0D5] dark:border-slate-700 hover:border-[#168A78]/50 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#E9E3F8] text-[#123B35] dark:text-purple-300 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold text-[#17212B] dark:text-white truncate group-hover:text-[#168A78]">Visualize</p>
              <p className="text-xs text-[#68737A] dark:text-slate-400 truncate">See how the concepts connect</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AIInsight;
