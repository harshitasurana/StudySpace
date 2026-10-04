import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import Quiz from '../../quiz/pages/Quiz';

const Practice = () => {
  const navigate = useNavigate();
  const [showQuizFlow, setShowQuizFlow] = useState(false);

  if (showQuizFlow) {
    return (
      <div className="relative">
        <div className="p-4 bg-[#F7F3EA] dark:bg-[#0b1324] flex items-center justify-between border-b border-slate-200">
          <button
            onClick={() => setShowQuizFlow(false)}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 cursor-pointer"
          >
            ← Back to Challenge Hub
          </button>
        </div>
        <Quiz />
      </div>
    );
  }

  return (
    <main className="flex-grow py-6 px-3 sm:px-6 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-8">

        {/* Top Hero Banner - Challenge & Practice Hub */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          {/* Background glowing blur */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-50 rounded-full blur-3xl pointer-events-none" />

          {/* Title & Subtitle */}
          <div className="flex items-start gap-4 z-10 max-w-2xl">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/25">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-xs mb-1">
                🏆 Challenge & Master
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Challenge & Learning Hub</h1>
              <p className="text-slate-500 font-medium text-sm md:text-base mt-1">
                Pick a learning module below to explore concepts, review flashcards, view interactive slide decks, or take chapter quizzes.
              </p>
            </div>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center gap-3 z-10 shrink-0">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-center">
              <span className="block text-xs font-bold text-slate-400 uppercase">Tools</span>
              <span className="text-xl font-extrabold text-indigo-600">4 AI Modules</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-center">
              <span className="block text-xs font-bold text-slate-400 uppercase">Status</span>
              <span className="text-xl font-extrabold text-emerald-600">Active</span>
            </div>
          </div>
        </motion.div>

        {/* Section 1: The 4 Core Challenge / Learning Modules */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">auto_awesome</span>
              Interactive Learning Tools
            </h2>
            <span className="text-xs font-semibold text-slate-400">Click any card to launch tool</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* 1. Concept Map */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              onClick={() => navigate('/practice/my-mind-maps')}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="w-full h-36 rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 border border-indigo-100 p-3 flex flex-col items-center justify-center relative mb-4">
                {/* 3D Lightbulb & Node Pills */}
                <div className="relative z-10 w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center shadow-md shadow-amber-300/40 mb-1">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7zM9 21a1 1 0 001 1h4a1 1 0 001-1v-1H9v1z" />
                  </svg>
                </div>
                <div className="flex gap-1.5 z-10">
                  <span className="px-2 py-0.5 bg-white/90 text-purple-700 font-extrabold text-[9px] rounded-full shadow-xs border border-purple-200">Ideas</span>
                  <span className="px-2 py-0.5 bg-white/90 text-indigo-700 font-extrabold text-[9px] rounded-full shadow-xs border border-indigo-200">Concepts</span>
                  <span className="px-2 py-0.5 bg-white/90 text-teal-700 font-extrabold text-[9px] rounded-full shadow-xs border border-teal-200">Explore</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🗺️</span>
                  <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                    Concept Map
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Turn a chapter into a clear, interactive concept map with floating topic nodes.
                </p>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600">Explore Maps</span>
                  <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    →
                  </span>
                </div>
              </div>
            </motion.div>

            {/* 2. Revision Cards */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              onClick={() => navigate('/practice/my-flashcards')}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="w-full h-36 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border border-amber-100 p-3 flex items-center justify-between relative mb-4">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-xl rotate-12 border border-blue-200" />
                  <div className="absolute top-1 right-2 w-16 h-16 bg-pink-100 rounded-xl -rotate-6 border border-pink-200" />
                  <div className="absolute top-2 right-1 w-16 h-16 bg-amber-100 rounded-xl border border-amber-200 shadow-sm flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-amber-600 text-sm">lightbulb</span>
                    <span className="text-[9px] font-extrabold text-slate-800">Learn</span>
                  </div>
                </div>
                <div className="text-right font-serif text-slate-600 text-xs italic leading-tight pr-1">
                  Flip<br />Revise<br />Remember<br />Grow
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🃏</span>
                  <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-amber-600 transition-colors">
                    Revision Cards
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Quick, focused cards for better revision, definitions, and active recall memory tests.
                </p>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-600">Study Cards</span>
                  <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all">
                    →
                  </span>
                </div>
              </div>
            </motion.div>

            {/* 3. Interactive Lesson */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              onClick={() => navigate('/practice/my-learning-decks')}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="w-full h-36 rounded-2xl bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 border border-pink-100 p-3 flex items-center justify-between relative mb-4">
                <div className="w-24 h-16 bg-gradient-to-r from-pink-400 to-purple-500 rounded-xl shadow-md p-1.5 text-white flex flex-col justify-between -rotate-3">
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[10px]">play_arrow</span>
                  </div>
                  <span className="text-[8px] font-extrabold bg-white/30 px-1 py-0.5 rounded-full text-center">Visual Slides</span>
                </div>
                <div className="text-right font-serif text-slate-600 text-xs italic leading-tight pr-1">
                  Learn<br />Step-by-Step<br />With Visuals
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🤖</span>
                  <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-rose-600 transition-colors">
                    Interactive Lesson
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  An AI-powered, visual walkthrough of the chapter with step-by-step slides.
                </p>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-600">Open Lessons</span>
                  <span className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-all">
                    →
                  </span>
                </div>
              </div>
            </motion.div>

            {/* 4. Visual Summary */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              onClick={() => navigate('/infographic')}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="w-full h-36 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 border border-purple-100 p-3 flex items-center justify-between relative mb-4">
                <div className="w-24 h-20 bg-white/90 rounded-xl border border-purple-200 p-2 flex flex-col justify-between shadow-xs">
                  <div className="flex gap-1 items-end h-8 border-b border-purple-100 pb-1">
                    <div className="w-2 h-4 bg-purple-400 rounded-xs" />
                    <div className="w-2 h-7 bg-indigo-500 rounded-xs" />
                    <div className="w-2 h-3 bg-pink-400 rounded-xs" />
                  </div>
                  <span className="text-[8px] font-extrabold text-purple-700 bg-purple-100 px-1 py-0.5 rounded-full text-center">Summary</span>
                </div>
                <div className="text-right font-serif text-slate-600 text-xs italic leading-tight pr-1">
                  Key Ideas<br />In One Glance
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-purple-600 transition-colors">
                    Visual Summary
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  A beautifully designed infographic summarizing formulas, definitions, and key exam tips.
                </p>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-600">Open Infographic</span>
                  <span className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
                    →
                  </span>
                </div>
              </div>
            </motion.div>

          </div>
        </div>

        {/* Section 2: Quizzes & Assessment Challenges */}
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">military_tech</span>
            Test & Quiz Challenges
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

            <div
              onClick={() => setShowQuizFlow(true)}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">quiz</span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-amber-600 transition-colors">
                  Chapter Practice Quiz
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  10 questions tailored to your current topic.
                </p>
              </div>
            </div>

            <div
              onClick={() => navigate('/mock-tests')}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">timer</span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                  Full Timed Mock Test
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Simulate real exam timing and scoring.
                </p>
              </div>
            </div>

            <div
              onClick={() => navigate('/practice/my-quizzes')}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">collections_bookmark</span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">
                  My Quizzes
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  View, review & reattempt all past quizzes.
                </p>
              </div>
            </div>

            <div
              onClick={() => navigate('/practice/mistakes')}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">published_with_changes</span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-rose-600 transition-colors">
                  Mistakes Review
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Re-attempt past wrong questions to build mastery.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
};

export default Practice;
