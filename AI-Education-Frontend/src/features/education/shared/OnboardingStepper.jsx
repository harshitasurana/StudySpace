import React from 'react';

const OnboardingStepper = ({ step, total, title, subtitle }) => (
  <div className="text-center mb-6 space-y-2">
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F4EA] dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 text-[#064e3b] dark:text-emerald-300 font-extrabold text-xs tracking-wider uppercase shadow-2xs">
      Step {step} of {total}
    </div>
    {title && (
      <h2 className="text-2xl sm:text-3xl font-black text-[#0F172A] dark:text-white tracking-tight">
        {title}
      </h2>
    )}
    {subtitle && (
      <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm max-w-md mx-auto">
        {subtitle}
      </p>
    )}
  </div>
);

export default OnboardingStepper;
