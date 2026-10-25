import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import EducationService from '../../../services/EducationService';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Pastel colors for concept map card nodes
const MAP_THEMES = [
  { bg: 'from-blue-50 to-indigo-50/60', border: 'border-blue-100', accent: 'bg-blue-500', pill: 'bg-blue-100 text-blue-700' },
  { bg: 'from-rose-50 to-pink-50/60', border: 'border-pink-100', accent: 'bg-pink-500', pill: 'bg-pink-100 text-pink-700' },
  { bg: 'from-purple-50 to-indigo-50/60', border: 'border-purple-100', accent: 'bg-purple-500', pill: 'bg-purple-100 text-purple-700' },
  { bg: 'from-emerald-50 to-teal-50/60', border: 'border-emerald-100', accent: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700' },
];

const MyMindMaps = () => {
  const navigate = useNavigate();
  const [mindMaps, setMindMaps] = useState([]);
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

  const loadMindMaps = async () => {
    try {
      const res = await EducationService.listMindMaps();
      setMindMaps(res?.data || []);
    } catch {
      setError("Couldn't load your mind maps. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMindMaps();
  }, []);

  // Compute unique chapter names for filter tabs across all 49 mind maps
  const availableChapters = useMemo(() => {
    const chapterMap = new Map();
    (mindMaps || []).forEach((m) => {
      const id = m.chapter_id || m.chapter_name;
      const name = m.chapter_name || (m.chapter_id ? `Chapter ${m.chapter_id}` : 'Other');
      if (id) chapterMap.set(String(id), name);
    });
    return Array.from(chapterMap.entries()).map(([id, name]) => ({ id, name }));
  }, [mindMaps]);

  // Compute filtered list of mind maps
  const filteredMindMaps = useMemo(() => {
    return (mindMaps || []).filter((m) => {
      if (selectedFilterChapter !== 'ALL') {
        const cId = String(m.chapter_id || m.chapter_name);
        if (cId !== selectedFilterChapter) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchChapter = m.chapter_name && m.chapter_name.toLowerCase().includes(query);
        const matchSubject = m.subject_name && m.subject_name.toLowerCase().includes(query);
        const matchTopic = m.central_topic && m.central_topic.toLowerCase().includes(query);
        if (!matchChapter && !matchSubject && !matchTopic) return false;
      }
      return true;
    });
  }, [mindMaps, selectedFilterChapter, searchQuery]);

  // Fetch user subjects
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
      const res = await EducationService.generateMindMap(selectedChapterId);
      const groupId = res?.data?.generation_group_id || res?.data?.map_id;
      navigate(`/mind-map/${selectedChapterId}?map=${groupId}&subject=${selectedSubjectId}`);
    } catch {
      setError("Couldn't start a new concept map right now. Please try again.");
    } finally {
      setGeneratingNew(false);
    }
  };

  const goWatch = (m) => {
    navigate(`/mind-map/${m.chapter_id}?map=${m.generation_group_id}&subject=${m.subject_id}`);
  };

  const reattempt = async (m) => {
    setRegeneratingFor(m.generation_group_id);
    setError('');
    try {
      const res = await EducationService.generateMindMap(m.chapter_id);
      if (res?.data?.status === 'failed') {
        setError("Couldn't start a new concept map right now. Please try again.");
        return;
      }
      navigate(`/mind-map/${m.chapter_id}?map=${res.data.generation_group_id}&subject=${m.subject_id}`);
    } catch {
      setError("Couldn't start a new concept map right now. Please try again.");
    } finally {
      setRegeneratingFor(null);
    }
  };

  return (
    <main className="flex-grow py-6 px-2 sm:px-3 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        
        {/* Top Hero Banner - Concept Map */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          {/* Decorative background blur */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-50 rounded-full blur-3xl pointer-events-none" />

          {/* Left Title Box */}
          <div className="flex items-start gap-4 z-10 max-w-xl">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/25">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Concept Map</h1>
              <p className="text-slate-500 font-medium text-sm md:text-base mt-1">
                Turn a chapter into a clear, interactive concept map.
              </p>
            </div>
          </div>

          {/* Right 3D Mind Map Illustration with Lightbulb & Floating Nodes */}
          <div className="relative w-72 h-36 shrink-0 flex items-center justify-center z-10">
            {/* Glowing Lightbulb */}
            <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-300/40 animate-pulse">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7zM9 21a1 1 0 001 1h4a1 1 0 001-1v-1H9v1z" />
              </svg>
            </div>

            {/* Floating Tag Badges */}
            <span className="absolute left-2 top-2 px-2.5 py-1 bg-purple-100 text-purple-700 font-bold text-xs rounded-full shadow-xs border border-purple-200/60">Ideas</span>
            <span className="absolute right-2 top-3 px-2.5 py-1 bg-teal-100 text-teal-700 font-bold text-xs rounded-full shadow-xs border border-teal-200/60">Concepts</span>
            <span className="absolute left-0 bottom-4 px-2.5 py-1 bg-blue-100 text-blue-700 font-bold text-xs rounded-full shadow-xs border border-blue-200/60">Connections</span>
            <span className="absolute right-0 bottom-4 px-2.5 py-1 bg-amber-100 text-amber-700 font-bold text-xs rounded-full shadow-xs border border-amber-200/60">Understand</span>
            <span className="absolute left-20 top-0 px-2.5 py-0.5 bg-rose-100 text-rose-700 font-bold text-xs rounded-full shadow-xs border border-rose-200/60">Big Picture</span>
            <span className="absolute right-20 bottom-0 px-2.5 py-0.5 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-full shadow-xs border border-indigo-200/60">Explore</span>
          </div>
        </motion.div>

        {/* Selection Bar (Select Subject + Select Chapter/Topic + Generate Button) */}
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Generate Concept Map →
                </>
              )}
            </button>
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-700 font-semibold text-sm rounded-xl border border-red-200">{error}</div>}

        {/* Your Concept Maps Section */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Your Concept Maps</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Showing {filteredMindMaps.length} of {mindMaps.length} mind maps across your subjects
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
                className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-xs"
              />
            </div>
          </div>

          {/* Quick Chapter Filter Tabs */}
          {availableChapters.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedFilterChapter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedFilterChapter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Chapters ({mindMaps.length})
              </button>
              {availableChapters.map((ch) => {
                const count = mindMaps.filter((m) => String(m.chapter_id || m.chapter_name) === ch.id).length;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedFilterChapter(ch.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      selectedFilterChapter === ch.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {ch.name} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <span className="material-symbols-outlined animate-spin text-4xl text-indigo-600">progress_activity</span>
              <p className="text-sm font-semibold text-slate-500">Loading concept maps collection...</p>
            </div>
          ) : mindMaps.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="font-bold text-slate-800">No Concept Maps Generated Yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select a subject and chapter above and click <strong>Generate Concept Map</strong> to create your first visual map!
              </p>
            </div>
          ) : filteredMindMaps.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-xs space-y-2">
              <p className="font-bold text-slate-800">No matching mind maps found</p>
              <p className="text-xs text-slate-500">Try adjusting your search query or chapter filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredMindMaps.map((m, idx) => {
                  const theme = MAP_THEMES[idx % MAP_THEMES.length];
                  const isClickable = m.status === 'completed' || m.status === 'processing' || m.status === 'pending';

                  return (
                    <motion.div
                      key={m.generation_group_id || m.map_id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      onClick={() => isClickable && goWatch(m)}
                      className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group ${
                        isClickable ? 'cursor-pointer' : ''
                      }`}
                    >
                      {/* SVG Diagram Thumbnail Preview */}
                      <div className={`w-full h-32 rounded-xl bg-gradient-to-br ${theme.bg} ${theme.border} border p-3 flex flex-col items-center justify-center relative overflow-hidden mb-3`}>
                        {/* Diagram visual mock */}
                        <div className="flex flex-col items-center space-y-2 relative z-10 scale-90">
                          <div className="px-3 py-1 bg-white rounded-full shadow-xs text-[10px] font-extrabold text-indigo-700 border border-indigo-100">
                            {m.chapter_name ? m.chapter_name.slice(0, 16) : 'Overview'}
                          </div>
                          <div className="w-0.5 h-3 bg-indigo-300" />
                          <div className="flex gap-4">
                            <div className="px-2 py-0.5 bg-white/90 rounded-md shadow-xs text-[9px] font-semibold text-slate-600">
                              Topic 1
                            </div>
                            <div className="px-2 py-0.5 bg-white/90 rounded-md shadow-xs text-[9px] font-semibold text-slate-600">
                              Topic 2
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Content details */}
                      <div className="space-y-1">
                        <div className="flex items-start justify-between">
                          <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {m.chapter_name || `Chapter ${m.chapter_id}`}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reattempt(m);
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
                          {m.subject_name || 'Subject'} • Chapter {m.chapter_id || '1'}
                        </p>

                        <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 font-semibold border-t border-slate-100">
                          <span>{formatDate(m.created_at)}</span>
                          {m.status === 'completed' && <span className="text-emerald-600 font-bold">Ready</span>}
                          {m.status === 'processing' && <span className="text-amber-600 font-bold">Processing…</span>}
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

export default MyMindMaps;

