import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import EducationService from '../../../services/EducationService';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getSubjectIcon = (name = '') => {
  const lower = name.toLowerCase();
  if (lower.includes('math')) return '📐';
  if (lower.includes('scien')) return '🧪';
  if (lower.includes('eng')) return '📖';
  if (lower.includes('soc')) return '🌐';
  if (lower.includes('hin')) return '🕉️';
  if (lower.includes('phy')) return '⚡';
  if (lower.includes('chem')) return '⚗️';
  if (lower.includes('bio')) return '🌿';
  return '📚';
};

const getSubjectStatus = (mastery = 0) => {
  if (mastery >= 75) return { label: 'Strong', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '🏆' };
  if (mastery >= 50) return { label: 'On Track', badgeClass: 'bg-emerald-50/80 text-emerald-600 border-emerald-100', icon: '📈' };
  return { label: 'Needs Practice', badgeClass: 'bg-rose-50 text-rose-600 border-rose-200', icon: '⚠️' };
};

// SVG Hero Illustration for top right banner
const ProgressHeroIllustration = () => (
  <svg viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-sm">
    <ellipse cx="200" cy="120" rx="90" ry="36" fill="#DCFCE7" opacity="0.7" />
    <rect x="175" y="118" width="55" height="12" rx="3" fill="#0D9488" />
    <rect x="177" y="105" width="50" height="12" rx="3" fill="#F59E0B" />
    <rect x="180" y="93" width="46" height="11" rx="3" fill="#4F46E5" />
    <rect x="183" y="83" width="40" height="9" rx="2" fill="#E11D48" />
    <rect x="215" y="105" width="45" height="28" rx="3" fill="#1E293B" />
    <rect x="218" y="108" width="39" height="22" rx="2" fill="#0F172A" />
    <path d="M210 133H265L268 136H207L210 133Z" fill="#64748B" />
    <path d="M237 114L245 118L237 122L229 118L237 114Z" fill="#F59E0B" />
    <g transform="rotate(6 280 40)">
      <rect x="245" y="22" width="58" height="66" rx="4" fill="#FEF08A" stroke="#FDE047" strokeWidth="1" className="shadow-xs" />
      <path d="M252 28L257 26" stroke="#CA8A04" strokeWidth="2" strokeLinecap="round" />
      <text x="252" y="42" fill="#854D0E" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Small</text>
      <text x="252" y="53" fill="#854D0E" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Steps ✈️</text>
      <text x="252" y="66" fill="#854D0E" fontSize="10" fontWeight="900" fontFamily="sans-serif">Big</text>
      <text x="252" y="78" fill="#DC2626" fontSize="9" fontWeight="bold" fontFamily="sans-serif">Progress ❤️</text>
    </g>
    <circle cx="215" cy="55" r="16" fill="#FDBA74" />
    <path d="M195 50C195 38 205 32 218 32C230 32 235 42 235 52C235 60 225 65 220 68" fill="#582F0E" />
    <path d="M198 70C198 62 230 62 232 70L236 110H194L198 70Z" fill="#EAB308" />
  </svg>
);

// Circular Progress Component
const CircleProgress = ({ percent = 0, label, color = '#10B981', size = 68, strokeWidth = 7 }) => {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E2E8F0" strokeWidth={strokeWidth} fill="transparent" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        <span className="font-extrabold text-sm text-slate-900">{safePercent}%</span>
        {label && <span className="text-[9px] text-slate-500 font-bold mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

const ProgressOverview = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [overviewRes, subjectsRes, achievementsRes] = await Promise.allSettled([
          EducationService.getProgressOverview(),
          EducationService.getSubjectProgress(),
          EducationService.getAchievements(),
        ]);

        if (!cancelled) {
          if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value?.data || null);
          if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value?.data?.subjects || []);
          if (achievementsRes.status === 'fulfilled') setAchievements(achievementsRes.value?.data || []);
        }
      } catch {
        if (!cancelled) setError("Couldn't load your progress analytics. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Compute stats dynamically from real backend API responses
  const learningProgress = overview?.completion_percent ?? overview?.overall_mastery ?? 0;
  const chapterMastery = overview?.overall_mastery ?? 0;
  const practicePerformance = overview?.average_quiz_score ? Math.round(overview.average_quiz_score) : (overview?.overall_mastery ?? 0);
  const streakDays = overview?.streak_days ?? 0;

  // Compute recent activity list
  const recentActivities = overview?.recent_activity || [];

  return (
    <main className="flex-grow py-6 px-2 sm:px-3 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">

        {/* Top Hero Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xs border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="space-y-4 max-w-xl z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md">
                <span className="material-symbols-outlined text-2xl">bar_chart</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">My Progress</h1>
                <p className="text-slate-500 font-medium text-xs sm:text-sm mt-0.5">
                  Track your learning, see your strengths and keep growing.
                </p>
              </div>
            </div>

            {/* Sub Nav Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {[
                { id: 'overview', label: 'Overview', icon: '🎓' },
                { id: 'subjects', label: 'Subjects', icon: '📖', path: '/progress/subjects' },
                { id: 'practice', label: 'Practice', icon: '🎯', path: '/practice' },
                { id: 'study_time', label: 'Study Time', icon: '⏱️' },
                { id: 'achievements', label: 'Achievements', icon: '🏆', path: '/achievements' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.path) navigate(tab.path);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-[#FAF7EE] text-slate-700 hover:bg-slate-200/80 border border-slate-200/60'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Banner Illustration Card */}
          <div className="relative w-72 sm:w-80 h-36 shrink-0 flex items-center justify-center z-10">
            <ProgressHeroIllustration />
          </div>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <span className="material-symbols-outlined animate-spin text-4xl text-emerald-600">progress_activity</span>
            <p className="text-sm font-semibold text-slate-500">Calculating your progress analytics...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-600 border border-slate-200">{error}</div>
        ) : (
          <div className="space-y-6">

            {/* Top Row: 4 Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Learning Progress */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CircleProgress percent={learningProgress} label="On Track" color="#10B981" />
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Learning Progress</h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-tight">
                      You're making great progress! Keep going.
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">trending_up</span>
                </div>
              </div>

              {/* Card 2: Chapter Mastery */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CircleProgress percent={chapterMastery} label="Good" color="#059669" />
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Chapter Mastery</h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-tight">
                      {overview?.chapters_completed ? `${overview.chapters_completed} chapters mastered` : "Ready for practice in a few topics."}
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">auto_stories</span>
                </div>
              </div>

              {/* Card 3: Practice Performance */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CircleProgress percent={practicePerformance} label="Strong" color="#10B981" />
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Practice Performance</h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-tight">
                      Good understanding and quiz accuracy.
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">bar_chart</span>
                </div>
              </div>

              {/* Card 4: Study Consistency */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative inline-flex items-center justify-center w-[68px] h-[68px] rounded-full bg-amber-50 border-4 border-amber-400 text-center shrink-0">
                    <div className="leading-tight">
                      <span className="font-black text-sm text-slate-900 block">{streakDays} days</span>
                      <span className="text-[9px] text-slate-500 font-bold block">in a row</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Study Consistency</h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-tight">
                      Maintain your daily learning streak. 🔥
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                </div>
              </div>

            </div>

            {/* Middle Section: Subject Progress + AI Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              
              {/* Left Column (8 cols): Subject Progress */}
              <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🐍</span>
                    <div>
                      <h2 className="font-extrabold text-slate-900 text-base">Subject Progress</h2>
                      <p className="text-xs text-slate-500 font-medium">Your mastery across all subjects</p>
                    </div>
                  </div>
                  <select className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-xs focus:outline-none">
                    <option>Last 4 Weeks</option>
                    <option>This Term</option>
                    <option>All Time</option>
                  </select>
                </div>

                {/* Subject cards grid - rendered dynamically from subjects API */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                  {subjects.length > 0 ? (
                    subjects.map((sub, idx) => {
                      const name = sub.subject_name || sub.name || 'Subject';
                      const mastery = Math.round(sub.mastery || 0);
                      const status = getSubjectStatus(mastery);
                      const icon = getSubjectIcon(name);

                      return (
                        <div key={sub.subject_id || idx} className="bg-slate-50/70 rounded-2xl p-3 border border-slate-100 flex flex-col items-center text-center space-y-2">
                          <div className="w-10 h-10 rounded-full bg-white shadow-xs flex items-center justify-center text-lg">
                            {icon}
                          </div>
                          <CircleProgress percent={mastery} size={54} strokeWidth={5} color={mastery >= 60 ? '#10B981' : '#EF4444'} />
                          <p className="font-extrabold text-slate-900 text-xs truncate w-full">{name}</p>
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${status.badgeClass}`}>
                            {status.icon} {status.label}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-5 text-center py-6 text-slate-400 text-xs font-semibold">
                      Loading subject progress data...
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (4 cols): AI Insights */}
              <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💡</span>
                    <h2 className="font-extrabold text-slate-900 text-base">AI Insights</h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-100">
                    Personalized for You
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-center justify-between gap-3 group cursor-pointer hover:bg-emerald-50 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg">🌱</span>
                      <div>
                        <p className="font-extrabold text-slate-900 text-xs">Strong in Visual & Conceptual Topics</p>
                        <p className="text-[11px] text-slate-500 font-medium">Keep practicing to maintain this strength!</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-emerald-600 text-lg shrink-0">chevron_right</span>
                  </div>

                  <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100 flex items-center justify-between gap-3 group cursor-pointer hover:bg-amber-50 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg">🎯</span>
                      <div>
                        <p className="font-extrabold text-slate-900 text-xs">Focus on Practice Questions & Exercises</p>
                        <p className="text-[11px] text-slate-500 font-medium">Try quiz sessions for weaker topics.</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-amber-600 text-lg shrink-0">chevron_right</span>
                  </div>

                  <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center justify-between gap-3 group cursor-pointer hover:bg-indigo-50 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg">📖</span>
                      <div>
                        <p className="font-extrabold text-slate-900 text-xs">Revise key notes this week</p>
                        <p className="text-[11px] text-slate-500 font-medium">Improves chapter retention and readiness.</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-indigo-600 text-lg shrink-0">chevron_right</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Row: Learning Activity + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              
              {/* Left Column (8 cols): Learning Activity */}
              <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🗓️</span>
                    <div>
                      <h2 className="font-extrabold text-slate-900 text-base">Learning Activity</h2>
                      <p className="text-xs text-slate-500 font-medium">Your study time and practice activity</p>
                    </div>
                  </div>
                  <select className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold text-xs focus:outline-none">
                    <option>This Week</option>
                    <option>Last Week</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center pt-2">
                  
                  {/* Daily Bar Chart */}
                  <div className="sm:col-span-7 flex items-end justify-between h-36 pt-4 border-b border-slate-100 pb-2 px-2">
                    {[
                      { day: 'Mon', height: 'h-16' },
                      { day: 'Tue', height: 'h-24' },
                      { day: 'Wed', height: 'h-20' },
                      { day: 'Thu', height: 'h-14' },
                      { day: 'Fri', height: 'h-28' },
                      { day: 'Sat', height: 'h-18' },
                      { day: 'Sun', height: 'h-24' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex flex-col items-center space-y-2 flex-1">
                        <div className="w-6 bg-slate-100 rounded-t-lg h-28 flex items-end justify-center">
                          <div className={`w-full bg-emerald-500 rounded-t-lg ${item.height} transition-all duration-500`} />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">{item.day}</span>
                      </div>
                    ))}
                  </div>

                  {/* Donut Chart: Time by Activity */}
                  <div className="sm:col-span-5 bg-slate-50/70 rounded-2xl p-4 border border-slate-100 space-y-3">
                    <p className="font-extrabold text-xs text-slate-700">Time by Activity</p>
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 rounded-full border-8 border-emerald-500 border-t-indigo-500 border-r-amber-400 flex items-center justify-center text-center shrink-0">
                        <div className="leading-tight">
                          <span className="font-black text-xs text-slate-900 block">
                            {overview?.study_time_seconds ? `${(overview.study_time_seconds / 3600).toFixed(1)}h` : '12.5h'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold block">Total</span>
                        </div>
                      </div>
                      <div className="space-y-1 text-[11px] font-bold text-slate-600">
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Practice 32%</div>
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Reading 28%</div>
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> AI Learning 20%</div>
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Notes 12%</div>
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Others 8%</div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Right Column (4 cols): Recent Activity */}
              <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏱️</span>
                    <h2 className="font-extrabold text-slate-900 text-base">Recent Activity</h2>
                  </div>
                  <button
                    onClick={() => navigate('/practice')}
                    className="text-indigo-600 hover:underline text-xs font-extrabold inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    View All →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {recentActivities.length > 0 ? (
                    recentActivities.slice(0, 4).map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50/70 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {idx === 0 ? '📋' : idx === 1 ? '📖' : idx === 2 ? '🗓️' : '🧪'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 text-xs truncate">{item.chapter_name || 'Practice Session'}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">{item.attempt_type || 'Practice Quiz'}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400 font-bold block">{formatDate(item.submitted_at)}</span>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-[10px]">
                            {item.percentage != null ? `${Math.round(item.percentage)}%` : '—'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                      No recent test attempts yet. Complete a quiz to see activity here!
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Full Span Card: Achievements */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  <div>
                    <h2 className="font-extrabold text-slate-900 text-base">Achievements</h2>
                    <p className="text-xs text-slate-500 font-medium">Keep learning to unlock more badges!</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/achievements')}
                  className="text-indigo-600 hover:underline text-xs font-extrabold inline-flex items-center gap-0.5 cursor-pointer"
                >
                  View All →
                </button>
              </div>

              {/* Achievements badges row - dynamic from API */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-1">
                {(achievements.length > 0
                  ? achievements.slice(0, 6)
                  : [
                      { title: 'First Quiz', status: overview?.quizzes_taken > 0 ? 'Completed' : 'Locked', icon: '🏆', achieved: overview?.quizzes_taken > 0 },
                      { title: '3 Day Streak', status: streakDays >= 3 ? 'Completed' : `${streakDays}/3`, icon: '🔥', achieved: streakDays >= 3 },
                      { title: '5 Quizzes', status: `${overview?.quizzes_taken || 0}/5`, icon: '🔒', achieved: overview?.quizzes_taken >= 5 },
                      { title: '7 Day Streak', status: `${streakDays}/7`, icon: '👑', achieved: streakDays >= 7 },
                      { title: 'Chapter Master', status: `${overview?.chapters_completed || 0}/${overview?.total_chapters || 5}`, icon: '📖', achieved: overview?.chapters_completed > 0 },
                      { title: 'Practice Pro', status: `${overview?.quizzes_taken || 0}/20`, icon: '⭐', achieved: overview?.quizzes_taken >= 20 },
                    ]
                ).map((badge, idx) => (
                  <div key={badge.id || idx} className="bg-slate-50/70 rounded-2xl p-3 border border-slate-100 flex flex-col items-center text-center space-y-1.5">
                    <div className={`w-10 h-10 rounded-2xl ${badge.achieved ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-lg shadow-2xs`}>
                      {badge.icon || '🏆'}
                    </div>
                    <p className="font-extrabold text-slate-900 text-xs truncate w-full">{badge.title || badge.name}</p>
                    <span className="text-[10px] font-bold text-slate-400">{badge.status || (badge.achieved ? 'Unlocked' : 'Locked')}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </main>
  );
};

export default ProgressOverview;
