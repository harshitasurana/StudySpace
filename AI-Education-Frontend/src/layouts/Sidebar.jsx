import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { translationsDict } from '../utils/translations';
import useAuth from '../hooks/useAuth';
import useUser from '../hooks/useUser';
import useStudentRBAC from '../hooks/useStudentRBAC';
import { resolveMenuIcon } from '../utils/iconMap';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { profile } = useUser();
  const { menu: rawMenu, canRoute } = useStudentRBAC();
  const [expanded, setExpanded] = useState(true);
  const [openFlyout, setOpenFlyout] = useState(null);
  const [flyoutPos, setFlyoutPos] = useState(null);

  const closeFlyout = () => {
    setOpenFlyout(null);
    setFlyoutPos(null);
  };

  const user = profile || {};

  const toggleSidebar = () => {
    setExpanded(!expanded);
    closeFlyout();
  };

  const lang = user.language || 'en';
  const t = translationsDict[lang] || translationsDict.en;

  const dynamicItems = useMemo(() => {
    if (!Array.isArray(rawMenu) || rawMenu.length === 0) return [];

    const mapNode = (node) => {
      const children = Array.isArray(node.items)
        ? node.items.map(mapNode).filter((child) => child.path || child.items.length > 0)
        : [];
      const path = Array.isArray(node.routerLink) ? node.routerLink[0] : node.routerLink;
      return {
        name: node.label,
        icon: resolveMenuIcon(node.icon),
        path,
        feature: node.feature,
        items: children,
      };
    };
    return rawMenu
      .map(mapNode)
      .filter((item) => (item.path ? canRoute(item.path) : true))
      .filter((item) => item.path || item.items.length > 0);
  }, [rawMenu, canRoute]);

  const combinedMenuItems = dynamicItems;

  const [expandedFeatures, setExpandedFeatures] = useState(() => new Set());
  const toggleExpanded = (key) => {
    setExpandedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const firstRoutableChildPath = (items) => {
    for (const child of items) {
      if (child.path) return child.path;
      if (Array.isArray(child.items) && child.items.length > 0) {
        const nested = firstRoutableChildPath(child.items);
        if (nested) return nested;
      }
    }
    return null;
  };

  const isItemActive = (item) => {
    if (!item.path) return false;
    if (item.path === '/' || item.path === '/self/dashboard') return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const renderMenuItem = (item, idx, depth = 0) => {
    const hasChildren = Array.isArray(item.items) && item.items.length > 0;
    const key = `${item.feature || item.path || 'item'}-${depth}-${idx}-${item.name}`;
    const isExpanded = expandedFeatures.has(key);
    const isFlyoutOpen = openFlyout === key;
    const active = isItemActive(item);

    const handleRowClick = (e) => {
      if (hasChildren) {
        if (expanded) {
          toggleExpanded(key);
        } else if (openFlyout === key) {
          closeFlyout();
        } else {
          const rect = e.currentTarget.getBoundingClientRect();
          setFlyoutPos({
            left: rect.right + 8,
            top: Math.min(rect.top, window.innerHeight - 260),
          });
          setOpenFlyout(key);
        }
        return;
      }
      closeFlyout();
      if (item.path) navigate(item.path);
    };

    const isDisabled = !hasChildren && !item.path;

    return (
      <div key={key} className="relative">
        <div
          className={`group transition-all duration-200 ${
            depth > 0 ? 'ml-4 pl-2 border-l border-border-subtle/60' : ''
          }`}
        >
          <button
            onClick={handleRowClick}
            disabled={isDisabled}
            title={!expanded ? item.name : undefined}
            aria-expanded={hasChildren ? (expanded ? isExpanded : isFlyoutOpen) : undefined}
            className={`w-full flex items-center gap-3 p-3 transition-all duration-200 rounded-xl text-left cursor-pointer disabled:cursor-default relative ${
              active
                ? 'bg-primary text-on-primary font-bold shadow-md shadow-primary/20'
                : isFlyoutOpen
                ? 'bg-surface-container text-primary font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span
              className={`material-symbols-outlined shrink-0 text-[20px] transition-transform duration-200 group-hover:scale-110 ${
                active ? 'text-on-primary' : isFlyoutOpen ? 'text-primary' : 'text-outline group-hover:text-primary'
              }`}
            >
              {item.icon}
            </span>
            {expanded && (
              <span className="font-label-md text-label-md truncate tracking-tight flex-1 min-w-0">{item.name}</span>
            )}
            {expanded && hasChildren && (
              <span
                aria-hidden="true"
                className={`material-symbols-outlined text-[18px] shrink-0 ml-auto transition-transform duration-200 ${
                  active ? 'text-on-primary' : 'text-outline group-hover:text-primary'
                }`}
                style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                expand_more
              </span>
            )}
          </button>
        </div>
        {hasChildren && expanded && isExpanded && (
          <div className="space-y-1 mt-1">
            {item.items.map((child, cidx) => renderMenuItem(child, cidx, depth + 1))}
          </div>
        )}

        {hasChildren && !expanded && isFlyoutOpen && flyoutPos && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeFlyout} />
            <div
              className="fixed z-50 w-56 bg-surface border border-border-subtle rounded-2xl shadow-2xl py-2.5 animate-scale-in"
              style={{ top: flyoutPos.top, left: flyoutPos.left }}
            >
              <p className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary truncate border-b border-border-subtle/50 mb-1">
                {item.name}
              </p>
              {item.items.map((child, cidx) => {
                const childTarget = child.path || firstRoutableChildPath(child.items || []);
                const childActive = location.pathname === childTarget;
                return (
                  <button
                    key={child.feature || child.path || `${key}-flyout-${cidx}`}
                    onClick={() => {
                      closeFlyout();
                      if (childTarget) navigate(childTarget);
                    }}
                    disabled={!childTarget}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-label-md transition-colors cursor-pointer disabled:opacity-50 ${
                      childActive
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px] shrink-0">{child.icon}</span>
                    <span className="truncate">{child.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`hidden md:flex h-[calc(100vh-72px)] bg-surface-container-low/90 dark:bg-[#111c30] backdrop-blur-md border-r border-border-subtle/70 dark:border-slate-800/80 flex-col p-3.5 transition-all duration-300 relative shrink-0 z-20 ${
        expanded ? 'w-64' : 'w-20'
      }`}
    >
      {/* Expand/Collapse Toggle Button */}
      <button
        onClick={toggleSidebar}
        title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        className="absolute top-4 -right-3 w-6 h-6 bg-surface dark:bg-[#152238] border border-border-subtle dark:border-slate-700 rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary hover:text-on-primary text-primary transition-all z-50 hover:scale-110"
      >
        <span className="material-symbols-outlined text-[14px]">
          {expanded ? 'chevron_left' : 'chevron_right'}
        </span>
      </button>

      {/* Sidebar Links */}
      <nav data-tour="sidebar-nav" className="flex-grow space-y-1.5 overflow-y-auto mt-6 custom-scrollbar pr-0.5">
        {combinedMenuItems.map((item, idx) => renderMenuItem(item, idx))}
      </nav>

      {/* Logout */}
      <div className="mt-auto pt-3 border-t border-border-subtle/70 space-y-1">
        <button
          onClick={handleLogout}
          title={!expanded ? t.logout || 'Logout' : undefined}
          className="flex items-center gap-3.5 p-3 text-on-surface-variant hover:bg-error/10 hover:text-error transition-all rounded-xl w-full text-left cursor-pointer group"
        >
          <span className="material-symbols-outlined text-error shrink-0 text-[20px] group-hover:scale-110 transition-transform">
            logout
          </span>
          {expanded && <span className="font-label-md text-label-md text-error font-bold">{t.logout || 'Logout'}</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;