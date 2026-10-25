import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle, Circle, ArrowRight, BookOpen, Target, Award, FileText } from 'lucide-react';
import { itemVariants } from '../../animations/variants';

const RecommendationCard = ({
  missionState,
  dailyMission,
  weakestChapter,
  continueChapter,
  weeklyPercent,
  dashboard,
  onContinue,
}) => {
  const navigate = useNavigate();

  // Dynamically build plan items based on actual student progress & props
  const planItems = [];

  if (continueChapter) {
    planItems.push({
      id: 'continue',
      title: `Continue: ${continueChapter.chapter_name || continueChapter.name}`,
      subtitle: `${continueChapter.subjectName || continueChapter.subject_name || 'In Progress'}`,
      completed: false,
      icon: BookOpen,
      onClick: () => {
        if (onContinue) onContinue();
        else navigate('/my-learning/subjects');
      },
    });
  }

  if (dailyMission) {
    planItems.push({
      id: 'mission',
      title: `Daily Goal: ${dailyMission.title || 'Answer Questions'}`,
      subtitle: `${dailyMission.current || 0}/${dailyMission.target || 20} Completed`,
      completed: (dailyMission.current || 0) >= (dailyMission.target || 20),
      icon: Target,
      onClick: () => navigate('/practice'),
    });
  }

  if (weakestChapter) {
    planItems.push({
      id: 'weakest',
      title: `Focus Topic: ${weakestChapter.chapter_name || weakestChapter.name}`,
      subtitle: `Needs Practice • ${weakestChapter.subjectName || ''}`,
      completed: false,
      icon: Award,
      onClick: () => navigate(`/practice?chapter=${weakestChapter.chapter_id}`),
    });
  }

  // General core study tasks
  planItems.push({
    id: 'mock_test',
    title: 'Take a Mock Test',
    subtitle: 'Practice & Evaluate Knowledge',
    completed: false,
    icon: Calendar,
    onClick: () => navigate('/mock-tests'),
  });

  planItems.push({
    id: 'notes',
    title: 'Revise & Make Notes',
    subtitle: 'Review key formulas and concepts',
    completed: false,
    icon: FileText,
    onClick: () => navigate('/notes'),
  });

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-4 sm:p-5 shadow-xs"
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Calendar size={16} />
          </div>
          <h2 className="font-black text-lg text-slate-900 dark:text-white">Today's Plan</h2>
        </div>
        <button
          onClick={() => navigate('/academic-calendar')}
          className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          View All <ArrowRight size={14} />
        </button>
      </div>

      {/* Checklist items */}
      <div className="space-y-3">
        {planItems.map((item) => (
          <div
            key={item.id}
            onClick={item.onClick}
            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer group ${
              item.completed
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40'
                : 'bg-slate-50/60 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/40 hover:bg-slate-100/80 dark:hover:bg-slate-700/50'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="text-emerald-600 dark:text-emerald-400 shrink-0">
                {item.completed ? (
                  <CheckCircle size={20} className="fill-emerald-600 dark:fill-emerald-500 text-white" />
                ) : (
                  <Circle size={20} className="text-slate-400 dark:text-slate-500" />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={`text-xs sm:text-sm font-black truncate ${
                    item.completed
                      ? 'line-through text-slate-500 dark:text-slate-400'
                      : 'text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                  }`}
                >
                  {item.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                  {item.subtitle}
                </p>
              </div>
            </div>

            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[20px] group-hover:translate-x-0.5 transition-transform shrink-0">
              chevron_right
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default RecommendationCard;
