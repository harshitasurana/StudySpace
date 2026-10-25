import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import useSelfStudentMode from '../../../hooks/useSelfStudentMode';
import ComingSoonPage from '../../../shared/ComingSoonPage';

const STATUS_LABELS = {
  in_progress: 'In progress',
  submitted: 'Submitted — awaiting grading',
  grading: 'Grading…',
  graded: 'Graded',
  failed: 'Grading failed',
};

const SamplePaperResult = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { isSelfStudent, modeLoading } = useSelfStudentMode();


  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAttempt = useCallback(async () => {
    try {
      const res = await EducationService.getSamplePaperAttempt(attemptId);
      setAttempt(res?.data || null);
    } catch {
      setError("Couldn't load this attempt.");
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (modeLoading || !isSelfStudent) return;
    fetchAttempt();
  }, [modeLoading, isSelfStudent, fetchAttempt]);

  // Polls while grading is in flight — the answer PDF is read and graded
  // in a background job (RAGProductionApp reports back via
  // sample_paper_service.js's grading-callback route), same interval
  // pattern used elsewhere for background-job polling.
  useEffect(() => {
    if (!attempt || (attempt.status !== 'submitted' && attempt.status !== 'grading')) return;
    const interval = window.setInterval(fetchAttempt, 5000);
    return () => window.clearInterval(interval);
  }, [attempt, fetchAttempt]);

  if (modeLoading) {
    return (
      <main className="flex-grow flex items-center justify-center py-16 bg-surface-bright min-h-[calc(100vh-72px)]">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </main>
    );
  }
  if (!isSelfStudent) {
    return <ComingSoonPage icon="fact_check" title="Sample Papers" description="Sample Papers for your account type is coming soon." />;
  }
  if (loading) {
    return (
      <main className="flex-grow flex items-center justify-center py-16 bg-surface-bright min-h-[calc(100vh-72px)]">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </main>
    );
  }
  if (error || !attempt) {
    return (
      <main className="flex-grow py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
        <div className="max-w-3xl mx-auto glass-card rounded-xl p-6 text-center text-on-surface-variant">
          {error || 'Attempt not found.'}
        </div>
      </main>
    );
  }

  const responses = attempt.responses || [];

  return (
    <main className="flex-grow py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
      <div className="max-w-3xl mx-auto space-y-stack-md">
        <div className="glass-card rounded-xl p-6">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{attempt.samplePaper?.title}</h1>
          <p className="text-body-lg text-on-surface-variant mt-1">{STATUS_LABELS[attempt.status] || attempt.status}</p>
          {attempt.status === 'graded' && (
            <p className="text-body-lg text-on-surface mt-2">
              Score: <span className="font-bold text-primary">{attempt.score}</span> / {attempt.total_marks} ({attempt.percentage}%)
            </p>
          )}
          {(attempt.status === 'submitted' || attempt.status === 'grading') && (
            <p className="text-body-md text-on-surface-variant mt-2">
              Your answer PDF is being read and graded by AI — this page updates automatically once it's done.
            </p>
          )}
          {attempt.status === 'failed' && (
            <p className="text-body-md text-error mt-2">
              Grading couldn't be completed for this attempt. Please contact support if this keeps happening.
            </p>
          )}
        </div>

        {(attempt.status === 'submitted' || attempt.status === 'grading') && responses.length === 0 && (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">
            Your answer PDF is being read and graded — this checks back automatically.
          </div>
        )}

        {responses.map((r) => (
          <div key={r.response_id} className="glass-card rounded-xl p-6 space-y-2">
            <p className="text-body-lg text-on-surface font-bold whitespace-pre-wrap">{r.question?.question_text}</p>

            {r.transcribed_answer ? (
              <div>
                <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Your Answer (read from your PDF)
                </p>
                <p className="text-body-md text-on-surface whitespace-pre-wrap">{r.transcribed_answer}</p>
              </div>
            ) : (
              <p className="text-label-md text-on-surface-variant italic">No answer found for this question in your PDF.</p>
            )}

            {r.marks_awarded !== null && r.marks_awarded !== undefined && (
              <p className="text-body-md text-on-surface">
                <span className="font-bold text-primary">{r.marks_awarded}</span> / {r.max_marks}
              </p>
            )}
            {r.needs_self_review && (
              <p className="text-label-md text-on-surface-variant">
                ⚠ Low confidence — compare your answer against the model answer yourself.
              </p>
            )}
            {r.feedback && <p className="text-body-md text-on-surface-variant">{r.feedback}</p>}

            {r.rubric_breakdown && r.rubric_breakdown.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Marks Breakdown</p>
                {r.rubric_breakdown.map((c, i) => (
                  <div key={i} className="flex justify-between gap-3 text-body-md text-on-surface-variant">
                    <span>{c.criterion}{c.comment ? ` — ${c.comment}` : ''}</span>
                    <span className="shrink-0 font-bold text-on-surface">{c.marks_awarded}/{c.marks_possible}</span>
                  </div>
                ))}
              </div>
            )}

            {r.question?.model_answer && (
              <div className="mt-2 p-3 rounded-lg bg-surface-container-high">
                <p className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider mb-1">Model Answer</p>
                <p className="text-body-md text-on-surface whitespace-pre-wrap">{r.question.model_answer}</p>
              </div>
            )}

            <div className="pt-3 border-t border-border-subtle dark:border-[#2e3f5f] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const qText = r.question?.question_text || '';
                  const mAns = r.question?.model_answer || '';
                  const promptText = `Can you explain this question and its step-by-step solution?\nQuestion: ${qText}\n${mAns ? `Model Solution: ${mAns}` : ''}`;
                  navigate(`/ai-tutor/chat?question=${encodeURIComponent(promptText)}`);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-label-md font-semibold transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                Ask AI Tutor about this Question
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

export default SamplePaperResult;
