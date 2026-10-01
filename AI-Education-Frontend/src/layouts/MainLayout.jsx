import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Topbar from './Topbar';
import ResumeSessionBanner from '../components/ResumeSessionBanner';
import { useHelpDrawer } from '../context/HelpDrawerContext';
import { useFocusMode } from '../context/FocusModeContext';

const MainLayout = () => {
  const { isHelpOpen, helpDrawerWidth, isHelpDragging, closeHelpDrawer } = useHelpDrawer();
  const { isFocusMode } = useFocusMode();
  const navigate = useNavigate();

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 640 || window.innerWidth === 0;
  });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 640 || window.innerWidth === 0);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const mainRef = useRef(null);
  const location = useLocation();
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
    if (closeHelpDrawer) closeHelpDrawer();
  }, [location.pathname, closeHelpDrawer]);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#F7F3EA] dark:bg-[#0b1324] text-[#17212B] dark:text-slate-100">
      {!isFocusMode && <Topbar />}
      <div className="flex flex-1 min-h-0 relative">
        <main
          ref={mainRef}
          style={{
            marginRight: isHelpOpen && isDesktop ? `${helpDrawerWidth}px` : 0,
            transition: isHelpDragging ? 'none' : 'margin-right 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className="flex-1 overflow-y-auto flex flex-col custom-scrollbar min-w-0 pb-20"
        >
          <div className="flex-1">
            <Outlet />
          </div>
        </main>
      </div>
      {!isFocusMode && <ResumeSessionBanner />}

      {/* Floating Bottom Nav Dock — Pill navigation centered at the bottom */}
      {!isFocusMode && (
        <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <nav
            aria-label="Main navigation"
            className="pointer-events-auto bg-[#123B35]/96 backdrop-blur-xl border border-[#168A78]/30 text-white rounded-full px-4 py-2 shadow-2xl flex items-center gap-1 sm:gap-2 max-w-2xl w-full justify-around"
          >
            {[
              { label: 'Home', icon: 'home', path: '/' },
              { label: 'Subjects', icon: 'menu_book', path: '/my-learning/subjects' },
              { label: 'Library', icon: 'local_library', path: '/library' },
              { label: 'Ask AI', icon: 'auto_awesome', path: '/ai-tutor/chat', isFeatured: true },
              { label: 'Challenge', icon: 'target', path: '/practice' },
              { label: 'Progress', icon: 'bar_chart', path: '/progress/overview' },
              { label: 'You', icon: 'person', path: '/settings' },
            ].map((navItem) => {
              const isActive =
                location.pathname === navItem.path ||
                (navItem.path === '/' && (location.pathname === '/self/dashboard' || location.pathname === '/school/dashboard')) ||
                (navItem.path === '/my-learning/subjects' && location.pathname.startsWith('/my-learning')) ||
                (navItem.path === '/library' && (location.pathname.startsWith('/library') || location.pathname.includes('decks') || location.pathname.includes('bookmarks'))) ||
                (navItem.path === '/practice' && (location.pathname.startsWith('/practice') || location.pathname.startsWith('/challenge')) && !location.pathname.includes('decks')) ||
                (navItem.path === '/progress/overview' && location.pathname.startsWith('/progress')) ||
                (navItem.path === '/settings' && location.pathname.startsWith('/settings'));

              if (navItem.isFeatured) {
                return (
                  <button
                    key={navItem.label}
                    onClick={() => navigate(navItem.path)}
                    className="flex flex-col items-center justify-center -mt-5 cursor-pointer group shrink-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#D9A441] via-amber-400 to-[#D9A441] text-slate-950 flex items-center justify-center shadow-lg shadow-[#D9A441]/40 group-hover:scale-110 transition-transform border-2 border-white">
                      <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
                    </div>
                    <span className="text-[10px] font-extrabold tracking-tight mt-0.5 text-[#D9A441] drop-shadow-xs">
                      {navItem.label}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={navItem.label}
                  onClick={() => navigate(navItem.path)}
                  className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-full transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#168A78] text-white font-extrabold px-3 shadow-inner'
                      : 'text-emerald-100/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-white' : ''}`}>
                    {navItem.icon}
                  </span>
                  <span className="text-[10px] tracking-tight font-medium mt-0.5 hidden sm:inline">{navItem.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
