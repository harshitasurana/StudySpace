import React from 'react';

// Free-text "School Name" field — the schools directory/registry backend
// has been removed, so this is no longer a live-search autocomplete, just
// a plain input. Kept as its own component (rather than inlining a raw
// <input>) so both wizards keep sharing one place to define this field.
const SchoolNameAutocomplete = ({ value, onChange }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Type your school's name"
    className="w-full p-3 rounded-lg border border-border-subtle text-sm"
  />
);

export default SchoolNameAutocomplete;
