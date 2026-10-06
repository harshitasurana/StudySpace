import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND_NAME, BRAND_LOGO_URL } from '../../../constants/brand';

const LEGAL_LINKS = [
  { path: '/privacy-policy', label: 'Privacy Policy' },
  { path: '/terms-of-service', label: 'Terms of Service' },
  { path: '/dpdp-consent', label: 'DPDP Act (2023) Consent' },
  { path: '/security-statement', label: 'Security Statement' },
];

// Shared shell for all 4 legal documents — same header/footer chrome as
// the auth pages (logo + BRAND_NAME, "Back to Home"), rendered inside
// AuthLayout via authRoutes so it's reachable whether or not the visitor
// is logged in (a legal document has to be readable before someone even
// creates an account).
const LegalPageLayout = ({ title, lastUpdated, children }) => {
  const navigate = useNavigate();

  return (
    <>
      <header className="w-full bg-surface shadow-sm flex justify-between items-center px-margin-desktop py-4">
        <span
          className="flex items-center gap-2 font-headline-md text-headline-md font-bold text-primary cursor-pointer"
          onClick={() => navigate('/')}
        >
          <img src={BRAND_LOGO_URL} alt={BRAND_NAME} className="w-8 h-8 rounded-lg" />
          {BRAND_NAME}
        </span>
        <button
          className="text-on-surface-variant hover:text-primary transition-colors text-label-md font-bold cursor-pointer"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </header>

      <main className="flex-grow py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-140px)]">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface mb-1">{title}</h1>
          <p className="text-body-md text-on-surface-variant mb-8">Last updated: {lastUpdated}</p>
          <div className="space-y-6">{children}</div>
        </div>
      </main>

      <footer className="w-full py-base bg-surface-container-lowest border-t border-border-subtle flex flex-col sm:flex-row gap-3 justify-between items-center px-margin-desktop">
        <span className="font-body-md text-body-md text-on-surface-variant">© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</span>
        <div className="flex flex-wrap gap-4 justify-center">
          {LEGAL_LINKS.map((l) => (
            <a
              key={l.path}
              href={l.path}
              className="text-on-surface-variant hover:text-primary transition-colors font-body-md text-body-md"
            >
              {l.label}
            </a>
          ))}
        </div>
      </footer>
    </>
  );
};

// Small building blocks used by every legal page below — no Tailwind
// typography plugin in this app (see ChapterReader.jsx's own note on
// this), so headings/paragraphs/lists get their classes explicitly
// rather than via a `prose` wrapper.
export const Section = ({ title, children }) => (
  <section>
    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-2">{title}</h2>
    <div className="space-y-3 text-body-md text-on-surface leading-relaxed">{children}</div>
  </section>
);

export const P = ({ children }) => <p>{children}</p>;

export const Ul = ({ children }) => <ul className="list-disc pl-5 space-y-1.5">{children}</ul>;

export const Callout = ({ children }) => (
  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-body-md text-on-surface">{children}</div>
);

export default LegalPageLayout;
