import React, { useState, useEffect } from 'react';
import studentGirlImg from '../../../assets/student_hero_illustration.jpg';
import studentBoyImg from '../../../assets/student_boy_hero_illustration.jpg';

const AuthHeroPanel = ({
  badge = 'CBSE Class 9 • Mathematics',
  titlePrefix = 'Master Math with',
  titleHighlight = 'Clarity.',
  subtitle = 'An AI-powered learning platform designed for CBSE Class 9 students. Learn, practice, and grow with personalized guidance.',
}) => {
  const images = [
    { src: studentGirlImg, alt: 'Female student studying with laptop' },
    { src: studentBoyImg, alt: 'Male student studying with laptop' },
  ];

  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % images.length);
    }, 3000); // Switches every 3 seconds

    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className="w-full lg:w-1/2 flex flex-col justify-between space-y-6">
      {/* Top Text & Features */}
      <div className="space-y-5">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E6F4EA] dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 text-[#064e3b] dark:text-emerald-300 font-extrabold text-xs sm:text-sm shadow-2xs">
          {badge}
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] dark:text-white tracking-tight leading-tight">
          {titlePrefix}{' '}
          <span className="text-[#064e3b] dark:text-emerald-400 relative inline-block">
            {titleHighlight}
            <span className="absolute left-0 -bottom-1 w-full h-1 bg-[#064e3b]/30 rounded-full" />
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-600 dark:text-slate-300 font-medium text-sm sm:text-base leading-relaxed max-w-xl">
          {subtitle}
        </p>

        {/* 4 Feature Points */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
          {/* Feature 1 */}
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] text-[#064e3b] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">psychology</span>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">Personalized Learning</h4>
              <p className="text-[11px] text-slate-500 font-medium">AI adapts to your strengths</p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">layers</span>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">Concept Clarity</h4>
              <p className="text-[11px] text-slate-500 font-medium">Step-by-step explanations</p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">quiz</span>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">Practice &amp; Improve</h4>
              <p className="text-[11px] text-slate-500 font-medium">Chapter-wise quizzes and tests</p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] text-[#059669] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">bar_chart</span>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">Track Your Progress</h4>
              <p className="text-[11px] text-slate-500 font-medium">Build consistency and confidence</p>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-switching Cartoon Illustration (3 seconds interval) */}
      <div className="relative rounded-3xl overflow-hidden shadow-lg border border-emerald-950/10 dark:border-slate-800 max-w-lg aspect-square bg-[#F7F3EA] dark:bg-[#0b1324]">
        {images.map((imgObj, idx) => (
          <img
            key={idx}
            src={imgObj.src}
            alt={imgObj.alt}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
              idx === activeIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          />
        ))}

        {/* Small Progress Indicator Dots */}
        <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                idx === activeIdx ? 'w-6 bg-[#064e3b]' : 'w-2 bg-slate-300/80 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuthHeroPanel;
