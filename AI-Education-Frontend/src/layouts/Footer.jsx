import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_NAME, BRAND_LOGO_URL } from '../constants/brand';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white dark:bg-[#152238] border-t border-border-subtle dark:border-[#2e3f5f] py-6 px-margin-desktop mt-auto transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant dark:text-[#94a3b8]">
        {/* Copyright and Brand */}
        <div className="flex items-center gap-2 select-none">
          <img src={BRAND_LOGO_URL} alt={BRAND_NAME} className="w-5 h-5 rounded-md" />
          <span className="font-bold text-primary dark:text-primary-fixed">{BRAND_NAME}</span>
          <span>&copy; {currentYear} All rights reserved.</span>
        </div>

        {/* Standard Links */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/privacy-policy" className="hover:text-primary dark:hover:text-white transition-colors">Privacy Policy</Link>
          <span className="text-border-subtle dark:text-[#2e3f5f] select-none">|</span>
          <Link to="/terms-of-service" className="hover:text-primary dark:hover:text-white transition-colors">Terms of Service</Link>
          <span className="text-border-subtle dark:text-[#2e3f5f] select-none">|</span>
          <Link to="/dpdp-consent" className="hover:text-primary dark:hover:text-white transition-colors">DPDP Act (2023) Consent</Link>
          <span className="text-border-subtle dark:text-[#2e3f5f] select-none">|</span>
          <Link to="/security-statement" className="hover:text-primary dark:hover:text-white transition-colors">Security Statement</Link>
        </div>

        {/* Deployed System Version details */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success-mastery animate-pulse"></span>
          <span className="font-label-md text-[10px] uppercase tracking-wider bg-surface-container-high dark:bg-[#1e2d4a] px-2 py-0.5 rounded text-primary dark:text-primary-fixed font-bold">
            v1.4.2-prod (Build: 2026.07.06)
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
