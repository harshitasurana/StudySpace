import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BarChart2, Clock, CheckCircle2, Flame, TrendingUp, ChevronDown, Sprout } from 'lucide-react';
import { itemVariants } from '../../animations/variants';

const WEEK_DATA = [
  { day: 'Mon', minutes: 30, height: '40%' },
  { day: 'Tue', minutes: 45, height: '60%' },
  { day: 'Wed', minutes: 35, height: '48%' },
  { day: 'Thu', minutes: 75, height: '90%' },
  { day: 'Fri', minutes: 50, height: '65%' },
  { day: 'Sat', minutes: 25, height: '35%' },
  { day: 'Sun', minutes: 60, height: '75%' },
];

const LearningMomentum = ({ dashboard, weeklyPercent }) => {
  const [timeframe, setTimeframe] = useState('This Week');

  const studyTimeLabel = dashboard?.total_study_time || '3h 40m';
  const questionsSolvedCount = dashboard?.questions_solved ?? 42;
  const streakCount = dashboard?.streak_days ?? 12;

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-4 sm:p-5 shadow-xs"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
            <BarChart2 size={16} />
          </div>
          <h2 className="font-black text-lg text-slate-900 dark:text-white">Your Learning Momentum</h2>
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

      {/* Top 3 Stat Cards */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
          <div>
            <p className="font-black text-sm text-slate-900 dark:text-white leading-none">{studyTimeLabel}</p>
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Total Study Time</p>
          </div>
        </div>

        <div className="bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/40 rounded-2xl p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <p className="font-black text-sm text-slate-900 dark:text-white leading-none">{questionsSolvedCount}</p>
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Questions Solved</p>
          </div>
        </div>

        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Flame size={16} />
          </div>
          <div>
            <p className="font-black text-sm text-slate-900 dark:text-white leading-none">{streakCount}</p>
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Day Streak</p>
          </div>
        </div>
      </div>

      {/* Main Chart + Callout split */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        {/* Bar Chart (8 cols) */}
        <div className="md:col-span-8 space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono text-slate-400 border-b border-slate-100 dark:border-slate-700/40 pb-0.5">
            <span>60m</span>
            <span>30m</span>
            <span>0m</span>
          </div>

          <div className="h-24 flex items-end justify-between pt-1 px-1">
            {WEEK_DATA.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer">
                <div className="w-7 sm:w-8 bg-slate-100 dark:bg-slate-700 rounded-t-xl overflow-hidden h-full flex items-end justify-center">
                  <div
                    className="w-full bg-emerald-500 group-hover:bg-emerald-400 transition-all rounded-t-xl"
                    style={{ height: item.height }}
                  ></div>
                </div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-emerald-600">
                  {item.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Side Callout Badges (4 cols) */}
        <div className="md:col-span-4 space-y-3">
          <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 p-3 rounded-2xl flex items-center gap-2.5">
            <TrendingUp size={20} className="text-emerald-600 shrink-0" />
            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 leading-tight">
              18% more learning than last week!
            </span>
          </div>

          <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 p-3 rounded-2xl flex items-center gap-2.5">
            <Sprout size={20} className="text-amber-600 shrink-0" />
            <span className="text-xs font-black text-amber-800 dark:text-amber-300 leading-tight">
              Great consistency! Keep going!
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LearningMomentum;
