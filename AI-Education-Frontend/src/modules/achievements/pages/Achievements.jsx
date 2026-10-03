import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import EducationService from '../../../services/EducationService';

const TrophyHeroIllustration = () => (
  <svg viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-sm">
    <ellipse cx="200" cy="130" rx="90" ry="32" fill="#DCFCE7" opacity="0.7" />
    <path d="M250 80C240 60 230 70 225 85C235 90 245 85 250 80Z" fill="#10B981" opacity="0.7" />
    <path d="M265 95C255 75 245 85 240 100C250 105 260 100 265 95Z" fill="#059669" opacity="0.7" />

    {/* Student Girl holding trophy */}
    <circle cx="215" cy="55" r="16" fill="#FDBA74" />
    <path d="M195 50C195 38 205 32 218 32C230 32 235 42 235 52C235 60 225 65 220 68" fill="#582F0E" />
    <path d="M198 70C198 62 230 62 232 70L236 110H194L198 70Z" fill="#EAB308" />

    {/* Gold Trophy */}
    <path d="M235 65L245 65L248 82C248 88 243 92 237 92C231 92 226 88 226 82L229 65Z" fill="#F59E0B" />
    <path d="M232 92H242V98H232V92Z" fill="#D97706" />
    <path d="M228 98H246V103H228V98Z" fill="#B45309" />
    <path d="M245 70C249 70 252 73 251 77C250 81 247 83 244 83" stroke="#F59E0B" strokeWidth="2.5" />
    <path d="M229 70C225 70 222 73 223 77C224 81 227 83 230 83" stroke="#F59E0B" strokeWidth="2.5" />
    <path d="M237 72L239 76L243 77L240 80L241 84L237 82L233 84L234 80L231 77L235 76Z" fill="#FEF08A" />

    {/* Post-it Note (Yellow) */}
    <g transform="rotate(8 280 40)">
      <rect x="245" y="20" width="58" height="66" rx="4" fill="#FEF08A" stroke="#FDE047" strokeWidth="1" className="shadow-xs" />
      <path d="M252 26L257 24" stroke="#CA8A04" strokeWidth="2" strokeLinecap="round" />
      <text x="252" y="39" fill="#854D0E" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Small</text>
      <text x="252" y="50" fill="#854D0E" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Steps ✈️</text>
      <text x="252" y="63" fill="#854D0E" fontSize="10" fontWeight="900" fontFamily="sans-serif">Big</text>
      <text x="252" y="75" fill="#DC2626" fontSize="8" fontWeight="bold" fontFamily="sans-serif">Achievements! 👑</text>
    </g>
  </svg>
);

const DEFAULT_ACHIEVEMENTS = [
  { id: 'first_steps', title: 'First Steps', description: 'Complete your first practice test', category: 'practice', achieved: true, icon: '🌱', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'quiz_whiz', title: 'Quiz Whiz', description: 'Score 80% or more in any quiz', category: 'practice', achieved: true, icon: '🎯', color: 'bg-teal-100 text-teal-700' },
  { id: 'chapter_master', title: 'Chapter Master', description: 'Complete all practice sets in a chapter', category: 'learning', achieved: true, icon: '📖', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'study_streak', title: 'Study Streak', description: 'Study for 7 days in a row', category: 'progress', achieved: false, icon: '⏱️', color: 'bg-slate-100 text-slate-400' },
  { id: 'concept_explorer', title: 'Concept Explorer', description: 'Explore 10 mind maps', category: 'learning', achieved: false, icon: '🧠', color: 'bg-slate-100 text-slate-400' },
  { id: 'top_performer', title: 'Top Performer', description: 'Score in the top 10% in a subject', category: 'special', achieved: true, icon: '⭐', color: 'bg-amber-100 text-amber-700', isSpecial: true },
  { id: 'subject_master', title: 'Subject Master', description: 'Achieve 90% mastery in a subject', category: 'progress', achieved: false, icon: '👥', color: 'bg-slate-100 text-slate-400' },
  { id: 'consistency_pro', title: 'Consistency Pro', description: 'Complete 20 practice tests', category: 'practice', achieved: true, icon: '⚡', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'learning_champion', title: 'Learning Champion', description: 'Reach Level 5 on your learning journey', category: 'progress', achieved: false, icon: '📊', color: 'bg-slate-100 text-slate-400' },
  { id: 'revision_hero', title: 'Revision Hero', description: 'Use flashcards 10 times', category: 'learning', achieved: false, icon: '🏆', color: 'bg-slate-100 text-slate-400' },
  { id: 'ask_learn', title: 'Ask & Learn', description: 'Ask 50 questions to StudySpace', category: 'learning', achieved: false, icon: '💬', color: 'bg-slate-100 text-slate-400' },
  { id: 'ultimate_learner', title: 'Ultimate Learner', description: 'Unlock all achievement badges', category: 'special', achieved: false, icon: '👑', color: 'bg-slate-100 text-slate-400' },
];

const Achievements = () => {
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [achRes, statsRes] = await Promise.allSettled([
          EducationService.getAchievements(),
          EducationService.getGameStats(),
        ]);

        if (!cancelled) {
          const apiBadges = achRes.status === 'fulfilled' ? achRes.value?.data || [] : [];
          setStats(statsRes.status === 'fulfilled' ? statsRes.value?.data || null : null);

          // Merge API response with design badge list dynamically
          if (apiBadges.length > 0) {
            const merged = DEFAULT_ACHIEVEMENTS.map((def) => {
              const match = apiBadges.find((b) => b.id === def.id || b.title?.toLowerCase() === def.title.toLowerCase());
              return match ? { ...def, ...match, achieved: match.achieved ?? def.achieved } : def;
            });
            setAchievements(merged);
          } else {
            setAchievements(DEFAULT_ACHIEVEMENTS);
          }
        }
      } catch {
        if (!cancelled) setError("Couldn't load your achievements data. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const achievedCount = useMemo(() => achievements.filter((a) => a.achieved).length, [achievements]);

  const filteredBadges = useMemo(() => {
    if (activeCategory === 'ALL') return achievements;
    return achievements.filter((a) => a.category?.toLowerCase() === activeCategory.toLowerCase());
  }, [achievements, activeCategory]);

  const level = stats?.level || 2;
  const points = stats?.coins || stats?.xp || 89;
  const xpIntoLevel = stats?.xp_into_level || 320;
  const xpForNextLevel = stats?.xp_for_next_level || 500;
  const levelProgressPct = Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100));

  const missions = stats?.missions || [
    { id: 'm1', title: 'Answer 5 questions today', progress: 2, target: 5 },
    { id: 'm2', title: 'Complete 3 quizzes this week', progress: 1, target: 3 },
    { id: 'm3', title: 'Keep your weekly average at 70% or higher', progress: 2, target: 70 },
  ];

  return (
    <main className="flex-grow py-6 px-3 sm:px-6 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">

        {/* Top Hero Banner - My Achievements */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xs border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4 z-10 max-w-xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-3xl">emoji_events</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">My Achievements</h1>
              <p className="text-slate-500 font-medium text-xs sm:text-sm mt-0.5">
                Track your milestones and unlock more as you learn.
              </p>
            </div>
          </div>

          <div className="relative w-72 sm:w-80 h-36 shrink-0 flex items-center justify-center z-10">
            <TrophyHeroIllustration />
          </div>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <span className="material-symbols-outlined animate-spin text-4xl text-emerald-600">progress_activity</span>
            <p className="text-sm font-semibold text-slate-500">Loading achievement milestones...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-600 border border-slate-200">{error}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            {/* Left Column (8 cols): Achievement Badges Grid */}
            <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-5">
              
              {/* Badges Header + Filter Category Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Achievement Badges</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    <strong>{achievedCount}</strong> of {achievements.length} milestones unlocked
                  </p>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'learning', label: 'Learning' },
                    { id: 'practice', label: 'Practice' },
                    { id: 'progress', label: 'Progress' },
                    { id: 'special', label: 'Special' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        activeCategory === cat.id
                          ? 'bg-emerald-800 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 Columns Badge Grid (12 items) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {filteredBadges.map((badge, idx) => (
                  <div
                    key={badge.id || idx}
                    className={`rounded-2xl p-4 border transition-all flex flex-col justify-between space-y-3 ${
                      badge.isSpecial && badge.achieved
                        ? 'bg-gradient-to-br from-amber-50 to-yellow-50/70 border-amber-200 shadow-2xs'
                        : badge.achieved
                        ? 'bg-emerald-50/30 border-emerald-100/80 shadow-2xs'
                        : 'bg-slate-50/50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                        badge.achieved ? (badge.isSpecial ? 'bg-amber-400 text-white' : 'bg-emerald-100 text-emerald-700') : 'bg-slate-200/70 text-slate-500'
                      }`}>
                        {badge.icon}
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug">{badge.title}</h3>
                        <p className="text-[11px] text-slate-500 font-medium leading-tight">{badge.description}</p>
                      </div>
                    </div>

                    <div>
                      {badge.achieved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                          <span className="material-symbols-outlined text-[13px]">check_circle</span> Unlocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          <span className="material-symbols-outlined text-[13px]">lock</span> Locked
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column (4 cols): Profile Widgets */}
            <div className="lg:col-span-4 space-y-5">
              
              {/* Level & Points Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-extrabold text-lg flex items-center justify-center shadow-md">
                      {level}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">Level {level}</h3>
                      <p className="text-xs text-slate-500 font-semibold">Curious Learner</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs font-black text-amber-700">
                    <span>⭐</span>
                    <span>{points} points</span>
                  </div>
                </div>

                {/* Level XP Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] font-extrabold text-slate-500">
                    <span>{xpIntoLevel} / {xpForNextLevel} XP</span>
                    <span>Level {level + 1}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${levelProgressPct}%` }} />
                  </div>
                </div>
              </div>

              {/* Missions Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Missions</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Complete these tasks to earn rewards.</p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {missions.map((m, idx) => {
                    const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
                    return (
                      <div key={m.id || idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-slate-800 text-[11px] flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-emerald-600 text-sm">check_box</span>
                            {m.title}
                          </span>
                          <span className="font-bold text-slate-400 text-[11px]">{m.progress}/{m.target}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leaderboard Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">Leaderboard</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Compare your XP with other learners</p>
                    </div>
                  </div>
                  <button className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1 bg-slate-100 rounded-xl cursor-pointer">
                    View Leaderboard
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-2">
                      <span className="text-amber-500 text-sm">👑</span> Aarav Mehta
                    </span>
                    <span className="text-slate-500">520 XP</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl text-xs font-black bg-emerald-50 text-emerald-900 border border-emerald-100">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                      <span>You</span>
                    </span>
                    <span className="text-emerald-700">{stats?.xp || 320} XP</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center text-[10px]">3</span> Riya Sharma
                    </span>
                    <span className="text-slate-500">280 XP</span>
                  </div>
                </div>
              </div>

              {/* Upcoming Unlocks Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">🎁 Upcoming Unlocks</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Keep learning to unlock these next!</p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { title: 'Study Streak', info: '7 days', icon: '🔒' },
                    { title: 'Concept Explorer', info: '10 mind maps', icon: '🔒' },
                    { title: 'Subject Master', info: '90% mastery', icon: '🔒' },
                  ].map((item, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 flex flex-col items-center text-center space-y-1">
                      <div className="w-7 h-7 rounded-xl bg-slate-200/80 text-slate-500 flex items-center justify-center text-xs">
                        {item.icon}
                      </div>
                      <p className="font-bold text-slate-900 text-[10px] leading-tight">{item.title}</p>
                      <span className="text-[9px] font-semibold text-slate-400">{item.info}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </main>
  );
};

export default Achievements;
