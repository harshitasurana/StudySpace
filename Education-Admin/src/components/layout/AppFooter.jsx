import React from "react";
import "./AppFooter.css";

const AppFooter = ({ isSidebarCollapsed }) => {
  const year = new Date().getFullYear();

  return (
    <footer className={`hc-footer mt-auto${isSidebarCollapsed ? " hc-footer--sidebar-collapsed" : ""}`}>
      <div className="hc-footer-bg" aria-hidden="true" />

      <div className="hc-footer-inner">
        <div className="hc-footer-left">
          <span className="hc-footer-status-dot" aria-hidden="true" />
          <span className="hc-footer-product">HealthCare Admin Portal</span>
          <span className="hc-footer-divider" aria-hidden="true" />
          <span className="hc-footer-copy">Copyright {year}</span>
        </div>

        <div className="hc-footer-right">
          <a href="#" className="hc-footer-link">Privacy Policy</a>
          <a href="#" className="hc-footer-link">Terms &amp; Conditions</a>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
