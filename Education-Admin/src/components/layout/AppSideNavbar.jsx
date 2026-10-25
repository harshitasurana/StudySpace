import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useRBAC } from '../../shared/component/RBACProvider.jsx';
import IconRenderer from '../../shared/component/IconRenderer.jsx';
import './AppSideNavbar.css';

const FALLBACK_NAV = [
  { label: 'Dashboard', icon: 'fas fa-tachometer-alt',  path: '/dashboard' },
  { label: 'Roles',         icon: 'bi bi-shield-lock',    path: '/roles' },
  { label: 'Features',      icon: 'bi bi-puzzle',         path: '/admin/features' },
  { label: 'Doctors',       icon: 'fas fa-user-md',       path: '/dashboard/doctors' },
  { label: 'Appointments',  icon: 'fas fa-calendar-check',path: '/dashboard/appointments' },
  { label: 'Users',         icon: 'fas fa-users',         path: '/admin/users' },
  { label: 'Availability Types', icon: 'bi bi-grid-3x3-gap', path: '/admin/feature-availability-types' },
  { label: 'Availability Map', icon: 'bi bi-diagram-3', path: '/admin/feature-availability-map' },
];

const containsActive = (items = [], pathname) =>
  items.some(
    (item) =>
      item.routePath === pathname ||
      (Array.isArray(item.items) && containsActive(item.items, pathname))
  );

const firstRoutableChildPath = (items = [], canRoute) => {
  for (const item of items) {
    if (item.routePath && canRoute(item.routePath)) return item.routePath;
    if (Array.isArray(item.items) && item.items.length > 0) {
      const nested = firstRoutableChildPath(item.items, canRoute);
      if (nested) return nested;
    }
  }
  return null;
};

// ─── Section heading ──────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div className="hc-nav-section">
    <span className="hc-nav-section-line" />
    <span className="hc-nav-section-text">{children}</span>
    <span className="hc-nav-section-line" />
  </div>
);

// ─── Leaf link ────────────────────────────────────────────────────────────────
const NavLeaf = ({ route, icon, label, depth, active, isCollapsed }) => (
  <Link
    to={route}
    className={`hc-nav-item${active ? ' hc-nav-item--active' : ''}${depth > 0 ? ' hc-nav-item--child' : ''}${isCollapsed ? ' hc-nav-item--icon-only' : ''}`}
    style={depth > 0 && !isCollapsed ? { paddingLeft: `${1.1 + depth * 0.85}rem` } : undefined}
    title={label}
  >
    <span className="hc-nav-icon">
      <IconRenderer icon={icon || (depth > 0 ? 'bi bi-dot' : 'bi bi-circle-fill')} />
    </span>
    <span className="hc-nav-text">{label}</span>
    {active && <span className="hc-nav-active-pip" />}
  </Link>
);

// ─── Group (has children) ─────────────────────────────────────────────────────
const NavGroup = ({ item, depth, pathname, canRoute, isCollapsed }) => {
  const hasActiveChild = containsActive(item.items || [], pathname);
  const [open, setOpen] = useState(hasActiveChild);
  const collapsedRoute = item.routePath || firstRoutableChildPath(item.items || [], canRoute);

  if (isCollapsed) {
    if (collapsedRoute) {
      return (
        <NavLeaf
          route={collapsedRoute}
          icon={item.icon}
          label={item.label}
          depth={0}
          active={pathname === collapsedRoute || hasActiveChild}
          isCollapsed={true}
        />
      );
    }

    return (
      <button className="hc-nav-item hc-nav-item--icon-only" type="button" title={item.label} aria-label={item.label}>
        <span className="hc-nav-icon">
          <IconRenderer icon={item.icon || 'bi bi-grid'} />
        </span>
        <span className="hc-nav-text">{item.label}</span>
      </button>
    );
  }

  return (
    <div className={`hc-nav-group${depth > 0 ? ' hc-nav-group--nested' : ''}`}>
      <button
        className={`hc-nav-item hc-nav-item--group${hasActiveChild ? ' hc-nav-item--group-active' : ''}`}
        style={depth > 0 ? { paddingLeft: `${1.1 + depth * 0.85}rem` } : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="hc-nav-icon">
          <IconRenderer icon={item.icon || 'bi bi-grid'} />
        </span>
        <span className="hc-nav-text">{item.label}</span>
        <i className={`bi bi-chevron-right hc-nav-chevron${open ? ' hc-nav-chevron--open' : ''}`} />
      </button>

      <div className={`hc-nav-children${open ? ' hc-nav-children--open' : ''}`}>
        <div className={`hc-nav-children-track${depth > 0 ? ' hc-nav-children-track--deep' : ''}`}>
          {(item.items || [])
            .filter((child) => !child.routePath || canRoute(child.routePath))
            .sort((a, b) => (a.menuOrder || 0) - (b.menuOrder || 0))
            .map((child) => (
              <NavItem
                key={`${child.featureId || child.label}-${depth + 1}`}
                item={child}
                depth={depth + 1}
                pathname={pathname}
                canRoute={canRoute}
                isCollapsed={isCollapsed}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

// ─── Dispatcher ───────────────────────────────────────────────────────────────
const NavItem = ({ item, depth, pathname, canRoute, isCollapsed }) => {
  const hasChildren = Array.isArray(item.items) && item.items.length > 0;
  if (hasChildren) return <NavGroup item={item} depth={depth} pathname={pathname} canRoute={canRoute} isCollapsed={isCollapsed} />;
  if (!item.routePath) return null;
  return <NavLeaf route={item.routePath} icon={item.icon} label={item.label} depth={depth} active={pathname === item.routePath} isCollapsed={isCollapsed} />;
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const AppSideNavbar = ({ adminData, isCollapsed }) => {
  const location = useLocation();
  const { canRoute, loading, menu } = useRBAC();
  const pathname = location.pathname;

  const hasDynamicMenu = Array.isArray(menu) && menu.length > 0;
  const visibleFallback = FALLBACK_NAV.filter((item) => canRoute(item.path));

  const initials = (() => {
    const name =
      adminData?.full_name ||
      adminData?.name ||
      adminData?.username ||
      adminData?.email ||
      adminData?.account_email ||
      '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
    return 'HA';
  })();

  return (
    <nav className={`hc-sidenav${isCollapsed ? ' hc-sidenav--collapsed' : ''}`}>
      {/* Layered decorative background */}
      <div className="hc-sidenav-bg" aria-hidden="true" />

      {/* Scrollable nav body */}
      <div className="hc-sidenav-body app-sidenav-scroll">

        {/* MANAGEMENT */}
        <div className="hc-sidenav-section-wrap">
          <SectionLabel>Management</SectionLabel>
          {loading ? (
            <div className="hc-nav-loading">
              <span className="spinner-border spinner-border-sm hc-nav-spinner" />
              <span>Loading…</span>
            </div>
          ) : hasDynamicMenu ? (
            menu
              .filter((item) => !item.routePath || canRoute(item.routePath))
              .sort((a, b) => (a.menuOrder || 0) - (b.menuOrder || 0))
              .map((item) => (
                <NavItem
                  key={`${item.featureId || item.label}-0`}
                  item={item}
                  depth={0}
                  pathname={pathname}
                  canRoute={canRoute}
                  isCollapsed={isCollapsed}
                />
              ))
          ) : (
            visibleFallback.map((item) => (
              <NavLeaf key={item.path} route={item.path} icon={item.icon} label={item.label} depth={0} active={pathname === item.path} isCollapsed={isCollapsed} />
            ))
          )}
        </div>
      </div>

      {/* Footer / User strip */}
      <div className={`hc-sidenav-footer${isCollapsed ? ' hc-sidenav-footer--collapsed' : ''}`}>
        <div className="hc-sidenav-avatar">{initials}</div>
        <div className="hc-sidenav-user-info">
          <span className="hc-sidenav-user-name">
            {adminData?.full_name ||
              adminData?.name ||
              adminData?.username ||
              adminData?.email ||
              adminData?.account_email ||
              'HealthCare Admin'}
          </span>
          <span className="hc-sidenav-user-role">
            {adminData?.role_label ||
              adminData?.role_name ||
              adminData?.role?.role_name ||
              (typeof adminData?.role === 'string' ? adminData.role : null) ||
              'Administrator'}
          </span>
        </div>
        <span className="hc-sidenav-online-dot" title="Online" />
      </div>
    </nav>
  );
};

export default AppSideNavbar;
