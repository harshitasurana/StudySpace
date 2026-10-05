import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import EducationService from '../../../services/EducationService';

const SOURCE_LABELS = {
  chapter: 'Chapter',
  tutor_message: 'AI Chat',
  quiz_question: 'Question',
  diagram: 'Diagram',
  flashcard: 'Flashcard',
  concept: 'Concept',
  test: 'Test',
};

const SOURCE_ICONS = {
  chapter: 'menu_book',
  tutor_message: 'forum',
  quiz_question: 'quiz',
  diagram: 'image',
  flashcard: 'style',
  concept: 'hub',
  test: 'assignment',
};

const COLLECTIONS = [
  { id: 'exam', label: 'Exam', icon: 'grade' },
  { id: 'revision', label: 'Revision', icon: 'replay' },
  { id: 'important', label: 'Important', icon: 'star' },
  { id: 'favorites', label: 'Favorites', icon: 'favorite' },
  { id: 'need_practice', label: 'Need Practice', icon: 'target' },
];

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const isImageUrl = (text) => /^https?:\/\/.*\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(text || '');

const Bookmarks = () => {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCollection, setActiveCollection] = useState(null);
  const [viewingBookmark, setViewingBookmark] = useState(null);

  const load = async (collection) => {
    setLoading(true);
    try {
      const res = await EducationService.listBookmarks({ collection: collection || undefined });
      setBookmarks(res?.data || []);
    } catch {
      setError("Couldn't load your bookmarks. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeCollection);
  }, [activeCollection]);

  const handleDelete = async (bookmarkId) => {
    try {
      await EducationService.deleteBookmark(bookmarkId);
      setBookmarks((prev) => prev.filter((b) => b.bookmark_id !== bookmarkId));
    } catch {
      setError("Couldn't remove that bookmark. Please try again.");
    }
  };

  const handleSetCollection = async (bookmarkId, collection) => {
    setBookmarks((prev) => prev.map((b) => (b.bookmark_id === bookmarkId ? { ...b, collection } : b)));
    try {
      await EducationService.updateBookmark(bookmarkId, { collection: collection || null });
    } catch {
      setError("Couldn't update that bookmark's collection. Please try again.");
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = bookmarks.length;
    const diagrams = bookmarks.filter((b) => b.source_type === 'diagram').length;
    const aiChats = bookmarks.filter((b) => b.source_type === 'tutor_message').length;
    return { total, diagrams, aiChats };
  }, [bookmarks]);

  return (
    <main className="flex-grow py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
      <div className="max-w-6xl mx-auto space-y-stack-md">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-elevated rounded-3xl p-6 md:p-8 relative overflow-hidden border border-rose-500/20 bg-gradient-to-r from-rose-500/10 via-surface-container-low to-transparent"
        >
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-label-md font-bold">
                <span className="material-symbols-outlined text-[18px]">bookmark</span>
                Saved Vault
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">Bookmarks</h1>
              <p className="text-body-lg text-on-surface-variant max-w-xl">
                Access saved AI discussions, practice questions, diagrams, and flashcards in one place.
              </p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-border-subtle/50 max-w-md">
            <div className="glass-card rounded-2xl p-3.5 text-center border border-border-subtle/80 bg-surface/50">
              <span className="text-label-sm text-on-surface-variant block font-medium">Saved Items</span>
              <span className="font-extrabold text-headline-sm text-on-surface">{stats.total}</span>
            </div>
            <div className="glass-card rounded-2xl p-3.5 text-center border border-border-subtle/80 bg-surface/50">
              <span className="text-label-sm text-on-surface-variant block font-medium">Diagrams</span>
              <span className="font-extrabold text-headline-sm text-rose-600 dark:text-rose-400">{stats.diagrams}</span>
            </div>
            <div className="glass-card rounded-2xl p-3.5 text-center border border-border-subtle/80 bg-surface/50">
              <span className="text-label-sm text-on-surface-variant block font-medium">AI Answers</span>
              <span className="font-extrabold text-headline-sm text-primary">{stats.aiChats}</span>
            </div>
          </div>
        </motion.div>

        {/* Collection Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveCollection(null)}
            className={`px-4 py-2 rounded-2xl text-label-md font-bold transition-all cursor-pointer ${
              activeCollection === null
                ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            All Bookmarks
          </button>
          {COLLECTIONS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCollection(c.id)}
              className={`px-4 py-2 rounded-2xl text-label-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCollection === c.id
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <span className="material-symbols-outlined animate-spin text-5xl text-rose-600">progress_activity</span>
            <p className="text-body-md font-medium text-on-surface-variant">Loading your bookmarks...</p>
          </div>
        ) : error ? (
          <div className="glass-card rounded-2xl p-6 text-center text-on-surface-variant">{error}</div>
        ) : bookmarks.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-3xl p-10 text-center space-y-5 border border-border-subtle/70"
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-4xl">bookmark_border</span>
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">No Bookmarks Saved</h3>
              <p className="text-body-md text-on-surface-variant">
                Look for the bookmark icon across AI Tutor chat, practice questions, diagrams, and flashcards to save items here.
              </p>
            </div>
          </motion.div>
        ) : (
          /* Bookmarks Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {bookmarks.map((bookmark) => {
              const showImage = bookmark.source_type === 'diagram' && isImageUrl(bookmark.content);
              return (
                <motion.div
                  key={bookmark.bookmark_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-5 flex flex-col h-full cursor-pointer hover:shadow-lg hover:border-rose-500/30 transition-all duration-200 group border border-border-subtle/70"
                  onClick={() => setViewingBookmark(bookmark)}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full text-label-sm font-bold">
                          <span className="material-symbols-outlined text-[14px]">
                            {SOURCE_ICONS[bookmark.source_type] || 'bookmark'}
                          </span>
                          {SOURCE_LABELS[bookmark.source_type] || bookmark.source_type}
                        </span>
                        {bookmark.chapter?.name && (
                          <span className="text-label-sm text-on-surface-variant truncate font-medium">
                            {bookmark.chapter.name}
                          </span>
                        )}
                      </div>
                      {bookmark.title && (
                        <h3 className="font-bold text-on-surface truncate text-body-md group-hover:text-rose-600 transition-colors">
                          {bookmark.title}
                        </h3>
                      )}
                    </div>

                    <button
                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors cursor-pointer shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(bookmark.bookmark_id);
                      }}
                      title="Remove bookmark"
                    >
                      <span className="material-symbols-outlined text-[18px]">bookmark_remove</span>
                    </button>
                  </div>

                  <div className="my-3 flex-1 min-h-0 overflow-hidden">
                    {showImage ? (
                      <div className="rounded-xl overflow-hidden border border-border-subtle max-h-40 bg-surface-container-high">
                        <img
                          src={bookmark.content}
                          alt={bookmark.title || 'Bookmarked diagram'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <p className="text-body-md text-on-surface-variant whitespace-pre-wrap line-clamp-4">
                        {bookmark.content}
                      </p>
                    )}
                  </div>

                  <div
                    className="flex items-center justify-between pt-3 mt-auto border-t border-border-subtle/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-label-sm text-on-surface-variant">{formatDate(bookmark.created_at)}</p>
                    <select
                      value={bookmark.collection || ''}
                      onChange={(e) => handleSetCollection(bookmark.bookmark_id, e.target.value)}
                      className="text-label-sm font-semibold rounded-full border border-border-subtle/80 bg-surface px-3 py-1 cursor-pointer text-on-surface focus:outline-none focus:border-rose-500"
                    >
                      <option value="">No Collection</option>
                      {COLLECTIONS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Feature Teasers */}
        <div className="glass-card rounded-2xl p-5 border border-border-subtle/60 space-y-2">
          <p className="font-bold text-body-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500 text-[20px]">bookmark_add</span>
            Upcoming Bookmark Sources
          </p>
          <div className="flex flex-wrap gap-2">
            {['🎬 Video Snippets', '📂 Attached Files', '🔊 Audio Clips'].map((label) => (
              <span
                key={label}
                className="text-[11px] font-extrabold uppercase tracking-wide bg-surface-container-high text-on-surface-variant px-3 py-1.5 rounded-xl"
              >
                {label} — Coming Soon
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Full Bookmark View Modal */}
      {viewingBookmark && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setViewingBookmark(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl p-6 md:p-8 space-y-4 max-h-[85vh] overflow-y-auto border border-border-subtle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-4 border-b border-border-subtle/60 pb-3">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 px-3 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full text-label-md font-bold mb-1.5">
                  <span className="material-symbols-outlined text-[16px]">
                    {SOURCE_ICONS[viewingBookmark.source_type] || 'bookmark'}
                  </span>
                  {SOURCE_LABELS[viewingBookmark.source_type] || viewingBookmark.source_type}
                </span>
                {viewingBookmark.title && (
                  <h2 className="font-extrabold text-headline-sm text-on-surface">{viewingBookmark.title}</h2>
                )}
                {viewingBookmark.chapter?.name && (
                  <p className="text-label-md text-on-surface-variant font-medium mt-0.5">
                    {viewingBookmark.chapter.name}
                  </p>
                )}
              </div>
              <button
                onClick={() => setViewingBookmark(null)}
                className="text-on-surface-variant hover:text-error transition-colors p-1 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {viewingBookmark.source_type === 'diagram' && isImageUrl(viewingBookmark.content) ? (
              <div className="rounded-2xl overflow-hidden border border-border-subtle bg-surface-container-high max-h-[60vh] flex justify-center">
                <img
                  src={viewingBookmark.content}
                  alt={viewingBookmark.title || 'Bookmarked diagram'}
                  className="max-h-[60vh] w-full object-contain"
                />
              </div>
            ) : (
              <p className="text-body-md text-on-surface whitespace-pre-wrap">{viewingBookmark.content}</p>
            )}

            <p className="text-label-sm text-on-surface-variant">{formatDate(viewingBookmark.created_at)}</p>

            <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle/60">
              <button
                onClick={() => {
                  handleDelete(viewingBookmark.bookmark_id);
                  setViewingBookmark(null);
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-error/10 text-error font-bold hover:bg-error/20 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">bookmark_remove</span>
                Remove Bookmark
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
};

export default Bookmarks;
