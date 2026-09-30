import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Zap, FileText, BookOpen, Camera, Sparkles } from 'lucide-react';
import { itemVariants } from '../../animations/variants';

const ACTIONS = [
  {
    key: 'mcq',
    label: 'Generate Quiz',
    subtitle: 'From any chapter',
    icon: FileText,
    path: '/practice',
    bg: 'bg-[#F3B7A8]/30 dark:bg-rose-950/30 border-[#F3B7A8] dark:border-rose-900/40 text-[#D9785B]',
    iconBg: 'bg-[#D9785B] text-white',
  },
  {
    key: 'textbook',
    label: 'Ask from Textbook',
    subtitle: 'NCERT based',
    icon: BookOpen,
    path: '/read/1',
    bg: 'bg-[#D9A441]/20 dark:bg-amber-950/30 border-[#D9A441]/40 dark:border-amber-900/40 text-[#D9A441]',
    iconBg: 'bg-[#D9A441] text-white',
  },
  {
    key: 'scan',
    label: 'Scan Question',
    subtitle: 'Image to solve',
    icon: Camera,
    path: '/ai-tutor/chat',
    bg: 'bg-[#6FA58D]/20 dark:bg-emerald-950/30 border-[#6FA58D]/40 dark:border-emerald-900/40 text-[#168A78]',
    iconBg: 'bg-[#168A78] text-white',
  },
  {
    key: 'visualize',
    label: 'Visualize',
    subtitle: 'See concept connections',
    icon: Sparkles,
    path: '/mind-map',
    bg: 'bg-[#E9E3F8] dark:bg-purple-950/30 border-[#E9E3F8] dark:border-purple-900/40 text-[#123B35] dark:text-purple-300',
    iconBg: 'bg-[#123B35] text-white',
  },
];

const QuickActions = ({ showComingSoon, comingSoonLabel }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white dark:bg-slate-800 border border-[#E6E0D5] dark:border-slate-700 rounded-3xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-300"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-[#D9785B]/20 text-[#D9785B] flex items-center justify-center font-bold">
            <Zap size={16} />
          </div>
          <h2 className="font-extrabold text-lg text-[#17212B] dark:text-white">Quick Actions</h2>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="text-xs font-extrabold text-[#68737A] dark:text-slate-400 hover:underline cursor-pointer"
        >
          Customize
        </button>
      </div>

      {/* Grid of 4 Action Tiles */}
      <div className="grid grid-cols-2 gap-3.5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              onClick={() => navigate(action.path)}
              className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer group hover:scale-[1.02] shadow-2xs ${action.bg}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${action.iconBg}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-xs sm:text-sm text-[#17212B] dark:text-white truncate">{action.label}</p>
                <p className="text-xs text-[#68737A] dark:text-slate-400 font-medium truncate mt-0.5">
                  {action.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default QuickActions;
