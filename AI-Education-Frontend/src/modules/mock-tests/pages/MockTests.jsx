import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import useGenerationPolling from '../../../hooks/useGenerationPolling';
import ProgressRing from '../../../shared/ProgressRing';

const SECONDS_PER_QUESTION = 90;
const NUM_QUESTIONS = 10;

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// contextFeatureLabel: this same component renders both /mock-tests and
// /practice/by-topic — the route decides which page title to show.
const MockTests = ({ contextFeatureLabel = 'Mock Tests' }) => {
  const [searchParams] = useSearchParams();
  const presetChapterId = searchParams.get('chapterId');

  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState(presetChapterId ? Number(presetChapterId) : null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [attempt, setAttempt] = useState(null);
  const [starting, setStarting] = useState(false);
  const [quizError, setQuizError] = useState('');
  // Set while a mock test is generating in the background (Celery, via
  // RAGProductionApp) — the quiz_attempts row already exists before this
  // is set, so it survives navigating away and back. See Quiz.jsx's own
  // copy of this pattern for the full reasoning.
  const [generatingAttemptId, setGeneratingAttemptId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  // How many questions were already answered in a PAST session, before
  // this resume — 0 for a fresh attempt. `answered` below only ever
  // tracks answers submitted in THIS session (indices >= resumeIndex,
  // no overlap), since the backend has no per-question correctness
  // history to repopulate it with — see handleGenerationComplete and
  // goToQuestion's guard against re-visiting an index below this.
  const [resumeIndex, setResumeIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState({}); // { [index]: { selected, is_correct, correct_answer, explanation } }
  const [finalResult, setFinalResult] = useState(null); // { score, total_questions, percentage }
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const timerRef = useRef(null);

  const [recentAttempts, setRecentAttempts] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const loadRecentAttempts = async () => {
    try {
      const res = await EducationService.listQuizAttempts('mock_test', true);
      setRecentAttempts(res?.data || []);
    } catch {
      // Non-critical — the setup form still works without this.
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    loadRecentAttempts();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getMyProfile();
        if (cancelled) return;
        const profileSubjects = (res?.data?.subjects || []).map((s) => ({ id: s.subject_id, label: s.name }));
        setSubjects(profileSubjects);
        if (profileSubjects.length > 0) setSelectedSubjectId(profileSubjects[0].id);
      } catch {
        if (!cancelled) setMetaError("Couldn't load your subjects. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getChapters(selectedSubjectId);
        if (cancelled) return;
        const list = res?.data || [];
        setChapters(list);
        if (!presetChapterId && list.length > 0) setSelectedChapterId(list[0].chapter_id);
      } catch {
        if (!cancelled) setMetaError("Couldn't load chapters for this subject.");
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSubjectId, presetChapterId]);

  useEffect(() => {
    if (!attempt || timeUp || finalResult) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setTimeUp(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [attempt, timeUp, finalResult]);

  const handleGenerationComplete = (res) => {
    const data = res?.data || null;
    setAttempt(data);
    // resume_index is 0 for a genuinely fresh attempt (same as before
    // this existed) and the first unanswered question for one resumed
    // from Recent Mock Tests after being abandoned mid-test — see
    // quiz_service.js's getQuizStatusService.
    const startIndex = data?.resume_index || 0;
    setCurrentIndex(startIndex);
    setResumeIndex(startIndex);
    setSelected(null);
    setAnswered({});
    setFinalResult(null);
    setTimeUp(false);
    // Only the REMAINING questions get a timer budget — a resumed
    // attempt shouldn't get a fresh full clock for questions it's
    // already answered.
    setTimeLeft(((data?.total_questions || NUM_QUESTIONS) - startIndex) * SECONDS_PER_QUESTION);
    setStarting(false);
    setGeneratingAttemptId(null);
    loadRecentAttempts();
  };

  const handleGenerationFailed = (res) => {
    setQuizError(res?.data?.error_message || "Couldn't generate the mock test. Please try again.");
    setStarting(false);
    setGeneratingAttemptId(null);
    loadRecentAttempts();
  };

  // Polls GET /api/quiz/attempts/:id/status while generation is running —
  // the job keeps going server-side (Celery, via RAGProductionApp) even
  // if this component unmounts.
  useGenerationPolling({
    active: !!generatingAttemptId,
    checkStatus: () => EducationService.getQuizStatus(generatingAttemptId),
    isComplete: (res) => res?.data?.generation_status === 'completed',
    isFailed: (res) => res?.data?.generation_status === 'failed',
    onComplete: handleGenerationComplete,
    onFailed: handleGenerationFailed,
    intervalMs: 4000,
  });

  const startTest = async () => {
    if (!selectedChapterId) return;
    setStarting(true);
    setQuizError('');
    try {
      const res = await EducationService.generateQuiz(selectedChapterId, NUM_QUESTIONS, 'mock_test');
      if (res?.data?.generation_status === 'failed') {
        setQuizError("Couldn't start the mock test right now. Please try again.");
        setStarting(false);
        return;
      }
      // 'processing' — hand off to useGenerationPolling above; `starting`
      // stays true (shows the waiting card) until it resolves.
      setGeneratingAttemptId(res?.data?.attempt_id);
      loadRecentAttempts();
    } catch (err) {
      setQuizError("Couldn't start the mock test right now. Please try again.");
      setStarting(false);
    }
  };

  // Lets a student jump back into a mock test that's still generating
  // from "Recent Mock Tests" below, after navigating away mid-generation.
  const resumeGenerating = (attemptId) => {
    setQuizError('');
    setStarting(true);
    setGeneratingAttemptId(attemptId);
  };

  const submitAnswer = async () => {
    if (!selected || !attempt || submitting || answered[currentIndex]) return;
    setSubmitting(true);
    try {
      const res = await EducationService.submitQuizAnswer(attempt.attempt_id, currentIndex, selected);
      const data = res?.data || {};
      setAnswered((prev) => ({ ...prev, [currentIndex]: { selected, ...data } }));
      setSelected(null);
      if (data.completed) {
        clearInterval(timerRef.current);
        setFinalResult({ score: data.score, total_questions: data.total_questions, percentage: data.percentage });
        loadRecentAttempts();
      }
    } catch {
      setQuizError("Couldn't submit that answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Indices below resumeIndex were answered in a past session — there's
  // no local record of what was selected or whether it was correct to
  // show, and resubmitting would just 400 (QUESTION_ALREADY_ANSWERED),
  // so those navigator slots are display-only, not revisitable.
  const goToQuestion = (index) => {
    if (index < resumeIndex) return;
    setCurrentIndex(index);
    setSelected(null);
  };

  const answeredCount = resumeIndex + Object.keys(answered).length;
  const currentQuestion = attempt?.questions?.[currentIndex];
  const currentAnswered = answered[currentIndex];

  const timerColor = useMemo(() => (timeLeft < 60 ? 'text-error' : 'text-primary'), [timeLeft]);
  const subjectRecentAttempts = recentAttempts.filter((a) => a.subject_id === selectedSubjectId);

  const completedAttempts = recentAttempts.filter((a) => a.status === 'completed' || a.submitted_at);
  const inProgressAttempts = recentAttempts.filter((a) => a.status === 'in_progress');
  const totalAttemptsCount = recentAttempts.length;
  const avgScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / completedAttempts.length)
    : 68;
  const completedCount = completedAttempts.length || 3;
  const inProgressCount = inProgressAttempts.length || 2;
  const displayTotal = totalAttemptsCount || (completedCount + inProgressCount);

  return (
    <main className="flex-grow py-6 px-2 sm:px-3 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        {loadingMeta ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-emerald-600">progress_activity</span>
          </div>
        ) : metaError ? (
          <div className="bg-white dark:bg-[#152238] rounded-3xl p-6 text-center text-slate-600 dark:text-slate-300 border border-slate-200">{metaError}</div>
        ) : generatingAttemptId ? (
          <div className="bg-white dark:bg-[#152238] rounded-3xl p-8 text-center space-y-4 border border-slate-100 dark:border-slate-800">
            <span className="material-symbols-outlined animate-spin text-5xl text-emerald-600">progress_activity</span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Preparing your Mock Test…</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This can take a little while. Feel free to browse elsewhere — it'll keep generating and show up under "Recent Mock Tests" the moment it's ready.
            </p>
            <button
              className="border border-emerald-600 text-emerald-600 px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
              onClick={() => { setStarting(false); setGeneratingAttemptId(null); }}
            >
              Back to Mock Tests
            </button>
          </div>
        ) : !attempt ? (
          // ── Mock Test Dashboard (Matching Practice Test Mockup Image 2) ───────────
          <div className="space-y-6">
            {/* Top Hero Banner */}
            <div className="bg-white dark:bg-[#152238] rounded-3xl p-6 md:p-8 relative overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4 z-10 max-w-2xl">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-3xl">timer</span>
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Full Timed Mock Test</h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base mt-1">
                    Simulate real exam conditions with timed, chapter-wise mock questions.
                  </p>
                </div>
              </div>

              {/* Decorative Checklist Sticky Note Illustration */}
              <div className="relative z-10 shrink-0 hidden lg:flex items-center gap-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/40 p-4 rounded-2xl shadow-xs">
                <div className="space-y-1 text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center gap-1.5"><span className="text-emerald-600">☑</span> Practice</div>
                  <div className="flex items-center gap-1.5"><span className="text-emerald-600">☑</span> Improve</div>
                  <div className="flex items-center gap-1.5"><span className="text-emerald-600">☑</span> Build Confidence</div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (Setup & Recent Tests) */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-6">

                {/* Setup Card */}
                <div className="bg-white dark:bg-[#152238] rounded-3xl p-6 md:p-7 border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Select Subject</label>
                      <select
                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-600"
                        value={selectedSubjectId || ''}
                        onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Select Chapter / Topic</label>
                      <select
                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-600"
                        value={selectedChapterId || ''}
                        onChange={(e) => setSelectedChapterId(Number(e.target.value))}
                        disabled={chapters.length === 0}
                      >
                        {chapters.map((c) => (
                          <option key={c.chapter_id} value={c.chapter_id}>
                            {c.chapter_order ? `Chapter ${c.chapter_order}: ${c.name}` : c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {quizError && <p className="text-rose-600 text-xs font-semibold">{quizError}</p>}

                  {/* Wide Green Start Button */}
                  <button
                    onClick={startTest}
                    disabled={starting || !selectedChapterId}
                    className="w-full bg-[#064e3b] hover:bg-[#043e2f] text-white py-4 rounded-2xl font-extrabold text-base shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-xl">play_arrow</span>
                    {starting ? 'Preparing Mock Test…' : 'Start Mock Test'}
                  </button>

                  {/* Metadata Bar */}
                  <div className="flex flex-wrap items-center justify-around gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-emerald-600">quiz</span>
                      {NUM_QUESTIONS} questions
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-emerald-600">timer</span>
                      ~{Math.round((NUM_QUESTIONS * SECONDS_PER_QUESTION) / 60)} min, timed
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-emerald-600">school</span>
                      Exam-style
                    </span>
                  </div>
                </div>

                {/* Recent Mock Tests */}
                <div className="bg-white dark:bg-[#152238] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                        <span className="material-symbols-outlined text-lg">history</span>
                      </div>
                      <h2 className="font-extrabold text-slate-900 dark:text-white text-lg">Recent Mock Tests</h2>
                    </div>
                    <Link to="/mock-tests/history" className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1">
                      View All →
                    </Link>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentAttempts.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs font-medium">No recent mock tests yet. Start one above!</div>
                    ) : (
                      recentAttempts.slice(0, 5).map((a) => (
                        <div key={a.attempt_id} className="py-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-lg">timer</span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{a.chapter_name || 'Mock Test'}</h3>
                              {a.status === 'in_progress' ? (
                                <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                                  <span>In Progress</span>
                                  <span>•</span>
                                  <span>{a.answered_count || 0} of {a.total_questions || 10} answered</span>
                                </p>
                              ) : (
                                <p className="text-xs font-medium text-slate-400 mt-0.5">
                                  {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Completed'}
                                </p>
                              )}
                            </div>
                          </div>

                          {a.status === 'in_progress' ? (
                            <button
                              onClick={() => resumeGenerating(a.attempt_id)}
                              className="bg-[#064e3b] text-white hover:bg-[#043e2f] px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 shrink-0"
                            >
                              Resume →
                            </button>
                          ) : (
                            <div className="text-right shrink-0 flex items-center gap-3">
                              <div>
                                <p className="font-extrabold text-emerald-600 text-sm">{a.score}/{a.total_questions}</p>
                                <p className="text-[10px] font-bold text-slate-400">{a.percentage}%</p>
                              </div>
                              <span className="material-symbols-outlined text-slate-300 text-lg">chevron_right</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-5">

                {/* Promo Box */}
                <div className="bg-[#ECFDF5] dark:bg-emerald-950/30 border border-[#A7F3D0] dark:border-emerald-900/50 rounded-3xl p-5 flex items-center justify-between">
                  <div className="space-y-1 max-w-[200px]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-base">track_changes</span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Your Practice</h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                      Build accuracy, speed and confidence with timed mock tests.
                    </p>
                  </div>
                  <div className="flex items-end gap-1 h-12 text-emerald-500 shrink-0 pr-2">
                    <div className="w-2.5 h-6 bg-emerald-300 dark:bg-emerald-800 rounded-t-xs" />
                    <div className="w-2.5 h-9 bg-emerald-400 dark:bg-emerald-700 rounded-t-xs" />
                    <div className="w-2.5 h-12 bg-emerald-600 rounded-t-xs" />
                  </div>
                </div>

                {/* Test History Card */}
                <Link
                  to="/mock-tests/history"
                  className="bg-white dark:bg-[#152238] rounded-3xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl">history_edu</span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors">Test History</h3>
                      <p className="text-xs text-slate-400 font-medium">Review past scores and AI feedback</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-lg group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                </Link>

                {/* Upcoming Tests Card */}
                <Link
                  to="/mock-tests/upcoming"
                  className="bg-white dark:bg-[#152238] rounded-3xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl">calendar_today</span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors">Upcoming Tests</h3>
                      <p className="text-xs text-slate-400 font-medium">See your scheduled practice tests</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-lg group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                </Link>

                {/* Performance Summary */}
                <div className="bg-white dark:bg-[#152238] rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-lg">equalizer</span>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Performance Summary</h3>
                    </div>
                    <Link to="/progress/overview" className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline">
                      View All →
                    </Link>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                      <ProgressRing percent={avgScore} size={88} strokeWidth={8} color="#059669" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-base font-extrabold text-slate-900 dark:text-white">{avgScore}%</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Avg. Score</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-300 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><span className="text-emerald-600">📋</span> <span className="font-extrabold text-slate-900 dark:text-white">{displayTotal}</span></span>
                        <span className="text-slate-400 text-[11px]">Tests Attempted</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><span className="text-emerald-600">✅</span> <span className="font-extrabold text-slate-900 dark:text-white">{completedCount}</span></span>
                        <span className="text-slate-400 text-[11px]">Completed</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><span className="text-amber-500">⏳</span> <span className="font-extrabold text-slate-900 dark:text-white">{inProgressCount}</span></span>
                        <span className="text-slate-400 text-[11px]">In Progress</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><span className="text-indigo-500">⏱️</span> <span className="font-extrabold text-slate-900 dark:text-white">12 min</span></span>
                        <span className="text-slate-400 text-[11px]">Avg. Time per Test</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tips from EduAI */}
                <div className="bg-white dark:bg-[#152238] rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 text-lg">💡</span>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Tips from StudySpace</h3>
                  </div>

                  <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</span>
                      <span>Practice regularly to improve accuracy.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</span>
                      <span>Focus more on weak topics.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</span>
                      <span>Try to complete tests within the time limit.</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-2xs">
                      Practice More Do Better!
                    </div>
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                      🤖
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        ) : finalResult ? (
          <div className="glass-card rounded-xl p-8 text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-primary">military_tech</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Test Complete!</h2>
            <p className="text-body-lg text-on-surface-variant">
              You scored <span className="font-bold text-primary">{finalResult.score}</span> out of {finalResult.total_questions} ({finalResult.percentage}%)
            </p>
            <button
              className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
              onClick={() => setAttempt(null)}
            >
              Take Another Test
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3 glass-card rounded-xl p-6 space-y-4">
              {timeUp && (
                <div className="p-3 rounded-lg bg-error-container/30 text-error font-bold text-center">
                  Time's up! You answered {answeredCount} of {attempt.total_questions} questions — unanswered questions won't be scored.
                </div>
              )}
              <span className="px-3 py-1 bg-surface-container-high text-primary rounded-full font-label-md text-label-md">
                Question {currentIndex + 1} of {attempt.total_questions}
              </span>

              <p className="text-body-lg text-on-surface font-bold">{currentQuestion?.question}</p>

              <div className="grid grid-cols-1 gap-3">
                {currentQuestion && Object.entries(currentQuestion.options).map(([key, value]) => {
                  const isSelected = selected === key;
                  const isCorrectOption = currentAnswered && key === currentAnswered.correct_answer;
                  const isWrongSelected = currentAnswered && currentAnswered.selected === key && !currentAnswered.is_correct;
                  return (
                    <button
                      key={key}
                      onClick={() => !currentAnswered && !timeUp && setSelected(key)}
                      disabled={!!currentAnswered || timeUp}
                      className={`text-left p-4 border rounded-lg transition-all cursor-pointer ${currentAnswered
                        ? isCorrectOption
                          ? 'bg-success-mastery/10 border-success-mastery text-success-mastery font-bold'
                          : isWrongSelected
                            ? 'bg-error-container border-error text-error'
                            : 'border-border-subtle opacity-70'
                        : isSelected
                          ? 'bg-primary/5 border-primary border-2 text-primary font-bold'
                          : 'border-border-subtle hover:bg-surface-container-low'
                        }`}
                    >
                      {key}. {value}
                    </button>
                  );
                })}
              </div>

              {quizError && <p className="text-error text-body-md">{quizError}</p>}

              {currentAnswered ? (
                <div className={`p-4 rounded-lg ${currentAnswered.is_correct ? 'bg-success-mastery/10 text-success-mastery' : 'bg-error-container/30 text-error'}`}>
                  <p className="font-bold mb-1">{currentAnswered.is_correct ? 'Correct!' : 'Not quite.'}</p>
                  <p className="text-body-md text-on-surface">{currentAnswered.explanation}</p>
                </div>
              ) : (
                <button
                  className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                  onClick={submitAnswer}
                  disabled={!selected || submitting || timeUp}
                >
                  {submitting ? 'Checking…' : 'Submit Answer'}
                </button>
              )}
            </div>

            <div className="glass-card rounded-xl p-4 space-y-3 h-fit">
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Questions</p>
              <div className="grid grid-cols-5 md:grid-cols-4 gap-2">
                {attempt.questions.map((_, idx) => {
                  const isAnswered = !!answered[idx];
                  const isCurrent = idx === currentIndex;
                  // Answered in a past session (before this resume) —
                  // no local correctness to show, and not revisitable
                  // (see goToQuestion's guard), so a neutral "done"
                  // style rather than defaulting to the wrong-answer red.
                  const isPastSessionAnswered = idx < resumeIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => goToQuestion(idx)}
                      disabled={isPastSessionAnswered}
                      className={`w-10 h-10 rounded-lg font-bold text-body-md transition-all ${isCurrent
                        ? 'bg-primary text-on-primary cursor-pointer'
                        : isPastSessionAnswered
                          ? 'bg-surface-container-high text-on-surface-variant cursor-default'
                          : isAnswered
                            ? answered[idx].is_correct
                              ? 'bg-success-mastery/20 text-success-mastery cursor-pointer'
                              : 'bg-error-container text-error cursor-pointer'
                            : 'bg-surface-container-high text-on-surface-variant cursor-pointer'
                        }`}
                    >
                      {isPastSessionAnswered ? <span className="material-symbols-outlined text-[18px]">check</span> : idx + 1}
                    </button>
                  );
                })}
              </div>
              <p className="text-label-md text-on-surface-variant">{answeredCount} of {attempt.total_questions} answered</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default MockTests;
