import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';

const FILTER_TABS = [
  { id: 'all', label: 'All', icon: 'collections_bookmark' },
  { id: 'bookmark', label: 'Bookmarks', icon: 'bookmark' },
  { id: 'note', label: 'Notes', icon: 'edit_note' },
  { id: 'flashcard', label: 'Flashcards', icon: 'style' },
  { id: 'deck', label: 'Learning Decks', icon: 'slideshow' },
  { id: 'visual', label: 'Visuals', icon: 'hub' },
  { id: 'recent', label: 'Recent', icon: 'schedule' },
];

const SUBJECT_LIST = [
  { id: 'all', label: 'All Subjects', icon: 'grid_view' },
  { id: 'math', label: 'Mathematics', icon: 'calculate' },
  { id: 'science', label: 'Science', icon: 'biotech' },
  { id: 'english', label: 'English', icon: 'auto_stories' },
  { id: 'social', label: 'Social Studies', icon: 'public' },
  { id: 'hindi', label: 'Hindi', icon: 'translate' },
];

const formatDate = (dateStr) => {
  if (!dateStr) return 'Saved recently';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Saved recently';
  const now = new Date();
  const diffHours = (now - d) / (1000 * 60 * 60);
  if (diffHours < 24) return 'Saved recently';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const Library = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [rawBookmarks, setRawBookmarks] = useState([]);
  const [rawNotes, setRawNotes] = useState([]);
  const [rawFlashcards, setRawFlashcards] = useState([]);
  const [rawDecks, setRawDecks] = useState([]);
  const [rawMindmaps, setRawMindmaps] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [bmRes, nRes, fcRes, dRes, mmRes] = await Promise.all([
          EducationService.listBookmarks().catch(() => ({ data: [] })),
          EducationService.listNotes().catch(() => ({ data: [] })),
          EducationService.listFlashcardSets().catch(() => ({ data: [] })),
          EducationService.listSlideDecks().catch(() => ({ data: [] })),
          EducationService.listMindMaps().catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;
        setRawBookmarks(bmRes?.data || []);
        setRawNotes(nRes?.data || []);
        setRawFlashcards(fcRes?.data || []);
        setRawDecks(dRes?.data || []);
        setRawMindmaps(mmRes?.data || []);
      } catch {
        // Safe fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Normalize all items into a unified schema
  const allResources = useMemo(() => {
    const list = [];

    // Bookmarks
    rawBookmarks.forEach((b) => {
      list.push({
        id: `bm-${b.bookmark_id}`,
        originalId: b.bookmark_id,
        title: b.title || b.content?.slice(0, 60) || 'Bookmarked Resource',
        contentSnippet: b.content,
        type: 'bookmark',
        typeLabel: b.source_type ? `${b.source_type.replace('_', ' ')}` : 'Bookmark',
        subject: b.chapter?.subject_name || b.chapter?.name || 'General',
        updatedAt: b.created_at,
        icon: 'bookmark',
        badgeBg: 'bg-emerald-100 text-[#064e3b] dark:bg-emerald-950/60 dark:text-emerald-300',
        onClick: () => {
          if (b.chapter_id) navigate(`/read/${b.chapter_id}`);
          else navigate('/my-learning/subjects');
        },
      });
    });

    // Notes
    rawNotes.forEach((n) => {
      list.push({
        id: `note-${n.note_id}`,
        originalId: n.note_id,
        title: n.title || 'Untitled Note',
        contentSnippet: n.content,
        type: 'note',
        typeLabel: 'Notes',
        subject: n.chapter?.subject_name || n.chapter?.name || 'General',
        updatedAt: n.updated_at || n.created_at,
        icon: 'edit_note',
        badgeBg: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
        onClick: () => navigate('/notes'),
      });
    });

    // Flashcards
    rawFlashcards.forEach((f) => {
      list.push({
        id: `fc-${f.set_id}`,
        originalId: f.set_id,
        title: `${f.chapter_name || 'Chapter'} Flashcards`,
        contentSnippet: `${f.num_cards || 8} Active recall practice cards`,
        type: 'flashcard',
        typeLabel: 'Flashcards',
        subject: f.subject_name || 'General',
        updatedAt: f.created_at,
        icon: 'style',
        badgeBg: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300',
        onClick: () => navigate(`/flashcards/${f.chapter_id}?subject=${f.subject_id}`),
      });
    });

    // Learning Decks
    rawDecks.forEach((d) => {
      list.push({
        id: `deck-${d.slide_deck_id}`,
        originalId: d.slide_deck_id,
        title: `${d.chapter_name || 'Chapter'} Learning Deck`,
        contentSnippet: 'Interactive slide deck summary',
        type: 'deck',
        typeLabel: 'Learning Deck',
        subject: d.subject_name || 'General',
        updatedAt: d.created_at,
        icon: 'slideshow',
        badgeBg: 'bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300',
        onClick: () => navigate(`/slide-deck/${d.chapter_id}`),
      });
    });

    // Mind Maps / Visuals
    rawMindmaps.forEach((m) => {
      list.push({
        id: `mm-${m.generation_group_id}`,
        originalId: m.generation_group_id,
        title: `${m.chapter_name || 'Chapter'} Mind Map`,
        contentSnippet: 'Visual concept breakdown',
        type: 'visual',
        typeLabel: 'Visual Explanation',
        subject: m.subject_name || 'General',
        updatedAt: m.created_at,
        icon: 'hub',
        badgeBg: 'bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300',
        onClick: () => navigate(`/mind-map/${m.chapter_id}`),
      });
    });

    return list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [rawBookmarks, rawNotes, rawFlashcards, rawDecks, rawMindmaps, navigate]);

  // Filtering
  const filteredResources = useMemo(() => {
    return allResources.filter((item) => {
      // Filter tab
      if (activeTab === 'recent') {
        // Keep top 10 most recent
        const isRecent = allResources.slice(0, 10).some((r) => r.id === item.id);
        if (!isRecent) return false;
      } else if (activeTab !== 'all' && item.type !== activeTab) {
        return false;
      }

      // Subject filter
      if (selectedSubject !== 'all') {
        const itemSub = item.subject.toLowerCase();
        const selSub = selectedSubject.toLowerCase();
        if (!itemSub.includes(selSub) && !selSub.includes(itemSub)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchType = item.typeLabel.toLowerCase().includes(q);
        const matchSub = item.subject.toLowerCase().includes(q);
        const matchBody = (item.contentSnippet || '').toLowerCase().includes(q);
        if (!matchTitle && !matchType && !matchSub && !matchBody) return false;
      }

      return true;
    });
  }, [allResources, activeTab, selectedSubject, searchQuery]);

  return (
    <div className="w-full min-h-screen bg-[#F7F3EA] dark:bg-[#0b1324] py-6 sm:py-8 px-2 sm:px-3 transition-colors">
      <div className="w-full space-y-6">
        
        {/* Header Hero Area */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-950/20 shrink-0">
              <span className="material-symbols-outlined text-[26px]">local_library</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                My Library
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Everything you've saved and created, in one place.
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="w-full sm:w-80 relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search your library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all shadow-2xs"
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#064e3b] text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Layout: Left Subject Sidebar + Right Resource Cards Grid */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Left Subject Filter Sidebar */}
          <div className="w-full lg:w-64 shrink-0 bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-2xs border border-slate-200/80 dark:border-slate-800 space-y-2">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 px-3 uppercase tracking-wider mb-2">
              Filter by Subject
            </p>
            {SUBJECT_LIST.map((sub) => {
              const isSel = selectedSubject === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubject(sub.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    isSel
                      ? 'bg-[#e6f4ea] text-[#064e3b] dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-emerald-800 dark:text-emerald-300">
                      {sub.icon}
                    </span>
                    <span>{sub.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Resource Grid */}
          <div className="flex-1 w-full space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-500">
                <span className="material-symbols-outlined animate-spin text-4xl text-[#064e3b] mr-2">
                  progress_activity
                </span>
                <span className="text-sm font-medium">Loading your library resources…</span>
              </div>
            ) : filteredResources.length === 0 ? (
              /* Empty States */
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center space-y-4 border border-slate-200/80 dark:border-slate-800">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-[#064e3b] dark:text-emerald-300 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">
                    {activeTab === 'bookmark' ? 'bookmark_border' : activeTab === 'note' ? 'edit_note' : 'collections_bookmark'}
                  </span>
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {activeTab === 'bookmark'
                      ? 'Nothing saved yet'
                      : activeTab === 'note'
                      ? 'No notes yet'
                      : 'No resources found'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {activeTab === 'bookmark'
                      ? 'Save explanations, questions, and resources while you learn.'
                      : activeTab === 'note'
                      ? 'Create personal notes while reading chapters and practicing.'
                      : 'Start exploring subjects to generate flashcards, mind maps, and saved notes.'}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      if (activeTab === 'note') navigate('/notes');
                      else navigate('/my-learning/subjects');
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#064e3b] text-white text-xs sm:text-sm font-bold hover:bg-[#04392b] transition-all shadow-sm"
                  >
                    {activeTab === 'note' ? 'Create Note' : 'Explore Learning'}
                  </button>
                </div>
              </div>
            ) : (
              /* Compact Modern Resource Cards */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredResources.map((item) => (
                  <div
                    key={item.id}
                    onClick={item.onClick}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200 cursor-pointer flex flex-col justify-between group space-y-3"
                  >
                    {/* Top Row: Type Badge + Icon */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1 ${item.badgeBg}`}>
                          <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                          {item.typeLabel}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                        {formatDate(item.updatedAt)}
                      </span>
                    </div>

                    {/* Middle Title & Snippet */}
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 group-hover:text-[#064e3b] dark:group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h3>
                      {item.contentSnippet && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {item.contentSnippet}
                        </p>
                      )}
                    </div>

                    {/* Bottom Subject Tag + Open Action */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                        {item.subject}
                      </span>
                      <div className="flex items-center gap-1 text-[#064e3b] dark:text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                        <span>Open</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Library;
