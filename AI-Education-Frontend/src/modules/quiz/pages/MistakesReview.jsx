import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EducationService from '../../../services/EducationService';

// Shared by Practice ("Previous Mistakes") and Test History ("Wrong
// Questions" / "Mistake Replay") — actual wrong answers from submitted attempts.
const MistakesReview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subjectId = searchParams.get('subject') ? Number(searchParams.get('subject')) : undefined;
  const attemptType = searchParams.get('type') || undefined;

  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revealedSet, setRevealedSet] = useState(new Set());
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.listQuizMistakes({ subjectId, attemptType });
        if (!cancelled) setMistakes(res?.data || []);
      } catch {
        if (!cancelled) setError("Couldn't load your past mistakes. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExplanation = (idx) => {
    setRevealedSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Unique subjects present in mistakes
  const availableSubjects = Array.from(
    new Set(mistakes.map((m) => m.subject_name).filter(Boolean))
  );

  const filteredMistakes = mistakes.filter((m) => {
    const matchesSubject =
      selectedSubjectFilter === 'all' ||
      (m.subject_name && m.subject_name.toLowerCase() === selectedSubjectFilter.toLowerCase());
    const matchesQuery =
      !searchQuery.trim() ||
      m.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.chapter_name && m.chapter_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSubject && matchesQuery;
  });

  return (
    <main className="flex-grow py-6 px-2 sm:px-3 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">

        {/* Navigation & Header */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/practice')}
            className="px-4 py-2 rounded-xl bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            ← Back to Challenge Hub
          </button>
        </div>

        {/* Hero Banner */}
        <div className="bg-white dark:bg-[#152238] rounded-3xl p-6 md:p-8 relative overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4 z-10 max-w-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-3xl">history_edu</span>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 font-extrabold text-xs mb-1">
                🎯 Learn From Mistakes
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Previous Mistakes</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base mt-1">
                Every question you've gotten wrong, with real explanations to rebuild your core concepts.
              </p>
            </div>
          </div>

          {/* Quick Counter Badge */}
          <div className="flex items-center gap-3 z-10 shrink-0">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-center">
              <span className="block text-xs font-bold text-slate-400 uppercase">Review Items</span>
              <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{mistakes.length} Questions</span>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        {!loading && mistakes.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Subject Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedSubjectFilter('all')}
                className={`px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  selectedSubjectFilter === 'all'
                    ? 'bg-[#134E4A] text-white shadow-xs'
                    : 'bg-white dark:bg-[#152238] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                }`}
              >
                All Subjects ({mistakes.length})
              </button>
              {availableSubjects.map((sub) => {
                const count = mistakes.filter((m) => m.subject_name === sub).length;
                return (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubjectFilter(sub)}
                    className={`px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                      selectedSubjectFilter === sub
                        ? 'bg-[#134E4A] text-white shadow-xs'
                        : 'bg-white dark:bg-[#152238] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {sub} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wrong questions..."
                className="w-full bg-white dark:bg-[#152238] border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500 shadow-2xs"
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-rose-600">progress_activity</span>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-[#152238] rounded-3xl p-8 text-center text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
            {error}
          </div>
        ) : mistakes.length === 0 ? (
          <div className="bg-white dark:bg-[#152238] rounded-3xl p-12 text-center space-y-4 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-3xl font-bold">
              🏆
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Clean Record — No Mistakes Found!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
              You haven't gotten any questions wrong yet, or you haven't taken any quizzes. Keep practicing to build confidence!
            </p>
            <button
              onClick={() => navigate('/practice')}
              className="bg-[#064e3b] text-white hover:bg-[#043e2f] px-6 py-3 rounded-2xl font-extrabold text-xs shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              Start Practice Quiz →
            </button>
          </div>
        ) : filteredMistakes.length === 0 ? (
          <div className="bg-white dark:bg-[#152238] rounded-3xl p-8 text-center text-slate-500 dark:text-slate-400 text-sm font-medium border border-slate-100 dark:border-slate-800">
            No mistake questions match your current search or filter.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredMistakes.map((m, idx) => {
              const isRevealed = revealedSet.has(idx);
              return (
                <div
                  key={`${m.attempt_id}-${idx}`}
                  className="bg-white dark:bg-[#152238] rounded-3xl p-6 md:p-7 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 hover:shadow-md transition-all"
                >
                  {/* Top Metadata Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-indigo-500">menu_book</span>
                        {m.subject_name || 'Subject'} · {m.chapter_name || 'Chapter'}
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-slate-400">
                      {m.submitted_at
                        ? new Date(m.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : ''}
                    </span>
                  </div>

                  {/* Question Text */}
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base md:text-lg leading-snug">
                    {m.question}
                  </h3>

                  {/* Options List */}
                  <div className="grid grid-cols-1 gap-2.5 pt-1">
                    {Object.entries(m.options || {}).map(([key, value]) => {
                      const isCorrect = key === m.correct_answer;
                      const isWrongSelected = key === m.selected_answer && !isCorrect;

                      return (
                        <div
                          key={key}
                          className={`p-4 rounded-2xl border text-xs sm:text-sm transition-all flex items-center justify-between ${
                            isCorrect
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-extrabold shadow-2xs'
                              : isWrongSelected
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 font-bold'
                                : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 opacity-80'
                          }`}
                        >
                          <div className="flex items-center gap-2 pr-2">
                            <span className="font-extrabold shrink-0">{key}.</span>
                            <span>{value}</span>
                          </div>

                          {isCorrect && (
                            <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-extrabold shrink-0 flex items-center gap-1 shadow-2xs">
                              Correct Answer ✓
                            </span>
                          )}
                          {isWrongSelected && (
                            <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-extrabold shrink-0 flex items-center gap-1 shadow-2xs">
                              Your Answer ✕
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Explanation Accordion Toggle */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                    <button
                      onClick={() => toggleExplanation(idx)}
                      className="self-start px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-300 font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">auto_awesome</span>
                      {isRevealed ? 'Hide Explanation' : 'Show Explanation'}
                    </button>

                    {isRevealed && (
                      <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-4 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium space-y-1">
                        <div className="flex items-center gap-1.5 font-extrabold text-emerald-800 dark:text-emerald-300 text-xs mb-1">
                          <span>💡 AI Concept Explanation</span>
                        </div>
                        <p className="whitespace-pre-wrap">{m.explanation || 'No detailed explanation provided for this question.'}</p>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
};

export default MistakesReview;

