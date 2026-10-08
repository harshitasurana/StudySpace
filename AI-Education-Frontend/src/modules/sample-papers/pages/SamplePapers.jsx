import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import ComingSoonPage from '../../../shared/ComingSoonPage';
import useSelfStudentMode from '../../../hooks/useSelfStudentMode';

const PAPER_TYPE_LABELS = {
  major_test: 'Major Test',
  semi_major: 'Semi Major',
};

const SamplePapers = () => {
  const navigate = useNavigate();
  const { isSelfStudent, modeLoading } = useSelfStudentMode();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [papers, setPapers] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (modeLoading || !isSelfStudent) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getMyProfile();
        if (cancelled) return;
        const profileSubjects = (res?.data?.subjects || []).map((s) => ({ id: s.subject_id, label: s.name }));
        setSubjects(profileSubjects);
        if (profileSubjects.length > 0) setSelectedSubjectId(profileSubjects[0].id);
      } catch {
        if (!cancelled) setError("Couldn't load your subjects. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => { cancelled = true; };
  }, [modeLoading, isSelfStudent]);

  useEffect(() => {
    if (!selectedSubjectId) return;
    let cancelled = false;
    (async () => {
      setLoadingPapers(true);
      try {
        const res = await EducationService.listSamplePapers(selectedSubjectId);
        if (!cancelled) setPapers(res?.data || []);
      } catch {
        if (!cancelled) setError("Couldn't load sample papers for this subject.");
      } finally {
        if (!cancelled) setLoadingPapers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSubjectId]);

  if (modeLoading) {
    return (
      <main className="flex-grow flex items-center justify-center py-16 bg-surface-bright min-h-[calc(100vh-72px)]">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </main>
    );
  }

  if (!isSelfStudent) {
    return (
      <ComingSoonPage
        icon="fact_check"
        title="Sample Papers"
        description="Sample Papers for your account type is coming soon."
      />
    );
  }

  return (
    <main className="flex-grow py-stack-lg px-2 sm:px-3 bg-surface-bright min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-stack-md">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Sample Papers</h1>
            <p className="text-body-lg text-on-surface-variant">
              Real exam papers, graded by AI — a score estimate, not a guaranteed final result.
            </p>
          </div>
        </div>

        {/* Snap & Solve AI Hero Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary-container p-6 text-on-primary shadow-md">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-on-primary/15 text-on-primary uppercase tracking-wide">
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                AI Vision + RAG Powered
              </span>
              <h2 className="text-headline-sm font-headline-sm text-on-primary">Snap & Solve Question Papers</h2>
              <p className="text-body-md text-on-primary/90">
                Upload a photo or PDF of any question paper. Our AI Vision extracts questions, generates grounded step-by-step solutions, and lets you ask follow-up questions interactively.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/ai-tutor/chat?snap=true')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-on-primary text-primary font-bold text-body-md hover:bg-on-primary/90 transition-all cursor-pointer shadow-sm shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              Snap & Solve Now
            </button>
          </div>
        </div>


        {loadingMeta ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          </div>
        ) : error ? (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">{error}</div>
        ) : (
          <>
            <select
              className="rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-2 text-body-md max-w-xs"
              value={selectedSubjectId || ''}
              onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>

            {loadingPapers ? (
              <div className="flex justify-center py-16">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
              </div>
            ) : papers.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center text-on-surface-variant">
                No sample papers published for this subject yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {papers.map((paper) => (
                  <div key={paper.sample_paper_id} className="glass-card rounded-xl p-6 flex flex-col gap-3">
                    <div>
                      <span className="font-label-md text-label-md px-3 py-1 rounded-full bg-surface-container text-primary">
                        {PAPER_TYPE_LABELS[paper.paper_type] || paper.paper_type}
                      </span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface mt-2">{paper.title}</h3>
                      <p className="text-label-md text-on-surface-variant mt-1">
                        {paper.total_marks ? `${paper.total_marks} marks` : ''}
                        {paper.duration_minutes ? ` · ${paper.duration_minutes} min` : ''}
                      </p>
                    </div>
                    <button
                      className="mt-auto bg-primary text-on-primary py-2.5 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
                      onClick={() => navigate(`/sample-papers/${paper.sample_paper_id}`)}
                    >
                      Start
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default SamplePapers;
