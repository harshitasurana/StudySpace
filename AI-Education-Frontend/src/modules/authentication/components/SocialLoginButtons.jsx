import React from 'react';

const SocialLoginButtons = () => {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Google */}
      <button
        type="button"
        onClick={() => alert('Google Social Sign-In is configured via EduAI SSO.')}
        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer shadow-2xs"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Google</span>
      </button>

      {/* Microsoft */}
      <button
        type="button"
        onClick={() => alert('Microsoft Sign-In is configured via EduAI SSO.')}
        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer shadow-2xs"
      >
        <svg className="w-4 h-4" viewBox="0 0 23 23">
          <path fill="#f35325" d="M1 1h10v10H1z" />
          <path fill="#81bc06" d="M12 1h10v10H12z" />
          <path fill="#05a6f0" d="M1 12h10v10H1z" />
          <path fill="#ffba08" d="M12 12h10v10H12z" />
        </svg>
        <span>Microsoft</span>
      </button>

      {/* Apple */}
      <button
        type="button"
        onClick={() => alert('Apple Sign-In is configured via EduAI SSO.')}
        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer shadow-2xs"
      >
        <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.14-1.9-14.4-6.07-3.67-2.92-7.6-7.66-11.78-14.23-7.53-11.83-13.31-25.04-17.34-39.63-4.03-14.59-6.05-28.53-6.05-41.83 0-16.71 4.2-30.82 12.61-42.34 8.41-11.52 19.2-17.4 32.36-17.65 4.58 0 9.87 1.18 15.87 3.54 6 2.36 10.22 3.54 12.67 3.54 2.22 0 6.64-1.24 13.26-3.72 6.62-2.48 12.01-3.6 16.17-3.37 13.31.75 24.16 5.89 32.55 15.42-11.69 7.07-17.41 16.76-17.16 29.07.25 9.57 3.86 17.58 10.83 24.03 6.97 6.45 15.35 10.14 25.14 11.07-2.61 7.78-6.17 15.42-10.68 22.92zM119.22 31.62c0-7.33 2.68-14.34 8.04-21.03 5.36-6.69 12.04-10.59 20.04-11.69.75 8.16-1.74 15.66-7.47 22.5-5.73 6.84-12.44 10.63-20.13 11.37-.12-.38-.48-1.15-.48-1.15z" />
        </svg>
        <span>Apple</span>
      </button>
    </div>
  );
};

export default SocialLoginButtons;
