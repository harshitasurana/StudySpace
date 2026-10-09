import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useUser from '../../../hooks/useUser';
import EducationService from '../../../services/EducationService';
import GuidedWalkthrough from '../../../shared/GuidedWalkthrough';
import { translationsDict } from '../../../utils/translations';
import { getMasteryTier, MASTERY_TIER_EMOJI } from '../../../shared/masteryTier';
import Dashboard from '../../../components/Dashboard/Dashboard';

const ATTEMPT_TYPE_LABEL = {
  quiz: 'Practice Quiz',
  mock_test: 'Mock Test',
  pre_assessment: 'Pre-Assessment',
};

const formatRelativeTime = (isoString) => {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

// "Today at 10:42 AM" for same-day activity, else a short date — distinct
// from formatRelativeTime above (which is for a historical list), since
// the Continue Learning card wants an absolute time-of-day for "today".
const formatLastStudied = (isoString) => {
  if (!isoString) return null;
  const studied = new Date(isoString);
  const now = new Date();
  const time = studied.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const isSameDay =
    studied.getFullYear() === now.getFullYear() && studied.getMonth() === now.getMonth() && studied.getDate() === now.getDate();
  return isSameDay ? `Today at ${time}` : `${studied.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
};

// Where clicking a Recent Activity row should go — the closest real page
// for that attempt type. Mock tests have a real history page; quizzes/
// pre-assessments don't have a per-attempt detail view anywhere in this
// app, so those route to Practice (real, valid) rather than a fabricated
// "view this exact attempt" page.
const recentActivityTarget = (attemptType) => (attemptType === 'mock_test' ? '/mock-tests/history' : '/practice');

const isToday = (isoString) => {
  if (!isoString) return false;
  const d = new Date(isoString);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

/**
 * Shared data-fetching + rendering for both /self/dashboard and
 * /school/dashboard. Every call here is keyed off the calling user's
 * student_profile_id, not learning_mode - identical for both roles today,
 * so this is the actual dashboard for both, not a lowest-common-
 * denominator subset.
 *
 * Callers only supply what genuinely differs: the page label (used in
 * gate/loading states), where "Go to Onboarding" should send an
 * incomplete profile, and how to render the identity line under the
 * welcome header (Board · Class for Self, School · Section · Roll No.
 * for School).
 */
const StudentDashboardBase = ({ dashboardLabel, onboardingPath, renderIdentityLine }) => {
  const navigate = useNavigate();
  const { profile } = useUser();
  const t = translationsDict[profile?.language] || translationsDict.en;

  const [dashboard, setDashboard] = useState(null);
  const [studentProfileId, setStudentProfileId] = useState(null);
  const [gateMessage, setGateMessage] = useState('');
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const [continueChapter, setContinueChapter] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  // Guided Walkthrough — self-mode only, fires once right after this
  // profile fetch confirms it's never been seen (guided_walkthrough_seen_at
  // is null). Shared between /self/dashboard and /school/dashboard, so
  // gating on learning_mode here (rather than in each page) is what keeps
  // this self-mode-only without duplicating the check in both callers.
  const [runWalkthrough, setRunWalkthrough] = useState(false);

  // Real, rubric-driven "what to study next" - computed server-side in
  // progress_service.js from actual mastery/quiz/mock signals, never
  // fabricated here. streak_days/recent_activity come off this same
  // response. Fetched independently of the dashboard/subject-progress
  // fetches below.
  const [recommendedNext, setRecommendedNext] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [streakDays, setStreakDays] = useState(0);
  const [loadingRecommendation, setLoadingRecommendation] = useState(true);

  // Real per-chapter mastery, same data source SubjectProgress.jsx's own
  // difficulty heatmap uses (progress_service.js's getSubjectProgressService)
  // — powers both "Your Learning Progress" below and the state-responsive
  // mission card's weak-chapter check.
  const [subjectProgress, setSubjectProgress] = useState([]);
  const [loadingSubjectProgress, setLoadingSubjectProgress] = useState(true);

  // Real daily/weekly "missions" (progress_service.js's getGameStatsService)
  // — answer-count based, not fabricated minutes, since nothing outside
  // quiz/mock-test attempts is duration-tracked anywhere in this app yet.
  const [gameStats, setGameStats] = useState(null);
  const [loadingGameStats, setLoadingGameStats] = useState(true);

  const [comingSoonLabel, setComingSoonLabel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dashRes = await EducationService.getStudentDashboard();
        if (cancelled) return;
        setDashboard(dashRes?.data || null);

        const profileRes = await EducationService.getMyProfile();
        if (cancelled) return;
        setStudentProfileId(profileRes?.data?.student_profile_id || null);
        if (profileRes?.data?.learning_mode === 'self' && !profileRes?.data?.guided_walkthrough_seen_at) {
          setRunWalkthrough(true);
        }
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 403) {
          setGateMessage('Finish your onboarding to unlock your dashboard.');
        } else if (err?.response?.status === 404) {
          setGateMessage('Set up your profile to see your dashboard.');
        } else {
          setGateMessage("Couldn't load your dashboard. Please refresh and try again.");
        }
      } finally {
        if (!cancelled) setLoadingDashboard(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getProgressOverview();
        if (cancelled) return;
        setRecommendedNext(res?.data?.recommended_next || null);
        setRecentActivity(res?.data?.recent_activity || []);
        setStreakDays(res?.data?.streak_days || 0);
      } catch {
        if (!cancelled) {
          setRecommendedNext(null);
          setRecentActivity([]);
          setStreakDays(0);
        }
      } finally {
        if (!cancelled) setLoadingRecommendation(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getSubjectProgress();
        if (!cancelled) setSubjectProgress(res?.data?.subjects || []);
      } catch {
        if (!cancelled) setSubjectProgress([]);
      } finally {
        if (!cancelled) setLoadingSubjectProgress(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getGameStats();
        if (!cancelled) setGameStats(res?.data || null);
      } catch {
        if (!cancelled) setGameStats(null);
      } finally {
        if (!cancelled) setLoadingGameStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // /lesson-heron renders the real AI Tutor (TutorChat) — it MUST carry
  // ?subject=&chapter=, since TutorChat grounds its conversation from
  // those params and otherwise silently defaults to some other
  // subject/chapter's most recent thread (see TutorChat.jsx), which would
  // show content unrelated to the chapter the student actually clicked.
  const handleRecommendedAction = () => {
    if (!recommendedNext) return;
    if (recommendedNext.status === 'in_progress') navigate(`/lesson-heron?subject=${recommendedNext.subject_id}&chapter=${recommendedNext.chapter_id}`);
    else navigate(`/pre-assessment/${recommendedNext.chapter_id}`);
  };

  // Continue Learning needs progress_percent/status/last_activity_at
  // (from getChapterProgress, the calibration-tracking table) merged onto
  // chapter_name/subject_name (from subjectProgress, already fetched
  // above) — two complementary real sources, not a duplicate fetch of the
  // same thing. Runs once both are ready.
  useEffect(() => {
    if (!studentProfileId || subjectProgress.length === 0) return;
    let cancelled = false;

    (async () => {
      setLoadingProgress(true);
      try {
        const progressRes = await EducationService.getChapterProgress(studentProfileId);
        if (cancelled) return;
        const progressByChapter = new Map((progressRes?.data || []).map((p) => [p.chapter_id, p]));

        const allChapters = subjectProgress.flatMap((s) =>
          s.chapters.map((c) => ({
            ...c,
            name: c.chapter_name,
            subject_id: s.subject_id,
            subjectName: s.subject_name,
            progressRow: progressByChapter.get(c.chapter_id) || null,
          }))
        );

        // Most recently touched in-progress chapter across all subjects;
        // if nothing's in progress yet, the first not-yet-completed
        // chapter of the first subject that has any.
        const inProgress = allChapters
          .filter((c) => c.progressRow?.status === 'in_progress')
          .sort((a, b) => new Date(b.progressRow.last_activity_at || 0) - new Date(a.progressRow.last_activity_at || 0));

        if (inProgress.length > 0) {
          setContinueChapter(inProgress[0]);
        } else {
          const firstSubjectWithChapters = subjectProgress.find((s) => s.chapters.length > 0);
          const firstChapter =
            allChapters.filter((c) => c.subject_id === firstSubjectWithChapters?.subject_id).find((c) => c.status !== 'completed') ||
            allChapters.find((c) => c.subject_id === firstSubjectWithChapters?.subject_id);
          setContinueChapter(firstChapter || null);
        }
      } catch {
        if (!cancelled) setProgressError("Couldn't load your progress. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoadingProgress(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentProfileId, subjectProgress]);

  // /lesson-heron renders the real AI Tutor (TutorChat) — it MUST carry
  // ?subject=&chapter=, since TutorChat grounds its conversation from
  // those params and otherwise silently defaults to some other
  // subject/chapter's most recent thread (see TutorChat.jsx), which would
  // show content unrelated to the chapter the student actually clicked.
  const handleContinue = (chapter) => {
    if (!chapter) return;
    const status = chapter.progressRow?.status;
    if (status === 'completed') navigate('/practice');
    else if (status === 'in_progress') navigate(`/lesson-heron?subject=${chapter.subject_id}&chapter=${chapter.chapter_id}`);
    else navigate(`/pre-assessment/${chapter.chapter_id}`);
  };

  const handleCopyCode = async () => {
    if (!dashboard?.student_code) return;
    try {
      await navigator.clipboard.writeText(dashboard.student_code);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Clipboard API unavailable - code is still visible on screen.
    }
  };

  // Fires once the student finishes or skips the tour — either way it's
  // "seen" and shouldn't run again. Best-effort: a failed save just means
  // the tour might show once more on a later visit, not worth surfacing
  // an error for (same non-critical bookkeeping pattern as bookmarks/notes).
  const handleWalkthroughFinish = () => {
    setRunWalkthrough(false);
    EducationService.markGuidedWalkthroughSeen().catch(() => { });
  };

  // Same "coming soon" UX TutorChat.jsx already uses for its own
  // not-yet-built input modes (COMING_SOON_MODES) — an honest disabled
  // state, not a fake working button.
  const showComingSoon = (label) => {
    setComingSoonLabel(label);
    window.setTimeout(() => setComingSoonLabel(null), 2000);
  };

  const greetingName = profile?.first_name || profile?.name || profile?.username || 'there';

  if (loadingDashboard) {
    return (
      <main className="flex-grow flex items-center justify-center py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </main>
    );
  }

  if (gateMessage) {
    return (
      <main className="flex-grow flex items-center justify-center py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
        <div className="text-center text-on-surface-variant max-w-md">
          <p className="text-headline-sm font-bold text-on-surface mb-2">{dashboardLabel}</p>
          <p className="text-body-md mb-4">{gateMessage}</p>
          <button
            className="bg-primary text-on-primary px-6 py-2 rounded-lg font-bold cursor-pointer"
            onClick={() => navigate(onboardingPath)}
          >
            Go to Onboarding
          </button>
        </div>
      </main>
    );
  }

  // Today's Mission — state picked by priority (first match wins), each
  // backed by real, already-fetched data. See the plan's Context section
  // for why each of these is real rather than invented (daily_questions/
  // weekly_attempts missions instead of a fabricated minutes goal;
  // weakest-chapter mastery instead of a synthesized "struggling" flag).
  const dailyMission = gameStats?.missions?.find((m) => m.id === 'daily_questions') || null;
  const weeklyMission = gameStats?.missions?.find((m) => m.id === 'weekly_attempts') || null;
  const allChaptersFlat = subjectProgress.flatMap((s) => s.chapters.map((c) => ({ ...c, subject_id: s.subject_id })));
  const weakestChapter = [...allChaptersFlat.filter((c) => c.mastery > 0)].sort((a, b) => a.mastery - b.mastery)[0] || null;
  // Real "strong side" of the AI Insight comparison below — highest
  // mastery chapter, paired with the same weakestChapter the mission card
  // uses, so the two sections reference one consistent weak-chapter
  // signal rather than two independently-computed picks.
  const strongestChapter = [...allChaptersFlat].sort((a, b) => b.mastery - a.mastery)[0] || null;
  const studiedToday = (dailyMission?.progress || 0) > 0 || isToday(continueChapter?.progressRow?.last_activity_at);

  let missionState = 'onTrack';
  if (dailyMission?.completed) missionState = 'goalCompleted';
  else if (weakestChapter && weakestChapter.mastery < 50) missionState = 'struggling';
  else if (!studiedToday) missionState = 'notStarted';

  const missionLoaded = !loadingGameStats && !loadingSubjectProgress;
  const weeklyPercent = weeklyMission ? Math.round((weeklyMission.progress / weeklyMission.target) * 100) : 0;

  return (
    <Dashboard
      runWalkthrough={runWalkthrough}
      handleWalkthroughFinish={handleWalkthroughFinish}
      t={t}
      greetingName={greetingName}
      renderIdentityLine={renderIdentityLine}
      dashboard={dashboard}
      loadingRecommendation={loadingRecommendation}
      recommendedNext={recommendedNext}
      streakDays={streakDays}
      loadingGameStats={loadingGameStats}
      weeklyMission={weeklyMission}
      weeklyPercent={weeklyPercent}
      codeCopied={codeCopied}
      handleCopyCode={handleCopyCode}
      missionLoaded={missionLoaded}
      missionState={missionState}
      dailyMission={dailyMission}
      weakestChapter={weakestChapter}
      continueChapter={continueChapter}
      handleContinue={handleContinue}
      loadingProgress={loadingProgress}
      progressError={progressError}
      formatLastStudied={formatLastStudied}
      showComingSoon={showComingSoon}
      comingSoonLabel={comingSoonLabel}
      strongestChapter={strongestChapter}
      handleRecommendedAction={handleRecommendedAction}
      loadingSubjectProgress={loadingSubjectProgress}
      subjectProgress={subjectProgress}
      recentActivity={recentActivity}
      ATTEMPT_TYPE_LABEL={ATTEMPT_TYPE_LABEL}
      formatRelativeTime={formatRelativeTime}
      recentActivityTarget={recentActivityTarget}
    />
  );
};

export default StudentDashboardBase;
