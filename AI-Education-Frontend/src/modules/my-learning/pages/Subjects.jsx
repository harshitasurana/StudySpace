import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, Search, Sparkles } from 'lucide-react';
import EducationService from '../../../services/EducationService';

// Custom 3D SVG Illustrations matching reference image
const MathIllustration = () => (
  <svg width="110" height="96" viewBox="0 0 110 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
    <defs>
      <linearGradient id="calcBody" x1="0" y1="0" x2="60" y2="70" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A78BFA" />
        <stop offset="1" stopColor="#7C3AED" />
      </linearGradient>
      <linearGradient id="calcScreen" x1="0" y1="0" x2="40" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#DDD6FE" />
        <stop offset="1" stopColor="#C4B5FD" />
      </linearGradient>
      <linearGradient id="btnGrad" x1="0" y1="0" x2="10" y2="10" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F472B6" />
        <stop offset="1" stopColor="#EC4899" />
      </linearGradient>
      <linearGradient id="compassGrad" x1="0" y1="0" x2="30" y2="60" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FBBF24" />
        <stop offset="1" stopColor="#D97706" />
      </linearGradient>
    </defs>

    {/* Calculator 3D Base */}
    <rect x="10" y="24" width="52" height="66" rx="14" fill="url(#calcBody)" transform="rotate(-6 36 57)" />
    <rect x="16" y="30" width="40" height="18" rx="6" fill="url(#calcScreen)" transform="rotate(-6 36 39)" />
    
    {/* Calculator Buttons */}
    <rect x="18" y="54" width="10" height="10" rx="3" fill="#FFFFFF" fillOpacity="0.8" transform="rotate(-6 23 59)" />
    <rect x="32" y="52" width="10" height="10" rx="3" fill="#FFFFFF" fillOpacity="0.8" transform="rotate(-6 37 57)" />
    <rect x="46" y="51" width="10" height="10" rx="3" fill="url(#btnGrad)" transform="rotate(-6 51 56)" />

    <rect x="20" y="67" width="10" height="10" rx="3" fill="#FFFFFF" fillOpacity="0.8" transform="rotate(-6 25 72)" />
    <rect x="34" y="65" width="10" height="10" rx="3" fill="#FFFFFF" fillOpacity="0.8" transform="rotate(-6 39 70)" />
    <rect x="48" y="64" width="10" height="10" rx="3" fill="#6366F1" transform="rotate(-6 53 69)" />

    {/* Compass / Math Instrument */}
    <path d="M68 12 L78 68 M68 12 L96 72" stroke="url(#compassGrad)" strokeWidth="6" strokeLinecap="round" />
    <circle cx="68" cy="12" r="7" fill="#F59E0B" stroke="#B45309" strokeWidth="2" />
    <path d="M72 42 H90" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" />

    {/* Floating Ruler / Symbols */}
    <rect x="5" y="68" width="48" height="12" rx="4" fill="#60A5FA" transform="rotate(-28 29 74)" fillOpacity="0.9" />
    <text x="75" y="28" fill="#8B5CF6" fontSize="18" fontWeight="bold" fontFamily="sans-serif">+</text>
    <text x="86" y="50" fill="#EC4899" fontSize="16" fontWeight="bold" fontFamily="sans-serif">=</text>
  </svg>
);

const ScienceIllustration = () => (
  <svg width="110" height="96" viewBox="0 0 110 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
    <defs>
      <linearGradient id="microBody" x1="0" y1="0" x2="50" y2="70" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0D9488" />
        <stop offset="1" stopColor="#115E59" />
      </linearGradient>
      <linearGradient id="flaskLiquid" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34D399" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>

    {/* Flask / Plant Sprout */}
    <path d="M22 45 L14 78 C12 84 17 90 24 90 H44 C51 90 56 84 54 78 L46 45 H22 Z" fill="url(#flaskLiquid)" fillOpacity="0.85" />
    <path d="M28 25 H40 V45 H28 V25 Z" fill="#E0F2FE" fillOpacity="0.7" />
    <path d="M34 68 C34 68 26 58 34 50 C42 58 34 68 34 68 Z" fill="#10B981" />
    <path d="M34 68 C34 68 38 60 46 62 C42 70 34 68 34 68 Z" fill="#059669" />

    {/* Microscope */}
    <path d="M60 86 H100 M80 86 V65" stroke="#334155" strokeWidth="7" strokeLinecap="round" />
    <path d="M80 65 C95 65 98 45 92 32 C88 23 78 20 70 25" stroke="url(#microBody)" strokeWidth="8" strokeLinecap="round" />
    <rect x="54" y="32" width="16" height="34" rx="5" fill="#0284C7" transform="rotate(-25 62 49)" />
    <rect x="46" y="24" width="12" height="14" rx="3" fill="#38BDF8" transform="rotate(-25 52 31)" />
    <circle cx="82" cy="74" r="5" fill="#F59E0B" />

    {/* Floating Bubbles */}
    <circle cx="28" cy="38" r="3" fill="#6EE7B7" />
    <circle cx="38" cy="32" r="4.5" fill="#A7F3D0" />
    <circle cx="32" cy="20" r="2.5" fill="#34D399" />
  </svg>
);

const EnglishIllustration = () => (
  <svg width="110" height="96" viewBox="0 0 110 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
    <defs>
      <linearGradient id="bookCover" x1="0" y1="0" x2="60" y2="50" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FB7185" />
        <stop offset="1" stopColor="#E11D48" />
      </linearGradient>
      <linearGradient id="letterA" x1="0" y1="0" x2="30" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#C084FC" />
        <stop offset="1" stopColor="#9333EA" />
      </linearGradient>
    </defs>

    {/* 3D Open Book Base */}
    <path d="M12 60 C30 54 48 62 55 66 C62 62 80 54 98 60 V84 C80 78 62 84 55 88 C48 84 30 78 12 84 V60 Z" fill="url(#bookCover)" />
    <path d="M15 56 C31 51 47 58 54 62 V84 C47 80 31 73 15 78 V56 Z" fill="#FFF1F2" />
    <path d="M95 56 C79 51 63 58 56 62 V84 C63 80 79 73 95 78 V56 Z" fill="#FFE4E6" />

    {/* Floating 3D Block Letter "A" */}
    <path d="M25 22 L35 52 H45 L37 22 H25 Z" fill="url(#letterA)" />
    <path d="M35 22 L45 52 H55 L43 22 H35 Z" fill="#7E22CE" />
    <rect x="30" y="38" width="18" height="6" rx="2" fill="#F472B6" />

    {/* Pencil & Bookmark */}
    <path d="M72 15 L92 48 L84 52 L64 19 Z" fill="#FBBF24" />
    <path d="M92 48 L96 56 L88 54 Z" fill="#475569" />
    <rect x="52" y="42" width="6" height="28" rx="2" fill="#F43F5E" />
    <circle cx="85" cy="22" r="4" fill="#38BDF8" />
  </svg>
);

const SSTIllustration = () => (
  <svg width="110" height="96" viewBox="0 0 110 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
    <defs>
      <linearGradient id="globeGrad" x1="0" y1="0" x2="50" y2="50" gradientUnits="userSpaceOnUse">
        <stop stopColor="#60A5FA" />
        <stop offset="1" stopColor="#2563EB" />
      </linearGradient>
      <linearGradient id="standGrad" x1="0" y1="0" x2="30" y2="60" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F59E0B" />
        <stop offset="1" stopColor="#B45309" />
      </linearGradient>
    </defs>

    {/* 3D Globe */}
    <circle cx="40" cy="46" r="26" fill="url(#globeGrad)" />
    <path d="M24 40 C30 35 45 35 54 42 C40 50 28 50 24 40 Z" fill="#34D399" fillOpacity="0.8" />
    <path d="M32 58 C38 52 48 55 58 60 C52 68 38 66 32 58 Z" fill="#10B981" fillOpacity="0.9" />

    {/* Globe Stand */}
    <path d="M40 72 V86 M26 86 H54" stroke="url(#standGrad)" strokeWidth="6" strokeLinecap="round" />
    <path d="M14 46 C14 28 26 18 40 18 C54 18 66 28 66 46" stroke="url(#standGrad)" strokeWidth="5" strokeLinecap="round" fill="none" />

    {/* Roman Pillar */}
    <rect x="74" y="28" width="22" height="8" rx="2" fill="#E2E8F0" />
    <rect x="78" y="36" width="14" height="42" fill="#CBD5E1" />
    <rect x="74" y="78" width="22" height="8" rx="2" fill="#E2E8F0" />

    {/* Map Scroll */}
    <path d="M60 70 L95 82 L90 88 L55 76 Z" fill="#FDE68A" />
    <circle cx="92" cy="85" r="3" fill="#D97706" />
  </svg>
);

const HindiIllustration = () => (
  <svg width="110" height="96" viewBox="0 0 110 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
    <defs>
      <linearGradient id="hindiCharGrad" x1="0" y1="0" x2="40" y2="50" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A855F7" />
        <stop offset="1" stopColor="#6B21A8" />
      </linearGradient>
    </defs>

    {/* Devanagari Character 'अ' 3D rendered */}
    <text x="14" y="60" fill="url(#hindiCharGrad)" fontSize="54" fontWeight="900" fontFamily="sans-serif">अ</text>

    {/* Stack of Violet Books */}
    <rect x="42" y="66" width="58" height="12" rx="4" fill="#9333EA" />
    <rect x="46" y="68" width="50" height="8" rx="2" fill="#F3E8FF" />
    <rect x="38" y="78" width="62" height="12" rx="4" fill="#7E22CE" />
    <rect x="42" y="80" width="54" height="8" rx="2" fill="#FAF5FF" />

    {/* Feather Quill Pen */}
    <path d="M85 15 C85 15 65 35 75 58 L72 65 L80 62 C85 45 98 25 85 15 Z" fill="#C084FC" />
    <path d="M78 40 L65 72" stroke="#FAF5FF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const HeroBannerIllustration = () => (
  <svg width="280" height="130" viewBox="0 0 280 130" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto max-h-[130px]">
    <defs>
      <linearGradient id="globeHero" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#60A5FA" />
        <stop offset="1" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>

    {/* Plant in Pot */}
    <path d="M25 92 H55 L50 118 H30 L25 92 Z" fill="#F97316" />
    <path d="M22 88 H58 V94 H22 V88 Z" fill="#FB923C" />
    <path d="M40 88 C40 88 20 70 32 55 C44 70 40 88 40 88 Z" fill="#22C55E" />
    <path d="M40 88 C40 88 60 70 48 55 C36 70 40 88 40 88 Z" fill="#15803D" />

    {/* Stack of colorful books */}
    <rect x="68" y="104" width="85" height="14" rx="4" fill="#EF4444" />
    <rect x="72" y="106" width="77" height="10" rx="2" fill="#FEF2F2" />
    
    <rect x="72" y="90" width="80" height="14" rx="4" fill="#3B82F6" />
    <rect x="76" y="92" width="72" height="10" rx="2" fill="#EFF6FF" />

    <rect x="76" y="76" width="75" height="14" rx="4" fill="#10B981" />
    <rect x="80" y="78" width="67" height="10" rx="2" fill="#ECFDF5" />

    <rect x="82" y="62" width="68" height="14" rx="4" fill="#F59E0B" />
    <rect x="86" y="64" width="60" height="10" rx="2" fill="#FFFBEB" />

    {/* Desk Globe */}
    <circle cx="185" cy="65" r="28" fill="url(#globeHero)" />
    <path d="M168 60 C175 52 195 52 202 62 C188 72 172 70 168 60 Z" fill="#34D399" />
    <path d="M185 93 V118 M165 118 H205" stroke="#D97706" strokeWidth="5" strokeLinecap="round" />
    <path d="M157 65 C157 45 170 37 185 37 C200 37 213 45 213 65" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" fill="none" />

    {/* Pencil Holder with Pencils & Ruler */}
    <rect x="222" y="85" width="28" height="33" rx="6" fill="#0369A1" />
    <path d="M226 52 L232 85 H228 L222 52 Z" fill="#FACC15" />
    <path d="M234 45 L240 85 H236 L230 45 Z" fill="#EC4899" />
    <path d="M242 50 L246 85 H242 L238 50 Z" fill="#4ADE80" />

    {/* Memo Card "Curious Minds Brighter Futures" */}
    <rect x="240" y="22" width="36" height="70" rx="6" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="2" transform="rotate(6 258 57)" />
    <path d="M255 18 L261 24 L255 22 Z" fill="#EF4444" />
    <text x="245" y="38" fill="#92400E" fontSize="7" fontWeight="bold" fontFamily="sans-serif" transform="rotate(6 258 57)">Curious</text>
    <text x="246" y="48" fill="#92400E" fontSize="7" fontWeight="bold" fontFamily="sans-serif" transform="rotate(6 258 57)">Minds</text>
    <text x="244" y="58" fill="#92400E" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif" transform="rotate(6 258 57)">Brighter</text>
    <text x="245" y="68" fill="#92400E" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif" transform="rotate(6 258 57)">Futures</text>
    <text x="254" y="78" fill="#EF4444" fontSize="8" fontFamily="sans-serif" transform="rotate(6 258 57)">♥</text>
  </svg>
);

// Subject Metadata Configuration
const SUBJECT_CONFIGS = [
  {
    key: 'math',
    matchNames: ['math', 'mathematics', 'algebra', 'geometry'],
    name: 'Mathematics',
    description: 'Build logical thinking and problem solving skills.',
    masteredPercent: 5,
    bgColor: 'bg-[#F5F3FF]',
    borderColor: 'border-[#E9D5FF]',
    hoverBorder: 'hover:border-[#C084FC]',
    masteredColor: 'text-[#6366F1]',
    strokeColor: '#6366F1',
    ctaBg: 'bg-[#5B50F6] hover:bg-[#4A3FE2]',
    iconBtnBg: 'bg-[#EDE9FE] text-[#5B50F6] hover:bg-[#DDD6FE]',
    illustration: MathIllustration,
  },
  {
    key: 'science',
    matchNames: ['science', 'sci', 'biology', 'chemistry', 'physics'],
    name: 'Science',
    description: 'Explore the wonders of the natural world.',
    masteredPercent: 10,
    bgColor: 'bg-[#F0FDF4]',
    borderColor: 'border-[#BBF7D0]',
    hoverBorder: 'hover:border-[#4ADE80]',
    masteredColor: 'text-[#156149]',
    strokeColor: '#156149',
    ctaBg: 'bg-[#156149] hover:bg-[#0E4937]',
    iconBtnBg: 'bg-[#D1FAE5] text-[#156149] hover:bg-[#A7F3D0]',
    illustration: ScienceIllustration,
  },
  {
    key: 'english',
    matchNames: ['english', 'eng', 'literature', 'language'],
    name: 'English',
    description: 'Strengthen your reading, writing and communication.',
    masteredPercent: 4,
    bgColor: 'bg-[#FFF1F2]',
    borderColor: 'border-[#FECDD3]',
    hoverBorder: 'hover:border-[#FB7185]',
    masteredColor: 'text-[#D82B5A]',
    strokeColor: '#D82B5A',
    ctaBg: 'bg-[#D82B5A] hover:bg-[#B91C47]',
    iconBtnBg: 'bg-[#FFE4E6] text-[#D82B5A] hover:bg-[#FECDD3]',
    illustration: EnglishIllustration,
  },
  {
    key: 'social',
    matchNames: ['social', 'social studies', 'history', 'geography', 'sst', 'civics'],
    name: 'Social Studies',
    description: 'Understand our society, history and the world.',
    masteredPercent: 2,
    bgColor: 'bg-[#FEFCE8]',
    borderColor: 'border-[#FEF08A]',
    hoverBorder: 'hover:border-[#FACC15]',
    masteredColor: 'text-[#C68A00]',
    strokeColor: '#C68A00',
    ctaBg: 'bg-[#C68A00] hover:bg-[#A87500]',
    iconBtnBg: 'bg-[#FEF3C7] text-[#C68A00] hover:bg-[#FDE68A]',
    illustration: SSTIllustration,
  },
  {
    key: 'hindi',
    matchNames: ['hindi', 'hin', 'sanskrit'],
    name: 'Hindi',
    description: 'Develop language skills and cultural understanding.',
    masteredPercent: 9,
    bgColor: 'bg-[#F3E8FF]',
    borderColor: 'border-[#E9D5FF]',
    hoverBorder: 'hover:border-[#C084FC]',
    masteredColor: 'text-[#7C3AED]',
    strokeColor: '#7C3AED',
    ctaBg: 'bg-[#7C3AED] hover:bg-[#6D28D9]',
    iconBtnBg: 'bg-[#F3E8FF] text-[#7C3AED] hover:bg-[#E9D5FF]',
    illustration: HindiIllustration,
  },
];

const MasteryRing = ({ percent = 0, strokeColor = '#6366F1' }) => {
  const radius = 26;
  const strokeWidth = 4.5;
  const normalizedRadius = radius - strokeWidth * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            stroke="#E2E8F0"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={strokeColor}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className="absolute text-sm font-black text-slate-900 tracking-tight">
          {percent}%
        </span>
      </div>
      <span className="text-[11px] font-medium text-slate-400 -mt-0.5">Mastered</span>
    </div>
  );
};

const Subjects = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profileRes = await EducationService.getMyProfile();
        if (cancelled) return;
        const studentProfileId = profileRes?.data?.student_profile_id;
        const rawSubjects = (profileRes?.data?.subjects || []).map((s) => ({ id: s.subject_id, name: s.name }));

        const [chaptersBySubject, progressRes] = await Promise.all([
          Promise.all(rawSubjects.map((s) => EducationService.getChapters(s.id))),
          studentProfileId ? EducationService.getChapterProgress(studentProfileId) : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;

        const progressByChapter = new Map((progressRes?.data || []).map((p) => [p.chapter_id, p]));
        const enriched = rawSubjects.map((s, idx) => {
          const chapters = chaptersBySubject[idx]?.data || [];
          const completed = chapters.filter((c) => progressByChapter.get(c.chapter_id)?.status === 'completed').length;
          const avgProgress = chapters.length
            ? Math.round(
              chapters.reduce((sum, c) => sum + Number(progressByChapter.get(c.chapter_id)?.progress_percent || 0), 0) / chapters.length
            )
            : 0;
          return { ...s, chapterCount: chapters.length, completed, avgProgress };
        });
        setSubjects(enriched);
      } catch {
        // Fallback to standard 5 subjects if API call fails
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Merge API subjects with curated metadata or use default 5 subjects
  const mappedSubjects = SUBJECT_CONFIGS.map((config) => {
    const apiMatch = subjects.find((s) =>
      config.matchNames.some((m) => s.name.toLowerCase().includes(m))
    );
    return {
      ...config,
      id: apiMatch?.id || config.key,
      chapterCount: apiMatch?.chapterCount || 12,
      completed: apiMatch?.completed || Math.round((config.masteredPercent / 100) * 12),
      percent: apiMatch?.avgProgress !== undefined && apiMatch?.avgProgress > 0 ? apiMatch.avgProgress : config.masteredPercent,
    };
  });

  const filteredSubjects = mappedSubjects.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#F7F3EA] dark:bg-[#0b1324] py-6 px-2 sm:px-3 transition-colors">
      <div className="w-full space-y-6">
        
        {/* Top Header Hero Area */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Title & Subtitle */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#5B50F6] text-white flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0 mt-1">
              <BookOpen className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
                Learn
              </h1>
              <p className="text-slate-500 font-medium text-base sm:text-lg mt-1">
                Choose where you want to learn next.
              </p>
            </div>
          </div>

          {/* Right Handwriting Quote Banner with 3D Illustration */}
          <div className="bg-[#FFFDF9] border border-amber-200/60 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs max-w-2xl w-full">
            <div className="space-y-1 text-center sm:text-left">
              <p className="font-serif italic text-2xl sm:text-3xl text-[#78350F] font-semibold tracking-wide">
                “Explore.
              </p>
              <p className="font-serif italic text-2xl sm:text-3xl text-[#78350F] font-semibold tracking-wide pl-3">
                Learn.
              </p>
              <p className="font-serif italic text-2xl sm:text-3xl text-[#78350F] font-semibold tracking-wide pl-6">
                Master.
              </p>
              <p className="font-serif italic text-2xl sm:text-3xl text-[#78350F] font-semibold tracking-wide pl-9 relative inline-block">
                Grow.”
                <span className="absolute left-0 -bottom-1 w-full h-1 bg-[#F59E0B]/60 rounded-full" />
              </p>
            </div>

            <div className="w-64 sm:w-72 shrink-0">
              <HeroBannerIllustration />
            </div>
          </div>
        </div>

        {/* Search Bar (Optional Filter) */}
        {subjects.length > 5 && (
          <div className="relative max-w-md">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
          </div>
        )}

        {/* 5 Subject Cards Layout */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            {filteredSubjects.map((subject, index) => {
              const Illustration = subject.illustration;
              // Row 1: 3 cards (Math, Science, English -> col-span-2 each out of 6)
              // Row 2: 2 cards (Social Studies, Hindi -> col-span-3 each out of 6)
              const colSpanClass = index < 3 ? 'md:col-span-2' : 'md:col-span-3';

              return (
                <div
                  key={subject.key}
                  className={`${colSpanClass} ${subject.bgColor} border ${subject.borderColor} ${subject.hoverBorder} rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl group`}
                >
                  {/* Top Content Row: Illustration + Info + Mastery Ring */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {/* 3D SVG Illustration */}
                      <div className="w-24 h-24 shrink-0 flex items-center justify-center">
                        <Illustration />
                      </div>

                      {/* Title & Description */}
                      <div className="pt-1">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-slate-800 transition-colors">
                          {subject.name}
                        </h2>
                        <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1.5 leading-snug max-w-[220px]">
                          {subject.description}
                        </p>
                      </div>
                    </div>

                    {/* Mastery Ring Indicator */}
                    <div className="shrink-0 pt-1">
                      <MasteryRing percent={subject.percent} strokeColor={subject.strokeColor} />
                    </div>
                  </div>

                  {/* Bottom Action Row: Continue Learning Pill Button + Round Arrow */}
                  <div className="mt-8 flex items-center justify-between gap-3">
                    <button
                      onClick={() => navigate(`/my-learning/learning-path?subject=${subject.id}`)}
                      className={`flex-1 sm:flex-none ${subject.ctaBg} text-white px-6 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-sm group-hover:shadow-md cursor-pointer`}
                    >
                      <span>Continue Learning</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    <button
                      onClick={() => navigate(`/my-learning/learning-path?subject=${subject.id}`)}
                      className={`w-11 h-11 rounded-full ${subject.iconBtnBg} flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0`}
                    >
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
};

export default Subjects;

