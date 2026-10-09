import React from 'react';

const WizardStepper = ({ labels, currentIndex }) => (
  <div className="flex items-center justify-between mb-8 px-2">
    {labels.map((label, idx) => {
      const stepNum = idx + 1;
      const isComplete = stepNum < currentIndex + 1;
      const isActive = stepNum === currentIndex + 1;
      return (
        <div key={label} className="flex-1 flex items-center">
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black border-2 transition-all shadow-2xs ${
                isActive
                  ? 'bg-[#064e3b] border-[#064e3b] text-white shadow-md shadow-emerald-950/20 scale-105'
                  : isComplete
                  ? 'bg-[#E6F4EA] border-emerald-300 text-[#064e3b] dark:bg-emerald-950/60 dark:border-emerald-800'
                  : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
              }`}
            >
              {isComplete ? (
                <span className="material-symbols-outlined text-[18px]">check</span>
              ) : (
                stepNum
              )}
            </div>
            <span
              className={`text-[11px] font-extrabold tracking-tight text-center ${
                isActive
                  ? 'text-[#064e3b] dark:text-emerald-400'
                  : isComplete
                  ? 'text-slate-700 dark:text-slate-300'
                  : 'text-slate-400'
              }`}
            >
              {label}
            </span>
          </div>
          {stepNum !== labels.length && (
            <div
              className={`flex-1 h-1 mx-2 -mt-4 rounded-full transition-all ${
                isComplete ? 'bg-[#064e3b]' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          )}
        </div>
      );
    })}
  </div>
);

export default WizardStepper;
