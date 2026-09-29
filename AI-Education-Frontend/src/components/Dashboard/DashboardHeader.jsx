import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Search, Target, Zap, FileText, Copy, Check, ArrowRight } from 'lucide-react';
import { itemVariants } from '../../animations/variants';
import heroStudyRoomImg from '../../assets/hero_study_room.jpg';
import aiRobotImg from '../../assets/ai_robot_companion.jpg';

const DashboardHeader = ({
  welcomeText,
  greetingName,
  identityLine,
  loadingRecommendation,
  streakDays,
  loadingGameStats,
  weeklyMission,
  weeklyPercent,
  studentCode,
  codeCopied,
  onCopyCode,
  dashboard,
}) => {
  const navigate = useNavigate();
  const [askInput, setAskInput] = useState('');
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const handleAskSubmit = (e) => {
    e.preventDefault();
    if (!askInput.trim()) return;
    navigate(`/ai-tutor/chat?prompt=${encodeURIComponent(askInput)}`);
  };

  return (
    <motion.div variants={itemVariants} className="space-y-4">
      {/* Top Banner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Greeting + Stats (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3 py-1">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{today}</p>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Good morning,{' '}
              <span className="text-[#c85a32] dark:text-[#f87171] underline decoration-[#c85a32]/30 decoration-wavy">
                {greetingName}!
              </span>{' '}
              <span className="inline-block animate-bounce">👋</span>
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mt-1.5 leading-normal italic">
              "Consistent learning today builds the brighter you tomorrow."
            </p>
          </div>

          {/* Quick Stats Badges Row (4 Stat Pills) */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-2.5 flex items-center gap-2 shadow-xs">
              <span className="text-xl">🔥</span>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{streakDays ?? dashboard?.streak_days ?? 0}</p>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Day Streak</p>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-2.5 flex items-center gap-2 shadow-xs">
              <span className="text-xl">⭐</span>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{dashboard?.points ?? dashboard?.xp ?? 350}</p>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Total XP</p>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-2.5 flex items-center gap-2 shadow-xs">
              <span className="text-xl">🏆</span>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{dashboard?.achievements_count ?? 8}</p>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">Achievements</p>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-2.5 flex items-center gap-2 shadow-xs">
              <span className="text-xl">📊</span>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{dashboard?.rank_label ?? 'Top 20%'}</p>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">In Class</p>
              </div>
            </div>
          </div>

          {/* Student Code Option */}
          {studentCode && (
            <div className="flex items-center justify-between bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 rounded-2xl px-3.5 py-1.5 w-full shadow-2xs mt-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-amber-800 dark:text-amber-300 font-sans font-extrabold text-xs">Student Code:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-xs sm:text-sm tracking-widest truncate">{studentCode}</span>
              </div>
              <button
                onClick={onCopyCode}
                className="text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/60 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-400/40 cursor-pointer font-sans font-black text-xs px-2.5 py-0.5 rounded-xl flex items-center gap-1 transition-all shrink-0 ml-2"
              >
                {codeCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{codeCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Hero Study Room + Meet EduAI Card (7 cols) */}
        <div className="lg:col-span-7 relative rounded-3xl overflow-hidden shadow-md border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row h-auto">
          {/* Background Study Room Image */}
          <div className="absolute inset-0 z-0">
            <img src={heroStudyRoomImg} alt="Study Room" className="w-full h-full object-cover object-left" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0e3b3a]/92"></div>
          </div>

          {/* Top handwritten note */}
          <div className="absolute top-3 left-4 z-10 hidden sm:block">
            <span className="font-handwriting text-slate-800 text-xl font-bold drop-shadow-xs tracking-wide bg-white/80 backdrop-blur-xs px-3 py-1 rounded-full border border-white/90">
              A Brighter You Is Coming ♡
            </span>
          </div>

          {/* Right Overlaid Card: Meet EduAI */}
          <div className="relative z-10 ml-auto w-full md:w-[50%] bg-[#0e3b3a]/94 backdrop-blur-md p-4 text-white flex flex-col justify-between border-l border-emerald-500/20 shadow-xl">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-base sm:text-lg tracking-tight text-emerald-100">Meet StudySpace</h3>
                  <p className="text-xs text-emerald-200/80 font-medium">Your Personal Learning Companion</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-emerald-800/80 border border-emerald-400/30 flex items-center justify-center text-white shrink-0 overflow-hidden shadow-md">
                  <img src={aiRobotImg} alt="StudySpace Bot" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Chat Bubble */}
              <div className="mt-2 bg-white/10 border border-white/15 rounded-xl p-2 text-xs text-emerald-50 relative">
                <p className="leading-snug font-medium">Ask me anything... I'm here to help you learn, solve and grow.</p>
              </div>

              {/* Ask Input Bar */}
              <form onSubmit={handleAskSubmit} className="mt-2 flex items-center bg-white/90 dark:bg-slate-900/90 rounded-full px-3 py-1 text-slate-900 border border-emerald-500/40">
                <input
                  type="text"
                  placeholder="Ask anything..."
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-900 dark:text-white placeholder-slate-400 font-medium w-full outline-none"
                />
                <button type="submit" className="w-6 h-6 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 ml-1 cursor-pointer transition-transform hover:scale-105">
                  <ArrowRight size={13} />
                </button>
              </form>
            </div>

            {/* Quick Action Chips inside EduAI card */}
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <button
                onClick={() => navigate('/lesson-heron')}
                className="flex items-center gap-1.5 bg-emerald-950/70 hover:bg-emerald-800/70 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-emerald-100 cursor-pointer transition-colors text-left"
              >
                <Search size={12} className="text-emerald-300 shrink-0" />
                <span className="truncate">Explain a concept</span>
              </button>
              <button
                onClick={() => navigate('/practice')}
                className="flex items-center gap-1.5 bg-emerald-950/70 hover:bg-emerald-800/70 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-emerald-100 cursor-pointer transition-colors text-left"
              >
                <Target size={12} className="text-emerald-300 shrink-0" />
                <span className="truncate">Solve a problem</span>
              </button>
              <button
                onClick={() => navigate('/practice/my-quizzes')}
                className="flex items-center gap-1.5 bg-emerald-950/70 hover:bg-emerald-800/70 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-emerald-100 cursor-pointer transition-colors text-left"
              >
                <Zap size={12} className="text-emerald-300 shrink-0" />
                <span className="truncate">Generate a quiz</span>
              </button>
              <button
                onClick={() => navigate('/ai-tutor/study-plan')}
                className="flex items-center gap-1.5 bg-emerald-950/70 hover:bg-emerald-800/70 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-emerald-100 cursor-pointer transition-colors text-left"
              >
                <FileText size={12} className="text-emerald-300 shrink-0" />
                <span className="truncate">Create a study plan</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DashboardHeader;
