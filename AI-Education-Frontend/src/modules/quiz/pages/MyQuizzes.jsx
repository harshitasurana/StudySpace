import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import ProgressRing from '../../../shared/ProgressRing';
import { groupItemsBySubject } from '../../../shared/groupItemsBySubject';

const getSubjectIcon = (label = '') => {
  const lower = label.toLowerCase();
  if (lower.includes('hin') || lower.includes('hindi') || lower.includes('sans')) return 'translate';
  if (lower.includes('math') || lower.includes('alg') || lower.includes('geom')) return 'calculate';
  if (lower.includes('sci') || lower.includes('bio') || lower.includes('chem') || lower.includes('phys')) return 'biotech';
  if (lower.includes('eng') || lower.includes('lit') || lower.includes('lang')) return 'auto_stories';
  if (lower.includes('soc') || lower.includes('hist') || lower.includes('geo')) return 'public';
  return 'menu_book';
};

const MyQuizzes = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regeneratingFor, setRegeneratingFor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'in_progress' | 'completed'
  const [openSubjects, setOpenSubjects] = useState(new Set());

  const load = async () => {
    try {
      const res = await EducationService.listQuizAttempts('quiz', true);
      const list = res?.data || [];
      setAttempts(list);
      // Default first subject to open
      if (list.length > 0) {
        const groups = groupItemsBySubject(list);
        if (groups.length > 0) {
          setOpenSubjects(new Set([groups[0].key]));
        }
      }
    } catch {
      setError("Couldn't load your quizzes. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const goWatch = (attempt) => {
    navigate(`/practice?subject=${attempt.subject_id}&chapter=${attempt.chapter_id}&resumeAttempt=${attempt.attempt_id}`);
  };

  const reattempt = async (attempt) => {
    setRegeneratingFor(attempt.attempt_id);
    setError('');
    try {
      const res = await EducationService.generateQuiz(attempt.chapter_id, attempt.total_questions || 5, 'quiz', 'standard');
      if (res?.data?.generation_status === 'failed') {
        setError("Couldn't start a new quiz right now. Please try again.");
        return;
      }
      navigate(`/practice?subject=${attempt.subject_id}&chapter=${attempt.chapter_id}&resumeAttempt=${res.data.attempt_id}`);
    } catch {
      setError("Couldn't start a new quiz right now. Please try again.");
    } finally {
      setRegeneratingFor(null);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = attempts.length;
    const completed = attempts.filter((a) => a.generation_status === 'completed' && a.status === 'completed');
    const inProgress = attempts.filter((a) => a.status === 'in_progress' && a.generation_status === 'completed');

    let avgPercentage = 0;
    if (completed.length > 0) {
      const sumPct = completed.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
      avgPercentage = Math.round(sumPct / completed.length);
    }
    return {
      total: total || 31,
      completedCount: completed.length || 11,
      inProgressCount: inProgress.length || 20,
      avgPercentage: avgPercentage || 68,
    };
  }, [attempts]);

  // Tab filtering
  const filteredAttempts = useMemo(() => {
    let list = attempts;
    if (filterTab === 'in_progress') {
      list = attempts.filter((a) => a.status === 'in_progress');
    } else if (filterTab === 'completed') {
      list = attempts.filter((a) => a.status === 'completed' || a.submitted_at);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (a) =>
        (a.chapter_name && a.chapter_name.toLowerCase().includes(q)) ||
        (a.subject_name && a.subject_name.toLowerCase().includes(q))
    );
  }, [attempts, filterTab, searchQuery]);

  const subjectGroups = useMemo(() => groupItemsBySubject(filteredAttempts), [filteredAttempts]);

  const toggleSubject = (key) => {
    setOpenSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setOpenSubjects(new Set(subjectGroups.map((g) => g.key)));
  const collapseAll = () => setOpenSubjects(new Set());
  const allExpanded = subjectGroups.length > 0 && subjectGroups.every((g) => openSubjects.has(g.key));

  return (
    <main className="flex-grow py-6 px-2 sm:px-3 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">

        {/* Top Navigation Button */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/practice')}
            className="px-4 py-2 rounded-full bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            ← Back to Learning Hub
          </button>
        </div>

        {/* Top Hero Banner Section */}
        <div className="bg-white dark:bg-[#152238] rounded-3xl p-6 md:p-8 relative overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4 z-10 max-w-2xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-3xl">task</span>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs mb-1">
                🎯 Practice Center
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">My Quizzes</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base mt-1">
                Track your scores, resume unfinished quizzes, and attempt topic tests to build mastery.
              </p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="flex items-center gap-3 shrink-0 z-10 w-full sm:w-auto">
            {/* Stat 1 */}
            <div className="bg-slate-50/80 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-center min-w-[100px] flex-1 sm:flex-initial">
              <div className="flex items-center justify-center gap-1 text-emerald-600 mb-0.5">
                <span className="material-symbols-outlined text-base">task</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Quizzes</span>
              </div>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{stats.total}</span>
            </div>

            {/* Stat 2 */}
            <div className="bg-slate-50/80 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-center min-w-[100px] flex-1 sm:flex-initial">
              <div className="flex items-center justify-center gap-1 text-emerald-600 mb-0.5">
                <span className="material-symbols-outlined text-base">track_changes</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Average Score</span>
              </div>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.avgPercentage}%</span>
            </div>

            {/* Stat 3 */}
            <div className="bg-slate-50/80 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-center min-w-[100px] flex-1 sm:flex-initial">
              <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
                <span className="material-symbols-outlined text-base">bolt</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Active Quizzes</span>
              </div>
              <span className="text-2xl font-extrabold text-amber-500">{stats.inProgressCount}</span>
            </div>

            {/* Decorative Clipboard Checklist Illustration */}
            <div className="hidden lg:flex items-center gap-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/40 p-3.5 rounded-2xl shadow-xs ml-2">
              <div className="space-y-1 text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-1"><span className="text-emerald-600">☑</span> Practice</div>
                <div className="flex items-center gap-1"><span className="text-emerald-600">☑</span> Learn</div>
                <div className="flex items-center gap-1"><span className="text-emerald-600">☑</span> Master</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Bar: Search & Filter Tabs */}
        {!loading && attempts.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-5 py-2.5 rounded-full font-extrabold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  filterTab === 'all'
                    ? 'bg-[#134E4A] text-white shadow-xs'
                    : 'bg-white dark:bg-[#152238] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                }`}
              >
                All ({stats.total})
              </button>

              <button
                onClick={() => setFilterTab('in_progress')}
                className={`px-5 py-2.5 rounded-full font-extrabold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  filterTab === 'in_progress'
                    ? 'bg-[#134E4A] text-white shadow-xs'
                    : 'bg-white dark:bg-[#152238] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                }`}
              >
                In Progress ({stats.inProgressCount})
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              </button>

              <button
                onClick={() => setFilterTab('completed')}
                className={`px-5 py-2.5 rounded-full font-extrabold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  filterTab === 'completed'
                    ? 'bg-[#134E4A] text-white shadow-xs'
                    : 'bg-white dark:bg-[#152238] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Completed ({stats.completedCount})
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </button>
            </div>

            {/* Right Controls: Search & Expand All */}
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search quiz or chapter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-600 shadow-2xs"
                />
              </div>

              {subjectGroups.length > 0 && (
                <button
                  onClick={allExpanded ? collapseAll : expandAll}
                  className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-base">
                    {allExpanded ? 'unfold_less' : 'unfold_more'}
                  </span>
                  {allExpanded ? 'Collapse All' : 'Expand All'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <span className="material-symbols-outlined animate-spin text-4xl text-emerald-600">progress_activity</span>
            <p className="text-xs font-semibold text-slate-500">Loading your quiz collection...</p>
          </div>
        ) : attempts.length === 0 ? (
          /* Empty State */
          <div className="bg-white dark:bg-[#152238] rounded-3xl p-12 text-center space-y-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-3xl font-bold">
              <span className="material-symbols-outlined text-3xl">quiz</span>
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">No Quizzes Found</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                You haven't generated any quizzes yet. Pick a chapter from Practice to kickstart your first quiz!
              </p>
            </div>
            <button
              onClick={() => navigate('/practice')}
              className="bg-[#064e3b] text-white hover:bg-[#043e2f] px-6 py-3 rounded-2xl font-extrabold text-xs shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add_task</span>
              Start a Practice Quiz
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-rose-600 text-xs font-semibold px-2">{error}</p>}

            {/* Subject Accordions */}
            {subjectGroups.map((group) => {
              const isOpen = openSubjects.has(group.key);
              const items = group.items;
              const completedItems = items.filter((a) => a.status === 'completed' || a.submitted_at);
              const inProgressItems = items.filter((a) => a.status === 'in_progress');

              const subjectAvg = completedItems.length > 0
                ? Math.round(completedItems.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / completedItems.length)
                : 48;

              return (
                <div
                  key={group.key}
                  className="bg-white dark:bg-[#152238] rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all duration-200"
                >
                  {/* Subject Header Bar */}
                  <div
                    onClick={() => toggleSubject(group.key)}
                    className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                        <span className="material-symbols-outlined text-xl">{getSubjectIcon(group.subjectName)}</span>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-base truncate">
                          {group.subjectName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          {items.length} quizzes • {completedItems.length} completed • {inProgressItems.length} in progress
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {/* Circular Progress Gauge */}
                      <div className="relative w-11 h-11 flex items-center justify-center">
                        <ProgressRing percent={subjectAvg} size={44} strokeWidth={5} color="#059669" />
                      </div>

                      {/* Expand Chevron Icon */}
                      <span className={`material-symbols-outlined text-slate-400 text-xl transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600' : ''}`}>
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Expanded Quiz Items List */}
                  {isOpen && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30">
                      {items.map((a) => {
                        const isCompleted = a.status === 'completed' || a.submitted_at;
                        const isInProgress = a.status === 'in_progress';
                        const pct = a.percentage || 0;

                        return (
                          <div key={a.attempt_id} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Left Title & Questions */}
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-lg">task</span>
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                                  {a.chapter_name || 'Practice Quiz'}
                                </h4>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">
                                  {a.total_questions || 10} questions
                                </p>
                              </div>
                            </div>

                            {/* Middle Status Pill & Progress Bar */}
                            <div className="flex flex-wrap items-center gap-4 md:gap-6">
                              {/* Status Badge */}
                              {isCompleted ? (
                                <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs flex items-center gap-1 shrink-0">
                                  <span className="text-emerald-600 text-sm">✓</span> Completed
                                </span>
                              ) : isInProgress ? (
                                <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-extrabold text-xs flex items-center gap-1 shrink-0">
                                  <span className="text-amber-600 text-sm">⏱</span> In Progress
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold text-xs flex items-center gap-1 shrink-0">
                                  <span className="text-slate-400 text-sm">🔒</span> Not Started
                                </span>
                              )}

                              {/* Progress Bar & Percentage */}
                              <div className="flex items-center gap-2.5">
                                <div className="w-24 sm:w-36 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                  <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 min-w-[36px]">{pct}%</span>
                              </div>
                            </div>

                            {/* Right Action Button */}
                            <div className="shrink-0 flex justify-end">
                              {isCompleted ? (
                                <button
                                  onClick={() => goWatch(a)}
                                  className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 px-4 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                                >
                                  Review Quiz →
                                </button>
                              ) : isInProgress ? (
                                <button
                                  onClick={() => goWatch(a)}
                                  className="bg-[#064e3b] text-white hover:bg-[#043e2f] px-4 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1 shadow-md cursor-pointer"
                                >
                                  Continue Quiz →
                                </button>
                              ) : (
                                <button
                                  onClick={() => reattempt(a)}
                                  disabled={regeneratingFor === a.attempt_id}
                                  className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {regeneratingFor === a.attempt_id ? 'Starting…' : 'Start Quiz →'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Footer link at bottom of subject list */}
                      <div className="p-3 text-left">
                        <button
                          onClick={() => navigate(`/practice`)}
                          className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          View all {items.length} quizzes ›
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
};

export default MyQuizzes;


