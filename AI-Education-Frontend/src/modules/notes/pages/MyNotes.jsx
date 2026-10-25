import React, { useEffect, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import EducationService from '../../../services/EducationService';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const NOTE_MARKDOWN_COMPONENTS = {
  h2: ({ children }) => <h4 className="font-bold text-body-lg text-on-surface mt-3 mb-1 first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="font-bold text-body-md text-on-surface mt-2 mb-1">{children}</h5>,
  p: ({ children }) => <p className="mb-2 last:mb-0 text-on-surface-variant">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5 text-on-surface-variant">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5 text-on-surface-variant">{children}</ol>,
  strong: ({ children }) => <strong className="font-bold text-on-surface">{children}</strong>,
};

const NoteQuizPlayer = ({ attempt, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const currentQuestion = attempt.questions[currentIndex];
  const isLast = currentIndex === attempt.total_questions - 1;

  const submit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const res = await EducationService.submitQuizAnswer(attempt.attempt_id, currentIndex, selected);
      setFeedback(res?.data || null);
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    setCurrentIndex((i) => i + 1);
    setSelected(null);
    setFeedback(null);
  };

  if (feedback?.completed) {
    return (
      <div className="text-center space-y-4 py-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-4xl">emoji_events</span>
        </div>
        <div>
          <h4 className="font-bold text-headline-sm text-on-surface">Quiz Completed!</h4>
          <p className="text-body-md text-on-surface-variant mt-1">
            You scored <span className="font-extrabold text-primary">{feedback.score}</span> of {feedback.total_questions} ({feedback.percentage}%)
          </p>
        </div>
        <button
          onClick={onClose}
          className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold hover:opacity-90 shadow-md shadow-primary/20 transition-all cursor-pointer"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-label-md text-on-surface-variant font-medium">
        <span>Question {currentIndex + 1} of {attempt.total_questions}</span>
        <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-label-sm">Note Quiz</span>
      </div>
      <p className="font-bold text-body-lg text-on-surface">{currentQuestion.question}</p>
      <div className="space-y-2">
        {Object.entries(currentQuestion.options).map(([key, value]) => {
          const isCorrectOption = feedback && key === feedback.correct_answer;
          const isWrongSelected = feedback && selected === key && !feedback.is_correct;
          return (
            <button
              key={key}
              onClick={() => !feedback && setSelected(key)}
              disabled={!!feedback}
              className={`w-full text-left p-3.5 border rounded-xl transition-all cursor-pointer ${
                feedback
                  ? isCorrectOption
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 font-bold'
                    : isWrongSelected
                    ? 'bg-error/10 border-error text-error'
                    : 'border-border-subtle/60 opacity-60'
                  : selected === key
                  ? 'bg-primary/10 border-primary border-2 text-primary font-bold shadow-xs'
                  : 'border-border-subtle/80 hover:bg-surface-container-high/50'
              }`}
            >
              <span className="font-bold mr-2">{key}.</span> {value}
            </button>
          );
        })}
      </div>
      {feedback ? (
        <div className="space-y-3 pt-2">
          <div className={`p-3.5 rounded-xl text-body-md border ${
            feedback.is_correct ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-error/10 border-error/30 text-error'
          }`}>
            <p className="font-bold mb-0.5">{feedback.is_correct ? '✨ Correct!' : '❌ Incorrect'}</p>
            <p className="text-label-md">{feedback.explanation}</p>
          </div>
          {!isLast && (
            <button
              onClick={next}
              className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold hover:opacity-90 shadow-md shadow-primary/20 transition-all cursor-pointer"
            >
              Next Question
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={submit}
          disabled={!selected || submitting}
          className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold disabled:opacity-50 hover:opacity-90 shadow-md shadow-primary/20 transition-all cursor-pointer"
        >
          {submitting ? 'Checking…' : 'Submit Answer'}
        </button>
      )}
    </div>
  );
};

const MyNotes = () => {
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formChapterId, setFormChapterId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [generatingAiNote, setGeneratingAiNote] = useState(false);

  const [previewingId, setPreviewingId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [conversion, setConversion] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);

  const loadNotes = async () => {
    try {
      const res = await EducationService.listNotes();
      setNotes(res?.data || []);
    } catch {
      setError("Couldn't load your notes. Please refresh and try again.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profileRes = await EducationService.getMyProfile();
        if (cancelled) return;
        const profileSubjects = (profileRes?.data?.subjects || []).map((s) => ({ id: s.subject_id, label: s.name }));
        setSubjects(profileSubjects);

        const chaptersRes = await Promise.all(profileSubjects.map((s) => EducationService.getChapters(s.id)));
        if (cancelled) return;
        setChapters(profileSubjects.flatMap((s, idx) => (chaptersRes[idx]?.data || []).map((c) => ({ ...c, subjectLabel: s.label }))));

        await loadNotes();
      } catch {
        if (!cancelled) setError("Couldn't load your notes. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openCreate = () => {
    setEditingNote(null);
    setFormChapterId('');
    setFormTitle('');
    setFormContent('');
    setFormTags('');
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (note) => {
    setEditingNote(note);
    setFormChapterId(note.chapter_id || '');
    setFormTitle(note.title || '');
    setFormContent(note.content);
    setFormTags((note.tags || []).join(', '));
    setFormError('');
    setShowForm(true);
  };

  const parseTags = (raw) => raw.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formContent.trim()) return;
    setSaving(true);
    setFormError('');
    try {
      const tags = parseTags(formTags);
      if (editingNote) {
        await EducationService.updateNote(editingNote.note_id, { title: formTitle, content: formContent, tags });
      } else {
        await EducationService.createNote({ chapterId: formChapterId || null, title: formTitle, content: formContent, tags });
      }
      setShowForm(false);
      await loadNotes();
    } catch {
      setFormError("Couldn't save this note. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId) => {
    try {
      await EducationService.deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.note_id !== noteId));
    } catch {
      setError("Couldn't delete that note. Please try again.");
    }
  };

  const handleGenerateAiNote = async () => {
    if (!formChapterId) return;
    setGeneratingAiNote(true);
    setFormError('');
    try {
      const res = await EducationService.chatWithTutor(
        Number(formChapterId),
        'Please write clear, well-organized study notes for this chapter, using headings and short paragraphs.'
      );
      setFormContent(res?.data?.answer || '');
      if (!formTitle) {
        const chapter = chapters.find((c) => String(c.chapter_id) === String(formChapterId));
        if (chapter) setFormTitle(`${chapter.name} — AI Notes`);
      }
    } catch {
      setFormError("Couldn't generate AI notes right now. Please try again.");
    } finally {
      setGeneratingAiNote(false);
    }
  };

  const handleSummarize = async (note) => {
    if (!note.chapter_id) return;
    setSummary({ noteId: note.note_id, loading: true, text: '', error: '' });
    try {
      const res = await EducationService.chatWithTutor(note.chapter_id, `Summarize this into 2-3 concise sentences:\n\n"${note.content}"`);
      setSummary({ noteId: note.note_id, loading: false, text: res?.data?.answer || '', error: '' });
    } catch {
      setSummary({ noteId: note.note_id, loading: false, text: '', error: "Couldn't summarize right now." });
    }
  };

  const handleConvert = async (note, type) => {
    if (!note.chapter_id) return;
    setConversion({ type, loading: true, error: '', data: null });
    try {
      if (type === 'flashcards') {
        const res = await EducationService.generateFlashcards(note.chapter_id, 6, note.content);
        setConversion({ type, loading: false, error: '', data: res?.data?.cards || [] });
      } else {
        const res = await EducationService.generateQuiz(note.chapter_id, 5, 'quiz', 'standard', note.content);
        setConversion({ type, loading: false, error: '', data: res?.data || null });
      }
    } catch {
      setConversion({ type, loading: false, error: "Couldn't generate that right now. Please try again.", data: null });
    }
  };

  const q = search.trim().toLowerCase();
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (!q) return true;
      return (
        n.title?.toLowerCase().includes(q) ||
        n.content?.toLowerCase().includes(q) ||
        n.chapter?.name?.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [notes, q]);

  // Quick Stats
  const stats = useMemo(() => {
    const total = notes.length;
    const tagged = notes.filter((n) => n.tags?.length > 0).length;
    const aiNotes = notes.filter((n) => n.title?.toLowerCase().includes('ai')).length;
    return { total, tagged, aiNotes };
  }, [notes]);

  return (
    <main className="flex-grow py-stack-lg px-2 sm:px-3 bg-surface-bright min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-stack-md">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-elevated rounded-3xl p-6 md:p-8 relative overflow-hidden border border-primary/20 bg-gradient-to-r from-primary/10 via-surface-container-low to-transparent"
        >
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-label-md font-bold">
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                Notes Hub
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">My Notes</h1>
              <p className="text-body-lg text-on-surface-variant max-w-xl">
                Organize key concepts, tag important topics, or auto-generate AI study summaries.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={openCreate}
                className="px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-label-lg hover:opacity-90 shadow-lg shadow-primary/25 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                New Note
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-border-subtle/50 max-w-md">
            <div className="glass-card rounded-2xl p-3.5 text-center border border-border-subtle/80 bg-surface/50">
              <span className="text-label-sm text-on-surface-variant block font-medium">Total Notes</span>
              <span className="font-extrabold text-headline-sm text-on-surface">{stats.total}</span>
            </div>
            <div className="glass-card rounded-2xl p-3.5 text-center border border-border-subtle/80 bg-surface/50">
              <span className="text-label-sm text-on-surface-variant block font-medium">Tagged</span>
              <span className="font-extrabold text-headline-sm text-primary">{stats.tagged}</span>
            </div>
            <div className="glass-card rounded-2xl p-3.5 text-center border border-border-subtle/80 bg-surface/50">
              <span className="text-label-sm text-on-surface-variant block font-medium">AI Notes</span>
              <span className="font-extrabold text-headline-sm text-purple-600">{stats.aiNotes}</span>
            </div>
          </div>
        </motion.div>

        {/* Search Bar */}
        {!showForm && notes.length > 0 && (
          <div className="relative max-w-xl">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder="Search notes by title, content, chapter, or #tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-2xl border border-border-subtle/80 text-on-surface text-body-md placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        )}

        {/* Note Form Drawer / Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onSubmit={handleSave}
              className="glass-card-elevated rounded-3xl p-6 md:p-8 space-y-4 border border-primary/20 shadow-xl"
            >
              <div className="flex justify-between items-center border-b border-border-subtle/50 pb-3">
                <h3 className="font-bold text-headline-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">
                    {editingNote ? 'edit' : 'edit_document'}
                  </span>
                  {editingNote ? 'Edit Note' : 'Create New Note'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-on-surface-variant hover:text-error transition-colors p-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  className="flex-1 rounded-2xl border border-border-subtle bg-surface px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-primary"
                  value={formChapterId}
                  onChange={(e) => setFormChapterId(e.target.value)}
                >
                  <option value="">General Note (No chapter)</option>
                  {chapters.map((c) => (
                    <option key={c.chapter_id} value={c.chapter_id}>
                      {c.subjectLabel} · {c.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleGenerateAiNote}
                  disabled={!formChapterId || generatingAiNote}
                  title="Generate notes for this chapter with AI"
                  className="shrink-0 flex items-center justify-center gap-2 rounded-2xl border border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10 px-5 py-3 text-label-lg font-bold hover:bg-purple-500 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  {generatingAiNote ? 'Writing Note…' : 'AI Generate Notes'}
                </button>
              </div>

              <input
                type="text"
                className="w-full rounded-2xl border border-border-subtle bg-surface px-4 py-3 text-body-md font-bold text-on-surface focus:outline-none focus:border-primary"
                placeholder="Note Title (Optional)"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />

              <textarea
                className="w-full rounded-2xl border border-border-subtle bg-surface px-4 py-3 text-body-md text-on-surface min-h-[160px] font-mono text-sm focus:outline-none focus:border-primary"
                placeholder="Write your note... (Markdown supported: ## Headings, **bold**, - lists)"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                required
              />

              <input
                type="text"
                className="w-full rounded-2xl border border-border-subtle bg-surface px-4 py-3 text-body-md text-on-surface focus:outline-none focus:border-primary"
                placeholder="Tags, comma separated (e.g. formulas, exam, important)"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
              />

              {formError && <p className="text-error text-body-md">{formError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-6 py-2.5 rounded-xl border border-border-subtle text-on-surface-variant font-bold hover:bg-surface-container-high transition-all cursor-pointer"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold hover:opacity-90 shadow-md shadow-primary/20 transition-all disabled:opacity-50 cursor-pointer"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <span className="material-symbols-outlined animate-spin text-5xl text-primary">progress_activity</span>
            <p className="text-body-md font-medium text-on-surface-variant">Loading your notes collection...</p>
          </div>
        ) : error ? (
          <div className="glass-card rounded-2xl p-6 text-center text-on-surface-variant">{error}</div>
        ) : filteredNotes.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-3xl p-10 text-center space-y-5 border border-border-subtle/70"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-4xl">edit_note</span>
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                {notes.length === 0 ? 'No Notes Created Yet' : 'No Matching Notes'}
              </h3>
              <p className="text-body-md text-on-surface-variant">
                {notes.length === 0
                  ? 'Start capturing formulas, chapter summaries, and revision points.'
                  : `No notes matched your search for "${search}".`}
              </p>
            </div>
            {notes.length === 0 && (
              <button
                onClick={openCreate}
                className="px-6 py-3 rounded-2xl bg-primary text-on-primary font-bold text-label-lg hover:opacity-90 shadow-lg shadow-primary/25 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                Write Your First Note
              </button>
            )}
          </motion.div>
        ) : (
          /* Notes Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredNotes.map((note) => (
              <motion.div
                key={note.note_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-5 flex flex-col h-full cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all duration-200 group border border-border-subtle/70"
                onClick={() => setViewingNote(note)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    {note.title && (
                      <h3 className="font-bold text-on-surface truncate text-body-md group-hover:text-primary transition-colors">
                        {note.title}
                      </h3>
                    )}
                    {note.chapter?.name && (
                      <p className="text-label-sm text-primary font-semibold truncate flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[14px]">auto_stories</span>
                        {note.chapter.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer"
                      onClick={() => setPreviewingId(previewingId === note.note_id ? null : note.note_id)}
                      title={previewingId === note.note_id ? 'Show raw text' : 'Rich markdown preview'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {previewingId === note.note_id ? 'code' : 'article'}
                      </span>
                    </button>
                    <button
                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer"
                      onClick={() => openEdit(note)}
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors cursor-pointer"
                      onClick={() => handleDelete(note.note_id)}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>

                <div className="my-3 flex-1 min-h-0 overflow-hidden">
                  {previewingId === note.note_id ? (
                    <div className="text-body-md text-on-surface line-clamp-4">
                      <ReactMarkdown components={NOTE_MARKDOWN_COMPONENTS}>{note.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-body-md text-on-surface-variant whitespace-pre-wrap line-clamp-4">
                      {note.content}
                    </p>
                  )}
                </div>

                {/* Tags */}
                {note.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {note.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                    {note.tags.length > 4 && (
                      <span className="text-[11px] font-bold text-on-surface-variant px-1">
                        +{note.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-label-sm text-on-surface-variant pt-2 border-t border-border-subtle/50">
                  <span>{formatDate(note.updated_at || note.created_at)}</span>
                </div>

                {/* AI Actions */}
                {note.chapter_id && (
                  <div
                    className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-border-subtle/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleSummarize(note)}
                      disabled={summary?.loading && summary?.noteId === note.note_id}
                      className="flex items-center gap-1 text-label-sm font-bold text-primary hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">summarize</span>
                      Summarize
                    </button>
                    <button
                      onClick={() => handleConvert(note, 'flashcards')}
                      className="flex items-center gap-1 text-label-sm font-bold text-emerald-600 hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">style</span>
                      Flashcards
                    </button>
                    <button
                      onClick={() => handleConvert(note, 'quiz')}
                      className="flex items-center gap-1 text-label-sm font-bold text-purple-600 hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">quiz</span>
                      Quiz
                    </button>
                  </div>
                )}

                {summary?.noteId === note.note_id && (
                  <div className="bg-surface-container-high/60 rounded-xl p-3 mt-2 border border-border-subtle/60" onClick={(e) => e.stopPropagation()}>
                    {summary.loading ? (
                      <div className="flex items-center gap-2 text-label-md text-primary font-semibold">
                        <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                        Generating AI summary...
                      </div>
                    ) : summary.error ? (
                      <p className="text-error text-label-md">{summary.error}</p>
                    ) : (
                      <p className="text-label-md text-on-surface italic">{summary.text}</p>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Feature Teasers */}
        <div className="glass-card rounded-2xl p-5 border border-border-subtle/60 space-y-2">
          <p className="font-bold text-body-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
            Upcoming Note Tools
          </p>
          <div className="flex flex-wrap gap-2">
            {['🎙️ Voice Notes', '🖼️ Image Notes', '📄 PDF Annotations', '🎨 Canvas Drawing', '👥 Peer Sharing'].map((label) => (
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

      {/* Full Note View Modal */}
      {viewingNote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setViewingNote(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl p-6 md:p-8 space-y-4 max-h-[85vh] overflow-y-auto border border-border-subtle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-4 border-b border-border-subtle/60 pb-3">
              <div className="min-w-0">
                {viewingNote.title && (
                  <h2 className="font-extrabold text-headline-sm text-on-surface">{viewingNote.title}</h2>
                )}
                {viewingNote.chapter?.name && (
                  <p className="text-label-md text-primary font-bold mt-0.5">{viewingNote.chapter.name}</p>
                )}
              </div>
              <button
                onClick={() => setViewingNote(null)}
                className="text-on-surface-variant hover:text-error transition-colors p-1 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            <div className="text-body-md text-on-surface space-y-2">
              <ReactMarkdown components={NOTE_MARKDOWN_COMPONENTS}>{viewingNote.content}</ReactMarkdown>
            </div>

            {viewingNote.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {viewingNote.tags.map((tag) => (
                  <span key={tag} className="text-[11px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <p className="text-label-sm text-on-surface-variant">{formatDate(viewingNote.updated_at || viewingNote.created_at)}</p>

            <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle/60">
              <button
                onClick={() => {
                  setViewingNote(null);
                  openEdit(viewingNote);
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl border border-border-subtle text-on-surface font-bold hover:bg-surface-container-high transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Edit
              </button>
              <button
                onClick={() => {
                  handleDelete(viewingNote.note_id);
                  setViewingNote(null);
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-error/10 text-error font-bold hover:bg-error/20 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Convert Modal */}
      {conversion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setConversion(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface rounded-3xl shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-4 max-h-[85vh] overflow-y-auto border border-border-subtle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-border-subtle/60 pb-3">
              <h3 className="font-extrabold text-headline-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  {conversion.type === 'flashcards' ? 'style' : 'quiz'}
                </span>
                {conversion.type === 'flashcards' ? 'Note Flashcards' : 'Note Quiz'}
              </h3>
              <button onClick={() => setConversion(null)} className="text-on-surface-variant hover:text-error transition-colors p-1 cursor-pointer">
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {conversion.loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                <p className="text-label-md text-on-surface-variant font-medium">Generating practice from your note...</p>
              </div>
            ) : conversion.error ? (
              <p className="text-error text-body-md">{conversion.error}</p>
            ) : conversion.type === 'flashcards' ? (
              <div className="space-y-3">
                {conversion.data.map((card, idx) => (
                  <div key={idx} className="glass-card rounded-2xl p-4 border border-border-subtle/70 space-y-1">
                    <p className="font-bold text-body-md text-on-surface">Q: {card.front}</p>
                    <p className="text-body-md text-on-surface-variant pt-1 border-t border-border-subtle/40">A: {card.back}</p>
                  </div>
                ))}
              </div>
            ) : conversion.data ? (
              <NoteQuizPlayer attempt={conversion.data} onClose={() => setConversion(null)} />
            ) : null}
          </motion.div>
        </div>
      )}
    </main>
  );
};

export default MyNotes;
