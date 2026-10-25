import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import ProgressRing from '../../../shared/ProgressRing';
import useGenerationPolling from '../../../hooks/useGenerationPolling';
import { useXpReward } from '../../../context/XpRewardContext';
import { saveStudySession } from '../../../utils/studySession';

const MODES = [
  { id: 'standard', label: 'Practice', icon: 'edit_note', numQuestions: 5 },
  // 'timed' is a client-side-only distinction (a countdown timer over the
  // same standard questions) - quiz_validation.js's mode enum has no
  // separate value for it, so it needs backendMode:'standard' or POST
  // /api/quiz/generate 400s on an unrecognized mode.
  { id: 'timed', label: 'Timed Practice', icon: 'timer', numQuestions: 5, secondsPerQuestion: 60, backendMode: 'standard' },
  { id: 'formula', label: 'Formula Quiz', icon: 'functions', numQuestions: 5, backendMode: 'formula' },
  { id: 'concept', label: 'Concept Quiz', icon: 'psychology', numQuestions: 5, backendMode: 'concept' },
  { id: 'visual', label: 'Visual Quiz', icon: 'visibility', comingSoon: true },
  // Genuinely harder questions (see quiz_service.js's MODE_FOCUS), not
  // just Timed Practice with a shorter clock and more questions.
  { id: 'challenge', label: 'Challenge Mode', icon: 'bolt', numQuestions: 10, secondsPerQuestion: 30, backendMode: 'challenge' },
];

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const HELPER_LABELS = { hint: 'Hint', learn: 'Concept Explanation', discuss: 'AI Discussion' };

const getSubjectIcon = (label = '') => {
  const lower = label.toLowerCase();
  if (lower.includes('hin') || lower.includes('hindi') || lower.includes('sans')) return 'translate';
  if (lower.includes('math') || lower.includes('alg') || lower.includes('geom')) return 'calculate';
  if (lower.includes('sci') || lower.includes('bio') || lower.includes('chem') || lower.includes('phys')) return 'biotech';
  if (lower.includes('eng') || lower.includes('lit') || lower.includes('lang')) return 'auto_stories';
  if (lower.includes('soc') || lower.includes('hist') || lower.includes('geo')) return 'public';
  return 'menu_book';
};

const getSubjectImage = (label = '') => {
  const lower = label.toLowerCase();
  if (lower.includes('hin') || lower.includes('hindi') || lower.includes('sans')) return '/images/subjects/hindi.jpg';
  if (lower.includes('math') || lower.includes('alg') || lower.includes('geom')) return '/images/subjects/math.jpg';
  if (lower.includes('sci') || lower.includes('bio') || lower.includes('chem') || lower.includes('phys')) return '/images/subjects/science.jpg';
  if (lower.includes('eng') || lower.includes('lit') || lower.includes('lang')) return '/images/subjects/english.jpg';
  if (lower.includes('soc') || lower.includes('hist') || lower.includes('geo')) return '/images/subjects/social.jpg';
  return '/images/subjects/math.jpg';
};

// contextFeatureLabel: this same component renders both /practice and
// /practice/by-subject — the route decides which page title to show.
const Quiz = ({ contextFeatureLabel = 'Practice' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkChapterId = useRef(Number(searchParams.get('chapter')) || null);
  // Set once from the URL (e.g. MyQuizzes.jsx's "Generating…"/"Reattempt"
  // links, `?resumeAttempt=123`) — consumed once by the effect below,
  // then cleared so it never re-fires on an unrelated re-render.
  const resumeAttemptIdParam = useRef(Number(searchParams.get('resumeAttempt')) || null);

  const [subjects, setSubjects] = useState([]);
  const [subjectProgress, setSubjectProgress] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [selectedSubjectId, setSelectedSubjectId] = useState(Number(searchParams.get('subject')) || null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [selectedMode, setSelectedMode] = useState('standard');
  const [activeMode, setActiveMode] = useState(MODES[0]);

  const [attempt, setAttempt] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [generating, setGenerating] = useState(false);
  // Set while a quiz is generating in the background (Celery, via
  // RAGProductionApp) — survives navigating away and back, since the
  // quiz_attempts row already exists before this is even set. Distinct
  // from `generating`, which is just this component's own "show a
  // spinner" flag; `generatingAttemptId` is what useGenerationPolling
  // below actually watches.
  const [generatingAttemptId, setGeneratingAttemptId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set());
  const [bookmarking, setBookmarking] = useState(false);

  const [timeLeft, setTimeLeft] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const timerRef = useRef(null);

  const [helper, setHelper] = useState(null); // { type, loading, text, error }

  const [recentAttempts, setRecentAttempts] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const loadRecentAttempts = async () => {
    try {
      const res = await EducationService.listQuizAttempts('quiz', true);
      setRecentAttempts(res?.data || []);
    } catch {
      // Non-critical.
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
        const [profileRes, progressRes] = await Promise.all([
          EducationService.getMyProfile(),
          EducationService.getSubjectProgress(),
        ]);
        if (cancelled) return;
        const profileSubjects = (profileRes?.data?.subjects || []).map((s) => ({ id: s.subject_id, label: s.name }));
        setSubjects(profileSubjects);
        setSubjectProgress(progressRes?.data?.subjects || []);
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
        const deepLinked = deepLinkChapterId.current && list.some((c) => c.chapter_id === deepLinkChapterId.current);
        setSelectedChapterId(deepLinked ? deepLinkChapterId.current : list.length > 0 ? list[0].chapter_id : null);
        deepLinkChapterId.current = null;
      } catch {
        if (!cancelled) setMetaError("Couldn't load chapters for this subject.");
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSubjectId]);

  useEffect(() => {
    if (!attempt || !activeMode.secondsPerQuestion || timeUp || feedback?.completed) return;
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
  }, [attempt, activeMode, timeUp, feedback]);

  // Fires once useGenerationPolling sees generation_status flip to
  // 'completed' — for a fresh start this is modeObj from state; for a
  // resumed generation (see resumeGenerating) activeMode was already set
  // to a best-effort fallback since the original mode isn't stored.
  const handleGenerationComplete = (res) => {
    const att = res?.data;
    setAttempt(att);
    // resume_index is 0 for a genuinely fresh attempt (same as before
    // this existed) and the first unanswered question for one resumed
    // from Recent Attempts/My Quizzes after being abandoned mid-quiz —
    // see quiz_service.js's getQuizStatusService.
    const startIndex = att?.resume_index || 0;
    setCurrentIndex(startIndex);
    if (activeMode.secondsPerQuestion) {
      // Only the REMAINING questions get a timer budget — a resumed
      // attempt shouldn't get a fresh full clock for questions it's
      // already answered.
      const remainingQuestions = (att?.total_questions || activeMode.numQuestions) - startIndex;
      setTimeLeft(remainingQuestions * activeMode.secondsPerQuestion);
    }
    setGenerating(false);
    setGeneratingAttemptId(null);
    loadRecentAttempts();
  };

  const handleGenerationFailed = (res) => {
    setQuizError(res?.data?.error_message || 'Failed to generate quiz. Please try again.');
    setGenerating(false);
    setGeneratingAttemptId(null);
    loadRecentAttempts();
  };

  // Polls GET /api/quiz/attempts/:id/status while a generation job is
  // running — the job itself keeps going server-side (Celery, via
  // RAGProductionApp) even if this component unmounts; navigating back
  // here (or to a still-processing row in Recent Attempts, see
  // resumeGenerating) just resumes watching it, nothing is lost.
  useGenerationPolling({
    active: !!generatingAttemptId,
    checkStatus: () => EducationService.getQuizStatus(generatingAttemptId),
    isComplete: (res) => res?.data?.generation_status === 'completed',
    isFailed: (res) => res?.data?.generation_status === 'failed',
    onComplete: handleGenerationComplete,
    onFailed: handleGenerationFailed,
    intervalMs: 4000,
  });

  const startQuiz = async () => {
    if (!selectedChapterId) return;
    const modeObj = MODES.find((m) => m.id === selectedMode) || MODES[0];
    setGenerating(true);
    setQuizError('');
    setSelected(null);
    setFeedback(null);
    setTimeUp(false);
    setHelper(null);
    setBookmarkedQuestions(new Set());
    setActiveMode(modeObj);
    try {
      const res = await EducationService.generateQuiz(
        selectedChapterId,
        modeObj.numQuestions || 5,
        'quiz',
        modeObj.backendMode || modeObj.id
      );
      if (res?.data?.generation_status === 'failed') {
        setQuizError('Failed to start quiz. Please try again.');
        setGenerating(false);
        return;
      }
      // 'processing' — the attempt already exists server-side; hand off
      // to useGenerationPolling above rather than waiting here. `generating`
      // stays true (shows the waiting card below) until it resolves.
      setGeneratingAttemptId(res?.data?.attempt_id);
      loadRecentAttempts();
    } catch (err) {
      setQuizError(err?.response?.data?.message || 'Failed to start quiz. Please try again.');
      setGenerating(false);
    }
  };

  // Lets a student jump back into a quiz that's still generating (or
  // just finished) from the "Recent Attempts" list below, after having
  // navigated away mid-generation. The original mode isn't stored on the
  // attempt, so activeMode falls back to Practice's defaults — only
  // relevant for a timed mode's countdown length, which resumes correctly
  // once the questions arrive since total_questions comes from the real
  // response either way.
  const resumeGenerating = (attemptId) => {
    setQuizError('');
    setActiveMode(MODES[0]);
    setGenerating(true);
    setGeneratingAttemptId(attemptId);
  };

  // Consumes ?resumeAttempt=<id> once on mount (see MyQuizzes.jsx's
  // "Generating…"/"Reattempt" links, which deep-link here with
  // ?subject=&chapter=&resumeAttempt= all set) — the ref is cleared
  // immediately after so this never re-fires from an unrelated re-render
  // or a later in-page navigation back to the hub.
  useEffect(() => {
    if (!resumeAttemptIdParam.current) return;
    resumeGenerating(resumeAttemptIdParam.current);
    resumeAttemptIdParam.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { awardXp } = useXpReward();

  const submitAnswer = async () => {
    if (selected === null || !attempt || submitting) return;
    setSubmitting(true);
    setQuizError('');
    try {
      const res = await EducationService.submitQuizAnswer(attempt.attempt_id, currentIndex, selected);
      const fb = res?.data;
      setFeedback(fb);
      if (fb?.completed) {
        loadRecentAttempts();
        const earnedAmount = (fb.percentage || 0) >= 80 ? 100 : 50;
        awardXp(earnedAmount, `Quiz Completed (${fb.score || 0}/${fb.total_questions || 5})! 🎯`, { streakShield: true });
      } else {
        saveStudySession({
          title: attempt.title || 'Practice Quiz',
          subtitle: `Question ${currentIndex + 1} of ${attempt.questions?.length || 5}`,
          path: `/practice?attempt_id=${attempt.attempt_id}`,
          progress: Math.round(((currentIndex + 1) / (attempt.questions?.length || 5)) * 100),
          type: 'quiz',
        });
      }
    } catch (err) {
      setQuizError(err?.response?.data?.message || 'Failed to submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = () => {
    setSelected(null);
    setFeedback(null);
    setQuizError('');
    setHelper(null);
    setCurrentIndex((i) => i + 1);
  };

  const resetQuiz = () => {
    setAttempt(null);
    setCurrentIndex(0);
    setSelected(null);
    setFeedback(null);
    setQuizError('');
    setHelper(null);
    clearInterval(timerRef.current);
  };

  const backToHub = () => {
    resetQuiz();
  };

  // Stops watching a generation from THIS tab only — the job itself
  // keeps running server-side regardless (that's the whole point), and
  // the attempt reappears in Recent Attempts as "Generating…" until it
  // resolves, clickable via resumeGenerating.
  const stopWatchingGeneration = () => {
    setGenerating(false);
    setGeneratingAttemptId(null);
  };

  const backToSubjects = () => {
    resetQuiz();
    setSelectedSubjectId(null);
  };

  const currentQuestion = attempt?.questions?.[currentIndex];
  const isLastQuestion = attempt && currentIndex === attempt.total_questions - 1;
  const timerColor = timeLeft < 60 ? 'text-error' : 'text-primary';

  const handleBookmarkQuestion = async () => {
    if (!selectedChapterId || !currentQuestion || bookmarkedQuestions.has(currentIndex) || bookmarking) return;
    setBookmarking(true);
    try {
      const optionsText = Object.entries(currentQuestion.options).map(([key, value]) => `${key}. ${value}`).join('\n');
      await EducationService.createBookmark({
        chapterId: selectedChapterId,
        sourceType: 'quiz_question',
        title: currentQuestion.question.slice(0, 100),
        content: `${currentQuestion.question}\n\n${optionsText}`,
      });
      setBookmarkedQuestions((prev) => new Set(prev).add(currentIndex));
    } catch {
      // Non-critical.
    } finally {
      setBookmarking(false);
    }
  };

  const askHelper = async (type) => {
    if (!currentQuestion || !selectedChapterId) return;
    setHelper({ type, loading: true, text: '', error: '' });
    const prompts = {
      hint: `Give me a hint for this question without revealing the answer: "${currentQuestion.question}"`,
      learn: `Before I answer, can you explain the concept behind this question? "${currentQuestion.question}"`,
      discuss: `Let's discuss this question further. Question: "${currentQuestion.question}"${feedback ? ` The correct answer was ${feedback.correct_answer}.` : ''}`,
    };
    try {
      const res = await EducationService.chatWithTutor(selectedChapterId, prompts[type]);
      setHelper({ type, loading: false, text: res?.data?.answer || '', error: '' });
    } catch {
      setHelper({ type, loading: false, text: '', error: "Couldn't get a response right now." });
    }
  };

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedSubjectProgress = subjectProgress.find((s) => s.subject_id === selectedSubjectId);
  const weakAreas = (selectedSubjectProgress?.chapters || [])
    .filter((c) => c.status !== 'completed')
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3);
  const aiRecommendation = weakAreas[0] || null;
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

  const [activeSubjectTab, setActiveSubjectTab] = useState('all');
  const displaySubjects = activeSubjectTab === 'all'
    ? subjects
    : subjects.filter((s) => s.label.toLowerCase().includes(activeSubjectTab.toLowerCase()));

  return (
    <main className="flex-grow py-6 px-2 sm:px-3 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        {loadingMeta ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-emerald-600">progress_activity</span>
          </div>
        ) : metaError ? (
          <div className="bg-white dark:bg-[#152238] rounded-3xl p-6 text-center text-slate-600 dark:text-slate-300 border border-slate-200">{metaError}</div>
        ) : !selectedSubjectId ? (
          // ── STEP 1: Practice & Improve (Subject Selection View) ──────────────────
          <div className="space-y-6">
            {/* Top Hero Banner */}
            <div className="bg-white dark:bg-[#152238] rounded-3xl p-6 md:p-8 relative overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4 z-10 max-w-2xl">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-3xl">track_changes</span>
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Practice & Improve</h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base mt-1">
                    Choose a subject to see your personalized practice, recommendations, and modes.
                  </p>
                </div>
              </div>

              {/* Decorative Sticky Note Illustration */}
              <div className="relative z-10 shrink-0 hidden lg:flex items-center gap-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 p-3.5 rounded-2xl shadow-xs rotate-1">
                <div className="text-left font-serif text-amber-900 dark:text-amber-200 text-xs font-semibold leading-relaxed">
                  Practice<br />
                  Learn<br />
                  Improve<br />
                  Grow<br />
                  Everyday! 🌱
                </div>
              </div>
            </div>

            {/* Subject Tabs Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setActiveSubjectTab('all')}
                className={`px-4 py-2 rounded-full font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeSubjectTab === 'all'
                    ? 'bg-[#134E4A] text-white shadow-xs'
                    : 'bg-white dark:bg-[#152238] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-base">grid_view</span>
                All Subjects
              </button>
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSubjectTab(s.label)}
                  className={`px-4 py-2 rounded-full font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeSubjectTab === s.label
                      ? 'bg-[#134E4A] text-white shadow-xs'
                      : 'bg-white dark:bg-[#152238] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Grid of Subject Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displaySubjects.map((s, idx) => {
                const prog = subjectProgress.find((sp) => sp.subject_id === s.id);
                const masteryPercent = Math.round(prog?.mastery || 0);
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSubjectId(s.id)}
                    className="bg-white dark:bg-[#152238] rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group flex flex-col justify-between"
                  >
                    {/* Cover Banner */}
                    <div className="relative w-full h-36 overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <img
                        src={getSubjectImage(s.label)}
                        alt={s.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
                      <div className="absolute top-3 right-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full px-2.5 py-1 text-xs font-extrabold text-slate-800 dark:text-slate-100 shadow-md">
                        {masteryPercent}%
                      </div>
                    </div>

                    {/* Bottom Info Section */}
                    <div className="p-5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 font-extrabold text-lg">
                          <span className="material-symbols-outlined text-xl">{getSubjectIcon(s.label)}</span>
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 dark:text-white text-base group-hover:text-emerald-700 transition-colors">
                            {s.label}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {prog ? `${prog.chapters_completed || 0} of ${prog.total_chapters || 0} chapters mastered` : '0 chapters mastered'}
                          </p>
                          <div className="w-24 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                            <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${masteryPercent}%` }} />
                          </div>
                        </div>
                      </div>

                      <button className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white px-3.5 py-2 rounded-full font-extrabold text-xs transition-all flex items-center gap-1 shrink-0 border border-emerald-100 dark:border-emerald-900/40">
                        Start Practice →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : generatingAttemptId ? (
          // ── Generating Screen ───────────────────────────────────────────────
          <div className="bg-white dark:bg-[#152238] rounded-3xl p-8 text-center space-y-4 border border-slate-100 dark:border-slate-800">
            <span className="material-symbols-outlined animate-spin text-5xl text-emerald-600">progress_activity</span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Generating your {activeMode.label}…</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This can take a little while. Feel free to browse elsewhere — it'll keep generating and show up under "Recent Practice Tests" the moment it's ready.
            </p>
            <button
              className="border border-emerald-600 text-emerald-600 px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
              onClick={stopWatchingGeneration}
            >
              Back to Practice Hub
            </button>
          </div>
        ) : !attempt ? (
          // ── STEP 2: Practice Test Dashboard (Matching Mockup Image 2) ───────────
          <div className="space-y-6">
            {/* Top Hero Banner */}
            <div className="bg-white dark:bg-[#152238] rounded-3xl p-6 md:p-8 relative overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4 z-10 max-w-2xl">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-3xl">task</span>
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Practice Test</h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base mt-1">
                    Test your understanding with timed, exam-style questions.
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

            {/* Main Content Grid: Left Column (Test Setup & Recent Tests) vs Right Column (Stats & Tips) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-6">

                {/* 1. Test Setup Card */}
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
                    onClick={startQuiz}
                    disabled={generating || !selectedChapterId}
                    className="w-full bg-[#064e3b] hover:bg-[#043e2f] text-white py-4 rounded-2xl font-extrabold text-base shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-xl">play_arrow</span>
                    {generating ? 'Generating Practice Test…' : 'Start Practice Test'}
                  </button>

                  {/* Metadata Icons Bar */}
                  <div className="flex flex-wrap items-center justify-around gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-emerald-600">quiz</span>
                      10 questions
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-emerald-600">timer</span>
                      ~15 min, timed
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-emerald-600">school</span>
                      Exam-style
                    </span>
                  </div>
                </div>

                {/* 2. Recent Practice Tests Card */}
                <div className="bg-white dark:bg-[#152238] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                        <span className="material-symbols-outlined text-lg">history</span>
                      </div>
                      <h2 className="font-extrabold text-slate-900 dark:text-white text-lg">Recent Practice Tests</h2>
                    </div>
                    <button
                      onClick={() => navigate('/practice/my-quizzes')}
                      className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentAttempts.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs font-medium">No recent practice tests yet. Start one above!</div>
                    ) : (
                      recentAttempts.slice(0, 5).map((a) => (
                        <div key={a.attempt_id} className="py-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-lg">auto_stories</span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{a.chapter_name || 'Practice Quiz'}</h3>
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

                {/* 1. "Your Practice" Promo Box */}
                <div className="bg-[#ECFDF5] dark:bg-emerald-950/30 border border-[#A7F3D0] dark:border-emerald-900/50 rounded-3xl p-5 flex items-center justify-between">
                  <div className="space-y-1 max-w-[200px]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-base">track_changes</span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Your Practice</h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                      Build accuracy, speed and confidence with chapter-wise tests.
                    </p>
                  </div>
                  <div className="flex items-end gap-1 h-12 text-emerald-500 shrink-0 pr-2">
                    <div className="w-2.5 h-6 bg-emerald-300 dark:bg-emerald-800 rounded-t-xs" />
                    <div className="w-2.5 h-9 bg-emerald-400 dark:bg-emerald-700 rounded-t-xs" />
                    <div className="w-2.5 h-12 bg-emerald-600 rounded-t-xs" />
                  </div>
                </div>

                {/* 2. Test History Card */}
                <div
                  onClick={() => navigate('/practice/my-quizzes')}
                  className="bg-white dark:bg-[#152238] rounded-3xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl">history_edu</span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 transition-colors">Test History</h3>
                      <p className="text-xs text-slate-400 font-medium">Review your past scores and AI feedback</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-lg group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                </div>

                {/* 3. Upcoming Tests Card */}
                <div
                  onClick={() => navigate('/mock-tests/upcoming')}
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
                </div>

                {/* 4. Performance Summary Card */}
                <div className="bg-white dark:bg-[#152238] rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-lg">equalizer</span>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Performance Summary</h3>
                    </div>
                    <button onClick={() => navigate('/progress/overview')} className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline">
                      View All →
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    {/* Donut Score Gauge */}
                    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                      <ProgressRing percent={avgScore} size={88} strokeWidth={8} color="#059669" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-base font-extrabold text-slate-900 dark:text-white">{avgScore}%</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Avg. Score</span>
                      </div>
                    </div>

                    {/* Stats List */}
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

                {/* 5. Tips from EduAI Card */}
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

                  {/* Robot Mascot Speech Bubble */}
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
        ) : feedback?.completed ? (
          // ── Step 3: Completion ──────────────────────────────────────
          <div className="glass-card rounded-xl p-8 text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-primary">emoji_events</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Quiz Complete!</h2>
            <p className="text-body-lg text-on-surface-variant">
              You scored <span className="font-bold text-primary">{feedback.score}</span> out of {feedback.total_questions} ({feedback.percentage}%)
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer" onClick={backToHub}>
                Practice Again
              </button>
              <button className="border border-primary text-primary px-6 py-3 rounded-lg font-bold hover:bg-primary hover:text-on-primary transition-all cursor-pointer" onClick={backToSubjects}>
                Choose Another Subject
              </button>
            </div>
          </div>
        ) : currentQuestion ? (
          // ── Step 3: Quiz taking ─────────────────────────────────────
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="px-3 py-1 bg-surface-container-high text-primary rounded-full font-label-md text-label-md">
                {activeMode.label} · Question {currentIndex + 1} of {attempt.total_questions}
              </span>
              <div className="flex items-center gap-3">
                {activeMode.secondsPerQuestion > 0 && (
                  <span className={`flex items-center gap-1 font-bold ${timerColor}`}>
                    <span className="material-symbols-outlined text-[18px]">timer</span>
                    {formatTime(timeLeft)}
                  </span>
                )}
                <span className="font-label-md text-label-md text-on-surface-variant">Score: {feedback ? feedback.score : (attempt.score || 0)}</span>
                <button
                  className="flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                  onClick={handleBookmarkQuestion}
                  disabled={bookmarking || bookmarkedQuestions.has(currentIndex)}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {bookmarkedQuestions.has(currentIndex) ? 'bookmark' : 'bookmark_border'}
                  </span>
                </button>
              </div>
            </div>

            {timeUp && (
              <div className="p-3 rounded-lg bg-error-container/30 text-error font-bold text-center">
                Time's up for this question!
              </div>
            )}

            <p className="text-body-lg text-on-surface font-bold">{currentQuestion.question}</p>

            {!feedback && (
              <div className="flex gap-2">
                <button
                  onClick={() => askHelper('hint')}
                  disabled={helper?.loading}
                  className="flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">tips_and_updates</span>
                  Hint
                </button>
                <button
                  onClick={() => askHelper('learn')}
                  disabled={helper?.loading}
                  className="flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">menu_book</span>
                  Learn Before Answer
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {Object.entries(currentQuestion.options).map(([key, value]) => {
                const isSelected = selected === key;
                const isCorrectOption = feedback && key === feedback.correct_answer;
                const isWrongSelected = feedback && isSelected && !feedback.is_correct;
                return (
                  <button
                    key={key}
                    onClick={() => !feedback && !timeUp && setSelected(key)}
                    disabled={!!feedback || timeUp}
                    className={`text-left p-4 border rounded-lg transition-all cursor-pointer ${
                      feedback
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

            {helper && (
              <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
                <p className="font-bold text-label-md text-primary">{HELPER_LABELS[helper.type]}</p>
                {helper.loading ? (
                  <span className="material-symbols-outlined animate-spin text-xl text-primary">progress_activity</span>
                ) : helper.error ? (
                  <p className="text-error text-body-md">{helper.error}</p>
                ) : (
                  <p className="text-body-md text-on-surface whitespace-pre-wrap">{helper.text}</p>
                )}
              </div>
            )}

            {quizError && <p className="text-error text-body-md">{quizError}</p>}

            {feedback ? (
              <>
                <div className={`p-4 rounded-lg ${feedback.is_correct ? 'bg-success-mastery/10 text-success-mastery' : 'bg-error-container/30 text-error'}`}>
                  <p className="font-bold mb-1">{feedback.is_correct ? 'Correct!' : 'Not quite.'}</p>
                  <p className="text-body-md text-on-surface">{feedback.explanation}</p>
                </div>
                <button
                  onClick={() => askHelper('discuss')}
                  disabled={helper?.loading}
                  className="flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">forum</span>
                  Discuss with AI
                </button>
                {!isLastQuestion && (
                  <button
                    className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
                    onClick={nextQuestion}
                  >
                    Next Question
                  </button>
                )}
              </>
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
        ) : null}
      </div>
    </main>
  );
};

export default Quiz;
