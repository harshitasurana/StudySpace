import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useUser from '../hooks/useUser';
import useAuth from '../hooks/useAuth';
import useTheme from '../hooks/useTheme';
import useStudentMode from '../hooks/useStudentMode';
import useNotificationSocket from '../hooks/useNotificationSocket';
import { translationsDict } from '../utils/translations';
import { defaultRouteForRole } from '../routes/routeConfig';
import NotificationService from '../services/NotificationService';
import SearchService from '../services/SearchService';
import EducationService from '../services/EducationService';
import ProfileService from '../services/ProfileService';
import { playNotificationChime } from '../shared/notificationSound';

const Topbar = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useUser();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { mode: studentMode } = useStudentMode();

  const user = profile || {};
  const role = typeof user.role === 'string' ? user.role.trim().toLowerCase() : user.role;
  const displayName = user.name || 'Harshita Surana';

  const [language, setLanguage] = useState(user.language || 'en');

  useEffect(() => {
    if (user.language) setLanguage(user.language);
  }, [user.language]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifError, setNotifError] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);

  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const accountMenuRef = useRef(null);

  const dict = translationsDict[language] || translationsDict.en;
  const text = { ...dict, saveChanges: dict.save };

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

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await NotificationService.list({ limit: 10, sort: 'createdAt:DESC' });
        const list = res?.data?.notifications || [];
        setNotifications(
          list.map((n) => ({
            id: n.id,
            title: n.notification?.title || 'Notification',
            description: n.notification?.message || '',
            time: timeAgo(n.created_at),
            unread: !n.is_read,
          }))
        );
        setNotifError(false);
      } catch (err) {
        console.warn('Failed to fetch notifications.', err);
        setNotifications([]);
        setNotifError(true);
      }
    };
    fetchNotifications();
  }, []);

  useNotificationSocket((payload) => {
    setNotifications((prev) => [
      {
        id: payload.user_notification_id,
        title: payload.title || 'Notification',
        description: payload.message || '',
        time: timeAgo(new Date().toISOString()),
        unread: true,
      },
      ...prev,
    ]);
    playNotificationChime();
  });

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError(false);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await SearchService.search(searchQuery, { limit: 8 });
        const results = res?.data?.results || [];
        setSearchResults(
          results.map((item) => ({
            title: item.title,
            desc: item.description || item.subtitle || '',
            path: item.route,
            type: item.entity,
          }))
        );
        setSearchError(false);
      } catch (err) {
        console.warn('Global search failed.', err);
        setSearchResults([]);
        setSearchError(true);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [editName, setEditName] = useState(user.name || '');
  const [editEmail, setEditEmail] = useState(user.email || '');
  const [editRole, setEditRole] = useState(role);

  const [academicProfile, setAcademicProfile] = useState(null);
  useEffect(() => {
    if (!showEditProfileModal || (role !== 'student' && role !== 'school student')) return;
    let cancelled = false;
    EducationService.getMyProfile()
      .then((res) => {
        if (cancelled) return;
        const p = res?.data;
        setAcademicProfile({
          board: p?.board?.name || null,
          className: p?.class?.name || null,
          subjects: Array.isArray(p?.subjects) ? p.subjects.map((s) => s.name) : [],
          school: p?.school?.name || null,
        });
      })
      .catch(() => {
        if (!cancelled) setAcademicProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showEditProfileModal, role]);

  useEffect(() => {
    if (!showEditProfileModal) return;
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditRole(role);
    let cancelled = false;
    ProfileService.getProfile()
      .then((res) => {
        if (cancelled) return;
        const p = res?.data;
        if (!p) return;
        if (p.name) setEditName(p.name);
        if (p.email) setEditEmail(p.email);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showEditProfileModal]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const changes = { name: editName, email: editEmail, role: editRole };
    try {
      await updateProfile(changes);
      window.dispatchEvent(new Event('languageChange'));
      setShowEditProfileModal(false);
    } catch (err) {
      console.warn('ProfileService.updateProfile failed.', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMarkAllRead = async () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
    try {
      await NotificationService.markAllAsRead();
    } catch (err) {
      console.warn('Failed to mark all notifications as read on the backend.', err);
    }
  };

  const handleLogoClick = () => {
    navigate(defaultRouteForRole(role, studentMode));
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <>
      <header className="w-full sticky top-0 z-40 bg-[#F7F3EA]/95 dark:bg-[#0b1324]/95 backdrop-blur-md flex justify-between items-center px-4 sm:px-6 md:px-8 h-[72px] shrink-0 transition-colors gap-6">
        {/* Left Branding Logo */}
        <div className="flex items-center gap-3 select-none cursor-pointer shrink-0 group" onClick={handleLogoClick}>
          <div className="w-9 h-9 rounded-xl bg-[#123B35] flex items-center justify-center text-white shadow-md shadow-[#123B35]/20 group-hover:scale-105 transition-transform duration-300 overflow-hidden">
            <img src="/studyspace_logo.png" alt="StudySpace" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-lg text-[#17212B] dark:text-white tracking-tight">
              StudySpace
            </span>
            <span className="text-[10px] text-[#68737A] dark:text-slate-400 font-semibold tracking-wide">
              Learn Today. Build Tomorrow.
            </span>
          </div>
        </div>

        {/* Center Global Search Bar */}
        <div ref={searchRef} data-tour="topbar-search" className="relative flex-1 max-w-3xl mx-2 sm:mx-6 hidden md:block">
          <div className="flex bg-white dark:bg-slate-800 rounded-full px-5 py-2.5 items-center gap-3 border border-[#E6E0D5] dark:border-slate-700 focus-within:ring-2 focus-within:ring-[#168A78]/30 focus-within:border-[#168A78] transition-all duration-200 shadow-2xs">
            <span className="material-symbols-outlined text-[#68737A] dark:text-slate-400 text-[22px]">search</span>
            <input 
              className="bg-transparent border-none text-xs sm:text-sm w-full outline-none text-[#17212B] dark:text-slate-100 placeholder-[#68737A] dark:placeholder-slate-500 font-medium" 
              placeholder="Search chapters, concepts, questions or ask StudySpace..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
              onFocus={() => setShowSearchDropdown(true)}
              type="text" 
            />
            <kbd className="hidden lg:inline-block px-2.5 py-0.5 text-[11px] font-semibold text-[#68737A] dark:text-slate-500 bg-[#F7F3EA] dark:bg-slate-700/60 rounded-md border border-[#E6E0D5] dark:border-slate-600/50 select-none">⌘K</kbd>
          </div>

          {/* Search Dropdown Panel */}
          {showSearchDropdown && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-13 bg-white/98 dark:bg-[#152238]/98 backdrop-blur-xl border border-[#E6E0D5] dark:border-slate-800 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {searchResults.length > 0 ? (
                searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => { navigate(item.path); setShowSearchDropdown(false); setSearchQuery(''); }}
                    className="w-full text-left p-3 hover:bg-[#F7F3EA]/80 dark:hover:bg-slate-800/80 rounded-xl transition-all duration-150 flex flex-col gap-1 cursor-pointer group"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-[#123B35] dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">{item.title}</span>
                      <span className="text-[10px] bg-[#F7F3EA] dark:bg-slate-800 text-[#68737A] dark:text-slate-300 border border-[#E6E0D5] dark:border-slate-700 px-2 py-0.5 rounded-full font-bold">{item.type}</span>
                    </div>
                    <p className="text-xs text-[#68737A] dark:text-slate-400 truncate">{item.desc}</p>
                  </button>
                ))
              ) : searchError ? (
                <p className="text-center py-4 text-xs font-semibold text-rose-500">Search is unavailable right now.</p>
              ) : (
                <p className="text-center py-4 text-xs font-medium text-[#68737A] dark:text-slate-400">{text.noResults}</p>
              )}
            </div>
          )}
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Theme Switcher Toggle */}
          <button 
            onClick={toggleTheme}
            className="w-9 h-9 hover:bg-white dark:hover:bg-slate-800 rounded-full text-[#68737A] dark:text-slate-300 hover:text-[#17212B] dark:hover:text-white transition-all cursor-pointer flex items-center justify-center border border-transparent hover:border-[#E6E0D5] dark:hover:border-slate-700 shadow-2xs active:scale-95"
            title="Toggle Theme"
          >
            <span className="material-symbols-outlined text-[20px]">
              {theme === 'light' ? 'dark_mode' : 'light_mode'}
            </span>
          </button>

          {/* Notifications Bell */}
          <div ref={notifRef} data-tour="topbar-notifications" className="relative">
            <button 
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="w-9 h-9 hover:bg-white dark:hover:bg-slate-800 rounded-full text-[#68737A] dark:text-slate-300 hover:text-[#17212B] dark:hover:text-white relative transition-all cursor-pointer flex items-center justify-center border border-transparent hover:border-[#E6E0D5] dark:hover:border-slate-700 shadow-2xs active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#D9785B] rounded-full ring-2 ring-white dark:ring-[#0f172a] animate-pulse"></span>
              )}
            </button>
            {showNotifDropdown && (
              <div className="absolute right-0 top-12 w-80 sm:w-84 bg-white/98 dark:bg-[#152238]/98 backdrop-blur-xl border border-[#E6E0D5] dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 bg-[#F7F3EA]/80 dark:bg-slate-800/60 border-b border-[#E6E0D5] dark:border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-sm text-[#17212B] dark:text-white">{text.notifications}</span>
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllRead} 
                      className="text-xs text-[#168A78] dark:text-emerald-400 hover:underline font-bold"
                    >
                      {text.markAllRead}
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-[#E6E0D5] dark:divide-slate-800/60">
                  {notifications.length > 0 ? (
                    notifications.map(notif => (
                      <div key={notif.id} className={`p-4 hover:bg-[#F7F3EA]/60 dark:hover:bg-slate-800/60 transition-colors ${notif.unread ? 'bg-[#168A78]/5' : ''}`}>
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h4 className="font-bold text-xs text-[#17212B] dark:text-white">{notif.title}</h4>
                          <span className="text-[10px] text-[#68737A] dark:text-slate-500 shrink-0 font-medium">{notif.time}</span>
                        </div>
                        <p className="text-xs text-[#68737A] dark:text-slate-300 leading-relaxed font-normal">{notif.description}</p>
                      </div>
                    ))
                  ) : notifError ? (
                    <p className="text-center py-6 text-xs font-semibold text-rose-500">Couldn't load notifications.</p>
                  ) : (
                    <p className="text-center py-6 text-xs font-medium text-[#68737A] dark:text-slate-500">No notifications</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Study Planner Calendar Icon */}
          <button
            onClick={() => navigate('/study-planner')}
            className="w-9 h-9 hover:bg-white dark:hover:bg-slate-800 rounded-full text-[#68737A] dark:text-slate-300 hover:text-[#168A78] dark:hover:text-emerald-400 relative transition-all cursor-pointer flex items-center justify-center border border-transparent hover:border-[#E6E0D5] dark:hover:border-slate-700 shadow-2xs active:scale-95 group"
            title="Study Planner"
          >
            <span className="material-symbols-outlined text-[20px] text-[#123B35] dark:text-emerald-400 group-hover:scale-110 transition-transform">
              calendar_month
            </span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-[#0f172a]"></span>
          </button>

          {/* Student Avatar / Dropdown */}
          {profile && (
            <div ref={accountMenuRef} className="relative">
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-full hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-[#E6E0D5] dark:hover:border-slate-700 transition-all duration-200 cursor-pointer group"
                title="Account options"
              >
                <div className="w-9 h-9 shrink-0 rounded-full bg-[#123B35] flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:flex flex-col items-start leading-tight max-w-[130px]">
                  <span className="font-extrabold text-xs text-[#17212B] dark:text-slate-100 truncate w-full text-left">{displayName}</span>
                  <span className="text-[10px] text-[#68737A] dark:text-slate-400 capitalize truncate w-full text-left font-semibold">Class 9 Student</span>
                </span>
                <span className="material-symbols-outlined text-[#68737A] dark:text-slate-500 text-[16px] group-hover:translate-y-0.5 transition-transform">expand_more</span>
              </button>
              {showAccountMenu && (
                <div className="absolute right-0 top-12 w-52 bg-white/98 dark:bg-[#152238]/98 backdrop-blur-xl border border-[#E6E0D5] dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 border-b border-[#E6E0D5] dark:border-slate-800/80 mb-1 sm:hidden">
                    <p className="font-bold text-xs text-[#17212B] dark:text-white truncate">{displayName}</p>
                    <p className="text-[10px] text-[#68737A] capitalize">Class 9 Student</p>
                  </div>
                  <button
                    onClick={() => { setShowEditProfileModal(true); setShowAccountMenu(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-[#F7F3EA] dark:hover:bg-slate-800/80 rounded-xl transition-colors flex items-center gap-2.5 text-xs font-semibold text-[#17212B] dark:text-slate-200 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[#68737A] dark:text-slate-400 text-[18px]">manage_accounts</span>
                    {text.profileSettings}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2.5 hover:bg-[#D9785B]/10 rounded-xl transition-colors flex items-center gap-2.5 text-xs font-bold text-[#D9785B] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    {text.logout}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Edit Profile modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowEditProfileModal(false)}>
          <div
            className="bg-white dark:bg-[#152238] border border-[#E6E0D5] dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-[#E6E0D5] dark:border-slate-800 pb-3">
              <h2 className="font-bold text-base text-[#17212B] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#123B35]">manage_accounts</span>
                {text.editProfileTitle}
              </h2>
              <button 
                onClick={() => setShowEditProfileModal(false)}
                className="w-7 h-7 rounded-full hover:bg-[#F7F3EA] dark:hover:bg-slate-800 flex items-center justify-center text-[#68737A] hover:text-[#17212B] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#68737A] dark:text-slate-400 uppercase tracking-wider">{text.fullName}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1.5 rounded-xl border border-[#E6E0D5] dark:border-slate-700/80 bg-[#F7F3EA]/50 dark:bg-slate-800/50 px-3.5 py-2 text-sm text-[#17212B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#168A78]/40 focus:bg-white dark:focus:bg-[#152238] transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#68737A] dark:text-slate-400 uppercase tracking-wider">{text.emailAddr}</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full mt-1.5 rounded-xl border border-[#E6E0D5] dark:border-slate-700/80 bg-[#F7F3EA]/50 dark:bg-slate-800/50 px-3.5 py-2 text-sm text-[#17212B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#168A78]/40 focus:bg-white dark:focus:bg-[#152238] transition-all"
                />
              </div>

              {(role === 'student' || role === 'school student') && (
                <div className="pt-3 border-t border-[#E6E0D5] dark:border-slate-800">
                  <p className="text-xs font-bold text-[#68737A] dark:text-slate-500 uppercase tracking-wider mb-2">Academic Profile</p>
                  <div className="text-xs text-[#17212B] dark:text-slate-300 space-y-1 bg-[#F7F3EA]/50 dark:bg-slate-800/40 p-3 rounded-xl border border-[#E6E0D5] dark:border-slate-700/40 font-medium">
                    {role === 'school student' && (
                      <p><span className="text-[#68737A]">School:</span> {academicProfile?.school || 'Not set'}</p>
                    )}
                    <p><span className="text-[#68737A]">Board:</span> {academicProfile?.board || 'Not set'}</p>
                    <p><span className="text-[#68737A]">Class:</span> {academicProfile?.className || 'Not set'}</p>
                    <p><span className="text-[#68737A]">Subjects:</span> {academicProfile?.subjects?.length ? academicProfile.subjects.join(', ') : 'Not set'}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#68737A] dark:text-slate-300 hover:bg-[#F7F3EA] dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  {text.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs bg-[#123B35] text-white font-extrabold hover:bg-[#123B35]/90 shadow-md shadow-[#123B35]/20 cursor-pointer active:scale-95 transition-all"
                >
                  {text.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Topbar;