import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Layers, ArrowRight, Sigma, FlaskConical, BookOpen, Globe2, CheckCircle2, PlayCircle } from 'lucide-react';
import { itemVariants } from '../../animations/variants';

const DEFAULT_SUBJECT_DATA = [
  {
    subject_id: 'math',
    subject_name: 'Mathematics',
    icon: Sigma,
    color: 'bg-indigo-500',
    text: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    mastery: 78,
    chapters: [
      { chapter_id: '1', chapter_number: 1, chapter_name: 'Number Systems', mastery: 65, status: 'in_progress' },
      { chapter_id: '2', chapter_number: 2, chapter_name: 'Polynomials', mastery: 40, status: 'in_progress' },
      { chapter_id: '3', chapter_number: 3, chapter_name: 'Coordinate Geometry', mastery: 85, status: 'completed' },
      { chapter_id: '4', chapter_number: 4, chapter_name: 'Linear Equations in Two Variables', mastery: 30, status: 'not_started' },
    ],
  },
  {
    subject_id: 'sci',
    subject_name: 'Science',
    icon: FlaskConical,
    color: 'bg-emerald-500',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    mastery: 65,
    chapters: [
      { chapter_id: '5', chapter_number: 1, chapter_name: 'Matter in Our Surroundings', mastery: 75, status: 'completed' },
      { chapter_id: '6', chapter_number: 2, chapter_name: 'Is Matter Around Us Pure?', mastery: 50, status: 'in_progress' },
      { chapter_id: '7', chapter_number: 3, chapter_name: 'Atoms and Molecules', mastery: 60, status: 'in_progress' },
    ],
  },
  {
    subject_id: 'eng',
    subject_name: 'English',
    icon: BookOpen,
    color: 'bg-rose-500',
    text: 'text-rose-600',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    mastery: 52,
    chapters: [
      { chapter_id: '8', chapter_number: 1, chapter_name: 'The Fun They Had', mastery: 90, status: 'completed' },
      { chapter_id: '9', chapter_number: 2, chapter_name: 'The Sound of Music', mastery: 45, status: 'in_progress' },
    ],
  },
  {
    subject_id: 'sst',
    subject_name: 'Social Studies',
    icon: Globe2,
    color: 'bg-amber-500',
    text: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    mastery: 40,
    chapters: [
      { chapter_id: '10', chapter_number: 1, chapter_name: 'The French Revolution', mastery: 60, status: 'in_progress' },
      { chapter_id: '11', chapter_number: 2, chapter_name: 'Socialism in Europe', mastery: 35, status: 'in_progress' },
    ],
  },
];

const YourSubjectsCard = ({ subjectProgress }) => {
  const navigate = useNavigate();
  const [selectedSubjectIdx, setSelectedSubjectIdx] = useState(0);

  const subjects = subjectProgress?.length
    ? subjectProgress.map((s, idx) => ({
      subject_id: s.subject_id,
      subject_name: s.subject_name,
      icon: s.subject_name.toLowerCase().includes('math') ? Sigma : s.subject_name.toLowerCase().includes('sci') ? FlaskConical : BookOpen,
      color: idx === 0 ? 'bg-indigo-500' : idx === 1 ? 'bg-emerald-500' : idx === 2 ? 'bg-rose-500' : 'bg-amber-500',
      text: idx === 0 ? 'text-indigo-600' : idx === 1 ? 'text-emerald-600' : idx === 2 ? 'text-rose-600' : 'text-amber-600',
      bg: idx === 0 ? 'bg-indigo-50 dark:bg-indigo-950/30' : idx === 1 ? 'bg-emerald-50 dark:bg-emerald-950/30' : idx === 2 ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-amber-50 dark:bg-amber-950/30',
      mastery: s.mastery || 50,
      chapters: s.chapters?.length
        ? s.chapters.map((ch, cIdx) => ({
          chapter_id: ch.chapter_id,
          chapter_number: ch.chapter_number || cIdx + 1,
          chapter_name: ch.chapter_name || ch.name,
          mastery: Math.round(ch.mastery || ch.progress_percent || 0),
          status: ch.status || 'in_progress',
        }))
        : DEFAULT_SUBJECT_DATA[0].chapters,
    }))
    : DEFAULT_SUBJECT_DATA;

  const currentSubject = subjects[selectedSubjectIdx] || subjects[0];

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col space-y-4"
    >
      {/* Card Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="font-black text-lg sm:text-xl text-slate-900 dark:text-white">Chapter-Wise Progress</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Track completion and mastery across all chapters</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/my-learning/subjects')}
          className="text-xs sm:text-sm font-extrabold text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          View All <ArrowRight size={14} />
        </button>
      </div>

      {/* Subject Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {subjects.map((sub, idx) => {
          const Icon = sub.icon;
          const isSelected = selectedSubjectIdx === idx;
          return (
            <button
              key={idx}
              onClick={() => setSelectedSubjectIdx(idx)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${isSelected
                  ? 'bg-[#123B35] text-white border-[#123B35] shadow-sm scale-102'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100'
                }`}
            >
              <Icon size={14} className={isSelected ? 'text-emerald-300' : sub.text} />
              <span>{sub.subject_name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {sub.mastery}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Chapter List for Selected Subject */}
      <div className="space-y-2.5 pt-1">
        {currentSubject?.chapters?.map((chapter) => (
          <div
            key={chapter.chapter_id}
            onClick={() => navigate(`/lesson-heron?subject=${currentSubject.subject_id}&chapter=${chapter.chapter_id}`)}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 hover:bg-slate-100/80 dark:hover:bg-slate-700/60 transition-all cursor-pointer group gap-3"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shrink-0">
                Ch {chapter.chapter_number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-[#168A78] transition-colors">
                  {chapter.chapter_name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 max-w-[160px] h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${currentSubject.color}`}
                      style={{ width: `${chapter.mastery}%` }}
                    ></div>
                  </div>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{chapter.mastery}%</span>
                </div>
              </div>
            </div>

            <button className="self-end sm:self-center px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-[#123B35] hover:text-white text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600 text-xs font-extrabold flex items-center gap-1 shrink-0 transition-all shadow-2xs group-hover:bg-[#123B35] group-hover:text-white">
              <span>Study Chapter</span>
              <ArrowRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default YourSubjectsCard;
