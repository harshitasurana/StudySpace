import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  BookOpen,
  Plus,
  ChevronDown,
  Paperclip,
  Wand2,
  Mic,
  Send,
  Copy,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  FileText,
  ClipboardList,
  Layers,
  GitFork,
  Book,
  PieChart,
  TrendingUp,
  Bookmark,
  ChevronRight,
  HelpCircle,
  Check,
  X,
} from 'lucide-react';
import EducationService from '../../../services/EducationService';
import { navigateToCitation, citationPageLabel } from '../shared/citationNavigation';

// No Tailwind typography plugin in this app — same explicit component
// styling approach as ChapterReader.jsx's/MyNotes.jsx's markdown
// rendering. Left without an explicit text color so it inherits the chat
// bubble's own color (user bubbles are on-primary, assistant on-surface).
const CHAT_MARKDOWN_COMPONENTS = {
  h2: ({ children }) => <h4 className="font-bold text-body-lg mt-3 mb-1 first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="font-bold text-body-md mt-2 mb-1">{children}</h5>,
  p: ({ children }) => <p className="text-body-md mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
};

// Sentinel chapter selection meaning "search every chapter of the
// selected subject" — a student who knows the subject but not which
// chapter a question belongs to. Kept as a string so it can never collide
// with a real numeric chapter_id; every place that reads selectedChapterId
// as a real id (history load, New Chat, bookmark/note actions) checks for
// this sentinel first and no-ops/degrades instead of sending it to an
// endpoint that expects a real chapter_id.
const ANY_CHAPTER = 'any';

const SUGGESTED_PROMPTS = [
  'Explain this chapter to me',
  'Give me a quick summary',
  'What are the key concepts?',
  'Quiz me on this chapter',
];

// Prompt templates a mode chip wraps the question in. "" (custom text)
// falls back to a sensible chapter-wide default when the input is empty,
// so clicking a mode alone (no typed question) still does something
// useful.
const EXPLAIN_MODES = [
  { id: 'eli10', label: "Explain Like I'm 10", icon: 'child_care', wrap: (q) => `Explain this like I'm 10 years old: ${q}`, default: "Explain this chapter to me like I'm 10 years old." },
  { id: 'exams', label: 'Explain for Exams', icon: 'school', wrap: (q) => `Explain this in exam-focused terms, covering what I need to know: ${q}`, default: 'Explain this chapter in exam-focused terms — what are the key points I need to know?' },
  { id: 'real_life', label: 'Real Life Examples', icon: 'public', wrap: (q) => `Give me real-life examples related to: ${q}`, default: 'Give me real-life examples related to this chapter.' },
  { id: 'examples', label: 'AI Generated Examples', icon: 'lightbulb', wrap: (q) => `Give me a few worked examples for: ${q}`, default: "Give me a few worked examples from this chapter's concepts." },
  { id: 'visual', label: 'Visual Explanation', icon: 'visibility', wrap: (q) => `Explain this with as much visual/diagram detail as possible: ${q}`, default: 'Explain this chapter with visual/diagram detail where possible.' },
];

// Sections the spec calls for that need real infrastructure this app
// doesn't have yet (a PDF upload + vision pipeline, a drawing canvas, a
// symbolic-math solver, a code sandbox) — shown for real in the UI,
// honestly marked, rather than faked as working buttons. Voice Chat and
// Image Question used to be here too — they're real, working features
// now (see the mic button and the image-attach button below), not
// placeholders.
const COMING_SOON_MODES = [
  { id: 'pdf', label: 'PDF Question', icon: 'picture_as_pdf' },
  { id: 'draw', label: 'Draw Diagram', icon: 'draw' },
  { id: 'formula', label: 'Formula Solver', icon: 'functions' },
  { id: 'code', label: 'Code Runner', icon: 'code' },
];

const TypingDots = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-2 h-2 rounded-full bg-on-surface-variant animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      ></span>
    ))}
  </div>
);

// Renders where an answer's grounding actually came from — same pattern
// SlideDeck.jsx/Infographic.jsx already use. Deliberately reads
// msg.citations (page-level {content_type,source,page,chapter,...}
// objects, only present for NCERT Notes/Solutions-sourced chunks), NOT
// msg.sources (main.py's chat route also returns a flat list of plain
// document-name strings with no page data — not enough to build a real
// jump-to-page link from). Citations were always captured on the
// message object (see sendQuestion/handleVoiceTurn below) but never
// rendered until now; this matters even more for voice, since TTS is
// instructed to never read a citation aloud (see
// VOICE_RESPONSE_INSTRUCTIONS on the AI-service side) — the source
// still needs to be visible on screen somewhere.
const MessageSources = ({ citations, navigate, chapterId }) => {
  if (!citations || citations.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {citations.map((citation, i) => (
        <button
          key={i}
          type="button"
          onClick={() => navigateToCitation(navigate, chapterId, citation)}
          className="flex items-center gap-1 text-label-md text-primary underline cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">menu_book</span>
          {citation.chapter || 'Source'}{citationPageLabel(citation)}
        </button>
      ))}
    </div>
  );
};

const MessageFigures = ({ figures, onBookmark, bookmarkedKeys }) => {
  if (!figures || figures.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
      {figures.map((fig, idx) => {
        const key = fig.figure_id || fig.image_url || idx;
        const bookmarked = bookmarkedKeys.has(key);
        return (
          <div key={key} className="rounded-lg overflow-hidden border border-border-subtle bg-surface-container-lowest relative">
            {fig.image_url && <img src={fig.image_url} alt={fig.caption || fig.reference_label || 'Textbook figure'} className="w-full h-auto" />}
            {fig.image_url && (
              <button
                onClick={() => onBookmark(key, fig)}
                disabled={bookmarked}
                title={bookmarked ? 'Bookmarked' : 'Bookmark this diagram'}
                className="absolute top-1 right-1 bg-white/90 rounded-full p-1 cursor-pointer disabled:cursor-default"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">{bookmarked ? 'bookmark' : 'bookmark_border'}</span>
              </button>
            )}
            {(fig.caption || fig.reference_label) && (
              <p className="text-label-md text-on-surface-variant px-2 py-1">{fig.caption || fig.reference_label}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

const TutorChat = () => {
  const navigate = useNavigate();

  // Optional deep-link from AI Sessions ("Resume") —
  // ?subject=&chapter=&conversation= pre-select a specific chapter's
  // thread (and, if given, one exact past conversation within it — a
  // chapter can have several now) instead of defaulting to the first
  // subject/chapter's most recent thread. Only honored once, on initial
  // load: a later manual subject switch should behave normally (jump to
  // that subject's first chapter's latest conversation), not keep
  // snapping back to the deep link.
  const [searchParams] = useSearchParams();
  const deepLinkChapterId = useRef(Number(searchParams.get('chapter')) || null);
  const deepLinkConversationId = useRef(Number(searchParams.get('conversation')) || null);

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [bookmarkedIndexes, setBookmarkedIndexes] = useState(new Set());
  const [bookmarkedFigureKeys, setBookmarkedFigureKeys] = useState(new Set());
  const [bookmarkingIndex, setBookmarkingIndex] = useState(null);
  const [notedIndexes, setNotedIndexes] = useState(new Set());
  const [notingIndex, setNotingIndex] = useState(null);
  const [startingNewChat, setStartingNewChat] = useState(false);
  const [activeMode, setActiveMode] = useState(null);
  const [savingConversation, setSavingConversation] = useState(false);
  const [conversationSaved, setConversationSaved] = useState(false);
  const [comingSoonLabel, setComingSoonLabel] = useState(null);

  // Image Question — a photo/screenshot attached to the next message
  // (read via the local Qwen vision pipeline server-side, see
  // ai_tutor_service.js's chatWithTutorImageService). imagePreviewUrl is
  // a local blob: URL for the just-picked file; once the message has
  // been sent, reloading history replaces it with the real MinIO URL the
  // backend resolves.
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const imageInputRef = useRef(null);

  // Push-to-talk voice mode — 'idle' | 'listening' | 'processing' | 'speaking'.
  // 'processing' covers both transcription and the tutor's own
  // generation time in one label (there's no streaming yet to
  // distinguish "transcribing" from "thinking" — that's Phase 2+).
  const [voiceState, setVoiceState] = useState('idle');
  const [voiceError, setVoiceError] = useState('');

  const scrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getMyProfile();
        if (cancelled) return;
        const profileSubjects = (res?.data?.subjects || []).map((s) => ({ id: s.subject_id, label: s.name }));
        setSubjects(profileSubjects);
        const requestedSubjectId = Number(searchParams.get('subject')) || null;
        const initialSubject = profileSubjects.find((s) => s.id === requestedSubjectId) || profileSubjects[0];
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
        const deepLinked = deepLinkChapterId.current && list.some((c) => c.chapter_id === deepLinkChapterId.current);
        setSelectedChapterId(deepLinked ? deepLinkChapterId.current : list.length > 0 ? list[0].chapter_id : null);
        deepLinkChapterId.current = null; // only ever honored once
      } catch {
        if (!cancelled) setMetaError("Couldn't load chapters for this subject.");
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSubjectId]);

  useEffect(() => {
    if (!selectedChapterId) return;
    // "Not sure which chapter" has no chapter to load history for yet —
    // each question can resolve to a different chapter, so there's no
    // single persisted thread to show. Start with a clean slate instead.
    if (selectedChapterId === ANY_CHAPTER) {
      setMessages([]);
      setActiveConversationId(null);
      setLoadingHistory(false);
      return;
    }
    // Only honored on the very first history load — same one-shot
    // reasoning as deepLinkChapterId, so a later manual "New Chat"/
    // chapter switch isn't dragged back to this specific old conversation.
    const requestedConversationId = deepLinkConversationId.current;
    deepLinkConversationId.current = null;

    let cancelled = false;
    (async () => {
      setLoadingHistory(true);
      try {
        const res = await EducationService.getTutorHistory(selectedChapterId, requestedConversationId);
        if (cancelled) return;
        setMessages(res?.data?.messages || []);
        setActiveConversationId(res?.data?.conversation_id || null);
        setBookmarkedIndexes(new Set());
        setBookmarkedFigureKeys(new Set());
        setNotedIndexes(new Set());
        setConversationSaved(false);
      } catch {
        if (!cancelled) {
          setMessages([]);
          setActiveConversationId(null);
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedChapterId]);

  // Switching chapters mid-recording/mid-playback would otherwise send a
  // voice turn to (or keep speaking for) the wrong chapter.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      audioPlayerRef.current?.pause();
      setVoiceState('idle');
      setImageFile(null);
      setImagePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
    };
  }, [selectedChapterId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const hasAutoSentQuestion = useRef(false);
  useEffect(() => {
    const qParam = searchParams.get('question');
    if (qParam && !hasAutoSentQuestion.current && selectedChapterId && !loadingHistory) {
      hasAutoSentQuestion.current = true;
      sendQuestion(qParam);
    }
  }, [searchParams, selectedChapterId, loadingHistory]);

  const hasTriggeredSnap = useRef(false);
  useEffect(() => {
    if (searchParams.get('snap') === 'true' && !hasTriggeredSnap.current) {
      hasTriggeredSnap.current = true;
      setTimeout(() => {
        imageInputRef.current?.click();
      }, 300);
    }
  }, [searchParams]);



  const sendQuestion = async (question) => {
    const trimmed = question.trim();
    if (!trimmed || sending || !selectedChapterId) return;

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setActiveMode(null);
    setSending(true);

    const isAnyChapter = selectedChapterId === ANY_CHAPTER;
    try {
      const res = await EducationService.chatWithTutor(
        isAnyChapter ? null : selectedChapterId,
        trimmed,
        // Each "not sure which chapter" question can resolve to a
        // different chapter's conversation server-side — always start
        // fresh rather than trying to continue a specific thread here.
        isAnyChapter ? null : activeConversationId,
        isAnyChapter ? selectedSubjectId : null
      );
      const data = res?.data || {};
      // The very first message of a brand new conversation - the backend
      // just created it and this is the only place its id becomes known.
      if (!isAnyChapter && !activeConversationId && data.conversation_id) setActiveConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || '',
          sources: data.source,
          citations: data.citations,
          figures: data.figures,
          identifiedChapter: data.identified_chapter || null,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I couldn't get an answer just now. Please try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Sends the currently-attached image (plus whatever text is typed, if
  // any) as one message — same optimistic-append/402-handling shape as
  // sendQuestion above, just routed through chatWithTutorImage instead.
  const sendImageQuestion = async (question) => {
    if (sending || !selectedChapterId || !imageFile) return;
    const trimmed = question.trim();
    const fileToSend = imageFile;
    const previewUrl = imagePreviewUrl;

    setMessages((prev) => [...prev, { role: 'user', content: trimmed, image_url: previewUrl }]);
    setInput('');
    setImageFile(null);
    setImagePreviewUrl('');
    setActiveMode(null);
    setSending(true);

    const isAnyChapter = selectedChapterId === ANY_CHAPTER;
    try {
      const res = await EducationService.chatWithTutorImage(
        isAnyChapter ? null : selectedChapterId,
        trimmed,
        fileToSend,
        isAnyChapter ? null : activeConversationId,
        isAnyChapter ? selectedSubjectId : null
      );
      const data = res?.data || {};
      if (!isAnyChapter && !activeConversationId && data.conversation_id) setActiveConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || '',
          sources: data.source,
          citations: data.citations,
          figures: data.figures,
          identifiedChapter: data.identified_chapter || null,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I couldn't get an answer just now. Please try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleImageButtonClick = () => {
    if (!selectedChapterId || sending) return;
    imageInputRef.current?.click();
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const removeSelectedImage = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (imageFile) {
      sendImageQuestion(input);
    } else if (activeMode) {
      const mode = EXPLAIN_MODES.find((m) => m.id === activeMode);
      sendQuestion(input.trim() ? mode.wrap(input.trim()) : mode.default);
    } else {
      sendQuestion(input);
    }
  };

  const handleModeClick = (mode) => {
    if (input.trim()) {
      setActiveMode((prev) => (prev === mode.id ? null : mode.id));
    } else {
      sendQuestion(mode.default);
    }
  };

  // Tap to start recording, tap again to stop and send — Phase 1's
  // "push-to-talk" (no VAD/auto-stop, no streaming; that's Phase 2/3).
  // A voice turn ends up as the exact same {role:'user'}/{role:'assistant'}
  // pair sendQuestion appends — one Tutor interface, not two chatbots.
  const startVoiceRecording = async () => {
    if (!selectedChapterId || voiceState !== 'idle') return;
    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setVoiceState('listening');
    } catch {
      setVoiceError("Couldn't access your microphone. Check your browser's microphone permission.");
    }
  };

  const stopVoiceRecordingAndSend = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || voiceState !== 'listening') return;

    setVoiceState('processing');
    recorder.addEventListener(
      'stop',
      async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        try {
          const res = await EducationService.sendVoiceTurn(selectedChapterId, blob, activeConversationId);
          const data = res?.data || {};
          if (!activeConversationId && data.conversation_id) setActiveConversationId(data.conversation_id);

          setMessages((prev) => [
            ...prev,
            { role: 'user', content: data.question_text || '' },
            { role: 'assistant', content: data.answer_text || '', sources: data.source, citations: data.citations, figures: data.figures },
          ]);

          if (data.audio_base64) {
            const audio = new Audio(`data:audio/${data.audio_format || 'wav'};base64,${data.audio_base64}`);
            audioPlayerRef.current = audio;
            setVoiceState('speaking');
            audio.onended = () => setVoiceState('idle');
            audio.onerror = () => setVoiceState('idle');
            audio.play().catch(() => setVoiceState('idle'));
          } else {
            setVoiceState('idle');
          }
        } catch (err) {
          setVoiceError(err?.response?.data?.message || "Didn't catch that — try again.");
          setVoiceState('idle');
        }
      },
      { once: true }
    );
    recorder.stop();
  };

  const handleMicClick = () => {
    if (voiceState === 'idle') startVoiceRecording();
    else if (voiceState === 'listening') stopVoiceRecordingAndSend();
    // 'processing'/'speaking' — mic is disabled, see the button below.
  };

  const handleNewChat = async () => {
    // Not a real per-chapter thread to restart — each "not sure which
    // chapter" question already starts fresh server-side (see sendQuestion).
    if (!selectedChapterId || selectedChapterId === ANY_CHAPTER || startingNewChat) return;
    setStartingNewChat(true);
    try {
      const res = await EducationService.startNewTutorConversation(selectedChapterId);
      setActiveConversationId(res?.data?.conversation_id || null);
      setMessages([]);
      setBookmarkedIndexes(new Set());
      setBookmarkedFigureKeys(new Set());
      setNotedIndexes(new Set());
      setConversationSaved(false);
    } catch {
      setMetaError("Couldn't start a new chat. Please try again.");
    } finally {
      setStartingNewChat(false);
    }
  };

  const handleBookmarkMessage = async (idx, content) => {
    // In "not sure which chapter" mode, selectedChapterId isn't a real
    // chapter — use the specific chapter this reply was identified as
    // coming from instead. No identifiedChapter (couldn't be resolved)
    // means nothing real to attribute the bookmark to.
    const chapterId = selectedChapterId === ANY_CHAPTER ? messages[idx]?.identifiedChapter?.chapter_id : selectedChapterId;
    if (!chapterId || bookmarkedIndexes.has(idx)) return;
    setBookmarkingIndex(idx);
    try {
      await EducationService.createBookmark({ chapterId, sourceType: 'tutor_message', content });
      setBookmarkedIndexes((prev) => new Set(prev).add(idx));
    } catch {
      // Non-critical — leave the button enabled so the student can retry.
    } finally {
      setBookmarkingIndex(null);
    }
  };

  const handleBookmarkFigure = async (key, fig) => {
    // MessageFigures' onBookmark isn't wired with a message index, so
    // there's no specific reply to attribute this to in "not sure which
    // chapter" mode — bookmarking a figure stays disabled there rather
    // than guessing/attributing to the wrong chapter.
    if (!selectedChapterId || selectedChapterId === ANY_CHAPTER || bookmarkedFigureKeys.has(key)) return;
    setBookmarkedFigureKeys((prev) => new Set(prev).add(key)); // optimistic — a lost diagram bookmark is low-stakes
    try {
      await EducationService.createBookmark({
        chapterId: selectedChapterId,
        sourceType: 'diagram',
        title: fig.caption || fig.reference_label || 'Textbook figure',
        content: fig.image_url,
      });
    } catch {
      setBookmarkedFigureKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  const handleSaveMessageAsNote = async (idx, content) => {
    // Same per-message identified-chapter fallback as handleBookmarkMessage.
    const chapterId = selectedChapterId === ANY_CHAPTER ? messages[idx]?.identifiedChapter?.chapter_id : selectedChapterId;
    if (!chapterId || notedIndexes.has(idx)) return;
    setNotingIndex(idx);
    try {
      await EducationService.createNote({ chapterId, title: content.slice(0, 80), content });
      setNotedIndexes((prev) => new Set(prev).add(idx));
    } catch {
      // Non-critical — leave the button enabled so the student can retry.
    } finally {
      setNotingIndex(null);
    }
  };

  // Asks the tutor to summarize the conversation so far — real chat call,
  // real grounded response — then the resulting answer is saveable as a
  // note just like any other message.
  const handleGenerateNotes = () => {
    sendQuestion('Please summarize our conversation so far into clear, organized study notes.');
  };

  const handleSaveConversation = async () => {
    if (!selectedChapterId || messages.length === 0 || savingConversation) return;
    setSavingConversation(true);
    try {
      const transcript = messages
        .map((m) => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`)
        .join('\n\n');
      const chapterName = chapters.find((c) => c.chapter_id === selectedChapterId)?.name || 'this chapter';
      await EducationService.createNote({
        chapterId: selectedChapterId,
        title: `Conversation — ${chapterName}`,
        content: transcript,
      });
      setConversationSaved(true);
      window.setTimeout(() => setConversationSaved(false), 2500);
    } catch {
      setMetaError('Failed to save this conversation. Please try again.');
    } finally {
      setSavingConversation(false);
    }
  };

  const showComingSoon = (label) => {
    setComingSoonLabel(label);
    window.setTimeout(() => setComingSoonLabel(null), 2000);
  };

  const currentSubjectObj = subjects.find((s) => s.id === selectedSubjectId);
  const currentChapterObj = chapters.find((c) => c.chapter_id === selectedChapterId);

  const SUGGESTION_PILLS = [
    'Explain with real life examples',
    'Show solved examples',
    'Create a quiz on this chapter',
    'Draw a diagram',
    'Make a summary',
  ];

  const learningTools = [
    {
      label: 'Generate Notes',
      desc: 'Get concise chapter notes',
      icon: FileText,
      iconBg: 'bg-purple-100 text-purple-600',
      onClick: handleGenerateNotes,
    },
    {
      label: 'Generate Quiz',
      desc: 'Practice with MCQs',
      icon: ClipboardList,
      iconBg: 'bg-blue-100 text-blue-600',
      onClick: () => navigate(`/practice/by-subject?subject=${selectedSubjectId}&chapter=${selectedChapterId}`),
    },
    {
      label: 'Generate Flashcards',
      desc: 'Key concepts at a glance',
      icon: Layers,
      iconBg: 'bg-emerald-100 text-emerald-600',
      onClick: () => navigate(`/flashcards/${selectedChapterId}?subject=${selectedSubjectId}`),
    },
    {
      label: 'Generate Mind Map',
      desc: 'Visual concept map',
      icon: GitFork,
      iconBg: 'bg-amber-100 text-amber-600',
      onClick: () => navigate(`/mind-map/${selectedChapterId}?subject=${selectedSubjectId}`),
    },
    {
      label: 'Generate Learning Deck',
      desc: 'Structured study material',
      icon: Book,
      iconBg: 'bg-indigo-100 text-indigo-600',
      onClick: () => navigate(`/slide-deck/${selectedChapterId}?subject=${selectedSubjectId}`),
    },
    {
      label: 'Generate Infographic',
      desc: 'Visual summary',
      icon: PieChart,
      iconBg: 'bg-rose-100 text-rose-600',
      onClick: () => navigate(`/infographic/${selectedChapterId}?subject=${selectedSubjectId}`),
    },
    {
      label: 'AI Study Plan',
      desc: 'Personalized learning plan',
      icon: TrendingUp,
      iconBg: 'bg-sky-100 text-sky-600',
      onClick: () => navigate('/ai-tutor/study-plan'),
    },
    {
      label: conversationSaved ? 'Saved Conversation!' : 'Save Conversation',
      desc: 'Bookmark this chat',
      icon: Bookmark,
      iconBg: 'bg-amber-100 text-amber-600',
      onClick: handleSaveConversation,
      disabled: messages.length === 0 || savingConversation,
    },
  ];

  const relatedResources = [
    {
      label: 'NCERT Textbook',
      desc: 'Chapter PDF and exercises',
      icon: Book,
      iconBg: 'bg-sky-100 text-sky-600',
      onClick: () => navigate(`/my-learning/learning-path?subject=${selectedSubjectId}`),
    },
    {
      label: 'Example Questions',
      desc: 'Try solved examples',
      icon: HelpCircle,
      iconBg: 'bg-emerald-100 text-emerald-600',
      onClick: () => sendQuestion('Show me 3 solved example questions from this chapter with step by step answers.'),
    },
  ];

  return (
    <main className="min-h-screen bg-[#F7F3EA] dark:bg-[#0b1324] py-6 px-3 sm:px-6 transition-colors">
      <div className="w-full space-y-6">

        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                Learn with AI
              </h1>
              <p className="text-slate-500 font-medium text-xs sm:text-sm mt-0.5">
                Ask questions, get step-by-step explanations, solve problems and explore concepts — all based on your textbook.
              </p>
            </div>
          </div>
        </div>

        {/* Floating Selectors Bar */}
        {subjects.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Subject Selector Pill */}
              <div className="relative">
                <select
                  value={selectedSubjectId || ''}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                  className="appearance-none bg-white border border-slate-200/90 hover:border-slate-300 rounded-full px-4 py-2 pr-9 text-xs sm:text-sm font-semibold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      ∑ {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Chapter Selector Pill */}
              <div className="relative flex-1 min-w-[200px]">
                <select
                  value={selectedChapterId || ''}
                  onChange={(e) => setSelectedChapterId(e.target.value === ANY_CHAPTER ? ANY_CHAPTER : Number(e.target.value))}
                  disabled={chapters.length === 0}
                  className="w-full appearance-none bg-white border border-slate-200/90 hover:border-slate-300 rounded-full px-4 py-2 pr-9 text-xs sm:text-sm font-semibold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer disabled:opacity-50"
                >
                  <option value={ANY_CHAPTER}>❓ Not sure which chapter</option>
                  {chapters.map((c) => (
                    <option key={c.chapter_id} value={c.chapter_id}>
                      📄 {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              disabled={!selectedChapterId || selectedChapterId === ANY_CHAPTER || startingNewChat || messages.length === 0}
              className="bg-purple-100/70 hover:bg-purple-200/80 text-purple-700 font-bold px-4 py-2 rounded-full text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default shrink-0 shadow-xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Chat</span>
            </button>
          </div>
        )}

        {/* Main 2-Column Interface */}
        {loadingMeta ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : metaError ? (
          <div className="bg-white rounded-3xl p-6 text-center text-slate-600 border border-slate-200">{metaError}</div>
        ) : (
          <div className="flex flex-col lg:flex-row items-start gap-6">

            {/* Left Column: Chat Area */}
            <div className="flex-1 w-full min-w-0 bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col h-[calc(100vh-230px)] min-h-[550px]">
              
              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
                {loadingHistory ? (
                  <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 my-auto">
                    <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3 shadow-xs">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">
                      Start your learning session
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-6 font-medium">
                      Ask any question about {currentChapterObj ? currentChapterObj.name : 'your chapter'} or choose a prompt below.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      
                      {/* USER MESSAGE */}
                      {msg.role === 'user' && (
                        <div className="flex items-start gap-2.5 max-w-xl">
                          <div className="bg-[#EDE9FE] text-[#3730A3] px-5 py-3 rounded-2xl text-xs sm:text-sm font-semibold shadow-2xs leading-relaxed">
                            {msg.image_url && (
                              <img src={msg.image_url} alt="Attached" className="max-w-[200px] rounded-lg mb-2 border border-purple-200" />
                            )}
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                            H
                          </div>
                        </div>
                      )}

                      {/* ASSISTANT MESSAGE */}
                      {msg.role === 'assistant' && (
                        <div className="w-full space-y-3">
                          {/* AI Header Line */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-slate-900 text-sm">StudySpace</span>
                              <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                {currentSubjectObj ? `Class 9 ${currentSubjectObj.label}` : 'Class 9 Mathematics'}
                              </span>
                            </div>

                            {/* Action Icons */}
                            <div className="flex items-center gap-1 text-slate-400">
                              <button
                                onClick={() => navigator.clipboard.writeText(msg.content)}
                                className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Copy response"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                                <ThumbsDown className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Response Text & Content */}
                          <div className="text-slate-800 text-xs sm:text-sm leading-relaxed space-y-3 pl-9">
                            <ReactMarkdown components={CHAT_MARKDOWN_COMPONENTS}>
                              {msg.content}
                            </ReactMarkdown>

                            <MessageFigures figures={msg.figures} onBookmark={() => {}} bookmarkedKeys={bookmarkedFigureKeys} />
                            <MessageSources citations={msg.citations} navigate={navigate} chapterId={selectedChapterId} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {sending && (
                  <div className="flex items-center gap-2 pl-9 text-purple-600 text-xs font-bold animate-pulse">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>StudySpace is thinking...</span>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>

              {/* Input Area & Suggestion Pills */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                {imagePreviewUrl && (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <img src={imagePreviewUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                      <button
                        onClick={removeSelectedImage}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">Image attached</span>
                  </div>
                )}

                {/* Floating Input Field */}
                <form onSubmit={handleSubmit} className="bg-white border border-slate-200/90 shadow-sm rounded-full px-4 py-2 flex items-center gap-3 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  
                  <button
                    type="button"
                    onClick={handleImageButtonClick}
                    className="text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
                    title="Attach image"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    placeholder="Ask a question or type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={sending || !selectedChapterId}
                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium"
                  />

                  <button
                    type="button"
                    className="text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
                    title="Magic prompt"
                  >
                    <Wand2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleMicClick}
                    className={`transition-colors cursor-pointer ${
                      voiceState === 'listening' ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-purple-600'
                    }`}
                    title="Voice input"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    disabled={sending || (!input.trim() && !imageFile) || !selectedChapterId}
                    className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-sm transition-all disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                {/* Quick Suggestion Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  {SUGGESTION_PILLS.map((pill) => (
                    <button
                      key={pill}
                      onClick={() => sendQuestion(pill)}
                      disabled={sending || !selectedChapterId}
                      className="shrink-0 bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 border border-slate-200/60 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {pill}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Sidebar */}
            <aside className="w-full lg:w-80 shrink-0 space-y-5">
              
              {/* Learning Tools Box */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Learning Tools</span>
                </div>

                <div className="space-y-1.5">
                  {learningTools.map((tool) => {
                    const IconComp = tool.icon;
                    return (
                      <button
                        key={tool.label}
                        onClick={tool.onClick}
                        disabled={tool.disabled}
                        className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200/60 transition-all text-left cursor-pointer group disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl ${tool.iconBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                              {tool.label}
                            </p>
                            <p className="text-[11px] font-medium text-slate-400">
                              {tool.desc}
                            </p>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Related Resources Box */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>Related Resources</span>
                </div>

                <div className="space-y-1.5">
                  {relatedResources.map((res) => {
                    const IconComp = res.icon;
                    return (
                      <button
                        key={res.label}
                        onClick={res.onClick}
                        className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200/60 transition-all text-left cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl ${res.iconBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                              {res.label}
                            </p>
                            <p className="text-[11px] font-medium text-slate-400">
                              {res.desc}
                            </p>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

            </aside>

          </div>
        )}

      </div>
    </main>
  );
};

export default TutorChat;
