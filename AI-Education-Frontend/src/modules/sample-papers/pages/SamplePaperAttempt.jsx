import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import useSelfStudentMode from '../../../hooks/useSelfStudentMode';
import ComingSoonPage from '../../../shared/ComingSoonPage';

// The student writes every answer on paper (organized by question
// number), scans/photographs it into ONE PDF, and uploads it here after
// reviewing the whole paper — not typed text or a photo per question.
// Grading reads the PDF page by page via the local vision model, matches
// each answer to its question by number, then grades it against the real
// rubric (see AI-Education-Backend's sample_paper_service.js /
// RAGProductionApp's core/sample_paper_grading.py).
const SamplePaperAttempt = () => {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const { isSelfStudent, modeLoading } = useSelfStudentMode();

  const [paper, setPaper] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pdfFile, setPdfFile] = useState(null);
  const [uploadedPdfName, setUploadedPdfName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (modeLoading || !isSelfStudent) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [paperRes, attemptRes] = await Promise.all([
          EducationService.getSamplePaper(paperId),
          EducationService.startSamplePaperAttempt(paperId),
        ]);
        if (cancelled) return;
        setPaper(paperRes?.data || null);
        setAttemptId(attemptRes?.data?.attempt_id || null);
        // startSamplePaperAttempt resumes an existing in_progress attempt
        // rather than always creating a fresh one — if this student
        // already uploaded a PDF in an earlier session (e.g. they
        // refreshed the page), reflect that real saved state instead of
        // showing the upload step as empty.
        if (attemptRes?.data?.answer_pdf_key) {
          setUploadedPdfName('Previously uploaded answer PDF');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.status === 404 ? "This sample paper isn't available." : "Couldn't load this sample paper. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paperId, modeLoading, isSelfStudent]);

  const handleUploadPdf = async () => {
    if (!pdfFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const res = await EducationService.uploadSamplePaperAnswerPdf(attemptId, pdfFile);
      setUploadedPdfName(pdfFile.name);
      setPdfFile(null);
      void res;
    } catch {
      setUploadError("Couldn't upload your PDF — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitPaper = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      await EducationService.submitSamplePaper(attemptId);
      navigate(`/sample-papers/attempts/${attemptId}`);
    } catch (err) {
      setSubmitError(
        err?.response?.data?.message === 'Upload your answer PDF before submitting'
          ? 'Please upload your answer PDF before submitting.'
          : "Couldn't submit the paper. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

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
  if (error || !paper) {
    return (
      <main className="flex-grow py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
        <div className="max-w-3xl mx-auto glass-card rounded-xl p-6 text-center text-on-surface-variant">
          {error || "This sample paper isn't available."}
        </div>
      </main>
    );
  }

  const questions = paper.questions || [];
  const hasUploadedPdf = !!uploadedPdfName;

  return (
    <main className="flex-grow py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
      <div className="max-w-4xl mx-auto space-y-stack-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{paper.title}</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            AI grading is an estimate, especially for handwriting and diagrams/graphs — not a guaranteed final score.
          </p>
        </div>

        <div className="glass-card rounded-xl p-6 bg-surface-container-low">
          <p className="text-body-md text-on-surface">
            <span className="font-bold">How to answer:</span> write out your answers on paper, clearly labeling
            each one with its question number, then scan or photograph every page into a single PDF and upload it
            below. You can answer the questions in any order, but every answer must be labeled so it can be matched
            back to its question.
          </p>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Questions ({questions.length}) · {paper.total_marks} marks
          </h2>
          <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
            {questions.map((q) => (
              <div key={q.question_id} className="border-b border-border-subtle pb-3 last:border-b-0">
                <span className="px-2.5 py-0.5 bg-surface-container-high text-primary rounded-full font-label-md text-label-md">
                  Q{q.question_order} · {q.max_marks} mark{q.max_marks === 1 ? '' : 's'}
                </span>
                <p className="text-body-md text-on-surface mt-2 whitespace-pre-wrap">{q.question_text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-3">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Upload your answer PDF</h2>
          {hasUploadedPdf && (
            <p className="text-label-md text-success-mastery flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {uploadedPdfName}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="file"
              accept="application/pdf"
              className="flex-1 rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-2 text-body-md"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            />
            <button
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold disabled:opacity-50 cursor-pointer"
              onClick={handleUploadPdf}
              disabled={!pdfFile || uploading}
            >
              {uploading ? 'Uploading…' : hasUploadedPdf ? 'Replace PDF' : 'Upload PDF'}
            </button>
          </div>
          {uploadError && <p className="text-error text-body-md">{uploadError}</p>}
        </div>

        <div className="flex justify-end">
          <button
            className="px-6 py-3 rounded-lg bg-primary text-on-primary font-bold disabled:opacity-50 cursor-pointer"
            onClick={handleSubmitPaper}
            disabled={submitting || !hasUploadedPdf}
          >
            {submitting ? 'Submitting…' : 'Submit Paper'}
          </button>
        </div>
        {submitError && <p className="text-error text-body-md text-right">{submitError}</p>}
      </div>
    </main>
  );
};

export default SamplePaperAttempt;
