import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDuration = (seconds) => {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

// A dependency-free trend line — real percentage points, oldest to
// newest, no charting library needed for this shape of data.
const ScoreTrend = ({ attempts }) => {
  const points = [...attempts].reverse().slice(-10); // oldest -> newest, last 10
  if (points.length < 2) return <p className="text-body-md text-on-surface-variant">Take a few more tests to see your trend.</p>;

  const width = 100;
  const height = 40;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => [i * step, height - (Number(p.percentage) / 100) * height]);
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

  // A flat line (every score identical, e.g. 2 tests both at 30%) is a
  // real, correct trend, not a rendering bug — but with no axis or point
  // labels a viewer can't tell "consistently low" from "chart's broken."
  // Spelling out the real average + count removes that ambiguity.
  const avg = Math.round((points.reduce((s, p) => s + Number(p.percentage), 0) / points.length) * 10) / 10;
  const allSame = points.every((p) => Number(p.percentage) === Number(points[0].percentage));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" vectorEffect="non-scaling-stroke" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.5" className="fill-primary" />
        ))}
      </svg>
      <p className="text-label-md text-on-surface-variant mt-1">
        {allSame ? `Steady at ${avg}%` : `${avg}% avg`} · {points.length} test{points.length === 1 ? '' : 's'}
      </p>
    </div>
  );
};

const TestHistory = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookmarkedAttempts, setBookmarkedAttempts] = useState(new Set());

  const handleBookmarkTest = async (attempt) => {
    if (bookmarkedAttempts.has(attempt.attempt_id)) return;
    setBookmarkedAttempts((prev) => new Set(prev).add(attempt.attempt_id)); // optimistic
    try {
      await EducationService.createBookmark({
        chapterId: attempt.chapter_id,
        sourceType: 'test',
        title: `${attempt.chapter_name} — Mock Test`,
        content: `Scored ${attempt.score}/${attempt.total_questions} (${attempt.percentage}%) on ${formatDate(attempt.submitted_at)}.`,
      });
    } catch {
      setBookmarkedAttempts((prev) => { const next = new Set(prev); next.delete(attempt.attempt_id); return next; });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [attemptsRes, reviewRes] = await Promise.all([
          EducationService.listQuizAttempts('mock_test'),
          EducationService.getTestReview().catch(() => null),
        ]);
        if (cancelled) return;
        setAttempts(attemptsRes?.data || []);
        setReview(reviewRes?.data || null);
      } catch {
        if (!cancelled) setError("Couldn't load your test history. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Weak Concepts — the 3 lowest-scoring mock-tested chapters, each with
  // its own real weakest sub-topic (see getTestReviewService's
  // weak_chapters, backed by quiz_service.js's getWeakestConceptForChapter
  // — same real per-question concept data Subject Progress uses). A
  // chapter falls back to just its own name when it predates concept
  // tagging or hasn't had enough repeated misses on one concept yet.
  const weakConcepts = review?.weak_chapters || [];

  const avgDuration = (() => {
    const withDuration = attempts.filter((a) => a.duration_seconds != null);
    if (withDuration.length === 0) return null;
    return Math.round(withDuration.reduce((s, a) => s + a.duration_seconds, 0) / withDuration.length);
  })();

  return (
    <main className="flex-grow py-6 px-2 sm:px-3 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Test History</h1>
            <p className="text-body-lg text-on-surface-variant">Every mock test you've completed, with real analysis of how you're doing.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          </div>
        ) : error ? (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">{error}</div>
        ) : attempts.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">
            No mock tests completed yet — take one from Upcoming Tests.
          </div>
        ) : (
          <>
            {review?.review && (
              <div className="glass-card rounded-xl p-6 border-l-4 border-primary flex items-start gap-3">
                <span className="material-symbols-outlined text-primary shrink-0 mt-0.5">auto_awesome</span>
                <div>
                  <p className="text-label-md text-primary font-bold uppercase tracking-wide mb-1">AI Review</p>
                  <p className="text-body-md text-on-surface">{review.review}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-card rounded-xl p-5">
                <h2 className="font-bold text-body-lg text-on-surface mb-2">Score Trend</h2>
                <ScoreTrend attempts={attempts} />
              </div>
              <div className="glass-card rounded-xl p-5 space-y-3">
                <h2 className="font-bold text-body-lg text-on-surface">Time Analysis</h2>
                <p className="text-body-md text-on-surface-variant">
                  Average completion time: <span className="font-bold text-on-surface">{formatDuration(avgDuration)}</span>
                </p>
                <p className="text-body-md text-on-surface-variant">
                  Tests taken: <span className="font-bold text-on-surface">{attempts.length}</span>
                </p>
              </div>
            </div>

            {weakConcepts.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <h2 className="font-bold text-body-lg text-on-surface mb-3">Weak Concepts</h2>
                <div className="space-y-2">
                  {weakConcepts.map((c) => (
                    <div key={c.chapter_id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="text-body-md text-on-surface truncate block">
                          {c.weakest_concept ? c.weakest_concept.concept : c.chapter_name}
                        </span>
                        {c.weakest_concept && (
                          <span className="text-label-sm text-on-surface-variant truncate block">{c.chapter_name}</span>
                        )}
                      </span>
                      <span className="text-label-md text-on-surface-variant shrink-0">{c.avg}% avg</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass-card rounded-xl p-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-body-lg text-on-surface">Wrong Questions &amp; Mistake Replay</h2>
                <p className="text-label-md text-on-surface-variant">Review every question you've missed on a mock test, with the real explanation.</p>
              </div>
              <button
                onClick={() => navigate('/practice/mistakes?type=mock_test')}
                className="shrink-0 flex items-center gap-1 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Review
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>

            <div className="glass-card rounded-xl p-4 flex items-center gap-2 opacity-70">
              <span className="material-symbols-outlined text-outline">leaderboard</span>
              <div>
                <p className="font-bold text-body-md text-on-surface">Rank &amp; Percentile</p>
                <p className="text-label-md text-on-surface-variant">Compares you to other students once a peer group is set up.</p>
              </div>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full shrink-0">
                Coming Soon
              </span>
            </div>

            <div className="glass-card rounded-xl divide-y divide-border-subtle">
              {attempts.map((a) => (
                <div key={a.attempt_id} className="flex justify-between items-center p-4">
                  <div>
                    <p className="font-bold text-on-surface">{a.chapter_name}</p>
                    <p className="text-label-md text-on-surface-variant">
                      {a.subject_name} · {formatDate(a.submitted_at)} · {formatDuration(a.duration_seconds)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-primary">{a.score}/{a.total_questions}</p>
                      <p className="text-label-md text-on-surface-variant">{a.percentage}%</p>
                    </div>
                    <button
                      onClick={() => handleBookmarkTest(a)}
                      disabled={bookmarkedAttempts.has(a.attempt_id)}
                      title="Bookmark this test result"
                      className="text-on-surface-variant hover:text-primary cursor-pointer disabled:cursor-default"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {bookmarkedAttempts.has(a.attempt_id) ? 'bookmark' : 'bookmark_border'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default TestHistory;
