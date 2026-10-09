import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EducationService from '../../../services/EducationService';
import OnboardingStepper from '../shared/OnboardingStepper';
import useAuth from '../../../hooks/useAuth';
import useStudentMode from '../../../hooks/useStudentMode';
import { defaultRouteForRole } from '../../../routes/routeConfig';
import AuthHeader from '../../../modules/authentication/components/AuthHeader';

const ROLE_PRESENTATION = {
  student: {
    icon: 'school',
    label: 'I am a Student',
    illustration: '🧑‍🎓',
  },
  'school student': {
    icon: 'group',
    label: 'I study through my School',
    illustration: '🎓',
  },
  teacher: {
    icon: 'cast_for_education',
    label: 'I am a Teacher',
    illustration: '👩‍🏫',
  },
  school: {
    icon: 'apartment',
    label: 'I represent a School',
    illustration: '🏫',
  },
  coaching: {
    icon: 'menu_book',
    label: 'I represent a Coaching / Institute',
    illustration: '📚',
  },
};

const FALLBACK_PRESENTATION = { icon: 'person', illustration: '🙂' };

const RoleCard = ({ role, selected, onSelect }) => {
  const presentation = ROLE_PRESENTATION[role.role_name?.toLowerCase()] || FALLBACK_PRESENTATION;
  return (
    <button
      type="button"
      onClick={() => onSelect(role)}
      className={`relative flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-2xl border-2 text-center transition-all cursor-pointer w-full ${
        selected
          ? 'border-[#064e3b] bg-[#E6F4EA] dark:bg-emerald-950/60 dark:border-emerald-600 text-[#064e3b] dark:text-emerald-300 shadow-md scale-[1.02]'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-emerald-500/40 hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
    >
      {selected && (
        <span className="material-symbols-outlined absolute top-2.5 right-2.5 text-[#064e3b] dark:text-emerald-400 text-lg font-bold">
          check_circle
        </span>
      )}
      <span className="text-3xl sm:text-4xl select-none" aria-hidden="true">
        {presentation.illustration}
      </span>
      <span className="text-xs sm:text-sm font-black leading-tight">
        {presentation.label || role.role_name}
      </span>
    </button>
  );
};

const RoleSelectionPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setUser } = useAuth();
  const { mode, isLoading: modeLoading } = useStudentMode();
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isChangingType = searchParams.get('change') === '1';
  const currentRole = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : user?.role;
  const alreadyOnboarded = Boolean(currentRole) && !isChangingType;

  useEffect(() => {
    if (alreadyOnboarded) {
      navigate('/', { replace: true });
    }
  }, [alreadyOnboarded, navigate]);

  useEffect(() => {
    if (alreadyOnboarded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getPublicRoles();
        if (!cancelled) {
          const list = res?.data || [];
          setRoles(list);
          if (list.length === 1) setSelectedRoleId(list[0].role_id);
        }
      } catch (err) {
        if (!cancelled) setError('Could not load role options. Please refresh and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alreadyOnboarded]);

  if (alreadyOnboarded) return null;

  const handleContinue = async () => {
    if (!selectedRoleId) return;
    setSubmitting(true);
    setError('');
    try {
      await EducationService.setOwnRole(selectedRoleId);
      const role = roles.find((r) => r.role_id === selectedRoleId);
      const roleName = role?.role_name?.toLowerCase();

      if (roleName) {
        setUser({ ...user, role: roleName, role_id: selectedRoleId });
      }

      const changeSuffix = isChangingType ? '?change=1' : '';

      if (roleName === 'student') {
        navigate(`/education/onboarding/student/self/class${changeSuffix}`);
      } else if (roleName === 'school student') {
        navigate(`/education/onboarding/student/school/search${changeSuffix}`);
      } else {
        navigate(defaultRouteForRole(roleName));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your role. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EA] dark:bg-[#0b1324] text-[#17212B] dark:text-slate-100 transition-colors">
      <AuthHeader />

      <main className="flex-grow flex items-center justify-center py-8 px-4 sm:px-6 md:px-8">
        <div className="max-w-3xl w-full bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-6">
          <OnboardingStepper
            step={1}
            total={4}
            title="How would you like to use StudySpace?"
            subtitle="Choose the persona that best describes your learning journey."
          />

          {loading ? (
            <div className="flex justify-center py-12">
              <span className="material-symbols-outlined animate-spin text-4xl text-[#064e3b]">
                progress_activity
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 mb-6">
              {roles.map((role) => (
                <RoleCard
                  key={role.role_id}
                  role={role}
                  selected={selectedRoleId === role.role_id}
                  onSelect={(r) => setSelectedRoleId(r.role_id)}
                />
              ))}
            </div>
          )}

          {error && (
            <p className="text-rose-600 dark:text-rose-400 font-bold text-xs sm:text-sm text-center">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 rounded-2xl p-3.5 text-xs font-semibold text-[#064e3b] dark:text-emerald-300">
            <span className="material-symbols-outlined text-[18px]">info</span>
            You can modify your role selection anytime from Settings.
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedRoleId || submitting}
            className="w-full bg-[#064e3b] hover:bg-[#043b2c] active:scale-[0.99] text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-emerald-950/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{submitting ? 'Saving...' : 'Continue'}</span>
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default RoleSelectionPage;