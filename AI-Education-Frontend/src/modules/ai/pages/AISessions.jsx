import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';

const timeAgo = (isoString) => {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

// Spec items that need real new infrastructure (message-level timeline
// storage, a replay player, PDF export, deeper session-memory analysis)
// — shown as real, disabled, clearly-labeled icons rather than faked.
const COMING_SOON_ACTIONS = [
  { id: 'replay', label: 'Replay Session', icon: 'play_circle' },
  { id: 'timeline', label: 'Session Timeline', icon: 'timeline' },
  { id: 'pdf', label: 'Download PDF', icon: 'picture_as_pdf' },
  { id: 'memory', label: 'AI Session Memory', icon: 'psychology' },
];

const AISessions = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [comingSoonLabel, setComingSoonLabel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.listTutorConversations();
        if (!cancelled) setConversations(res?.data || []);
      } catch {
        if (!cancelled) setError("Couldn't load your AI Tutor sessions. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleResume = (conv) => {
    navigate(`/ai-tutor/chat?subject=${conv.subject_id}&chapter=${conv.chapter_id}&conversation=${conv.conversation_id}`);
  };

  const showComingSoon = (label) => {
    setComingSoonLabel(label);
    window.setTimeout(() => setComingSoonLabel(null), 2000);
  };

  const filtered = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.chapter_name?.toLowerCase().includes(q) || c.subject_name?.toLowerCase().includes(q);
  });

  return (
    <main className="flex-grow py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
      <div className="max-w-5xl mx-auto space-y-stack-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">AI Sessions</h1>
            <p className="text-body-lg text-on-surface-variant">Your learning workspace — every chapter's chat, notes, and quiz activity in one place.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          </div>
        ) : error ? (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">{error}</div>
        ) : conversations.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">
            No AI Tutor sessions yet — open a chapter's Tutor Chat to start one.
          </div>
        ) : (
          <>
            <div className="flex bg-surface-container-low rounded-full px-4 py-2 items-center gap-2 border border-border-subtle">
              <span className="material-symbols-outlined text-outline">search</span>
              <input
                type="text"
                placeholder="Search sessions by subject or chapter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none flex-1 outline-none text-body-md"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">No sessions match "{search}".</div>
            ) : (
              <div className="space-y-4">
                {filtered.map((conv) => (
                  <div key={conv.conversation_id} className="glass-card rounded-xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-label-md text-on-surface-variant">{conv.subject_name}</span>
                        <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{conv.chapter_name}</h3>
                        {/* A chapter can have several saved conversations now
                            (each "New Chat" starts one rather than erasing
                            the last) - the start time is what tells two
                            cards for the same chapter apart. */}
                        <p className="text-label-md text-on-surface-variant">
                          Started {timeAgo(conv.started_at)} · Last active {timeAgo(conv.last_active_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleResume(conv)}
                        className="shrink-0 flex items-center gap-1 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        Continue
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </div>

                    {/* Real per-session stats — chat, notes, quiz activity,
                        and real "mistakes found" from actual wrong quiz
                        answers, all genuinely stored for this chapter. */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="bg-surface-container-low rounded-lg py-2">
                        <p className="font-bold text-on-surface">{conv.message_count}</p>
                        <p className="text-label-md text-on-surface-variant">Messages</p>
                      </div>
                      <div className="bg-surface-container-low rounded-lg py-2">
                        <p className="font-bold text-on-surface">{conv.notes_count}</p>
                        <p className="text-label-md text-on-surface-variant">Notes</p>
                      </div>
                      <div className="bg-surface-container-low rounded-lg py-2">
                        <p className="font-bold text-on-surface">
                          {conv.quiz_attempts_count}{conv.average_quiz_score != null ? ` · ${conv.average_quiz_score}%` : ''}
                        </p>
                        <p className="text-label-md text-on-surface-variant">Quiz Attempts</p>
                      </div>
                      <div className={`rounded-lg py-2 ${conv.mistakes_count > 0 ? 'bg-error-container/40' : 'bg-surface-container-low'}`}>
                        <p className={`font-bold ${conv.mistakes_count > 0 ? 'text-error' : 'text-on-surface'}`}>{conv.mistakes_count}</p>
                        <p className="text-label-md text-on-surface-variant">Mistakes Found</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/flashcards/${conv.chapter_id}?subject=${conv.subject_id}`)}
                          className="flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">style</span>
                          Flashcards
                        </button>
                        <button
                          onClick={() => navigate(`/mind-map/${conv.chapter_id}?subject=${conv.subject_id}`)}
                          className="flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">hub</span>
                          Mind Map
                        </button>
                        <button
                          onClick={() => navigate(`/slide-deck/${conv.chapter_id}?subject=${conv.subject_id}`)}
                          className="flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">auto_stories</span>
                          Learning Deck
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {COMING_SOON_ACTIONS.map((action) => (
                          <button
                            key={action.id}
                            title={`${action.label} — coming soon`}
                            onClick={() => showComingSoon(action.label)}
                            className="p-1.5 rounded-full text-outline hover:text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">{action.icon}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {comingSoonLabel && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-on-surface text-white text-label-md px-4 py-2 rounded-full shadow-lg animate-fade-in z-50">
            {comingSoonLabel} is coming soon.
          </div>
        )}
      </div>
    </main>
  );
};

export default AISessions;
