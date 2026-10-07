import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Sparkles,
  Trophy,
  Check,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  GitFork,
  Layers,
  Book,
  PieChart,
  ClipboardList,
  FileText,
  CheckSquare,
  Target,
} from 'lucide-react';
import EducationService from '../../../services/EducationService';

// Custom 3D SVG Illustrations
const StudyGirlHeroIllustration = () => (
  <svg width="240" height="110" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto max-h-[110px]">
    <defs>
      <linearGradient id="girlHair" x1="0" y1="0" x2="30" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7C2D12" />
        <stop offset="1" stopColor="#451A03" />
      </linearGradient>
      <linearGradient id="bulbGrad" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE047" />
        <stop offset="1" stopColor="#EAB308" />
      </linearGradient>
    </defs>

    {/* Lightbulb glowing overhead */}
    <circle cx="150" cy="22" r="14" fill="#FEF08A" fillOpacity="0.5" className="animate-pulse" />
    <path d="M144 22 C144 15 156 15 156 22 C156 26 152 28 152 32 H148 C148 28 144 26 144 22 Z" fill="url(#bulbGrad)" />
    <rect x="148" y="32" width="4" height="3" fill="#94A3B8" />

    {/* Girl head & hair */}
    <path d="M100 48 C100 32 124 32 124 48 C124 64 100 64 100 48 Z" fill="url(#girlHair)" />
    <circle cx="112" cy="52" r="10" fill="#FED7AA" />
    <path d="M104 46 C108 40 116 40 120 46" fill="url(#girlHair)" />

    {/* Yellow Sweater Body */}
    <path d="M96 68 C96 62 128 62 128 68 L132 105 H92 L96 68 Z" fill="#F59E0B" />

    {/* Laptop */}
    <rect x="130" y="76" width="38" height="24" rx="4" fill="#1E293B" transform="rotate(-12 149 88)" />
    <rect x="134" y="80" width="30" height="16" rx="2" fill="#38BDF8" transform="rotate(-12 149 88)" />
    <path d="M125 100 L168 91 L166 96 L123 104 Z" fill="#64748B" />

    {/* Books Stack */}
    <rect x="175" y="88" width="55" height="10" rx="3" fill="#EF4444" />
    <rect x="178" y="80" width="50" height="10" rx="3" fill="#3B82F6" />
    <rect x="182" y="72" width="44" height="10" rx="3" fill="#10B981" />

    {/* Script Quote */}
    <text x="10" y="28" fill="#78350F" fontSize="13" fontStyle="italic" fontFamily="serif" fontWeight="600">Learn</text>
    <text x="22" y="46" fill="#78350F" fontSize="13" fontStyle="italic" fontFamily="serif" fontWeight="600">Practice</text>
    <text x="14" y="64" fill="#78350F" fontSize="13" fontStyle="italic" fontFamily="serif" fontWeight="600">Understand</text>
    <text x="32" y="82" fill="#78350F" fontSize="13" fontStyle="italic" fontFamily="serif" fontWeight="600">Grow</text>
    <text x="44" y="98" fill="#EF4444" fontSize="14" fontFamily="sans-serif">♥</text>
  </svg>
);

const TrophyIllustration = () => (
  <svg width="90" height="75" viewBox="0 0 90 75" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Books Base */}
    <rect x="10" y="58" width="70" height="12" rx="4" fill="#9333EA" />
    <rect x="15" y="48" width="60" height="12" rx="4" fill="#3B82F6" />

    {/* Golden Trophy Cup */}
    <path d="M30 18 C30 18 30 38 45 38 C60 38 60 18 60 18 H30 Z" fill="#F59E0B" />
    <rect x="41" y="38" width="8" height="12" fill="#D97706" />
    <rect x="35" y="46" width="20" height="4" rx="2" fill="#B45309" />
    <path d="M24 22 C22 22 22 30 30 30" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
    <path d="M66 22 C68 22 68 30 60 30" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
    <circle cx="45" cy="12" r="3" fill="#FDE047" />
  </svg>
);

const TargetIllustration = () => (
  <svg width="85" height="75" viewBox="0 0 85 75" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Stack of books */}
    <rect x="5" y="55" width="75" height="14" rx="4" fill="#6366F1" />
    <rect x="10" y="45" width="65" height="12" rx="4" fill="#EC4899" />

    {/* Target Bullseye */}
    <circle cx="42" cy="26" r="22" fill="#EF4444" />
    <circle cx="42" cy="26" r="16" fill="#FFFFFF" />
    <circle cx="42" cy="26" r="10" fill="#EF4444" />
    <circle cx="42" cy="26" r="4" fill="#FDE047" />

    {/* Arrow */}
    <path d="M56 12 L44 24" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
    <path d="M58 8 L54 14 M60 12 L54 16" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const buildNodes = (chapters, progressByChapter, manuallyUnlockedChapterIds = new Set()) => {
  let frontierReached = false;
  return chapters.map((c) => {
    const p = progressByChapter.get(c.chapter_id);
    const status = p?.status || 'not_started';
    const progress = Number(p?.progress_percent || 0);
    let state;
    if (status === 'completed') {
      state = 'mastered';
    } else if (manuallyUnlockedChapterIds.has(c.chapter_id)) {
      state = 'unlocked';
      frontierReached = true;
    } else if (frontierReached) {
      state = 'locked';
    } else if (status === 'in_progress') {
      state = 'current';
      frontierReached = true;
    } else {
      state = 'unlocked';
      frontierReached = true;
    }
    return {
      chapter_id: c.chapter_id,
      name: c.name,
      chapter_order: c.chapter_order,
      progress,
      state,
      hasNcertNotes: Boolean(c.has_ncert_notes),
      hasNcertSolutions: Boolean(c.has_ncert_solutions),
    };
  });
};

const SubjectTabs = [
  { key: 'math', names: ['math', 'mathematics', 'algebra', 'geometry'], label: 'Mathematics', icon: '∑', activeBg: 'bg-[#5B50F6] text-white', inactiveBg: 'bg-purple-50 text-purple-700' },
  { key: 'science', names: ['science', 'sci', 'biology', 'chemistry', 'physics'], label: 'Science', icon: '🧪', activeBg: 'bg-[#0284C7] text-white', inactiveBg: 'bg-sky-50 text-sky-700' },
  { key: 'english', names: ['english', 'eng', 'literature', 'language'], label: 'English', icon: '📖', activeBg: 'bg-[#E11D48] text-white', inactiveBg: 'bg-rose-50 text-rose-700' },
  { key: 'social', names: ['social', 'social studies', 'history', 'sst'], label: 'Social Studies', icon: '🌐', activeBg: 'bg-[#15803D] text-white', inactiveBg: 'bg-emerald-50 text-emerald-700' },
  { key: 'hindi', names: ['hindi', 'hin', 'sanskrit'], label: 'Hindi', icon: 'अ', activeBg: 'bg-[#7E22CE] text-white', inactiveBg: 'bg-purple-50 text-purple-700' },
];

const LearningPath = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [studentProfileId, setStudentProfileId] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [progressByChapter, setProgressByChapter] = useState(new Map());
  const [expandedChapterId, setExpandedChapterId] = useState(null);
  const [unlocking, setUnlocking] = useState(false);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profileRes = await EducationService.getMyProfile();
        if (cancelled) return;
        const profile = profileRes?.data;
        const subjectList = (profile?.subjects || []).map((s) => ({ id: s.subject_id, name: s.name }));
        setSubjects(subjectList);

        const spId = profile?.student_profile_id;
        setStudentProfileId(spId || null);
        const progressRes = spId ? await EducationService.getChapterProgress(spId) : { data: [] };
        if (cancelled) return;
        setProgressByChapter(new Map((progressRes?.data || []).map((p) => [p.chapter_id, p])));

        const requestedId = Number(searchParams.get('subject'));
        const initialSubject = subjectList.find((s) => s.id === requestedId) || subjectList[0] || null;
        setSelectedSubjectId(initialSubject?.id || null);
      } catch {
        if (!cancelled) setError("Couldn't load your learning path. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) return;
    let cancelled = false;
    (async () => {
      setLoadingChapters(true);
      try {
        const res = await EducationService.getChapters(selectedSubjectId, true);
        if (!cancelled) setChapters(res?.data || []);
      } catch {
        if (!cancelled) setError("Couldn't load chapters for this subject.");
      } finally {
        if (!cancelled) setLoadingChapters(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSubjectId]);

  const handleSelectSubject = (id) => {
    setSelectedSubjectId(id);
    setSearchParams({ subject: id }, { replace: true });
  };

  const handleToggleExpand = (chapterId) => {
    setExpandedChapterId((prev) => (prev === chapterId ? null : chapterId));
  };

  const handleNodeSelect = async (node) => {
    if (node.state === 'locked') {
      if (!studentProfileId || unlocking) return;
      setExpandedChapterId(node.chapter_id);
      setUnlocking(true);
      try {
        const res = await EducationService.updateChapterProgress(studentProfileId, {
          chapterId: node.chapter_id,
          manuallyUnlocked: true,
        });
        if (res?.data) {
          setProgressByChapter((prev) => new Map(prev).set(node.chapter_id, res.data));
        }
      } catch {
      } finally {
        setUnlocking(false);
      }
      return;
    }
    if (node.state === 'mastered') navigate(`/read/${node.chapter_id}?subject=${selectedSubjectId}`);
    else if (node.state === 'current') navigate(`/read/${node.chapter_id}?subject=${selectedSubjectId}`);
    else navigate(`/read/${node.chapter_id}?subject=${selectedSubjectId}`);
  };

  const handleFlashcards = (node, subjectId) => {
    navigate(`/flashcards/${node.chapter_id}?subject=${subjectId}`);
  };

  const handleAILearningDeck = (node, subjectId) => {
    navigate(`/slide-deck/${node.chapter_id}?subject=${subjectId}`);
  };

  const handleInfographic = (node, subjectId) => {
    navigate(`/infographic/${node.chapter_id}?subject=${subjectId}`);
  };

  const handleRead = (node, subjectId) => {
    navigate(`/read/${node.chapter_id}${subjectId ? `?subject=${subjectId}` : ''}`);
  };

  const handleReadNotes = (node) => {
    navigate(`/read/${node.chapter_id}?view=notes`);
  };

  const handleReadSolutions = (node) => {
    navigate(`/read/${node.chapter_id}?view=solutions`);
  };

  const handleMindMap = (node, subjectId) => {
    navigate(`/mind-map/${node.chapter_id}?subject=${subjectId}`);
  };

  const manuallyUnlockedChapterIds = new Set(
    [...progressByChapter.values()].filter((p) => p.manually_unlocked_at).map((p) => p.chapter_id)
  );

  const hasSections = chapters.some((c) => c.content_type === 'prose' || c.content_type === 'poetry');
  const sections = hasSections
    ? [
        { key: 'prose', label: 'Prose', chapters: chapters.filter((c) => c.content_type === 'prose') },
        { key: 'poetry', label: 'Poetry', chapters: chapters.filter((c) => c.content_type === 'poetry') },
        { key: 'other', label: 'Other', chapters: chapters.filter((c) => c.content_type !== 'prose' && c.content_type !== 'poetry') },
      ].filter((s) => s.chapters.length > 0)
    : [{ key: 'all', label: null, chapters }];

  const nodeSections = sections.map((s) => ({
    ...s,
    nodes: buildNodes(s.chapters, progressByChapter, manuallyUnlockedChapterIds),
  }));
  const nodes = nodeSections.flatMap((s) => s.nodes);

  useEffect(() => {
    if (nodes.length > 0 && expandedChapterId === null) {
      const activeNode = nodes.find((n) => n.state === 'current' || n.state === 'unlocked') || nodes[0];
      if (activeNode) {
        setExpandedChapterId(activeNode.chapter_id);
      }
    }
  }, [chapters, progressByChapter]);

  const masteredCount = nodes.filter((n) => n.state === 'mastered').length;
  const overallPercent = nodes.length > 0 ? Math.round((masteredCount / nodes.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#F7F3EA] dark:bg-[#0b1324] py-6 px-2 sm:px-3 transition-colors">
      <div className="w-full space-y-8">
        
        {/* Top Hero Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#5B50F6] text-white flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0 mt-1">
              <BookOpen className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
                Study Journey
              </h1>
              <p className="text-slate-500 font-medium text-base sm:text-lg mt-1">
                Your step-by-step learning journey for the current term.
              </p>
            </div>
          </div>

          {/* Right Banner Illustration */}
          <div className="bg-[#FFFDF9] border border-amber-200/60 rounded-3xl p-5 sm:p-6 flex items-center justify-between gap-4 shadow-xs max-w-xl w-full">
            <div className="w-60 sm:w-72 shrink-0">
              <StudyGirlHeroIllustration />
            </div>
          </div>
        </div>

        {/* Subject Selection Tabs */}
        {subjects.length > 0 && (
          <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-2 flex items-center gap-2.5 overflow-x-auto shadow-xs custom-scrollbar">
            {subjects.map((sub) => {
              const matchedTab = SubjectTabs.find((t) => t.names.some((n) => sub.name.toLowerCase().includes(n)));
              const isSelected = sub.id === selectedSubjectId;
              const icon = matchedTab?.icon || '📖';

              return (
                <button
                  key={sub.id}
                  onClick={() => handleSelectSubject(sub.id)}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-2 shrink-0 ${
                    isSelected
                      ? 'bg-[#5B50F6] text-white shadow-sm scale-[1.02]'
                      : 'bg-slate-100/70 hover:bg-slate-200/80 text-slate-700'
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  <span>{sub.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Keep Going Progress Banner */}
        <div className="bg-[#F5F3FF] border border-purple-200/70 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs relative overflow-hidden">
          <div className="space-y-1 text-center sm:text-left flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="font-black text-slate-900 text-lg sm:text-xl">
                Keep going on your learning journey!
              </h2>
            </div>
            <p className="text-slate-600 text-xs sm:text-sm font-medium">
              Practice regularly, use learning resources and track your progress.
            </p>

            {/* Smooth Progress Bar */}
            <div className="w-full sm:w-72 h-3.5 bg-purple-200/60 rounded-full overflow-hidden mt-3 relative">
              <div
                className="h-full bg-[#5B50F6] rounded-full transition-all duration-700 ease-out"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:block">
              <TrophyIllustration />
            </div>
            <button
              onClick={() => navigate('/progress')}
              className="bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#5B50F6] font-extrabold px-5 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <span>View Progress</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Step-by-Step Learning Timeline */}
        {loadingChapters ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center text-slate-500 space-y-2 border border-slate-200">
            <p className="font-bold">No chapters published for this subject yet.</p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-10 space-y-6">
            {/* Vertical Timeline Line */}
            <div className="absolute left-[20px] sm:left-[35px] top-6 bottom-6 w-0.5 bg-slate-200 pointer-events-none" />

            {nodeSections.map((section) => (
              <div key={section.key} className="space-y-6">
                {section.label && (
                  <h3 className="text-lg font-black text-slate-900 pl-4">{section.label}</h3>
                )}

                {section.nodes.map((node, index) => {
                  const isExpanded = expandedChapterId === node.chapter_id;
                  const isCompleted = node.state === 'mastered';
                  const isInProgress = node.state === 'current' || node.state === 'unlocked';
                  const isLocked = node.state === 'locked';
                  const stepNumber = index + 1;

                  return (
                    <div key={node.chapter_id} className="relative flex items-start gap-4 sm:gap-6">
                      
                      {/* Left Timeline Circle Badge */}
                      <div className="relative z-10 shrink-0 mt-3">
                        {isCompleted ? (
                          <div className="w-10 h-10 rounded-full bg-[#10B981] text-white flex items-center justify-center font-bold shadow-xs">
                            <Check className="w-5 h-5 stroke-[3]" />
                          </div>
                        ) : isInProgress ? (
                          <div className="w-10 h-10 rounded-full bg-[#5B50F6] text-white flex items-center justify-center font-extrabold text-sm shadow-md ring-4 ring-purple-100">
                            {stepNumber}
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">
                            {stepNumber}
                          </div>
                        )}
                      </div>

                      {/* Right Step Content Card */}
                      <div
                        className={`flex-1 rounded-3xl p-5 sm:p-6 transition-all duration-300 ${
                          isInProgress && isExpanded
                            ? 'bg-white border-2 border-[#5B50F6]/50 shadow-md space-y-5'
                            : isCompleted
                            ? 'bg-white border border-slate-200/80 shadow-2xs hover:shadow-md'
                            : 'bg-white/80 border border-slate-200/60 shadow-2xs'
                        }`}
                      >
                        {/* Step Card Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 font-bold mt-0.5">
                              {isLocked ? <Lock className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">
                                  Step {stepNumber}
                                </h3>

                                {isCompleted && (
                                  <span className="bg-emerald-100 text-emerald-700 font-extrabold text-xs px-3 py-1 rounded-full">
                                    Completed
                                  </span>
                                )}
                                {isInProgress && (
                                  <span className="bg-purple-100 text-purple-700 font-extrabold text-xs px-3 py-1 rounded-full flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    In Progress
                                  </span>
                                )}
                                {isLocked && (
                                  <span className="bg-slate-100 text-slate-500 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    Locked
                                  </span>
                                )}
                              </div>

                              <p className="font-bold text-sm text-slate-800 mt-1">
                                {node.name}
                              </p>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Chapter {node.chapter_order || stepNumber} · 7 Core Learning Resources
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons & Accordion Toggle */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {isCompleted ? (
                              <button
                                onClick={() => onRead(node, selectedSubjectId)}
                                className="bg-[#059669] hover:bg-[#047857] text-white px-5 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                              >
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>Review</span>
                              </button>
                            ) : isInProgress ? (
                              <button
                                onClick={() => handleNodeSelect(node)}
                                className="bg-[#5B50F6] hover:bg-[#4C40ED] text-white px-6 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                              >
                                <span>Continue</span>
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleNodeSelect(node)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-5 py-2.5 rounded-2xl text-sm flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Lock className="w-4 h-4" />
                                <span>Unlock</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleToggleExpand(node.chapter_id)}
                              className="w-10 h-10 rounded-2xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 flex items-center justify-center transition-all cursor-pointer shrink-0"
                            >
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Learning Resources Section */}
                        {isExpanded && (
                          <div className="pt-4 border-t border-slate-100 space-y-3">
                            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                              <Sparkles className="w-4 h-4 text-purple-600" />
                              <span>Learning Resources</span>
                            </div>

                            <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                              
                              {/* Resource 1: Mind Map */}
                              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                                    <GitFork className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">Mind Map</p>
                                    <p className="text-[11px] text-slate-400 font-medium truncate">Visual concept map</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleMindMap(node, selectedSubjectId)}
                                  disabled={isLocked}
                                  className="bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold px-4 py-1.5 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                                >
                                  Explore
                                </button>
                              </div>

                              {/* Resource 2: Flashcards */}
                              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                                    <Layers className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">Flashcards</p>
                                    <p className="text-[11px] text-slate-400 font-medium truncate">Key concepts at a glance</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleFlashcards(node, selectedSubjectId)}
                                  disabled={isLocked}
                                  className="bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold px-4 py-1.5 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                                >
                                  Study
                                </button>
                              </div>

                              {/* Resource 3: AI Learning Deck */}
                              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                    <Book className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">AI Learning Deck</p>
                                    <p className="text-[11px] text-slate-400 font-medium truncate">Structured study material</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleAILearningDeck(node, selectedSubjectId)}
                                  disabled={isLocked}
                                  className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-4 py-1.5 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                                >
                                  Open
                                </button>
                              </div>

                              {/* Resource 4: Infographic */}
                              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                                    <PieChart className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">Infographic</p>
                                    <p className="text-[11px] text-slate-400 font-medium truncate">Visual summary</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleInfographic(node, selectedSubjectId)}
                                  disabled={isLocked}
                                  className="bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold px-4 py-1.5 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                                >
                                  Open
                                </button>
                              </div>

                              {/* Resource 5: NCERT Notes */}
                              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">NCERT Notes</p>
                                    <p className="text-[11px] text-slate-400 font-medium truncate">Chapter notes & revision</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleReadNotes(node)}
                                  disabled={isLocked}
                                  className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold px-4 py-1.5 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                                >
                                  Read
                                </button>
                              </div>

                              {/* Resource 6: NCERT Solutions */}
                              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                                    <CheckSquare className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">NCERT Solutions</p>
                                    <p className="text-[11px] text-slate-400 font-medium truncate">Textbook Q&A solutions</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleReadSolutions(node)}
                                  disabled={isLocked}
                                  className="bg-teal-100 hover:bg-teal-200 text-teal-700 font-bold px-4 py-1.5 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                                >
                                  View
                                </button>
                              </div>

                              {/* Resource 7: Practice Test */}
                              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3 shadow-2xs md:col-span-2">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                    <ClipboardList className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">Practice Test</p>
                                    <p className="text-[11px] text-slate-400 font-medium truncate">Assessment & quiz questions</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleNodeSelect(node)}
                                  disabled={isLocked}
                                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold px-5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                                >
                                  Start
                                </button>
                              </div>

                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Bottom Stay Consistent Banner */}
        <div className="bg-[#EEF2FF] border border-indigo-200/80 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="shrink-0">
              <TargetIllustration />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg">
                Stay consistent!
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm font-medium mt-0.5">
                Complete your learning steps, practice regularly and unlock your next topics.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/my-learning/subjects')}
            className="bg-[#5B50F6] hover:bg-[#4C40ED] text-white font-bold px-6 py-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm shrink-0"
          >
            <span>View Full Journey</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

      </div>
    </main>
  );
};

export default LearningPath;

