import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import WizardStepper from '../shared/WizardStepper';
import useStudentMode from '../../../hooks/useStudentMode';
import SchoolNameAutocomplete from '../shared/SchoolNameAutocomplete';
import AuthHeader from '../../../modules/authentication/components/AuthHeader';

const STEP_LABELS = ['School Name', 'Board', 'Class', 'Subjects', 'Details', 'Code'];

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

const SchoolStudentWizard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mode, isLoading: modeLoading, refreshMode } = useStudentMode();
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [studentCode, setStudentCode] = useState('');

  const isChangingType = searchParams.get('change') === '1';
  const alreadyOnboarded = !modeLoading && (mode === 'school' || mode === 'self') && !isChangingType;

  useEffect(() => {
    if (alreadyOnboarded) {
      navigate('/', { replace: true });
    }
  }, [alreadyOnboarded, navigate]);

  const [schoolName, setSchoolName] = useState('');
  const [boards, setBoards] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [form, setForm] = useState({
    boardId: null,
    boardName: '',
    classId: null,
    className: '',
    subjectIds: [],
    section: '',
    rollNumber: '',
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
  const selectBoard = (b) => setForm((prev) => ({ ...prev, boardId: b.id, boardName: b.label }));
  const selectClass = (c) => setForm((prev) => ({ ...prev, classId: c.id, className: c.label }));
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
        return !!schoolName.trim();
      case 1:
        return !!form.boardId;
      case 2:
        return !!form.classId;
      case 3:
        return form.subjectIds.length > 0;
      default:
        return true;
    }
  };

  const handleSubmitDetails = async () => {
    setSubmitting(true);
    setError('');
    try {
      const profileRes = await EducationService.createStudentProfile({
        board_id: form.boardId,
        class_id: form.classId,
        subject_ids: form.subjectIds,
        school_name: schoolName.trim(),
        section: form.section.trim() || null,
        roll_number: form.rollNumber.trim() || null,
        learning_mode: 'school',
      });
      setStudentCode(profileRes?.data?.student_code || 'STU-XXXXX-XXXX');
      goNext();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your details. Please try again.');
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

          {stepIndex === 0 && (
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  What's Your School's Name?
                </h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-xs mt-1">
                  Type your school name to associate your student profile with your institution.
                </p>
              </div>
              <SchoolNameAutocomplete value={schoolName} onChange={setSchoolName} />
            </section>
          )}

          {stepIndex === 1 && (
            loadingMeta ? (
              <div className="flex justify-center py-12">
                <span className="material-symbols-outlined animate-spin text-4xl text-[#064e3b]">
                  progress_activity
                </span>
              </div>
            ) : (
              <section className="space-y-4">
                {schoolName && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E6F4EA] dark:bg-emerald-950/60 border border-emerald-200/60 text-[#064e3b] dark:text-emerald-300 font-bold text-xs">
                    <span>School:</span>
                    <span className="font-black">{schoolName}</span>
                  </div>
                )}
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Choose Your Board
                </h3>
                <OptionGrid options={boards} selectedId={form.boardId} onSelect={selectBoard} columns={2} />
              </section>
            )
          )}

          {stepIndex === 2 && (
            <section className="space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Select Your Class
              </h3>
              <OptionGrid options={classes} selectedId={form.classId} onSelect={selectClass} columns={4} />
            </section>
          )}

          {stepIndex === 3 && (
            <section className="space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Select the Subjects You Study
              </h3>
              <SubjectChecklist options={subjects} selectedIds={form.subjectIds} onToggle={toggleSubject} />
            </section>
          )}

          {stepIndex === 4 && (
            <section className="space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Your Academic Details
              </h3>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Section <span className="normal-case font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={form.section}
                  onChange={(e) => update('section', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-[#064e3b]"
                  placeholder="e.g. A"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  Roll Number <span className="normal-case font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={form.rollNumber}
                  onChange={(e) => update('rollNumber', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:border-[#064e3b]"
                  placeholder="e.g. 24"
                />
              </div>
            </section>
          )}

          {stepIndex === 5 && (
            <section className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-[#E6F4EA] text-[#064e3b] dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center mx-auto text-3xl shadow-sm">
                🎉
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Your Student Code is Ready!
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm max-w-sm mx-auto">
                Share this unique code with your school teacher or administrator to sync your academic progress.
              </p>

              <div className="bg-[#E6F4EA]/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-5 max-w-sm mx-auto space-y-1">
                <p className="text-2xl font-mono font-black text-[#064e3b] dark:text-emerald-300 tracking-widest">
                  {studentCode}
                </p>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  This code links your account with your school roster.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 max-w-md mx-auto space-y-2 text-xs font-bold text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">School:</span>
                  <span className="text-slate-900 dark:text-white font-black">{schoolName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Board:</span>
                  <span className="text-slate-900 dark:text-white font-black">{form.boardName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Class:</span>
                  <span className="text-slate-900 dark:text-white font-black">{form.className}</span>
                </div>
                {form.section && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Section:</span>
                    <span className="text-slate-900 dark:text-white font-black">{form.section}</span>
                  </div>
                )}
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
            {stepIndex > 0 && stepIndex < 5 ? (
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
              {stepIndex >= 0 && stepIndex <= 3 && (
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

              {stepIndex === 4 && (
                <button
                  type="button"
                  onClick={handleSubmitDetails}
                  disabled={submitting}
                  className="bg-[#064e3b] hover:bg-[#043b2c] active:scale-[0.99] text-white font-black px-6 py-3 rounded-2xl text-xs sm:text-sm shadow-md shadow-emerald-950/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{submitting ? 'Saving...' : 'Next'}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              )}

              {stepIndex === 5 && (
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

export default SchoolStudentWizard;
