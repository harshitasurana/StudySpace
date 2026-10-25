import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import useGenerationPolling from '../../../hooks/useGenerationPolling';

const FlipCard = ({ card, flipped, onFlip }) => (
  <div className="w-full max-w-lg mx-auto" style={{ perspective: '1500px' }}>
    <div
      onClick={onFlip}
      className="relative w-full h-72 cursor-pointer transition-transform duration-500 ease-in-out"
      style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
    >
      <div
        className="absolute inset-0 glass-card rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3"
        style={{ backfaceVisibility: 'hidden' }}
      >
        <span className="text-label-md text-on-surface-variant uppercase tracking-wide">Term</span>
        <p className="font-headline-md text-headline-md text-on-surface">{card.front}</p>
        <span className="text-label-md text-outline mt-2">Tap to flip</span>
      </div>
      <div
        className="absolute inset-0 glass-card rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-primary/5"
        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
      >
        <span className="text-label-md text-primary uppercase tracking-wide">Explanation</span>
        <p className="text-body-lg text-on-surface">{card.back}</p>
      </div>
    </div>
  </div>
);

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const Flashcards = () => {
  const { chapterId: routeChapterId } = useParams();
  const [searchParams] = useSearchParams();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(routeChapterId ? Number(routeChapterId) : null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [chapterName, setChapterName] = useState('');
  const [cards, setCards] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const [stillLearning, setStillLearning] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  // Set while a flashcard set is generating in the background (Celery,
  // via RAGProductionApp) — the education_flashcard_sets row already
  // exists before this is set, so it survives navigating away and back.
  // See Quiz.jsx's own copy of this pattern for the full reasoning.
  const [generatingSetId, setGeneratingSetId] = useState(null);
  const [cardError, setCardError] = useState('');
  const [bookmarkedCards, setBookmarkedCards] = useState(new Set());
  const [bookmarking, setBookmarking] = useState(false);

  const [pastSets, setPastSets] = useState([]);
  const [loadingPastSets, setLoadingPastSets] = useState(true);

  const loadPastSets = async () => {
    try {
      const res = await EducationService.listFlashcardSets();
      setPastSets(res?.data || []);
    } catch {
      // Non-critical.
    } finally {
      setLoadingPastSets(false);
    }
  };

  useEffect(() => {
    loadPastSets();
  }, []);

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

  const resetCardProgress = () => {
    setCurrentIndex(0);
    setFlipped(false);
    setKnown(new Set());
    setStillLearning(new Set());
    setBookmarkedCards(new Set());
  };

  // Fires once useGenerationPolling sees generation_status flip to
  // 'completed' — for both a fresh generation and a resumed one (see
  // resumeGenerating).
  const handleGenerationComplete = (res) => {
    const data = res?.data;
    setCards(data?.cards || []);
    setChapterName(data?.chapter_name || '');
    resetCardProgress();
    setGenerating(false);
    setGeneratingSetId(null);
    loadPastSets();
  };

  const handleGenerationFailed = (res) => {
    setCardError(res?.data?.error_message || "Couldn't generate flashcards right now. Please try again.");
    setGenerating(false);
    setGeneratingSetId(null);
    loadPastSets();
  };

  // Polls GET /api/flashcards/sets/:id/status while a generation job is
  // running — the job itself keeps going server-side (Celery, via
  // RAGProductionApp) even if this component unmounts; navigating back
  // here (or to a still-processing row in Past Sets, see
  // resumeGenerating) just resumes watching it, nothing is lost.
  useGenerationPolling({
    active: !!generatingSetId,
    checkStatus: () => EducationService.getFlashcardSetStatus(generatingSetId),
    isComplete: (res) => res?.data?.generation_status === 'completed',
    isFailed: (res) => res?.data?.generation_status === 'failed',
    onComplete: handleGenerationComplete,
    onFailed: handleGenerationFailed,
    intervalMs: 4000,
  });

  const startNewSet = async () => {
    if (!selectedChapterId) return;
    setGenerating(true);
    setCardError('');
    try {
      const res = await EducationService.generateFlashcards(selectedChapterId, 8);
      if (res?.data?.generation_status === 'failed') {
        setCardError("Couldn't generate flashcards right now. Please try again.");
        setGenerating(false);
        return;
      }
      // 'processing' — the set already exists server-side; hand off to
      // useGenerationPolling above rather than waiting here. `generating`
      // stays true (shows the waiting card below) until it resolves.
      setGeneratingSetId(res?.data?.set_id);
      loadPastSets();
    } catch (err) {
      setCardError("Couldn't generate flashcards right now. Please try again.");
      setGenerating(false);
    }
  };

  // Lets a student jump back into a set that's still generating, or
  // reload a completed one, from the "Past Sets" list below.
  const resumeGenerating = (setId) => {
    setCardError('');
    setGenerating(true);
    setGeneratingSetId(setId);
  };

  // Deep link from MyFlashcards.jsx ("view this one") — reopen that
  // specific set on load instead of landing on the chapter picker with
  // nothing shown.
  useEffect(() => {
    const requestedSetId = Number(searchParams.get('set'));
    if (Number.isInteger(requestedSetId) && requestedSetId > 0) resumeGenerating(requestedSetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopWatchingGeneration = () => {
    setGenerating(false);
    setGeneratingSetId(null);
  };

  const currentCard = cards?.[currentIndex];
  const isLastCard = cards && currentIndex === cards.length - 1;
  const isFinished = cards && currentIndex >= cards.length;

  const advance = () => {
    setFlipped(false);
    setCurrentIndex((i) => i + 1);
  };

  const markKnown = () => {
    setKnown((prev) => new Set(prev).add(currentIndex));
    setStillLearning((prev) => { const next = new Set(prev); next.delete(currentIndex); return next; });
    advance();
  };

  const markStillLearning = () => {
    setStillLearning((prev) => new Set(prev).add(currentIndex));
    setKnown((prev) => { const next = new Set(prev); next.delete(currentIndex); return next; });
    advance();
  };

  const resetPicker = () => {
    setCards(null);
    setCurrentIndex(0);
    setFlipped(false);
  };

  const handleBookmarkCard = async () => {
    if (!selectedChapterId || !currentCard || bookmarkedCards.has(currentIndex) || bookmarking) return;
    setBookmarking(true);
    try {
      await EducationService.createBookmark({
        chapterId: selectedChapterId,
        sourceType: 'flashcard',
        title: currentCard.front.slice(0, 100),
        content: `${currentCard.front}\n\n${currentCard.back}`,
      });
      setBookmarkedCards((prev) => new Set(prev).add(currentIndex));
    } catch {
      // Non-critical — leave the button enabled so the student can retry.
    } finally {
      setBookmarking(false);
    }
  };

  return (
    <main className="flex-grow py-6 px-2 sm:px-3 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        
        {/* Top Hero Banner - Revision Cards */}
        <div className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-50 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start gap-4 z-10 max-w-xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/25">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Revision Cards</h1>
              <p className="text-slate-500 font-medium text-sm md:text-base mt-1">
                Quick, focused cards for better revision.
              </p>
            </div>
          </div>

          <div className="relative w-80 h-36 shrink-0 flex items-center justify-between z-10">
            <div className="relative w-36 h-28 flex items-center justify-center">
              <div className="absolute top-0 right-2 w-24 h-24 bg-blue-100 rounded-2xl rotate-12 border border-blue-200/80 shadow-xs" />
              <div className="absolute top-1 right-6 w-24 h-24 bg-pink-100 rounded-2xl -rotate-6 border border-pink-200/80 shadow-xs" />
              <div className="absolute top-2 right-4 w-24 h-24 bg-amber-50 rounded-2xl border border-amber-200 shadow-md flex flex-col items-center justify-center p-2 text-center">
                <div className="w-8 h-8 rounded-full bg-amber-400 text-white flex items-center justify-center mb-1 shadow-xs">
                  <span className="material-symbols-outlined text-lg">lightbulb</span>
                </div>
                <span className="font-extrabold text-xs text-slate-800">Learn</span>
              </div>
            </div>

            <div className="text-right font-serif text-slate-600 text-sm leading-tight italic pr-2">
              Flip<br />
              Revise<br />
              Remember<br />
              Grow
            </div>
          </div>
        </div>

        {loadingMeta ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-amber-500">progress_activity</span>
          </div>
        ) : metaError ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-500 border border-slate-100">{metaError}</div>
        ) : generatingSetId ? (
          <div className="bg-white rounded-3xl p-8 text-center space-y-4 border border-slate-100 shadow-xs">
            <span className="material-symbols-outlined animate-spin text-5xl text-amber-500">progress_activity</span>
            <h2 className="text-xl font-bold text-slate-900">Generating your flashcards…</h2>
            <p className="text-slate-500 text-sm">
              Feel free to browse elsewhere — it'll keep generating and show up under "Past Sets" the moment it's
              ready.
            </p>
            <button
              className="border border-amber-500 text-amber-600 px-6 py-2.5 rounded-xl font-bold hover:bg-amber-50 transition-all cursor-pointer text-sm"
              onClick={stopWatchingGeneration}
            >
              Back
            </button>
          </div>
        ) : !cards ? (
          <>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-5 space-y-1">
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
              <div className="md:col-span-7 space-y-1">
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
            </div>
            {cardError && <p className="text-red-600 text-sm font-medium">{cardError}</p>}
            <button
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              onClick={startNewSet}
              disabled={generating || !selectedChapterId}
            >
              {generating ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  Generating Revision Cards…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Generate Revision Cards →
                </>
              )}
            </button>
          </div>

          {!loadingPastSets && pastSets.length > 0 && (
            <div className="glass-card rounded-xl p-6 space-y-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Past Sets</h2>
              <div className="divide-y divide-border-subtle">
                {pastSets.slice(0, 10).map((s) =>
                  s.generation_status === 'processing' ? (
                    <button
                      key={s.set_id}
                      onClick={() => resumeGenerating(s.set_id)}
                      className="w-full flex justify-between items-center py-3 text-left cursor-pointer hover:bg-surface-container-low rounded-lg px-2 -mx-2"
                    >
                      <div>
                        <p className="font-bold text-on-surface">{s.chapter_name}</p>
                        <p className="text-label-md text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                          Generating…
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                    </button>
                  ) : s.generation_status === 'failed' ? (
                    <div key={s.set_id} className="flex justify-between items-center py-3">
                      <div>
                        <p className="font-bold text-on-surface">{s.chapter_name}</p>
                        <p className="text-label-md text-error">Generation failed</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      key={s.set_id}
                      onClick={() => resumeGenerating(s.set_id)}
                      className="w-full flex justify-between items-center py-3 text-left cursor-pointer hover:bg-surface-container-low rounded-lg px-2 -mx-2"
                    >
                      <div>
                        <p className="font-bold text-on-surface">{s.chapter_name}</p>
                        <p className="text-label-md text-on-surface-variant">
                          {s.subject_name} · {formatDate(s.created_at)} · {s.num_cards} cards
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}
          </>
        ) : isFinished ? (
          <div className="glass-card rounded-xl p-8 text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-primary">emoji_events</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Set Complete!</h2>
            <p className="text-body-lg text-on-surface-variant">
              <span className="font-bold text-primary">{known.size}</span> known · <span className="font-bold text-on-surface">{stillLearning.size}</span> still learning, out of {cards.length}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
                onClick={startNewSet}
              >
                New Set
              </button>
              <button
                className="border border-primary text-primary px-6 py-3 rounded-lg font-bold hover:bg-primary hover:text-on-primary transition-all cursor-pointer"
                onClick={resetPicker}
              >
                Choose Another Chapter
              </button>
            </div>
          </div>
        ) : currentCard ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-surface-container-high text-primary rounded-full font-label-md text-label-md">
                {chapterName} · Card {currentIndex + 1} of {cards.length}
              </span>
              <div className="flex items-center gap-3 text-label-md text-on-surface-variant">
                <span className="text-success-mastery font-bold">{known.size} known</span>
                <span>{stillLearning.size} learning</span>
                <button
                  onClick={handleBookmarkCard}
                  disabled={bookmarking || bookmarkedCards.has(currentIndex)}
                  title="Bookmark this flashcard"
                  className="cursor-pointer disabled:cursor-default"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    {bookmarkedCards.has(currentIndex) ? 'bookmark' : 'bookmark_border'}
                  </span>
                </button>
              </div>
            </div>

            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${(currentIndex / cards.length) * 100}%` }}
              ></div>
            </div>

            <FlipCard card={currentCard} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />

            <div className="flex gap-3 justify-center">
              <button
                className="flex items-center gap-2 border border-error text-error px-6 py-3 rounded-lg font-bold hover:bg-error hover:text-white transition-all cursor-pointer"
                onClick={markStillLearning}
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Still Learning
              </button>
              <button
                className="flex items-center gap-2 bg-success-mastery text-white px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
                onClick={markKnown}
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                I Know This
              </button>
            </div>
            {isLastCard && <p className="text-center text-label-md text-on-surface-variant">Last card in this set.</p>}
          </div>
        ) : null}
      </div>
    </main>
  );
};

export default Flashcards;
