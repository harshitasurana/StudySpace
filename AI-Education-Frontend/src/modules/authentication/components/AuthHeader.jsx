import React from 'react';
import { useNavigate } from 'react-router-dom';

const AuthHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="w-full sticky top-0 z-40 bg-[#F7F3EA]/95 dark:bg-[#0b1324]/95 backdrop-blur-md flex justify-between items-center px-4 sm:px-8 py-3.5 border-b border-slate-200/60 dark:border-slate-800 transition-colors">
      {/* Left Logo Branding */}
      <div
        className="flex items-center gap-3 select-none cursor-pointer group"
        onClick={() => navigate('/')}
      >
        <div className="w-9 h-9 rounded-xl bg-[#123B35] flex items-center justify-center text-white shadow-md shadow-[#123B35]/20 group-hover:scale-105 transition-transform duration-300 overflow-hidden">
          <img src="/studyspace_logo.png" alt="StudySpace" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-extrabold text-lg text-[#17212B] dark:text-white tracking-tight">
            StudySpace
          </span>
          <span className="text-[10px] text-[#68737A] dark:text-slate-400 font-semibold tracking-wide">
            Learn Today. Build Tomorrow.
          </span>
        </div>
      </div>

      {/* Right Action / Support */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => alert('StudySpace 24/7 Student Support is active.')}
          className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-[#064e3b] dark:hover:text-emerald-400 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
          <span>Support</span>
        </button>
      </div>
    </header>
  );
};

export default AuthHeader;
