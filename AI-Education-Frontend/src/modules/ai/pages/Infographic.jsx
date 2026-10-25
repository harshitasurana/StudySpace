import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import { navigateToCitation, citationPageLabel } from '../shared/citationNavigation';
import { SlideVisual } from '../shared/slideVisuals';

// Only this app's existing real Tailwind tokens — same rule already
// applied to Slide Deck/Mind Map (primary #283593, primary-dark
// #172554, accent #F4B942, error/risk-red #D95D5D, focus-orange
// #E89B3C, info/secondary #3B82C4, success/success-mastery #16866A).

const CitationLink = ({ citation, navigate, chapterId, light }) => {
  if (!citation) return null;
  return (
    <button
      type="button"
      onClick={() => navigateToCitation(navigate, chapterId, citation)}
      className={`flex items-center gap-1.5 text-label-md underline cursor-pointer ${light ? 'text-white/90 hover:text-white' : 'text-primary'}`}
    >
      <span className="material-symbols-outlined text-[14px]">menu_book</span>
      Source: {citation.chapter || 'chapter'}{citationPageLabel(citation)}
    </button>
  );
};

const Infographic = () => {
  const { chapterId: routeChapterId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(routeChapterId ? Number(routeChapterId) : null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [infographic, setInfographic] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [pending, setPending] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getMyProfile();
        if (cancelled) return;
        const profileSubjects = (res?.data?.subjects || []).map((s) => ({ id: s.subject_id, label: s.name }));
        setSubjects(profileSubjects);
        const requestedSubject = Number(searchParams.get('subject'));
        const initialSubject = profileSubjects.find((s) => s.id === requestedSubject) || profileSubjects[0];
        if (initialSubject) setSelectedSubjectId(initialSubject.id);
      } catch {
        if (!cancelled) setMetaError("Couldn't load your subjects. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const stillValid = selectedChapterId && list.some((c) => c.chapter_id === selectedChapterId);
        if (!stillValid) setSelectedChapterId(list.length > 0 ? list[0].chapter_id : null);
      } catch {
        if (!cancelled) setMetaError("Couldn't load chapters for this subject.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId]);

  // Switching chapter/subject invalidates whatever's displayed — a stale
  // infographic's citations would point at the wrong chapter.
  useEffect(() => {
    setInfographic(null);
    setPending(false);
    setPageError('');
  }, [selectedChapterId]);

  const generate = useCallback(async () => {
    if (!selectedChapterId) return;
    setGenerating(true);
    setPageError('');
    try {
      const res = await EducationService.generateInfographic(selectedChapterId);
      const data = res?.data;
      if (data?.status === 'completed') {
        setInfographic(data);
        setPending(false);
      } else {
        // Not an error — generation is already running (this student's
        // own first-ever request for the chapter, or a retry after a
        // transient failure). The polling effect below picks it up once
        // it completes and fetches the real infographic automatically.
        setPending(true);
      }
    } catch (err) {
      setPageError("Couldn't generate an infographic right now. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [selectedChapterId]);

  // Poll while generation is still running — mirrors SlideDeck.jsx's own
  // polling exactly, including its most important lesson: deliberately
  // no "give up" branch on a failed status. The backend self-heals a
  // transiently failed row purely by being polled again after it's gone
  // stale — a tab that stopped polling on "failed" would never see that
  // recovery happen.
  useEffect(() => {
    if (!selectedChapterId || !pending) return undefined;
    const interval = setInterval(async () => {
      try {
        const res = await EducationService.getInfographicStatus(selectedChapterId);
        if (res?.data?.status === 'completed') {
          setPending(false);
          generate();
        }
      } catch {
        // Transient poll failure — try again next tick.
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [selectedChapterId, pending, generate]);

  const keyConcepts = infographic?.key_concepts || [];
  const formulas = infographic?.formulas || [];
  const definitions = infographic?.definitions || [];
  const commonMistakes = infographic?.common_mistakes || [];
  const examTips = infographic?.exam_tips || [];
  const quickRecap = infographic?.quick_recap || [];

  return (
    <main className="flex-grow py-6 px-3 sm:px-6 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        
        {/* Top Hero Banner - Visual Summary */}
        <div className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Background blur */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-purple-50 rounded-full blur-3xl pointer-events-none" />

          {/* Left Title Box */}
          <div className="flex items-start gap-4 z-10 max-w-xl">
            <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/25">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Visual Summary</h1>
              <p className="text-slate-500 font-medium text-sm md:text-base mt-1">
                A beautifully designed infographic for the whole chapter.
              </p>
            </div>
          </div>

          {/* Right 3D Infographic Board Graphic + Cursive Quote */}
          <div className="relative w-80 h-36 shrink-0 flex items-center justify-between z-10">
            {/* 3D Board Graphic */}
            <div className="relative w-36 h-28 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-purple-100 p-2.5 flex flex-col justify-between shadow-xs">
              <div className="flex gap-1 items-end h-10 border-b border-purple-200/60 pb-1">
                <div className="w-2.5 h-6 bg-purple-400 rounded-xs" />
                <div className="w-2.5 h-9 bg-indigo-500 rounded-xs" />
                <div className="w-2.5 h-4 bg-purple-300 rounded-xs" />
                <div className="w-2.5 h-7 bg-pink-400 rounded-xs" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent" />
                <span className="text-[9px] font-extrabold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">Visual</span>
              </div>
            </div>

            {/* Handwritten cursive quote text */}
            <div className="text-right font-serif text-slate-600 text-sm leading-tight italic pr-2">
              Key Ideas<br />
              In One Glance
            </div>
          </div>
        </div>

        {loadingMeta ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-purple-600">progress_activity</span>
          </div>
        ) : metaError ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-500 border border-slate-100">{metaError}</div>
        ) : !infographic ? (
          <div className="space-y-6">
            {/* Selection Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Select Subject */}
              <div className="md:col-span-4 space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Select Subject</label>
                <select
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  value={selectedSubjectId || ''}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Select Chapter / Topic */}
              <div className="md:col-span-5 space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Select Chapter / Topic</label>
                <select
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-60"
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

              {/* Generate Button */}
              <div className="md:col-span-3 flex items-end h-full pt-4 md:pt-5">
                <button
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  onClick={generate}
                  disabled={generating || !selectedChapterId}
                >
                  {generating ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      Generating…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Generate Visual Summary →
                    </>
                  )}
                </button>
              </div>
            </div>

            {pageError && <div className="p-3 bg-red-50 text-red-700 font-semibold text-sm rounded-xl border border-red-200">{pageError}</div>}

            {pending && (
              <div className="p-4 bg-purple-50 text-purple-700 rounded-2xl border border-purple-100 flex items-center justify-center gap-3 font-semibold text-sm">
                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                Generating your visual summary — this takes a moment. It will appear automatically!
              </div>
            )}

            {/* Recent Summaries Grid */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Your Recent Summaries</h2>
                <span className="text-indigo-600 font-bold text-xs md:text-sm hover:underline cursor-pointer">View All →</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {chapters.slice(0, 3).map((c, idx) => (
                  <div
                    key={c.chapter_id || idx}
                    onClick={() => {
                      setSelectedChapterId(c.chapter_id);
                      generate();
                    }}
                    className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                  >
                    {/* Mini infographic layout preview */}
                    <div className="w-full h-32 rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-3 flex flex-col justify-between mb-3 border border-slate-100">
                      <div className="flex gap-2 items-center">
                        <div className="w-3 h-3 rounded-full bg-purple-400" />
                        <div className="w-20 h-2 bg-purple-200 rounded-full" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 my-1">
                        <div className="h-8 bg-white/80 rounded-md p-1 flex items-center justify-center">
                          <div className="w-full h-1.5 bg-indigo-200 rounded-full" />
                        </div>
                        <div className="h-8 bg-white/80 rounded-md p-1 flex items-center justify-center">
                          <div className="w-full h-1.5 bg-pink-200 rounded-full" />
                        </div>
                      </div>
                      <div className="w-full h-2 bg-purple-200 rounded-full" />
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {c.name || `Chapter ${c.chapter_id}`}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {subjects.find((s) => s.id === selectedSubjectId)?.label || 'Subject'} • Chapter {c.chapter_order || idx + 1}
                      </p>
                      <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 font-semibold border-t border-slate-100">
                        <span>Sep {10 + idx}, 2026</span>
                        <span className="text-indigo-600 font-bold">Open →</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5" role="region" aria-label="Infographic">
            <div className="flex items-center justify-between gap-3">
              <span className="text-label-md text-on-surface-variant">{infographic.chapter_name}</span>
              <button
                type="button"
                onClick={() => setInfographic(null)}
                className="flex items-center gap-1.5 text-label-md font-semibold text-primary border border-primary rounded-full px-3 py-1.5 hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                New Infographic
              </button>
            </div>

            {/* Big Picture — same bold title-slide treatment as
                SlideDeck.jsx's "hook" slide canvas. */}
            <div className="relative rounded-2xl shadow-lg overflow-hidden bg-primary text-white p-6 sm:p-8">
              <span
                className="material-symbols-outlined absolute -right-8 -bottom-10 text-white/10 pointer-events-none select-none"
                style={{ fontSize: '220px' }}
                aria-hidden="true"
              >
                travel_explore
              </span>
              <p className="text-label-md font-bold uppercase tracking-wider text-white/70 mb-2">{infographic.chapter_title || infographic.chapter_name}</p>
              <p className="relative text-xl sm:text-headline-md font-headline-md max-w-2xl">{infographic.big_picture}</p>
            </div>

            {/* Key Concepts grid */}
            <div>
              <h2 className="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">lightbulb</span>
                Key Concepts
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {keyConcepts.map((concept, i) => (
                  <div key={i} className="glass-card rounded-xl p-4 space-y-2.5 border-t-4 border-primary">
                    <p className="font-bold text-body-lg text-on-surface">{concept.title}</p>
                    <p className="text-body-md text-on-surface-variant">{concept.summary}</p>
                    {concept.image ? (
                      <img
                        src={concept.image.image_url}
                        alt={concept.image.caption || concept.title}
                        className="w-full rounded-lg border border-border-subtle"
                      />
                    ) : (
                      <SlideVisual visual={concept.visual} />
                    )}
                    <CitationLink citation={concept.citation} navigate={navigate} chapterId={infographic.chapter_id} />
                  </div>
                ))}
              </div>
            </div>

            {formulas.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-info">functions</span>
                  Formulas
                </h2>
                <div className="glass-card rounded-xl divide-y divide-border-subtle">
                  {formulas.map((formula, i) => (
                    <div key={i} className="p-4 space-y-1.5">
                      <p className="font-bold text-body-md text-on-surface">{formula.name}</p>
                      <p className="font-mono text-body-lg text-info">{formula.expression}</p>
                      <p className="text-sm text-on-surface-variant">{formula.when_to_use}</p>
                      <CitationLink citation={formula.citation} navigate={navigate} chapterId={infographic.chapter_id} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {definitions.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-success">menu_book</span>
                  Key Definitions
                </h2>
                <div className="glass-card rounded-xl divide-y divide-border-subtle">
                  {definitions.map((def, i) => (
                    <div key={i} className="p-4 space-y-1.5">
                      <p className="font-bold text-body-md text-on-surface">{def.term}</p>
                      <p className="text-body-md text-on-surface-variant">{def.meaning}</p>
                      <CitationLink citation={def.citation} navigate={navigate} chapterId={infographic.chapter_id} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {commonMistakes.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-error">warning</span>
                  Common Mistakes
                </h2>
                <div className="space-y-2.5">
                  {commonMistakes.map((mistake, i) => (
                    <div key={i} className="glass-card rounded-xl p-4 border-l-4 border-error space-y-1.5">
                      <p className="text-body-md text-error font-semibold">✗ {mistake.mistake}</p>
                      <p className="text-body-md text-on-surface">✓ {mistake.correction}</p>
                      <CitationLink citation={mistake.citation} navigate={navigate} chapterId={infographic.chapter_id} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {examTips.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-focus-orange">flag</span>
                  Exam Tips
                </h2>
                <div className="glass-card rounded-xl p-4 space-y-2">
                  {examTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-focus-orange mt-0.5 shrink-0">check_circle</span>
                      <p className="text-body-md text-on-surface">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Recap — same closing-slide treatment as
                SlideDeck.jsx's "recap" slide canvas. */}
            <div className="relative rounded-2xl shadow-lg overflow-hidden bg-primary-dark text-white p-6 sm:p-8">
              <span
                className="material-symbols-outlined absolute -right-8 -bottom-10 text-white/10 pointer-events-none select-none"
                style={{ fontSize: '220px' }}
                aria-hidden="true"
              >
                flag
              </span>
              <p className="text-label-md font-bold uppercase tracking-wider text-white/70 mb-3">Quick Recap</p>
              <div className="relative space-y-2 max-w-2xl">
                {quickRecap.map((point, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70 mt-2 shrink-0" />
                    <p className="text-body-lg text-white/95">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Infographic;
