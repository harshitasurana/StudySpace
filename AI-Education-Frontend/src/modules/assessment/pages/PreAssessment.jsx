import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import useGenerationPolling from '../../../hooks/useGenerationPolling';

const PreAssessment = () => {
  const navigate = useNavigate();
  const { chapterId: routeChapterId } = useParams();

  const [subjects, setSubjects] = useState([]);
  const [chaptersBySubject, setChaptersBySubject] = useState({});
  const [selectedChapterId, setSelectedChapterId] = useState(routeChapterId ? Number(routeChapterId) : null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [attempt, setAttempt] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quizError, setQuizError] = useState('');
  // Set while calibration is generating in the background (Celery, via
  // RAGProductionApp) — the quiz_attempts row already exists before this
  // is set, so it survives navigating away and back. See Quiz.jsx's own
  // copy of this pattern for the full reasoning.
  const [generatingAttemptId, setGeneratingAttemptId] = useState(null);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const loadRecentAttempts = async () => {
    try {
      const res = await EducationService.listQuizAttempts('pre_assessment', true);
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
        const profileRes = await EducationService.getMyProfile();
        if (cancelled) return;
        const profileSubjects = (profileRes?.data?.subjects || []).map((s) => ({ id: s.subject_id, label: s.name }));
        setSubjects(profileSubjects);

        const chaptersRes = await Promise.all(profileSubjects.map((s) => EducationService.getChapters(s.id)));
        if (cancelled) return;
        const map = {};
        profileSubjects.forEach((s, idx) => { map[s.id] = chaptersRes[idx]?.data || []; });
        setChaptersBySubject(map);

        if (!routeChapterId) {
          const firstSubject = profileSubjects[0];
          const firstChapter = firstSubject ? map[firstSubject.id]?.[0] : null;
          if (firstChapter) setSelectedChapterId(firstChapter.chapter_id);
        }
      } catch {
        if (!cancelled) setMetaError("Couldn't load your chapters. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => { cancelled = true; };
  }, [routeChapterId]);

  const allChapters = Object.values(chaptersBySubject).flat();
  const selectedChapter = allChapters.find((c) => c.chapter_id === selectedChapterId);

  const handleGenerationComplete = (res) => {
    const data = res?.data || null;
    setAttempt(data);
    // resume_index is 0 for a genuinely fresh attempt (same as before
    // this existed) and the first unanswered question for one resumed
    // from Recent Calibrations after being abandoned mid-calibration —
    // see quiz_service.js's getQuizStatusService.
    setCurrentIndex(data?.resume_index || 0);
    setSelected(null);
    setFeedback(null);
    setStarting(false);
    setGeneratingAttemptId(null);
    loadRecentAttempts();
  };

  const handleGenerationFailed = (res) => {
    setQuizError(res?.data?.error_message || "Couldn't generate the calibration. Please try again.");
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

  const startCalibration = async () => {
    if (!selectedChapterId) return;
    setStarting(true);
    setQuizError('');
    try {
      const res = await EducationService.generateQuiz(selectedChapterId, 5, 'pre_assessment');
      if (res?.data?.generation_status === 'failed') {
        setQuizError("Couldn't start the calibration right now. Please try again.");
        setStarting(false);
        return;
      }
      // 'processing' — hand off to useGenerationPolling above; `starting`
      // stays true (shows the waiting card) until it resolves.
      setGeneratingAttemptId(res?.data?.attempt_id);
      loadRecentAttempts();
    } catch {
      setQuizError("Couldn't start the calibration right now. Please try again.");
      setStarting(false);
    }
  };

  // Lets a student jump back into a calibration that's still generating
  // from "Recent Calibrations" below, after navigating away mid-generation.
  const resumeGenerating = (attemptId) => {
    setQuizError('');
    setStarting(true);
    setGeneratingAttemptId(attemptId);
  };

  const submitAnswer = async () => {
    if (!selected || !attempt || submitting) return;
    setSubmitting(true);
    try {
      const res = await EducationService.submitQuizAnswer(attempt.attempt_id, currentIndex, selected);
      setFeedback(res?.data || null);
    } catch {
      setQuizError("Couldn't submit your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = () => {
    setCurrentIndex((i) => i + 1);
    setSelected(null);
    setFeedback(null);
  };

  const currentQuestion = attempt?.questions?.[currentIndex];
  const isLastQuestion = attempt && currentIndex === attempt.total_questions - 1;

  return (
    <main className="flex-grow py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
      <div className="max-w-5xl mx-auto space-y-stack-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Pre-Assessment</h1>
          <p className="text-body-lg text-on-surface-variant">
            A short diagnostic helps us calibrate your starting mastery for this chapter before you begin.
          </p>
        </div>

        {loadingMeta ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          </div>
        ) : metaError ? (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">{metaError}</div>
        ) : generatingAttemptId ? (
          // Safe to navigate away — the quiz_attempts row already exists
          // and Celery keeps generating it server-side regardless.
          <div className="glass-card rounded-xl p-8 text-center space-y-4">
            <span className="material-symbols-outlined animate-spin text-5xl text-primary">progress_activity</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Preparing your diagnostic…</h2>
            <p className="text-body-lg text-on-surface-variant">
              Feel free to browse elsewhere — it'll keep generating and show up under "Recent Calibrations" the
              moment it's ready.
            </p>
            <button
              className="border border-primary text-primary px-6 py-3 rounded-lg font-bold hover:bg-primary hover:text-on-primary transition-all cursor-pointer"
              onClick={() => { setStarting(false); setGeneratingAttemptId(null); }}
            >
              Back
            </button>
          </div>
        ) : !attempt ? (
          <>
          <div className="glass-card rounded-xl p-6 space-y-4">
            {!routeChapterId && (
              <select
                className="w-full rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-2 text-body-md"
                value={selectedChapterId || ''}
                onChange={(e) => setSelectedChapterId(Number(e.target.value))}
              >
                {subjects.map((s) => (
                  <optgroup key={s.id} label={s.label}>
                    {(chaptersBySubject[s.id] || []).map((c) => (
                      <option key={c.chapter_id} value={c.chapter_id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            {selectedChapter && (
              <div className="p-4 bg-surface-container-low rounded-lg">
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Chapter</p>
                <h3 className="font-headline-md text-headline-md text-on-surface">{selectedChapter.name}</h3>
              </div>
            )}
            {quizError && <p className="text-error text-body-md">{quizError}</p>}
            <button
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              onClick={startCalibration}
              disabled={starting || !selectedChapterId}
            >
              {starting ? 'Preparing your diagnostic…' : 'Start Calibration'}
            </button>
          </div>

          {!loadingRecent && recentAttempts.length > 0 && (
            <div className="glass-card rounded-xl p-6 space-y-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Recent Calibrations</h2>
              <div className="divide-y divide-border-subtle">
                {recentAttempts.slice(0, 5).map((a) =>
                  a.generation_status === 'processing' ? (
                    <button
                      key={a.attempt_id}
                      onClick={() => resumeGenerating(a.attempt_id)}
                      className="w-full flex justify-between items-center py-3 text-left cursor-pointer hover:bg-surface-container-low rounded-lg px-2 -mx-2"
                    >
                      <div>
                        <p className="font-bold text-on-surface">{a.chapter_name}</p>
                        <p className="text-label-md text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                          Generating…
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                    </button>
                  ) : a.generation_status === 'failed' ? (
                    <div key={a.attempt_id} className="flex justify-between items-center py-3">
                      <div>
                        <p className="font-bold text-on-surface">{a.chapter_name}</p>
                        <p className="text-label-md text-error">Generation failed</p>
                      </div>
                    </div>
                  ) : a.status === 'in_progress' ? (
                    // Generated fine, but abandoned mid-calibration on a
                    // previous visit — resumeGenerating hands this off
                    // to the same polling flow as "still generating"
                    // above; since generation_status is already
                    // 'completed' the check resolves immediately and
                    // handleGenerationComplete jumps straight back to
                    // resume_index.
                    <button
                      key={a.attempt_id}
                      onClick={() => resumeGenerating(a.attempt_id)}
                      className="w-full flex justify-between items-center py-3 text-left cursor-pointer hover:bg-surface-container-low rounded-lg px-2 -mx-2"
                    >
                      <div>
                        <p className="font-bold text-on-surface">{a.chapter_name}</p>
                        <p className="text-label-md text-primary">
                          In Progress · {a.answered_count} of {a.total_questions} answered
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-label-md font-bold text-primary">
                        Resume
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </span>
                    </button>
                  ) : (
                    <div key={a.attempt_id} className="flex justify-between items-center py-3">
                      <div>
                        <p className="font-bold text-on-surface">{a.chapter_name}</p>
                        <p className="text-label-md text-on-surface-variant">
                          {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">Starting mastery: {a.percentage}%</p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
          </>
        ) : feedback?.completed ? (
          <div className="glass-card rounded-xl p-8 text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-primary">insights</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Calibration Complete!</h2>
            <p className="text-body-lg text-on-surface-variant">
              Your starting mastery for <span className="font-bold">{selectedChapter?.name}</span> is
              <span className="font-bold text-primary"> {feedback.percentage}%</span>
            </p>
            <button
              className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
              onClick={() => navigate('/curriculum')}
            >
              Go to Curriculum
            </button>
          </div>
        ) : currentQuestion ? (
          <div className="glass-card rounded-xl p-6 space-y-4">
            <span className="px-3 py-1 bg-surface-container-high text-primary rounded-full font-label-md text-label-md">
              Question {currentIndex + 1} of {attempt.total_questions}
            </span>

            <p className="text-body-lg text-on-surface font-bold">{currentQuestion.question}</p>

            <div className="grid grid-cols-1 gap-3">
              {Object.entries(currentQuestion.options).map(([key, value]) => {
                const isSelected = selected === key;
                const isCorrectOption = feedback && key === feedback.correct_answer;
                const isWrongSelected = feedback && isSelected && !feedback.is_correct;
                return (
                  <button
                    key={key}
                    onClick={() => !feedback && setSelected(key)}
                    disabled={!!feedback}
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

            {quizError && <p className="text-error text-body-md">{quizError}</p>}

            {feedback ? (
              <>
                <div className={`p-4 rounded-lg ${feedback.is_correct ? 'bg-success-mastery/10 text-success-mastery' : 'bg-error-container/30 text-error'}`}>
                  <p className="font-bold mb-1">{feedback.is_correct ? 'Correct!' : 'Not quite.'}</p>
                  <p className="text-body-md text-on-surface">{feedback.explanation}</p>
                </div>
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
                disabled={!selected || submitting}
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

export default PreAssessment;
