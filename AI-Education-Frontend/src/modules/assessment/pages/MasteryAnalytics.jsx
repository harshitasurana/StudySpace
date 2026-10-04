import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
const MasteryAnalytics = () => {
  const navigate = useNavigate();

  return (
    <>
      {/* TopAppBar */}
      <div className="flex">
        {/* SideNavBar */}
        {/* Main Content Area */}
        <main className="flex-grow p-margin-mobile md:p-margin-desktop bg-surface-bright min-h-screen pb-20">
          <div className="max-w-7xl mx-auto space-y-stack-lg animate-fade-in">
            {/* Breadcrumbs & Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
              <div className="space-y-2">
                <nav className="flex items-center gap-2 text-[12px] font-label-md text-on-surface-variant uppercase tracking-wider">
                  <span className="hover:text-primary cursor-pointer" onClick={() => navigate('/student-portal')}>Analytics</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  <span className="hover:text-primary cursor-pointer" onClick={() => navigate('/curriculum')}>Grade 9</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  <span className="text-primary font-bold">Chapter: Triangles</span>
                </nav>
                <h1 className="font-headline-lg text-headline-lg text-primary font-bold">Chapter Drill-down: Triangles</h1>
              </div>
              <div className="flex gap-3">
                <button className="flex items-center gap-2 px-4 py-2 border border-border-subtle rounded-lg text-on-surface-variant hover:bg-surface-container transition-all cursor-pointer">
                  <span className="material-symbols-outlined">share</span>
                  <span className="font-label-md text-label-md">Share Access</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-container transition-all shadow-md cursor-pointer">
                  <span className="material-symbols-outlined">picture_as_pdf</span>
                  <span className="font-label-md text-label-md">Export Report</span>
                </button>
              </div>
            </div>

            {/* Dashboard Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
              {/* AI Summary Card */}
              <section className="col-span-12 bg-white p-6 rounded-xl border border-border-subtle shadow-sm relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ai-insight-purple"></div>
                <div className="bg-ai-insight-purple/10 p-4 rounded-full flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-ai-insight-purple text-[32px]">auto_awesome</span>
                </div>
                <div className="flex-grow">
                  <h2 className="font-label-md text-label-md text-ai-insight-purple font-bold mb-1 uppercase tracking-widest">AI Insight Summary</h2>
                  <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">
                    You show <span className="font-bold text-success-mastery">90% mastery</span> in micro-concept identification and basic theorem recall, but struggle with <span className="text-risk-red font-bold underline decoration-2 underline-offset-4">proof-based logic</span> and multi-step congruence applications. Recommendation: Focused practice on ASA/AAS logic sequencing.
                  </p>
                </div>
              </section>

              {/* Mastery Heatmap Grid */}
              <section className="col-span-12 md:col-span-8 bg-white border border-border-subtle rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-primary font-bold">Micro-Concept Mastery</h3>
                    <p className="text-on-surface-variant text-body-md">Heatmap of performance by sub-topic</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div onClick={() => navigate('/practice')} className="p-4 rounded-lg bg-success-mastery/10 border-l-4 border-success-mastery hover:shadow-md cursor-pointer transition-all">
                    <p className="text-label-md font-bold text-success-mastery mb-2">94%</p>
                    <p className="font-body-md text-on-surface font-semibold leading-tight">SSS Congruence</p>
                  </div>
                  <div onClick={() => navigate('/practice')} className="p-4 rounded-lg bg-success-mastery/10 border-l-4 border-success-mastery hover:shadow-md cursor-pointer transition-all">
                    <p className="text-label-md font-bold text-success-mastery mb-2">88%</p>
                    <p className="font-body-md text-on-surface font-semibold leading-tight">SAS Congruence</p>
                  </div>
                  <div onClick={() => navigate('/practice')} className="p-4 rounded-lg bg-secondary-container/10 border-l-4 border-secondary-container hover:shadow-md cursor-pointer transition-all">
                    <p className="text-label-md font-bold text-secondary mb-2">72%</p>
                    <p className="font-body-md text-on-surface font-semibold leading-tight">ASA Congruence</p>
                  </div>
                  <div onClick={() => navigate('/practice')} className="p-4 rounded-lg bg-secondary-container/10 border-l-4 border-secondary-container hover:shadow-md cursor-pointer transition-all">
                    <p className="text-label-md font-bold text-secondary mb-2">68%</p>
                    <p className="font-body-md text-on-surface font-semibold leading-tight">RHS Congruence</p>
                  </div>
                  <div onClick={() => navigate('/practice')} className="p-4 rounded-lg bg-risk-red/5 border-l-4 border-risk-red hover:shadow-md cursor-pointer transition-all">
                    <p className="text-label-md font-bold text-risk-red mb-2">42%</p>
                    <p className="font-body-md text-on-surface font-semibold leading-tight">Proof Writing</p>
                  </div>
                  <div onClick={() => navigate('/practice')} className="p-4 rounded-lg bg-secondary-container/10 border-l-4 border-secondary-container hover:shadow-md cursor-pointer transition-all">
                    <p className="text-label-md font-bold text-secondary mb-2">75%</p>
                    <p className="font-body-md text-on-surface font-semibold leading-tight">Inequalities</p>
                  </div>
                </div>
              </section>

              {/* Growth Trend */}
              <section className="col-span-12 md:col-span-4 bg-white border border-border-subtle rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-headline-md text-headline-md text-primary font-bold">Growth Trend</h3>
                  <p className="text-on-surface-variant text-body-md mb-6">Mastery development (Last 30 Days)</p>
                </div>
                <div className="h-32 relative flex items-end gap-1 mb-4">
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <path d="M0 80 Q 25 70, 50 40 T 100 20" fill="none" stroke="#1960a3" strokeWidth="2"></path>
                  </svg>
                  <div className="absolute inset-0 border-b border-l border-border-subtle pointer-events-none"></div>
                </div>
                <div className="flex justify-between text-[10px] font-label-md text-on-surface-variant">
                  <span>OCT 01</span>
                  <span>OCT 15</span>
                  <span>OCT 30</span>
                </div>
                <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center">
                  <div>
                    <p className="text-[12px] text-on-surface-variant">Current Mastery Avg</p>
                    <p className="font-headline-md text-headline-md text-success-mastery font-bold">74.2%</p>
                  </div>
                  <div className="flex items-center gap-1 text-success-mastery font-bold">
                    <span className="material-symbols-outlined text-[18px]">trending_up</span>
                    <span className="text-label-md">+12.4%</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default MasteryAnalytics;
