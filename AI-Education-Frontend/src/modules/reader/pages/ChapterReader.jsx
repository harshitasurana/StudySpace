import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import ReactMarkdown from 'react-markdown';
import EducationService from '../../../services/EducationService';
import { findRangeForText, renderHighlightOverlay, clearHighlightOverlay } from '../highlightDom';
import { useHelpDrawer } from '../../../context/HelpDrawerContext';
import { useFocusMode } from '../../../context/FocusModeContext';
import { useXpReward } from '../../../context/XpRewardContext';
import { saveStudySession } from '../../../utils/studySession';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const MAX_SELECTION_CHARS = 3900;

// No Tailwind typography plugin in this app — same explicit component
// styling approach as MyNotes.jsx's markdown rendering. Left without an
// explicit text color so it inherits the chat bubble's own color (user
// bubbles are white-on-gradient, assistant bubbles are on-surface).
const CHAT_MARKDOWN_COMPONENTS = {
  h2: ({ children }) => <h4 className="font-bold text-body-lg mt-3 mb-1 first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="font-bold text-body-md mt-2 mb-1">{children}</h5>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
};

const HIGHLIGHT_COLORS = [
  { id: 'yellow', hex: '#fef08a' },
  { id: 'green', hex: '#bbf7d0' },
  { id: 'blue', hex: '#bfdbfe' },
  { id: 'pink', hex: '#fbcfe8' },
  { id: 'orange', hex: '#fed7aa' },
];

// Notes and NCERT Solutions moved into the right-side "Up Next" panel
// (see UP_NEXT_ITEMS below) instead of being top tabs — Whiteboard/Read
// are the only ones still switched via this tab bar.
const VIEW_MODE_TABS = [
  { id: 'pdf', label: 'Read', icon: 'menu_book' },
  { id: 'whiteboard', label: 'Whiteboard', icon: 'draw' },
];

const BRUSH_COLORS = ['#002045', '#dc2626', '#16a34a', '#2563eb', '#f59e0b'];

const MIN_TUTOR_DRAWER_WIDTH = 340;
const DEFAULT_TUTOR_DRAWER_WIDTH = 460;
const TUTOR_STORAGE_KEY = 'eduai_tutor_drawer_width';

const getStoredTutorWidth = () => {
  if (typeof window === 'undefined') return DEFAULT_TUTOR_DRAWER_WIDTH;
  try {
    const saved = localStorage.getItem(TUTOR_STORAGE_KEY);
    if (!saved) return DEFAULT_TUTOR_DRAWER_WIDTH;
    const parsed = parseInt(saved, 10);
    const max = Math.max(MIN_TUTOR_DRAWER_WIDTH, window.innerWidth - 60);
    return isNaN(parsed) ? DEFAULT_TUTOR_DRAWER_WIDTH : Math.min(Math.max(parsed, MIN_TUTOR_DRAWER_WIDTH), max);
  } catch {
    return DEFAULT_TUTOR_DRAWER_WIDTH;
  }
};

// Reading preferences (theme, zoom mode, page width %, reduced motion) —
// one JSON blob under one key, same "localStorage-backed reader pref"
// precedent as TUTOR_STORAGE_KEY above (previously the only one; theme/
// zoom didn't persist at all despite looking like they should). Read
// once at each state's useState initializer, written back via small
// useEffects keyed on each value below — simpler than threading
// persistence into every individual setter.
const READER_PREFS_KEY = 'eduai_reader_prefs';

const getStoredReaderPrefs = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(READER_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveReaderPrefs = (partial) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(READER_PREFS_KEY, JSON.stringify({ ...getStoredReaderPrefs(), ...partial }));
  } catch {
    // ignore localStorage errors (private browsing, quota, etc.)
  }
};

const getDefaultReducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const ChapterReader = () => {
  const { chapterId: chapterIdParam } = useParams();
  const chapterId = Number(chapterIdParam);
  const { awardXp } = useXpReward();
  const containerRef = useRef(null);
  const readerCardRef = useRef(null);
  const highlightOverlayRef = useRef(null);
  // Master copy of the fetched PDF bytes — NEVER passed directly to any
  // <Document>. pdf.js's loading task transfers a raw ArrayBuffer to its
  // worker (a real, documented behavior, not a bug), which detaches it in
  // the main thread — confirmed live: a second <Document> reading that
  // same (now-detached) buffer throws "Cannot perform Construct on a
  // detached ArrayBuffer" and crashes. `pdfData` state (the main reader)
  // and every Page Navigator thumbnail each get their own
  // ArrayBuffer.slice(0) — a real independent copy, not a view — cloned
  // from this ref, so one Document consuming/detaching its copy never
  // affects any other.
  const pdfBytesRef = useRef(null);
  // The real PDFDocumentProxy (react-pdf's <Document onLoadSuccess>) —
  // kept for Search's own getTextContent() calls; a ref, not state,
  // since nothing needs to re-render off this specific object.
  const pdfProxyRef = useRef(null);
  const searchOverlayRef = useRef(null);

  // Continuous mode's overlay + selection-container refs, one per
  // mounted page (Map, not a single ref, since more than one page can be
  // on screen at once). Single-page mode is deliberately left untouched —
  // it keeps using highlightOverlayRef/textLayerTick/containerRef exactly
  // as before, rather than unifying onto this Map, so the already-
  // verified single-page behavior can't regress.
  const multiOverlayRefs = useRef(new Map());
  const multiContainerRefs = useRef(new Map());
  const [multiRenderedPages, setMultiRenderedPages] = useState(() => new Set());
  const continuousScrollRef = useRef(null);

  const [searchParams] = useSearchParams();
  const deepLinkPage = useRef(searchParams.get('page'));
  // Set when a citation (Mind Map, AI Tutor) points into NCERT Notes or
  // Solutions rather than the raw chapter PDF — those are entirely
  // separate documents in this reader, with their own page numbering.
  // 'notes' | 'solutions' | null (the default raw-PDF ?page= behavior).
  const deepLinkView = useRef(searchParams.get('view'));

  const [chapterName, setChapterName] = useState('');
  const [chapterOrder, setChapterOrder] = useState(null);
  // Gates the "Up Next" NCERT Notes/Solutions cards — not every chapter
  // has these yet, so they only render once the chapter-meta fetch below
  // confirms real content exists, instead of always being clickable and
  // only failing after the student taps in.
  const [hasNcertNotes, setHasNcertNotes] = useState(false);
  const [hasNcertSolutions, setHasNcertSolutions] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reading progress + remember-last-position. studentProfileId is
  // resolved once in the chapter-load effect above (mirrors the
  // getMyProfile() → student_profile_id pattern other pages already use).
  // justResumedRef skips the very first debounced progress PUT that would
  // otherwise immediately re-save the position resume-from-last-position
  // itself just set — redundant, not harmful, but wasteful.
  const [studentProfileId, setStudentProfileId] = useState(null);
  const justResumedRef = useRef(false);

  // Page bookmarks — fetched lazily only once the Page Navigator is first
  // opened (same lazy convention as thumbnails/notes above), not on every
  // chapter visit.
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);

  const [toolbar, setToolbar] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [savingHighlight, setSavingHighlight] = useState(false);
  // A failed highlight save used to fail completely silently (bare
  // `catch {}`) — the optimistic overlay rendered in applyHighlight below
  // stayed on screen looking saved, then vanished on the next reload
  // since it was never actually persisted. This surfaces the failure
  // (auto-dismissing toast) and applyHighlight now also removes that
  // same optimistic overlay on failure so the screen stops lying about
  // what's actually saved.
  const [highlightError, setHighlightError] = useState('');
  const [textLayerTick, setTextLayerTick] = useState(0);
  const handleRenderTextLayerSuccess = useCallback(() => setTextLayerTick((t) => t + 1), []);

  // Context drawer integration for app-wide push & resize coordination
  const drawerCtx = useHelpDrawer();
  const isProvided = Boolean(drawerCtx?.isProvided);

  const { isFocusMode, setFocusMode } = useFocusMode();
  // Unconditional — if the student navigates away while focus mode is
  // on, this guarantees the app's chrome (Topbar/Sidebar/Footer) comes
  // back rather than staying hidden on whatever page they land on next.
  useEffect(() => () => setFocusMode(false), [setFocusMode]);

  const [askSliderOpen, setAskSliderOpen] = useState(false);
  const [tutorWidth, setTutorWidthState] = useState(getStoredTutorWidth);
  const [isTutorDragging, setIsTutorDraggingState] = useState(false);

  const updateTutorWidth = useCallback((w) => {
    setTutorWidthState(w);
    try {
      localStorage.setItem(TUTOR_STORAGE_KEY, String(Math.round(w)));
    } catch {}
    if (isProvided && drawerCtx.setHelpDrawerWidth) {
      drawerCtx.setHelpDrawerWidth(w);
    }
  }, [isProvided, drawerCtx]);

  const updateTutorDragging = useCallback((d) => {
    setIsTutorDraggingState(d);
    if (isProvided && drawerCtx.setIsHelpDragging) {
      drawerCtx.setIsHelpDragging(d);
    }
  }, [isProvided, drawerCtx]);

  const [askMessages, setAskMessages] = useState([]);
  const [askConversationId, setAskConversationId] = useState(null);
  const [askLoadingHistory, setAskLoadingHistory] = useState(false);
  const [askHistoryError, setAskHistoryError] = useState('');
  const [askInput, setAskInput] = useState('');
  const [askSending, setAskSending] = useState(false);
  const askScrollRef = useRef(null);
  const [noteForm, setNoteForm] = useState(null);

  // Interactive Reading Options State — theme/zoom-mode/manual-width/
  // page-width/reduced-motion are all persisted (see READER_PREFS_KEY
  // above); read once here, written back by the sync effects below.
  const [pdfScaleWidth, setPdfScaleWidth] = useState(() => getStoredReaderPrefs().pdfScaleWidth || 760); // manual zoom mode only
  const [readingTheme, setReadingTheme] = useState(() => getStoredReaderPrefs().readingTheme || 'light'); // 'light' | 'sepia' | 'dark'
  // 'fit-width' (real container-relative fit) | 'fit-page' (height-
  // constrained, single-page reading mode only) | 'manual' (the +/-
  // stepper, pdfScaleWidth above) — 'fit-width' is the default since it's
  // the closest to the old fixed-760px behavior most students already saw.
  const [zoomMode, setZoomMode] = useState(() => getStoredReaderPrefs().zoomMode || 'fit-width');
  // 'single' (existing behavior — one page, explicit nav) | 'continuous'
  // (virtualized scroll of all pages). Only meaningful in Read mode.
  const [readingMode, setReadingMode] = useState(() => getStoredReaderPrefs().readingMode || 'single');
  // Independent of zoomMode — multiplies whichever width zoomMode
  // computes, so it composes with fit-width/fit-page/manual rather than
  // being a fourth competing mode.
  const [pageWidthPercent, setPageWidthPercent] = useState(() => getStoredReaderPrefs().pageWidthPercent || 100);
  const [reducedMotion, setReducedMotion] = useState(() => {
    const stored = getStoredReaderPrefs().reducedMotion;
    return stored !== undefined ? stored : getDefaultReducedMotion();
  });
  // Real measured width of the reading container (for fit-width) and the
  // current page's aspect ratio + available viewport height (for
  // fit-page) — see the ResizeObserver/onLoadSuccess effects below.
  const [containerWidth, setContainerWidth] = useState(760);
  const [pageAspectRatio, setPageAspectRatio] = useState(null);
  const [availableHeight, setAvailableHeight] = useState(600);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(() => getStoredReaderPrefs().speechRate || 1);
  // Read fresh inside speakSentenceAt (not captured via closure at
  // .speak()-call time) so dragging the speed slider mid-read-aloud
  // takes effect starting the very next sentence, not only on a fresh
  // start.
  const speechRateRef = useRef(1);
  useEffect(() => { speechRateRef.current = speechRate; }, [speechRate]);
  useEffect(() => { saveReaderPrefs({ speechRate }); }, [speechRate]);
  const speechOverlayRef = useRef(null);
  const speechQueueRef = useRef([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageJumpInput, setPageJumpInput] = useState('');

  // View Mode + right-side Page Navigator (TOC)
  const [viewMode, setViewMode] = useState('pdf'); // 'pdf' | 'whiteboard' | 'notes' | 'ncert_solutions'
  const [tocOpen, setTocOpen] = useState(false);
  // Client-side search — no backend index exists (confirmed: neither
  // Node's topbar search nor FastAPI's /api/search covers real page
  // content), so this builds its own tiny index from pdf.js's own
  // getTextContent() the first time the panel is opened, cached per
  // chapterId in a ref (not state — the raw page-text array itself never
  // needs to trigger a render, only searchResults does).
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndexing, setSearchIndexing] = useState(false);
  const [searchIndexProgress, setSearchIndexProgress] = useState(0);
  const pageTextsRef = useRef(null); // string[] once built, else null
  const pageTextsChapterIdRef = useRef(null);
  // One independent ArrayBuffer clone per page, for the Page Navigator's
  // thumbnails — see pdfBytesRef above for why each needs its own copy
  // rather than sharing one buffer. Populated lazily the first time it's
  // actually opened, not on chapter load.
  const [thumbnailBuffers, setThumbnailBuffers] = useState([]);
  // How many thumbnails are allowed to actually mount their own
  // <Document> right now. Each <Document>
  // spawns its own real pdf.js Worker — confirmed live that mounting all
  // of them at once for a 15-page chapter exhausts the worker pool
  // ("Worker was destroyed" mid-load, every thumbnail stuck loading
  // forever, no error). Starts with a small batch; each thumbnail's own
  // completion (success or error) unlocks exactly one more, so there are
  // only ever a few real workers alive at a time — the same bounded-
  // concurrency approach real PDF viewers use for page-thumbnail panels.
  const [activeThumbCount, setActiveThumbCount] = useState(4);
  const unlockNextThumbnail = useCallback(() => setActiveThumbCount((c) => c + 1), []);

  // Notes & Highlights view — fetched lazily (only once the tab is first
  // opened, not on initial chapter load) since it's an extra real request
  // most visits to this page will never need. Highlights themselves are
  // already fetched unconditionally on mount for the re-apply effect
  // above, so this just adds real Notes alongside them.
  const [notes, setNotes] = useState([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);

  // NCERT Solutions & Notes — real PDFs (not AI-generated), same direct-
  // rendering approach as the main chapter PDF above. The structural
  // index (which exercise/question is on which page) is fetched
  // unconditionally on chapter load — cheap, and needed both for the
  // Read-mode contextual banner and the Solutions tab's Question Index,
  // neither of which depend on a tab actually being opened first. A
  // fetch failure (chapter has no NCERT resources yet — expected/normal
  // outside this Math Chapter 1 pilot) just leaves solutionsIndex null,
  // which every consumer already treats as "nothing to show here".
  const [solutionsIndex, setSolutionsIndex] = useState(null);

  // Each PDF gets its own ArrayBuffer master-copy ref — see pdfBytesRef
  // above for why (separate <Document> instances, separate detachment
  // risk) — and is fetched lazily only once its own tab is first opened.
  const ncertSolutionsBytesRef = useRef(null);
  const [ncertSolutionsPdfData, setNcertSolutionsPdfData] = useState(null);
  const [ncertSolutionsNumPages, setNcertSolutionsNumPages] = useState(null);
  const [ncertSolutionsLoading, setNcertSolutionsLoading] = useState(false);
  const [ncertSolutionsLoaded, setNcertSolutionsLoaded] = useState(false);
  const [ncertSolutionsStatus, setNcertSolutionsStatus] = useState(''); // '' | 'unavailable' | 'error'
  const [solutionsPageIndex, setSolutionsPageIndex] = useState(0);

  const ncertNotesBytesRef = useRef(null);
  const [ncertNotesPdfData, setNcertNotesPdfData] = useState(null);
  const [ncertNotesNumPages, setNcertNotesNumPages] = useState(null);
  const [ncertNotesLoading, setNcertNotesLoading] = useState(false);
  const [ncertNotesLoaded, setNcertNotesLoaded] = useState(false);
  const [ncertNotesStatus, setNcertNotesStatus] = useState(''); // '' | 'unavailable' | 'error'
  const [notesPageIndex, setNotesPageIndex] = useState(0);

  // Whiteboard / Scratchpad — plain HTML5 canvas, drawn to imperatively
  // (not via React state per stroke, which would re-render on every
  // pointer-move). Ephemeral: nothing here is persisted server-side, by
  // design — it's scratch space for sketching/working out a problem, not
  // a saved artifact; "download" is the only way to keep it.
  const whiteboardCanvasRef = useRef(null);
  const whiteboardDrawingRef = useRef(false);
  const whiteboardLastPointRef = useRef(null);
  const [brushColor, setBrushColor] = useState('#002045');
  const [brushSize, setBrushSize] = useState(4);
  const [isErasing, setIsErasing] = useState(false);

  // Manual zoom steps away from whichever auto-fit mode was active — same
  // "stepping away from fit resets to manual" UX as Acrobat/Google Docs.
  // Seeds pdfScaleWidth from the current effective width (not always 760)
  // so the first +/- click feels continuous instead of jumping back to a
  // fixed baseline.
  const handleZoomIn = () => {
    setZoomMode('manual');
    setPdfScaleWidth((prev) => Math.min((prev || containerWidth) + 120, 1200));
  };
  const handleZoomOut = () => {
    setZoomMode('manual');
    setPdfScaleWidth((prev) => Math.max((prev || containerWidth) - 120, 480));
  };

  // Sentence-by-sentence queue rather than one long utterance — lets the
  // currently-spoken sentence be highlighted (reusing the same
  // findRangeForText/renderHighlightOverlay primitives highlights/search
  // use, into speech's own overlay slot) and gives pause/resume/speed a
  // real per-sentence granularity. Known limitation, not silently hidden:
  // this regex-based sentence split will misfire on numbered lists/
  // equations (common in NCERT math content) — acceptable for v1.
  const clearSpeechOverlay = () => {
    if (speechOverlayRef.current) clearHighlightOverlay(speechOverlayRef.current, '.chapter-speech-overlay');
  };

  const speakSentenceAt = (idx) => {
    const sentences = speechQueueRef.current;
    if (idx >= sentences.length) {
      setIsSpeaking(false);
      setIsSpeechPaused(false);
      clearSpeechOverlay();
      return;
    }
    const sentence = sentences[idx];
    const utterance = new SpeechSynthesisUtterance(sentence.slice(0, 500));
    utterance.rate = speechRateRef.current;
    utterance.onstart = () => {
      const root = containerRef.current;
      if (root && speechOverlayRef.current) {
        clearSpeechOverlay();
        const range = findRangeForText(root, sentence);
        if (range) renderHighlightOverlay(speechOverlayRef.current, range, { className: 'chapter-speech-overlay' });
      }
    };
    utterance.onend = () => speakSentenceAt(idx + 1);
    utterance.onerror = () => speakSentenceAt(idx + 1);
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsSpeechPaused(false);
      clearSpeechOverlay();
      return;
    }
    const pageText = containerRef.current?.innerText || '';
    if (!pageText.trim()) return;
    const sentences = pageText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length === 0) return;
    speechQueueRef.current = sentences;
    setIsSpeaking(true);
    setIsSpeechPaused(false);
    speakSentenceAt(0);
  };

  const handleToggleSpeechPause = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !isSpeaking) return;
    if (isSpeechPaused) {
      window.speechSynthesis.resume();
      setIsSpeechPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsSpeechPaused(true);
    }
  };

  // Stops read-aloud on page navigation or unmount — otherwise it would
  // keep reading a page the student already left.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [pageIndex]);

  const toggleFullscreen = () => {
    if (!readerCardRef.current) return;
    if (!document.fullscreenElement) {
      readerCardRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handlePageJumpSubmit = (e) => {
    e.preventDefault();
    const p = parseInt(pageJumpInput, 10);
    if (!isNaN(p) && p >= 1 && p <= (numPages || 1)) {
      goToPage(p - 1);
      setPageJumpInput('');
    }
  };

  const jumpToPageAndClose = (idx) => {
    goToPage(idx);
    setViewMode('pdf');
    setTocOpen(false);
  };

  // Shared by the contextual "jump to solution" banner (Read mode), the
  // NCERT Solutions tab's own Question Index panel, and AI Tutor citation
  // chips — one navigation mechanism, three triggers.
  const jumpToSolutionPage = (page) => {
    setSolutionsPageIndex(page || 0);
    setViewMode('ncert_solutions');
    setTocOpen(false);
  };

  const jumpToNotesPage = (page) => {
    setNotesPageIndex(page || 0);
    setViewMode('notes');
    setTocOpen(false);
  };

  // --- Whiteboard drawing (imperative canvas 2D, not React state per stroke) ---
  const getCanvasPoint = (e) => {
    const canvas = whiteboardCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startWhiteboardStroke = (e) => {
    const canvas = whiteboardCanvasRef.current;
    if (!canvas) return;
    whiteboardDrawingRef.current = true;
    whiteboardLastPointRef.current = getCanvasPoint(e);
  };

  const continueWhiteboardStroke = (e) => {
    if (!whiteboardDrawingRef.current) return;
    const canvas = whiteboardCanvasRef.current;
    const last = whiteboardLastPointRef.current;
    if (!canvas || !last) return;
    const point = getCanvasPoint(e);
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = isErasing ? '#ffffff' : brushColor;
    ctx.lineWidth = isErasing ? brushSize * 4 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    whiteboardLastPointRef.current = point;
  };

  const endWhiteboardStroke = () => {
    whiteboardDrawingRef.current = false;
    whiteboardLastPointRef.current = null;
  };

  const clearWhiteboard = () => {
    const canvas = whiteboardCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  };

  const downloadWhiteboard = () => {
    const canvas = whiteboardCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${(chapterName || 'chapter').replace(/\s+/g, '_').toLowerCase()}_scratchpad.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  useEffect(() => {
    askScrollRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [askMessages, askSending, reducedMotion]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setThumbnailBuffers([]);
      setActiveThumbCount(4);
      setHasNcertNotes(false);
      setHasNcertSolutions(false);
      ncertSolutionsBytesRef.current = null;
      setNcertSolutionsPdfData(null);
      setNcertSolutionsLoaded(false);
      setNcertSolutionsStatus('');
      setSolutionsPageIndex(0);
      ncertNotesBytesRef.current = null;
      setNcertNotesPdfData(null);
      setNcertNotesLoaded(false);
      setNcertNotesStatus('');
      setNotesPageIndex(0);
      try {
        const [metaRes, pdfBytes, profileRes] = await Promise.all([
          EducationService.getChapterMeta(chapterId),
          EducationService.getChapterPdf(chapterId),
          // Resolved here (not lazily) since both remember-last-position
          // and progress tracking need it before the student starts
          // reading, not after — same data every other page that needs
          // its own student_profile_id already fetches this way
          // (Chapters.jsx's getMyProfile() → data.student_profile_id).
          EducationService.getMyProfile().catch(() => null),
        ]);
        if (cancelled) return;
        setChapterName(metaRes?.data?.chapter_name || '');
        setChapterOrder(metaRes?.data?.chapter_order || null);
        setHasNcertNotes(Boolean(metaRes?.data?.has_ncert_notes));
        setHasNcertSolutions(Boolean(metaRes?.data?.has_ncert_solutions));
        pdfBytesRef.current = pdfBytes;
        setPdfData(pdfBytes && pdfBytes.slice ? pdfBytes.slice(0) : pdfBytes);

        const profileId = profileRes?.data?.student_profile_id || null;
        setStudentProfileId(profileId);

        const requestedPage = deepLinkPage.current ? Number(deepLinkPage.current) : null;
        const requestedView = deepLinkView.current;
        deepLinkPage.current = null;
        deepLinkView.current = null;
        if (requestedView === 'notes') {
          // jumpToNotesPage/jumpToSolutionPage take a 0-indexed page
          // directly (no -1 adjustment, unlike the raw-PDF branch below)
          // — matches citation.page's own 0-indexed convention exactly,
          // and how AI Tutor's in-process citation chips already call
          // these same functions.
          jumpToNotesPage(Number.isFinite(requestedPage) ? requestedPage : 0);
        } else if (requestedView === 'solutions') {
          jumpToSolutionPage(Number.isFinite(requestedPage) ? requestedPage : 0);
        } else if (requestedPage && requestedPage >= 1) {
          setPageIndex(requestedPage - 1);
        } else if (profileId) {
          // Remember last position — only when there's no explicit ?page=
          // deep link (that always wins, e.g. a Mind Map citation).
          try {
            const progressRes = await EducationService.getChapterProgress(profileId);
            if (cancelled) return;
            const row = (progressRes?.data || []).find((p) => p.chapter_id === chapterId);
            if (row?.last_page_index != null && row.last_page_index >= 0) {
              justResumedRef.current = true;
              setPageIndex(row.last_page_index);
            }
          } catch {
            // Non-fatal — just starts at page 1 like before this feature existed.
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError("Couldn't load this chapter. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [chapterId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.listHighlights(chapterId);
        if (!cancelled) setHighlights(res?.data || []);
      } catch {
        if (!cancelled) setHighlights([]);
      }
    })();
    return () => { cancelled = true; };
  }, [chapterId]);

  // NCERT Solutions structural index — fetched unconditionally on chapter
  // load (cheap: plain PyMuPDF text extraction server-side, no AI call),
  // not gated on any tab being opened, since the Read-mode contextual
  // banner needs it before the student ever opens the Solutions tab. A
  // 404 (chapter has no NCERT resources yet) just leaves this null.
  useEffect(() => {
    let cancelled = false;
    setSolutionsIndex(null);
    (async () => {
      try {
        const res = await EducationService.getNcertSolutionsIndex(chapterId);
        if (!cancelled) setSolutionsIndex(res?.data || null);
      } catch {
        if (!cancelled) setSolutionsIndex(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chapterId]);

  // Auto-save active study session for Quick Resume banner
  useEffect(() => {
    if (!chapterName || !chapterId) return;
    const progressPct = numPages ? Math.round(((pageIndex + 1) / numPages) * 100) : 10;
    saveStudySession({
      title: chapterName,
      subtitle: `Textbook • Page ${pageIndex + 1}${numPages ? ` of ${numPages}` : ''}`,
      path: `/read/${chapterId}`,
      progress: progressPct,
      type: 'chapter',
    });
  }, [chapterName, chapterId, pageIndex, numPages]);

  // Award XP + Streak Shield on reaching final chapter page
  const hasAwardedXpRef = useRef(false);
  useEffect(() => {
    if (numPages && pageIndex >= numPages - 1 && !hasAwardedXpRef.current && chapterName) {
      hasAwardedXpRef.current = true;
      awardXp(50, `Completed ${chapterName}! 🎉`, { streakShield: true });
    }
  }, [pageIndex, numPages, chapterName, awardXp]);

  useEffect(() => {
    const root = containerRef.current;
    const overlayRoot = highlightOverlayRef.current;
    if (!root || !overlayRoot || textLayerTick === 0) return;
    clearHighlightOverlay(overlayRoot);
    const pageHighlights = highlights.filter((h) => h.page_index === pageIndex);
    pageHighlights.forEach((h) => {
      const range = findRangeForText(root, h.text);
      if (range) renderHighlightOverlay(overlayRoot, range, { color: h.color, highlightId: h.highlight_id });
    });
  }, [textLayerTick, pageIndex, highlights]);

  // Thumbnail buffers populated lazily — only once the Page Navigator is
  // actually opened, not on chapter load. Skips entirely if already
  // populated for this numPages (e.g. re-opening it doesn't re-clone).
  useEffect(() => {
    if (!numPages || !pdfBytesRef.current) return;
    if (!tocOpen) return;
    if (thumbnailBuffers.length === numPages) return;
    setThumbnailBuffers(Array.from({ length: numPages }, () => pdfBytesRef.current.slice(0)));
  }, [viewMode, tocOpen, numPages, thumbnailBuffers.length]);

  // Notes fetched lazily — only once the Notes & Highlights tab is
  // actually opened, not on every chapter visit.
  useEffect(() => {
    if (viewMode !== 'notes' || notesLoaded) return;
    let cancelled = false;
    setNotesLoading(true);
    EducationService.listNotes(chapterId)
      .then((res) => { if (!cancelled) setNotes(res?.data || []); })
      .catch(() => { if (!cancelled) setNotes([]); })
      .finally(() => {
        if (!cancelled) {
          setNotesLoading(false);
          setNotesLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [viewMode, notesLoaded, chapterId]);

  // NCERT Solutions PDF — fetched lazily only once its own tab is first
  // opened, same reasoning as thumbnails above. A 404 means this
  // chapter has no Solutions PDF yet (expected outside the pilot), not a
  // real failure — surfaced separately via ncertSolutionsStatus so the
  // empty state can say so honestly instead of "couldn't load".
  useEffect(() => {
    if (viewMode !== 'ncert_solutions' || ncertSolutionsLoaded) return;
    let cancelled = false;
    setNcertSolutionsLoading(true);
    EducationService.getNcertSolutionsPdf(chapterId)
      .then((bytes) => {
        if (cancelled) return;
        ncertSolutionsBytesRef.current = bytes;
        setNcertSolutionsPdfData(bytes && bytes.slice ? bytes.slice(0) : bytes);
      })
      .catch((err) => {
        if (!cancelled) setNcertSolutionsStatus(err?.response?.status === 404 ? 'unavailable' : 'error');
      })
      .finally(() => {
        if (!cancelled) {
          setNcertSolutionsLoading(false);
          setNcertSolutionsLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [viewMode, ncertSolutionsLoaded, chapterId]);

  // Real NCERT Notes PDF — replaces the old highlights/notes browse view
  // in this same "Notes" tab's rendered content (per product decision).
  // The listNotes/listHighlights fetch above and the floating toolbar's
  // create actions are untouched — this is purely an additional fetch
  // for the tab's new content, same lazy-on-first-open shape.
  useEffect(() => {
    if (viewMode !== 'notes' || ncertNotesLoaded) return;
    let cancelled = false;
    setNcertNotesLoading(true);
    EducationService.getNcertNotesPdf(chapterId)
      .then((bytes) => {
        if (cancelled) return;
        ncertNotesBytesRef.current = bytes;
        setNcertNotesPdfData(bytes && bytes.slice ? bytes.slice(0) : bytes);
      })
      .catch((err) => {
        if (!cancelled) setNcertNotesStatus(err?.response?.status === 404 ? 'unavailable' : 'error');
      })
      .finally(() => {
        if (!cancelled) {
          setNcertNotesLoading(false);
          setNcertNotesLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [viewMode, ncertNotesLoaded, chapterId]);

  // Whiteboard canvas — sized to its own display box in real device
  // pixels (same crisp-rendering reasoning as the PDF canvas above), and
  // primed with a white background so a download isn't transparent. Runs
  // once per mount of the canvas (it's conditionally rendered, so this
  // fires fresh each time the Whiteboard tab is opened).
  useEffect(() => {
    if (viewMode !== 'whiteboard') return;
    const canvas = whiteboardCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
  }, [viewMode]);

  // --- Reading preference persistence + real fit-width/fit-page measurement ---

  useEffect(() => { saveReaderPrefs({ readingTheme }); }, [readingTheme]);
  useEffect(() => { saveReaderPrefs({ zoomMode }); }, [zoomMode]);
  useEffect(() => { saveReaderPrefs({ pdfScaleWidth }); }, [pdfScaleWidth]);
  useEffect(() => { saveReaderPrefs({ pageWidthPercent }); }, [pageWidthPercent]);
  useEffect(() => { saveReaderPrefs({ reducedMotion }); }, [reducedMotion]);
  useEffect(() => { saveReaderPrefs({ readingMode }); }, [readingMode]);

  // Fit-to-page's definition ("this one page fills the viewport height")
  // is only meaningful with exactly one page on screen — auto-fall-back
  // to fit-width when switching to continuous, including on a fresh load
  // where a persisted 'fit-page' preference would otherwise silently
  // combine with a non-single reading mode.
  useEffect(() => {
    if (readingMode !== 'single' && zoomMode === 'fit-page') setZoomMode('fit-width');
  }, [readingMode, zoomMode]);

  // Real fit-to-width: measures readerCardRef's actual rendered width
  // (the outer themed card — present and unconditionally mounted
  // regardless of readingMode, unlike containerRef/continuousScrollRef
  // which only exist in specific modes) minus its own padding. Guards
  // against 0 (reports 0 width while CSS-hidden outside 'pdf' mode) so
  // containerWidth keeps its last real value instead of collapsing the
  // page to nothing.
  useEffect(() => {
    const el = readerCardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // contentRect already excludes the card's own p-4/p-6 padding.
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fit-to-page: needs the available viewport height below the sticky
  // header/toolbar, recomputed on resize and whenever fit-page becomes
  // active (switching into 'pdf' mode can change containerRef's real
  // position on screen).
  useEffect(() => {
    if (zoomMode !== 'fit-page') return;
    const compute = () => {
      if (!containerRef.current) return;
      const top = containerRef.current.getBoundingClientRect().top;
      setAvailableHeight(Math.max(300, window.innerHeight - top - 24));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [zoomMode, viewMode]);

  // Fires once per rendered page (react-pdf's <Page onLoadSuccess>
  // receives the real PDFPageProxy) — used only to learn this page's
  // real aspect ratio for fit-to-page; no extra proxy call needed since
  // this already fires for every page render regardless of zoom mode.
  const handlePageLoadSuccess = useCallback((page) => {
    try {
      const viewport = page.getViewport({ scale: 1 });
      if (viewport?.width && viewport?.height) {
        setPageAspectRatio(viewport.width / viewport.height);
      }
    } catch {
      // Non-fatal — fit-page just falls back to fit-width's containerWidth.
    }
  }, []);

  // --- Reading progress (debounced save-on-settle + flush-on-hide/unmount) ---

  // Mutable snapshot of everything sendProgressUpdate needs, kept fresh
  // every render — lets sendProgressUpdate itself stay referentially
  // stable (empty dep array) so the unmount-flush effect below only ever
  // fires its cleanup on a REAL unmount, not on every page turn.
  const progressStateRef = useRef({ studentProfileId: null, numPages: null, pageIndex: 0, chapterId });
  useEffect(() => {
    progressStateRef.current = { studentProfileId, numPages, pageIndex, chapterId };
  });

  const sendProgressUpdate = useCallback(() => {
    const { studentProfileId: sid, numPages: np, pageIndex: pi, chapterId: cid } = progressStateRef.current;
    if (!sid || !np) return;
    const progressPercent = Math.round(((pi + 1) / np) * 100);
    const status = pi === np - 1 ? 'completed' : 'in_progress';
    EducationService.updateChapterProgress(sid, { chapterId: cid, progressPercent, status, lastPageIndex: pi }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!studentProfileId || !numPages || loading) return;
    // Skip the one save that would otherwise immediately re-write the
    // exact position "remember last position" just resumed from.
    if (justResumedRef.current) {
      justResumedRef.current = false;
      return;
    }
    const timer = setTimeout(sendProgressUpdate, 2000);
    return () => clearTimeout(timer);
  }, [pageIndex, numPages, studentProfileId, loading, sendProgressUpdate]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') sendProgressUpdate();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      sendProgressUpdate();
    };
  }, [sendProgressUpdate]);

  // --- Page bookmarks (lazy — only once the Page Navigator is first opened) ---

  useEffect(() => {
    if (!tocOpen || bookmarksLoaded) return;
    let cancelled = false;
    EducationService.listBookmarks({ chapterId })
      .then((res) => { if (!cancelled) setBookmarks(res?.data || []); })
      .catch(() => { if (!cancelled) setBookmarks([]); })
      .finally(() => { if (!cancelled) setBookmarksLoaded(true); });
    return () => { cancelled = true; };
  }, [tocOpen, bookmarksLoaded, chapterId]);

  const toggleBookmarkThisPage = async () => {
    if (bookmarkSaving) return;
    setBookmarkSaving(true);
    try {
      const existing = bookmarks.find((b) => b.source_type === 'chapter' && b.page_index === pageIndex);
      if (existing) {
        await EducationService.deleteBookmark(existing.bookmark_id);
        setBookmarks((prev) => prev.filter((b) => b.bookmark_id !== existing.bookmark_id));
      } else {
        const res = await EducationService.createBookmark({
          chapterId,
          sourceType: 'chapter',
          title: `Page ${pageIndex + 1}`,
          content: chapterName ? `${chapterName} — Page ${pageIndex + 1}` : `Page ${pageIndex + 1}`,
          pageIndex,
        });
        const saved = res?.data;
        if (saved) setBookmarks((prev) => [...prev, saved]);
        setBookmarksLoaded(true);
      }
    } catch {
      // Non-fatal — the toggle just doesn't visually update; the student can retry.
    } finally {
      setBookmarkSaving(false);
    }
  };

  // --- Search within chapter (client-side — no backend text index exists) ---

  // Bounded-concurrency page-text indexer, same "don't fire every page's
  // work at once" instinct as the thumbnail worker-pool cap above —
  // getTextContent() doesn't spawn workers the way <Document> does, so
  // the cap here can be more generous.
  const SEARCH_INDEX_CONCURRENCY = 6;

  const buildSearchIndex = useCallback(async () => {
    if (!pdfProxyRef.current || !numPages) return;
    if (pageTextsRef.current && pageTextsChapterIdRef.current === chapterId) return; // already built
    setSearchIndexing(true);
    setSearchIndexProgress(0);
    const texts = new Array(numPages).fill('');
    let nextPage = 1;
    let completed = 0;
    const worker = async () => {
      for (;;) {
        const pageNum = nextPage;
        nextPage += 1;
        if (pageNum > numPages) return;
        try {
          const page = await pdfProxyRef.current.getPage(pageNum);
          const textContent = await page.getTextContent();
          texts[pageNum - 1] = textContent.items.map((it) => it.str).join(' ');
        } catch {
          texts[pageNum - 1] = '';
        }
        completed += 1;
        setSearchIndexProgress(completed);
      }
    };
    await Promise.all(Array.from({ length: Math.min(SEARCH_INDEX_CONCURRENCY, numPages) }, worker));
    pageTextsRef.current = texts;
    pageTextsChapterIdRef.current = chapterId;
    setSearchIndexing(false);
  }, [numPages, chapterId]);

  useEffect(() => {
    if (searchOpen) buildSearchIndex();
  }, [searchOpen, buildSearchIndex]);

  // Re-derives results whenever the query changes, or once indexing
  // finishes (searchIndexing flips true→false) — pageTextsRef itself is a
  // ref, not reactive state, so it can't be a dependency directly.
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !pageTextsRef.current) {
      setSearchResults([]);
      return;
    }
    const results = [];
    pageTextsRef.current.forEach((text, idx) => {
      const lower = text.toLowerCase();
      const matchIdx = lower.indexOf(q);
      if (matchIdx === -1) return;
      const start = Math.max(0, matchIdx - 40);
      const end = Math.min(text.length, matchIdx + q.length + 40);
      const snippet = `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
      results.push({ pageIndex: idx, snippet });
    });
    setSearchResults(results.slice(0, 50));
  }, [searchQuery, searchIndexing]);

  const jumpToSearchResult = (idx) => {
    goToPage(idx);
    setSearchOpen(false);
  };

  // Renders the current search match on whichever page it's on, once that
  // page's real text layer is ready — own overlay slot (searchOverlayRef,
  // never highlightOverlayRef) so it can't be wiped by/wipe out a saved
  // highlight rendered on the same page.
  useEffect(() => {
    const root = containerRef.current;
    const overlayRoot = searchOverlayRef.current;
    if (!root || !overlayRoot) return;
    clearHighlightOverlay(overlayRoot, '.chapter-search-match-overlay');
    const q = searchQuery.trim();
    if (!q) return;
    const activeMatch = searchResults.find((r) => r.pageIndex === pageIndex);
    if (!activeMatch) return;
    // Locate the raw query text, not the snippet (the snippet's
    // whitespace comes from the search index's own getTextContent()
    // join, which doesn't reliably match the real DOM text layer's
    // whitespace — the short query string is far less likely to differ).
    // findRangeForText is case-sensitive; try the query as typed first,
    // then lowercased, since search itself is case-insensitive but the
    // page's actual casing is unknown.
    const range = findRangeForText(root, q) || findRangeForText(root, q.toLowerCase());
    if (range) renderHighlightOverlay(overlayRoot, range, { className: 'chapter-search-match-overlay' });
  }, [textLayerTick, pageIndex, searchQuery, searchResults]);

  // --- Continuous mode: per-page overlay+container refs, selection, highlight reapply ---

  const registerMultiOverlay = (idx) => (el) => {
    if (el) multiOverlayRefs.current.set(idx, el); else multiOverlayRefs.current.delete(idx);
  };
  const registerMultiContainer = (idx) => (el) => {
    if (el) multiContainerRefs.current.set(idx, el); else multiContainerRefs.current.delete(idx);
  };
  const handleMultiTextLayerSuccess = (idx) => () => {
    setMultiRenderedPages((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));
  };

  // Same shape as handleMouseUp below, but scoped to the specific page the
  // student selected in (more than one page's text can be on screen at
  // once) — sets toolbar.pageIdx so applyHighlight/openAddNote know which
  // page_index to save against, instead of assuming the single pageIndex
  // state (which single-page mode's own handleMouseUp still does).
  const handleMultiMouseUp = (idx) => () => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    const container = multiContainerRefs.current.get(idx);
    if (!text || !container) { setToolbar(null); return; }
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !container.contains(anchorNode)) { setToolbar(null); return; }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { setToolbar(null); return; }
    setToolbar({ text: text.slice(0, MAX_SELECTION_CHARS), top: rect.top - 46, left: rect.left + rect.width / 2, pageIdx: idx });
  };

  // Reapplies saved highlights on every rendered multi-page page — mirrors
  // the single-page reapply effect above, just iterating the Set of
  // currently-rendered pages instead of assuming one.
  useEffect(() => {
    if (readingMode === 'single') return;
    multiRenderedPages.forEach((idx) => {
      const root = multiContainerRefs.current.get(idx);
      const overlayRoot = multiOverlayRefs.current.get(idx);
      if (!root || !overlayRoot) return;
      clearHighlightOverlay(overlayRoot);
      highlights.filter((h) => h.page_index === idx).forEach((h) => {
        const range = findRangeForText(root, h.text);
        if (range) renderHighlightOverlay(overlayRoot, range, { color: h.color, highlightId: h.highlight_id });
      });
    });
  }, [readingMode, multiRenderedPages, highlights]);

  // Continuous mode's virtualization window — a fixed [pageIndex-2,
  // pageIndex+4] slice mounts real <Page>s; everything outside gets a
  // fixed-height placeholder (from pageAspectRatio) so total scroll
  // height stays right without every page's text/annotation layer being
  // live at once. Slides as pageIndex (IntersectionObserver-derived,
  // below) moves.
  const continuousWindowStart = Math.max(0, pageIndex - 2);
  const continuousWindowEnd = numPages ? Math.min(numPages - 1, pageIndex + 4) : pageIndex;

  // Derives pageIndex from scroll position in continuous mode — most-
  // visible mounted page wins, debounced. Single-page mode keeps
  // pageIndex fully explicit-nav-driven (this observer only ever attaches
  // in continuous mode).
  useEffect(() => {
    if (readingMode !== 'continuous' || !numPages) return;
    const root = continuousScrollRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    let debounceTimer = null;
    const visibility = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.dataset.pageIdx);
          visibility.set(idx, entry.intersectionRatio);
        });
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          let bestIdx = null;
          let bestRatio = 0;
          visibility.forEach((ratio, idx) => {
            if (ratio > bestRatio) { bestRatio = ratio; bestIdx = idx; }
          });
          if (bestIdx != null) setPageIndex(bestIdx);
        }, 200);
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    const pages = root.querySelectorAll('[data-page-idx]');
    pages.forEach((el) => observer.observe(el));
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [readingMode, numPages, continuousWindowStart, continuousWindowEnd]);

  // Continuous mode's containerRef equivalent (continuousScrollRef) only
  // ever has the CURRENT virtualization window actually mounted — a
  // goToPage target outside that window doesn't have a DOM node to
  // scroll to yet. Recorded here, resolved once the window (which is
  // derived from pageIndex, already updated below) slides to include it.
  const pendingContinuousScrollRef = useRef(null);

  const goToPage = (idx) => {
    setPageIndex(idx);
    setToolbar(null);
    if (readingMode === 'continuous') {
      pendingContinuousScrollRef.current = idx;
    } else {
      containerRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (readingMode !== 'continuous' || pendingContinuousScrollRef.current == null) return;
    const idx = pendingContinuousScrollRef.current;
    const root = continuousScrollRef.current;
    const el = root?.querySelector(`[data-page-idx="${idx}"]`);
    if (el) {
      el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      pendingContinuousScrollRef.current = null;
    }
  }, [readingMode, continuousWindowStart, continuousWindowEnd, reducedMotion]);

  // Book-style page turning — shared by both the toolbar Previous/Next
  // buttons and the floating page-turn arrows overlaid on the reader.
  const stepPage = (direction) => {
    if (!numPages) return;
    const next = Math.min(Math.max(pageIndex + direction, 0), numPages - 1);
    if (next !== pageIndex) goToPage(next);
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (!text || !containerRef.current) {
      setToolbar(null);
      return;
    }
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !containerRef.current.contains(anchorNode)) {
      setToolbar(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setToolbar(null);
      return;
    }
    setToolbar({
      text: text.slice(0, MAX_SELECTION_CHARS),
      top: rect.top - 46,
      left: rect.left + rect.width / 2,
    });
  };

  const openAskSlider = async () => {
    setAskSliderOpen(true);
    if (isProvided && drawerCtx.setHelpOpen) {
      drawerCtx.setHelpOpen(true);
      drawerCtx.setHelpDrawerWidth(tutorWidth);
    }
    setAskHistoryError('');
    if (askConversationId !== null || askMessages.length > 0) return;
    setAskLoadingHistory(true);
    try {
      const res = await EducationService.getTutorHistory(chapterId);
      setAskMessages(res?.data?.messages || []);
      setAskConversationId(res?.data?.conversation_id || null);
    } catch {
      setAskHistoryError("Couldn't load your past conversation for this chapter.");
    } finally {
      setAskLoadingHistory(false);
    }
  };

  const closeAskSlider = useCallback(() => {
    setAskSliderOpen(false);
    if (isProvided && drawerCtx.setHelpOpen) {
      drawerCtx.setHelpOpen(false);
    }
  }, [isProvided, drawerCtx]);

  // ESC key listener to close drawer
  useEffect(() => {
    if (!askSliderOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeAskSlider();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [askSliderOpen, closeAskSlider]);

  // Pointer drag to resize drawer
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    updateTutorDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = tutorWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [tutorWidth, updateTutorDragging]);

  useEffect(() => {
    if (!isTutorDragging) return;

    const handlePointerMove = (e) => {
      const delta = dragStartXRef.current - e.clientX;
      const maxAllowed = Math.max(MIN_TUTOR_DRAWER_WIDTH, window.innerWidth - 60);
      const newWidth = Math.min(maxAllowed, Math.max(MIN_TUTOR_DRAWER_WIDTH, dragStartWidthRef.current + delta));
      updateTutorWidth(newWidth);
    };

    const handlePointerUp = () => {
      updateTutorDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isTutorDragging, updateTutorWidth, updateTutorDragging]);

  const askQuestion = (question) => {
    const trimmed = question.trim();
    if (!trimmed || askSending) return;

    setAskMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setAskSending(true);

    EducationService.chatWithTutor(chapterId, trimmed, askConversationId)
      .then((res) => {
        const data = res?.data || {};
        if (!askConversationId && data.conversation_id) setAskConversationId(data.conversation_id);
        setAskMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer || '', sources: data.source, figures: data.figures, citations: data.citations },
        ]);
      })
      .catch(() => {
        setAskMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "I couldn't get an answer just now. Please try again." },
        ]);
      })
      .finally(() => setAskSending(false));
  };

  const openAskAI = async () => {
    if (!toolbar) return;
    const question = `Can you explain this in simple terms?\n\n"${toolbar.text}"`;
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
    await openAskSlider();
    askQuestion(question);
  };

  const sendAskFollowUp = (e) => {
    e.preventDefault();
    const trimmed = askInput.trim();
    if (!trimmed) return;
    setAskInput('');
    askQuestion(trimmed);
  };

  const applyHighlight = async (color) => {
    if (!toolbar || savingHighlight) return;
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    const text = toolbar.text;
    // toolbar.pageIdx is only ever set by continuous mode's own selection
    // handler (handleMultiMouseUp) — single-page mode's own handleMouseUp
    // never sets it, so this falls back to the exact same
    // pageIndex/highlightOverlayRef behavior as before that mode existed.
    const targetPageIndex = toolbar.pageIdx != null ? toolbar.pageIdx : pageIndex;
    const overlayRoot = toolbar.pageIdx != null ? multiOverlayRefs.current.get(toolbar.pageIdx) : highlightOverlayRef.current;
    setToolbar(null);
    setSavingHighlight(true);
    const optimisticMarks = range && overlayRoot ? renderHighlightOverlay(overlayRoot, range, { color }) : [];
    window.getSelection()?.removeAllRanges();
    try {
      const res = await EducationService.createHighlight({ chapterId, pageIndex: targetPageIndex, text, color });
      const saved = res?.data;
      if (saved) setHighlights((prev) => [...prev, saved]);
    } catch {
      // The optimistic overlay above was never actually persisted — leaving
      // it on screen would show a highlight that silently disappears on
      // the next reload with no explanation. Remove it now and say so.
      optimisticMarks.forEach((mark) => mark.remove());
      setHighlightError("Couldn't save this highlight. Please try again.");
      window.setTimeout(() => setHighlightError(''), 4000);
    } finally {
      setSavingHighlight(false);
    }
  };

  const openAddNote = () => {
    if (!toolbar) return;
    setNoteForm({ title: toolbar.text.slice(0, 80), content: toolbar.text, saving: false, saved: false, error: '' });
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  };

  const saveNote = async () => {
    if (!noteForm || noteForm.saving) return;
    setNoteForm((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      await EducationService.createNote({ chapterId, title: noteForm.title, content: noteForm.content });
      setNoteForm((prev) => ({ ...prev, saving: false, saved: true }));
      window.setTimeout(() => setNoteForm(null), 1200);
    } catch {
      setNoteForm((prev) => ({ ...prev, saving: false, error: "Couldn't save this note. Please try again." }));
    }
  };

  const getThemeBgClass = () => {
    if (readingTheme === 'sepia') return 'bg-[#fef3c7] text-[#451a03] border-amber-200/80 shadow-md';
    if (readingTheme === 'dark') return 'bg-[#0f172a] text-[#f8fafc] border-slate-800 shadow-md';
    return 'glass-card text-on-surface';
  };

  // The width actually handed to <Page>: zoomMode picks the base (real
  // measured container width / height-constrained fit-page / manual
  // stepper), pageWidthPercent then scales that independently — the two
  // compose rather than compete, per the plan.
  const fitPageWidth = pageAspectRatio ? Math.round(availableHeight * pageAspectRatio) : containerWidth;
  const zoomBaseWidth = zoomMode === 'manual' ? pdfScaleWidth : zoomMode === 'fit-page' ? fitPageWidth : containerWidth;
  const finalPageWidth = Math.max(240, Math.round((zoomBaseWidth * pageWidthPercent) / 100));

  const isPageBookmarked = bookmarks.some((b) => b.source_type === 'chapter' && b.page_index === pageIndex);
  const pageBookmarks = bookmarks.filter((b) => b.source_type === 'chapter' && b.page_index != null);
  const readProgressPercent = numPages ? Math.round(((pageIndex + 1) / numPages) * 100) : null;

  // Generic (not personalized — no per-student reading-speed data exists
  // anywhere in the schema) estimate from the search index's own
  // getTextContent() word counts. Only available once that index has
  // been built at least once (i.e. after Search has been opened) — a
  // real, accepted limitation rather than eagerly indexing every chapter
  // just to show this number.
  let estimatedMinutesLeft = null;
  if (pageTextsRef.current && numPages) {
    let wordCount = 0;
    for (let i = pageIndex; i < numPages; i += 1) {
      wordCount += (pageTextsRef.current[i] || '').split(/\s+/).filter(Boolean).length;
    }
    estimatedMinutesLeft = Math.max(1, Math.round(wordCount / 200));
  }

  return (
    <main className={`flex-grow px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)] ${reducedMotion ? 'reader-reduced-motion' : ''}`}>
      {highlightError && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-error text-white px-4 py-2 rounded-lg shadow-lg text-body-md flex items-center gap-2 animate-fade-in"
          role="alert"
        >
          <span className="material-symbols-outlined text-[18px]">error</span>
          {highlightError}
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        {/* Sticky chapter heading with gradient accent & glowing progress */}
        <div className="sticky top-0 z-20 bg-surface-bright/90 backdrop-blur-md pt-stack-lg pb-3 -mx-margin-mobile md:-mx-margin-desktop px-margin-mobile md:px-margin-desktop border-b border-border-subtle/50 transition-all shadow-xs">
          {chapterOrder && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-extrabold text-primary uppercase tracking-wider mb-1 shadow-2xs">
              <span className="material-symbols-outlined text-[13px]">auto_stories</span>
              Chapter {chapterOrder}
            </span>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-headline-lg text-headline-lg animated-gradient-text font-black truncate">{chapterName || 'Read Chapter'}</h1>
              {viewMode === 'pdf' && (
                <p className="text-body-md text-on-surface-variant mt-0.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-primary">touch_app</span>
                  Select any text to highlight, ask AI Tutor, or save notes.
                </p>
              )}
              {/* Reading progress with smooth animated fill & badges */}
              {viewMode === 'pdf' && readProgressPercent != null && (
                <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                  <div className="w-32 h-2 rounded-full bg-surface-container-high overflow-hidden border border-border-subtle/40 p-0.5 shadow-inner">
                    <div className="h-full bg-gradient-to-r from-primary via-blue-500 to-indigo-600 rounded-full transition-all duration-500 shadow-xs" style={{ width: `${readProgressPercent}%` }} />
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                    <span className="material-symbols-outlined text-[12px]">trending_up</span>
                    {readProgressPercent}% Read
                  </span>
                  {estimatedMinutesLeft != null && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-md border border-border-subtle">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      ~{estimatedMinutesLeft} min left
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={openAskSlider}
              className="shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 text-white font-bold px-4 py-2 text-body-md transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px] animate-pulse-subtle">auto_awesome</span>
              AI Tutor
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start mt-4">
        <div className="flex-1 min-w-0 space-y-stack-md pb-stack-lg">
          {/* View Mode tabs + right-side Page Navigator toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-surface-container-lowest dark:bg-[#152238] rounded-xl p-1.5 border border-border-subtle dark:border-[#2e3f5f] shadow-xs overflow-x-auto">
              {VIEW_MODE_TABS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    viewMode === m.id
                      ? 'bg-primary text-on-primary shadow-sm scale-[1.02]'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {viewMode === 'pdf' && (
                <button
                  type="button"
                  onClick={() => setSearchOpen((v) => !v)}
                  title="Search this chapter"
                  aria-label="Search this chapter"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all duration-200 shadow-xs ${
                    searchOpen
                      ? 'bg-primary text-on-primary border-primary shadow-md'
                      : 'border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary hover:scale-[1.02]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">search</span>
                  Search
                </button>
              )}
              <button
                type="button"
                onClick={() => setTocOpen((v) => !v)}
                title="Page Navigator"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all duration-200 shadow-xs ${
                  tocOpen
                    ? 'bg-primary text-on-primary border-primary shadow-md'
                    : 'border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary hover:scale-[1.02]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">toc</span>
                Page Navigator
                {pageBookmarks.length > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-extrabold shadow-2xs">
                    {pageBookmarks.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {viewMode === 'pdf' && (
          <>
          {/* Ultra-Compact Single-Line Reader Controls Toolbar */}
          <div className="bg-surface-container-lowest/95 dark:bg-[#152238]/95 backdrop-blur-md rounded-xl px-3 py-1.5 border border-border-subtle dark:border-[#2e3f5f] shadow-sm flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              {/* Reading Theme selector */}
              <div className="flex items-center bg-surface-container dark:bg-[#1e293b] rounded-lg p-0.5 border border-border-subtle dark:border-[#2e3f5f] shrink-0">
                <button
                  type="button"
                  onClick={() => setReadingTheme('light')}
                  title="Clean Light Theme"
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    readingTheme === 'light'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white border border-slate-300" />
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setReadingTheme('sepia')}
                  title="Warm Sepia Theme"
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    readingTheme === 'sepia'
                      ? 'bg-[#fef3c7] text-[#92400e] shadow-2xs border border-amber-300'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#fef3c7] border border-amber-400" />
                  Sepia
                </button>
                <button
                  type="button"
                  onClick={() => setReadingTheme('dark')}
                  title="Midnight Dark Theme"
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    readingTheme === 'dark'
                      ? 'bg-[#0f172a] text-sky-400 shadow-2xs border border-slate-700'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#0f172a] border border-sky-400" />
                  Dark
                </button>
              </div>

              <div className="w-px h-4 bg-border-subtle dark:bg-[#2e3f5f] shrink-0" />

              {/* Reading Mode */}
              <div className="flex items-center bg-surface-container dark:bg-[#1e293b] rounded-lg p-0.5 border border-border-subtle dark:border-[#2e3f5f] shrink-0">
                <button
                  type="button"
                  onClick={() => setReadingMode('single')}
                  title="Single Page"
                  aria-label="Single Page reading mode"
                  className={`p-1 rounded-md transition-all cursor-pointer ${
                    readingMode === 'single' ? 'bg-primary text-on-primary shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">description</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReadingMode('continuous')}
                  title="Continuous Scroll"
                  aria-label="Continuous Scroll reading mode"
                  className={`p-1 rounded-md transition-all cursor-pointer ${
                    readingMode === 'continuous' ? 'bg-primary text-on-primary shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">view_agenda</span>
                </button>
              </div>

              <div className="w-px h-4 bg-border-subtle dark:bg-[#2e3f5f] shrink-0" />

              {/* Zoom Controls */}
              <div className="flex items-center gap-0.5 bg-surface-container/60 dark:bg-[#1e293b]/60 p-0.5 rounded-lg border border-border-subtle dark:border-[#2e3f5f] shrink-0">
                <button
                  type="button"
                  onClick={() => setZoomMode('fit-width')}
                  title="Fit to Width"
                  aria-label="Fit to Width"
                  className={`p-1 rounded-md border cursor-pointer transition-all ${
                    zoomMode === 'fit-width'
                      ? 'bg-primary text-on-primary border-primary shadow-2xs'
                      : 'border-transparent text-on-surface-variant hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">fit_screen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMode('fit-page')}
                  title="Fit to Page"
                  aria-label="Fit to Page"
                  className={`p-1 rounded-md border cursor-pointer transition-all ${
                    zoomMode === 'fit-page'
                      ? 'bg-primary text-on-primary border-primary shadow-2xs'
                      : 'border-transparent text-on-surface-variant hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">crop_free</span>
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomMode === 'manual' && pdfScaleWidth <= 480}
                  title="Zoom Out"
                  className="p-1 rounded-md text-on-surface-variant hover:text-primary disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">zoom_out</span>
                </button>
                <span
                  title="Current zoom"
                  className="px-1.5 py-0.5 text-[11px] font-bold text-on-surface min-w-[48px] text-center rounded bg-surface-container-lowest dark:bg-[#152238] border border-border-subtle/50"
                >
                  {zoomMode === 'fit-width' ? 'Fit Width' : zoomMode === 'fit-page' ? 'Fit Page' : `${Math.round((pdfScaleWidth / 760) * 100)}%`}
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomMode === 'manual' && pdfScaleWidth >= 1200}
                  title="Zoom In"
                  className="p-1 rounded-md text-on-surface-variant hover:text-primary disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                </button>
              </div>

              <div className="w-px h-4 bg-border-subtle dark:bg-[#2e3f5f] shrink-0" />

              {/* Page Width */}
              <label className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant shrink-0" title="Page width slider">
                <span className="material-symbols-outlined text-[15px] text-primary">width</span>
                <input
                  type="range"
                  min={60}
                  max={100}
                  step={5}
                  value={pageWidthPercent}
                  onChange={(e) => setPageWidthPercent(Number(e.target.value))}
                  className="w-12 cursor-pointer accent-primary"
                />
                <span className="w-7 text-on-surface">{pageWidthPercent}%</span>
              </label>

              <div className="w-px h-4 bg-border-subtle dark:bg-[#2e3f5f] shrink-0" />

              {/* Text-to-Speech Read Aloud */}
              <button
                type="button"
                onClick={handleToggleSpeech}
                title={isSpeaking ? "Stop Read Aloud" : "Read Page Aloud"}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer shrink-0 ${
                  isSpeaking
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs animate-pulse'
                    : 'border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isSpeaking ? 'volume_off' : 'volume_up'}
                </span>
                <span>{isSpeaking ? 'Stop' : 'Read Aloud'}</span>
              </button>

              {isSpeaking && (
                <>
                  <button
                    type="button"
                    onClick={handleToggleSpeechPause}
                    title={isSpeechPaused ? 'Resume Read Aloud' : 'Pause Read Aloud'}
                    aria-label={isSpeechPaused ? 'Resume Read Aloud' : 'Pause Read Aloud'}
                    className="p-1 rounded-lg border border-amber-400 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">{isSpeechPaused ? 'play_arrow' : 'pause'}</span>
                  </button>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-400/50 shrink-0" title="Read Aloud speed">
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.25}
                      value={speechRate}
                      onChange={(e) => setSpeechRate(Number(e.target.value))}
                      className="w-12 cursor-pointer accent-amber-500"
                    />
                    <span className="w-6 text-amber-600 dark:text-amber-300">{speechRate}x</span>
                  </label>
                </>
              )}
            </div>

            {/* Right Tools: Fullscreen, Focus, Motion, Bookmark */}
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <button
                type="button"
                onClick={toggleFullscreen}
                title="Distraction Free Fullscreen"
                className="p-1 rounded-lg border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFocusMode(!isFocusMode)}
                title={isFocusMode ? 'Exit Focus Mode' : 'Focus Mode (hide sidebar & navigation)'}
                className={`p-1 rounded-lg border cursor-pointer transition-colors ${
                  isFocusMode
                    ? 'bg-primary text-on-primary border-primary shadow-2xs'
                    : 'border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
              </button>
              <button
                type="button"
                onClick={() => setReducedMotion(!reducedMotion)}
                title={reducedMotion ? 'Reduced Motion: On' : 'Reduced Motion: Off'}
                className={`p-1 rounded-lg border cursor-pointer transition-colors ${
                  reducedMotion
                    ? 'bg-primary text-on-primary border-primary shadow-2xs'
                    : 'border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {reducedMotion ? 'motion_photos_off' : 'motion_photos_auto'}
                </span>
              </button>
              <button
                type="button"
                onClick={toggleBookmarkThisPage}
                disabled={bookmarkSaving}
                title={isPageBookmarked ? 'Remove bookmark for this page' : 'Bookmark this page'}
                aria-label={isPageBookmarked ? 'Remove bookmark for this page' : 'Bookmark this page'}
                className={`p-1 rounded-lg border cursor-pointer transition-colors disabled:opacity-50 ${
                  isPageBookmarked
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-amber-500'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isPageBookmarked ? 'bookmark' : 'bookmark_border'}
                </span>
              </button>
            </div>
          </div>
          </>
          )}

          {/* Contextual "jump to solution" banner */}
          {viewMode === 'pdf' && solutionsIndex && (() => {
            const activeExercise = Object.entries(solutionsIndex).find(([, ex]) => {
              const range = ex?.textbook_pages;
              return Array.isArray(range) && pageIndex >= range[0] && pageIndex <= range[1];
            });
            if (!activeExercise) return null;
            const [exerciseKey, exerciseData] = activeExercise;
            return (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-blue-500/10 px-4 py-3 shadow-xs">
                <span className="material-symbols-outlined text-primary text-[20px] p-1.5 rounded-lg bg-primary/10">fact_check</span>
                <span className="text-body-md font-bold text-on-surface">
                  NCERT Solutions available — {exerciseKey === 'end' ? 'End of Chapter Exercise' : `Exercise ${exerciseKey}`}:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(exerciseData.questions || []).map((q) => (
                    <button
                      key={q.number}
                      type="button"
                      onClick={() => jumpToSolutionPage(q.solution_page)}
                      className="px-3 py-1 text-xs font-black rounded-lg bg-primary text-on-primary hover:scale-105 active:scale-95 shadow-2xs transition-all cursor-pointer"
                    >
                      Q{q.number}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Search within chapter — client-side (no backend text index
              exists for real page content). Indexes lazily on first open,
              then searches entirely in the browser. */}
          {viewMode === 'pdf' && searchOpen && (
            <div className="glass-card rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search this chapter…"
                  className="flex-1 rounded-lg border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#1e2d4a] px-3 py-1.5 text-sm text-on-surface"
                />
                <button
                  type="button"
                  onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                  aria-label="Close search"
                  className="p-1.5 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-error/10 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              {searchIndexing ? (
                <p className="text-xs text-on-surface-variant px-1">
                  Indexing… ({searchIndexProgress}/{numPages || 0})
                </p>
              ) : searchQuery.trim() && searchResults.length === 0 ? (
                <p className="text-xs text-on-surface-variant px-1">No matches found.</p>
              ) : searchResults.length > 0 ? (
                <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                  {searchResults.map((r) => (
                    <button
                      key={r.pageIndex}
                      type="button"
                      onClick={() => jumpToSearchResult(r.pageIndex)}
                      className="w-full text-left p-2 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-bold text-primary">Page {r.pageIndex + 1}</span>
                      <p className="text-xs text-on-surface-variant line-clamp-2">{r.snippet}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
              <p className="text-label-md text-on-surface-variant">Loading this chapter…</p>
            </div>
          ) : error ? (
            <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">{error}</div>
          ) : !pdfData ? (
            <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">No readable content found for this chapter yet.</div>
          ) : (
            <>
              {/* Always mounted (never conditionally unmounted on
                  viewMode, just hidden via CSS) — pdf.js's loading task
                  transfers `pdfData` (a raw ArrayBuffer) to its worker,
                  which permanently detaches it in the main thread. If
                  this <Document> unmounted on leaving 'pdf' mode and
                  remounted on returning, the second mount would reuse
                  that same already-detached buffer and crash with
                  "Cannot perform Construct on a detached ArrayBuffer" —
                  confirmed live (switching to Grid then jumping back to
                  Read crashed the whole app, no error boundary). Hiding
                  instead of unmounting means it's only ever consumed
                  once, on real chapter load. */}
              <div
                ref={readerCardRef}
                className={`relative rounded-xl p-4 sm:p-6 transition-all border ${getThemeBgClass()} ${viewMode === 'pdf' ? '' : 'hidden'}`}
              >
                {/* Book-style page-turn arrows, overlaid on the page
                    edges — a faster, more textbook-like way to advance
                    than scrolling down to the Previous/Next bar below.
                    Hidden in Continuous mode, where scrolling itself is
                    already the natural way to turn pages. */}
                {readingMode !== 'continuous' && numPages > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => stepPage(-1)}
                      disabled={pageIndex === 0}
                      aria-label="Previous page"
                      className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-on-surface/70 text-white hover:bg-on-surface/90 disabled:opacity-0 disabled:pointer-events-none cursor-pointer transition-all shadow-lg"
                    >
                      <span className="material-symbols-outlined text-[22px]">chevron_left</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => stepPage(1)}
                      disabled={pageIndex === numPages - 1}
                      aria-label="Next page"
                      className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-on-surface/70 text-white hover:bg-on-surface/90 disabled:opacity-0 disabled:pointer-events-none cursor-pointer transition-all shadow-lg"
                    >
                      <span className="material-symbols-outlined text-[22px]">chevron_right</span>
                    </button>
                  </>
                )}
                <div
                  ref={readingMode === 'single' ? containerRef : readingMode === 'continuous' ? continuousScrollRef : null}
                  onMouseUp={readingMode === 'single' ? handleMouseUp : undefined}
                  className={
                    readingMode === 'continuous'
                      ? 'select-text overflow-y-auto max-h-[80vh] custom-scrollbar flex flex-col items-center gap-4'
                      : 'select-text overflow-x-auto flex justify-center'
                  }
                >
                  <Document
                    file={pdfData}
                    onLoadSuccess={(pdf) => {
                      // The full PDFDocumentProxy (react-pdf hands this
                      // straight through from pdf.js) — kept in a ref, not
                      // state, purely for Search's lazy per-page
                      // getTextContent() calls; nothing here needs a
                      // re-render on this specific object.
                      pdfProxyRef.current = pdf;
                      setNumPages(pdf.numPages);
                    }}
                    loading={
                      <div className="flex justify-center py-16">
                        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                      </div>
                    }
                    error={
                      <div className="py-16 text-center text-on-surface-variant">Couldn't render this chapter's PDF.</div>
                    }
                  >
                    {readingMode === 'single' && (
                      <Page
                        key={pageIndex}
                        pageNumber={pageIndex + 1}
                        width={finalPageWidth}
                        devicePixelRatio={Math.max(window.devicePixelRatio || 1, 2)}
                        onLoadSuccess={handlePageLoadSuccess}
                        onRenderTextLayerSuccess={handleRenderTextLayerSuccess}
                      >
                        <div ref={highlightOverlayRef} className="absolute inset-0 pointer-events-none" />
                        <div ref={searchOverlayRef} className="absolute inset-0 pointer-events-none" />
                        <div ref={speechOverlayRef} className="absolute inset-0 pointer-events-none" />
                      </Page>
                    )}

                    {/* Continuous: virtualized — only pages within
                        [continuousWindowStart, continuousWindowEnd]
                        mount a real <Page>; everything else is a
                        fixed-height placeholder (from pageAspectRatio)
                        so total scroll height stays correct without
                        every page's text/annotation layer being live at
                        once. data-page-idx on every entry (placeholder
                        included) drives the IntersectionObserver above —
                        scrolling into a placeholder's region is itself
                        the signal to slide the window there for real. */}
                    {readingMode === 'continuous' && numPages &&
                      Array.from({ length: numPages }, (_, idx) => idx).map((idx) => {
                        const inWindow = idx >= continuousWindowStart && idx <= continuousWindowEnd;
                        if (!inWindow) {
                          const placeholderHeight = pageAspectRatio ? Math.round(finalPageWidth / pageAspectRatio) : 800;
                          return (
                            <div
                              key={idx}
                              data-page-idx={idx}
                              style={{ width: finalPageWidth, height: placeholderHeight }}
                              className="bg-surface-container-low rounded shrink-0"
                            />
                          );
                        }
                        return (
                          <div
                            key={idx}
                            data-page-idx={idx}
                            ref={registerMultiContainer(idx)}
                            onMouseUp={handleMultiMouseUp(idx)}
                            className="relative select-text shrink-0"
                          >
                            <Page
                              pageNumber={idx + 1}
                              width={finalPageWidth}
                              devicePixelRatio={Math.max(window.devicePixelRatio || 1, 2)}
                              onLoadSuccess={idx === pageIndex ? handlePageLoadSuccess : undefined}
                              onRenderTextLayerSuccess={handleMultiTextLayerSuccess(idx)}
                            >
                              <div ref={registerMultiOverlay(idx)} className="absolute inset-0 pointer-events-none" />
                            </Page>
                          </div>
                        );
                      })}
                  </Document>
                </div>
              </div>

              {/* Modern Floating Reader Navigation Bar (Kindle/Apple Books style) */}
              {viewMode === 'pdf' && numPages && (
                <div className="glass-card rounded-2xl p-3 sm:px-5 border border-border-subtle dark:border-[#2e3f5f] shadow-lg flex flex-col md:flex-row items-center justify-between gap-3 mt-4 bg-surface-container-lowest/90 backdrop-blur-md">
                  {/* Left: Previous & First Page Jump */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToPage(0)}
                      disabled={pageIndex === 0}
                      title="Jump to first page"
                      className="p-2 rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary transition-all disabled:opacity-30 cursor-pointer shadow-2xs hover:scale-105"
                    >
                      <span className="material-symbols-outlined text-[18px]">first_page</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => stepPage(-1)}
                      disabled={pageIndex === 0}
                      aria-label="Previous"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border-subtle bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary font-bold text-xs transition-all disabled:opacity-30 cursor-pointer shadow-xs hover:scale-[1.02] active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                      Previous
                    </button>
                  </div>

                  {/* Center: Interactive Page Slider & Page Indicator */}
                  <div className="flex-1 max-w-md w-full flex items-center gap-3 px-2">
                    <span className="text-xs font-extrabold text-primary min-w-[100px] text-center px-2 py-1.5 rounded-lg bg-primary/10 border border-primary/20 shadow-2xs">
                      Page {pageIndex + 1} of {numPages}
                    </span>
                    <div className="flex-1 relative flex items-center">
                      <input
                        type="range"
                        min={1}
                        max={numPages}
                        value={pageIndex + 1}
                        onChange={(e) => goToPage(Number(e.target.value) - 1)}
                        className="w-full h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                        title={`Scrub pages (Current: Page ${pageIndex + 1})`}
                      />
                    </div>
                    <form onSubmit={handlePageJumpSubmit} className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={numPages}
                        value={pageJumpInput}
                        onChange={(e) => setPageJumpInput(e.target.value)}
                        placeholder="Go to..."
                        className="w-16 px-2 py-1 text-xs font-semibold rounded-lg border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-low dark:bg-[#1e2d4a] text-on-surface focus:ring-2 focus:ring-primary/40 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!pageJumpInput}
                        className="px-2.5 py-1 text-xs font-extrabold rounded-lg bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-40 cursor-pointer shadow-2xs transition-all active:scale-95"
                      >
                        Go
                      </button>
                    </form>
                  </div>

                  {/* Right: Next & Last Page Jump */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stepPage(1)}
                      disabled={pageIndex === numPages - 1}
                      aria-label="Next"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border-subtle bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary font-bold text-xs transition-all disabled:opacity-30 cursor-pointer shadow-xs hover:scale-[1.02] active:scale-95"
                    >
                      Next
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => goToPage(numPages - 1)}
                      disabled={pageIndex === numPages - 1}
                      title="Jump to last page"
                      className="p-2 rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary transition-all disabled:opacity-30 cursor-pointer shadow-2xs hover:scale-105"
                    >
                      <span className="material-symbols-outlined text-[18px]">last_page</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Interactive Whiteboard / Scratchpad Studio Palette */}
              {viewMode === 'whiteboard' && (
                <div className="space-y-3">
                  <div className="bg-surface-container-lowest/95 dark:bg-[#152238]/95 backdrop-blur-md rounded-2xl p-3 border border-border-subtle dark:border-[#2e3f5f] shadow-md flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1 mr-1">
                        <span className="material-symbols-outlined text-[16px] text-primary">palette</span>
                        Color
                      </span>
                      {BRUSH_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setBrushColor(c); setIsErasing(false); }}
                          title={`Brush color ${c}`}
                          className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-all duration-200 hover:scale-115 shadow-2xs ${
                            !isErasing && brushColor === c ? 'border-primary scale-115 ring-2 ring-primary/40 shadow-sm' : 'border-white/80 dark:border-slate-700'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>

                    <div className="w-px h-6 bg-border-subtle dark:bg-[#2e3f5f]" />

                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface-variant bg-surface-container-low/60 dark:bg-[#1e293b]/60 px-3 py-1.5 rounded-xl border border-border-subtle dark:border-[#2e3f5f]">
                      <span className="material-symbols-outlined text-[16px] text-primary">line_weight</span>
                      Size
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-20 cursor-pointer accent-primary"
                      />
                      <span className="w-5 text-center text-on-surface">{brushSize}</span>
                    </label>

                    <div className="w-px h-6 bg-border-subtle dark:bg-[#2e3f5f]" />

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => setIsErasing((v) => !v)}
                        title="Eraser"
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer shadow-2xs ${
                          isErasing
                            ? 'bg-primary text-on-primary border-primary shadow-sm scale-[1.02]'
                            : 'border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">ink_eraser</span>
                        Eraser
                      </button>
                      <button
                        type="button"
                        onClick={clearWhiteboard}
                        title="Clear whiteboard"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-error hover:border-error/50 transition-all duration-150 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={downloadWhiteboard}
                        title="Download as image"
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Download
                      </button>
                    </div>
                  </div>

                  <canvas
                    ref={whiteboardCanvasRef}
                    onPointerDown={startWhiteboardStroke}
                    onPointerMove={continueWhiteboardStroke}
                    onPointerUp={endWhiteboardStroke}
                    onPointerLeave={endWhiteboardStroke}
                    className="w-full h-[560px] rounded-2xl border border-border-subtle dark:border-[#2e3f5f] shadow-md bg-white touch-none cursor-crosshair"
                  />
                </div>
              )}

              {/* NCERT Notes */}
              {viewMode === 'notes' && (
                <div className="space-y-3">
                  {ncertNotesLoading ? (
                    <div className="flex flex-col items-center gap-3 py-16">
                      <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                      <p className="text-label-md text-on-surface-variant">Loading NCERT Notes…</p>
                    </div>
                  ) : ncertNotesStatus === 'unavailable' ? (
                    <div className="glass-card rounded-2xl p-6 text-center text-on-surface-variant shadow-xs">
                      NCERT Notes aren't available for this chapter yet.
                    </div>
                  ) : ncertNotesStatus === 'error' ? (
                    <div className="glass-card rounded-2xl p-6 text-center text-on-surface-variant shadow-xs">
                      Couldn't load NCERT Notes. Please try again.
                    </div>
                  ) : ncertNotesPdfData ? (
                    <>
                      <div className="glass-card rounded-2xl p-4 sm:p-6 overflow-x-auto flex justify-center shadow-md">
                        <Document
                          file={ncertNotesPdfData}
                          onLoadSuccess={({ numPages: total }) => setNcertNotesNumPages(total)}
                          loading={
                            <div className="flex justify-center py-16">
                              <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                            </div>
                          }
                          error={<div className="py-16 text-center text-on-surface-variant">Couldn't render NCERT Notes.</div>}
                        >
                          <Page pageNumber={notesPageIndex + 1} width={pdfScaleWidth} devicePixelRatio={Math.max(window.devicePixelRatio || 1, 2)} />
                        </Document>
                      </div>
                      {ncertNotesNumPages && (
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setNotesPageIndex((p) => Math.max(0, p - 1))}
                            disabled={notesPageIndex === 0}
                            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border-subtle text-on-surface-variant hover:text-primary hover:border-primary transition-all disabled:opacity-30 cursor-pointer shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                            Previous
                          </button>
                          <span className="text-label-md font-bold text-on-surface">Page {notesPageIndex + 1} of {ncertNotesNumPages}</span>
                          <button
                            type="button"
                            onClick={() => setNotesPageIndex((p) => Math.min(ncertNotesNumPages - 1, p + 1))}
                            disabled={notesPageIndex === ncertNotesNumPages - 1}
                            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border-subtle text-on-surface-variant hover:text-primary hover:border-primary transition-all disabled:opacity-30 cursor-pointer shadow-xs"
                          >
                            Next
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              )}

              {/* NCERT Solutions */}
              {viewMode === 'ncert_solutions' && (
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    {ncertSolutionsLoading ? (
                      <div className="flex flex-col items-center gap-3 py-16">
                        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                        <p className="text-label-md text-on-surface-variant">Loading NCERT Solutions…</p>
                      </div>
                    ) : ncertSolutionsStatus === 'unavailable' ? (
                      <div className="glass-card rounded-2xl p-6 text-center text-on-surface-variant shadow-xs">
                        NCERT Solutions aren't available for this chapter yet.
                      </div>
                    ) : ncertSolutionsStatus === 'error' ? (
                      <div className="glass-card rounded-2xl p-6 text-center text-on-surface-variant shadow-xs">
                        Couldn't load NCERT Solutions. Please try again.
                      </div>
                    ) : ncertSolutionsPdfData ? (
                      <>
                        <div className="glass-card rounded-2xl p-4 sm:p-6 overflow-x-auto flex justify-center shadow-md">
                          <Document
                            file={ncertSolutionsPdfData}
                            onLoadSuccess={({ numPages: total }) => setNcertSolutionsNumPages(total)}
                            loading={
                              <div className="flex justify-center py-16">
                                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                              </div>
                            }
                            error={<div className="py-16 text-center text-on-surface-variant">Couldn't render NCERT Solutions.</div>}
                          >
                            <Page pageNumber={solutionsPageIndex + 1} width={pdfScaleWidth} devicePixelRatio={Math.max(window.devicePixelRatio || 1, 2)} />
                          </Document>
                        </div>
                        {ncertSolutionsNumPages && (
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setSolutionsPageIndex((p) => Math.max(0, p - 1))}
                              disabled={solutionsPageIndex === 0}
                              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border-subtle text-on-surface-variant hover:text-primary hover:border-primary transition-all disabled:opacity-30 cursor-pointer shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                              Previous
                            </button>
                            <span className="text-label-md font-bold text-on-surface">Page {solutionsPageIndex + 1} of {ncertSolutionsNumPages}</span>
                            <button
                              type="button"
                              onClick={() => setSolutionsPageIndex((p) => Math.min(ncertSolutionsNumPages - 1, p + 1))}
                              disabled={solutionsPageIndex === ncertSolutionsNumPages - 1}
                              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border-subtle text-on-surface-variant hover:text-primary hover:border-primary transition-all disabled:opacity-30 cursor-pointer shadow-xs"
                            >
                              Next
                              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                            </button>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>

                  {/* Question Index */}
                  {solutionsIndex && (
                    <div className="lg:w-[260px] shrink-0 glass-card rounded-2xl p-4 space-y-3 lg:max-h-[720px] lg:overflow-y-auto custom-scrollbar shadow-md">
                      <p className="font-extrabold text-sm text-primary flex items-center gap-2 pb-2 border-b border-border-subtle dark:border-[#2e3f5f]">
                        <span className="material-symbols-outlined text-[20px]">fact_check</span>
                        Question Index
                      </p>
                      {Object.entries(solutionsIndex).map(([key, ex]) => (
                        <div key={key} className="space-y-2">
                          <p className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">
                            {key === 'end' ? 'End of Chapter' : `Exercise ${key}`}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(ex.questions || []).map((q) => (
                              <button
                                key={q.number}
                                type="button"
                                onClick={() => setSolutionsPageIndex(q.solution_page)}
                                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer shadow-2xs ${
                                  solutionsPageIndex === q.solution_page
                                    ? 'bg-primary text-on-primary border-primary shadow-sm scale-105'
                                    : 'border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary hover:scale-105'
                                }`}
                              >
                                Q{q.number}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Up Next Sidebar Cards with vibrant icon avatars and hover lift */}
        <aside className="w-full lg:w-[280px] shrink-0 lg:sticky lg:top-24 space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-label-md font-extrabold text-on-surface-variant uppercase tracking-wider">Up Next</p>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Resources ready" />
          </div>
          <div className="space-y-2.5">
            {hasNcertNotes && (
              <button
                type="button"
                onClick={() => setViewMode('notes')}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer interactive-hover-lift ${
                  viewMode === 'notes' ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/30' : 'border-border-subtle dark:border-[#2e3f5f] glass-card hover:border-primary/50 shadow-xs'
                }`}
              >
                <span className="shrink-0 w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shadow-2xs">
                  <span className="material-symbols-outlined text-[22px]">sticky_note_2</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-body-md font-extrabold text-on-surface truncate">NCERT Notes</span>
                  <span className="block text-xs text-on-surface-variant truncate">Chapter notes &amp; explanations</span>
                </span>
              </button>
            )}

            {hasNcertSolutions && (
              <button
                type="button"
                onClick={() => setViewMode('ncert_solutions')}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer interactive-hover-lift ${
                  viewMode === 'ncert_solutions' ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/30' : 'border-border-subtle dark:border-[#2e3f5f] glass-card hover:border-primary/50 shadow-xs'
                }`}
              >
                <span className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shadow-2xs">
                  <span className="material-symbols-outlined text-[22px]">fact_check</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-body-md font-extrabold text-on-surface truncate">NCERT Solutions</span>
                  <span className="block text-xs text-on-surface-variant truncate">Step-by-step answers</span>
                </span>
              </button>
            )}

            <Link
              to={`/mind-map/${chapterId}`}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border-subtle dark:border-[#2e3f5f] glass-card hover:border-primary/50 text-left transition-all duration-200 interactive-hover-lift shadow-xs"
            >
              <span className="shrink-0 w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-[22px]">account_tree</span>
              </span>
              <span className="min-w-0">
                <span className="block text-body-md font-extrabold text-on-surface truncate">Mind Map</span>
                <span className="block text-xs text-on-surface-variant truncate">Visual concept map</span>
              </span>
            </Link>

            <Link
              to={`/flashcards/${chapterId}`}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border-subtle dark:border-[#2e3f5f] glass-card hover:border-primary/50 text-left transition-all duration-200 interactive-hover-lift shadow-xs"
            >
              <span className="shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-[22px]">style</span>
              </span>
              <span className="min-w-0">
                <span className="block text-body-md font-extrabold text-on-surface truncate">Flashcards</span>
                <span className="block text-xs text-on-surface-variant truncate">Quick revision cards</span>
              </span>
            </Link>

            <Link
              to={`/slide-deck/${chapterId}`}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border-subtle dark:border-[#2e3f5f] glass-card hover:border-primary/50 text-left transition-all duration-200 interactive-hover-lift shadow-xs"
            >
              <span className="shrink-0 w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-[22px]">auto_stories</span>
              </span>
              <span className="min-w-0">
                <span className="block text-body-md font-extrabold text-on-surface truncate">AI Learning Deck</span>
                <span className="block text-xs text-on-surface-variant truncate">AI-generated slide lesson</span>
              </span>
            </Link>

            <Link
              to={`/infographic/${chapterId}`}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border-subtle dark:border-[#2e3f5f] glass-card hover:border-primary/50 text-left transition-all duration-200 interactive-hover-lift shadow-xs"
            >
              <span className="shrink-0 w-10 h-10 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-[22px]">dashboard</span>
              </span>
              <span className="min-w-0">
                <span className="block text-body-md font-extrabold text-on-surface truncate">Infographic</span>
                <span className="block text-xs text-on-surface-variant truncate">Whole chapter at a glance</span>
              </span>
            </Link>

            <Link
              to={`/pre-assessment/${chapterId}`}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border-subtle dark:border-[#2e3f5f] glass-card hover:border-primary/50 text-left transition-all duration-200 interactive-hover-lift shadow-xs"
            >
              <span className="shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shadow-2xs">
                <span className="material-symbols-outlined text-[22px]">quiz</span>
              </span>
              <span className="min-w-0">
                <span className="block text-body-md font-extrabold text-on-surface truncate">Practice</span>
                <span className="block text-xs text-on-surface-variant truncate">Test your understanding</span>
              </span>
            </Link>
          </div>
        </aside>
        </div>
      </div>

      {/* Right-side Table of Contents / Page Navigator drawer — page-based
          (not "sections", since no chapter outline/heading data exists
          anywhere once the reader moved to rendering the real PDF
          directly) — real per-page thumbnails in a compact scrollable
          list. */}
      {tocOpen && (
        <>
          <div
            className={`sm:hidden fixed inset-x-0 bottom-0 ${isFocusMode ? 'top-0' : 'top-[72px]'} bg-black/40 z-40 animate-fade-in`}
            onClick={() => setTocOpen(false)}
            aria-hidden="true"
          />
          <div className={`fixed right-0 ${isFocusMode ? 'top-0' : 'top-[72px]'} bottom-0 z-40 w-full sm:w-[320px] bg-white dark:bg-[#152238] border-l border-border-subtle dark:border-[#2e3f5f] shadow-[-12px_0_35px_rgba(0,0,0,0.12)] dark:shadow-[-12px_0_35px_rgba(0,0,0,0.5)] flex flex-col animate-fade-in`}>
            <div className="flex items-center justify-between p-4 border-b border-border-subtle dark:border-[#2e3f5f] shrink-0">
              <span className="font-bold text-sm text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">toc</span>
                Page Navigator
              </span>
              <button
                type="button"
                onClick={() => setTocOpen(false)}
                aria-label="Close Page Navigator"
                className="p-1.5 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-error/10 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
              {pageBookmarks.length > 0 && (
                <div className="mb-2 pb-2 border-b border-border-subtle dark:border-[#2e3f5f]">
                  <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 px-1">Bookmarked Pages</p>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {pageBookmarks
                      .slice()
                      .sort((a, b) => a.page_index - b.page_index)
                      .map((b) => (
                        <button
                          key={b.bookmark_id}
                          type="button"
                          onClick={() => jumpToPageAndClose(b.page_index)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[13px]">bookmark</span>
                          Page {b.page_index + 1}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              {numPages ? (
                Array.from({ length: numPages }, (_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => jumpToPageAndClose(idx)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                      idx === pageIndex ? 'bg-primary/10 border border-primary' : 'hover:bg-surface-container-low border border-transparent'
                    }`}
                  >
                    {thumbnailBuffers[idx] && idx < activeThumbCount && (
                      <div className="shrink-0 rounded overflow-hidden border border-border-subtle dark:border-[#2e3f5f] w-[56px] h-[74px] flex items-center justify-center bg-white">
                        <Document file={thumbnailBuffers[idx]} loading={null} error={null}>
                          <Page
                            pageNumber={idx + 1}
                            width={56}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            loading={null}
                            onRenderSuccess={unlockNextThumbnail}
                            onRenderError={unlockNextThumbnail}
                          />
                        </Document>
                      </div>
                    )}
                    <span className={`flex items-center gap-1 text-body-md font-semibold ${idx === pageIndex ? 'text-primary' : 'text-on-surface'}`}>
                      Page {idx + 1}
                      {pageBookmarks.some((b) => b.page_index === idx) && (
                        <span className="material-symbols-outlined text-[14px] text-primary">bookmark</span>
                      )}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-body-md text-on-surface-variant text-center py-8">No pages to show yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Floating selection toolbar */}
      {toolbar && (
        <div
          className="fixed z-50 flex items-center gap-1 bg-on-surface text-white rounded-lg shadow-lg overflow-hidden animate-fade-in px-1.5 py-1.5"
          style={{ top: Math.max(toolbar.top, 8), left: toolbar.left, transform: 'translateX(-50%)' }}
        >
          <button
            onClick={openAskAI}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 rounded-md transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px] animate-pulse">auto_awesome</span>
            Ask AI
          </button>
          <div className="w-px h-5 bg-white/20" />
          <button
            onClick={openAddNote}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold hover:bg-white/10 rounded-md transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">note_add</span>
            Note
          </button>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-1.5 px-1.5">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => applyHighlight(c.id)}
                disabled={savingHighlight}
                title={`Highlight ${c.id}`}
                className="w-5 h-5 rounded-full border-2 border-white/60 hover:scale-125 hover:border-white transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resizable Side Drawer AI Tutor layout */}
      {askSliderOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className={`sm:hidden fixed inset-x-0 bottom-0 ${isFocusMode ? 'top-0' : 'top-[72px]'} bg-black/50 backdrop-blur-xs z-40 animate-fade-in`}
            onClick={closeAskSlider}
            aria-hidden="true"
          />

          {/* Adjustable Side Drawer Layout */}
          <div
            data-testid="ai-tutor-drawer"
            style={{
              width: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : `${tutorWidth}px`,
            }}
            className={`fixed right-0 bottom-0 ${isFocusMode ? 'top-0' : 'top-[72px]'} z-50 bg-white dark:bg-[#152238] border-l border-border-subtle dark:border-[#2e3f5f] shadow-2xl flex flex-col ${
              isTutorDragging ? '' : 'transition-[width] duration-200 ease-out'
            } animate-fade-in`}
          >
            {/* Drag Resize Handle */}
            <div
              onPointerDown={handlePointerDown}
              title="Drag left or right to adjust drawer width"
              data-testid="tutor-drawer-resize-handle"
              className="hidden sm:flex absolute left-0 top-0 bottom-0 w-3 -translate-x-1/2 cursor-col-resize z-20 items-center justify-center group touch-none select-none"
            >
              <div
                className={`w-1.5 h-14 rounded-full transition-all flex flex-col items-center justify-center gap-0.5 shadow-sm ${
                  isTutorDragging
                    ? 'bg-primary scale-y-125 w-2'
                    : 'bg-border-subtle dark:bg-[#3b4f74] group-hover:bg-primary group-hover:scale-y-125'
                }`}
              >
                <div className="w-0.5 h-0.5 bg-white/80 rounded-full" />
                <div className="w-0.5 h-0.5 bg-white/80 rounded-full" />
                <div className="w-0.5 h-0.5 bg-white/80 rounded-full" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-b border-border-subtle dark:border-[#2e3f5f] shrink-0 bg-surface-container-lowest/80 dark:bg-[#101a2c]/80 backdrop-blur-md">
              <div className="min-w-0 flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-blue-500 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                </span>
                <div className="min-w-0">
                  <span className="font-extrabold text-sm text-on-surface flex items-center gap-1.5">
                    AI Tutor
                  </span>
                  <p className="text-label-md text-on-surface-variant truncate">{chapterName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAskSlider}
                aria-label="Close AI Tutor"
                title="Close AI Tutor (Esc)"
                className="p-1.5 text-on-surface-variant dark:text-[#94a3b8] hover:text-error transition-colors rounded-xl hover:bg-error/10 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 custom-scrollbar">
              {askLoadingHistory ? (
                <div className="flex justify-center py-8">
                  <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
                </div>
              ) : askHistoryError ? (
                <p className="text-error text-body-md text-center">{askHistoryError}</p>
              ) : askMessages.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-2">
                  <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary inline-flex items-center justify-center mb-1 shadow-xs">
                    <span className="material-symbols-outlined text-[28px]">chat_bubble_outline</span>
                  </span>
                  <p className="text-body-md text-on-surface-variant text-center font-medium">
                    No conversation yet for this chapter — ask anything below to get started.
                  </p>
                </div>
              ) : (
                askMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[88%]">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant mb-1 px-1">
                        {msg.role === 'user' ? 'You' : 'AI Tutor'}
                      </p>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-body-md shadow-xs ${
                          msg.role === 'user'
                            ? 'whitespace-pre-wrap bg-gradient-to-r from-primary to-blue-600 text-on-primary rounded-br-2xs'
                            : 'bg-surface-container-high text-on-surface border border-border-subtle dark:border-[#2e3f5f] rounded-bl-2xs'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          msg.content
                        ) : (
                          <ReactMarkdown components={CHAT_MARKDOWN_COMPONENTS}>{msg.content}</ReactMarkdown>
                        )}
                      </div>

                      {/* Citation chips */}
                      {Array.isArray(msg.citations) && msg.citations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                          {msg.citations.map((c, cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => {
                                if (c.content_type === 'ncert_solution') jumpToSolutionPage(c.page);
                                else if (c.content_type === 'ncert_notes') jumpToNotesPage(c.page);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-150 cursor-pointer shadow-2xs hover:scale-105"
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {c.content_type === 'ncert_solution' ? 'fact_check' : 'sticky_note_2'}
                              </span>
                              {c.content_type === 'ncert_solution'
                                ? `NCERT Solutions — Ex ${c.exercise ?? ''}${c.question_number ? `, Q${c.question_number}` : ''}`
                                : `NCERT Notes — Page ${(c.page ?? 0) + 1}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {askSending && (
                <div className="flex justify-start">
                  <div className="bg-surface-container-high border border-border-subtle dark:border-[#2e3f5f] rounded-2xl px-4 py-3 flex items-center gap-1.5 shadow-xs">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary/70 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      ></span>
                    ))}
                  </div>
                </div>
              )}
              <div ref={askScrollRef} />
            </div>
            <form onSubmit={sendAskFollowUp} className="p-3 border-t border-border-subtle dark:border-[#2e3f5f] flex items-center gap-2 shrink-0 bg-surface-container-lowest/50 dark:bg-[#101a2c]/50">
              <input
                type="text"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder="Ask about this chapter…"
                disabled={askLoadingHistory || askSending}
                className="flex-1 rounded-full border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#1e2d4a] px-4 py-2 text-sm text-on-surface dark:text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={askLoadingHistory || askSending || !askInput.trim()}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-40 cursor-pointer shadow-xs transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </form>
          </div>
        </>
      )}

      {/* Inline Add-Note panel */}
      {noteForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setNoteForm(null)}>
          <div className="bg-white dark:bg-[#152238] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-border-subtle dark:border-[#2e3f5f] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border-subtle dark:border-[#2e3f5f] pb-3">
              <span className="material-symbols-outlined text-primary text-[22px]">note_add</span>
              <h2 className="font-extrabold text-lg text-on-surface dark:text-[#f1f5f9]">Add Note</h2>
            </div>
            <input
              type="text"
              value={noteForm.title}
              onChange={(e) => setNoteForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Title"
              className="w-full rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#1e2d4a] px-3.5 py-2 text-sm text-on-surface dark:text-[#f1f5f9] focus:ring-2 focus:ring-primary/40 focus:outline-none"
            />
            <textarea
              value={noteForm.content}
              onChange={(e) => setNoteForm((prev) => ({ ...prev, content: e.target.value }))}
              rows={5}
              className="w-full rounded-xl border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#1e2d4a] px-3.5 py-2 text-sm text-on-surface dark:text-[#f1f5f9] focus:ring-2 focus:ring-primary/40 focus:outline-none"
            />
            {noteForm.error && <p className="text-error text-body-md">{noteForm.error}</p>}
            <div className="flex justify-end gap-2.5 pt-1">
              <button onClick={() => setNoteForm(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors">
                Cancel
              </button>
              <button
                onClick={saveNote}
                disabled={noteForm.saving || !noteForm.content.trim()}
                className="px-5 py-2 rounded-xl text-sm bg-primary text-on-primary font-bold hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-md transition-all active:scale-95"
              >
                {noteForm.saved ? 'Saved!' : noteForm.saving ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default ChapterReader;
