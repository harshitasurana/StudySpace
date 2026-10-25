import React from 'react';
import { EVENT_TYPE_META, CREATABLE_EVENT_TYPES } from '../constants';

const AddEventMenu = ({ onClose, onSelectType }) => (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white dark:bg-[#152238] rounded-2xl shadow-lg w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">What would you like to add?</h3>
        <button type="button" onClick={onClose} className="p-1 text-on-surface-variant hover:text-error rounded-lg cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div className="space-y-1.5">
        {CREATABLE_EVENT_TYPES.map((type) => {
          const meta = EVENT_TYPE_META[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelectType(type)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border-subtle hover:border-primary/40 hover:bg-surface-container-low transition-colors cursor-pointer text-left"
            >
              <span className={`shrink-0 w-9 h-9 rounded-lg ${meta.bg} ${meta.text} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
              </span>
              <span className="font-bold text-body-md text-on-surface">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export default AddEventMenu;
