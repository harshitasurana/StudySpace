import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import EducationService from '../../../services/EducationService';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Thumbnail themes for Interactive Lessons
const LESSON_THEMES = [
  { bg: 'from-sky-100 via-blue-50 to-indigo-100', accent: 'bg-sky-500', icon: 'landscape' },
  { bg: 'from-emerald-100 via-teal-50 to-green-100', accent: 'bg-emerald-500', icon: 'eco' },
  { bg: 'from-purple-100 via-violet-50 to-pink-100', accent: 'bg-purple-500', icon: 'science' },
  { bg: 'from-amber-100 via-yellow-50 to-orange-100', accent: 'bg-amber-500', icon: 'auto_stories' },
];

const MyLearningDecks = () => {
  const navigate = useNavigate();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regeneratingFor, setRegeneratingFor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterChapter, setSelectedFilterChapter] = useState('ALL');

  // Subject and Chapter selection states
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [generatingNew, setGeneratingNew] = useState(false);

  const loadSlideDecks = async () => {
    try {
      const res = await EducationService.listSlideDecks();
      setDecks(res?.data || []);
    } catch {
      setError("Couldn't load your interactive lessons. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlideDecks();
  }, []);

  // Fetch subjects
  useEffect(() => {
    (async () => {
      try {
        const res = await EducationService.getMyProfile();
        const list = res?.data?.subjects || [];
        setSubjects(list);
        if (list.length > 0) {
          setSelectedSubjectId(list[0].subject_id);
        }
      } catch (e) {
        console.error('Failed to load subjects', e);
      }
    })();
  }, []);

  // Fetch chapters for selected subject
  useEffect(() => {
    if (!selectedSubjectId) return;
    (async () => {
      try {
        const res = await EducationService.getChapters(selectedSubjectId);
        const list = res?.data || [];
        setChapters(list);
        if (list.length > 0) {
          setSelectedChapterId(list[0].chapter_id);
        } else {
          setSelectedChapterId('');
        }
      } catch (e) {
        console.error('Failed to load chapters', e);
      }
    })();
  }, [selectedSubjectId]);

  const handleGenerate = async () => {
    if (!selectedChapterId) return;
    setGeneratingNew(true);
    setError('');
    try {
      const res = await EducationService.generateSlideDeck(selectedChapterId);
      const deckId = res?.data?.slide_deck_id;
      navigate(`/slide-deck/${selectedChapterId}?deck=${deckId}&subject=${selectedSubjectId}`);
    } catch {
      setError("Couldn't start a new interactive lesson right now. Please try again.");
    } finally {
      setGeneratingNew(false);
    }
  };

  const goWatch = (d) => {
    navigate(`/slide-deck/${d.chapter_id}?deck=${d.slide_deck_id}&subject=${d.subject_id}`);
  };

  const reattempt = async (d) => {
    setRegeneratingFor(d.slide_deck_id);
    setError('');
    try {
      const res = await EducationService.generateSlideDeck(d.chapter_id);
      if (res?.data?.status === 'failed') {
        setError("Couldn't start a new interactive lesson right now. Please try again.");
        return;
      }
      navigate(`/slide-deck/${d.chapter_id}?deck=${res.data.slide_deck_id}&subject=${d.subject_id}`);
    } catch {
      setError("Couldn't start a new interactive lesson right now. Please try again.");
    } finally {
      setRegeneratingFor(null);
    }
  };

  return (
    <main className="flex-grow py-6 px-3 sm:px-6 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        
        {/* Top Hero Banner - Interactive Lesson */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          {/* Background blur */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-pink-50 rounded-full blur-3xl pointer-events-none" />

          {/* Left Title Box */}
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

          {/* Right 3D Open Book Illustration + Cursive Quote */}
          <div className="relative w-80 h-36 shrink-0 flex items-center justify-between z-10">
            {/* 3D Book Graphic */}
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

            {/* Handwritten cursive quote text */}
            <div className="text-right font-serif text-slate-600 text-sm leading-tight italic pr-2">
              Learn<br />
              Step-by-Step<br />
              With Visuals
            </div>
          </div>
        </motion.div>

        {/* Selection Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Select Subject */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Select Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            >
              {subjects.length === 0 && <option value="">Choose a subject</option>}
              {subjects.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Select Chapter / Topic */}
          <div className="md:col-span-5 space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Select Chapter / Topic</label>
            <select
              value={selectedChapterId}
              onChange={(e) => setSelectedChapterId(Number(e.target.value))}
              disabled={chapters.length === 0}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-60"
            >
              {chapters.length === 0 && <option value="">Choose a chapter or topic</option>}
              {chapters.map((c) => (
                <option key={c.chapter_id} value={c.chapter_id}>
                  {c.title || c.name || `Chapter ${c.chapter_number || c.chapter_id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <div className="md:col-span-3 flex items-end h-full pt-4 md:pt-5">
            <button
              onClick={handleGenerate}
              disabled={!selectedChapterId || generatingNew}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {generatingNew ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  Generating…
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
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-700 font-semibold text-sm rounded-xl border border-red-200">{error}</div>}

        {/* Your Recent Lessons Section */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Your Interactive Lessons</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Showing {decks.length} interactive slide decks across your subjects
              </p>
            </div>
            
            {/* Search filter input */}
            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder="Filter by chapter or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all shadow-xs"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <span className="material-symbols-outlined animate-spin text-4xl text-rose-500">progress_activity</span>
              <p className="text-sm font-semibold text-slate-500">Loading recent interactive lessons...</p>
            </div>
          ) : decks.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">auto_stories</span>
              </div>
              <p className="font-bold text-slate-800">No Interactive Lessons Generated Yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Choose a subject and chapter above and click <strong>Generate Interactive Lesson</strong> to create visual slide decks!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {decks
                .filter((d) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    (d.chapter_name && d.chapter_name.toLowerCase().includes(query)) ||
                    (d.subject_name && d.subject_name.toLowerCase().includes(query))
                  );
                })
                .map((d, idx) => {
                const theme = LESSON_THEMES[idx % LESSON_THEMES.length];
                const isClickable = d.status === 'completed' || d.status === 'processing';

                return (
                  <motion.div
                    key={d.slide_deck_id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => isClickable && goWatch(d)}
                    className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group ${
                      isClickable ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Landscape thumbnail with play icon overlay on bottom right */}
                    <div className={`w-full h-32 rounded-xl bg-gradient-to-tr ${theme.bg} p-4 flex items-center justify-center mb-3 relative overflow-hidden border border-slate-100`}>
                      <span className="material-symbols-outlined text-4xl text-slate-600/40">{theme.icon}</span>
                      {/* Play Button Overlay */}
                      <div className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 shadow-md flex items-center justify-center text-slate-800 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <span className="material-symbols-outlined text-lg">play_arrow</span>
                      </div>
                    </div>

                    {/* Content details */}
                    <div className="space-y-1">
                      <div className="flex items-start justify-between">
                        <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {d.chapter_name || `Chapter ${d.chapter_id}`}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            reattempt(d);
                          }}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                          title="Regenerate"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>

                      <p className="text-xs text-slate-500 font-medium">
                        {d.subject_name || 'Subject'} • Chapter {d.chapter_id || '1'}
                      </p>

                      <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 font-semibold border-t border-slate-100">
                        <span>{formatDate(d.created_at)}</span>
                        {d.status === 'completed' && <span className="text-emerald-600 font-bold">Ready</span>}
                        {d.status === 'processing' && <span className="text-amber-600 font-bold">Processing…</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
};

export default MyLearningDecks;
