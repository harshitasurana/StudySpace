import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Compass, BookOpen, Target, BarChart2, Trophy, ArrowRight } from 'lucide-react';
import { itemVariants } from '../../animations/variants';

const STAGES = [
  { key: 'explore', label: 'Explore', subtitle: 'Discover new topics', icon: Compass, path: '/my-learning/subjects', color: 'bg-[#123B35] text-white' },
  { key: 'learn', label: 'Learn', subtitle: 'Build your concepts', icon: BookOpen, path: '/my-learning/subjects', color: 'bg-[#168A78] text-white' },
  { key: 'challenge', label: 'Challenge', subtitle: 'Test your knowledge', icon: Target, path: '/practice', color: 'bg-[#D9785B] text-white' },
  { key: 'master', label: 'Master', subtitle: 'Track your progress', icon: BarChart2, path: '/progress/overview', color: 'bg-[#6FA58D] text-white' },
  { key: 'achieve', label: 'Achieve', subtitle: 'Be your best self', icon: Trophy, path: '/achievements', color: 'bg-[#D9A441] text-white' },
];

const LearningJourney = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white dark:bg-slate-800 border border-[#E6E0D5] dark:border-slate-700 rounded-3xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-300"
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-[#6FA58D]/20 text-[#123B35] dark:text-emerald-400 flex items-center justify-center font-bold">
            <Compass size={16} />
          </div>
          <h2 className="font-extrabold text-lg text-[#17212B] dark:text-white">Your Learning Journey</h2>
        </div>
        <button
          onClick={() => navigate('/my-learning/learning-path')}
          className="text-xs font-extrabold text-[#168A78] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          View Journey <ArrowRight size={14} />
        </button>
      </div>

      {/* Horizontal Connected Interactive Timeline */}
      <div className="relative py-2">
        {/* Connecting Line */}
        <div className="absolute top-7 left-10 right-10 h-1 bg-[#E6E0D5] dark:bg-slate-700 z-0"></div>

        <div className="grid grid-cols-5 gap-2 relative z-10">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            const isActive = location.pathname.startsWith(stage.path.split('/')[1] ? `/${stage.path.split('/')[1]}` : stage.path);
            return (
              <button
                key={stage.key}
                onClick={() => navigate(stage.path)}
                className="flex flex-col items-center text-center group cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 group-hover:scale-110 ${stage.color} ${
                    isActive ? 'ring-4 ring-[#168A78]/30 scale-105 shadow-md' : ''
                  }`}
                >
                  <Icon size={20} />
                </div>
                <span className="font-extrabold text-xs sm:text-sm text-[#17212B] dark:text-white mt-2.5 group-hover:text-[#168A78] transition-colors">
                  {stage.label}
                </span>
                <span className="text-[11px] text-[#68737A] dark:text-slate-400 font-medium hidden sm:block mt-0.5 max-w-[100px] leading-tight">
                  {stage.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default LearningJourney;
