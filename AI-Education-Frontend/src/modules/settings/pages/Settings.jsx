import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useUser from '../../../hooks/useUser';
import useTheme from '../../../hooks/useTheme';
import ProfileService from '../../../services/ProfileService';
import NotificationService from '../../../services/NotificationService';
import SecurityService from '../../../services/SecurityService';
import EducationService from '../../../services/EducationService';

const TABS = [
  { key: 'profile', label: 'My Account', icon: 'person' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications' },
  { key: 'appearance', label: 'Appearance', icon: 'palette' },
  { key: 'security', label: 'Privacy & Security', icon: 'shield' },
  { key: 'preferences', label: 'Preferences', icon: 'tune' },
];

const getSubjectSymbol = (name = '') => {
  const lower = name.toLowerCase();
  if (lower.includes('math') || lower.includes('alg') || lower.includes('geom')) return { symbol: 'Σ', icon: null };
  if (lower.includes('sci') || lower.includes('bio') || lower.includes('chem') || lower.includes('phys')) return { symbol: null, icon: 'biotech' };
  if (lower.includes('eng') || lower.includes('lit') || lower.includes('lang')) return { symbol: null, icon: 'auto_stories' };
  if (lower.includes('soc') || lower.includes('hist') || lower.includes('geo')) return { symbol: null, icon: 'public' };
  if (lower.includes('hin') || lower.includes('hindi') || lower.includes('sans')) return { symbol: 'अ', icon: null };
  return { symbol: null, icon: 'menu_book' };
};

const inputClass =
  'w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all shadow-xs disabled:opacity-60 disabled:bg-gray-50 dark:disabled:bg-slate-800/40 disabled:cursor-not-allowed';
const labelClass = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5';

const StatusLine = ({ status }) => {
  if (!status) return null;
  return (
    <p className={`text-xs font-bold flex items-center gap-1.5 ${status.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
      <span className="material-symbols-outlined text-[16px]">
        {status.type === 'error' ? 'error' : 'check_circle'}
      </span>
      {status.text}
    </p>
  );
};

const ProfileTab = () => {
  const navigate = useNavigate();
  const { updateProfile } = useUser();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [academic, setAcademic] = useState(null);
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ProfileService.getProfile();
        const p = res?.data || {};
        if (cancelled) return;
        setForm({
          first_name: p.first_name || '',
          last_name: p.last_name || '',
          email: p.email || '',
          phone: p.phone || '',
        });
        setRole(p.role || 'Student');
      } catch {
        if (!cancelled) setStatus({ type: 'error', text: "Couldn't load your profile." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    EducationService.getMyProfile()
      .then((res) => {
        if (cancelled) return;
        const p = res?.data;
        setAcademic({
          board: p?.board?.name || 'CBSE',
          className: p?.class?.name || '9',
          subjects: Array.isArray(p?.subjects) && p.subjects.length > 0
            ? p.subjects.map((s) => s.name)
            : ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi'],
          school: p?.school ? { name: p.school.name, code: p.school.school_code } : null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAcademic({
            board: 'CBSE',
            className: '9',
            subjects: ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi'],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await updateProfile(form);
      setStatus({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setStatus({ type: 'error', text: err?.response?.data?.message || 'Failed to save profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <span className="material-symbols-outlined animate-spin text-3xl text-emerald-600 mr-2">progress_activity</span>
        <span className="text-sm font-medium">Loading profile details…</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Section 1: Personal Information */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Personal Information</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Keep your basic details up to date.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>First Name</label>
            <input
              className={inputClass}
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              placeholder="First Name"
            />
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <input
              className={inputClass}
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              placeholder="Last Name"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Email Address</label>
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@domain.com"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Phone Number (Optional)</label>
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Enter your phone number"
            />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <div className="relative">
              <select
                className={`${inputClass} appearance-none pr-10 cursor-not-allowed`}
                value={role}
                disabled
              >
                <option value={role}>{role || 'Student'}</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Academic Details */}
      {academic && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">school</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Academic Details</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This helps us personalize your learning experience.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/education/onboarding/role?change=1')}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 hover:underline shrink-0 cursor-pointer"
            >
              Change Student Type
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Board</label>
              <div className="relative">
                <select
                  className={`${inputClass} appearance-none pr-10`}
                  value={academic.board || 'CBSE'}
                  onChange={(e) => setAcademic({ ...academic, board: e.target.value })}
                >
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="State Board">State Board</option>
                  <option value="IB">IB</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">
                  expand_more
                </span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Class</label>
              <div className="relative">
                <select
                  className={`${inputClass} appearance-none pr-10`}
                  value={academic.className || '9'}
                  onChange={(e) => setAcademic({ ...academic, className: e.target.value })}
                >
                  {['6', '7', '8', '9', '10', '11', '12'].map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          {academic.school && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className={labelClass}>School Name</label>
                <input className={inputClass} value={academic.school.name} disabled />
              </div>
              <div>
                <label className={labelClass}>School Code</label>
                <input className={inputClass} value={academic.school.code} disabled />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Subjects</label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Select the subjects you're learning (read-only).</p>
            <div className="flex flex-wrap gap-2.5">
              {academic.subjects.map((subName) => {
                const { symbol, icon } = getSubjectSymbol(subName);
                return (
                  <div
                    key={subName}
                    className="px-4 py-2 rounded-full bg-[#e6f4ea] dark:bg-emerald-950/40 text-[#064e3b] dark:text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-2 border border-emerald-200/60 dark:border-emerald-800/40 shadow-2xs"
                  >
                    {symbol ? (
                      <span className="font-semibold text-base leading-none text-emerald-800 dark:text-emerald-300">{symbol}</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px] text-emerald-800 dark:text-emerald-300">{icon}</span>
                    )}
                    <span>{subName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Save Button Bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <StatusLine status={status} />
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[#064e3b] text-white font-bold text-sm hover:bg-[#04392b] transition-all shadow-sm shadow-emerald-950/20 flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

const NOTIFICATION_GROUPS = [
  {
    title: 'In-App Notifications',
    items: [
      {
        key: 'system_task_updates',
        label: 'Learning Activity Updates',
        desc: 'Quiz results, mock test results, and streak notifications in the Topbar bell — turning this off stops these from being sent',
      },
    ],
  },
];

const NotificationsTab = () => {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    NotificationService.getPreferences()
      .then((res) => {
        if (!cancelled) setPrefs(res?.data || {});
      })
      .catch(() => {
        if (!cancelled) setStatus({ type: 'error', text: "Couldn't load notification preferences." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (key, nextValue) => {
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: nextValue }));
    setSavingKey(key);
    setStatus(null);
    try {
      await NotificationService.togglePreference(key, nextValue);
    } catch (err) {
      setPrefs((p) => ({ ...p, [key]: previous }));
      setStatus({ type: 'error', text: err?.response?.data?.message || 'Failed to update preference.' });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <span className="material-symbols-outlined animate-spin text-3xl text-emerald-600 mr-2">progress_activity</span>
        <span className="text-sm font-medium">Loading preferences…</span>
      </div>
    );
  }

  if (!prefs) return <StatusLine status={status} />;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xs space-y-6">
      <StatusLine status={status} />
      {NOTIFICATION_GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">{group.title}</h3>
          <div className="space-y-4">
            {group.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!prefs[item.key]}
                  disabled={savingKey === item.key}
                  onClick={() => handleToggle(item.key, !prefs[item.key])}
                  className={`shrink-0 relative w-12 h-6.5 rounded-full transition-colors cursor-pointer disabled:opacity-60 ${
                    prefs[item.key] ? 'bg-[#064e3b]' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5.5 h-5.5 rounded-full bg-white shadow-xs transition-transform ${
                      prefs[item.key] ? 'translate-x-5.5' : ''
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const AppearanceTab = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xs space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Appearance Theme</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Choose how StudySpace looks on your device.</p>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          {[
            { id: 'light', label: 'Light Theme', icon: 'light_mode', desc: 'Default bright look' },
            { id: 'dark', label: 'Dark Theme', icon: 'dark_mode', desc: 'Easier on the eyes' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                theme === t.id
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-[#064e3b] dark:text-emerald-300 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="material-symbols-outlined text-2xl mb-2 text-emerald-700 dark:text-emerald-400">{t.icon}</span>
              <p className="font-bold text-sm">{t.label}</p>
              <p className="text-xs opacity-75 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const ChangePasswordForm = () => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setStatus({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await SecurityService.changePassword(form.currentPassword, form.newPassword, form.confirmPassword);
      setStatus({ type: 'success', text: 'Password changed successfully.' });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setStatus({ type: 'error', text: err?.response?.data?.message || 'Failed to change password.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xs space-y-4 max-w-xl">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Change Password</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Ensure your account uses a strong, unique password.</p>
      </div>

      <div>
        <label className={labelClass}>Current Password</label>
        <input
          type="password"
          required
          className={inputClass}
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className={labelClass}>New Password</label>
        <input
          type="password"
          required
          minLength={6}
          className={inputClass}
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className={labelClass}>Confirm New Password</label>
        <input
          type="password"
          required
          className={inputClass}
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          placeholder="••••••••"
        />
      </div>
      <div className="flex items-center justify-between pt-2">
        <StatusLine status={status} />
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[#064e3b] text-white font-bold text-sm hover:bg-[#04392b] transition-all shadow-sm shadow-emerald-950/20 flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">lock_reset</span>
          {saving ? 'Updating…' : 'Change Password'}
        </button>
      </div>
    </form>
  );
};

const SecurityTab = () => (
  <div className="space-y-6">
    <ChangePasswordForm />
  </div>
);

const PreferencesTab = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xs space-y-4">
    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Learning Preferences</h3>
    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Customizations for AI tutoring and content recommendations.</p>
    <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px]">tune</span>
      Personalized learning pace is enabled based on your class curriculum.
    </div>
  </div>
);

const Settings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUser();
  const [academicSummary, setAcademicSummary] = useState({ className: '9' });

  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.endsWith('/notifications')) return 'notifications';
    return 'profile';
  });

  useEffect(() => {
    EducationService.getMyProfile()
      .then((res) => {
        const p = res?.data;
        if (p?.class?.name) {
          setAcademicSummary({ className: p.class.name });
        }
      })
      .catch(() => {});
  }, []);

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Harshita Surana';
  const initial = fullName.charAt(0).toUpperCase() || 'H';
  const studentRoleText = `Class ${academicSummary.className || '9'} Student`;

  const activeTabMeta = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <div className="w-full min-h-screen bg-[#F7F3EA] dark:bg-[#0b1324] py-6 sm:py-8 px-2 sm:px-3 transition-colors">
      <div className="w-full space-y-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Sidebar Card */}
          <div className="w-full lg:w-72 shrink-0 bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-emerald-950/5 dark:border-slate-800 space-y-6">
            {/* User Profile Summary */}
            <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-13 h-13 rounded-full bg-[#1b4d3e] text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight truncate">
                  {fullName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {studentRoleText}
                </p>
              </div>
            </div>

            {/* Vertical Navigation Menu */}
            <nav className="space-y-1.5">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#e6f4ea] text-[#064e3b] dark:bg-emerald-950/60 dark:text-emerald-300 font-bold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-[#064e3b] dark:text-emerald-300' : 'text-slate-400'}`}>
                      {tab.icon}
                    </span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Main Content Area */}
          <div className="flex-1 w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xs border border-emerald-950/5 dark:border-slate-800 space-y-6 relative overflow-hidden">
            {/* Top Hero Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-950/20 shrink-0">
                  <span className="material-symbols-outlined text-[26px]">
                    {activeTabMeta.icon}
                  </span>
                </div>
                <div>
                  <h1 className="font-headline-md text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {activeTabMeta.label}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Manage your personal details, academic information, and account preferences.
                  </p>
                </div>
              </div>

              {/* Speech bubble illustration element */}
              <div className="hidden xl:flex items-center gap-3 shrink-0">
                <div className="bg-[#e6f4ea] dark:bg-emerald-950/40 text-[#064e3b] dark:text-emerald-300 text-xs font-bold px-3.5 py-2 rounded-2xl rounded-br-none shadow-2xs border border-emerald-200/60 dark:border-emerald-800/40 max-w-[170px] text-center leading-snug">
                  A better learning experience starts with you 💚
                </div>
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 text-emerald-800 dark:text-emerald-300">
                  <span className="material-symbols-outlined text-3xl">sentiment_satisfied</span>
                </div>
              </div>
            </div>

            {/* Tab Specific Content */}
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'appearance' && <AppearanceTab />}
            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'preferences' && <PreferencesTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

