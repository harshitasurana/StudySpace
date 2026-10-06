import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import ProgressRing from '../../../shared/ProgressRing';

const confidenceLabel = (readiness) => {
  if (readiness >= 80) return { text: 'High Confidence', className: 'text-success-mastery' };
  if (readiness >= 50) return { text: 'Building Confidence', className: 'text-orange-500' };
  return { text: 'Needs Review', className: 'text-error' };
};

const UpcomingTests = () => {
  const navigate = useNavigate();
  const [subjectProgress, setSubjectProgress] = useState([]);
  const [mockAttempts, setMockAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [progressRes, attemptsRes] = await Promise.all([
          EducationService.getSubjectProgress(),
          EducationService.listQuizAttempts('mock_test'),
        ]);
        if (cancelled) return;
        setSubjectProgress(progressRes?.data?.subjects || []);
        setMockAttempts(attemptsRes?.data || []);
      } catch {
        if (!cancelled) setError("Couldn't load upcoming tests. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleStart = (subject) => {
    const weakest = [...(subject.chapters || [])]
      .filter((c) => c.status !== 'completed')
      .sort((a, b) => a.mastery - b.mastery)[0];
    const chapterId = weakest?.chapter_id || subject.chapters?.[0]?.chapter_id;
    navigate(chapterId ? `/mock-tests?chapterId=${chapterId}` : '/mock-tests');
  };

  return (
    <main className="flex-grow py-6 px-2 sm:px-3 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Upcoming Tests</h1>
            <p className="text-body-lg text-on-surface-variant">Your real readiness per subject, and where to focus before your next mock test.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          </div>
        ) : error ? (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">{error}</div>
        ) : subjectProgress.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">No subjects are set up on your profile yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subjectProgress.map((subject) => {
              const readiness = Math.round(subject.mastery || 0);
              const confidence = confidenceLabel(readiness);
              const chaptersRemaining = subject.total_chapters - subject.chapters_completed;
              const weakest = [...(subject.chapters || [])]
                .filter((c) => c.status !== 'completed')
                .sort((a, b) => a.mastery - b.mastery)[0];

              const subjectAttempts = mockAttempts
                .filter((a) => a.subject_id === subject.subject_id)
                .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
              const latest = subjectAttempts[0];
              const previous = subjectAttempts[1];
              const delta = latest && previous ? Math.round((Number(latest.percentage) - Number(previous.percentage)) * 10) / 10 : null;

              return (
                <div key={subject.subject_id} className="glass-card rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <ProgressRing percent={readiness} size={56} />
                    <div className="min-w-0">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">{subject.subject_name}</h3>
                      <p className={`text-label-md font-bold ${confidence.className}`}>{confidence.text}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-surface-container-low rounded-lg py-2">
                      <p className="font-bold text-on-surface">{chaptersRemaining}</p>
                      <p className="text-label-md text-on-surface-variant">Chapters Remaining</p>
                    </div>
                    <div className="bg-surface-container-low rounded-lg py-2">
                      <p className={`font-bold ${delta == null ? 'text-on-surface' : delta >= 0 ? 'text-success-mastery' : 'text-error'}`}>
                        {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
                      </p>
                      <p className="text-label-md text-on-surface-variant">vs Previous Test</p>
                    </div>
                  </div>

                  {weakest && (
                    <p className="text-label-md text-on-surface-variant">
                      <span className="font-bold text-on-surface">AI Suggested Revision:</span> {weakest.chapter_name} ({weakest.mastery}%)
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">
                      Test Countdown — Coming Soon
                    </span>
                    <button
                      onClick={() => handleStart(subject)}
                      className="flex items-center gap-1 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Start Test
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default UpcomingTests;
