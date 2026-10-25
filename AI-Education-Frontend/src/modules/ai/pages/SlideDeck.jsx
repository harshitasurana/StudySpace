import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import { navigateToCitation, citationPageLabel } from '../shared/citationNavigation';
import { exportSlideDeckToPdf } from '../shared/slideDeckPdfExport';
import { SlideVisual } from '../shared/slideVisuals';

// Type -> how a slide presents itself, using ONLY this app's existing
// Tailwind color tokens (confirmed exact hex values in tailwind.config.js
// — primary #283593, primary-dark #172554, accent #F4B942, success-
// mastery #16866A, secondary #3B82C4, focus-orange #E89B3C, risk-red
// #D95D5D, surface-bright #F8F7F2 — the platform's own real palette, no
// new colors introduced). label is the learning-question framing the
// spec asks for (e.g. "Why does this matter?"), not the raw type name.
const SLIDE_TYPE_META = {
  hook: { label: 'Why does this matter?', icon: 'psychology_alt', chip: 'bg-white/15 text-white' },
  concept: { label: "Here's the idea", icon: 'lightbulb', chip: 'bg-primary/10 text-primary' },
  diagram: { label: 'Look closely', icon: 'image', chip: 'bg-secondary/10 text-secondary' },
  worked_example: { label: "Let's solve one", icon: 'calculate', chip: 'bg-focus-orange/10 text-focus-orange' },
  question: { label: 'Your turn', icon: 'quiz', chip: 'bg-success-mastery/10 text-success-mastery' },
  recap: { label: 'What you should remember', icon: 'flag', chip: 'bg-white/15 text-white' },
};

// Full-bleed slide canvas treatment — hook (opening) and recap (closing)
// get a bold, title-slide-style colored background so the deck reads as
// an actual presentation with a real beginning/end, not a uniform stack
// of identical white cards; the four content slide types share a plain
// surface so the real content (diagrams, worked steps, questions) stays
// the visual focus.
const SLIDE_CANVAS_BG = {
  hook: 'bg-primary',
  concept: 'bg-white dark:bg-[#152238]',
  diagram: 'bg-white dark:bg-[#152238]',
  worked_example: 'bg-white dark:bg-[#152238]',
  question: 'bg-white dark:bg-[#152238]',
  recap: 'bg-primary-dark',
};
const SLIDE_ACCENT_BAR = {
  concept: 'bg-primary',
  diagram: 'bg-secondary',
  worked_example: 'bg-focus-orange',
  question: 'bg-success-mastery',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

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

// Progressive reveal — click-to-reveal-next over a short list
// (key_points/steps), per the product spec's explicit instruction to
// keep basic client-side reveal in Phase 1 (AI deciding WHAT to hide is
// deferred; this just reveals whatever list the deck already contains,
// one item at a time, instead of dumping it all at once).
//
// Gating is only worth it when there's a real reason for it: an
// `ordered` list (worked-example steps) always gates, at any length —
// walking through a process one step at a time genuinely helps.  An
// unordered list (concept/diagram key_points) only gates once there
// are 3+ items — hiding a 1- or 2-item list behind "Show next" is just
// hiding text with no teaching value, the exact "less useful" pattern
// called out in product feedback.
const RevealList = ({ items = [], revealedCount, onRevealNext, ordered, light }) => {
  const validItems = (items || []).filter(
    (item) => item && (typeof item !== 'string' || item.trim().length > 0)
  );
  if (validItems.length === 0) return null;

  const gated = ordered || validItems.length >= 3;
  const visibleCount = gated ? revealedCount : validItems.length;

  return (
    <div className="space-y-2.5">
      {validItems.slice(0, visibleCount).map((item, i) => (
        <div key={i} className="flex items-start gap-2.5 animate-fade-in">
          {ordered ? (
            <span className={`shrink-0 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center mt-0.5 ${light ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
              {i + 1}
            </span>
          ) : (
            <span className={`w-1.5 h-1.5 rounded-full bg-current mt-2 shrink-0 ${light ? 'text-white/70' : 'text-on-surface-variant'}`}></span>
          )}
          <p className={`text-body-md ${light ? 'text-white/95' : 'text-on-surface'}`}>{item}</p>
        </div>
      ))}
      {gated && visibleCount < validItems.length && (
        <button
          type="button"
          onClick={onRevealNext}
          className={`flex items-center gap-1 text-label-md font-semibold cursor-pointer mt-1 ${light ? 'text-white' : 'text-accent'}`}
        >
          <span className="material-symbols-outlined text-[16px]">expand_more</span>
          Show next ({validItems.length - visibleCount} more)
        </button>
      )}
    </div>
  );
};

// A slide's visual is either a real textbook figure (slide.image, from
// image_required/attach_slide_images) or a generated fallback diagram
// (slide.visual, see shared/slideVisuals.jsx) — never both shown at
// once, and a real figure always wins when both happen to be present.
// Returns null when the slide has neither, so callers can render it
// unconditionally and only switch to a two-column layout when it's
// non-null.
const renderVisualBlock = (slide, light) => {
  if (slide.image?.image_url) {
    return (
      <figure className="rounded-xl overflow-hidden border border-border-subtle bg-surface-container-lowest">
        <img
          src={slide.image.image_url}
          alt={slide.image.caption || slide.heading}
          className="w-full h-full max-h-80 object-contain"
          loading="lazy"
        />
        {slide.image.caption && (
          <figcaption className="px-3 py-2 text-label-md text-on-surface-variant bg-surface-container-low">{slide.image.caption}</figcaption>
        )}
      </figure>
    );
  }
  if (slide.visual && slide.visual.kind !== 'none') {
    return (
      <div className={`rounded-xl p-4 flex items-center justify-center ${light ? 'bg-white/5' : 'bg-surface-container-lowest border border-border-subtle'}`}>
        <SlideVisual visual={slide.visual} light={light} />
      </div>
    );
  }
  return null;
};

// Renders the type-specific body for the current slide — every other
// piece of chrome (heading, canvas background, progress, citation, nav)
// is shared and lives in the main component below. `light` is true only
// for hook/recap (the colored full-bleed slides) so text stays readable
// against a dark background.
const SlideBody = ({ slide, revealedCount, onRevealNext, selectedAnswer, onSelectAnswer, light }) => {
  const visualBlock = renderVisualBlock(slide, light);
  // When a visual is present, give it its own column on wider screens
  // instead of the visual sitting cramped above/below the text in a
  // mostly-empty slide — a real fix for the "tiny figure, huge white
  // space" complaint, not just a bigger max-height.
  const twoColumnClass = visualBlock ? 'sm:grid sm:grid-cols-2 sm:gap-6 sm:items-start' : '';

  switch (slide.type) {
    case 'hook':
      return <p className={`text-body-lg leading-relaxed ${light ? 'text-white/95' : 'text-on-surface'}`}>{slide.explanation}</p>;

    case 'concept':
      return (
        <div className={twoColumnClass}>
          {visualBlock && <div className="mb-4 sm:mb-0">{visualBlock}</div>}
          <div className="space-y-4">
            {slide.explanation && <p className="text-body-lg text-on-surface leading-relaxed">{slide.explanation}</p>}
            <RevealList items={slide.key_points || []} revealedCount={revealedCount} onRevealNext={onRevealNext} />
          </div>
        </div>
      );

    case 'diagram':
      return (
        <div className={twoColumnClass}>
          <div className="mb-4 sm:mb-0">
            {visualBlock || (
              <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-label-md text-on-surface-variant">
                No matching textbook figure was found for this slide.
              </div>
            )}
          </div>
          <div className="space-y-4">
            {slide.explanation && <p className="text-body-md text-on-surface leading-relaxed">{slide.explanation}</p>}
            <RevealList items={slide.key_points || []} revealedCount={revealedCount} onRevealNext={onRevealNext} />
          </div>
        </div>
      );

    case 'worked_example':
      return (
        <div className={twoColumnClass}>
          {visualBlock && <div className="mb-4 sm:mb-0">{visualBlock}</div>}
          <div className="space-y-4">
            {slide.explanation && <p className="text-body-md text-on-surface leading-relaxed">{slide.explanation}</p>}
            <RevealList items={slide.steps || []} revealedCount={revealedCount} onRevealNext={onRevealNext} ordered />
          </div>
        </div>
      );

    case 'question': {
      const options = slide.options || {};
      const answered = Boolean(selectedAnswer);
      const isCorrect = selectedAnswer === slide.correct_answer;
      return (
        <div className={twoColumnClass}>
          {visualBlock && <div className="mb-4 sm:mb-0">{visualBlock}</div>}
          <div className="space-y-4">
          <p className="text-body-lg text-on-surface leading-relaxed">{slide.question}</p>
          <div className="space-y-2">
            {['A', 'B', 'C', 'D'].filter((k) => options[k]).map((key) => {
              const isChosen = selectedAnswer === key;
              const isRight = key === slide.correct_answer;
              let style = 'border-border-subtle hover:bg-surface-container-low';
              if (answered && isRight) style = 'border-success-mastery bg-success-mastery/10';
              else if (answered && isChosen && !isRight) style = 'border-error bg-error/10';
              else if (isChosen) style = 'border-primary bg-primary/5';
              return (
                <button
                  key={key}
                  type="button"
                  disabled={answered}
                  onClick={() => onSelectAnswer(key)}
                  className={`w-full text-left rounded-lg border-2 px-4 py-2.5 text-body-md text-on-surface transition-colors cursor-pointer disabled:cursor-default flex items-center gap-3 ${style}`}
                >
                  <span className="shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center text-[11px] font-bold">{key}</span>
                  <span className="flex-1">{options[key]}</span>
                  {answered && isRight && <span className="material-symbols-outlined text-[18px] text-success-mastery">check_circle</span>}
                  {answered && isChosen && !isRight && <span className="material-symbols-outlined text-[18px] text-error">cancel</span>}
                </button>
              );
            })}
          </div>
          {answered && slide.explanation_after_answer && (
            <div className={`rounded-lg p-3 text-body-md animate-fade-in ${isCorrect ? 'bg-success-mastery/10 text-on-surface' : 'bg-focus-orange/10 text-on-surface'}`}>
              <p className="font-bold text-label-md mb-1 flex items-center gap-1.5">
                <span className={`material-symbols-outlined text-[16px] ${isCorrect ? 'text-success-mastery' : 'text-focus-orange'}`}>
                  {isCorrect ? 'check_circle' : 'info'}
                </span>
                {isCorrect ? 'Correct' : 'Not quite'}
              </p>
              {slide.explanation_after_answer}
            </div>
          )}
          </div>
        </div>
      );
    }

    case 'recap':
      return <RevealList items={slide.key_points || []} revealedCount={(slide.key_points || []).length} onRevealNext={() => {}} light={light} />;

    default:
      return null;
  }
};

const SlideDeck = () => {
  const { chapterId: routeChapterId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(routeChapterId ? Number(routeChapterId) : null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [deck, setDeck] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [pending, setPending] = useState(false);
  // Which deck this tab is tracking (several can now exist for the same
  // chapter — see the shared-pool migration). Seeded from ?deck=<id> when
  // arriving from MyLearningDecks.jsx's "view this one" link — passing it
  // straight through to every generate() call below is what makes that
  // link actually reopen the specific deck clicked, instead of the
  // shared pool's "give me an unseen one" logic silently substituting a
  // different (or brand new) deck. Also required by getSlideDeckStatus
  // while polling.
  const [slideDeckId, setSlideDeckId] = useState(() => {
    const fromUrl = Number(searchParams.get('deck'));
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : null;
  });
  const [deckError, setDeckError] = useState('');
  const [exporting, setExporting] = useState(false);
  // Shown on the picker screen (mirrors Flashcards.jsx's own "Past Sets"
  // section, and MindMap.jsx's "Past Mind Maps") so a student can jump
  // straight back into any deck they've generated before, across every
  // subject/chapter, without needing the separate My Learning Decks page.
  const [pastLearningDecks, setPastLearningDecks] = useState([]);
  const [loadingPastLearningDecks, setLoadingPastLearningDecks] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState('next');
  const [revealedCount, setRevealedCount] = useState(1);
  const [answers, setAnswers] = useState({}); // { [slideId]: 'A' }

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
  // deck's citations would point at the wrong chapter. Doesn't touch
  // slideDeckId on the very first run (mount) — that's what lets the
  // initial state above seed it from ?deck=<id> without this immediately
  // wiping it out; a genuine later chapter switch always clears it, since
  // a ?deck= id from the URL belongs to whichever chapter the page
  // originally loaded with.
  const isFirstChapterEffect = useRef(true);
  useEffect(() => {
    setDeck(null);
    setPending(false);
    setDeckError('');
    setCurrentIndex(0);
    setDirection('next');
    setRevealedCount(1);
    setAnswers({});
    if (isFirstChapterEffect.current) {
      isFirstChapterEffect.current = false;
    } else {
      setSlideDeckId(null);
    }
  }, [selectedChapterId]);

  // Deep link from MyLearningDecks.jsx ("view this one") — auto-load
  // instead of making the student click "Generate Learning Deck" again
  // for content that already exists.
  useEffect(() => {
    if (searchParams.get('deck') && selectedChapterId) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRevealedCount(1);
  }, [currentIndex]);

  const loadPastLearningDecks = useCallback(async () => {
    try {
      const res = await EducationService.listSlideDecks();
      setPastLearningDecks(res?.data || []);
    } catch {
      // Non-critical — the picker/generate flow works without this.
    } finally {
      setLoadingPastLearningDecks(false);
    }
  }, []);

  useEffect(() => {
    loadPastLearningDecks();
  }, [loadPastLearningDecks]);

  // Reopens a specific past deck directly from the picker screen — same
  // shared-pool-bypassing mechanism as arriving via ?deck=/&subject= from
  // MyLearningDecks.jsx (see generate()'s overrideDeckId/
  // overrideChapterId), just without a navigation round-trip since we're
  // already on this page. Also updates the picker dropdowns to match, so
  // they don't sit showing some other subject/chapter underneath.
  const openPastLearningDeck = (d) => {
    setSelectedSubjectId(d.subject_id);
    setSelectedChapterId(d.chapter_id);
    generate(d.slide_deck_id, d.chapter_id);
  };

  // overrideDeckId/overrideChapterId let a caller (Past Learning Decks
  // below) reopen a SPECIFIC past deck — for a chapter that may not be
  // the currently-selected one — in one call, passing both straight to
  // the API rather than through state, since a just-called setState
  // wouldn't be visible to this same function invocation yet.
  const generate = useCallback(async (overrideDeckId, overrideChapterId) => {
    const chapterId = overrideChapterId ?? selectedChapterId;
    if (!chapterId) return;
    setGenerating(true);
    setDeckError('');
    try {
      // Passing the currently-tracked slideDeckId (once set, whether
      // seeded from ?deck= or from an earlier call this session) is what
      // keeps the retry-after-poll-completes call below pinned to the
      // SAME deck, instead of the shared pool's "give me an unseen one"
      // logic reshuffling to a different one mid-session.
      const res = await EducationService.generateSlideDeck(chapterId, overrideDeckId ?? slideDeckId);
      const data = res?.data;
      if (data?.slide_deck_id) setSlideDeckId(data.slide_deck_id);
      if (data?.status === 'completed') {
        setDeck(data);
        setPending(false);
        setCurrentIndex(0);
        setDirection('next');
        setRevealedCount(1);
        setAnswers({});
        loadPastLearningDecks();
      } else {
        // Not an error — generation is already running (this student's
        // own first-ever request for the chapter, or a retry after a
        // transient failure). The polling effect below picks it up once
        // it completes and fetches the real deck automatically.
        setPending(true);
      }
    } catch (err) {
      setDeckError("Couldn't generate a learning deck right now. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [selectedChapterId, slideDeckId, loadPastLearningDecks]);

  // Poll while generation is still running — mirrors MindMap.jsx's own
  // polling exactly, including its most important lesson: deliberately
  // no "give up" branch on a failed status. The backend self-heals a
  // transiently failed row (see slide_deck_service.js's
  // recoverStuckSlideDeck) purely by being polled again after it's gone
  // stale — a tab that stopped polling on "failed" would never see that
  // recovery happen.
  useEffect(() => {
    if (!selectedChapterId || !pending || !slideDeckId) return undefined;
    const interval = setInterval(async () => {
      try {
        const res = await EducationService.getSlideDeckStatus(selectedChapterId, slideDeckId);
        if (res?.data?.status === 'completed') {
          setPending(false);
          generate();
        }
      } catch {
        // Transient poll failure — try again next tick.
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [selectedChapterId, slideDeckId, pending, generate]);

  const slides = deck?.slides || [];
  const currentSlide = slides[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === slides.length - 1;

  const goTo = (index) => {
    setDirection(index >= currentIndex ? 'next' : 'prev');
    setCurrentIndex(index);
  };
  const goNext = () => goTo(Math.min(currentIndex + 1, slides.length - 1));
  const goPrev = () => goTo(Math.max(currentIndex - 1, 0));

  const selectAnswer = (letter) => {
    if (!currentSlide) return;
    setAnswers((prev) => (prev[currentSlide.id] ? prev : { ...prev, [currentSlide.id]: letter }));
  };

  const revealNext = () => setRevealedCount((c) => c + 1);

  const resetPicker = () => setDeck(null);

  const handleExportPdf = async () => {
    if (!deck || exporting) return;
    setExporting(true);
    setDeckError('');
    try {
      await exportSlideDeckToPdf(deck, deck.chapter_name);
    } catch {
      setDeckError("Couldn't export this deck to PDF right now. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const meta = currentSlide ? SLIDE_TYPE_META[currentSlide.type] || SLIDE_TYPE_META.concept : null;
  const isLightCanvas = currentSlide?.type === 'hook' || currentSlide?.type === 'recap';
  const canvasBg = currentSlide ? SLIDE_CANVAS_BG[currentSlide.type] || 'bg-white' : '';
  const accentBar = currentSlide ? SLIDE_ACCENT_BAR[currentSlide.type] : null;

  // Scoped to the currently-picked chapter — showing every subject's
  // past decks here (matching Flashcards.jsx's cross-chapter "Past Sets")
  // was confusing right under a chapter-specific picker/Generate button,
  // so this list is deliberately narrower than pastLearningDecks.
  const chapterPastLearningDecks = pastLearningDecks.filter((d) => d.chapter_id === selectedChapterId);

  return (
    <main className="flex-grow py-6 px-3 sm:px-6 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        
        {/* Top Hero Banner - Interactive Lesson */}
        <div className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-pink-50 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start gap-4 z-10 max-w-xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/25">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Interactive Lesson</h1>
              <p className="text-slate-500 font-medium text-sm md:text-base mt-1">
                An AI-powered, visual walkthrough of the chapter.
              </p>
            </div>
          </div>

          <div className="relative w-80 h-36 shrink-0 flex items-center justify-between z-10">
            <div className="relative w-36 h-28 flex items-center justify-center">
              <div className="w-32 h-20 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 rounded-2xl shadow-md p-2 text-white flex flex-col justify-between transform -rotate-3">
                <div className="flex justify-between items-center">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                  </div>
                  <span className="text-[10px] font-extrabold bg-white/30 px-2 py-0.5 rounded-full">3D Slides</span>
                </div>
                <div className="w-full h-2 bg-white/30 rounded-full" />
              </div>
            </div>

            <div className="text-right font-serif text-slate-600 text-sm leading-tight italic pr-2">
              Learn<br />
              Step-by-Step<br />
              With Visuals
            </div>
          </div>
        </div>

        {loadingMeta ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-rose-500">progress_activity</span>
          </div>
        ) : metaError ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-500 border border-slate-100">{metaError}</div>
        ) : !deck ? (
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
            {deckError && <p className="text-red-600 text-sm font-medium">{deckError}</p>}
            {pending ? (
              <div className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-slate-500 bg-rose-50/50 rounded-xl border border-rose-100">
                <span className="material-symbols-outlined animate-spin text-xl text-rose-500">progress_activity</span>
                Generating your learning deck — this can take a minute the first time. It'll appear automatically.
              </div>
            ) : (
              <button
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                onClick={() => generate()}
                disabled={generating || !selectedChapterId}
              >
                {generating ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    Generating Interactive Lesson…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Generate Interactive Lesson →
                  </>
                )}
              </button>
            )}
          </div>
        ) : null}

        {!deck && !loadingPastLearningDecks && chapterPastLearningDecks.length > 0 && (
          <div className="glass-card rounded-xl p-6 space-y-3">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Past Learning Decks for This Chapter</h2>
            <div className="divide-y divide-border-subtle">
              {chapterPastLearningDecks.slice(0, 10).map((d, idx) =>
                d.status === 'processing' || d.status === 'pending' ? (
                  <button
                    key={d.slide_deck_id}
                    onClick={() => openPastLearningDeck(d)}
                    className="w-full flex justify-between items-center py-3 text-left cursor-pointer hover:bg-surface-container-low rounded-lg px-2 -mx-2"
                  >
                    <p className="text-label-md text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                      Generating… ({formatDate(d.created_at)})
                    </p>
                    <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                  </button>
                ) : d.status === 'failed' ? (
                  <div key={d.slide_deck_id} className="flex justify-between items-center py-3">
                    <p className="text-label-md text-error">Generation failed ({formatDate(d.created_at)})</p>
                  </div>
                ) : (
                  <button
                    key={d.slide_deck_id}
                    onClick={() => openPastLearningDeck(d)}
                    className="w-full flex justify-between items-center py-3 text-left cursor-pointer hover:bg-surface-container-low rounded-lg px-2 -mx-2"
                  >
                    <p className="font-bold text-on-surface">
                      Version {chapterPastLearningDecks.length - idx} · {formatDate(d.created_at)}
                    </p>
                    <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {deck && currentSlide ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-label-md text-on-surface-variant">Slide {currentIndex + 1} of {slides.length}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/ai-tutor/chat?subject=${selectedSubjectId}&chapter=${selectedChapterId}&topic=${encodeURIComponent(
                        currentSlide?.heading || ''
                      )}`
                    )
                  }
                  className="flex items-center gap-1.5 text-label-md font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-3.5 py-1.5 hover:bg-primary hover:text-on-primary transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                  <span>Ask AI about this slide</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="flex items-center gap-1.5 text-label-md font-semibold text-primary border border-primary rounded-full px-3 py-1.5 hover:bg-primary hover:text-on-primary transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-default"
                >
                  <span className={`material-symbols-outlined text-[16px] ${exporting ? 'animate-spin' : ''}`}>
                    {exporting ? 'progress_activity' : 'download'}
                  </span>
                  {exporting ? 'Preparing PDF…' : 'Download PDF'}
                </button>
              </div>
            </div>

            {/* The real presentation canvas — fixed 16:9 aspect ratio, a
                type-specific background so the deck actually looks and
                feels like slides (a bold opening/closing slide, a plain
                surface for content slides), and a direction-aware
                entrance animation on every navigation so moving between
                slides feels like an actual transition, not a content
                swap. Keyed by slide id so React remounts the canvas
                (and therefore replays the animation) on every move. */}
            <div
              key={currentSlide.id}
              className={`relative w-full aspect-video rounded-2xl shadow-lg overflow-hidden flex flex-col ${canvasBg} ${direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
            >
              {accentBar && <div className={`h-1.5 w-full shrink-0 ${accentBar}`} />}
              {/* Hook/recap are the deck's title/closing slides — centered
                  content plus a large faded watermark icon so the bold
                  color canvas reads as an intentional design choice
                  instead of a mostly-empty card. */}
              {isLightCanvas && (
                <span
                  className="material-symbols-outlined absolute -right-8 -bottom-10 text-white/10 pointer-events-none select-none"
                  style={{ fontSize: '240px' }}
                  aria-hidden="true"
                >
                  {meta.icon}
                </span>
              )}
              <div
                className={`relative flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 sm:p-10 flex flex-col gap-4 ${isLightCanvas ? 'justify-center items-center text-center' : ''}`}
              >
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-md text-label-md ${meta.chip} ${isLightCanvas ? '' : 'self-start'}`}>
                  <span className="material-symbols-outlined text-[16px]">{meta.icon}</span>
                  {meta.label}
                </span>

                <div className={isLightCanvas ? 'max-w-xl' : ''}>
                  <h2 className={`font-headline-md text-headline-md leading-tight ${isLightCanvas ? 'text-white text-headline-lg' : 'text-primary-dark'}`}>
                    {currentSlide.heading}
                  </h2>
                  {currentSlide.subheading && (
                    <p className={`text-body-md mt-1 ${isLightCanvas ? 'text-white/80' : 'text-on-surface-variant'}`}>{currentSlide.subheading}</p>
                  )}
                </div>

                <div className={isLightCanvas ? 'w-full max-w-xl' : 'w-full'}>
                  <SlideBody
                    slide={currentSlide}
                    revealedCount={revealedCount}
                    onRevealNext={revealNext}
                    selectedAnswer={answers[currentSlide.id]}
                    onSelectAnswer={selectAnswer}
                    light={isLightCanvas}
                  />
                </div>

                <div className={`pt-2 w-full max-w-xl ${isLightCanvas ? '' : 'mt-auto'}`}>
                  {currentSlide.type !== 'recap' && (
                    <CitationLink citation={currentSlide.citation} navigate={navigate} chapterId={selectedChapterId} light={isLightCanvas} />
                  )}

                  {currentSlide.type === 'recap' && (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => selectedChapterId && navigate(`/pre-assessment/${selectedChapterId}`)}
                        className="flex items-center gap-1.5 bg-white text-primary-dark px-4 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">quiz</span>
                        Practice This Chapter
                      </button>
                      <button
                        type="button"
                        onClick={resetPicker}
                        className="flex items-center gap-1.5 border border-white text-white px-4 py-2 rounded-lg font-bold hover:bg-white hover:text-primary-dark transition-all cursor-pointer"
                      >
                        Choose Another Chapter
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {deckError && <p className="text-error text-body-md">{deckError}</p>}

            {/* Progress — a dot per slide, per the spec's "Slide X of Y" /
                dots mockup. Current slide filled solid, completed slides
                (already visited) shown lighter. */}
            <div className="flex gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-1.5 flex-1 rounded-full transition-colors cursor-pointer ${
                    i === currentIndex ? 'bg-primary' : i < currentIndex ? 'bg-primary/40' : 'bg-surface-container'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goPrev}
                disabled={isFirst}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-body-md text-on-surface-variant hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-default cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                Previous
              </button>
              {!isLast && (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex items-center gap-1 bg-primary text-on-primary px-5 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Next slide
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
};

export default SlideDeck;
