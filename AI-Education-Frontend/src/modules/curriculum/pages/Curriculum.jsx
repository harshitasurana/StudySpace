import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EducationService from '../../../services/EducationService';

const STATUS_LABELS = {
  completed: 'Mastered',
  in_progress: 'In-Progress',
  not_started: 'Not Started',
};

const Curriculum = () => {
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]); // [{ id, label }]
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [studentProfileId, setStudentProfileId] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [chapters, setChapters] = useState([]);
  const [chaptersError, setChaptersError] = useState('');
  const [loadingChapters, setLoadingChapters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getMyProfile();
        if (cancelled) return;
        const profileSubjects = (res?.data?.subjects || []).map((s) => ({ id: s.subject_id, label: s.name }));
        setSubjects(profileSubjects);
        setStudentProfileId(res?.data?.student_profile_id || null);
        if (profileSubjects.length > 0) setSelectedSubjectId(profileSubjects[0].id);
      } catch (err) {
        if (cancelled) return;
        setProfileError(
          err?.response?.status === 404
            ? 'Complete your profile setup to see your curriculum.'
            : "Couldn't load your profile. Please refresh and try again."
        );
      } finally {
        if (!cancelled) setLoadingProfile(false);
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
        const [chaptersRes, progressRes] = await Promise.all([
          EducationService.getChapters(selectedSubjectId),
          studentProfileId
            ? EducationService.getChapterProgress(studentProfileId)
            : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;

        const progressByChapter = new Map((progressRes?.data || []).map((p) => [p.chapter_id, p]));
        const merged = (chaptersRes?.data || []).map((chapter) => {
          const progress = progressByChapter.get(chapter.chapter_id);
          return {
            id: chapter.chapter_id,
            chapter: chapter.name,
            icon: chapter.icon || 'menu_book',
            chapter_order: chapter.chapter_order,
            progress: progress ? Number(progress.progress_percent) : 0,
            status: STATUS_LABELS[progress?.status] || STATUS_LABELS.not_started,
          };
        });

        setChapters(merged);
        setChaptersError('');
      } catch (err) {
        if (!cancelled) setChaptersError("Couldn't load chapters for this subject. Please try again.");
      } finally {
        if (!cancelled) setLoadingChapters(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSubjectId, studentProfileId]);

  const currentlyStudyingId = chapters.find((c) => c.status === 'In-Progress')?.id;

  // /lesson-heron renders the real AI Tutor (TutorChat) — it MUST carry
  // ?subject=&chapter=, since TutorChat grounds its conversation from
  // those params and otherwise silently defaults to some other
  // subject/chapter's most recent thread (see TutorChat.jsx), which would
  // show content unrelated to the chapter the student actually clicked.
  const handleAction = (chapter) => {
    if (chapter.status === 'Mastered') {
      navigate('/practice');
    } else if (chapter.progress > 0) {
      navigate(`/lesson-heron?subject=${selectedSubjectId}&chapter=${chapter.id}`);
    } else {
      navigate(`/pre-assessment/${chapter.id}`);
    }
  };

  const selectedSubjectLabel = subjects.find((s) => s.id === selectedSubjectId)?.label || '';

  return (
    <>
      <div className="flex">
        <main className="flex-grow p-margin-mobile md:p-margin-desktop bg-surface-bright">
          <div className="max-w-7xl mx-auto space-y-stack-md mb-stack-lg">
            {/* Header & Filter Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface">Curriculum Library</h1>
                <p className="text-body-lg text-on-surface-variant">
                  {selectedSubjectLabel
                    ? `Master your ${selectedSubjectLabel} roadmap with adaptive AI guidance.`
                    : 'Master your curriculum roadmap with adaptive AI guidance.'}
                </p>
              </div>
              {subjects.length > 0 && (
                <div className="flex bg-surface-container dark:bg-[#1e2d4a] rounded-full p-1 border border-border-subtle dark:border-[#2e3f5f]">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      onClick={() => setSelectedSubjectId(subject.id)}
                      className={`px-6 py-2 rounded-full font-bold text-label-md transition-all cursor-pointer ${
                        selectedSubjectId === subject.id
                          ? 'bg-primary text-white shadow-md'
                          : 'text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-[#152238] dark:text-[#f1f5f9]'
                      }`}
                    >
                      {subject.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loadingProfile ? (
              <div className="flex justify-center py-16">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
              </div>
            ) : profileError ? (
              <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">{profileError}</div>
            ) : subjects.length === 0 ? (
              <div className="glass-card rounded-xl p-6 text-center text-on-surface-variant">
                No subjects are set up on your profile yet.
              </div>
            ) : (
              <div className="bento-grid mt-6">
                {loadingChapters ? (
                  <div className="col-span-full flex justify-center py-16">
                    <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                  </div>
                ) : chaptersError ? (
                  <div className="col-span-full glass-card rounded-xl p-6 text-center text-on-surface-variant">
                    {chaptersError}
                  </div>
                ) : chapters.length === 0 ? (
                  <div className="col-span-full glass-card rounded-xl p-6 text-center text-on-surface-variant">
                    No chapters have been published for this subject yet.
                  </div>
                ) : (
                  chapters.map((ch, idx) => {
                    const chNumStr = String(idx + 1).padStart(2, '0');
                    const isCurrentlyStudying = ch.id === currentlyStudyingId;

                    return (
                      <div
                        key={ch.id}
                        className={`bg-surface-container-lowest p-6 rounded-xl border transition-all ${
                          isCurrentlyStudying
                            ? 'border-2 border-primary shadow-lg scale-[1.01]'
                            : 'border-border-subtle shadow-sm hover:shadow-md'
                        } relative overflow-hidden flex flex-col min-h-[380px]`}
                      >
                        {isCurrentlyStudying && (
                          <div className="absolute top-0 right-0 bg-primary text-on-primary px-3 py-1 rounded-bl-lg font-label-md text-[12px]">
                            CURRENTLY STUDYING
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-4">
                          <span className={`font-label-md font-bold ${isCurrentlyStudying ? 'text-primary' : 'text-outline'}`}>
                            CHAPTER {chNumStr}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined ${isCurrentlyStudying ? 'text-primary' : 'text-outline'}`}>
                              {ch.icon}
                            </span>
                          </div>
                        </div>
                        <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{ch.chapter}</h3>

                        <div className="space-y-2 mb-6 mt-auto">
                          <div className="flex justify-between text-label-md">
                            <span className="text-on-surface-variant">Mastery Level</span>
                            <span className={`${ch.status === 'Mastered' ? 'text-success-mastery' : 'text-primary'} font-bold`}>
                              {ch.progress}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                            <div
                              className={`h-full ${ch.status === 'Mastered' ? 'bg-success-mastery mastery-glow' : 'bg-primary'}`}
                              style={{ width: `${ch.progress}%` }}
                            ></div>
                          </div>
                        </div>

                        {ch.status === 'Mastered' ? (
                          <button
                            className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                            onClick={() => handleAction(ch)}
                          >
                            Continue Practice <span className="material-symbols-outlined">arrow_forward</span>
                          </button>
                        ) : ch.progress > 0 ? (
                          <button
                            className="w-full border border-primary text-primary py-3 rounded-lg font-bold hover:bg-primary hover:text-on-primary transition-all cursor-pointer"
                            onClick={() => handleAction(ch)}
                          >
                            Review Concept
                          </button>
                        ) : (
                          <button
                            className="w-full border border-primary text-primary py-3 rounded-lg font-bold hover:bg-primary hover:text-on-primary transition-all cursor-pointer"
                            onClick={() => handleAction(ch)}
                          >
                            Start Learning
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* FAB Component */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => navigate('/practice')}
          className="bg-focus-orange text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group cursor-pointer"
        >
          <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform">bolt</span>
        </button>
      </div>
    </>
  );
};

export default Curriculum;
