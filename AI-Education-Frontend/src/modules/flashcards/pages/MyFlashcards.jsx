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

// Pastel colors for Revision Cards preview icons
const CARD_THEMES = [
  { bg: 'bg-emerald-50', border: 'border-emerald-100', iconColor: 'text-emerald-600', icon: 'local_florist' },
  { bg: 'bg-rose-50', border: 'border-rose-100', iconColor: 'text-rose-600', icon: 'science' },
  { bg: 'bg-purple-50', border: 'border-purple-100', iconColor: 'text-purple-600', icon: 'atom' },
  { bg: 'bg-amber-50', border: 'border-amber-100', iconColor: 'text-amber-600', icon: 'lightbulb' },
];

const MyFlashcards = () => {
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
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

  const loadFlashcards = async () => {
    try {
      const res = await EducationService.listFlashcardSets();
      setSets(res?.data || []);
    } catch {
      setError("Couldn't load your flashcards. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlashcards();
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
      const res = await EducationService.generateFlashcards(selectedChapterId, 8);
      const setId = res?.data?.set_id;
      navigate(`/flashcards/${selectedChapterId}?set=${setId}&subject=${selectedSubjectId}`);
    } catch {
      setError("Couldn't start a new revision cards set right now. Please try again.");
    } finally {
      setGeneratingNew(false);
    }
  };

  const goWatch = (set) => {
    navigate(`/flashcards/${set.chapter_id}?set=${set.set_id}&subject=${set.subject_id}`);
  };

  const reattempt = async (set) => {
    setRegeneratingFor(set.set_id);
    setError('');
    try {
      const res = await EducationService.generateFlashcards(set.chapter_id, set.num_cards || 8);
      if (res?.data?.generation_status === 'failed') {
        setError("Couldn't start a new revision deck right now. Please try again.");
        return;
      }
      navigate(`/flashcards/${set.chapter_id}?set=${res.data.set_id}&subject=${set.subject_id}`);
    } catch {
      setError("Couldn't start a new revision deck right now. Please try again.");
    } finally {
      setRegeneratingFor(null);
    }
  };

  return (
    <main className="flex-grow py-6 px-2 sm:px-3 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        
        {/* Top Hero Banner - Revision Cards */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          {/* Background blur */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-50 rounded-full blur-3xl pointer-events-none" />

          {/* Left Title Box */}
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

          {/* Right 3D Cards Graphic + Cursive Quote */}
          <div className="relative w-80 h-36 shrink-0 flex items-center justify-between z-10">
            {/* 3D Cards stack visual */}
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

            {/* Handwritten cursive quote text */}
            <div className="text-right font-serif text-slate-600 text-sm leading-tight italic pr-2">
              Flip<br />
              Revise<br />
              Remember<br />
              Grow
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Generate Revision Cards →
                </>
              )}
            </button>
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-700 font-semibold text-sm rounded-xl border border-red-200">{error}</div>}

        {/* Your Revision Sets Section */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Your Revision Sets</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Showing {sets.length} flashcard sets across your subjects
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
                className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <span className="material-symbols-outlined animate-spin text-4xl text-amber-500">progress_activity</span>
              <p className="text-sm font-semibold text-slate-500">Loading revision sets collection...</p>
            </div>
          ) : sets.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">style</span>
              </div>
              <p className="font-bold text-slate-800">No Revision Sets Created Yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Choose a subject and chapter above and click <strong>Generate Revision Cards</strong> to start building your flashcards!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sets
                .filter((s) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    (s.chapter_name && s.chapter_name.toLowerCase().includes(query)) ||
                    (s.subject_name && s.subject_name.toLowerCase().includes(query))
                  );
                })
                .map((s, idx) => {
                  const theme = CARD_THEMES[idx % CARD_THEMES.length];
                  const isClickable = s.generation_status === 'completed' || s.generation_status === 'processing';

                  return (
                    <motion.div
                      key={s.set_id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      onClick={() => isClickable && goWatch(s)}
                      className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group ${
                        isClickable ? 'cursor-pointer' : ''
                      }`}
                    >
                      {/* Pastel icon container preview header */}
                      <div className={`w-full h-32 rounded-xl ${theme.bg} ${theme.border} border p-4 flex items-center justify-center mb-3 relative`}>
                        <div className={`w-14 h-14 rounded-2xl bg-white shadow-xs flex items-center justify-center ${theme.iconColor}`}>
                          <span className="material-symbols-outlined text-3xl">{theme.icon}</span>
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="space-y-1">
                        <div className="flex items-start justify-between">
                          <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-amber-600 transition-colors line-clamp-1">
                            {s.chapter_name || `Chapter ${s.chapter_id}`}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reattempt(s);
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
                          {s.subject_name || 'Subject'} • {s.num_cards || 8} cards
                        </p>

                        <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 font-semibold border-t border-slate-100">
                          <span>{formatDate(s.created_at)}</span>
                          {s.generation_status === 'completed' && <span className="text-emerald-600 font-bold">Ready</span>}
                          {s.generation_status === 'processing' && <span className="text-amber-600 font-bold">Processing…</span>}
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

export default MyFlashcards;
