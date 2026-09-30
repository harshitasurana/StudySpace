import React from 'react';

/**
 * Shared shell for a feature that's configured/routed (menu entry + admin
 * Feature row + route in routeConfig.js all exist) but whose real content
 * hasn't been built yet. Purpose: a dynamic menu item (from GET /api/menu)
 * should always land on *something* that matches its own page, never on
 * the app's catch-all "*" -> "/" redirect, which silently bounces the user
 * back to their dashboard and looks like a broken link.
 *
 * Swap a route's Component in routeConfig.js away from this once real
 * content for that feature is built - nothing else needs to change.
 */
const ComingSoonPage = ({ icon = 'construction', title, description }) => (
  <main className="flex-grow flex items-center justify-center py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
    <div className="text-center max-w-md">
      <span className="material-symbols-outlined text-4xl text-outline mb-3 inline-block">{icon}</span>
      <p className="text-headline-sm font-bold text-on-surface mb-2">{title}</p>
      <p className="text-body-md text-on-surface-variant mb-3">
        {description || 'This page is wired up and ready — the real content lands in an upcoming build.'}
      </p>
    </div>
  </main>
);

export default ComingSoonPage;
