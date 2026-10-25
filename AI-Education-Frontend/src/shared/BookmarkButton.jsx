import React, { useState } from 'react';
import EducationService from '../services/EducationService';

const BookmarkButton = ({ title, content, sourceType = 'concept', chapterId = null, initialIsBookmarked = false, onToggle, className = '' }) => {
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [bookmarkId, setBookmarkId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const handleToggle = async (e) => {
    e?.stopPropagation();
    if (loading) return;
    setLoading(true);

    try {
      if (isBookmarked && bookmarkId) {
        await EducationService.deleteBookmark(bookmarkId);
        setIsBookmarked(false);
        setBookmarkId(null);
        showToast('Removed from Library');
        if (onToggle) onToggle(false);
      } else {
        const res = await EducationService.createBookmark({
          chapterId: chapterId || undefined,
          sourceType: sourceType || 'concept',
          title: title || 'Saved Item',
          content: content || title || '',
        });
        const newId = res?.data?.bookmark_id;
        setIsBookmarked(true);
        setBookmarkId(newId);
        showToast('Saved to Library');
        if (onToggle) onToggle(true, newId);
      }
    } catch {
      showToast('Could not update bookmark');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={handleToggle}
        disabled={loading}
        title={isBookmarked ? 'Remove Bookmark' : 'Save to Library'}
        className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          isBookmarked
            ? 'bg-emerald-100 text-[#064e3b] dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60'
            : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
        } ${className}`}
      >
        <span className={`material-symbols-outlined text-[16px] ${isBookmarked ? 'fill-current text-[#064e3b] dark:text-emerald-300' : ''}`}>
          {isBookmarked ? 'bookmark' : 'bookmark_border'}
        </span>
        <span>{isBookmarked ? 'Saved' : 'Save'}</span>
      </button>

      {toast && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-[#123B35] text-white text-[11px] font-extrabold rounded-lg shadow-lg whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-150">
          {toast}
        </div>
      )}
    </div>
  );
};

export default BookmarkButton;
