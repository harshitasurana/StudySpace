import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import ProgressRing from '../../../shared/ProgressRing';

const STATUS_LABEL = { in_progress: 'In Progress', not_started: 'Not Started' };
const ACTION_LABEL = { in_progress: 'Continue', not_started: 'Start' };

// Items from the spec that need real new infrastructure this app doesn't
// have yet (an exam-date field, daily-goal/timer tracking, a calendar UI,
// habit/goal definitions) — shown honestly as not-yet-built rather than
// faked. Related spec items are folded into one tile each.
const COMING_SOON_TILES = [
  { label: 'Exam Countdown', icon: 'event_upcoming', description: 'Count down to your next exam once exam dates are set up.' },
  { label: 'Study Timer & Focus Hours', icon: 'timer', description: 'Track focused study time per session.' },
  { label: 'Study Roadmap & Calendar', icon: 'calendar_month', description: 'A month-view roadmap across your whole curriculum.' },
  { label: 'Smart Revision Scheduler', icon: 'event_repeat', description: 'AI-scheduled spaced revision for chapters you’ve already studied.' },
  { label: 'Goals & Habits', icon: 'flag_circle', description: 'Set your own study goals and track daily habits.' },
  { label: 'Learning Pace & Milestones', icon: 'insights', description: 'How your pace compares over time, with milestone callouts.' },
];

const PlanItem = ({ item, onAction }) => (
  <div className="glass-card rounded-xl p-5 flex items-center gap-4">
    <ProgressRing percent={item.mastery} size={44} />
    <div className="min-w-0 flex-1">
      <span className="text-label-md text-on-surface-variant">{item.subject_name}</span>
      <h3 className="font-bold text-body-lg text-on-surface truncate">{item.chapter_name}</h3>
      <p className="text-label-md text-on-surface-variant">{STATUS_LABEL[item.status] || 'Not Started'}</p>
    </div>
    <button
      onClick={() => onAction(item)}
      className="shrink-0 flex items-center gap-1 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
    >
      {ACTION_LABEL[item.status] || 'Start'}
      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
    </button>
  </div>
);

const AIStudyPlan = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDay, setExpandedDay] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getStudyPlan();
        if (!cancelled) setPlan(res?.data || null);
      } catch {
        if (!cancelled) setError("Couldn't load your study plan. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // /lesson-heron renders the real AI Tutor (TutorChat) — it MUST carry
  // ?subject=&chapter=, since TutorChat grounds its conversation from
  // those params and otherwise silently defaults to some other
  // subject/chapter's most recent thread (see TutorChat.jsx), which would
  // show content unrelated to the chapter the student actually clicked.
  const handleAction = (item) => {
    if (item.status === 'in_progress') navigate(`/lesson-heron?subject=${item.subject_id}&chapter=${item.chapter_id}`);
    else navigate(`/pre-assessment/${item.chapter_id}`);
  };

  const focusItems = plan?.items?.filter((i) => i.group === 'focus') || [];
  const upNextItems = plan?.items?.filter((i) => i.group === 'up_next') || [];
  const allDone = plan && plan.total_chapters > 0 && plan.chapters_completed === plan.total_chapters;
  const todaysMission = plan?.weekly_plan?.[0]?.items?.[0] || plan?.items?.[0] || null;

  return (
    <main className="flex-grow py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
      <div className="max-w-5xl mx-auto space-y-stack-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">AI Study Plan</h1>
            <p className="text-body-lg text-on-surface-variant">Your AI coach — a personalized, priority-ranked path through what's left.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          </div>
        ) : error ? (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">{error}</div>
        ) : (
          <>
            {/* Stat strip: Learning Streak + Chapter Completion — both
                real, sourced from the same rubric/progress data as the
                rest of the app. */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card rounded-xl p-5 flex items-center gap-3">
                <span className="text-2xl leading-none">🔥</span>
                <div>
                  <p className="font-headline-sm text-headline-sm text-on-surface">{plan?.streak_days ?? 0}</p>
                  <p className="text-label-md text-on-surface-variant">Day Streak</p>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5 flex items-center gap-3">
                <ProgressRing percent={plan?.total_chapters ? Math.round((plan.chapters_completed / plan.total_chapters) * 100) : 0} size={40} />
                <div>
                  <p className="font-headline-sm text-headline-sm text-on-surface">{plan?.chapters_completed ?? 0}/{plan?.total_chapters ?? 0}</p>
                  <p className="text-label-md text-on-surface-variant">Chapters Complete</p>
                </div>
              </div>
            </div>

            {/* AI Suggestions */}
            {plan?.intro && (
              <div className="glass-card rounded-xl p-6 border-l-4 border-primary flex items-start gap-3">
                <span className="material-symbols-outlined text-primary shrink-0 mt-0.5">auto_awesome</span>
                <p className="text-body-md text-on-surface">{plan.intro}</p>
              </div>
            )}

            {allDone ? (
              <div className="glass-card rounded-xl p-8 text-center space-y-2">
                <span className="material-symbols-outlined text-5xl text-primary">emoji_events</span>
                <h2 className="font-headline-md text-headline-md text-on-surface">Every chapter mastered!</h2>
                <p className="text-body-md text-on-surface-variant">Nothing left on your plan — check Mock Tests to keep sharp.</p>
              </div>
            ) : (
              <>
                {/* Today's Mission — hero treatment for the single
                    highest-priority item. */}
                {todaysMission && (
                  <div>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Today's Mission</h2>
                    <div className="glass-card rounded-xl p-6 bg-primary/5 border-2 border-primary flex flex-col sm:flex-row sm:items-center gap-4">
                      <ProgressRing percent={todaysMission.mastery} size={56} />
                      <div className="min-w-0 flex-1">
                        <span className="text-label-md text-primary font-bold uppercase tracking-wide">{todaysMission.subject_name}</span>
                        <h3 className="font-headline-md text-headline-md text-on-surface truncate">{todaysMission.chapter_name}</h3>
                      </div>
                      <button
                        onClick={() => handleAction(todaysMission)}
                        className="shrink-0 flex items-center gap-1 bg-primary text-on-primary px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        {ACTION_LABEL[todaysMission.status] || 'Start'}
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Weekly Planner — the same ranked items spread across
                    the next 7 real calendar days. */}
                {plan?.weekly_plan?.length > 0 && (
                  <div>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Weekly Planner</h2>
                    <div className="glass-card rounded-xl p-2 space-y-1">
                      {plan.weekly_plan.map((day, idx) => (
                        <div key={day.date}>
                          <button
                            onClick={() => setExpandedDay(expandedDay === idx ? -1 : idx)}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
                          >
                            <span className={`text-body-md ${idx === 0 ? 'font-bold text-primary' : 'text-on-surface'}`}>
                              {idx === 0 ? 'Today' : day.day_label}
                            </span>
                            <span className="flex items-center gap-2 text-label-md text-on-surface-variant">
                              {day.items.length > 0 ? `${day.items.length} chapter${day.items.length === 1 ? '' : 's'}` : 'Rest day'}
                              <span className="material-symbols-outlined text-[18px]">
                                {expandedDay === idx ? 'expand_less' : 'expand_more'}
                              </span>
                            </span>
                          </button>
                          {expandedDay === idx && day.items.length > 0 && (
                            <div className="px-4 pb-3 space-y-1">
                              {day.items.map((item) => (
                                <div key={item.chapter_id} className="flex items-center justify-between py-1.5 pl-2 border-l-2 border-border-subtle">
                                  <span className="text-label-md text-on-surface">{item.chapter_name}</span>
                                  <span className="text-label-md text-on-surface-variant">{item.mastery}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {focusItems.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">Weak Concept Planner</h2>
                    <div className="space-y-3">
                      {focusItems.map((item) => (
                        <PlanItem key={item.chapter_id} item={item} onAction={handleAction} />
                      ))}
                    </div>
                  </div>
                )}

                {upNextItems.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">Up Next</h2>
                    <div className="space-y-3">
                      {upNextItems.map((item) => (
                        <PlanItem key={item.chapter_id} item={item} onAction={handleAction} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Coming Soon */}
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">More From Your AI Coach</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {COMING_SOON_TILES.map((tile) => (
                  <div key={tile.label} className="glass-card rounded-xl p-4 flex items-start gap-3 opacity-70">
                    <span className="material-symbols-outlined text-outline shrink-0">{tile.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-body-md text-on-surface">{tile.label}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full shrink-0">
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-label-md text-on-surface-variant mt-0.5">{tile.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default AIStudyPlan;
