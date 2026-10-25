import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import myntiqLogo from "../../assets/images/myntiq-leaf.png";
import "./AppNavbar.css";
import { FaChevronDown } from "react-icons/fa";
import GlobalSearchModal from "../../shared/component/GlobalSearchModal.jsx";

const AppNavbar = ({ onLogout, adminData, onToggleSidebar, isSidebarCollapsed }) => {
  const [showSearchModal, setShowSearchModal] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const initials = useMemo(() => {
    const name =
      adminData?.full_name ||
      adminData?.name ||
      adminData?.username ||
      adminData?.email ||
      adminData?.account_email ||
      "";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
    return "HA";
  }, [adminData]);

  const displayName =
    adminData?.full_name ||
    adminData?.name ||
    adminData?.username ||
    adminData?.email ||
    adminData?.account_email ||
    "Admin";
  const roleName =
    adminData?.role_label ||
    adminData?.role_name ||
    adminData?.role?.role_name ||
    (typeof adminData?.role === "string" ? adminData.role : null) ||
    "Administrator";

  return (
    <nav className={`hc-topnav${isSidebarCollapsed ? " hc-topnav--collapsed" : ""}`}>
      <div className="hc-topnav-mesh" aria-hidden="true" />

      <Link to="/home" className={`hc-topnav-brand${isSidebarCollapsed ? " hc-topnav-brand--compact" : ""}`}>
        <img src={myntiqLogo} alt="MyntiQ" className="hc-topnav-logo" />
        <span className={`hc-topnav-brand-name${isSidebarCollapsed ? " hc-topnav-brand-name--hidden" : ""}`}>
          MyntiQ<span className="hc-topnav-brand-suffix">-Healthcare</span>
        </span>
      </Link>

      <button
        className={`hc-topnav-toggle${isSidebarCollapsed ? " hc-topnav-toggle--active" : ""}`}
        aria-label="Toggle sidebar"
        aria-expanded={!isSidebarCollapsed}
        onClick={onToggleSidebar}
      >
        <i className={`fas ${isSidebarCollapsed ? "fa-grip-lines-vertical" : "fa-bars"}`} />
      </button>

      <div className="hc-topnav-search-wrap d-none d-md-flex">
        <div className="hc-topnav-search" onClick={() => setShowSearchModal(true)}>
          <i className="fas fa-search hc-topnav-search-icon" />
          <input
            type="text"
            className="hc-topnav-search-input"
            placeholder="Search for..."
            aria-label="Search"
            readOnly
            onFocus={(e) => { e.target.blur(); setShowSearchModal(true); }}
          />
          <kbd className="hc-topnav-search-kbd">⌘K</kbd>
        </div>
      </div>

      <GlobalSearchModal show={showSearchModal} onClose={() => setShowSearchModal(false)} />

      <div className="hc-topnav-actions">
        <button className="hc-topnav-icon-btn" aria-label="Notifications">
          <i className="fas fa-bell" />
          <span className="hc-topnav-badge">3</span>
        </button>
        <span className="hc-topnav-divider" />
        <div className="dropdown">
          <button
            className="hc-topnav-user-btn dropdown-toggle"
            id="topNavUserDropdown"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <span className="hc-topnav-avatar">{initials}</span>
            <span className="hc-topnav-user-meta d-none d-lg-flex">
              <span className="hc-topnav-user-name">{displayName}</span>
              <span className="hc-topnav-user-role">{roleName}</span>
            </span>
            <FaChevronDown className="hc-topnav-user-chevron d-none d-lg-inline" />
          </button>
          <ul className="dropdown-menu dropdown-menu-end hc-topnav-dropdown" aria-labelledby="topNavUserDropdown">
            <li className="hc-topnav-dd-header">
              <span className="hc-topnav-dd-avatar">{initials}</span>
              <div>
                <div className="hc-topnav-dd-name">{displayName}</div>
                <div className="hc-topnav-dd-role">{roleName}</div>
              </div>
            </li>
            <li><hr className="dropdown-divider hc-topnav-dd-divider" /></li>
            <li>
              <a className="dropdown-item hc-topnav-dd-item" href="#">
                <i className="fas fa-cog" />Settings
              </a>
            </li>
            <li>
              <a className="dropdown-item hc-topnav-dd-item" href="#">
                <i className="fas fa-chart-line" />Activity Log
              </a>
            </li>
            <li><hr className="dropdown-divider hc-topnav-dd-divider" /></li>
            <li>
              <a className="dropdown-item hc-topnav-dd-item hc-topnav-dd-item--danger" href="#" onClick={onLogout}>
                <i className="fas fa-sign-out-alt" />Logout
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default AppNavbar;
