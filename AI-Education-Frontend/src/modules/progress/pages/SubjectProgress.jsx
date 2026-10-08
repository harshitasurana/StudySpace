import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import EducationService from '../../../services/EducationService';
import ProgressRing from '../../../shared/ProgressRing';
import { getMasteryTier, MASTERY_TIER_CLASSES } from '../../../shared/masteryTier';
import { containerVariants, itemVariants } from '../../../animations/variants';

const formatHours = (seconds) => {
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  return `${hours.toFixed(1)}h`;
};

const heatColor = (mastery) => MASTERY_TIER_CLASSES[getMasteryTier(mastery)];

const goToChapter = (navigate, subjectId, chapter) => {
  if (chapter.status === 'not_started') navigate(`/pre-assessment/${chapter.chapter_id}`);
  else navigate(`/lesson-heron?subject=${subjectId}&chapter=${chapter.chapter_id}`);
};

const CollapsiblePillsSection = ({ title, items, colorScheme, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, 6);
  const hiddenCount = items.length - 6;

  return (
    <div className={`rounded-xl p-3.5 border ${colorScheme.container}`}>
      <p className={`font-bold text-label-md mb-2.5 flex items-center justify-between ${colorScheme.title}`}>
        <span>{title}</span>
        <span className="text-label-sm text-on-surface-variant font-medium">({items.length} topics)</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visibleItems.map((c) => (
          <button
            key={c.chapter_id}
            type="button"
            onClick={() => onSelect(c)}
            title={c.chapter_name}
            className={`px-3 py-1 rounded-lg text-label-sm font-semibold transition-all cursor-pointer truncate max-w-[220px] ${colorScheme.pill}`}
          >
            {c.chapter_name}
          </button>
        ))}
        {!expanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-2.5 py-1 rounded-lg bg-surface-container-high text-primary text-label-sm font-bold hover:bg-primary hover:text-on-primary transition-all cursor-pointer"
          >
            +{hiddenCount} more
          </button>
        )}
        {expanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant text-label-sm font-bold hover:bg-surface-container transition-all cursor-pointer"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
};

const SubjectProgress = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getSubjectProgress();
        if (!cancelled) setSubjects(res?.data?.subjects || []);
      } catch {
        if (!cancelled) setError("Couldn't load your subject progress. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const overallMastery = useMemo(() => {
    if (subjects.length === 0) return 0;
    const total = subjects.reduce((sum, s) => sum + s.mastery, 0);
    return Math.round(total / subjects.length);
  }, [subjects]);

  const totalLearningTime = useMemo(() => {
    return subjects.reduce((sum, s) => sum + (s.learning_time_seconds || 0), 0);
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    if (filter === 'mastered') return subjects.filter((s) => s.mastery >= 75);
    if (filter === 'needs_focus') return subjects.filter((s) => s.mastery < 75);
    return subjects;
  }, [subjects, filter]);

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex-grow py-stack-lg px-2 sm:px-3 bg-surface-bright min-h-[calc(100vh-72px)]"
    >
      <div className="w-full space-y-stack-md">
        {/* Page Title & Context Help */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold">Subject Progress</h1>
            <p className="text-body-lg text-on-surface-variant">
              A subject-by-subject breakdown of your real mastery and activity.
            </p>
          </div>
        </div>

        {/* Overall Summary Stats Banner */}
        {!loading && !error && subjects.length > 0 && (
          <div className="glass-card-elevated rounded-2xl p-6 bg-gradient-to-br from-surface to-primary/5 border border-primary/20 shadow-md">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
              <div className="flex items-center gap-4">
                <ProgressRing percent={overallMastery} size={64} />
                <div>
                  <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold block">
                    Overall Average Mastery
                  </span>
                  <span className="font-headline-lg text-headline-lg font-bold text-primary">
                    {overallMastery}%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 border-l border-border-subtle/60 pl-6 hidden sm:flex">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">menu_book</span>
                </div>
                <div>
                  <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold block">
                    Total Subjects
                  </span>
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {subjects.length} Enrolled
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 border-l border-border-subtle/60 pl-6 hidden sm:flex">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">schedule</span>
                </div>
                <div>
                  <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold block">
                    Total Learning Time
                  </span>
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Total: {formatHours(totalLearningTime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border-subtle/40 text-label-sm">
              <span className="text-on-surface-variant font-bold mr-2">Filter:</span>
              {[
                { id: 'all', label: `All Subjects (${subjects.length})` },
                { id: 'mastered', label: `Mastered ≥75% (${subjects.filter((s) => s.mastery >= 75).length})` },
                { id: 'needs_focus', label: `Needs Focus <75% (${subjects.filter((s) => s.mastery < 75).length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    filter === f.id
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Section */}
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          </div>
        ) : error ? (
          <div className="glass-card rounded-2xl p-6 text-center text-on-surface-variant">{error}</div>
        ) : subjects.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant">
            No subjects are set up on your profile yet.
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant">
            No subjects match the selected filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {filteredSubjects.map((subject) => {
              const notCompleted = subject.chapters.filter((c) => c.status !== 'completed');
              const weakAreas = [...notCompleted].sort((a, b) => a.mastery - b.mastery).slice(0, 3);
              const strongAreas = [...subject.chapters].sort((a, b) => b.mastery - a.mastery).slice(0, 3);
              const revisionNeeded = subject.chapters.filter((c) => c.status === 'completed' && c.mastery < 85);
              const practiceNeeded = notCompleted.filter((c) => c.quiz_count === 0 && c.mock_count === 0);

              const totalSignals = subject.chapters.reduce((s, c) => s + c.quiz_count + c.mock_count, 0);
              const aiConfidence =
                totalSignals >= subject.total_chapters * 2
                  ? { text: 'High Confidence', className: 'text-success-mastery bg-success-mastery/10 border-success-mastery/30' }
                  : totalSignals > 0
                    ? { text: 'Building Confidence', className: 'text-orange-500 bg-orange-500/10 border-orange-500/30' }
                    : { text: 'Limited Data', className: 'text-on-surface-variant bg-surface-container border-border-subtle' };

              return (
                <motion.div
                  key={subject.subject_id}
                  variants={itemVariants}
                  className="glass-card-elevated rounded-2xl p-6 space-y-5 transition-all duration-300 hover:border-primary/40 hover:shadow-xl"
                >
                  {/* Subject Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle/50 pb-4">
                    <div className="flex items-center gap-4">
                      <ProgressRing percent={subject.mastery} size={60} />
                      <div>
                        <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
                          {subject.subject_name}
                        </h2>
                        <p className="text-label-md text-on-surface-variant font-medium mt-0.5">
                          {subject.chapters_completed} of {subject.total_chapters} chapters mastered · {subject.chapters_in_progress} in progress
                        </p>
                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-label-sm font-bold">
                          <span className={`text-label-md font-bold ${aiConfidence.className.split(' ')[0]}`}>
                            AI Confidence: {aiConfidence.text}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0 bg-surface-container-low sm:bg-transparent p-3 sm:p-0 rounded-xl">
                      <p className="font-bold text-headline-sm text-primary">{formatHours(subject.learning_time_seconds)}</p>
                      <p className="text-label-sm text-on-surface-variant font-medium">Learning Time</p>
                    </div>
                  </div>

                  {/* Metrics Badges */}
                  {(subject.average_quiz_score != null || subject.average_mock_test_score != null) && (
                    <div className="flex flex-wrap gap-2 text-label-sm font-semibold">
                      {subject.average_quiz_score != null && (
                        <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                          Avg. quiz: {Math.round(subject.average_quiz_score)}%
                        </span>
                      )}
                      {subject.average_mock_test_score != null && (
                        <span className="px-3 py-1 rounded-lg bg-secondary/10 text-secondary border border-secondary/20">
                          Avg. mock test: {Math.round(subject.average_mock_test_score)}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Weak & Strong Areas Side-by-Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {weakAreas.length > 0 && (
                      <div className="bg-error/5 rounded-xl p-3.5 border border-error/20">
                        <p className="font-bold text-label-md text-error mb-2.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">warning</span>
                          Weak Areas
                        </p>
                        <div className="space-y-2">
                          {weakAreas.map((c) => (
                            <div key={c.chapter_id} className="flex justify-between text-body-md gap-2 items-center">
                              <span className="min-w-0">
                                <span className="text-on-surface font-medium truncate block">
                                  {c.weakest_concept ? c.weakest_concept.concept : c.chapter_name}
                                </span>
                                {c.weakest_concept && (
                                  <span className="text-label-sm text-on-surface-variant truncate block">{c.chapter_name}</span>
                                )}
                              </span>
                              <span className="text-label-md font-bold text-error shrink-0 ml-2 px-2 py-0.5 bg-error/10 rounded">
                                {c.mastery}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {strongAreas.length > 0 && strongAreas[0].mastery > 0 && (
                      <div className="bg-success-mastery/5 rounded-xl p-3.5 border border-success-mastery/20">
                        <p className="font-bold text-label-md text-success-mastery mb-2.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">verified</span>
                          Strong Areas
                        </p>
                        <div className="space-y-2">
                          {strongAreas.filter((c) => c.mastery > 0).map((c) => (
                            <div key={c.chapter_id} className="flex justify-between text-body-md items-center">
                              <span className="text-on-surface font-medium truncate">{c.chapter_name}</span>
                              <span className="text-label-md font-bold text-success-mastery shrink-0 ml-2 px-2 py-0.5 bg-success-mastery/10 rounded">
                                {c.mastery}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Revision & Practice Needed Sections */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {revisionNeeded.length > 0 && (
                      <CollapsiblePillsSection
                        title="Revision Needed"
                        items={revisionNeeded}
                        colorScheme={{
                          container: 'bg-amber-500/5 border-amber-500/20',
                          title: 'text-amber-600 dark:text-amber-400',
                          pill: 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20',
                        }}
                        onSelect={(c) => goToChapter(navigate, subject.subject_id, c)}
                      />
                    )}

                    {practiceNeeded.length > 0 && (
                      <CollapsiblePillsSection
                        title="Practice Needed"
                        items={practiceNeeded}
                        colorScheme={{
                          container: 'bg-surface-container-lowest border-border-subtle',
                          title: 'text-on-surface',
                          pill: 'bg-surface-container border border-border-subtle text-on-surface hover:bg-primary/10 hover:text-primary hover:border-primary/30',
                        }}
                        onSelect={(c) => goToChapter(navigate, subject.subject_id, c)}
                      />
                    )}
                  </div>

                  {/* Difficulty Heatmap */}
                  <div className="pt-2 border-t border-border-subtle/40">
                    <p className="font-bold text-label-md text-on-surface-variant mb-2.5 flex items-center justify-between">
                      <span>Difficulty Heatmap</span>
                      <span className="text-label-sm text-on-surface-variant font-normal">
                        Hover or click tile to navigate
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {subject.chapters.map((c) => (
                        <button
                          key={c.chapter_id}
                          type="button"
                          title={`${c.chapter_name} — ${c.mastery}%`}
                          onClick={() => goToChapter(navigate, subject.subject_id, c)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-label-sm font-extrabold cursor-pointer hover:scale-110 transition-transform shadow-xs ${heatColor(
                            c.mastery
                          )}`}
                        >
                          {c.mastery}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.main>
  );
};

export default SubjectProgress;
