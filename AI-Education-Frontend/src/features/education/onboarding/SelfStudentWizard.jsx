import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import WizardStepper from '../shared/WizardStepper';
import SchoolNameAutocomplete from '../shared/SchoolNameAutocomplete';
import useStudentMode from '../../../hooks/useStudentMode';
import AuthHeader from '../../../modules/authentication/components/AuthHeader';

const STEP_LABELS = ['Class', 'Board', 'Subjects', 'Preferences', 'Code'];

const defaultAcademicYear = () => {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

const OptionGrid = ({ options, selectedId, onSelect, columns = 3 }) => (
  <div className={`grid grid-cols-${columns} gap-3`}>
    {options.map((opt) => {
      const isSelected = selectedId === opt.id;
      return (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect(opt)}
          className={`p-3.5 rounded-2xl border-2 text-center text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            isSelected
              ? 'border-[#064e3b] bg-[#E6F4EA] text-[#064e3b] dark:bg-emerald-950/60 dark:border-emerald-600 dark:text-emerald-300 shadow-xs scale-[1.02]'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-emerald-500/50 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

const SubjectChecklist = ({ options, selectedIds, onToggle }) => (
  <div className="flex flex-col gap-2.5">
    {options.map((subject) => {
      const checked = selectedIds.includes(subject.id);
      return (
        <label
          key={subject.id}
          className={`flex items-center gap-3.5 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
            checked
              ? 'border-[#064e3b] bg-[#E6F4EA] dark:bg-emerald-950/60 dark:border-emerald-600 text-[#064e3b] dark:text-emerald-300 font-extrabold shadow-2xs'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold hover:border-emerald-500/40'
          }`}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(subject.id)}
            className="w-4 h-4 text-[#064e3b] accent-[#064e3b] rounded cursor-pointer"
          />
          <span className="text-xs sm:text-sm">{subject.label}</span>
        </label>
      );
    })}
  </div>
);

const SelfStudentWizard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mode, isLoading: modeLoading, refreshMode } = useStudentMode();
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [studentCode, setStudentCode] = useState('');

  const isChangingType = searchParams.get('change') === '1';
  const alreadyOnboarded = !modeLoading && (mode === 'self' || mode === 'school') && !isChangingType;

  useEffect(() => {
    if (alreadyOnboarded) {
      navigate('/', { replace: true });
    }
  }, [alreadyOnboarded, navigate]);

  const [boards, setBoards] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [form, setForm] = useState({
    classId: null,
    className: '',
    boardId: null,
    boardName: '',
    subjectIds: [],
    preferredLanguage: 'English',
    learningGoal: 'Improve my knowledge',
    difficulty: 'adaptive',
    openToSchoolContent: true,
    schoolName: '',
    academicYear: defaultAcademicYear(),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [boardsRes, classesRes] = await Promise.all([
          EducationService.getBoards(),
          EducationService.getClasses(),
        ]);
        if (cancelled) return;
        setBoards((boardsRes?.data || []).map((b) => ({ id: b.board_id, label: b.name })));
        setClasses((classesRes?.data || []).map((c) => ({ id: c.class_id, label: c.name })));
      } catch (err) {
        if (!cancelled) setError('Could not load class/board options. Please refresh and try again.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.boardId || !form.classId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getSubjects(form.boardId, form.classId);
        if (!cancelled) setSubjects((res?.data || []).map((s) => ({ id: s.subject_id, label: s.name })));
      } catch (err) {
        if (!cancelled) setError('Could not load subject options. Please refresh and try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.boardId, form.classId]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const selectClass = (c) => setForm((prev) => ({ ...prev, classId: c.id, className: c.label }));
  const selectBoard = (b) => setForm((prev) => ({ ...prev, boardId: b.id, boardName: b.label }));
  const toggleSubject = (subjectId) =>
    setForm((prev) => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(subjectId)
        ? prev.subjectIds.filter((id) => id !== subjectId)
        : [...prev.subjectIds, subjectId],
    }));

  const goBack = () => setStepIndex((s) => Math.max(0, s - 1));
  const goNext = () => setStepIndex((s) => Math.min(STEP_LABELS.length - 1, s + 1));

  const canProceed = () => {
    switch (stepIndex) {
      case 0:
        return !!form.classId;
      case 1:
        return !!form.boardId;
      case 2:
        return form.subjectIds.length > 0;
      default:
        return true;
    }
  };

  const handleSavePreferences = async () => {
    setSubmitting(true);
    setError('');
    try {
      const profileRes = await EducationService.createStudentProfile({
        board_id: form.boardId,
        class_id: form.classId,
        subject_ids: form.subjectIds,
        learning_mode: 'self',
        school_name: form.schoolName.trim() || null,
        academic_year: form.academicYear.trim() || null,
      });
      await EducationService.savePreferences({
        student_profile_id: profileRes?.data?.student_profile_id,
        preferred_language: form.preferredLanguage,
        learning_goal: form.learningGoal,
        difficulty_level: form.difficulty,
      });
      setStudentCode(profileRes?.data?.student_code || 'STU-XXXXX-XXXX');
      goNext();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    try {
      await EducationService.completeStudentProfile();
    } catch (err) {
      // non-blocking
    }
    await refreshMode();
    navigate('/');
  };

  if (alreadyOnboarded) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EA] dark:bg-[#0b1324] text-[#17212B] dark:text-slate-100 transition-colors">
      <AuthHeader />

      <main className="flex-grow flex items-center justify-center py-8 px-4 sm:px-6 md:px-8">
        <div className="max-w-2xl w-full bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-6">
          <WizardStepper labels={STEP_LABELS} currentIndex={stepIndex} />

          {loadingMeta && stepIndex < 2 ? (
            <div className="flex justify-center py-12">
              <span className="material-symbols-outlined animate-spin text-4xl text-[#064e3b]">
                progress_activity
              </span>
            </div>
          ) : (
            <>
              {stepIndex === 0 && (
                <section className="space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Select Your Class
                  </h3>
                  <OptionGrid
                    options={classes}
                    selectedId={form.classId}
                    onSelect={selectClass}
                    columns={4}
                  />
                </section>
              )}

              {stepIndex === 1 && (
                <section className="space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Choose Your Educational Board
                  </h3>
                  <OptionGrid
                    options={boards}
                    selectedId={form.boardId}
                    onSelect={selectBoard}
                    columns={2}
                  />
                </section>
              )}

              {stepIndex === 2 && (
                <section className="space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Select the Subjects You Want to Master
                  </h3>
                  <SubjectChecklist
                    options={subjects}
                    selectedIds={form.subjectIds}
                    onToggle={toggleSubject}
                  />
                </section>
              )}
            </>
          )}

          {stepIndex === 3 && (
            <section className="space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Customize Your Learning Preferences
              </h3>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Learning Goal
                </label>
                <select
                  value={form.learningGoal}
                  onChange={(e) => update('learningGoal', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-[#064e3b]"
                >
                  <option>Improve my knowledge</option>
                  <option>Prepare for exams</option>
                  <option>Get ahead of my class</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  School Name <span className="normal-case font-normal text-slate-400">(Optional)</span>
                </label>
                <SchoolNameAutocomplete
                  value={form.schoolName}
                  onChange={(name) => update('schoolName', name)}
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Academic Year
                </label>
                <input
                  type="text"
                  value={form.academicYear}
                  onChange={(e) => update('academicYear', e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-[#064e3b]"
                />
              </div>
            </section>
          )}

          {stepIndex === 4 && (
            <section className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-[#E6F4EA] text-[#064e3b] dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center mx-auto text-3xl shadow-sm">
                🎉
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Your Student Code is Ready!
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm max-w-sm mx-auto">
                Keep this code handy — your teacher or school may use it to view your learning progress.
              </p>

              <div className="bg-[#E6F4EA]/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-5 max-w-sm mx-auto space-y-1">
                <p className="text-2xl font-mono font-black text-[#064e3b] dark:text-emerald-300 tracking-widest">
                  {studentCode}
                </p>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  This code is unique to your student profile.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 max-w-md mx-auto text-left text-xs font-bold text-slate-700 dark:text-slate-300 space-y-2 border border-slate-200/60 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                  <span>Personalized AI Learning Paths</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                  <span>Smart Chapter-wise Quizzes &amp; Tests</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                  <span>Real-time Mastery &amp; Progress Analytics</span>
                </div>
              </div>
            </section>
          )}

          {error && (
            <p className="text-rose-600 dark:text-rose-400 font-bold text-xs sm:text-sm text-center">
              {error}
            </p>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-slate-800">
            {stepIndex > 0 && stepIndex < 4 ? (
              <button
                type="button"
                onClick={goBack}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            <div>
              {stepIndex < 3 && (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canProceed()}
                  className="bg-[#064e3b] hover:bg-[#043b2c] active:scale-[0.99] text-white font-black px-6 py-3 rounded-2xl text-xs sm:text-sm shadow-md shadow-emerald-950/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              )}

              {stepIndex === 3 && (
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={submitting}
                  className="bg-[#064e3b] hover:bg-[#043b2c] active:scale-[0.99] text-white font-black px-6 py-3 rounded-2xl text-xs sm:text-sm shadow-md shadow-emerald-950/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{submitting ? 'Saving...' : 'Next'}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              )}

              {stepIndex === 4 && (
                <button
                  type="button"
                  onClick={handleComplete}
                  className="bg-[#064e3b] hover:bg-[#043b2c] active:scale-[0.99] text-white font-black px-8 py-3.5 rounded-2xl text-sm sm:text-base shadow-lg shadow-emerald-950/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>Complete Onboarding</span>
                  <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SelfStudentWizard;