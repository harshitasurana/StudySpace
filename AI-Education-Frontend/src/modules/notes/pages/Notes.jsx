import React from 'react';
import { useNavigate } from 'react-router-dom';

// Admin Feature: "Notes" (feature_id 294, route /notes).
const Notes = () => {
  const navigate = useNavigate();
  return (
    <main className="flex-grow flex items-center justify-center py-stack-lg px-margin-mobile md:px-margin-desktop bg-surface-bright min-h-[calc(100vh-72px)]">
      <div className="text-center max-w-md">
        <span className="material-symbols-outlined text-4xl text-primary mb-3 inline-block">sticky_note_2</span>
        <p className="text-headline-sm font-bold text-on-surface mb-2">Notes</p>
        <p className="text-body-md text-on-surface-variant mb-4">Everything you've saved while learning.</p>
        <button
          className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
          onClick={() => navigate('/notes/my-notes')}
        >
          Go to My Notes
        </button>
      </div>
    </main>
  );
};

export default Notes;
